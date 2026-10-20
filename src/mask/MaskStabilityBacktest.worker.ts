/// <reference lib="webworker" />

type CaptureSample = {
  timestampMs: number;
  pixelsPerMetricUnit: number;
  faceMatrix: Float32Array;
  metricLandmarks: Float32Array;
};

type SampleMessage = {
  type: 'sample';
  timestampMs: number;
  pixelsPerMetricUnit: number;
  faceMatrixBuffer: ArrayBuffer;
  metricLandmarksBuffer: ArrayBuffer;
};

type OptimizeMessage = {
  type: 'optimize';
};

type ResetMessage = {
  type: 'reset';
};

type WorkerInput =
  | SampleMessage
  | OptimizeMessage
  | ResetMessage;

const MIN_CUTOFF_CANDIDATES = [
  0.00005,
  0.0001,
  0.00015,
  0.0002,
  0.0003,
  0.0004,
  0.0005,
  0.0007,
  0.001,
  0.0015,
  0.002,
  0.003,
  0.004,
  0.005,
] as const;

const BETA_CANDIDATES = [
  0,
  0.5,
  1,
  2,
  3,
  4,
  5,
  6,
  8,
  10,
  12,
  16,
  20,
] as const;

const DEADBAND_CANDIDATES = [
  0,
  0.25,
  0.5,
  0.75,
  1,
  1.5,
  2,
  2.5,
  3,
  4,
  5,
  6,
  7.5,
  9,
  10,
] as const;

const DERIVATIVE_CUTOFF = 0.001;

let samples: CaptureSample[] = [];

function quantile(
  values: number[],
  q: number,
) {
  if (values.length === 0) {
    return 0;
  }

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

function median(
  values: number[],
) {
  return quantile(
    values,
    0.5,
  );
}

function normalizedDistance(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  scales: number[],
) {
  let sum = 0;
  const count =
    Math.min(
      a.length,
      b.length,
      scales.length,
    );

  for (
    let i = 0;
    i < count;
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
  }

  return Math.sqrt(
    sum / Math.max(1, count),
  );
}

function replayOneEuro(
  minCutOff: number,
  beta: number,
) {
  const output:
    Float32Array[] = [];

  let previousValue:
    Float32Array | null = null;
  let previousDerivative:
    Float32Array | null = null;
  let previousTimestamp:
    number | null = null;

  for (
    const sample of samples
  ) {
    const current =
      sample.faceMatrix;

    if (
      previousValue === null ||
      previousDerivative === null ||
      previousTimestamp === null
    ) {
      const first =
        new Float32Array(
          current,
        );

      output.push(first);
      previousValue = first;
      previousDerivative =
        new Float32Array(
          current.length,
        );
      previousTimestamp =
        sample.timestampMs;
      continue;
    }

    const elapsedMs =
      Math.max(
        0.001,
        sample.timestampMs -
          previousTimestamp,
      );

    const derivativeR =
      2 *
      Math.PI *
      DERIVATIVE_CUTOFF *
      elapsedMs;

    const derivativeAlpha =
      derivativeR /
      (derivativeR + 1);

    const filtered =
      new Float32Array(
        current.length,
      );

    const nextDerivative =
      new Float32Array(
        current.length,
      );

    for (
      let i = 0;
      i < current.length;
      i++
    ) {
      const derivative =
        ((current[i] ?? 0) -
          (previousValue[i] ?? 0)) /
        elapsedMs;

      const filteredDerivative =
        derivativeAlpha *
          derivative +
        (1 - derivativeAlpha) *
          (previousDerivative[i] ??
            0);

      const cutoff =
        minCutOff +
        beta *
          Math.abs(
            filteredDerivative,
          );

      const r =
        2 *
        Math.PI *
        cutoff *
        elapsedMs;

      const alpha =
        r / (r + 1);

      filtered[i] =
        alpha *
          (current[i] ?? 0) +
        (1 - alpha) *
          (previousValue[i] ?? 0);

      nextDerivative[i] =
        filteredDerivative;
    }

    output.push(filtered);
    previousValue = filtered;
    previousDerivative =
      nextDerivative;
    previousTimestamp =
      sample.timestampMs;
  }

  return output;
}

function evaluateOneEuro() {
  const rawDiffs:
    Float32Array[] = [];

  for (
    let i = 1;
    i < samples.length;
    i++
  ) {
    const current =
      samples[i].faceMatrix;
    const previous =
      samples[i - 1]
        .faceMatrix;

    const diff =
      new Float32Array(
        current.length,
      );

    for (
      let component = 0;
      component <
      current.length;
      component++
    ) {
      diff[component] =
        (current[component] ??
          0) -
        (previous[component] ??
          0);
    }

    rawDiffs.push(diff);
  }

  const componentScales =
    Array.from(
      {
        length:
          samples[0]
            .faceMatrix.length,
      },
      (_, component) =>
        Math.max(
          0.0001,
          quantile(
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

  const zero =
    new Float32Array(
      componentScales.length,
    );

  const rawMotion =
    rawDiffs.map(
      (diff) =>
        normalizedDistance(
          diff,
          zero,
          componentScales,
        ),
    );

  const staticBoundary =
    quantile(
      rawMotion,
      0.35,
    );

  const motionBoundary =
    quantile(
      rawMotion,
      0.65,
    );

  const rawStaticMedian =
    Math.max(
      0.0001,
      median(
        rawMotion.filter(
          (value) =>
            value <=
            staticBoundary,
        ),
      ),
    );

  const rawMotionMedian =
    Math.max(
      0.0001,
      median(
        rawMotion.filter(
          (value) =>
            value >=
            motionBoundary,
        ),
      ),
    );

  const candidates:
    Array<{
      minCutOff: number;
      beta: number;
      staticJitterRatio: number;
      motionErrorRatio: number;
    }> = [];

  for (
    const minCutOff of
    MIN_CUTOFF_CANDIDATES
  ) {
    for (
      const beta of
      BETA_CANDIDATES
    ) {
      const filtered =
        replayOneEuro(
          minCutOff,
          beta,
        );

      const staticMotion:
        number[] = [];
      const motionErrors:
        number[] = [];

      for (
        let i = 1;
        i < filtered.length;
        i++
      ) {
        const filteredDelta =
          normalizedDistance(
            filtered[i],
            filtered[i - 1],
            componentScales,
          );

        if (
          rawMotion[i - 1] <=
          staticBoundary
        ) {
          staticMotion.push(
            filteredDelta,
          );
        }

        if (
          rawMotion[i - 1] >=
          motionBoundary
        ) {
          motionErrors.push(
            normalizedDistance(
              filtered[i],
              samples[i]
                .faceMatrix,
              componentScales,
            ),
          );
        }
      }

      candidates.push({
        minCutOff,
        beta,
        staticJitterRatio:
          median(
            staticMotion,
          ) /
          rawStaticMedian,
        motionErrorRatio:
          median(
            motionErrors,
          ) /
          rawMotionMedian,
      });
    }
  }

  const bestStatic =
    Math.min(
      ...candidates.map(
        (candidate) =>
          candidate
            .staticJitterRatio,
      ),
    );

  // First guarantee strong static stabilization. From the candidates that
  // satisfy it, choose the one that follows real movement fastest.
  const staticLimit =
    Math.max(
      0.3,
      bestStatic * 1.2,
    );

  const eligible =
    candidates.filter(
      (candidate) =>
        candidate
          .staticJitterRatio <=
        staticLimit,
    );

  const pool =
    eligible.length > 0
      ? eligible
      : candidates;

  pool.sort(
    (a, b) =>
      (
        a.motionErrorRatio +
        0.12 *
          a.staticJitterRatio +
        0.001 * a.beta
      ) -
      (
        b.motionErrorRatio +
        0.12 *
          b.staticJitterRatio +
        0.001 * b.beta
      ),
  );

  return pool[0];
}

function pointDistancePx(
  current:
    Float32Array,
  previous:
    Float32Array,
  offset: number,
  pixelsPerMetricUnit: number,
) {
  return (
    Math.hypot(
      (current[offset] ?? 0) -
        (previous[offset] ??
          0),
      (current[offset + 1] ??
        0) -
        (previous[offset + 1] ??
          0),
      (current[offset + 2] ??
        0) -
        (previous[offset + 2] ??
          0),
    ) *
    Math.max(
      0.000001,
      pixelsPerMetricUnit,
    )
  );
}

function evaluateDeadbandCandidate(
  thresholdPx: number,
  rawFrameMotion:
    number[],
  staticBoundary: number,
  motionBoundary: number,
  rawStaticMedian: number,
  rawMotionMedian: number,
) {
  let held =
    new Float32Array(
      samples[0]
        .metricLandmarks,
    );

  let previousOutput =
    new Float32Array(held);

  const staticOutputMotion:
    number[] = [];

  const motionError:
    number[] = [];

  for (
    let frame = 1;
    frame < samples.length;
    frame++
  ) {
    const current =
      samples[frame]
        .metricLandmarks;

    const outputDistances:
      number[] = [];

    const errorDistances:
      number[] = [];

    for (
      let offset = 0;
      offset <
      current.length;
      offset += 3
    ) {
      const decisionDistance =
        pointDistancePx(
          current,
          held,
          offset,
          samples[frame]
            .pixelsPerMetricUnit,
        );

      if (
        decisionDistance >=
        thresholdPx
      ) {
        held[offset] =
          current[offset] ?? 0;
        held[offset + 1] =
          current[offset + 1] ??
          0;
        held[offset + 2] =
          current[offset + 2] ??
          0;
      }

      outputDistances.push(
        pointDistancePx(
          held,
          previousOutput,
          offset,
          samples[frame]
            .pixelsPerMetricUnit,
        ),
      );

      errorDistances.push(
        pointDistancePx(
          current,
          held,
          offset,
          samples[frame]
            .pixelsPerMetricUnit,
        ),
      );
    }

    const outputP95 =
      quantile(
        outputDistances,
        0.95,
      );

    const errorP95 =
      quantile(
        errorDistances,
        0.95,
      );

    if (
      rawFrameMotion[
        frame - 1
      ] <= staticBoundary
    ) {
      staticOutputMotion.push(
        outputP95,
      );
    }

    if (
      rawFrameMotion[
        frame - 1
      ] >= motionBoundary
    ) {
      motionError.push(
        errorP95,
      );
    }

    previousOutput =
      new Float32Array(held);
  }

  return {
    thresholdPx,
    staticJitterRatio:
      median(
        staticOutputMotion,
      ) /
      rawStaticMedian,
    motionErrorRatio:
      median(
        motionError,
      ) /
      rawMotionMedian,
  };
}

function evaluateDeadband() {
  const rawFrameMotion:
    number[] = [];

  for (
    let frame = 1;
    frame < samples.length;
    frame++
  ) {
    const current =
      samples[frame]
        .metricLandmarks;
    const previous =
      samples[frame - 1]
        .metricLandmarks;

    const distances:
      number[] = [];

    for (
      let offset = 0;
      offset <
      current.length;
      offset += 3
    ) {
      distances.push(
        pointDistancePx(
          current,
          previous,
          offset,
          samples[frame]
            .pixelsPerMetricUnit,
        ),
      );
    }

    rawFrameMotion.push(
      quantile(
        distances,
        0.95,
      ),
    );
  }

  const staticBoundary =
    quantile(
      rawFrameMotion,
      0.35,
    );

  const motionBoundary =
    quantile(
      rawFrameMotion,
      0.65,
    );

  const rawStaticMedian =
    Math.max(
      0.0001,
      median(
        rawFrameMotion.filter(
          (value) =>
            value <=
            staticBoundary,
        ),
      ),
    );

  const rawMotionMedian =
    Math.max(
      0.0001,
      median(
        rawFrameMotion.filter(
          (value) =>
            value >=
            motionBoundary,
        ),
      ),
    );

  const candidates =
    DEADBAND_CANDIDATES.map(
      (thresholdPx) =>
        evaluateDeadbandCandidate(
          thresholdPx,
          rawFrameMotion,
          staticBoundary,
          motionBoundary,
          rawStaticMedian,
          rawMotionMedian,
        ),
    );

  const bestStatic =
    Math.min(
      ...candidates.map(
        (candidate) =>
          candidate
            .staticJitterRatio,
      ),
    );

  const staticLimit =
    Math.max(
      0.2,
      bestStatic * 1.2,
    );

  const eligible =
    candidates.filter(
      (candidate) =>
        candidate
          .staticJitterRatio <=
        staticLimit,
    );

  const pool =
    eligible.length > 0
      ? eligible
      : candidates;

  pool.sort(
    (a, b) =>
      (
        a.motionErrorRatio +
        0.08 *
          a.staticJitterRatio +
        0.0005 *
          a.thresholdPx
      ) -
      (
        b.motionErrorRatio +
        0.08 *
          b.staticJitterRatio +
        0.0005 *
          b.thresholdPx
      ),
  );

  return pool[0];
}

function optimize() {
  if (
    samples.length < 30
  ) {
    workerScope.postMessage({
      type: 'error',
      message:
        'Not enough tracking samples for stability backtest.',
      sampleCount:
        samples.length,
    });

    return;
  }

  const startedAt =
    performance.now();

  const oneEuro =
    evaluateOneEuro();

  const deadband =
    evaluateDeadband();

  workerScope.postMessage({
    type: 'result',
    sampleCount:
      samples.length,
    durationMs:
      samples[
        samples.length - 1
      ].timestampMs -
      samples[0].timestampMs,
    computeMs:
      performance.now() -
      startedAt,
    minCutOff:
      oneEuro.minCutOff,
    beta:
      oneEuro.beta,
    pointDeadbandPx:
      deadband.thresholdPx,
    staticJitterRatio:
      oneEuro
        .staticJitterRatio,
    motionErrorRatio:
      oneEuro
        .motionErrorRatio,
    deadbandJitterRatio:
      deadband
        .staticJitterRatio,
    deadbandMotionErrorRatio:
      deadband
        .motionErrorRatio,
  });
}

const workerScope =
  self as unknown as {
    onmessage:
      | ((
          event:
            MessageEvent<WorkerInput>,
        ) => void)
      | null;
    postMessage:
      (message: unknown) => void;
  };

workerScope.onmessage = (
  event,
) => {
  const message =
    event.data;

  if (
    message.type === 'reset'
  ) {
    samples = [];
    return;
  }

  if (
    message.type === 'sample'
  ) {
    samples.push({
      timestampMs:
        message.timestampMs,
      pixelsPerMetricUnit:
        message
          .pixelsPerMetricUnit,
      faceMatrix:
        new Float32Array(
          message
            .faceMatrixBuffer,
        ),
      metricLandmarks:
        new Float32Array(
          message
            .metricLandmarksBuffer,
        ),
    });

    return;
  }

  if (
    message.type ===
    'optimize'
  ) {
    optimize();
  }
};
