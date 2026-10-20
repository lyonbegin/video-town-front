export interface AbsoluteDeadbandStatus {
  threshold: number;
  velocityThreshold: number;
  holdRatio: number;
  velocityBypassRatio: number;
}

const MIN_THRESHOLD = 0;
const MAX_THRESHOLD = 30;
const MIN_VELOCITY_THRESHOLD = 0;
const MAX_VELOCITY_THRESHOLD = 1200;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Position + instantaneous-velocity deadband.
 *
 * Position threshold:
 *   Compare current screen-space X/Y against the last point actually sent
 *   downstream. Small changes are held exactly.
 *
 * Velocity threshold:
 *   Differentiate the current point against the previous INPUT frame in
 *   screen-space pixels/sec. If instantaneous speed reaches this threshold,
 *   bypass the position deadband and send the current point immediately.
 *
 * This lets a relatively large position threshold suppress static micro-jitter
 * without making deliberate fast face motion feel slow.
 */
export class AbsoluteLandmarkDeadband {
  private held: number[][] = [];
  private previousInput: number[][] = [];
  private previousTimestampMs = -1;
  private threshold: number;
  private velocityThreshold: number;
  private holdRatio = 0;
  private velocityBypassRatio = 0;

  constructor(
    threshold: number,
    velocityThreshold: number,
  ) {
    this.threshold = clamp(
      Number.isFinite(threshold) ? threshold : 0,
      MIN_THRESHOLD,
      MAX_THRESHOLD,
    );

    this.velocityThreshold = clamp(
      Number.isFinite(velocityThreshold)
        ? velocityThreshold
        : 0,
      MIN_VELOCITY_THRESHOLD,
      MAX_VELOCITY_THRESHOLD,
    );
  }

  reset() {
    this.held = [];
    this.previousInput = [];
    this.previousTimestampMs = -1;
    this.holdRatio = 0;
    this.velocityBypassRatio = 0;
  }

  setThreshold(threshold: number) {
    this.threshold = clamp(
      Number.isFinite(threshold) ? threshold : 0,
      MIN_THRESHOLD,
      MAX_THRESHOLD,
    );
  }

  setVelocityThreshold(threshold: number) {
    this.velocityThreshold = clamp(
      Number.isFinite(threshold) ? threshold : 0,
      MIN_VELOCITY_THRESHOLD,
      MAX_VELOCITY_THRESHOLD,
    );
  }

  apply(
    points: number[][],
    imageWidth: number,
    imageHeight: number,
    timestampMs: number,
  ) {
    if (
      this.held.length !== points.length ||
      this.previousInput.length !== points.length
    ) {
      this.held = points.map((point) => [
        point[0],
        point[1],
        point[2],
      ]);

      this.previousInput = points.map((point) => [
        point[0],
        point[1],
        point[2],
      ]);

      this.previousTimestampMs = timestampMs;
      this.holdRatio = 0;
      this.velocityBypassRatio = 0;
      return this.held;
    }

    const width = Math.max(1, imageWidth);
    const height = Math.max(1, imageHeight);

    const dtSeconds =
      this.previousTimestampMs >= 0
        ? Math.max(
            0.001,
            (timestampMs - this.previousTimestampMs) /
              1000,
          )
        : 0;

    const output =
      new Array<number[]>(points.length);

    let heldCount = 0;
    let velocityBypassCount = 0;

    for (let i = 0; i < points.length; i++) {
      const current = points[i];
      const held = this.held[i];
      const previousInput =
        this.previousInput[i];

      const dxFromHeldPx =
        Math.abs(current[0] - held[0]) * width;

      const dyFromHeldPx =
        Math.abs(current[1] - held[1]) * height;

      let speedPxPerSecond = 0;

      if (dtSeconds > 0) {
        const dxFramePx =
          (current[0] - previousInput[0]) *
          width;

        const dyFramePx =
          (current[1] - previousInput[1]) *
          height;

        speedPxPerSecond =
          Math.hypot(
            dxFramePx,
            dyFramePx,
          ) / dtSeconds;
      }

      const velocityBypass =
        this.velocityThreshold <= 0 ||
        speedPxPerSecond >=
          this.velocityThreshold;

      if (velocityBypass) {
        const next = [
          current[0],
          current[1],
          current[2],
        ];

        this.held[i] = next;
        output[i] = next;
        velocityBypassCount++;
      } else if (
        dxFromHeldPx <= this.threshold &&
        dyFromHeldPx <= this.threshold
      ) {
        output[i] = held;
        heldCount++;
      } else {
        const next = [
          current[0],
          current[1],
          current[2],
        ];

        this.held[i] = next;
        output[i] = next;
      }

      this.previousInput[i] = [
        current[0],
        current[1],
        current[2],
      ];
    }

    this.previousTimestampMs = timestampMs;

    this.holdRatio =
      points.length > 0
        ? heldCount / points.length
        : 0;

    this.velocityBypassRatio =
      points.length > 0
        ? velocityBypassCount / points.length
        : 0;

    return output;
  }

  getStatus(): AbsoluteDeadbandStatus {
    return {
      threshold: this.threshold,
      velocityThreshold:
        this.velocityThreshold,
      holdRatio: this.holdRatio,
      velocityBypassRatio:
        this.velocityBypassRatio,
    };
  }
}
