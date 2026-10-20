import {
  CORE_LANDMARK_INDICES,
  EXPRESSION_LANDMARK_INDICES,
  GlobalLandmarkGate,
  RIGID_LANDMARK_INDICES,
} from './GlobalLandmarkGate';
import {
  MaskDebugLogger,
  type MaskDebugSessionInfo,
} from './MaskDebugLogger';

export type CameraMode = 'mask' | 'original';

export interface TrackingStatus {
  fps: number;
  frameIntervalMs: number;
  smoothing: 'mediapipe-relative-velocity';
  windowSize: number;
  velocityScale: number;
  globalThresholdPx: number;
  expressionThresholdPx: number;
  targetThresholdPx: number;
  targetExpressionThresholdPx: number;
  verificationHz: number;
  gateAccepted: boolean;
  gateReason: string;
  rigidSignalPx: number;
  expressionSignalPx: number;
  frameRigidMotionPx: number;
  frameExpressionMotionPx: number;
  noiseFloorPx: number;
  expressionNoiseFloorPx: number;
  autoTuningEnabled: boolean;
  autoTuneConfidence: number;
  calibrationConverged: boolean;
  convergenceProgress: number;
  oneEuroMinCutOff: number;
  oneEuroBeta: number;
  oneEuroConverged: boolean;
  oneEuroConvergenceProgress: number;
  oneEuroScore: number;
  pointDeadbandPx: number;
  pointDeadbandHeldCount: number;
  calibrationSeedSource: 'saved' | 'default';
  staticAcceptRate: number;
  outputUpdateRate: number;
  timeSinceLastAcceptMs: number;
}

export const DEFAULT_GLOBAL_THRESHOLD_PX = 3.0;
export const DEFAULT_EXPRESSION_THRESHOLD_PX = 1.5;
export const DEFAULT_GATE_VERIFICATION_HZ = 15;
export const MASK_RUNTIME_VERSION =
  'mask-runtime-20261020-v7';

// Seed selected by replaying the uploaded real session through MindAR 1.2.5's
// exact OneEuro equation. Runtime tuning below keeps using MindAR's filter;
// it only searches minCutOff/beta.
export const DEFAULT_ONE_EURO_MIN_CUTOFF = 0.0004;
export const DEFAULT_ONE_EURO_BETA = 4.0;
const MIN_ONE_EURO_MIN_CUTOFF = 0.00005;
const MAX_ONE_EURO_MIN_CUTOFF = 0.02;
const MIN_ONE_EURO_BETA = 0;
const MAX_ONE_EURO_BETA = 30;

// Fixed per-landmark 3D deadband for mesh deformation.
// Pixel-equivalent distance:
// sqrt((dx*width)^2 + (dy*height)^2 + (dz*width)^2)
export const DEFAULT_POINT_DEADBAND_3D_PX = 2.0;
const MAX_POINT_DEADBAND_3D_PX = 10.0;

export interface MaskedCameraController {
  stream: MediaStream;
  stop: () => void;
  setGlobalThresholdPx: (threshold: number) => void;
  setPointDeadbandPx: (threshold: number) => void;
  setOneEuroMinCutOff: (minCutOff: number) => void;
  setOneEuroBeta: (beta: number) => void;
  setVerificationHz: (hz: number) => void;
  setAutoTuningEnabled: (enabled: boolean) => void;
  getTrackingStatus: () => TrackingStatus;
  getDebugSession: () => MaskDebugSessionInfo;
}

type NormalizedLandmark = {
  x: number;
  y: number;
  z: number;
};

type FaceMeshDetectionResult = {
  faceLandmarks: NormalizedLandmark[][];
  faceBlendshapes: unknown[];
};

type MindAREstimate = {
  metricLandmarks: number[][];
  faceMatrix: number[];
  faceScale: number;
  blendshapes?: unknown;
};

type FaceGeometryLike = {
  updatePositions: (metricLandmarks: number[][]) => void;
};

type FaceMeshHelperLike = {
  detect: (
    input: HTMLVideoElement | HTMLCanvasElement,
  ) => Promise<FaceMeshDetectionResult>;
};

type EstimatorLike = {
  estimate: (landmarks: number[][]) => MindAREstimate;
};

type OneEuroVectorFilterLike = {
  minCutOff: number;
  beta: number;
  filter: (
    timestampMs: number,
    values: number[],
  ) => number[];
  reset: () => void;
};

type MindARController = {
  processingVideo?: boolean;
  flipFace: boolean;
  faceMeshHelper: FaceMeshHelperLike;
  estimator: EstimatorLike;
  faceMatrixFilter: OneEuroVectorFilterLike;
  faceScaleFilter: OneEuroVectorFilterLike;
  customFaceGeometries: FaceGeometryLike[];
  lastEstimateResult: MindAREstimate | null;
  onUpdate: (payload: {
    hasFace: boolean;
    estimateResult?: MindAREstimate;
  }) => void;
  processVideo: (input: HTMLVideoElement) => void;
  stopProcessVideo: () => void;
};

type FaceMeshLike = {
  visible: boolean;
  matrix?: {
    elements?: ArrayLike<number>;
  };
  material: {
    map?: unknown;
    transparent?: boolean;
    needsUpdate?: boolean;
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

type WindowElement = {
  distance: number;
  durationMs: number;
};

const MINDAR_SPECIFIER = 'mindar-face-three';
const THREE_SPECIFIER = 'three';

const FACE_TEXTURE_URL =
  'https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/face-tracking/assets/sparkar/face-mask.png';

const FACE_LOSS_GRACE_MS = 120;
const CALIBRATION_STORAGE_KEY =
  'video-town-mask-calibration-v1';

type SavedMaskCalibration = {
  thresholdPx: number;
  expressionThresholdPx: number;
  verificationHz: number;
  oneEuroMinCutOff?: number;
  oneEuroBeta?: number;
  updatedAt: string;
};

function makeCalibrationDeviceKey(
  deviceId: string | null,
  width: number,
  height: number,
) {
  return [
    deviceId || 'default-camera',
    `${width}x${height}`,
  ].join(':');
}

function loadSavedCalibration(
  deviceKey: string,
): SavedMaskCalibration | null {
  try {
    const raw =
      localStorage.getItem(
        CALIBRATION_STORAGE_KEY,
      );

    if (!raw) return null;

    const parsed =
      JSON.parse(raw) as
        Record<
          string,
          SavedMaskCalibration
        >;

    const saved =
      parsed[deviceKey];

    if (
      !saved ||
      !Number.isFinite(
        saved.thresholdPx,
      ) ||
      !Number.isFinite(
        saved.expressionThresholdPx,
      )
    ) {
      return null;
    }

    return saved;
  } catch {
    return null;
  }
}

function saveCalibration(
  deviceKey: string,
  calibration: SavedMaskCalibration,
) {
  try {
    const raw =
      localStorage.getItem(
        CALIBRATION_STORAGE_KEY,
      );

    const parsed =
      raw
        ? JSON.parse(raw)
        : {};

    parsed[deviceKey] =
      calibration;

    localStorage.setItem(
      CALIBRATION_STORAGE_KEY,
      JSON.stringify(parsed),
    );
  } catch {
    // Calibration persistence must never interrupt video.
  }
}


type OneEuroPoseSample = {
  timestampMs: number;
  faceMatrix: number[];
};

type OneEuroTunerStatus = {
  minCutOff: number;
  beta: number;
  converged: boolean;
  progress: number;
  score: number;
  sampleCount: number;
};

type OneEuroTuneUpdate = {
  changed: boolean;
  minCutOff: number;
  beta: number;
  converged: boolean;
  progress: number;
  score: number;
  staticJitterRatio: number;
  motionErrorRatio: number;
};

const ONE_EURO_MIN_CUTOFF_CANDIDATES = [
  0.00015,
  0.0002,
  0.0003,
  0.0004,
  0.0005,
  0.0007,
  0.001,
] as const;

const ONE_EURO_BETA_CANDIDATES = [
  2,
  3,
  4,
  5,
  6,
  8,
] as const;

const ONE_EURO_TUNE_WINDOW = 36;
const ONE_EURO_TUNE_MIN_SAMPLES = 24;
const ONE_EURO_TUNE_EVERY = 8;
const ONE_EURO_STABLE_SEARCHES = 3;
const ONE_EURO_DERIVATIVE_CUTOFF = 0.001;

function quantileNumber(
  values: number[],
  q: number,
) {
  if (values.length === 0) return 0;

  const sorted = [...values].sort(
    (a, b) => a - b,
  );

  const position =
    Math.max(
      0,
      Math.min(1, q),
    ) *
    (sorted.length - 1);

  const lower =
    Math.floor(position);

  const upper =
    Math.ceil(position);

  if (lower === upper) {
    return sorted[lower];
  }

  const fraction =
    position - lower;

  return (
    sorted[lower] *
      (1 - fraction) +
    sorted[upper] *
      fraction
  );
}

function medianNumber(
  values: number[],
) {
  return quantileNumber(
    values,
    0.5,
  );
}

function vectorDistanceNormalized(
  a: number[],
  b: number[],
  scales: number[],
) {
  let sum = 0;
  let count = 0;

  for (
    let i = 0;
    i < a.length;
    i++
  ) {
    const scale =
      Math.max(
        0.0001,
        scales[i] ?? 0.0001,
      );

    const delta =
      ((a[i] ?? 0) -
        (b[i] ?? 0)) /
      scale;

    sum += delta * delta;
    count++;
  }

  return Math.sqrt(
    sum / Math.max(1, count),
  );
}

// Exact MindAR 1.2.5 OneEuro math, used only as a shadow evaluator for
// parameter selection. The live output itself always uses controller's
// official faceMatrixFilter/faceScaleFilter.
function replayMindAROneEuro(
  samples: OneEuroPoseSample[],
  minCutOff: number,
  beta: number,
) {
  const output: number[][] = [];
  let xPrev: number[] | null = null;
  let dxPrev: number[] | null = null;
  let tPrev: number | null = null;

  for (const sample of samples) {
    const x =
      sample.faceMatrix;

    if (
      xPrev === null ||
      dxPrev === null ||
      tPrev === null
    ) {
      const first = [...x];
      output.push(first);
      xPrev = first;
      dxPrev =
        x.map(() => 0);
      tPrev =
        sample.timestampMs;
      continue;
    }

    const te =
      Math.max(
        0.001,
        sample.timestampMs -
          tPrev,
      );

    const derivativeR =
      2 *
      Math.PI *
      ONE_EURO_DERIVATIVE_CUTOFF *
      te;

    const derivativeAlpha =
      derivativeR /
      (derivativeR + 1);

    const xHat =
      new Array<number>(
        x.length,
      );

    const nextDx =
      new Array<number>(
        x.length,
      );

    for (
      let i = 0;
      i < x.length;
      i++
    ) {
      const dx =
        ((x[i] ?? 0) -
          (xPrev[i] ?? 0)) /
        te;

      const dxHat =
        derivativeAlpha * dx +
        (1 - derivativeAlpha) *
          (dxPrev[i] ?? 0);

      const cutoff =
        minCutOff +
        beta *
          Math.abs(dxHat);

      const r =
        2 *
        Math.PI *
        cutoff *
        te;

      const alpha =
        r / (r + 1);

      xHat[i] =
        alpha * (x[i] ?? 0) +
        (1 - alpha) *
          (xPrev[i] ?? 0);

      nextDx[i] = dxHat;
    }

    output.push(xHat);
    xPrev = xHat;
    dxPrev = nextDx;
    tPrev =
      sample.timestampMs;
  }

  return output;
}

class MindAROneEuroParameterTuner {
  private samples:
    OneEuroPoseSample[] = [];
  private sinceLastSearch = 0;
  private stableSearches = 0;
  private lastBestKey = '';
  private status:
    OneEuroTunerStatus;

  constructor(
    initialMinCutOff: number,
    initialBeta: number,
  ) {
    this.status = {
      minCutOff:
        initialMinCutOff,
      beta:
        initialBeta,
      converged: false,
      progress: 0,
      score:
        Number.POSITIVE_INFINITY,
      sampleCount: 0,
    };
  }

  resetWindow() {
    if (
      this.status.converged
    ) {
      return;
    }

    this.samples = [];
    this.sinceLastSearch = 0;
    this.stableSearches = 0;
    this.lastBestKey = '';
    this.status = {
      ...this.status,
      progress: 0,
      sampleCount: 0,
    };
  }

  getStatus():
    OneEuroTunerStatus {
    return {
      ...this.status,
    };
  }

  addSample(
    timestampMs: number,
    faceMatrix: number[],
  ): OneEuroTuneUpdate | null {
    if (
      this.status.converged
    ) {
      return null;
    }

    this.samples.push({
      timestampMs,
      faceMatrix:
        [...faceMatrix],
    });

    if (
      this.samples.length >
      ONE_EURO_TUNE_WINDOW
    ) {
      this.samples.shift();
    }

    this.sinceLastSearch++;

    this.status.sampleCount =
      this.samples.length;

    const sampleProgress =
      Math.min(
        1,
        this.samples.length /
          ONE_EURO_TUNE_MIN_SAMPLES,
      );

    this.status.progress =
      Math.max(
        this.status.progress,
        sampleProgress * 0.7,
      );

    if (
      this.samples.length <
        ONE_EURO_TUNE_MIN_SAMPLES ||
      this.sinceLastSearch <
        ONE_EURO_TUNE_EVERY
    ) {
      return null;
    }

    this.sinceLastSearch = 0;

    const rawDiffs: number[][] =
      [];

    for (
      let i = 1;
      i < this.samples.length;
      i++
    ) {
      const current =
        this.samples[i]
          .faceMatrix;

      const previous =
        this.samples[i - 1]
          .faceMatrix;

      rawDiffs.push(
        current.map(
          (value, index) =>
            value -
            (previous[index] ?? 0),
        ),
      );
    }

    const componentScales =
      this.samples[0]
        .faceMatrix
        .map((_, component) =>
          Math.max(
            0.0001,
            quantileNumber(
              rawDiffs.map(
                (diff) =>
                  Math.abs(
                    diff[component] ??
                      0,
                  ),
              ),
              0.75,
            ),
          ),
        );

    const rawDeltaNorms =
      rawDiffs.map(
        (diff) =>
          vectorDistanceNormalized(
            diff,
            diff.map(() => 0),
            componentScales,
          ),
      );

    const staticBoundary =
      quantileNumber(
        rawDeltaNorms,
        0.35,
      );

    const motionBoundary =
      quantileNumber(
        rawDeltaNorms,
        0.65,
      );

    const rawStaticMedian =
      Math.max(
        0.0001,
        medianNumber(
          rawDeltaNorms.filter(
            (value) =>
              value <=
              staticBoundary,
          ),
        ),
      );

    const rawMotionMedian =
      Math.max(
        0.0001,
        medianNumber(
          rawDeltaNorms.filter(
            (value) =>
              value >=
              motionBoundary,
          ),
        ),
      );

    let best:
      OneEuroTuneUpdate | null =
        null;

    for (
      const minCutOff of
      ONE_EURO_MIN_CUTOFF_CANDIDATES
    ) {
      for (
        const beta of
        ONE_EURO_BETA_CANDIDATES
      ) {
        const filtered =
          replayMindAROneEuro(
            this.samples,
            minCutOff,
            beta,
          );

        const filteredDeltaNorms:
          number[] = [];

        const motionErrors:
          number[] = [];

        for (
          let i = 1;
          i < filtered.length;
          i++
        ) {
          filteredDeltaNorms.push(
            vectorDistanceNormalized(
              filtered[i],
              filtered[i - 1],
              componentScales,
            ),
          );

          if (
            rawDeltaNorms[i - 1] >=
            motionBoundary
          ) {
            motionErrors.push(
              vectorDistanceNormalized(
                filtered[i],
                this.samples[i]
                  .faceMatrix,
                componentScales,
              ),
            );
          }
        }

        const staticJitter =
          medianNumber(
            filteredDeltaNorms.filter(
              (_, index) =>
                rawDeltaNorms[index] <=
                staticBoundary,
            ),
          );

        const motionError =
          medianNumber(
            motionErrors,
          );

        const staticJitterRatio =
          staticJitter /
          rawStaticMedian;

        const motionErrorRatio =
          motionError /
          rawMotionMedian;

        // Jitter is weighted slightly higher because the current failure mode
        // is visible eye-straining shake; responsiveness remains a hard part
        // of the score so an over-smoothed candidate cannot win.
        const score =
          0.55 *
            staticJitterRatio +
          0.45 *
            motionErrorRatio;

        if (
          best === null ||
          score < best.score
        ) {
          best = {
            changed: false,
            minCutOff,
            beta,
            converged: false,
            progress:
              this.status.progress,
            score,
            staticJitterRatio,
            motionErrorRatio,
          };
        }
      }
    }

    if (!best) {
      return null;
    }

    const bestKey =
      `${best.minCutOff}:${best.beta}`;

    if (
      bestKey ===
      this.lastBestKey
    ) {
      this.stableSearches++;
    } else {
      this.lastBestKey =
        bestKey;
      this.stableSearches = 1;
    }

    const changed =
      Math.abs(
        best.minCutOff -
          this.status.minCutOff,
      ) >
        1e-9 ||
      Math.abs(
        best.beta -
          this.status.beta,
      ) >
        1e-9;

    this.status.minCutOff =
      best.minCutOff;

    this.status.beta =
      best.beta;

    this.status.score =
      best.score;

    this.status.progress =
      Math.max(
        0.7,
        Math.min(
          1,
          0.7 +
            0.3 *
              (
                this.stableSearches /
                ONE_EURO_STABLE_SEARCHES
              ),
        ),
      );

    if (
      this.stableSearches >=
      ONE_EURO_STABLE_SEARCHES
    ) {
      this.status.converged = true;
      this.status.progress = 1;
    }

    return {
      ...best,
      changed,
      converged:
        this.status.converged,
      progress:
        this.status.progress,
    };
  }
}


// Exact Face Effect smoothing parameters used by MediaPipe's
// face_landmarks_smoothing.pbtxt.
const VELOCITY_FILTER_WINDOW_SIZE = 5;
const VELOCITY_FILTER_SCALE = 20.0;
const ASSUMED_FRAME_MS = 1000 / 30;

function numericDetectedLandmarks(
  landmarks: NormalizedLandmark[],
) {
  return landmarks.map((point) => [
    point.x,
    point.y,
    point.z,
  ]);
}

function flattenDetectedLandmarks(
  landmarks: NormalizedLandmark[],
) {
  const output =
    new Array<number>(
      landmarks.length * 3,
    );

  let offset = 0;

  for (
    let i = 0;
    i < landmarks.length;
    i++
  ) {
    const point = landmarks[i];

    output[offset++] = point.x;
    output[offset++] = point.y;
    output[offset++] = point.z;
  }

  return output;
}

function flattenNumericLandmarks(
  landmarks: number[][],
) {
  const output =
    new Array<number>(
      landmarks.length * 3,
    );

  let offset = 0;

  for (
    let i = 0;
    i < landmarks.length;
    i++
  ) {
    const point = landmarks[i];

    output[offset++] = point[0] ?? 0;
    output[offset++] = point[1] ?? 0;
    output[offset++] = point[2] ?? 0;
  }

  return output;
}

function copyFaceMatrix(
  faceMesh: FaceMeshLike,
) {
  const elements =
    faceMesh.matrix?.elements;

  return elements
    ? Array.from(elements)
    : null;
}

/**
 * TypeScript port of MediaPipe RelativeVelocityFilter.
 *
 * Source behavior:
 * - keep a short velocity window
 * - normalize movement by current object scale
 * - high velocity => high alpha => follow quickly
 * - low velocity => low alpha => stabilize
 *
 * This filter is used only for deformation stabilization and calibration.
 * Head pose uses RAW detected landmarks so translation/rotation can follow
 * every successful detector frame without smoothing lag.
 */
class RelativeVelocityFilter {
  private lastValue = 0;
  private lastValueScale = 1;
  private lastTimestampMs = -1;
  private readonly window: WindowElement[];
  private lowPassInitialized = false;
  private lowPassValue = 0;

  constructor(
    private readonly maxWindowSize: number,
    private readonly velocityScale: number,
  ) {
    // MediaPipe's C++ RelativeVelocityFilter initializes its deque with
    // window_size zero-valued elements. Preserve that startup behavior too.
    this.window = Array.from(
      { length: maxWindowSize },
      () => ({
        distance: 0,
        durationMs: 0,
      }),
    );
  }

  reset() {
    this.lastValue = 0;
    this.lastValueScale = 1;
    this.lastTimestampMs = -1;
    this.window.length = 0;

    for (let i = 0; i < this.maxWindowSize; i++) {
      this.window.push({
        distance: 0,
        durationMs: 0,
      });
    }
    this.lowPassInitialized = false;
    this.lowPassValue = 0;
  }

  apply(
    timestampMs: number,
    value: number,
    valueScale: number,
  ) {
    if (this.lastTimestampMs >= timestampMs) {
      return value;
    }

    let alpha = 1;

    if (this.lastTimestampMs !== -1) {
      // MediaPipe RelativeVelocityFilter's default distance mode is
      // kLegacyTransition.
      const distance =
        value * valueScale -
        this.lastValue * this.lastValueScale;

      const durationMs =
        timestampMs - this.lastTimestampMs;

      let cumulativeDistance = distance;
      let cumulativeDurationMs = durationMs;

      const maxCumulativeDurationMs =
        (1 + this.window.length) * ASSUMED_FRAME_MS;

      for (const element of this.window) {
        if (
          cumulativeDurationMs + element.durationMs >
          maxCumulativeDurationMs
        ) {
          break;
        }

        cumulativeDistance += element.distance;
        cumulativeDurationMs += element.durationMs;
      }

      const durationSeconds =
        Math.max(0.000001, cumulativeDurationMs / 1000);

      const velocity =
        cumulativeDistance / durationSeconds;

      alpha =
        1 -
        1 /
          (
            1 +
            this.velocityScale *
              Math.abs(velocity)
          );

      this.window.unshift({
        distance,
        durationMs,
      });

      if (this.window.length > this.maxWindowSize) {
        this.window.pop();
      }
    }

    this.lastValue = value;
    this.lastValueScale = valueScale;
    this.lastTimestampMs = timestampMs;

    if (!this.lowPassInitialized) {
      this.lowPassInitialized = true;
      this.lowPassValue = value;
      return value;
    }

    this.lowPassValue =
      alpha * value +
      (1 - alpha) * this.lowPassValue;

    return this.lowPassValue;
  }
}


type MotionStats = {
  mean: number;
  p50: number;
  p95: number;
  max: number;
};

function summarizeMotion(
  values: number[],
): MotionStats {
  if (values.length === 0) {
    return {
      mean: 0,
      p50: 0,
      p95: 0,
      max: 0,
    };
  }

  const sorted = [...values].sort(
    (a, b) => a - b,
  );

  const percentile = (
    q: number,
  ) => {
    const position =
      Math.max(
        0,
        Math.min(1, q),
      ) *
      (sorted.length - 1);

    const lower =
      Math.floor(position);

    const upper =
      Math.ceil(position);

    if (lower === upper) {
      return sorted[lower];
    }

    const fraction =
      position - lower;

    return (
      sorted[lower] *
        (1 - fraction) +
      sorted[upper] *
        fraction
    );
  };

  return {
    mean:
      values.reduce(
        (sum, value) =>
          sum + value,
        0,
      ) / values.length,
    p50:
      percentile(0.5),
    p95:
      percentile(0.95),
    max:
      sorted[
        sorted.length - 1
      ],
  };
}

function clonePoints(
  points: number[][],
) {
  return points.map(
    (point) => [
      point[0] ?? 0,
      point[1] ?? 0,
      point[2] ?? 0,
    ],
  );
}

function transformMetricPoint(
  faceMatrix: number[],
  point: number[],
) {
  const x = point[0] ?? 0;
  const y = point[1] ?? 0;
  const z = point[2] ?? 0;

  return [
    (faceMatrix[0] ?? 1) * x +
      (faceMatrix[1] ?? 0) * y +
      (faceMatrix[2] ?? 0) * z +
      (faceMatrix[3] ?? 0),
    (faceMatrix[4] ?? 0) * x +
      (faceMatrix[5] ?? 1) * y +
      (faceMatrix[6] ?? 0) * z +
      (faceMatrix[7] ?? 0),
    (faceMatrix[8] ?? 0) * x +
      (faceMatrix[9] ?? 0) * y +
      (faceMatrix[10] ?? 1) * z +
      (faceMatrix[11] ?? 0),
  ];
}

class DeadbandEffectMonitor {
  private previousInput:
    number[][] = [];
  private previousOutput:
    number[][] = [];
  private previousRendered:
    number[][] = [];

  reset() {
    this.previousInput = [];
    this.previousOutput = [];
    this.previousRendered = [];
  }

  measure(
    inputMetric: number[][],
    outputMetric: number[][],
    faceMatrix: number[],
    pixelsPerMetricUnit: number,
  ) {
    const scale =
      Math.max(
        0.000001,
        pixelsPerMetricUnit,
      );

    const rendered =
      outputMetric.map(
        (point) =>
          transformMetricPoint(
            faceMatrix,
            point,
          ),
      );

    const inputDistances:
      number[] = [];

    const outputDistances:
      number[] = [];

    const renderedDistances:
      number[] = [];

    if (
      this.previousInput.length ===
      inputMetric.length
    ) {
      for (
        let i = 0;
        i < inputMetric.length;
        i++
      ) {
        const current =
          inputMetric[i];

        const previous =
          this.previousInput[i];

        inputDistances.push(
          Math.hypot(
            (current[0] ?? 0) -
              (previous[0] ?? 0),
            (current[1] ?? 0) -
              (previous[1] ?? 0),
            (current[2] ?? 0) -
              (previous[2] ?? 0),
          ) * scale,
        );
      }
    }

    if (
      this.previousOutput.length ===
      outputMetric.length
    ) {
      for (
        let i = 0;
        i < outputMetric.length;
        i++
      ) {
        const current =
          outputMetric[i];

        const previous =
          this.previousOutput[i];

        outputDistances.push(
          Math.hypot(
            (current[0] ?? 0) -
              (previous[0] ?? 0),
            (current[1] ?? 0) -
              (previous[1] ?? 0),
            (current[2] ?? 0) -
              (previous[2] ?? 0),
          ) * scale,
        );
      }
    }

    if (
      this.previousRendered.length ===
      rendered.length
    ) {
      for (
        let i = 0;
        i < rendered.length;
        i++
      ) {
        const current =
          rendered[i];

        const previous =
          this.previousRendered[i];

        renderedDistances.push(
          Math.hypot(
            (current[0] ?? 0) -
              (previous[0] ?? 0),
            (current[1] ?? 0) -
              (previous[1] ?? 0),
            (current[2] ?? 0) -
              (previous[2] ?? 0),
          ) * scale,
        );
      }
    }

    const inputMotionPx =
      summarizeMotion(
        inputDistances,
      );

    const geometryOutputMotionPx =
      summarizeMotion(
        outputDistances,
      );

    const renderedMotionProxyPx =
      summarizeMotion(
        renderedDistances,
      );

    const geometrySuppressionRatio =
      inputMotionPx.mean > 1e-9
        ? Math.max(
            0,
            Math.min(
              1,
              1 -
                geometryOutputMotionPx.mean /
                  inputMotionPx.mean,
            ),
          )
        : 0;

    const renderedVsGeometryRatio =
      geometryOutputMotionPx.mean >
      1e-9
        ? renderedMotionProxyPx.mean /
          geometryOutputMotionPx.mean
        : renderedMotionProxyPx.mean >
            1e-9
          ? Number.POSITIVE_INFINITY
          : 1;

    this.previousInput =
      clonePoints(
        inputMetric,
      );

    this.previousOutput =
      clonePoints(
        outputMetric,
      );

    this.previousRendered =
      clonePoints(
        rendered,
      );

    return {
      inputMotionPx,
      geometryOutputMotionPx,
      renderedMotionProxyPx,
      geometrySuppressionRatio,
      renderedVsGeometryRatio:
        Number.isFinite(
          renderedVsGeometryRatio,
        )
          ? renderedVsGeometryRatio
          : 999,
    };
  }
}

class Absolute3DPointDeadband {
  private heldPoints: number[][] = [];
  private heldCount = 0;
  private changedCount = 0;
  private decisionDistancePx:
    MotionStats = {
      mean: 0,
      p50: 0,
      p95: 0,
      max: 0,
    };

  constructor(
    private thresholdPx: number,
  ) {
    this.setThresholdPx(
      thresholdPx,
    );
  }

  setThresholdPx(
    thresholdPx: number,
  ) {
    this.thresholdPx =
      Math.min(
        MAX_POINT_DEADBAND_3D_PX,
        Math.max(
          0,
          Number.isFinite(
            thresholdPx,
          )
            ? thresholdPx
            : DEFAULT_POINT_DEADBAND_3D_PX,
        ),
      );
  }

  reset() {
    this.heldPoints = [];
    this.heldCount = 0;
    this.changedCount = 0;
    this.decisionDistancePx = {
      mean: 0,
      p50: 0,
      p95: 0,
      max: 0,
    };
  }

  applyMetric(
    metricLandmarks: number[][],
    pixelsPerMetricUnit: number,
  ) {
    if (
      this.heldPoints.length !==
      metricLandmarks.length
    ) {
      this.heldPoints =
        metricLandmarks.map(
          (point) => [
            point[0] ?? 0,
            point[1] ?? 0,
            point[2] ?? 0,
          ],
        );

      this.heldCount = 0;
      this.changedCount =
        metricLandmarks.length;
      this.decisionDistancePx = {
        mean: 0,
        p50: 0,
        p95: 0,
        max: 0,
      };

      return this.heldPoints.map(
        (point) => [...point],
      );
    }

    const pxScale =
      Math.max(
        0.000001,
        pixelsPerMetricUnit,
      );

    let heldCount = 0;
    let changedCount = 0;
    const decisionDistances:
      number[] = [];

    for (
      let i = 0;
      i < metricLandmarks.length;
      i++
    ) {
      const current =
        metricLandmarks[i];

      const previous =
        this.heldPoints[i];

      const dx =
        (current[0] ?? 0) -
        (previous[0] ?? 0);

      const dy =
        (current[1] ?? 0) -
        (previous[1] ?? 0);

      const dz =
        (current[2] ?? 0) -
        (previous[2] ?? 0);

      const distancePx =
        Math.hypot(
          dx,
          dy,
          dz,
        ) *
        pxScale;

      decisionDistances.push(
        distancePx,
      );

      if (
        distancePx <
        this.thresholdPx
      ) {
        heldCount++;
        continue;
      }

      changedCount++;

      previous[0] =
        current[0] ?? 0;

      previous[1] =
        current[1] ?? 0;

      previous[2] =
        current[2] ?? 0;
    }

    this.heldCount =
      heldCount;
    this.changedCount =
      changedCount;
    this.decisionDistancePx =
      summarizeMotion(
        decisionDistances,
      );

    return this.heldPoints.map(
      (point) => [...point],
    );
  }

  getHeldCount() {
    return this.heldCount;
  }

  getChangedCount() {
    return this.changedCount;
  }

  getDecisionDistancePx() {
    return {
      ...this.decisionDistancePx,
    };
  }

  getThresholdPx() {
    return this.thresholdPx;
  }
}


const METRIC_SCALE_PAIRS = [
  [234, 454],
  [33, 263],
  [127, 356],
  [10, 152],
  [61, 291],
] as const;

function estimatePixelsPerMetricUnit(
  normalizedLandmarks: number[][],
  metricLandmarks: number[][],
  imageWidth: number,
  imageHeight: number,
) {
  const ratios: number[] = [];

  for (
    const [a, b] of
    METRIC_SCALE_PAIRS
  ) {
    const na =
      normalizedLandmarks[a];

    const nb =
      normalizedLandmarks[b];

    const ma =
      metricLandmarks[a];

    const mb =
      metricLandmarks[b];

    if (
      !na ||
      !nb ||
      !ma ||
      !mb
    ) {
      continue;
    }

    const normalizedDistancePx =
      Math.hypot(
        ((na[0] ?? 0) -
          (nb[0] ?? 0)) *
          imageWidth,
        ((na[1] ?? 0) -
          (nb[1] ?? 0)) *
          imageHeight,
        ((na[2] ?? 0) -
          (nb[2] ?? 0)) *
          imageWidth,
      );

    const metricDistance =
      Math.hypot(
        (ma[0] ?? 0) -
          (mb[0] ?? 0),
        (ma[1] ?? 0) -
          (mb[1] ?? 0),
        (ma[2] ?? 0) -
          (mb[2] ?? 0),
      );

    if (
      metricDistance > 1e-6 &&
      normalizedDistancePx > 0
    ) {
      ratios.push(
        normalizedDistancePx /
          metricDistance,
      );
    }
  }

  if (ratios.length === 0) {
    return 1;
  }

  ratios.sort(
    (a, b) => a - b,
  );

  const middle =
    Math.floor(
      ratios.length / 2,
    );

  return ratios.length % 2 === 1
    ? ratios[middle]
    : (
        ratios[middle - 1] +
        ratios[middle]
      ) / 2;
}

class FaceLandmarksSmoother {
  private xFilters: RelativeVelocityFilter[] = [];
  private yFilters: RelativeVelocityFilter[] = [];
  private zFilters: RelativeVelocityFilter[] = [];

  reset() {
    for (const filter of this.xFilters) filter.reset();
    for (const filter of this.yFilters) filter.reset();
    for (const filter of this.zFilters) filter.reset();

    this.xFilters = [];
    this.yFilters = [];
    this.zFilters = [];
  }

  smooth(
    landmarks: NormalizedLandmark[],
    timestampMs: number,
    imageWidth: number,
    imageHeight: number,
  ): number[][] {
    this.ensureFilters(landmarks.length);

    const pixelLandmarks = landmarks.map((landmark) => [
      landmark.x * imageWidth,
      landmark.y * imageHeight,
      landmark.z * imageWidth,
    ]);

    const objectScale =
      this.getObjectScale(pixelLandmarks);

    // This matches MediaPipe LandmarksSmoothingCalculator:
    // value_scale = 1 / object_scale.
    const valueScale =
      1 / Math.max(1e-6, objectScale);

    const output: number[][] =
      new Array(landmarks.length);

    for (let i = 0; i < landmarks.length; i++) {
      const point = pixelLandmarks[i];

      const x = this.xFilters[i].apply(
        timestampMs,
        point[0],
        valueScale,
      );

      const y = this.yFilters[i].apply(
        timestampMs,
        point[1],
        valueScale,
      );

      const z = this.zFilters[i].apply(
        timestampMs,
        point[2],
        valueScale,
      );

      output[i] = [
        x / imageWidth,
        y / imageHeight,
        z / imageWidth,
      ];
    }

    return output;
  }

  private ensureFilters(count: number) {
    if (this.xFilters.length === count) return;

    this.xFilters = [];
    this.yFilters = [];
    this.zFilters = [];

    for (let i = 0; i < count; i++) {
      this.xFilters.push(
        new RelativeVelocityFilter(
          VELOCITY_FILTER_WINDOW_SIZE,
          VELOCITY_FILTER_SCALE,
        ),
      );

      this.yFilters.push(
        new RelativeVelocityFilter(
          VELOCITY_FILTER_WINDOW_SIZE,
          VELOCITY_FILTER_SCALE,
        ),
      );

      this.zFilters.push(
        new RelativeVelocityFilter(
          VELOCITY_FILTER_WINDOW_SIZE,
          VELOCITY_FILTER_SCALE,
        ),
      );
    }
  }

  private getObjectScale(
    landmarks: number[][],
  ) {
    let xMin = Number.POSITIVE_INFINITY;
    let xMax = Number.NEGATIVE_INFINITY;
    let yMin = Number.POSITIVE_INFINITY;
    let yMax = Number.NEGATIVE_INFINITY;

    for (const landmark of landmarks) {
      xMin = Math.min(xMin, landmark[0]);
      xMax = Math.max(xMax, landmark[0]);
      yMin = Math.min(yMin, landmark[1]);
      yMax = Math.max(yMax, landmark[1]);
    }

    const objectWidth = xMax - xMin;
    const objectHeight = yMax - yMin;

    return (objectWidth + objectHeight) / 2;
  }
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

function createFlippedInput(
  width: number,
  height: number,
) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error(
      'MindAR 얼굴 추적 입력 Canvas를 만들지 못했습니다.',
    );
  }

  return {
    canvas,
    context,
  };
}

export async function createMaskedCameraStream(
  source: MediaStream,
): Promise<MaskedCameraController> {
  const sourceVideoTrack = source.getVideoTracks()[0];

  if (!sourceVideoTrack) {
    throw new Error(
      '복면 모드에 사용할 카메라 트랙이 없습니다.',
    );
  }

  if (!HTMLCanvasElement.prototype.captureStream) {
    throw new Error(
      '현재 브라우저는 Canvas 영상 출력을 지원하지 않습니다.',
    );
  }

  const deviceId =
    sourceVideoTrack.getSettings().deviceId ?? null;

  // MindAR owns the physical camera while mask mode is active.
  sourceVideoTrack.stop();

  const container = createOffscreenContainer();

  let mindarThree: MindARThreeInstance | undefined;
  let outputStream: MediaStream | undefined;
  let debugLogger: MaskDebugLogger | undefined;
  let stopped = false;
  let trackingLoopEnabled = false;

  try {
    const { MindARThree, THREE } =
      await loadOfficialMindARModules();

    // We keep MindAR's own post-estimator One Euro filters for faceMatrix and
    // faceScale. The custom loop below bypasses MindAR processVideo(), but uses
    // the exact official filters so pose jitter is suppressed without putting
    // the 468-landmark deformation smoother in the head-pose path.
    const mindar = new MindARThree({
      container,
      userDeviceId: deviceId,
    });

    mindarThree = mindar;

    // Prevent MindAR from starting its original post-estimator smoothing loop.
    // _startAR still performs detector setup, dummy warmup, camera geometry and
    // onUpdate wiring; only processVideo() is replaced.
    mindar.controller.processVideo = () => {};

    const { renderer, scene, camera } = mindar;

    const light = new THREE.HemisphereLight(
      0xffffff,
      0xbbbbff,
      1,
    );

    scene.add(light);

    const faceMesh = mindar.addFaceMesh();

    const texture =
      new THREE.TextureLoader().load(
        FACE_TEXTURE_URL,
      );

    faceMesh.material.map = texture;
    faceMesh.material.transparent = true;
    faceMesh.material.needsUpdate = true;

    scene.add(faceMesh);

    await mindar.start();

    const video = mindar.video;

    if (
      !video ||
      video.videoWidth <= 0 ||
      video.videoHeight <= 0
    ) {
      throw new Error(
        'MindAR FaceMesh 카메라 영상을 초기화하지 못했습니다.',
      );
    }

    const controller = mindar.controller;

    const calibrationDeviceKey =
      makeCalibrationDeviceKey(
        deviceId,
        video.videoWidth,
        video.videoHeight,
      );

    const savedCalibration =
      loadSavedCalibration(
        calibrationDeviceKey,
      );

    const initialThresholdPx =
      savedCalibration?.thresholdPx ??
      DEFAULT_GLOBAL_THRESHOLD_PX;

    const initialExpressionThresholdPx =
      savedCalibration
        ?.expressionThresholdPx ??
      DEFAULT_EXPRESSION_THRESHOLD_PX;

    const initialVerificationHz =
      savedCalibration
        ?.verificationHz ??
      DEFAULT_GATE_VERIFICATION_HZ;

    const initialOneEuroMinCutOff =
      Number.isFinite(
        savedCalibration
          ?.oneEuroMinCutOff,
      )
        ? savedCalibration!
            .oneEuroMinCutOff!
        : DEFAULT_ONE_EURO_MIN_CUTOFF;

    const initialOneEuroBeta =
      Number.isFinite(
        savedCalibration
          ?.oneEuroBeta,
      )
        ? savedCalibration!
            .oneEuroBeta!
        : DEFAULT_ONE_EURO_BETA;

    controller.faceMatrixFilter.minCutOff =
      initialOneEuroMinCutOff;
    controller.faceMatrixFilter.beta =
      initialOneEuroBeta;
    controller.faceScaleFilter.minCutOff =
      initialOneEuroMinCutOff;
    controller.faceScaleFilter.beta =
      initialOneEuroBeta;
    controller.faceMatrixFilter.reset();
    controller.faceScaleFilter.reset();

    const oneEuroTuner =
      new MindAROneEuroParameterTuner(
        initialOneEuroMinCutOff,
        initialOneEuroBeta,
      );

    // Default behavior remains unchanged: the existing OneEuro tuner controls
    // the live MindAR filters until the user explicitly touches a OneEuro slider.
    let oneEuroManualOverride = false;

    const calibrationSeedSource:
      'saved' | 'default' =
        savedCalibration
          ? 'saved'
          : 'default';

    debugLogger =
      new MaskDebugLogger({
        version: 'mask-diagnostics-v2',
        runtimeVersion:
          MASK_RUNTIME_VERSION,
        runtimeFeatures: {
          metricLandmarkDeadband: true,
          liveDeadbandSlider: true,
          liveOneEuroSliders: true,
          pointDeadbandEffectLogging: true,
          loggingContinuesAfterConvergence: true,
          runtimeProbeEndpoint: true,
          latestStatusEndpoint: true,
        },
        video: {
          width: video.videoWidth,
          height: video.videoHeight,
          frameRate:
            (
              video.srcObject as
                | MediaStream
                | null
            )
              ?.getVideoTracks()[0]
              ?.getSettings()
              .frameRate ?? null,
        },
        smoother: {
          type:
            'mediapipe-relative-velocity',
          windowSize:
            VELOCITY_FILTER_WINDOW_SIZE,
          velocityScale:
            VELOCITY_FILTER_SCALE,
        },
        oneEuro: {
          filter:
            'MindAR 1.2.5 OneEuro',
          minCutOff:
            initialOneEuroMinCutOff,
          beta:
            initialOneEuroBeta,
          seed:
            savedCalibration
              ?.oneEuroMinCutOff !==
              undefined
              ? 'saved'
              : 'log-replay-default',
          autoTune: true,
        },
        gate: {
          thresholdPx:
            initialThresholdPx,
          verificationHz:
            initialVerificationHz,
          initialExpressionThresholdPx:
            initialExpressionThresholdPx,
          calibrationSeedSource,
          savedCalibration,
          coreLandmarkIndices:
            Array.from(
              CORE_LANDMARK_INDICES,
            ),
          rigidLandmarkIndices:
            Array.from(
              RIGID_LANDMARK_INDICES,
            ),
          expressionLandmarkIndices:
            Array.from(
              EXPRESSION_LANDMARK_INDICES,
            ),
          autoTuning: true,
        },
      });

    void fetch(
      '/__runtime-probe',
      {
        cache: 'no-store',
      },
    )
      .then(async (response) => {
        const payload =
          await response.json();

        debugLogger?.log(
          'runtime_probe',
          {
            clientRuntimeVersion:
              MASK_RUNTIME_VERSION,
            serverRuntimeVersion:
              payload?.runtimeVersion ??
              null,
            railwayCommitSha:
              payload?.railwayCommitSha ??
              null,
            match:
              payload?.runtimeVersion ===
              MASK_RUNTIME_VERSION,
            serverFeatures:
              payload?.features ??
              null,
          },
        );
      })
      .catch((error) => {
        debugLogger?.log(
          'runtime_probe',
          {
            clientRuntimeVersion:
              MASK_RUNTIME_VERSION,
            serverRuntimeVersion:
              null,
            match: false,
            error:
              error instanceof Error
                ? error.message
                : String(error),
          },
        );
      });

    // MindAR's built-in loop never started. Our custom path deliberately
    // separates HEAD POSE from FACE DEFORMATION:
    //
    // detect -> RAW landmarks -> estimator -> MindAR OneEuro(faceMatrix/scale)
    //                                      -> pose EVERY tracking frame
    //        \-> RelativeVelocity -> deformation gate -> geometry only on accept
    //
    // Pose never waits for the deformation gate, but it is no longer raw/noisy:
    // the official MindAR OneEuro filter removes low-speed jitter and raises its
    // cutoff automatically when movement speed increases.

    const smoother =
      new FaceLandmarksSmoother();

    const pointDeadband =
      new Absolute3DPointDeadband(
        DEFAULT_POINT_DEADBAND_3D_PX,
      );

    const deadbandEffectMonitor =
      new DeadbandEffectMonitor();

    const globalGate =
      new GlobalLandmarkGate(
        initialThresholdPx,
        initialVerificationHz,
        initialExpressionThresholdPx,
      );

    const flipped =
      controller.flipFace
        ? createFlippedInput(
            video.videoWidth,
            video.videoHeight,
          )
        : null;

    let lastSeenAt = 0;
    let everSeenFace = false;

    let lastTrackingAt = 0;
    let frameIntervalMs = 33.3;
    let fps = 30;
    let trackingFrameIndex = 0;
    let calibrationFinalized = false;
    let detailedDiagnosticsEnabled = true;
    let pointDeadbandRevision = 0;
    let lastDeadbandEffect:
      ReturnType<
        DeadbandEffectMonitor['measure']
      > | null = null;

    const updateTrackingRate = (
      timestampMs: number,
    ) => {
      if (lastTrackingAt > 0) {
        const dt =
          timestampMs - lastTrackingAt;

        frameIntervalMs +=
          0.12 * (dt - frameIntervalMs);

        fps =
          1000 /
          Math.max(1, frameIntervalMs);
      }

      lastTrackingAt = timestampMs;
    };

    trackingLoopEnabled = true;

    const processFrame = async () => {
      if (
        stopped ||
        !trackingLoopEnabled
      ) {
        return;
      }

      let detectionInput:
        | HTMLVideoElement
        | HTMLCanvasElement = video;

      if (flipped) {
        flipped.context.clearRect(
          0,
          0,
          flipped.canvas.width,
          flipped.canvas.height,
        );

        flipped.context.save();
        flipped.context.translate(
          flipped.canvas.width,
          0,
        );
        flipped.context.scale(-1, 1);

        flipped.context.drawImage(
          video,
          0,
          0,
          flipped.canvas.width,
          flipped.canvas.height,
        );

        flipped.context.restore();
        detectionInput = flipped.canvas;
      }

      const detectStartedAt =
        performance.now();

      try {
        const results =
          await controller.faceMeshHelper.detect(
            detectionInput,
          );

        if (
          stopped ||
          !trackingLoopEnabled
        ) {
          return;
        }

        const now = performance.now();
        const detectDurationMs =
          now - detectStartedAt;

        updateTrackingRate(now);
        trackingFrameIndex++;

        if (
          !results.faceLandmarks ||
          results.faceLandmarks.length === 0
        ) {
          controller.lastEstimateResult = null;
          controller.onUpdate({
            hasFace: false,
          });

          debugLogger?.log(
            'tracking_frame',
            {
              frameIndex:
                trackingFrameIndex,
              detected: false,
              detectDurationMs,
              trackerFps: fps,
              trackerFrameIntervalMs:
                frameIntervalMs,
              gate:
                globalGate.getStatus(),
              renderedFaceMatrix:
                copyFaceMatrix(
                  faceMesh,
                ),
            },
            now,
          );

          if (
            everSeenFace &&
            now - lastSeenAt <=
              FACE_LOSS_GRACE_MS
          ) {
            // Keep only a very short grace window for one/two transient misses.
            // Long stale-mask display is worse than hiding briefly because the
            // face may already be at a completely different screen position.
            faceMesh.visible = true;
          } else if (everSeenFace) {
            smoother.reset();
            pointDeadband.reset();
            deadbandEffectMonitor.reset();
            globalGate.reset();
            controller.faceMatrixFilter.reset();
            controller.faceScaleFilter.reset();
            oneEuroTuner.resetWindow();
            faceMesh.visible = false;
          }
        } else {
          const rawLandmarks =
            numericDetectedLandmarks(
              results.faceLandmarks[0],
            );

          const smoothedLandmarks =
            smoother.smooth(
              results.faceLandmarks[0],
              now,
              video.videoWidth,
              video.videoHeight,
            );

          // Estimate pose from RAW landmarks so the 468-point smoother cannot
          // introduce head-follow lag. Then run the exact OneEuro filters that
          // MindAR 1.2.5 normally applies inside Controller.processVideo().
          const rawPoseEstimate =
            controller.estimator.estimate(
              rawLandmarks,
            );

          const poseFilterTimestamp =
            Date.now();

          const oneEuroTune =
            oneEuroTuner.addSample(
              poseFilterTimestamp,
              rawPoseEstimate.faceMatrix,
            );

          if (oneEuroTune) {
            if (
              oneEuroTune.changed &&
              !oneEuroManualOverride
            ) {
              controller.faceMatrixFilter.minCutOff =
                oneEuroTune.minCutOff;
              controller.faceMatrixFilter.beta =
                oneEuroTune.beta;
              controller.faceScaleFilter.minCutOff =
                oneEuroTune.minCutOff;
              controller.faceScaleFilter.beta =
                oneEuroTune.beta;
            }

            debugLogger?.log(
              'one_euro_tune',
              {
                frameIndex:
                  trackingFrameIndex,
                ...oneEuroTune,
                manualOverride:
                  oneEuroManualOverride,
                appliedToLiveFilter:
                  oneEuroTune.changed &&
                  !oneEuroManualOverride,
              },
              now,
            );
          }

          const filteredFaceMatrix =
            controller.faceMatrixFilter.filter(
              poseFilterTimestamp,
              rawPoseEstimate.faceMatrix,
            );

          const filteredFaceScale =
            controller.faceScaleFilter.filter(
              poseFilterTimestamp,
              [rawPoseEstimate.faceScale],
            )[0];

          const livePoseEstimate:
            MindAREstimate = {
              metricLandmarks:
                rawPoseEstimate.metricLandmarks,
              faceMatrix:
                filteredFaceMatrix,
              faceScale:
                filteredFaceScale,
              blendshapes:
                results.faceBlendshapes?.[0],
            };

          controller.lastEstimateResult =
            livePoseEstimate;

          controller.onUpdate({
            hasFace: true,
            estimateResult:
              livePoseEstimate,
          });

          // Deformation is estimated every tracking frame. The old global
          // gate remains telemetry/calibration only and no longer blocks
          // geometry updates, so the live point slider has direct visual effect.
          const deformationEstimate =
            controller.estimator.estimate(
              smoothedLandmarks,
            );

          deformationEstimate.blendshapes =
            results.faceBlendshapes?.[0];

          const pixelsPerMetricUnit =
            estimatePixelsPerMetricUnit(
              smoothedLandmarks,
              deformationEstimate.metricLandmarks,
              video.videoWidth,
              video.videoHeight,
            );

          const deadbandedMetricLandmarks =
            pointDeadband.applyMetric(
              deformationEstimate.metricLandmarks,
              pixelsPerMetricUnit,
            );

          const deadbandEffect =
            deadbandEffectMonitor.measure(
              deformationEstimate.metricLandmarks,
              deadbandedMetricLandmarks,
              livePoseEstimate.faceMatrix,
              pixelsPerMetricUnit,
            );

          lastDeadbandEffect =
            deadbandEffect;

          const totalDeadbandPoints =
            deadbandedMetricLandmarks.length;

          const heldCount =
            pointDeadband.getHeldCount();

          const changedCount =
            pointDeadband.getChangedCount();

          debugLogger?.log(
            'point_deadband_effect',
            {
              frameIndex:
                trackingFrameIndex,
              revision:
                pointDeadbandRevision,
              thresholdPx:
                pointDeadband.getThresholdPx(),
              decisionDistancePx:
                pointDeadband.getDecisionDistancePx(),
              heldCount,
              changedCount,
              totalPoints:
                totalDeadbandPoints,
              heldRatio:
                totalDeadbandPoints > 0
                  ? heldCount /
                    totalDeadbandPoints
                  : 0,
              changedRatio:
                totalDeadbandPoints > 0
                  ? changedCount /
                    totalDeadbandPoints
                  : 0,
              pixelsPerMetricUnit,
              ...deadbandEffect,
              stage:
                'post-estimator-metric',
            },
            now,
          );

          for (
            const geometry of
            controller.customFaceGeometries
          ) {
            geometry.updatePositions(
              deadbandedMetricLandmarks,
            );
          }

          const appliedEstimate = {
            faceScale:
              deformationEstimate.faceScale,
            faceMatrix:
              Array.from(
                deformationEstimate.faceMatrix,
              ),
            metricLandmarks:
              flattenNumericLandmarks(
                deadbandedMetricLandmarks,
              ),
          };

          // Keep existing gate statistics for diagnostics and convergence, but
          // its accept/hold result no longer decides whether geometry updates.
          const gateResult =
            globalGate.evaluate(
              smoothedLandmarks,
              video.videoWidth,
              video.videoHeight,
              now,
            );

          if (gateResult.evaluated) {
            if (
              detailedDiagnosticsEnabled &&
              gateResult.tuning.changed
            ) {
              debugLogger?.log(
                'auto_tune',
                {
                  frameIndex:
                    trackingFrameIndex,
                  tuning:
                    gateResult.tuning,
                  gate:
                    globalGate.getStatus(),
                },
                now,
              );
            }

            if (
              detailedDiagnosticsEnabled
            ) {
              debugLogger?.log(
              'gate_evaluation',
              {
                frameIndex:
                  trackingFrameIndex,
                detected: true,
                detectDurationMs,
                trackerFps: fps,
                trackerFrameIntervalMs:
                  frameIntervalMs,
                videoWidth:
                  video.videoWidth,
                videoHeight:
                  video.videoHeight,
                rawNormalized:
                  flattenDetectedLandmarks(
                    results.faceLandmarks[0],
                  ),
                rawPoseInput:
                  flattenNumericLandmarks(
                    rawLandmarks,
                  ),
                smoothedNormalized:
                  flattenNumericLandmarks(
                    smoothedLandmarks,
                  ),
                deformationMetric:
                  flattenNumericLandmarks(
                    deformationEstimate.metricLandmarks,
                  ),
                deadbandedMetric:
                  flattenNumericLandmarks(
                    deadbandedMetricLandmarks,
                  ),
                pointDeadband: {
                  thresholdPx:
                    pointDeadband.getThresholdPx(),
                  heldCount:
                    pointDeadband.getHeldCount(),
                  totalPoints:
                    deadbandedMetricLandmarks.length,
                  pixelsPerMetricUnit,
                  stage:
                    'post-estimator-metric',
                },
                gate: {
                  ...globalGate.getStatus(),
                  firstFrame:
                    gateResult.firstFrame,
                  coreMeasurements:
                    gateResult.coreMeasurements,
                  tuning:
                    gateResult.tuning,
                },
                appliedEstimate,
                rawPoseEstimate: {
                  faceScale:
                    rawPoseEstimate.faceScale,
                  faceMatrix:
                    Array.from(
                      rawPoseEstimate.faceMatrix,
                    ),
                },
                livePoseEstimate: {
                  faceScale:
                    livePoseEstimate.faceScale,
                  faceMatrix:
                    Array.from(
                      livePoseEstimate.faceMatrix,
                    ),
                },
                currentOutputEstimate:
                  controller.lastEstimateResult
                    ? {
                        faceScale:
                          controller
                            .lastEstimateResult
                            .faceScale,
                        faceMatrix:
                          Array.from(
                            controller
                              .lastEstimateResult
                              .faceMatrix,
                          ),
                      }
                    : null,
                oneEuro:
                  oneEuroTuner.getStatus(),
                renderedFaceMatrix:
                  copyFaceMatrix(
                    faceMesh,
                  ),
              },
              now,
              );
            }

            const convergedStatus =
              globalGate.getStatus();

            const oneEuroStatus =
              oneEuroTuner.getStatus();

            if (
              convergedStatus
                .calibrationConverged &&
              oneEuroStatus.converged &&
              !calibrationFinalized
            ) {
              calibrationFinalized = true;

              const savedAt =
                new Date().toISOString();

              const calibration = {
                thresholdPx:
                  convergedStatus
                    .thresholdPx,
                expressionThresholdPx:
                  convergedStatus
                    .expressionThresholdPx,
                verificationHz:
                  convergedStatus
                    .verificationHz,
                oneEuroMinCutOff:
                  oneEuroStatus
                    .minCutOff,
                oneEuroBeta:
                  oneEuroStatus.beta,
                updatedAt: savedAt,
              };

              saveCalibration(
                calibrationDeviceKey,
                calibration,
              );

              debugLogger?.log(
                'calibration_converged',
                {
                  frameIndex:
                    trackingFrameIndex,
                  calibrationDeviceKey,
                  calibrationSeedSource,
                  calibration,
                  trackingStatus:
                    convergedStatus,
                  oneEuro:
                    oneEuroStatus,
                },
                now,
              );

              // Stop only the heavy coordinate dumps. Keep the session logger
              // alive so every later slider change and its measured effect are
              // still recorded until the camera actually stops.
              detailedDiagnosticsEnabled =
                false;

              debugLogger?.log(
                'diagnostic_mode_change',
                {
                  frameIndex:
                    trackingFrameIndex,
                  detailedDiagnosticsEnabled:
                    false,
                  lightweightEvents: [
                    'point_deadband_effect',
                    'point_deadband_config_change',
                    'tracking_frame',
                  ],
                  reason:
                    'calibration_converged',
                },
                now,
              );
            }
          } else if (
            detailedDiagnosticsEnabled
          ) {
            debugLogger?.log(
              'tracking_tick',
              {
                frameIndex:
                  trackingFrameIndex,
                detected: true,
                detectDurationMs,
                trackerFps: fps,
                trackerFrameIntervalMs:
                  frameIntervalMs,
                gate:
                  globalGate.getStatus(),
                renderedFaceMatrix:
                  copyFaceMatrix(
                    faceMesh,
                  ),
              },
              now,
            );
          }

          lastSeenAt = now;
          everSeenFace = true;
          faceMesh.visible = true;
        }
      } finally {
        if (
          !stopped &&
          trackingLoopEnabled
        ) {
          requestAnimationFrame(
            () => void processFrame(),
          );
        }
      }
    };

    requestAnimationFrame(
      () => void processFrame(),
    );

    const outputScale = Math.min(
      1,
      960 / video.videoWidth,
      540 / video.videoHeight,
    );

    const outputCanvas =
      document.createElement('canvas');

    outputCanvas.width = Math.max(
      320,
      Math.round(
        video.videoWidth * outputScale,
      ),
    );

    outputCanvas.height = Math.max(
      240,
      Math.round(
        video.videoHeight * outputScale,
      ),
    );

    const ctx = outputCanvas.getContext(
      '2d',
      {
        alpha: false,
        desynchronized: true,
      },
    );

    if (!ctx) {
      throw new Error(
        'MindAR FaceMesh 출력 Canvas를 만들지 못했습니다.',
      );
    }

    const canvasStream =
      outputCanvas.captureStream(60);

    const outputVideoTrack =
      canvasStream.getVideoTracks()[0];

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

    renderer.setAnimationLoop(() => {
      if (stopped) return;

      renderer.render(
        scene,
        camera,
      );

      // Camera background is mirrored for the local/self-view.
      ctx.save();
      ctx.translate(
        outputCanvas.width,
        0,
      );
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

    const getTrackingStatus =
      (): TrackingStatus => ({
        fps,
        frameIntervalMs,
        smoothing:
          'mediapipe-relative-velocity',
        windowSize:
          VELOCITY_FILTER_WINDOW_SIZE,
        velocityScale:
          VELOCITY_FILTER_SCALE,
        globalThresholdPx:
          globalGate.getStatus().thresholdPx,
        expressionThresholdPx:
          globalGate.getStatus().expressionThresholdPx,
        targetThresholdPx:
          globalGate.getStatus().targetThresholdPx,
        targetExpressionThresholdPx:
          globalGate.getStatus().targetExpressionThresholdPx,
        verificationHz:
          globalGate.getStatus().verificationHz,
        gateAccepted:
          globalGate.getStatus().accepted,
        gateReason:
          globalGate.getStatus().decisionReason,
        rigidSignalPx:
          globalGate.getStatus().rigidSignalPx,
        expressionSignalPx:
          globalGate.getStatus().expressionSignalPx,
        frameRigidMotionPx:
          globalGate.getStatus().frameRigidMotionPx,
        frameExpressionMotionPx:
          globalGate.getStatus().frameExpressionMotionPx,
        noiseFloorPx:
          globalGate.getStatus().noiseFloorPx,
        expressionNoiseFloorPx:
          globalGate.getStatus().expressionNoiseFloorPx,
        autoTuningEnabled:
          globalGate.getStatus().autoTuningEnabled,
        autoTuneConfidence:
          globalGate.getStatus().autoTuneConfidence,
        calibrationConverged:
          globalGate.getStatus().calibrationConverged &&
          oneEuroTuner.getStatus().converged,
        convergenceProgress:
          Math.min(
            globalGate.getStatus().convergenceProgress,
            oneEuroTuner.getStatus().progress,
          ),
        oneEuroMinCutOff:
          controller.faceMatrixFilter.minCutOff,
        oneEuroBeta:
          controller.faceMatrixFilter.beta,
        oneEuroConverged:
          oneEuroTuner.getStatus().converged,
        oneEuroConvergenceProgress:
          oneEuroTuner.getStatus().progress,
        oneEuroScore:
          oneEuroTuner.getStatus().score,
        pointDeadbandPx:
          pointDeadband.getThresholdPx(),
        pointDeadbandHeldCount:
          pointDeadband.getHeldCount(),
        calibrationSeedSource,
        staticAcceptRate:
          globalGate.getStatus().staticAcceptRate,
        outputUpdateRate:
          globalGate.getStatus().outputUpdateRate,
        timeSinceLastAcceptMs:
          globalGate.getStatus().timeSinceLastAcceptMs,
      });

    const setGlobalThresholdPx = (
      threshold: number,
    ) => {
      globalGate.setThresholdPx(
        threshold,
      );

      debugLogger?.log(
        'config_change',
        {
          globalThresholdPx:
            globalGate.getStatus()
              .thresholdPx,
          verificationHz:
            globalGate.getStatus()
              .verificationHz,
        },
      );
    };

    const setPointDeadbandPx = (
      threshold: number,
    ) => {
      const previousPx =
        pointDeadband.getThresholdPx();

      pointDeadband.setThresholdPx(
        threshold,
      );

      pointDeadbandRevision++;

      debugLogger?.log(
        'point_deadband_config_change',
        {
          frameIndex:
            trackingFrameIndex,
          revision:
            pointDeadbandRevision,
          fromPx:
            previousPx,
          requestedPx:
            threshold,
          toPx:
            pointDeadband.getThresholdPx(),
          heldCountBeforeChange:
            pointDeadband.getHeldCount(),
          changedCountBeforeChange:
            pointDeadband.getChangedCount(),
          decisionDistanceBeforeChangePx:
            pointDeadband.getDecisionDistancePx(),
          effectBeforeChange:
            lastDeadbandEffect,
          stage:
            'post-estimator-metric',
        },
      );
    };

    const setOneEuroMinCutOff = (
      minCutOff: number,
    ) => {
      const previous =
        controller.faceMatrixFilter.minCutOff;

      const next =
        Math.min(
          MAX_ONE_EURO_MIN_CUTOFF,
          Math.max(
            MIN_ONE_EURO_MIN_CUTOFF,
            Number.isFinite(minCutOff)
              ? minCutOff
              : previous,
          ),
        );

      oneEuroManualOverride = true;

      controller.faceMatrixFilter.minCutOff =
        next;
      controller.faceScaleFilter.minCutOff =
        next;

      debugLogger?.log(
        'one_euro_config_change',
        {
          frameIndex:
            trackingFrameIndex,
          parameter: 'minCutOff',
          from: previous,
          requested: minCutOff,
          to: next,
          beta:
            controller.faceMatrixFilter.beta,
          manualOverride: true,
        },
      );
    };

    const setOneEuroBeta = (
      beta: number,
    ) => {
      const previous =
        controller.faceMatrixFilter.beta;

      const next =
        Math.min(
          MAX_ONE_EURO_BETA,
          Math.max(
            MIN_ONE_EURO_BETA,
            Number.isFinite(beta)
              ? beta
              : previous,
          ),
        );

      oneEuroManualOverride = true;

      controller.faceMatrixFilter.beta =
        next;
      controller.faceScaleFilter.beta =
        next;

      debugLogger?.log(
        'one_euro_config_change',
        {
          frameIndex:
            trackingFrameIndex,
          parameter: 'beta',
          from: previous,
          requested: beta,
          to: next,
          minCutOff:
            controller.faceMatrixFilter.minCutOff,
          manualOverride: true,
        },
      );
    };

    const setVerificationHz = (
      hz: number,
    ) => {
      globalGate.setVerificationHz(
        hz,
      );

      debugLogger?.log(
        'config_change',
        {
          globalThresholdPx:
            globalGate.getStatus()
              .thresholdPx,
          verificationHz:
            globalGate.getStatus()
              .verificationHz,
          autoTuningEnabled:
            globalGate.getStatus()
              .autoTuningEnabled,
        },
      );
    };

    const setAutoTuningEnabled = (
      enabled: boolean,
    ) => {
      globalGate.setAutoTuningEnabled(
        enabled,
      );

      debugLogger?.log(
        'config_change',
        {
          globalThresholdPx:
            globalGate.getStatus()
              .thresholdPx,
          expressionThresholdPx:
            globalGate.getStatus()
              .expressionThresholdPx,
          verificationHz:
            globalGate.getStatus()
              .verificationHz,
          autoTuningEnabled:
            enabled,
        },
      );
    };

    const getDebugSession =
      () =>
        debugLogger!.getSessionInfo();

    const stop = () => {
      if (stopped) return;

      stopped = true;
      trackingLoopEnabled = false;

      debugLogger?.stop({
        trackingFrameIndex,
        trackingStatus:
          getTrackingStatus(),
      });

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

      outputStream
        ?.getVideoTracks()
        .forEach((track) => {
          if (
            track.readyState !== 'ended'
          ) {
            track.stop();
          }
        });

      source
        .getAudioTracks()
        .forEach((track) => {
          if (
            track.readyState !== 'ended'
          ) {
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
      setGlobalThresholdPx,
      setPointDeadbandPx,
      setOneEuroMinCutOff,
      setOneEuroBeta,
      setVerificationHz,
      setAutoTuningEnabled,
      getTrackingStatus,
      getDebugSession,
    };
  } catch (error) {
    stopped = true;
    trackingLoopEnabled = false;

    debugLogger?.stop({
      error:
        error instanceof Error
          ? error.message
          : String(error),
    });

    try {
      mindarThree?.renderer.setAnimationLoop(
        null,
      );
    } catch {
      // no-op
    }

    try {
      mindarThree?.stop();
    } catch {
      // no-op
    }

    source
      .getAudioTracks()
      .forEach((track) => {
        if (
          track.readyState !== 'ended'
        ) {
          track.stop();
        }
      });

    container.remove();

    throw error;
  }
}
