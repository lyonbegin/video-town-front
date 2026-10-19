export type CameraMode = 'mask' | 'original';

export interface MaskedCameraController {
  stream: MediaStream;
  stop: () => void;
}

export interface MaskTuning {
  // Extra display-stage One Euro filter that we apply after MindAR.
  postMinCutoff: number;
  postBeta: number;

  // MindAR's own built-in One Euro filter.
  mindarMinCutoff: number;
  mindarBeta: number;
}

export const DEFAULT_MASK_TUNING: MaskTuning = {
  postMinCutoff: 0.0007,
  postBeta: 3.0,
  mindarMinCutoff: 0.001,
  mindarBeta: 1.0,
};

type MindAREstimate = {
  metricLandmarks: number[][];
  faceMatrix: number[];
  faceScale: number;
};

type MindARThreeInstance = {
  renderer: {
    domElement: HTMLCanvasElement;
    render: (scene: unknown, camera: unknown) => void;
    setAnimationLoop: (
      callback: ((time: number) => void) | null,
    ) => void;
    dispose?: () => void;
  };
  scene: {
    add: (...objects: unknown[]) => void;
  };
  camera: unknown;
  video?: HTMLVideoElement;
  addFaceMesh: () => {
    visible: boolean;
    material: {
      map?: unknown;
      transparent?: boolean;
      needsUpdate?: boolean;
    };
    geometry: {
      attributes: {
        position: {
          array: Float32Array;
          needsUpdate: boolean;
        };
      };
    };
  };
  getLatestEstimate: () => MindAREstimate | null;
  start: () => Promise<void>;
  stop: () => void;
};

type MindARThreeConstructor = new (options: {
  container: HTMLElement;
  userDeviceId?: string | null;
  filterMinCF?: number | null;
  filterBeta?: number | null;
}) => MindARThreeInstance;

type MindARModule = {
  MindARThree: MindARThreeConstructor;
};

type ThreeModule = {
  HemisphereLight: new (
    skyColor?: number,
    groundColor?: number,
    intensity?: number,
  ) => unknown;
  TextureLoader: new () => {
    load: (url: string) => unknown;
  };
};

const MINDAR_SPECIFIER = 'mindar-face-three';
const THREE_SPECIFIER = 'three';

const FACE_TEXTURE_URL =
  'https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/face-tracking/assets/sparkar/face-mask.png';

const FACE_VERTEX_COUNT = 468;
const FACE_LOSS_GRACE_MS = 420;

// This is the same One Euro implementation used by MindAR:
// src/libs/one-euro-filter.js. MindAR uses timestamps in milliseconds and
// dCutOff=0.001, which corresponds to 1 Hz with that time unit.
class MindAROneEuroFilter {
  private readonly minCutOff: number;
  private readonly beta: number;
  private readonly dCutOff = 0.001;

  private xPrev: Float32Array | null = null;
  private dxPrev: Float32Array | null = null;
  private tPrev = 0;
  private initialized = false;

  constructor(minCutOff: number, beta: number) {
    this.minCutOff = minCutOff;
    this.beta = beta;
  }

  reset() {
    this.initialized = false;
    this.xPrev = null;
    this.dxPrev = null;
  }

  filter(t: number, x: Float32Array): Float32Array {
    if (!this.initialized || !this.xPrev || !this.dxPrev) {
      this.initialized = true;
      this.xPrev = new Float32Array(x);
      this.dxPrev = new Float32Array(x.length);
      this.tPrev = t;
      return new Float32Array(x);
    }

    const te = Math.max(0.001, t - this.tPrev);
    const ad = this.smoothingFactor(te, this.dCutOff);

    const xHat = new Float32Array(x.length);
    const dxHat = new Float32Array(x.length);

    for (let i = 0; i < x.length; i++) {
      const dx = (x[i] - this.xPrev[i]) / te;
      dxHat[i] = ad * dx + (1 - ad) * this.dxPrev[i];

      const cutOff =
        this.minCutOff + this.beta * Math.abs(dxHat[i]);
      const a = this.smoothingFactor(te, cutOff);

      xHat[i] = a * x[i] + (1 - a) * this.xPrev[i];
    }

    this.xPrev = xHat;
    this.dxPrev = dxHat;
    this.tPrev = t;

    return xHat;
  }

  private smoothingFactor(te: number, cutoff: number) {
    const r = 2 * Math.PI * cutoff * te;
    return r / (r + 1);
  }
}

function sanitizeTuning(tuning?: Partial<MaskTuning>): MaskTuning {
  const value = {
    ...DEFAULT_MASK_TUNING,
    ...tuning,
  };

  const finitePositive = (n: number, fallback: number) =>
    Number.isFinite(n) && n > 0 ? n : fallback;

  const finiteNonNegative = (n: number, fallback: number) =>
    Number.isFinite(n) && n >= 0 ? n : fallback;

  return {
    postMinCutoff: finitePositive(
      value.postMinCutoff,
      DEFAULT_MASK_TUNING.postMinCutoff,
    ),
    postBeta: finiteNonNegative(
      value.postBeta,
      DEFAULT_MASK_TUNING.postBeta,
    ),
    mindarMinCutoff: finitePositive(
      value.mindarMinCutoff,
      DEFAULT_MASK_TUNING.mindarMinCutoff,
    ),
    mindarBeta: finiteNonNegative(
      value.mindarBeta,
      DEFAULT_MASK_TUNING.mindarBeta,
    ),
  };
}

async function loadOfficialMindARModules() {
  const [mindar, three] = await Promise.all([
    import(
      /* @vite-ignore */ MINDAR_SPECIFIER
    ) as Promise<MindARModule>,
    import(
      /* @vite-ignore */ THREE_SPECIFIER
    ) as Promise<ThreeModule>,
  ]);

  return {
    MindARThree: mindar.MindARThree,
    THREE: three,
  };
}

function createOffscreenContainer() {
  const container = document.createElement('div');

  Object.assign(container.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: '960px',
    height: '540px',
    overflow: 'hidden',
    pointerEvents: 'none',
    opacity: '0',
  });

  document.body.appendChild(container);

  return container;
}

export async function createMaskedCameraStream(
  source: MediaStream,
  tuningInput?: Partial<MaskTuning>,
): Promise<MaskedCameraController> {
  const tuning = sanitizeTuning(tuningInput);
  const sourceVideoTrack = source.getVideoTracks()[0];

  if (!sourceVideoTrack) {
    throw new Error('복면 모드에 사용할 카메라 트랙이 없습니다.');
  }

  if (!HTMLCanvasElement.prototype.captureStream) {
    throw new Error('현재 브라우저는 Canvas 영상 출력을 지원하지 않습니다.');
  }

  const deviceId = sourceVideoTrack.getSettings().deviceId ?? null;

  // MindAR owns the camera in the official FaceMesh module.
  sourceVideoTrack.stop();

  const container = createOffscreenContainer();

  let mindarThree: MindARThreeInstance | undefined;
  let outputStream: MediaStream | undefined;
  let stopped = false;

  try {
    const { MindARThree, THREE } = await loadOfficialMindARModules();

    const mindar = new MindARThree({
      container,
      userDeviceId: deviceId,
      filterMinCF: tuning.mindarMinCutoff,
      filterBeta: tuning.mindarBeta,
    });

    mindarThree = mindar;

    const { renderer, scene, camera } = mindar;

    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    scene.add(light);

    const faceMesh = mindar.addFaceMesh();

    const texture = new THREE.TextureLoader().load(FACE_TEXTURE_URL);
    faceMesh.material.map = texture;
    faceMesh.material.transparent = true;
    faceMesh.material.needsUpdate = true;

    scene.add(faceMesh);

    await mindar.start();

    const video = mindar.video;

    if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) {
      throw new Error('MindAR FaceMesh 카메라 영상을 초기화하지 못했습니다.');
    }

    const outputScale = Math.min(
      1,
      960 / video.videoWidth,
      540 / video.videoHeight,
    );

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = Math.max(
      320,
      Math.round(video.videoWidth * outputScale),
    );
    outputCanvas.height = Math.max(
      240,
      Math.round(video.videoHeight * outputScale),
    );

    const ctx = outputCanvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
    });

    if (!ctx) {
      throw new Error('MindAR FaceMesh 출력 Canvas를 만들지 못했습니다.');
    }

    const canvasStream = outputCanvas.captureStream(60);
    const outputVideoTrack = canvasStream.getVideoTracks()[0];

    if (!outputVideoTrack) {
      throw new Error('MindAR FaceMesh 출력 영상 트랙을 만들지 못했습니다.');
    }

    outputVideoTrack.contentHint = 'motion';

    outputStream = new MediaStream([
      outputVideoTrack,
      ...source.getAudioTracks(),
    ]);

    const postFilter = new MindAROneEuroFilter(
      tuning.postMinCutoff,
      tuning.postBeta,
    );

    const flatMetric = new Float32Array(FACE_VERTEX_COUNT * 3);

    let lastSeenAt = 0;
    let everSeenFace = false;

    const applyPostFilter = (
      metricLandmarks: number[][],
      now: number,
    ) => {
      if (!metricLandmarks || metricLandmarks.length < FACE_VERTEX_COUNT) {
        return;
      }

      for (let i = 0; i < FACE_VERTEX_COUNT; i++) {
        const base = i * 3;
        flatMetric[base] = metricLandmarks[i][0];
        flatMetric[base + 1] = metricLandmarks[i][1];
        flatMetric[base + 2] = metricLandmarks[i][2];
      }

      const filtered = postFilter.filter(now, flatMetric);
      const position = faceMesh.geometry.attributes.position;

      position.array.set(filtered);
      position.needsUpdate = true;
    };

    renderer.setAnimationLoop((now) => {
      if (stopped) return;

      const estimate = mindar.getLatestEstimate();

      if (estimate) {
        lastSeenAt = now;
        everSeenFace = true;
        faceMesh.visible = true;

        // Layer 1: MindAR internal One Euro.
        // Layer 2: separately tunable display-stage One Euro.
        applyPostFilter(estimate.metricLandmarks, now);
      } else if (everSeenFace && now - lastSeenAt <= FACE_LOSS_GRACE_MS) {
        faceMesh.visible = true;
      } else if (everSeenFace) {
        faceMesh.visible = false;
        postFilter.reset();
      }

      renderer.render(scene, camera);

      ctx.save();
      ctx.translate(outputCanvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(
        video,
        0,
        0,
        outputCanvas.width,
        outputCanvas.height,
      );
      ctx.restore();

      ctx.drawImage(
        renderer.domElement,
        0,
        0,
        outputCanvas.width,
        outputCanvas.height,
      );
    });

    const stop = () => {
      if (stopped) return;
      stopped = true;

      try {
        renderer.setAnimationLoop(null);
      } catch {
        // no-op
      }

      try {
        mindar.stop();
      } catch {
        // no-op
      }

      outputStream?.getVideoTracks().forEach((track) => {
        if (track.readyState !== 'ended') track.stop();
      });

      source.getAudioTracks().forEach((track) => {
        if (track.readyState !== 'ended') track.stop();
      });

      try {
        renderer.dispose?.();
      } catch {
        // no-op
      }

      container.remove();
    };

    outputVideoTrack.addEventListener('ended', stop, { once: true });

    return {
      stream: outputStream,
      stop,
    };
  } catch (error) {
    stopped = true;

    try {
      mindarThree?.renderer.setAnimationLoop(null);
    } catch {
      // no-op
    }

    try {
      mindarThree?.stop();
    } catch {
      // no-op
    }

    source.getAudioTracks().forEach((track) => {
      if (track.readyState !== 'ended') track.stop();
    });

    container.remove();

    throw error;
  }
}
