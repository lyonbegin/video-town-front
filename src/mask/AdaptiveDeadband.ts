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
  noiseRadius: number;
  samplesSinceRadiusRefresh: number;
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

const RADIUS_REFRESH_INTERVAL = 4;

function medianInPlace(values: number[]) {
  if (values.length === 0) return 0;

  values.sort((a, b) => a - b);
  const middle = values.length >> 1;

  if ((values.length & 1) === 1) {
    return values[middle];
  }

  return (values[middle - 1] + values[middle]) * 0.5;
}

function distance3(a: Point3, b: Point3) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];

  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function faceScale(points: number[][]) {
  let xMin = Number.POSITIVE_INFINITY;
  let xMax = Number.NEGATIVE_INFINITY;
  let yMin = Number.POSITIVE_INFINITY;
  let yMax = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < points.length; i++) {
    const point = points[i];

    if (point[0] < xMin) xMin = point[0];
    if (point[0] > xMax) xMax = point[0];
    if (point[1] < yMin) yMin = point[1];
    if (point[1] > yMax) yMax = point[1];
  }

  const width = xMax - xMin;
  const height = yMax - yMin;

  return Math.max(1e-6, (width + height) * 0.5);
}

/**
 * Rolling MAD noise estimator + hysteresis deadband.
 *
 * This stage does no interpolation. Each landmark keeps a cached noise radius
 * learned from recent inlier motion. While the input stays inside that radius
 * the previous output is held exactly. Once it exits, values pass through until
 * motion becomes quiet again.
 *
 * MAD is intentionally recalculated only when enough new inlier samples arrive.
 * Re-sorting 468 histories on every frame added measurable CPU/GC cost without
 * improving the noise estimate.
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
      const current = points[i] as Point3;

      if (!state.previousInput || !state.held) {
        state.previousInput = current;
        state.held = current;
        output[i] = current;
        continue;
      }

      const frameDelta =
        distance3(current, state.previousInput) / scale;

      if (state.noiseHistory.length < this.options.minSamples) {
        this.pushNoise(state, frameDelta, true);
        state.previousInput = current;
        state.held = current;
        output[i] = current;
        continue;
      }

      const radius = state.noiseRadius;
      radiusSum += radius;
      if (radius > radiusMax) radiusMax = radius;

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
        output[i] = current;

        if (
          state.quietFrames >=
          this.options.quietFramesToHold
        ) {
          state.moving = false;
          state.quietFrames = 0;

          // Start learning the new resting noise around this position.
          this.pushNoise(state, frameDelta, false);
        }

        continue;
      }

      const distanceFromHeld =
        distance3(current, state.held) / scale;

      if (distanceFromHeld <= radius) {
        heldCount++;
        output[i] = state.held;

        // We already know this sample is inside the current noise envelope.
        // Update the history cheaply and refresh MAD only every few samples.
        this.pushNoise(state, frameDelta, false);
      } else {
        state.moving = true;
        state.quietFrames = 0;
        state.held = current;
        output[i] = current;
      }

      state.previousInput = current;
    }

    const measuredCount = Math.max(
      1,
      this.states.filter(
        (state) =>
          state.noiseHistory.length >=
          this.options.minSamples,
      ).length,
    );

    this.status = {
      holdRatio:
        points.length > 0
          ? heldCount / points.length
          : 0,
      meanNoiseRadius:
        radiusSum / measuredCount,
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
        noiseRadius: this.options.minRadius,
        samplesSinceRadiusRefresh: 0,
        moving: false,
        quietFrames: 0,
      }),
    );
  }

  private pushNoise(
    state: PointState,
    value: number,
    forceRefresh: boolean,
  ) {
    if (!Number.isFinite(value)) return;

    state.noiseHistory.push(Math.max(0, value));

    if (
      state.noiseHistory.length >
      this.options.windowSize
    ) {
      state.noiseHistory.shift();
    }

    state.samplesSinceRadiusRefresh++;

    const enoughSamples =
      state.noiseHistory.length >=
      this.options.minSamples;

    if (
      enoughSamples &&
      (
        forceRefresh ||
        state.samplesSinceRadiusRefresh >=
          RADIUS_REFRESH_INTERVAL
      )
    ) {
      state.noiseRadius =
        this.calculateNoiseRadius(
          state.noiseHistory,
        );

      state.samplesSinceRadiusRefresh = 0;
    }
  }

  private calculateNoiseRadius(
    history: number[],
  ) {
    const sorted = history.slice();
    const center = medianInPlace(sorted);

    const deviations =
      new Array<number>(history.length);

    for (let i = 0; i < history.length; i++) {
      deviations[i] =
        Math.abs(history[i] - center);
    }

    const mad =
      medianInPlace(deviations);

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
}
