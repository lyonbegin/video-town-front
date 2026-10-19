export type CameraMode = 'mask' | 'original';

export interface MaskTuning {
  minCutoff: number;
  beta: number;
}

export interface CalibrationResult {
  tuning: MaskTuning;
  score: number;
  trackingError: number;
  motionError: number;
  stationaryJitter: number;
  sampleCount: number;
  durationMs: number;
}

export interface MaskedCameraController {
  stream: MediaStream;
  stop: () => void;
  startCalibration: () => void;
  finishCalibration: () => CalibrationResult;
  getCalibrationSampleCount: () => number;
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

type CalibrationSample = {
  t: number;
  values: Float32Array;
  scale: number;
};

type CalibrationMetrics = {
  score: number;
  trackingError: number;
  motionError: number;
  stationaryJitter: number;
};

const MINDAR_SPECIFIER = 'mindar-face-three';
const THREE_SPECIFIER = 'three';

const FACE_TEXTURE_URL =
  'https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/face-tracking/assets/sparkar/face-mask.png';

const FACE_VERTEX_COUNT = 468;
const FACE_LOSS_GRACE_MS = 420;
const MAX_CALIBRATION_SAMPLES = 900;

const CALIBRATION_LANDMARKS = [
  1, 4, 5, 10, 21, 33, 54, 67, 93, 127, 133, 152,
  162, 168, 197, 234, 263, 284, 297, 323, 356, 362, 389, 454,
];

const CALIBRATION_MIN_CANDIDATES = [
  0.0001,
  0.00015,
  0.00025,
  0.0004,
  0.00055,
  0.0007,
  0.001,
  0.0015,
  0.0025,
  0.004,
  0.007,
  0.01,
];

const CALIBRATION_BETA_CANDIDATES = [
  0,
  0.25,
  0.5,
  0.75,
  1,
  1.5,
  2,
  3,
  4,
  6,
  8,
  12,
  16,
];

// Same equation/time unit as MindAR src/libs/one-euro-filter.js.
// This class is used only to replay the recorded raw landmarks during
// calibration. Live rendering has exactly one filter: MindAR's own filter.
class MindAROneEuroReplay {
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

  return {
    minCutoff:
      Number.isFinite(value.minCutoff) && value.minCutoff > 0
        ? value.minCutoff
        : DEFAULT_MASK_TUNING.minCutoff,
    beta:
      Number.isFinite(value.beta) && value.beta >= 0
        ? value.beta
        : DEFAULT_MASK_TUNING.beta,
  };
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

function rmsDeltaMismatch(
  currentFiltered: Float32Array,
  previousFiltered: Float32Array,
  currentRaw: Float32Array,
  previousRaw: Float32Array,
) {
  let sum = 0;

  for (let i = 0; i < currentFiltered.length; i++) {
    const filteredDelta =
      currentFiltered[i] - previousFiltered[i];
    const rawDelta = currentRaw[i] - previousRaw[i];
    const d = filteredDelta - rawDelta;
    sum += d * d;
  }

  return Math.sqrt(sum / Math.max(1, currentFiltered.length));
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

function evaluateCalibration(
  samples: CalibrationSample[],
  tuning: MaskTuning,
): CalibrationMetrics {
  const filter = new MindAROneEuroReplay(
    tuning.minCutoff,
    tuning.beta,
  );

  const rawMotion: number[] = [];

  for (let i = 1; i < samples.length; i++) {
    rawMotion.push(
      rmsDelta(samples[i].values, samples[i - 1].values) /
        Math.max(1e-6, samples[i].scale),
    );
  }

  const stationaryThreshold = Math.max(
    1e-6,
    percentile(rawMotion, 0.35) * 1.6,
  );

  let trackingSum = 0;
  let motionSum = 0;
  let jitterSum = 0;
  let trackingCount = 0;
  let motionCount = 0;
  let stationaryCount = 0;

  let previousRaw: Float32Array | undefined;
  let previousFiltered: Float32Array | undefined;

  for (const sample of samples) {
    const filtered = filter.filter(sample.t, sample.values);
    const scale = Math.max(1e-6, sample.scale);

    trackingSum += rmsDiff(filtered, sample.values) / scale;
    trackingCount++;

    if (previousRaw && previousFiltered) {
      const rawStep = rmsDelta(
        sample.values,
        previousRaw,
      ) / scale;

      motionSum +=
        rmsDeltaMismatch(
          filtered,
          previousFiltered,
          sample.values,
          previousRaw,
        ) / scale;
      motionCount++;

      if (rawStep <= stationaryThreshold) {
        jitterSum +=
          rmsDelta(filtered, previousFiltered) / scale;
        stationaryCount++;
      }
    }

    previousRaw = sample.values;
    previousFiltered = filtered;
  }

  const trackingError =
    trackingSum / Math.max(1, trackingCount);
  const motionError =
    motionSum / Math.max(1, motionCount);
  const stationaryJitter =
    jitterSum / Math.max(1, stationaryCount);

  // Do not allow the optimizer to "win" by freezing the mask.
  // Tracking and motion error penalize lag; stationary jitter rewards stability.
  const score =
    trackingError * 0.55 +
    motionError * 0.35 +
    stationaryJitter * 0.85;

  return {
    score,
    trackingError,
    motionError,
    stationaryJitter,
  };
}

function optimizeCalibration(
  samples: CalibrationSample[],
  initialTuning: MaskTuning,
) {
  const minCandidates = Array.from(
    new Set([
      initialTuning.minCutoff,
      DEFAULT_MASK_TUNING.minCutoff,
      ...CALIBRATION_MIN_CANDIDATES,
    ]),
  ).sort((a, b) => a - b);

  const betaCandidates = Array.from(
    new Set([
      initialTuning.beta,
      DEFAULT_MASK_TUNING.beta,
      ...CALIBRATION_BETA_CANDIDATES,
    ]),
  ).sort((a, b) => a - b);

  let bestTuning = sanitizeTuning(initialTuning);
  let bestMetrics = evaluateCalibration(samples, bestTuning);

  // One live filter means only two parameters. Exhaustively evaluate the grid
  // so there is no coordinate-descent interaction between two stacked filters.
  for (const minCutoff of minCandidates) {
    if (minCutoff <= 0) continue;

    for (const beta of betaCandidates) {
      if (beta < 0) continue;

      const tuning = {
        minCutoff,
        beta,
      };

      const metrics = evaluateCalibration(samples, tuning);

      if (metrics.score < bestMetrics.score) {
        bestTuning = tuning;
        bestMetrics = metrics;
      }
    }
  }

  return {
    tuning: bestTuning,
    metrics: bestMetrics,
  };
}

function faceScaleFromRawPositions(raw: Float32Array) {
  const distance = (a: number, b: number) => {
    const ax = raw[a * 3];
    const ay = raw[a * 3 + 1];
    const az = raw[a * 3 + 2];

    const bx = raw[b * 3];
    const by = raw[b * 3 + 1];
    const bz = raw[b * 3 + 2];

    return Math.hypot(
      bx - ax,
      by - ay,
      bz - az,
    );
  };

  const width = distance(234, 454);
  const height = distance(10, 152);

  return Math.max(1e-6, (width + height) * 0.5);
}

function extractCalibrationValues(raw: Float32Array) {
  const values = new Float32Array(
    CALIBRATION_LANDMARKS.length * 3,
  );

  for (let i = 0; i < CALIBRATION_LANDMARKS.length; i++) {
    const landmarkIndex = CALIBRATION_LANDMARKS[i];
    const src = landmarkIndex * 3;
    const dst = i * 3;

    values[dst] = raw[src];
    values[dst + 1] = raw[src + 1];
    values[dst + 2] = raw[src + 2];
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
  const tuning = sanitizeTuning(tuningInput);
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

    // This is the only live One Euro filter.
    const mindar = new MindARThree({
      container,
      userDeviceId: deviceId,
      filterMinCF: tuning.minCutoff,
      filterBeta: tuning.beta,
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

    let lastSeenAt = 0;
    let everSeenFace = false;

    let calibrationRecording = false;
    let calibrationStartedAt = 0;
    let calibrationLastEstimate: MindAREstimate | null = null;
    let calibrationSamples: CalibrationSample[] = [];

    const captureCalibrationSample = (
      now: number,
      estimate: MindAREstimate,
    ) => {
      if (!calibrationRecording) return;
      if (estimate === calibrationLastEstimate) return;
      if (
        calibrationSamples.length >=
        MAX_CALIBRATION_SAMPLES
      ) {
        return;
      }

      calibrationLastEstimate = estimate;

      // At this point MindAR has just written the current raw face geometry.
      // Record it before replacing the visible positions with MindAR's own
      // filtered metricLandmarks.
      const raw =
        faceMesh.geometry.attributes.position.array;

      calibrationSamples.push({
        t: now - calibrationStartedAt,
        values: extractCalibrationValues(raw),
        scale: faceScaleFromRawPositions(raw),
      });
    };

    renderer.setAnimationLoop((now) => {
      if (stopped) return;

      const estimate = mindar.getLatestEstimate();

      if (estimate) {
        lastSeenAt = now;
        everSeenFace = true;
        faceMesh.visible = true;

        captureCalibrationSample(now, estimate);

        // MindAR already filtered metricLandmarks once. The upstream mesh path
        // can contain the raw positions, so copy that single filtered result
        // directly into the visible mesh. No second/post filter exists.
        writeMindARFilteredGeometry(faceMesh, estimate);
      } else if (
        everSeenFace &&
        now - lastSeenAt <= FACE_LOSS_GRACE_MS
      ) {
        faceMesh.visible = true;
      } else if (everSeenFace) {
        faceMesh.visible = false;
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

    const startCalibration = () => {
      calibrationSamples = [];
      calibrationStartedAt = performance.now();
      calibrationLastEstimate = mindar.getLatestEstimate();
      calibrationRecording = true;
    };

    const finishCalibration = (): CalibrationResult => {
      calibrationRecording = false;

      if (calibrationSamples.length < 30) {
        throw new Error(
          '자동 캘리브레이션 데이터가 부족합니다. 최소 30프레임 이상 녹화해주세요.',
        );
      }

      const samples = calibrationSamples;
      const durationMs =
        samples[samples.length - 1].t -
        samples[0].t;

      const {
        tuning: bestTuning,
        metrics,
      } = optimizeCalibration(samples, tuning);

      return {
        tuning: bestTuning,
        score: metrics.score,
        trackingError: metrics.trackingError,
        motionError: metrics.motionError,
        stationaryJitter: metrics.stationaryJitter,
        sampleCount: samples.length,
        durationMs,
      };
    };

    const getCalibrationSampleCount = () =>
      calibrationSamples.length;

    const stop = () => {
      if (stopped) return;
      stopped = true;
      calibrationRecording = false;

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
      startCalibration,
      finishCalibration,
      getCalibrationSampleCount,
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
