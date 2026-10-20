export interface AbsoluteDeadbandStatus {
  threshold: number;
  holdRatio: number;
}

const MIN_THRESHOLD = 0;
const MAX_THRESHOLD = 30;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Simple absolute screen-space deadband.
 *
 * Threshold is expressed in pixels, not normalized landmark units.
 * For each landmark, compare the current X/Y position with the last position
 * actually sent downstream. If both absolute screen-space differences stay
 * inside the threshold, hold the complete previous X/Y/Z point exactly.
 *
 * Z is deliberately not used to trigger an update. Face depth values can carry
 * noticeably more tracker noise than screen-space X/Y and previously caused
 * almost every point to escape the deadband even when the visible point barely
 * moved.
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

  apply(
    points: number[][],
    imageWidth: number,
    imageHeight: number,
  ) {
    if (this.held.length !== points.length) {
      this.held = points.map((point) => [
        point[0],
        point[1],
        point[2],
      ]);

      this.holdRatio = 0;
      return this.held;
    }

    const width = Math.max(1, imageWidth);
    const height = Math.max(1, imageHeight);
    const output = new Array<number[]>(points.length);
    let heldCount = 0;

    for (let i = 0; i < points.length; i++) {
      const current = points[i];
      const previous = this.held[i];

      const dxPx =
        Math.abs(current[0] - previous[0]) * width;
      const dyPx =
        Math.abs(current[1] - previous[1]) * height;

      if (
        dxPx <= this.threshold &&
        dyPx <= this.threshold
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
