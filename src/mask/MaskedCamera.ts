export type CameraMode = 'mask' | 'original';

export interface MaskedCameraController {
  stream: MediaStream;
  stop: () => void;
}

type MindAREstimate = {
  metricLandmarks: number[][];
  faceMatrix: number[];
  faceScale: number;
};

type FaceMeshLike = {
  visible: boolean;
  material: {
    map?: unknown;
    transparent?: boolean;
    needsUpdate?: boolean;
  };
  matrix: {
    set: (...values: number[]) => void;
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
  addFaceMesh: () => FaceMeshLike;
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

type Vector3Like = {
  x: number;
  y: number;
  z: number;
  set: (x: number, y: number, z: number) => Vector3Like;
  copy: (value: Vector3Like) => Vector3Like;
  lerp: (value: Vector3Like, alpha: number) => Vector3Like;
  clone: () => Vector3Like;
  sub: (value: Vector3Like) => Vector3Like;
  multiplyScalar: (scalar: number) => Vector3Like;
  add: (value: Vector3Like) => Vector3Like;
  length: () => number;
};

type QuaternionLike = {
  copy: (value: QuaternionLike) => QuaternionLike;
  slerp: (value: QuaternionLike, alpha: number) => QuaternionLike;
};

type Matrix4Like = {
  set: (...values: number[]) => Matrix4Like;
  decompose: (
    position: Vector3Like,
    quaternion: QuaternionLike,
    scale: Vector3Like,
  ) => Matrix4Like;
  compose: (
    position: Vector3Like,
    quaternion: QuaternionLike,
    scale: Vector3Like,
  ) => Matrix4Like;
  elements: number[];
};

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
  Vector3: new () => Vector3Like;
  Quaternion: new () => QuaternionLike;
  Matrix4: new () => Matrix4Like;
};

const MINDAR_SPECIFIER = 'mindar-face-three';
const THREE_SPECIFIER = 'three';

const FACE_TEXTURE_URL =
  'https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/face-tracking/assets/sparkar/face-mask.png';

// MindAR's OneEuroFilter uses milliseconds. 0.001 corresponds to 1 Hz.
// Lower min cutoff suppresses idle jitter; higher beta opens the filter faster
// during deliberate motion.
const MINDAR_FILTER_MIN_CF = 0.00045;
const MINDAR_FILTER_BETA = 3.0;

// Keep the last stable mesh through short detector misses instead of making the
// mask blink off/on. On reacquisition interpolation resumes from the held pose.
const FACE_LOSS_GRACE_MS = 420;

// The outgoing stream is 30 fps, so rendering/compositing at 60 fps only wastes
// work. MindAR tracking continues independently at its own rate.
const OUTPUT_FRAME_MS = 1000 / 30;

// Extra display-stage interpolation is applied to MindAR's already-filtered
// metric landmarks. Small deltas are locked; larger motion gets a faster alpha.
const LANDMARK_DEADBAND_RATIO = 0.0009;
const LANDMARK_SLOW_ALPHA = 0.22;
const LANDMARK_FAST_ALPHA = 0.72;
const LANDMARK_FAST_RATIO = 0.018;

const POSE_DEADBAND_RATIO = 0.0008;
const POSE_SLOW_ALPHA = 0.26;
const POSE_FAST_ALPHA = 0.76;
const POSE_FAST_RATIO = 0.018;
const ROTATION_ALPHA = 0.48;

// Short translation prediction only when the head is really moving. This is
// capped tightly so the old 2D prediction jitter cannot return.
const PREDICTION_MS = 38;
const MIN_PREDICTION_SPEED_RATIO = 0.00016;
const MAX_PREDICTION_RATIO = 0.018;
const VELOCITY_BLEND = 0.32;

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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function adaptiveAlpha(
  magnitude: number,
  scale: number,
  slowAlpha: number,
  fastAlpha: number,
  fastRatio: number,
) {
  const ratio = magnitude / Math.max(1e-6, scale);
  const mix = clamp(ratio / fastRatio, 0, 1);
  return slowAlpha + (fastAlpha - slowAlpha) * mix;
}

function applyDeadband(delta: number, threshold: number) {
  const magnitude = Math.abs(delta);
  if (magnitude <= threshold) return 0;
  return Math.sign(delta) * (magnitude - threshold);
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

  // MindARThree owns the camera stream in the official FaceMesh module.
  // Release only DeviceCheck's temporary video track before MindAR reopens it.
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

    // Official MindAR FaceMesh module/API.
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

    const canvasStream = outputCanvas.captureStream(30);
    const outputVideoTrack = canvasStream.getVideoTracks()[0];

    if (!outputVideoTrack) {
      throw new Error('MindAR FaceMesh 출력 영상 트랙을 만들지 못했습니다.');
    }

    outputVideoTrack.contentHint = 'motion';

    outputStream = new MediaStream([
      outputVideoTrack,
      ...source.getAudioTracks(),
    ]);

    const targetMatrix = new THREE.Matrix4();
    const displayMatrix = new THREE.Matrix4();

    const targetPosition = new THREE.Vector3();
    const targetQuaternion = new THREE.Quaternion();
    const targetScale = new THREE.Vector3();

    const displayPosition = new THREE.Vector3();
    const displayQuaternion = new THREE.Quaternion();
    const displayScale = new THREE.Vector3();

    const lastTargetPosition = new THREE.Vector3();
    const velocity = new THREE.Vector3();

    const displayLandmarks = new Float32Array(468 * 3);

    let havePose = false;
    let haveLandmarks = false;
    let lastSeenAt = 0;
    let lastRenderAt = 0;
    let lastTargetAt = 0;

    const updateFilteredGeometry = (
      estimate: MindAREstimate,
      now: number,
    ) => {
      const metric = estimate.metricLandmarks;
      if (!metric || metric.length < 468) return;

      const faceScale = Math.max(1e-4, Math.abs(estimate.faceScale || 1));

      if (!haveLandmarks) {
        for (let i = 0; i < 468; i++) {
          displayLandmarks[i * 3] = metric[i][0];
          displayLandmarks[i * 3 + 1] = metric[i][1];
          displayLandmarks[i * 3 + 2] = metric[i][2];
        }
        haveLandmarks = true;
      } else {
        const deadband = faceScale * LANDMARK_DEADBAND_RATIO;

        for (let i = 0; i < 468; i++) {
          const base = i * 3;

          for (let axis = 0; axis < 3; axis++) {
            const currentValue = displayLandmarks[base + axis];
            const targetValue = metric[i][axis];
            const delta = applyDeadband(
              targetValue - currentValue,
              deadband,
            );

            if (delta === 0) continue;

            const alpha = adaptiveAlpha(
              Math.abs(delta),
              faceScale,
              LANDMARK_SLOW_ALPHA,
              LANDMARK_FAST_ALPHA,
              LANDMARK_FAST_RATIO,
            );

            displayLandmarks[base + axis] =
              currentValue + delta * alpha;
          }
        }
      }

      const positionAttribute = faceMesh.geometry.attributes.position;
      positionAttribute.array.set(displayLandmarks);
      positionAttribute.needsUpdate = true;

      // MindAR already computed normals during its own tracking update.
      // Do not recompute them again here; that was one of the expensive paths.
      void now;
    };

    const updateFilteredPose = (
      estimate: MindAREstimate,
      now: number,
    ) => {
      if (!estimate.faceMatrix || estimate.faceMatrix.length !== 16) return;

      targetMatrix.set(...estimate.faceMatrix);
      targetMatrix.decompose(
        targetPosition,
        targetQuaternion,
        targetScale,
      );

      const faceScale = Math.max(1e-4, Math.abs(estimate.faceScale || 1));

      if (!havePose) {
        displayPosition.copy(targetPosition);
        displayQuaternion.copy(targetQuaternion);
        displayScale.copy(targetScale);
        lastTargetPosition.copy(targetPosition);
        lastTargetAt = now;
        havePose = true;
      } else {
        const dx = targetPosition.x - displayPosition.x;
        const dy = targetPosition.y - displayPosition.y;
        const dz = targetPosition.z - displayPosition.z;

        const deadband = faceScale * POSE_DEADBAND_RATIO;

        const moveX = applyDeadband(dx, deadband);
        const moveY = applyDeadband(dy, deadband);
        const moveZ = applyDeadband(dz, deadband);

        const moveMagnitude = Math.hypot(moveX, moveY, moveZ);
        const poseAlpha = adaptiveAlpha(
          moveMagnitude,
          faceScale,
          POSE_SLOW_ALPHA,
          POSE_FAST_ALPHA,
          POSE_FAST_RATIO,
        );

        displayPosition.set(
          displayPosition.x + moveX * poseAlpha,
          displayPosition.y + moveY * poseAlpha,
          displayPosition.z + moveZ * poseAlpha,
        );

        displayQuaternion.slerp(targetQuaternion, ROTATION_ALPHA);
        displayScale.lerp(targetScale, 0.30);

        if (lastTargetAt > 0 && now > lastTargetAt) {
          const dt = now - lastTargetAt;
          const measuredVelocity = targetPosition
            .clone()
            .sub(lastTargetPosition)
            .multiplyScalar(1 / dt);

          velocity
            .multiplyScalar(1 - VELOCITY_BLEND)
            .add(measuredVelocity.multiplyScalar(VELOCITY_BLEND));
        }

        lastTargetPosition.copy(targetPosition);
        lastTargetAt = now;
      }

      const speed = velocity.length();
      const predictionThreshold =
        faceScale * MIN_PREDICTION_SPEED_RATIO;

      const predictedPosition = displayPosition.clone();

      if (speed > predictionThreshold) {
        const prediction = velocity
          .clone()
          .multiplyScalar(PREDICTION_MS);

        const maxPrediction = faceScale * MAX_PREDICTION_RATIO;
        const predictionLength = prediction.length();

        if (predictionLength > maxPrediction && predictionLength > 0) {
          prediction.multiplyScalar(maxPrediction / predictionLength);
        }

        predictedPosition.add(prediction);
      } else {
        velocity.multiplyScalar(0.55);
      }

      displayMatrix.compose(
        predictedPosition,
        displayQuaternion,
        displayScale,
      );

      // THREE.Matrix4#set expects row-major argument order. elements are
      // column-major, so copy through the Matrix4 object by setting each
      // displayed matrix from its decomposed pose.
      faceMesh.matrix.set(
        displayMatrix.elements[0],
        displayMatrix.elements[4],
        displayMatrix.elements[8],
        displayMatrix.elements[12],
        displayMatrix.elements[1],
        displayMatrix.elements[5],
        displayMatrix.elements[9],
        displayMatrix.elements[13],
        displayMatrix.elements[2],
        displayMatrix.elements[6],
        displayMatrix.elements[10],
        displayMatrix.elements[14],
        displayMatrix.elements[3],
        displayMatrix.elements[7],
        displayMatrix.elements[11],
        displayMatrix.elements[15],
      );
    };

    renderer.setAnimationLoop((now) => {
      if (stopped) return;

      // The output stream is 30 fps. Skip duplicate work between output frames.
      if (now - lastRenderAt < OUTPUT_FRAME_MS) return;
      lastRenderAt = now;

      const estimate = mindar.getLatestEstimate();

      if (estimate) {
        lastSeenAt = now;
        faceMesh.visible = true;

        // MindAR internally One-Euro-filters metricLandmarks/faceMatrix.
        // Its own FaceGeometry update path uses the raw estimate; overwrite the
        // geometry here with getLatestEstimate().metricLandmarks so the built-in
        // One Euro filter actually reaches the visible FaceMesh.
        updateFilteredGeometry(estimate, now);
        updateFilteredPose(estimate, now);
      } else {
        const withinGrace =
          havePose &&
          haveLandmarks &&
          now - lastSeenAt <= FACE_LOSS_GRACE_MS;

        faceMesh.visible = withinGrace;

        if (!withinGrace) {
          havePose = false;
          haveLandmarks = false;
          velocity.set(0, 0, 0);
        }
      }

      renderer.render(scene, camera);

      // MindAR's user-facing video is mirrored with CSS. Reproduce the same
      // official visual composition into the outgoing WebRTC canvas.
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
