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
  };
  getLatestEstimate: () => unknown | null;
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

// Match MindAR's own FaceMesh behavior instead of layering a second filter on top.
// These are the upstream defaults from src/face-target/controller.js.
const MINDAR_FILTER_MIN_CF = 0.001;
const MINDAR_FILTER_BETA = 1;

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

    renderer.setAnimationLoop((now) => {
      if (stopped) return;

      const estimate = mindar.getLatestEstimate();

      if (estimate) {
        lastSeenAt = now;
        everSeenFace = true;
        faceMesh.visible = true;
      } else if (everSeenFace && now - lastSeenAt <= FACE_LOSS_GRACE_MS) {
        // Hold the exact last geometry/matrix produced by MindAR.
        // No extra interpolation or prediction is applied here.
        faceMesh.visible = true;
      }

      // Use MindAR's own geometry updates, pose matrix and One Euro filter
      // exactly as the upstream ThreeJS FaceMesh demo does.
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
