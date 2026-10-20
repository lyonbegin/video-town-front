export interface AdaptiveDeadbandOptions {
  windowSize?: number;
  minSamples?: number;
  threshold?: number;
  constantScaleFactor?: number;
  minRadius?: number;
  maxRadius?: number;
  releaseRatio?: number;
  quietFramesToHold?: number;
}

export interface AdaptiveDeadbandStatus {
  holdRatio: number;
  meanNoiseRadius: number;
  maxNoiseRadius: number;
}

type Point3 = [number, number, number];

type PointState = {
  previousInput: Point3 | null;
  held: Point3 | null;
  noiseHistory: number[];
  moving: boolean;
  quietFrames: number;
};

const DEFAULTS: Required<AdaptiveDeadbandOptions> = {
  windowSize: 11,
  minSamples: 6,
  threshold: 3,
  constantScaleFactor: 1.4826,
  minRadius: 0.00045,
  maxRadius: 0.012,
  releaseRatio: 0.55,
  quietFramesToHold: 3,
};

function median(values: number[]) {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return (sorted[middle - 1] + sorted[middle]) * 0.5;
}

function distance3(a: Point3, b: Point3) {
  return Math.hypot(
    a[0] - b[0],
    a[1] - b[1],
    a[2] - b[2],
  );
}

function clonePoint(point: number[]): Point3 {
  return [point[0], point[1], point[2]];
}

function faceScale(points: number[][]) {
  let xMin = Number.POSITIVE_INFINITY;
  let xMax = Number.NEGATIVE_INFINITY;
  let yMin = Number.POSITIVE_INFINITY;
  let yMax = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    xMin = Math.min(xMin, point[0]);
    xMax = Math.max(xMax, point[0]);
    yMin = Math.min(yMin, point[1]);
    yMax = Math.max(yMax, point[1]);
  }

  const width = xMax - xMin;
  const height = yMax - yMin;

  return Math.max(1e-6, (width + height) * 0.5);
}

/**
 * Rolling Hampel/MAD noise estimator + hysteresis deadband.
 *
 * Input coordinates are expected to already be temporally smoothed.
 * This stage does not interpolate again. It only holds the previous output
 * while a landmark remains inside its own learned noise envelope.
 *
 * Once a point clearly leaves that envelope, the point enters "moving" mode
 * and all following values pass through until its per-frame motion settles
 * below the release threshold for a few consecutive frames. This preserves
 * expressions and deliberate slow motion while suppressing static micro-jitter.
 */
export class AdaptiveLandmarkDeadband {
  private readonly options: Required<AdaptiveDeadbandOptions>;
  private states: PointState[] = [];
  private status: AdaptiveDeadbandStatus = {
    holdRatio: 0,
    meanNoiseRadius: 0,
    maxNoiseRadius: 0,
  };

  constructor(options: AdaptiveDeadbandOptions = {}) {
    this.options = {
      ...DEFAULTS,
      ...options,
    };
  }

  reset() {
    this.states = [];
    this.status = {
      holdRatio: 0,
      meanNoiseRadius: 0,
      maxNoiseRadius: 0,
    };
  }

  apply(points: number[][]) {
    this.ensureStates(points.length);

    const scale = faceScale(points);
    const output: number[][] = new Array(points.length);

    let heldCount = 0;
    let radiusSum = 0;
    let radiusMax = 0;

    for (let i = 0; i < points.length; i++) {
      const state = this.states[i];
      const current = clonePoint(points[i]);

      if (!state.previousInput || !state.held) {
        state.previousInput = current;
        state.held = current;
        output[i] = [...current];
        continue;
      }

      const frameDelta =
        distance3(current, state.previousInput) / scale;

      const radius = this.getNoiseRadius(state);
      radiusSum += radius;
      radiusMax = Math.max(radiusMax, radius);

      if (state.noiseHistory.length < this.options.minSamples) {
        this.pushNoise(state, frameDelta);
        state.previousInput = current;
        state.held = current;
        output[i] = [...current];
        continue;
      }

      if (state.moving) {
        const releaseThreshold =
          radius * this.options.releaseRatio;

        if (frameDelta <= releaseThreshold) {
          state.quietFrames++;
        } else {
          state.quietFrames = 0;
        }

        state.previousInput = current;
        state.held = current;
        output[i] = [...current];

        if (
          state.quietFrames >=
          this.options.quietFramesToHold
        ) {
          state.moving = false;
          state.quietFrames = 0;
        }

        continue;
      }

      const distanceFromHeld =
        distance3(current, state.held) / scale;

      if (distanceFromHeld <= radius) {
        heldCount++;
        output[i] = [...state.held];

        this.learnNoiseIfInlier(
          state,
          frameDelta,
        );
      } else {
        state.moving = true;
        state.quietFrames = 0;
        state.held = current;
        output[i] = [...current];
      }

      state.previousInput = current;
    }

    this.status = {
      holdRatio:
        points.length > 0
          ? heldCount / points.length
          : 0,
      meanNoiseRadius:
        points.length > 0
          ? radiusSum / points.length
          : 0,
      maxNoiseRadius: radiusMax,
    };

    return output;
  }

  getStatus(): AdaptiveDeadbandStatus {
    return { ...this.status };
  }

  private ensureStates(count: number) {
    if (this.states.length === count) return;

    this.states = Array.from(
      { length: count },
      () => ({
        previousInput: null,
        held: null,
        noiseHistory: [],
        moving: false,
        quietFrames: 0,
      }),
    );
  }

  private getNoiseRadius(state: PointState) {
    if (state.noiseHistory.length === 0) {
      return this.options.minRadius;
    }

    const center = median(state.noiseHistory);
    const deviations =
      state.noiseHistory.map((value) =>
        Math.abs(value - center),
      );

    const mad = median(deviations);

    const radius =
      center +
      this.options.threshold *
        this.options.constantScaleFactor *
        mad;

    return Math.min(
      this.options.maxRadius,
      Math.max(
        this.options.minRadius,
        radius,
      ),
    );
  }

  private learnNoiseIfInlier(
    state: PointState,
    value: number,
  ) {
    if (state.noiseHistory.length < this.options.minSamples) {
      this.pushNoise(state, value);
      return;
    }

    const center = median(state.noiseHistory);
    const deviations =
      state.noiseHistory.map((sample) =>
        Math.abs(sample - center),
      );

    const mad = median(deviations);

    const inlierLimit = Math.max(
      this.options.minRadius * 2,
      center +
        this.options.threshold *
          this.options.constantScaleFactor *
          mad,
    );

    if (value <= inlierLimit) {
      this.pushNoise(state, value);
    }
  }

  private pushNoise(
    state: PointState,
    value: number,
  ) {
    if (!Number.isFinite(value)) return;

    state.noiseHistory.push(
      Math.max(0, value),
    );

    if (
      state.noiseHistory.length >
      this.options.windowSize
    ) {
      state.noiseHistory.shift();
    }
  }
}
