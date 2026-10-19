export type CameraMode = 'mask' | 'original';

export interface MaskTuning {
  // Extra display-stage One Euro filter that we apply after MindAR.
  postMinCutoff: number;
  postBeta: number;

  // MindAR's own built-in One Euro filter.
  mindarMinCutoff: number;
  mindarBeta: number;
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

// Stable facial points used for calibration replay. We intentionally avoid most
// lip/eyelid points because expression motion should not be scored as jitter.
const CALIBRATION_LANDMARKS = [
  1, 4, 5, 10, 21, 33, 54, 67, 93, 127, 133, 152,
  162, 168, 197, 234, 263, 284, 297, 323, 356, 362, 389, 454,
];

const CALIBRATION_MIN_CANDIDATES = [
  0.00015,
  0.00025,
  0.0004,
  0.00055,
  0.0007,
  0.001,
  0.0015,
  0.0025,
  0.004,
];

const CALIBRATION_BETA_CANDIDATES = [
  0,
  0.5,
  1,
  1.5,
  2,
  3,
  4,
  6,
  8,
  12,
];

const MAX_CALIBRATION_SAMPLES = 900;

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

function rmsDiff(a: Float32Array, b: Float32Array) {
  let sum = 0;

  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }

  return Math.sqrt(sum / Math.max(1, a.length));
}

function rmsDeltaMismatch(
  currentA: Float32Array,
  previousA: Float32Array,
  currentB: Float32Array,
  previousB: Float32Array,
) {
  let sum = 0;

  for (let i = 0; i < currentA.length; i++) {
    const da = currentA[i] - previousA[i];
    const db = currentB[i] - previousB[i];
    const d = da - db;
    sum += d * d;
  }

  return Math.sqrt(sum / Math.max(1, currentA.length));
}

function rmsDelta(current: Float32Array, previous: Float32Array) {
  let sum = 0;

  for (let i = 0; i < current.length; i++) {
    const d = current[i] - previous[i];
    sum += d * d;
  }

  return Math.sqrt(sum / Math.max(1, current.length));
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
  const mindarFilter = new MindAROneEuroFilter(
    tuning.mindarMinCutoff,
    tuning.mindarBeta,
  );

  const postFilter = new MindAROneEuroFilter(
    tuning.postMinCutoff,
    tuning.postBeta,
  );

  const rawMotion: number[] = [];

  for (let i = 1; i < samples.length; i++) {
    rawMotion.push(
      rmsDelta(samples[i].values, samples[i - 1].values) /
        Math.max(1e-6, samples[i].scale),
    );
  }

  // The quietest portion of the recording becomes the user's own measured
  // stationary-noise baseline. This avoids hard-coding a camera-specific pixel
  // or landmark threshold.
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
  let previousOutput: Float32Array | undefined;

  for (const sample of samples) {
    const mindarFiltered = mindarFilter.filter(
      sample.t,
      sample.values,
    );

    const output = postFilter.filter(
      sample.t,
      mindarFiltered,
    );

    const scale = Math.max(1e-6, sample.scale);

    trackingSum += rmsDiff(output, sample.values) / scale;
    trackingCount++;

    if (previousRaw && previousOutput) {
      const rawStep = rmsDelta(sample.values, previousRaw) / scale;

      motionSum +=
        rmsDeltaMismatch(
          output,
          previousOutput,
          sample.values,
          previousRaw,
        ) / scale;
      motionCount++;

      if (rawStep <= stationaryThreshold) {
        jitterSum += rmsDelta(output, previousOutput) / scale;
        stationaryCount++;
      }
    }

    previousRaw = sample.values;
    previousOutput = output;
  }

  const trackingError = trackingSum / Math.max(1, trackingCount);
  const motionError = motionSum / Math.max(1, motionCount);
  const stationaryJitter =
    jitterSum / Math.max(1, stationaryCount);

  // Tracking error prevents "freeze the mask" from winning.
  // Motion error penalizes latency/oversmoothing during deliberate motion.
  // Stationary jitter gets the strongest weight because that is the visible
  // micro-shake we are trying to eliminate.
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

function uniqueCandidates(base: number, values: number[]) {
  return Array.from(new Set([base, ...values]))
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b);
}

function optimizeCalibration(
  samples: CalibrationSample[],
  initialTuning: MaskTuning,
): {
  tuning: MaskTuning;
  metrics: CalibrationMetrics;
} {
  let bestTuning = sanitizeTuning(initialTuning);
  let bestMetrics = evaluateCalibration(samples, bestTuning);

  const seedTunings: MaskTuning[] = [
    bestTuning,
    DEFAULT_MASK_TUNING,
    {
      mindarMinCutoff: 0.0004,
      mindarBeta: 2,
      postMinCutoff: 0.0004,
      postBeta: 2,
    },
    {
      mindarMinCutoff: 0.0007,
      mindarBeta: 4,
      postMinCutoff: 0.0007,
      postBeta: 4,
    },
    {
      mindarMinCutoff: 0.001,
      mindarBeta: 6,
      postMinCutoff: 0.001,
      postBeta: 6,
    },
  ];

  for (const seed of seedTunings) {
    const sanitized = sanitizeTuning(seed);
    const metrics = evaluateCalibration(samples, sanitized);

    if (metrics.score < bestMetrics.score) {
      bestTuning = sanitized;
      bestMetrics = metrics;
    }
  }

  const minCandidates = () =>
    uniqueCandidates(
      Math.min(bestTuning.mindarMinCutoff, bestTuning.postMinCutoff),
      CALIBRATION_MIN_CANDIDATES,
    );

  const betaCandidates = () =>
    uniqueCandidates(
      Math.max(bestTuning.mindarBeta, bestTuning.postBeta),
      CALIBRATION_BETA_CANDIDATES,
    );

  const tryParameter = (
    key: keyof MaskTuning,
    candidates: number[],
  ) => {
    for (const candidate of candidates) {
      if (
        (key === 'mindarMinCutoff' || key === 'postMinCutoff') &&
        candidate <= 0
      ) {
        continue;
      }

      const tuning = {
        ...bestTuning,
        [key]: candidate,
      };

      const metrics = evaluateCalibration(samples, tuning);

      if (metrics.score < bestMetrics.score) {
        bestTuning = tuning;
        bestMetrics = metrics;
      }
    }
  };

  // Coordinate descent over the four parameters. Repeating the pass lets the
  // second stage settle after the first stage has moved.
  for (let pass = 0; pass < 3; pass++) {
    tryParameter(
      'mindarMinCutoff',
      uniqueCandidates(
        bestTuning.mindarMinCutoff,
        minCandidates(),
      ),
    );
    tryParameter(
      'mindarBeta',
      uniqueCandidates(
        bestTuning.mindarBeta,
        betaCandidates(),
      ),
    );
    tryParameter(
      'postMinCutoff',
      uniqueCandidates(
        bestTuning.postMinCutoff,
        minCandidates(),
      ),
    );
    tryParameter(
      'postBeta',
      uniqueCandidates(
        bestTuning.postBeta,
        betaCandidates(),
      ),
    );
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
  const values = new Float32Array(CALIBRATION_LANDMARKS.length * 3);

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
      if (calibrationSamples.length >= MAX_CALIBRATION_SAMPLES) return;

      calibrationLastEstimate = estimate;

      // MindAR writes the unfiltered estimateResult.metricLandmarks to the
      // FaceGeometry after onUpdate. Read that geometry before our post filter
      // overwrites it. This gives calibration a replayable raw signal.
      const raw = faceMesh.geometry.attributes.position.array;

      calibrationSamples.push({
        t: now - calibrationStartedAt,
        values: extractCalibrationValues(raw),
        scale: faceScaleFromRawPositions(raw),
      });
    };

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

        captureCalibrationSample(now, estimate);

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
        samples[samples.length - 1].t - samples[0].t;

      const { tuning: bestTuning, metrics } = optimizeCalibration(
        samples,
        tuning,
      );

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
      if (track.readyState !== 'ended') track.stop();
    });

    container.remove();

    throw error;
  }
}
