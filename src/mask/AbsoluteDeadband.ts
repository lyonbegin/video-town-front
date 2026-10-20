export interface AbsoluteDeadbandStatus {
  threshold: number;
  holdRatio: number;
}

const MIN_THRESHOLD = 0;
const MAX_THRESHOLD = 0.02;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Simple absolute deadband.
 *
 * For each landmark, compare the current x/y/z values with the last values
 * actually sent downstream. If all three absolute differences are within the
 * threshold, keep the previous output exactly. Otherwise replace the held
 * point with the current one.
 *
 * There is no learning, MAD, interpolation, hysteresis or moving state.
 */
export class AbsoluteLandmarkDeadband {
  private held: number[][] = [];
  private threshold: number;
  private holdRatio = 0;

  constructor(threshold: number) {
    this.threshold = clamp(
      Number.isFinite(threshold) ? threshold : 0,
      MIN_THRESHOLD,
      MAX_THRESHOLD,
    );
  }

  reset() {
    this.held = [];
    this.holdRatio = 0;
  }

  setThreshold(threshold: number) {
    this.threshold = clamp(
      Number.isFinite(threshold) ? threshold : 0,
      MIN_THRESHOLD,
      MAX_THRESHOLD,
    );
  }

  getThreshold() {
    return this.threshold;
  }

  apply(points: number[][]) {
    if (this.held.length !== points.length) {
      this.held = points.map((point) => [
        point[0],
        point[1],
        point[2],
      ]);

      this.holdRatio = 0;
      return this.held;
    }

    const output = new Array<number[]>(points.length);
    let heldCount = 0;

    for (let i = 0; i < points.length; i++) {
      const current = points[i];
      const previous = this.held[i];

      const dx = Math.abs(current[0] - previous[0]);
      const dy = Math.abs(current[1] - previous[1]);
      const dz = Math.abs(current[2] - previous[2]);

      if (
        dx <= this.threshold &&
        dy <= this.threshold &&
        dz <= this.threshold
      ) {
        output[i] = previous;
        heldCount++;
        continue;
      }

      const next = [
        current[0],
        current[1],
        current[2],
      ];

      this.held[i] = next;
      output[i] = next;
    }

    this.holdRatio =
      points.length > 0
        ? heldCount / points.length
        : 0;

    return output;
  }

  getStatus(): AbsoluteDeadbandStatus {
    return {
      threshold: this.threshold,
      holdRatio: this.holdRatio,
    };
  }
}
