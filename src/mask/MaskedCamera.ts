export type CameraMode = 'mask' | 'original';

export interface MaskTuning {
  minCutoff: number;
  beta: number;
}

export interface AdaptiveFilterStatus {
  phase: 'warming' | 'adaptive';
  minCutoff: number;
  beta: number;
  fps: number;
  frameIntervalMs: number;
  noiseFloor: number;
  stationaryJitter: number;
  trackingError: number;
  responseRatio: number;
  stationaryRatio: number;
}

export interface MaskedCameraController {
  stream: MediaStream;
  stop: () => void;
  getAdaptiveStatus: () => AdaptiveFilterStatus;
}

export const DEFAULT_MASK_TUNING: MaskTuning = {
  minCutoff: 0.001,
  beta: 1.0,
};

type MindAREstimate = {
  metricLandmarks: number[][];
  faceMatrix: number[];
  faceScale: number;
};

type MutableOneEuroFilter = {
  minCutOff: number;
  beta: number;
};

type MindARController = {
  filterMinCF: number;
  filterBeta: number;
  landmarkFilters: MutableOneEuroFilter[];
  faceMatrixFilter: MutableOneEuroFilter;
  faceScaleFilter: MutableOneEuroFilter;
};

type FaceMeshLike = {
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
  controller: MindARController;
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

// Stable points only. Mouth and most eyelid points are intentionally excluded
// so expression changes are not mistaken for tracker jitter.
const ADAPTIVE_LANDMARKS = [
  1, 4, 5, 10, 21, 33, 54, 67, 93, 127, 133, 152,
  162, 168, 197, 234, 263, 284, 297, 323, 356, 362, 389, 454,
];

const ADAPTIVE_WARMUP_MS = 1800;
const ADAPTIVE_MIN_WARMUP_FRAMES = 40;
const ADAPTIVE_TUNE_INTERVAL_MS = 350;

const MIN_CUTOFF_MIN = 0.0001;
const MIN_CUTOFF_MAX = 0.02;
const BETA_MIN = 0.05;
const BETA_MAX = 20;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function ewma(previous: number, value: number, alpha: number) {
  if (!Number.isFinite(previous) || previous <= 0) return value;
  return previous + alpha * (value - previous);
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round((sorted.length - 1) * p)),
  );

  return sorted[index];
}

function rmsDiff(a: Float32Array, b: Float32Array) {
  let sum = 0;

  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }

  return Math.sqrt(sum / Math.max(1, a.length));
}

function rmsDelta(current: Float32Array, previous: Float32Array) {
  let sum = 0;

  for (let i = 0; i < current.length; i++) {
    const d = current[i] - previous[i];
    sum += d * d;
  }

  return Math.sqrt(sum / Math.max(1, current.length));
}

function sanitizeTuning(tuning?: Partial<MaskTuning>): MaskTuning {
  const value = {
    ...DEFAULT_MASK_TUNING,
    ...tuning,
  };

  return {
    minCutoff:
      Number.isFinite(value.minCutoff) && value.minCutoff > 0
        ? clamp(value.minCutoff, MIN_CUTOFF_MIN, MIN_CUTOFF_MAX)
        : DEFAULT_MASK_TUNING.minCutoff,
    beta:
      Number.isFinite(value.beta) && value.beta >= 0
        ? clamp(value.beta, BETA_MIN, BETA_MAX)
        : DEFAULT_MASK_TUNING.beta,
  };
}

function setMindARFilterParameters(
  controller: MindARController,
  minCutoff: number,
  beta: number,
) {
  controller.filterMinCF = minCutoff;
  controller.filterBeta = beta;

  for (const filter of controller.landmarkFilters) {
    filter.minCutOff = minCutoff;
    filter.beta = beta;
  }

  controller.faceMatrixFilter.minCutOff = minCutoff;
  controller.faceMatrixFilter.beta = beta;
  controller.faceScaleFilter.minCutOff = minCutoff;
  controller.faceScaleFilter.beta = beta;
}

function faceScaleFromPositions(raw: Float32Array) {
  const distance = (a: number, b: number) => {
    const ai = a * 3;
    const bi = b * 3;

    return Math.hypot(
      raw[bi] - raw[ai],
      raw[bi + 1] - raw[ai + 1],
      raw[bi + 2] - raw[ai + 2],
    );
  };

  const width = distance(234, 454);
  const height = distance(10, 152);

  return Math.max(1e-6, (width + height) * 0.5);
}

function extractStableRaw(raw: Float32Array) {
  const values = new Float32Array(ADAPTIVE_LANDMARKS.length * 3);

  for (let i = 0; i < ADAPTIVE_LANDMARKS.length; i++) {
    const src = ADAPTIVE_LANDMARKS[i] * 3;
    const dst = i * 3;

    values[dst] = raw[src];
    values[dst + 1] = raw[src + 1];
    values[dst + 2] = raw[src + 2];
  }

  return values;
}

function extractStableFiltered(metricLandmarks: number[][]) {
  const values = new Float32Array(ADAPTIVE_LANDMARKS.length * 3);

  for (let i = 0; i < ADAPTIVE_LANDMARKS.length; i++) {
    const src = ADAPTIVE_LANDMARKS[i];
    const dst = i * 3;
    const point = metricLandmarks[src];

    values[dst] = point[0];
    values[dst + 1] = point[1];
    values[dst + 2] = point[2];
  }

  return values;
}

function writeMindARFilteredGeometry(
  faceMesh: FaceMeshLike,
  estimate: MindAREstimate,
) {
  if (
    !estimate.metricLandmarks ||
    estimate.metricLandmarks.length < FACE_VERTEX_COUNT
  ) {
    return;
  }

  const position = faceMesh.geometry.attributes.position;
  const target = position.array;

  for (let i = 0; i < FACE_VERTEX_COUNT; i++) {
    const base = i * 3;
    target[base] = estimate.metricLandmarks[i][0];
    target[base + 1] = estimate.metricLandmarks[i][1];
    target[base + 2] = estimate.metricLandmarks[i][2];
  }

  position.needsUpdate = true;
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
  const initialTuning = sanitizeTuning(tuningInput);
  const sourceVideoTrack = source.getVideoTracks()[0];

  if (!sourceVideoTrack) {
    throw new Error('복면 모드에 사용할 카메라 트랙이 없습니다.');
  }

  if (!HTMLCanvasElement.prototype.captureStream) {
    throw new Error('현재 브라우저는 Canvas 영상 출력을 지원하지 않습니다.');
  }

  const deviceId = sourceVideoTrack.getSettings().deviceId ?? null;
  sourceVideoTrack.stop();

  const container = createOffscreenContainer();

  let mindarThree: MindARThreeInstance | undefined;
  let outputStream: MediaStream | undefined;
  let stopped = false;

  try {
    const { MindARThree, THREE } = await loadOfficialMindARModules();

    // There is exactly one live smoothing stage: MindAR's native One Euro
    // filters. The adaptive controller below changes these existing filter
    // objects in-place instead of adding another filter.
    const mindar = new MindARThree({
      container,
      userDeviceId: deviceId,
      filterMinCF: initialTuning.minCutoff,
      filterBeta: initialTuning.beta,
    });

    mindarThree = mindar;

    const { renderer, scene, camera } = mindar;

    const light = new THREE.HemisphereLight(
      0xffffff,
      0xbbbbff,
      1,
    );
    scene.add(light);

    const faceMesh = mindar.addFaceMesh();

    const texture = new THREE.TextureLoader().load(
      FACE_TEXTURE_URL,
    );
    faceMesh.material.map = texture;
    faceMesh.material.transparent = true;
    faceMesh.material.needsUpdate = true;

    scene.add(faceMesh);

    await mindar.start();

    const video = mindar.video;

    if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) {
      throw new Error(
        'MindAR FaceMesh 카메라 영상을 초기화하지 못했습니다.',
      );
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
      throw new Error(
        'MindAR FaceMesh 출력 Canvas를 만들지 못했습니다.',
      );
    }

    const canvasStream = outputCanvas.captureStream(60);
    const outputVideoTrack = canvasStream.getVideoTracks()[0];

    if (!outputVideoTrack) {
      throw new Error(
        'MindAR FaceMesh 출력 영상 트랙을 만들지 못했습니다.',
      );
    }

    outputVideoTrack.contentHint = 'motion';

    outputStream = new MediaStream([
      outputVideoTrack,
      ...source.getAudioTracks(),
    ]);

    let minCutoff = initialTuning.minCutoff;
    let beta = initialTuning.beta;

    let phase: AdaptiveFilterStatus['phase'] = 'warming';
    let adaptiveStartedAt = performance.now();
    let lastTuneAt = adaptiveStartedAt;
    let lastEstimateAt = 0;
    let lastEstimate: MindAREstimate | null = null;

    let previousRaw: Float32Array | null = null;
    let previousFiltered: Float32Array | null = null;

    const warmupMotion: number[] = [];

    let frameIntervalMs = 33.3;
    let fps = 30;
    let noiseFloor = 0;
    let stationaryJitter = 0;
    let trackingError = 0;
    let responseRatio = 1;
    let stationaryRatio = 0.5;

    let stationaryFrames = 0;
    let movingFrames = 0;
    let stationaryJitterSum = 0;
    let movingTrackingSum = 0;
    let movingResponseSum = 0;

    let lastSeenAt = 0;
    let everSeenFace = false;

    const updateAdaptiveParameters = (now: number) => {
      if (phase !== 'adaptive') return;
      if (now - lastTuneAt < ADAPTIVE_TUNE_INTERVAL_MS) return;

      lastTuneAt = now;

      const total = stationaryFrames + movingFrames;
      const localStationaryRatio =
        total > 0 ? stationaryFrames / total : stationaryRatio;

      stationaryRatio = ewma(
        stationaryRatio,
        localStationaryRatio,
        0.25,
      );

      const localJitter =
        stationaryFrames > 0
          ? stationaryJitterSum / stationaryFrames
          : stationaryJitter;

      const localMovingTracking =
        movingFrames > 0
          ? movingTrackingSum / movingFrames
          : trackingError;

      const localResponse =
        movingFrames > 0
          ? movingResponseSum / movingFrames
          : responseRatio;

      stationaryJitter = ewma(
        stationaryJitter,
        localJitter,
        0.3,
      );

      trackingError = ewma(
        trackingError,
        localMovingTracking,
        0.25,
      );

      responseRatio = ewma(
        responseRatio,
        localResponse,
        0.25,
      );

      const stationaryWeight = clamp(stationaryRatio, 0, 1);
      const movingWeight = 1 - stationaryWeight;

      const safeNoise = Math.max(noiseFloor, 1e-6);
      const jitterTarget = Math.max(safeNoise * 0.45, 1e-6);

      const jitterExcess = clamp(
        stationaryJitter / jitterTarget - 1,
        0,
        3,
      );

      const responseDeficit = clamp(
        0.92 - responseRatio,
        0,
        0.7,
      );

      const trackingExcess = clamp(
        trackingError / Math.max(safeNoise * 3, 1e-5) - 1,
        0,
        3,
      );

      // Slow systems need a little more responsiveness because the visual
      // distance travelled between processed frames is larger.
      const performanceDeficit = clamp(
        (frameIntervalMs - 33.3) / 33.3,
        0,
        1.5,
      );

      const minCutoffDelta =
        -0.035 * stationaryWeight * jitterExcess +
        0.05 * movingWeight * responseDeficit +
        0.015 * movingWeight * trackingExcess +
        0.01 * performanceDeficit * movingWeight;

      const betaDelta =
        -0.02 * stationaryWeight * jitterExcess +
        0.12 * movingWeight * responseDeficit +
        0.035 * movingWeight * trackingExcess +
        0.025 * performanceDeficit * movingWeight;

      minCutoff = clamp(
        minCutoff * Math.exp(minCutoffDelta),
        MIN_CUTOFF_MIN,
        MIN_CUTOFF_MAX,
      );

      beta = clamp(
        beta * Math.exp(betaDelta),
        BETA_MIN,
        BETA_MAX,
      );

      setMindARFilterParameters(
        mindar.controller,
        minCutoff,
        beta,
      );

      stationaryFrames = 0;
      movingFrames = 0;
      stationaryJitterSum = 0;
      movingTrackingSum = 0;
      movingResponseSum = 0;
    };

    const processAdaptiveSample = (
      now: number,
      estimate: MindAREstimate,
    ) => {
      if (estimate === lastEstimate) return;

      const rawPositions =
        faceMesh.geometry.attributes.position.array;

      const raw = extractStableRaw(rawPositions);
      const filtered = extractStableFiltered(
        estimate.metricLandmarks,
      );

      const scale = faceScaleFromPositions(rawPositions);

      if (lastEstimateAt > 0) {
        const dt = Math.max(1, now - lastEstimateAt);

        frameIntervalMs = ewma(
          frameIntervalMs,
          dt,
          0.12,
        );

        fps = 1000 / Math.max(1, frameIntervalMs);
      }

      if (previousRaw && previousFiltered) {
        const rawMotion =
          rmsDelta(raw, previousRaw) / scale;

        const filteredMotion =
          rmsDelta(filtered, previousFiltered) / scale;

        const currentTrackingError =
          rmsDiff(filtered, raw) / scale;

        trackingError = ewma(
          trackingError,
          currentTrackingError,
          0.08,
        );

        if (phase === 'warming') {
          warmupMotion.push(rawMotion);

          if (warmupMotion.length > 180) {
            warmupMotion.shift();
          }

          const warmupElapsed = now - adaptiveStartedAt;

          if (
            warmupElapsed >= ADAPTIVE_WARMUP_MS &&
            warmupMotion.length >= ADAPTIVE_MIN_WARMUP_FRAMES
          ) {
            noiseFloor = Math.max(
              1e-6,
              percentile(warmupMotion, 0.35),
            );

            phase = 'adaptive';
            lastTuneAt = now;
          }
        } else {
          const stationaryThreshold = Math.max(
            1e-6,
            noiseFloor * 2.0,
          );

          const stationary =
            rawMotion <= stationaryThreshold;

          if (stationary) {
            stationaryFrames++;
            stationaryJitterSum += filteredMotion;

            // Slowly follow changes in the camera's own noise floor.
            noiseFloor = ewma(
              noiseFloor,
              rawMotion,
              0.025,
            );
          } else {
            movingFrames++;
            movingTrackingSum += currentTrackingError;
            movingResponseSum += clamp(
              filteredMotion / Math.max(rawMotion, 1e-6),
              0,
              2,
            );
          }

          updateAdaptiveParameters(now);
        }
      }

      previousRaw = raw;
      previousFiltered = filtered;
      lastEstimate = estimate;
      lastEstimateAt = now;
    };

    renderer.setAnimationLoop((now) => {
      if (stopped) return;

      const estimate = mindar.getLatestEstimate();

      if (estimate) {
        lastSeenAt = now;
        everSeenFace = true;
        faceMesh.visible = true;

        // Read the raw geometry first, then update the adaptive parameters.
        processAdaptiveSample(now, estimate);

        // MindAR's controller already produced the single filtered landmark
        // set. The upstream geometry update uses raw points, so copy the
        // filtered result back into the visible mesh before rendering.
        writeMindARFilteredGeometry(faceMesh, estimate);
      } else if (
        everSeenFace &&
        now - lastSeenAt <= FACE_LOSS_GRACE_MS
      ) {
        faceMesh.visible = true;
      } else if (everSeenFace) {
        faceMesh.visible = false;

        // A long tracking loss is a new calibration context.
        phase = 'warming';
        adaptiveStartedAt = now;
        warmupMotion.length = 0;
        previousRaw = null;
        previousFiltered = null;
        lastEstimate = null;
        lastEstimateAt = 0;
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

    const getAdaptiveStatus = (): AdaptiveFilterStatus => ({
      phase,
      minCutoff,
      beta,
      fps,
      frameIntervalMs,
      noiseFloor,
      stationaryJitter,
      trackingError,
      responseRatio,
      stationaryRatio,
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
        if (track.readyState !== 'ended') {
          track.stop();
        }
      });

      source.getAudioTracks().forEach((track) => {
        if (track.readyState !== 'ended') {
          track.stop();
        }
      });

      try {
        renderer.dispose?.();
      } catch {
        // no-op
      }

      container.remove();
    };

    outputVideoTrack.addEventListener(
      'ended',
      stop,
      { once: true },
    );

    return {
      stream: outputStream,
      stop,
      getAdaptiveStatus,
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
      if (track.readyState !== 'ended') {
        track.stop();
      }
    });

    container.remove();

    throw error;
  }
}
