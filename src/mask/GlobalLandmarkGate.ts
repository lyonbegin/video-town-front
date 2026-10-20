export const RIGID_LANDMARK_INDICES = [
  10,
  33, 133, 362, 263,
  1, 4,
  234, 454,
  127, 356,
] as const;

export const EXPRESSION_LANDMARK_INDICES = [
  70, 105, 300, 334,
  61, 291,
  13, 14,
  152,
] as const;

export const CORE_LANDMARK_INDICES = [
  ...RIGID_LANDMARK_INDICES,
  ...EXPRESSION_LANDMARK_INDICES,
] as const;

export type GateDecisionReason =
  | 'first_frame'
  | 'rigid_motion'
  | 'rigid_fast'
  | 'catch_up'
  | 'expression'
  | 'expression_catch_up'
  | 'hold'
  | 'not_due';

export interface GlobalLandmarkGateStatus {
  thresholdPx: number;
  expressionThresholdPx: number;
  decisionThresholdPx: number;
  decisionExpressionThresholdPx: number;
  targetThresholdPx: number;
  targetExpressionThresholdPx: number;
  verificationHz: number;
  accepted: boolean;
  evaluated: boolean;
  decisionReason: GateDecisionReason;
  rigidSignalPx: number;
  expressionSignalPx: number;
  frameRigidMotionPx: number;
  frameExpressionMotionPx: number;
  noiseFloorPx: number;
  expressionNoiseFloorPx: number;
  autoTuningEnabled: boolean;
  autoTuneConfidence: number;
  noiseSampleCount: number;
  expressionNoiseSampleCount: number;
  staticLikely: boolean;
  staticAcceptRate: number;
  outputUpdateRate: number;
  timeSinceLastAcceptMs: number;
}

export interface CoreLandmarkMeasurement {
  index: number;
  group: 'rigid' | 'expression';
  current: [number, number, number];
  acceptedBaseline: [number, number, number];
  dxPx: number;
  dyPx: number;
  distancePx: number;
  residualAfterRigidTranslationPx: number;
}

export interface GateTuningSnapshot {
  changed: boolean;
  thresholdBeforePx: number;
  thresholdAfterPx: number;
  targetThresholdPx: number;
  expressionThresholdBeforePx: number;
  expressionThresholdAfterPx: number;
  targetExpressionThresholdPx: number;
  noiseFloorPx: number;
  expressionNoiseFloorPx: number;
  staticAcceptRate: number;
  outputUpdateRate: number;
  confidence: number;
}

export interface GlobalLandmarkGateResult {
  accepted: boolean;
  evaluated: boolean;
  firstFrame: boolean;
  points: number[][];
  coreMeasurements: CoreLandmarkMeasurement[];
  tuning: GateTuningSnapshot;
}

const MIN_THRESHOLD_PX = 1.0;
const MAX_THRESHOLD_PX = 5.0;
const MIN_EXPRESSION_THRESHOLD_PX = 0.6;
const MAX_EXPRESSION_THRESHOLD_PX = 3.5;
const MIN_VERIFICATION_HZ = 1;
const MAX_VERIFICATION_HZ = 60;
const HISTORY_SIZE = 90;
const DECISION_HISTORY_SIZE = 60;
const STATIC_HISTORY_SIZE = 40;
const MIN_TUNING_SAMPLES = 12;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clonePoints(points: number[][]) {
  return points.map((point) => [
    point[0],
    point[1],
    point[2],
  ]);
}

function toPoint3(point: number[]): [number, number, number] {
  return [
    point[0] ?? 0,
    point[1] ?? 0,
    point[2] ?? 0,
  ];
}

function median(values: number[]) {
  if (values.length === 0) return 0;

  const sorted = [...values].sort(
    (a, b) => a - b,
  );

  const middle =
    Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return (
    sorted[middle - 1] +
    sorted[middle]
  ) / 2;
}

function quantile(
  values: number[],
  q: number,
) {
  if (values.length === 0) return 0;

  const sorted = [...values].sort(
    (a, b) => a - b,
  );

  const index =
    clamp(q, 0, 1) *
    (sorted.length - 1);

  const lower =
    Math.floor(index);

  const upper =
    Math.ceil(index);

  if (lower === upper) {
    return sorted[lower];
  }

  const fraction =
    index - lower;

  return (
    sorted[lower] *
      (1 - fraction) +
    sorted[upper] *
      fraction
  );
}

function pushBounded<T>(
  values: T[],
  value: T,
  maxLength: number,
) {
  values.push(value);

  if (values.length > maxLength) {
    values.splice(
      0,
      values.length - maxLength,
    );
  }
}

function booleanRate(values: boolean[]) {
  if (values.length === 0) return 0;

  let trueCount = 0;

  for (const value of values) {
    if (value) trueCount++;
  }

  return trueCount / values.length;
}

type DeltaSummary = {
  medianDxPx: number;
  medianDyPx: number;
  medianDistancePx: number;
};

function measureDelta(
  current: number[][],
  baseline: number[][],
  indices: readonly number[],
  width: number,
  height: number,
): DeltaSummary {
  const dxValues: number[] = [];
  const dyValues: number[] = [];
  const distances: number[] = [];

  for (const index of indices) {
    const now = current[index];
    const before = baseline[index];

    if (!now || !before) {
      continue;
    }

    const dx =
      (now[0] - before[0]) *
      width;

    const dy =
      (now[1] - before[1]) *
      height;

    dxValues.push(dx);
    dyValues.push(dy);
    distances.push(
      Math.hypot(dx, dy),
    );
  }

  return {
    medianDxPx: median(dxValues),
    medianDyPx: median(dyValues),
    medianDistancePx:
      median(distances),
  };
}

function expressionResidualSignal(
  current: number[][],
  baseline: number[][],
  width: number,
  height: number,
  rigidDxPx: number,
  rigidDyPx: number,
) {
  const residuals: number[] = [];

  for (
    const index of
    EXPRESSION_LANDMARK_INDICES
  ) {
    const now = current[index];
    const before = baseline[index];

    if (!now || !before) {
      continue;
    }

    const dx =
      (now[0] - before[0]) *
        width -
      rigidDxPx;

    const dy =
      (now[1] - before[1]) *
        height -
      rigidDyPx;

    residuals.push(
      Math.hypot(dx, dy),
    );
  }

  return quantile(
    residuals,
    0.75,
  );
}

export class GlobalLandmarkGate {
  private acceptedPoints: number[][] = [];
  private previousInput: number[][] = [];
  private thresholdPx: number;
  private expressionThresholdPx: number;
  private verificationHz: number;
  private autoTuningEnabled = true;
  private nextEvaluationMs = -1;
  private lastAcceptMs = -1;
  private rigidNoiseHistory: number[] = [];
  private expressionNoiseHistory: number[] = [];
  private staticAcceptanceHistory: boolean[] = [];
  private decisionHistory: boolean[] = [];
  private status: GlobalLandmarkGateStatus;

  constructor(
    thresholdPx: number,
    verificationHz: number,
    expressionThresholdPx = 1.5,
  ) {
    this.thresholdPx = clamp(
      Number.isFinite(thresholdPx)
        ? thresholdPx
        : 3,
      MIN_THRESHOLD_PX,
      MAX_THRESHOLD_PX,
    );

    this.expressionThresholdPx =
      clamp(
        Number.isFinite(
          expressionThresholdPx,
        )
          ? expressionThresholdPx
          : 1.5,
        MIN_EXPRESSION_THRESHOLD_PX,
        MAX_EXPRESSION_THRESHOLD_PX,
      );

    this.verificationHz = clamp(
      Number.isFinite(verificationHz)
        ? verificationHz
        : 15,
      MIN_VERIFICATION_HZ,
      MAX_VERIFICATION_HZ,
    );

    this.status =
      this.makeStatus();
  }

  private makeStatus(
    overrides:
      Partial<GlobalLandmarkGateStatus> = {},
  ): GlobalLandmarkGateStatus {
    return {
      thresholdPx: this.thresholdPx,
      expressionThresholdPx:
        this.expressionThresholdPx,
      decisionThresholdPx:
        this.thresholdPx,
      decisionExpressionThresholdPx:
        this.expressionThresholdPx,
      targetThresholdPx:
        this.thresholdPx,
      targetExpressionThresholdPx:
        this.expressionThresholdPx,
      verificationHz:
        this.verificationHz,
      accepted: false,
      evaluated: false,
      decisionReason: 'not_due',
      rigidSignalPx: 0,
      expressionSignalPx: 0,
      frameRigidMotionPx: 0,
      frameExpressionMotionPx: 0,
      noiseFloorPx:
        quantile(
          this.rigidNoiseHistory,
          0.25,
        ),
      expressionNoiseFloorPx:
        quantile(
          this.expressionNoiseHistory,
          0.25,
        ),
      autoTuningEnabled:
        this.autoTuningEnabled,
      autoTuneConfidence:
        this.getTuneConfidence(),
      noiseSampleCount:
        this.rigidNoiseHistory.length,
      expressionNoiseSampleCount:
        this.expressionNoiseHistory.length,
      staticLikely: false,
      staticAcceptRate:
        booleanRate(
          this.staticAcceptanceHistory,
        ),
      outputUpdateRate:
        booleanRate(
          this.decisionHistory,
        ),
      timeSinceLastAcceptMs: 0,
      ...overrides,
    };
  }

  private getTuneConfidence() {
    return Math.min(
      1,
      Math.min(
        this.rigidNoiseHistory.length,
        this.expressionNoiseHistory.length,
      ) / 40,
    );
  }

  private scheduleNext(
    timestampMs: number,
  ) {
    const intervalMs =
      1000 / this.verificationHz;

    if (
      this.nextEvaluationMs < 0
    ) {
      this.nextEvaluationMs =
        timestampMs + intervalMs;
      return;
    }

    do {
      this.nextEvaluationMs +=
        intervalMs;
    } while (
      this.nextEvaluationMs <=
      timestampMs
    );
  }

  reset() {
    this.acceptedPoints = [];
    this.previousInput = [];
    this.nextEvaluationMs = -1;
    this.lastAcceptMs = -1;
    this.status =
      this.makeStatus({
        decisionReason:
          'not_due',
      });
  }

  setThresholdPx(thresholdPx: number) {
    this.thresholdPx = clamp(
      Number.isFinite(thresholdPx)
        ? thresholdPx
        : this.thresholdPx,
      MIN_THRESHOLD_PX,
      MAX_THRESHOLD_PX,
    );

    this.status =
      this.makeStatus({
        ...this.status,
        thresholdPx:
          this.thresholdPx,
      });
  }

  setVerificationHz(verificationHz: number) {
    this.verificationHz = clamp(
      Number.isFinite(verificationHz)
        ? verificationHz
        : this.verificationHz,
      MIN_VERIFICATION_HZ,
      MAX_VERIFICATION_HZ,
    );

    this.nextEvaluationMs = -1;

    this.status =
      this.makeStatus({
        ...this.status,
        verificationHz:
          this.verificationHz,
      });
  }

  setAutoTuningEnabled(enabled: boolean) {
    this.autoTuningEnabled = enabled;

    this.status =
      this.makeStatus({
        ...this.status,
        autoTuningEnabled:
          enabled,
      });
  }

  private collectNoiseSamples(
    frameRigidMotionPx: number,
    frameExpressionMotionPx: number,
  ) {
    // Always keep the recent motion distribution. The old implementation
    // admitted samples using a ceiling derived from the current threshold.
    // Once the threshold increased, real head motion was learned as "noise",
    // which raised the threshold again and created a positive feedback loop.
    //
    // We instead estimate the jitter floor from the LOW-MOTION quartile of
    // this raw recent distribution. Deliberate movement lives in the upper
    // part of the distribution and therefore cannot drive the noise floor
    // upward indefinitely.
    pushBounded(
      this.rigidNoiseHistory,
      frameRigidMotionPx,
      HISTORY_SIZE,
    );

    pushBounded(
      this.expressionNoiseHistory,
      frameExpressionMotionPx,
      HISTORY_SIZE,
    );
  }

  private tune(
    thresholdBeforePx: number,
    expressionThresholdBeforePx: number,
  ): GateTuningSnapshot {
    const noiseFloorPx =
      quantile(
        this.rigidNoiseHistory,
        0.25,
      );

    const expressionNoiseFloorPx =
      quantile(
        this.expressionNoiseHistory,
        0.25,
      );

    const staticAcceptRate =
      booleanRate(
        this.staticAcceptanceHistory,
      );

    const outputUpdateRate =
      booleanRate(
        this.decisionHistory,
      );

    let targetThresholdPx =
      clamp(
        noiseFloorPx * 2.2 + 0.5,
        1.8,
        MAX_THRESHOLD_PX,
      );

    if (
      this.staticAcceptanceHistory
        .length >= 8 &&
      staticAcceptRate > 0.08
    ) {
      // Small bounded correction only. Static false accepts must never be
      // allowed to push the threshold into a range where the mask can visibly
      // detach from the face.
      targetThresholdPx =
        clamp(
          targetThresholdPx +
            Math.min(
              0.8,
              (staticAcceptRate - 0.08) *
                2.0,
            ),
          1.8,
          MAX_THRESHOLD_PX,
        );
    }

    const targetExpressionThresholdPx =
      clamp(
        expressionNoiseFloorPx *
          1.6 +
          0.35,
        0.9,
        MAX_EXPRESSION_THRESHOLD_PX,
      );

    if (
      this.autoTuningEnabled &&
      this.rigidNoiseHistory.length >=
        MIN_TUNING_SAMPLES &&
      this.expressionNoiseHistory
        .length >=
        MIN_TUNING_SAMPLES
    ) {
      const rigidAlpha =
        targetThresholdPx >
        this.thresholdPx
          ? 0.20
          : 0.10;

      const expressionAlpha =
        targetExpressionThresholdPx >
        this.expressionThresholdPx
          ? 0.18
          : 0.10;

      this.thresholdPx =
        clamp(
          this.thresholdPx +
            rigidAlpha *
              (
                targetThresholdPx -
                this.thresholdPx
              ),
          MIN_THRESHOLD_PX,
          MAX_THRESHOLD_PX,
        );

      this.expressionThresholdPx =
        clamp(
          this.expressionThresholdPx +
            expressionAlpha *
              (
                targetExpressionThresholdPx -
                this.expressionThresholdPx
              ),
          MIN_EXPRESSION_THRESHOLD_PX,
          MAX_EXPRESSION_THRESHOLD_PX,
        );
    }

    return {
      changed:
        Math.abs(
          this.thresholdPx -
            thresholdBeforePx,
        ) >= 0.01 ||
        Math.abs(
          this.expressionThresholdPx -
            expressionThresholdBeforePx,
        ) >= 0.01,
      thresholdBeforePx,
      thresholdAfterPx:
        this.thresholdPx,
      targetThresholdPx,
      expressionThresholdBeforePx,
      expressionThresholdAfterPx:
        this.expressionThresholdPx,
      targetExpressionThresholdPx,
      noiseFloorPx,
      expressionNoiseFloorPx,
      staticAcceptRate,
      outputUpdateRate,
      confidence:
        this.getTuneConfidence(),
    };
  }

  evaluate(
    points: number[][],
    imageWidth: number,
    imageHeight: number,
    timestampMs: number,
  ): GlobalLandmarkGateResult {
    const emptyTuning = (
      thresholdBeforePx:
        number = this.thresholdPx,
      expressionThresholdBeforePx:
        number =
          this.expressionThresholdPx,
    ): GateTuningSnapshot => ({
      changed: false,
      thresholdBeforePx,
      thresholdAfterPx:
        this.thresholdPx,
      targetThresholdPx:
        this.status.targetThresholdPx,
      expressionThresholdBeforePx,
      expressionThresholdAfterPx:
        this.expressionThresholdPx,
      targetExpressionThresholdPx:
        this.status
          .targetExpressionThresholdPx,
      noiseFloorPx:
        this.status.noiseFloorPx,
      expressionNoiseFloorPx:
        this.status
          .expressionNoiseFloorPx,
      staticAcceptRate:
        this.status.staticAcceptRate,
      outputUpdateRate:
        this.status.outputUpdateRate,
      confidence:
        this.getTuneConfidence(),
    });

    if (
      this.acceptedPoints.length !==
        points.length ||
      this.previousInput.length !==
        points.length
    ) {
      this.acceptedPoints =
        clonePoints(points);

      this.previousInput =
        clonePoints(points);

      this.lastAcceptMs =
        timestampMs;

      this.scheduleNext(
        timestampMs,
      );

      const coreMeasurements =
        this.buildCoreMeasurements(
          points,
          this.acceptedPoints,
          Math.max(1, imageWidth),
          Math.max(1, imageHeight),
          0,
          0,
        );

      pushBounded(
        this.decisionHistory,
        true,
        DECISION_HISTORY_SIZE,
      );

      this.status =
        this.makeStatus({
          accepted: true,
          evaluated: true,
          decisionReason:
            'first_frame',
          timeSinceLastAcceptMs: 0,
        });

      return {
        accepted: true,
        evaluated: true,
        firstFrame: true,
        points:
          this.acceptedPoints,
        coreMeasurements,
        tuning: emptyTuning(),
      };
    }

    if (
      this.nextEvaluationMs < 0
    ) {
      this.nextEvaluationMs =
        timestampMs;
    }

    if (
      timestampMs <
      this.nextEvaluationMs
    ) {
      this.status =
        this.makeStatus({
          ...this.status,
          accepted: false,
          evaluated: false,
          decisionReason:
            'not_due',
          timeSinceLastAcceptMs:
            this.lastAcceptMs >= 0
              ? timestampMs -
                this.lastAcceptMs
              : 0,
        });

      return {
        accepted: false,
        evaluated: false,
        firstFrame: false,
        points:
          this.acceptedPoints,
        coreMeasurements: [],
        tuning: emptyTuning(),
      };
    }

    this.scheduleNext(
      timestampMs,
    );

    const width =
      Math.max(1, imageWidth);

    const height =
      Math.max(1, imageHeight);

    const thresholdBeforePx =
      this.thresholdPx;

    const expressionThresholdBeforePx =
      this.expressionThresholdPx;

    const acceptedRigidDelta =
      measureDelta(
        points,
        this.acceptedPoints,
        RIGID_LANDMARK_INDICES,
        width,
        height,
      );

    const rigidSignalPx =
      acceptedRigidDelta
        .medianDistancePx;

    const expressionSignalPx =
      expressionResidualSignal(
        points,
        this.acceptedPoints,
        width,
        height,
        acceptedRigidDelta
          .medianDxPx,
        acceptedRigidDelta
          .medianDyPx,
      );

    const frameRigidDelta =
      measureDelta(
        points,
        this.previousInput,
        RIGID_LANDMARK_INDICES,
        width,
        height,
      );

    const frameRigidMotionPx =
      frameRigidDelta
        .medianDistancePx;

    const frameExpressionMotionPx =
      expressionResidualSignal(
        points,
        this.previousInput,
        width,
        height,
        frameRigidDelta
          .medianDxPx,
        frameRigidDelta
          .medianDyPx,
      );

    const noiseFloorBefore =
      quantile(
        this.rigidNoiseHistory,
        0.25,
      );

    const expressionNoiseFloorBefore =
      quantile(
        this.expressionNoiseHistory,
        0.25,
      );

    const staticLikely =
      frameRigidMotionPx <=
        Math.max(
          2.2,
          noiseFloorBefore *
            2.0,
        ) &&
      frameExpressionMotionPx <=
        Math.max(
          1.5,
          expressionNoiseFloorBefore *
            2.0,
        );

    let accepted = false;
    let decisionReason:
      GateDecisionReason =
        'hold';

    const timeSinceLastAcceptBeforeMs =
      this.lastAcceptMs >= 0
        ? timestampMs -
          this.lastAcceptMs
        : 0;

    const fastMotionThresholdPx =
      Math.max(
        3.5,
        noiseFloorBefore * 3.0,
      );

    const catchUpSignalPx =
      Math.max(
        2.5,
        noiseFloorBefore * 2.0,
      );

    const expressionCatchUpPx =
      Math.max(
        1.8,
        expressionNoiseFloorBefore *
          1.8,
      );

    if (
      frameRigidMotionPx >=
      fastMotionThresholdPx
    ) {
      // A real sudden head movement must bypass the stabilizer immediately.
      accepted = true;
      decisionReason =
        'rigid_fast';
    } else if (
      rigidSignalPx >=
      thresholdBeforePx
    ) {
      accepted = true;
      decisionReason =
        'rigid_motion';
    } else if (
      expressionSignalPx >=
      expressionThresholdBeforePx
    ) {
      accepted = true;
      decisionReason =
        'expression';
    } else if (
      timeSinceLastAcceptBeforeMs >=
        150 &&
      rigidSignalPx >=
        catchUpSignalPx
    ) {
      // Hard anti-lag guard: even slow deliberate motion cannot leave the mask
      // sitting on an old pose for hundreds or thousands of milliseconds.
      accepted = true;
      decisionReason =
        'catch_up';
    } else if (
      timeSinceLastAcceptBeforeMs >=
        150 &&
      expressionSignalPx >=
        expressionCatchUpPx
    ) {
      accepted = true;
      decisionReason =
        'expression_catch_up';
    }

    if (staticLikely) {
      pushBounded(
        this.staticAcceptanceHistory,
        accepted,
        STATIC_HISTORY_SIZE,
      );
    }

    pushBounded(
      this.decisionHistory,
      accepted,
      DECISION_HISTORY_SIZE,
    );

    this.collectNoiseSamples(
      frameRigidMotionPx,
      frameExpressionMotionPx,
    );

    const tuning =
      this.tune(
        thresholdBeforePx,
        expressionThresholdBeforePx,
      );

    const coreMeasurements =
      this.buildCoreMeasurements(
        points,
        this.acceptedPoints,
        width,
        height,
        acceptedRigidDelta
          .medianDxPx,
        acceptedRigidDelta
          .medianDyPx,
      );

    if (accepted) {
      this.acceptedPoints =
        clonePoints(points);

      this.lastAcceptMs =
        timestampMs;
    }

    this.previousInput =
      clonePoints(points);

    const timeSinceLastAcceptMs =
      this.lastAcceptMs >= 0
        ? timestampMs -
          this.lastAcceptMs
        : 0;

    this.status =
      this.makeStatus({
        thresholdPx:
          this.thresholdPx,
        expressionThresholdPx:
          this.expressionThresholdPx,
        decisionThresholdPx:
          thresholdBeforePx,
        decisionExpressionThresholdPx:
          expressionThresholdBeforePx,
        targetThresholdPx:
          tuning.targetThresholdPx,
        targetExpressionThresholdPx:
          tuning
            .targetExpressionThresholdPx,
        accepted,
        evaluated: true,
        decisionReason,
        rigidSignalPx,
        expressionSignalPx,
        frameRigidMotionPx,
        frameExpressionMotionPx,
        noiseFloorPx:
          tuning.noiseFloorPx,
        expressionNoiseFloorPx:
          tuning.expressionNoiseFloorPx,
        autoTuningEnabled:
          this.autoTuningEnabled,
        autoTuneConfidence:
          tuning.confidence,
        noiseSampleCount:
          this.rigidNoiseHistory.length,
        expressionNoiseSampleCount:
          this.expressionNoiseHistory
            .length,
        staticLikely,
        staticAcceptRate:
          tuning.staticAcceptRate,
        outputUpdateRate:
          tuning.outputUpdateRate,
        timeSinceLastAcceptMs,
      });

    return {
      accepted,
      evaluated: true,
      firstFrame: false,
      points:
        this.acceptedPoints,
      coreMeasurements,
      tuning,
    };
  }

  private buildCoreMeasurements(
    current: number[][],
    baseline: number[][],
    width: number,
    height: number,
    rigidDxPx: number,
    rigidDyPx: number,
  ) {
    const output:
      CoreLandmarkMeasurement[] = [];

    for (
      const index of
      CORE_LANDMARK_INDICES
    ) {
      const now =
        current[index];

      const before =
        baseline[index];

      if (!now || !before) {
        continue;
      }

      const dxPx =
        (now[0] - before[0]) *
        width;

      const dyPx =
        (now[1] - before[1]) *
        height;

      const group:
        'rigid' | 'expression' =
          (
            RIGID_LANDMARK_INDICES as
              readonly number[]
          ).includes(index)
            ? 'rigid'
            : 'expression';

      output.push({
        index,
        group,
        current:
          toPoint3(now),
        acceptedBaseline:
          toPoint3(before),
        dxPx,
        dyPx,
        distancePx:
          Math.hypot(
            dxPx,
            dyPx,
          ),
        residualAfterRigidTranslationPx:
          Math.hypot(
            dxPx - rigidDxPx,
            dyPx - rigidDyPx,
          ),
      });
    }

    return output;
  }

  getStatus():
    GlobalLandmarkGateStatus {
    return {
      ...this.status,
    };
  }
}
