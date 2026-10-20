export const CORE_LANDMARK_INDICES = [
  10, 152,
  33, 133, 362, 263,
  70, 105, 300, 334,
  1, 4,
  61, 291, 13, 14,
  234, 454,
  127, 356,
] as const;

export interface GlobalLandmarkGateStatus {
  thresholdPx: number;
  verificationHz: number;
  movedCorePoints: number;
  requiredMovedCorePoints: number;
  accepted: boolean;
  evaluated: boolean;
}

export interface CoreLandmarkMeasurement {
  index: number;
  current: [number, number, number];
  acceptedBaseline: [number, number, number];
  dxPx: number;
  dyPx: number;
  distancePx: number;
  overThreshold: boolean;
}

export interface GlobalLandmarkGateResult {
  accepted: boolean;
  evaluated: boolean;
  firstFrame: boolean;
  points: number[][];
  coreMeasurements: CoreLandmarkMeasurement[];
}

const MIN_THRESHOLD_PX = 0;
const MAX_THRESHOLD_PX = 50;
const MIN_VERIFICATION_HZ = 1;
const MAX_VERIFICATION_HZ = 60;
const REQUIRED_MOVED_CORE_POINTS = 3;

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

/**
 * Global landmark gate.
 *
 * Only 20 representative face landmarks are inspected.
 * The gate decides whether the ENTIRE landmark frame is accepted.
 *
 * - If fewer than REQUIRED_MOVED_CORE_POINTS core landmarks moved farther than
 *   thresholdPx from the last accepted frame, nothing downstream is updated.
 * - If enough core landmarks moved, the entire current 468-point frame becomes
 *   the new accepted frame.
 * - Evaluation itself is capped by verificationHz. Between evaluations the
 *   previous accepted frame is kept unchanged.
 *
 * For diagnostics, every evaluated frame also returns the exact core-point
 * displacement that caused the accept/hold decision.
 */
export class GlobalLandmarkGate {
  private acceptedPoints: number[][] = [];
  private thresholdPx: number;
  private verificationHz: number;
  private lastEvaluationMs = -1;
  private status: GlobalLandmarkGateStatus;

  constructor(
    thresholdPx: number,
    verificationHz: number,
  ) {
    this.thresholdPx = clamp(
      Number.isFinite(thresholdPx)
        ? thresholdPx
        : 0,
      MIN_THRESHOLD_PX,
      MAX_THRESHOLD_PX,
    );

    this.verificationHz = clamp(
      Number.isFinite(verificationHz)
        ? verificationHz
        : 15,
      MIN_VERIFICATION_HZ,
      MAX_VERIFICATION_HZ,
    );

    this.status = {
      thresholdPx: this.thresholdPx,
      verificationHz: this.verificationHz,
      movedCorePoints: 0,
      requiredMovedCorePoints:
        REQUIRED_MOVED_CORE_POINTS,
      accepted: false,
      evaluated: false,
    };
  }

  reset() {
    this.acceptedPoints = [];
    this.lastEvaluationMs = -1;
    this.status = {
      thresholdPx: this.thresholdPx,
      verificationHz: this.verificationHz,
      movedCorePoints: 0,
      requiredMovedCorePoints:
        REQUIRED_MOVED_CORE_POINTS,
      accepted: false,
      evaluated: false,
    };
  }

  setThresholdPx(thresholdPx: number) {
    this.thresholdPx = clamp(
      Number.isFinite(thresholdPx)
        ? thresholdPx
        : 0,
      MIN_THRESHOLD_PX,
      MAX_THRESHOLD_PX,
    );

    this.status.thresholdPx =
      this.thresholdPx;
  }

  setVerificationHz(verificationHz: number) {
    this.verificationHz = clamp(
      Number.isFinite(verificationHz)
        ? verificationHz
        : 15,
      MIN_VERIFICATION_HZ,
      MAX_VERIFICATION_HZ,
    );

    this.status.verificationHz =
      this.verificationHz;
  }

  evaluate(
    points: number[][],
    imageWidth: number,
    imageHeight: number,
    timestampMs: number,
  ): GlobalLandmarkGateResult {
    if (
      this.acceptedPoints.length !==
      points.length
    ) {
      this.acceptedPoints =
        clonePoints(points);

      this.lastEvaluationMs =
        timestampMs;

      const coreMeasurements:
        CoreLandmarkMeasurement[] = [];

      for (
        let i = 0;
        i < CORE_LANDMARK_INDICES.length;
        i++
      ) {
        const index =
          CORE_LANDMARK_INDICES[i];

        const point =
          this.acceptedPoints[index];

        if (!point) {
          continue;
        }

        const point3 =
          toPoint3(point);

        coreMeasurements.push({
          index,
          current: point3,
          acceptedBaseline: point3,
          dxPx: 0,
          dyPx: 0,
          distancePx: 0,
          overThreshold: true,
        });
      }

      this.status = {
        thresholdPx: this.thresholdPx,
        verificationHz:
          this.verificationHz,
        movedCorePoints:
          coreMeasurements.length,
        requiredMovedCorePoints:
          REQUIRED_MOVED_CORE_POINTS,
        accepted: true,
        evaluated: true,
      };

      return {
        accepted: true,
        evaluated: true,
        firstFrame: true,
        points: this.acceptedPoints,
        coreMeasurements,
      };
    }

    const intervalMs =
      1000 / this.verificationHz;

    if (
      this.lastEvaluationMs >= 0 &&
      timestampMs - this.lastEvaluationMs <
        intervalMs
    ) {
      this.status = {
        ...this.status,
        accepted: false,
        evaluated: false,
      };

      return {
        accepted: false,
        evaluated: false,
        firstFrame: false,
        points: this.acceptedPoints,
        coreMeasurements: [],
      };
    }

    this.lastEvaluationMs =
      timestampMs;

    const width = Math.max(
      1,
      imageWidth,
    );

    const height = Math.max(
      1,
      imageHeight,
    );

    let movedCorePoints = 0;
    let validCorePoints = 0;

    const coreMeasurements:
      CoreLandmarkMeasurement[] = [];

    for (
      let i = 0;
      i < CORE_LANDMARK_INDICES.length;
      i++
    ) {
      const index =
        CORE_LANDMARK_INDICES[i];

      const current = points[index];
      const previous =
        this.acceptedPoints[index];

      if (!current || !previous) {
        continue;
      }

      validCorePoints++;

      const dxPx =
        (current[0] - previous[0]) *
        width;

      const dyPx =
        (current[1] - previous[1]) *
        height;

      const distancePx =
        Math.hypot(dxPx, dyPx);

      const overThreshold =
        this.thresholdPx <= 0 ||
        distancePx >= this.thresholdPx;

      if (overThreshold) {
        movedCorePoints++;
      }

      coreMeasurements.push({
        index,
        current: toPoint3(current),
        acceptedBaseline:
          toPoint3(previous),
        dxPx,
        dyPx,
        distancePx,
        overThreshold,
      });
    }

    const requiredMovedCorePoints =
      Math.min(
        REQUIRED_MOVED_CORE_POINTS,
        Math.max(1, validCorePoints),
      );

    const accepted =
      validCorePoints > 0 &&
      movedCorePoints >=
        requiredMovedCorePoints;

    if (accepted) {
      this.acceptedPoints =
        clonePoints(points);
    }

    this.status = {
      thresholdPx: this.thresholdPx,
      verificationHz:
        this.verificationHz,
      movedCorePoints,
      requiredMovedCorePoints,
      accepted,
      evaluated: true,
    };

    return {
      accepted,
      evaluated: true,
      firstFrame: false,
      points: this.acceptedPoints,
      coreMeasurements,
    };
  }

  getStatus(): GlobalLandmarkGateStatus {
    return { ...this.status };
  }
}
