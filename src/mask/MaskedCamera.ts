export type CameraMode = 'mask' | 'original';

export interface MaskedCameraController {
  stream: MediaStream;
  stop: () => void;
}

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
  getLatestEstimate: () => {
    metricLandmarks: number[][];
    faceMatrix: number[];
    faceScale: number;
  } | null;
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

// MindAR already uses One Euro internally. Keep that implementation, but tune it
// for stronger idle stability and a faster response once motion is real.
const MINDAR_FILTER_MIN_CF = 0.0007;
const MINDAR_FILTER_BETA = 3.0;

// MindAR filters metricLandmarks internally, but its FaceGeometry update path
// writes the raw estimate into the visible mesh. We copy the filtered landmarks
// back into the visible geometry and suppress only sub-threshold micro motion.
const LANDMARK_DEADBAND_RATIO = 0.0007;
const LANDMARK_DEADBAND_MIN = 0.003;

// Keep the last valid mesh briefly when the detector misses a few frames.
// This prevents blink-off/blink-on without adding motion latency.
const FACE_LOSS_GRACE_MS = 420;

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
): Promise<MaskedCameraController> {
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
      filterMinCF: MINDAR_FILTER_MIN_CF,
      filterBeta: MINDAR_FILTER_BETA,
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

    // Match the browser render cadence more closely. The previous 30fps cap
    // added visible follow lag compared with the original MindAR demo.
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

    let lastSeenAt = 0;
    let everSeenFace = false;
    let haveDisplayedLandmarks = false;

    const displayedLandmarks = new Float32Array(468 * 3);

    const applyFilteredGeometry = (
      metricLandmarks: number[][],
      faceScale: number,
    ) => {
      if (!metricLandmarks || metricLandmarks.length < 468) return;

      const position = faceMesh.geometry.attributes.position;
      const target = position.array;
      const deadband = Math.max(
        LANDMARK_DEADBAND_MIN,
        Math.abs(faceScale || 1) * LANDMARK_DEADBAND_RATIO,
      );

      if (!haveDisplayedLandmarks) {
        for (let i = 0; i < 468; i++) {
          const base = i * 3;
          displayedLandmarks[base] = metricLandmarks[i][0];
          displayedLandmarks[base + 1] = metricLandmarks[i][1];
          displayedLandmarks[base + 2] = metricLandmarks[i][2];
        }
        haveDisplayedLandmarks = true;
      } else {
        for (let i = 0; i < 468; i++) {
          const base = i * 3;

          for (let axis = 0; axis < 3; axis++) {
            const currentValue = displayedLandmarks[base + axis];
            const nextValue = metricLandmarks[i][axis];
            const delta = nextValue - currentValue;

            if (Math.abs(delta) <= deadband) {
              continue;
            }

            // Soft deadband: keep only the tiny noise band out of the motion.
            // There is no EMA/prediction stage here, so deliberate motion
            // remains essentially as fast as MindAR's own filtered result.
            displayedLandmarks[base + axis] =
              nextValue - Math.sign(delta) * deadband;
          }
        }
      }

      target.set(displayedLandmarks);
      position.needsUpdate = true;
    };

    renderer.setAnimationLoop((now) => {
      if (stopped) return;

      const estimate = mindar.getLatestEstimate();

      if (estimate) {
        lastSeenAt = now;
        everSeenFace = true;
        faceMesh.visible = true;

        // This is MindAR's already One-Euro-filtered landmark set.
        // Writing it back here fixes the upstream FaceGeometry path that
        // otherwise uses the raw estimate and visibly jitters.
        applyFilteredGeometry(
          estimate.metricLandmarks,
          estimate.faceScale,
        );
      } else if (everSeenFace && now - lastSeenAt <= FACE_LOSS_GRACE_MS) {
        faceMesh.visible = true;
      } else if (everSeenFace) {
        faceMesh.visible = false;
        haveDisplayedLandmarks = false;
      }

      renderer.render(scene, camera);

      // Compose the two official MindAR visual layers into a streamable canvas.
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
