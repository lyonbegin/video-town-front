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
  ) {
    if (
      this.acceptedPoints.length !==
      points.length
    ) {
      this.acceptedPoints =
        clonePoints(points);

      this.lastEvaluationMs =
        timestampMs;

      this.status = {
        thresholdPx: this.thresholdPx,
        verificationHz:
          this.verificationHz,
        movedCorePoints:
          CORE_LANDMARK_INDICES.length,
        requiredMovedCorePoints:
          REQUIRED_MOVED_CORE_POINTS,
        accepted: true,
      };

      return {
        accepted: true,
        evaluated: true,
        points: this.acceptedPoints,
      };
    }

    const intervalMs =
      1000 / this.verificationHz;

    if (
      this.lastEvaluationMs >= 0 &&
      timestampMs - this.lastEvaluationMs <
        intervalMs
    ) {
      return {
        accepted: false,
        evaluated: false,
        points: this.acceptedPoints,
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

      if (
        this.thresholdPx <= 0 ||
        distancePx >= this.thresholdPx
      ) {
        movedCorePoints++;
      }
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
    };

    return {
      accepted,
      evaluated: true,
      points: this.acceptedPoints,
    };
  }

  getStatus(): GlobalLandmarkGateStatus {
    return { ...this.status };
  }
}
