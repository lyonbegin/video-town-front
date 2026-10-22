import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from 'node:fs';
import {
  appendFile,
  readFile,
} from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname =
  path.dirname(fileURLToPath(import.meta.url));

const DIST_DIR =
  path.join(__dirname, 'dist');

const LOG_DIR =
  process.env.MASK_DEBUG_DIR ||
  '/tmp/video-town-mask-debug';

const PORT =
  Number(process.env.PORT) || 4173;

const MASK_RUNTIME_VERSION =
  'mask-runtime-20261020-v9';

const MASK_RUNTIME_FEATURES = {
  metricLandmarkDeadband: true,
  liveDeadbandSlider: true,
  liveOneEuroSliders: true,
  frontendWorkerStabilityBacktest: true,
  stabilityBacktestCaptureMs: 7000,
  oneEuroConfigChangeLogging: true,
  pointDeadbandEffectLogging: true,
  loggingContinuesAfterConvergence: true,
  runtimeProbeEndpoint: true,
  latestStatusEndpoint: true,
};

const MAX_BODY_BYTES =
  8 * 1024 * 1024;

const MAX_SESSION_FILE_BYTES =
  128 * 1024 * 1024;

mkdirSync(LOG_DIR, {
  recursive: true,
});

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8',
};

function sendJson(
  res,
  status,
  value,
) {
  const body = JSON.stringify(
    value,
    null,
    2,
  );

  res.writeHead(status, {
    'content-type':
      'application/json; charset=utf-8',
    'content-length':
      Buffer.byteLength(body),
    'cache-control': 'no-store',
  });

  res.end(body);
}

function isValidSessionId(value) {
  return (
    typeof value === 'string' &&
    /^[A-Za-z0-9_-]{16,80}$/.test(
      value,
    )
  );
}

function getLogPath(sessionId) {
  return path.join(
    LOG_DIR,
    `${sessionId}.ndjson`,
  );
}

function sameOriginAllowed(req) {
  const origin = req.headers.origin;

  if (!origin) return true;

  if (
    process.env
      .MASK_DEBUG_ALLOW_CROSS_ORIGIN !==
    '0'
  ) {
    return true;
  }

  try {
    const originHost =
      new URL(origin).host;

    return originHost === req.headers.host;
  } catch {
    return false;
  }
}

async function readJsonBody(req) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;

    if (total > MAX_BODY_BYTES) {
      const error =
        new Error('request body too large');

      error.statusCode = 413;
      throw error;
    }

    chunks.push(chunk);
  }

  const body =
    Buffer.concat(chunks).toString(
      'utf8',
    );

  return JSON.parse(body || '{}');
}

async function handleDebugPost(
  req,
  res,
) {
  if (!sameOriginAllowed(req)) {
    sendJson(res, 403, {
      ok: false,
      error: 'origin rejected',
    });
    return;
  }

  try {
    const payload =
      await readJsonBody(req);

    const sessionId =
      payload?.sessionId;

    const records =
      payload?.records;

    if (
      !isValidSessionId(sessionId) ||
      !Array.isArray(records)
    ) {
      sendJson(res, 400, {
        ok: false,
        error:
          'invalid sessionId or records',
      });
      return;
    }

    const filePath =
      getLogPath(sessionId);

    if (
      existsSync(filePath) &&
      statSync(filePath).size >=
        MAX_SESSION_FILE_BYTES
    ) {
      sendJson(res, 413, {
        ok: false,
        error:
          'session log size limit reached',
      });
      return;
    }

    const lines =
      records
        .map((record) =>
          JSON.stringify(record),
        )
        .join('\n');

    if (lines.length > 0) {
      await appendFile(
        filePath,
        `${lines}\n`,
        'utf8',
      );
    }

    const runtimeProbeRecord =
      [...records]
        .reverse()
        .find(
          (record) =>
            record?.type ===
            'runtime_probe',
        );

    const configChangeRecord =
      [...records]
        .reverse()
        .find(
          (record) =>
            record?.type ===
            'point_deadband_config_change',
        );

    const effectRecord =
      [...records]
        .reverse()
        .find(
          (record) =>
            record?.type ===
            'point_deadband_effect',
        );

    const oneEuroConfigChangeRecord =
      [...records]
        .reverse()
        .find(
          (record) =>
            record?.type ===
            'one_euro_config_change',
        );

    if (
      runtimeProbeRecord ||
      configChangeRecord ||
      oneEuroConfigChangeRecord ||
      effectRecord
    ) {
      console.log(
        '[mask-debug-live]',
        JSON.stringify({
          sessionId,
          runtimeProbe:
            runtimeProbeRecord?.data ??
            null,
          configChange:
            configChangeRecord?.data ??
            null,
          oneEuroConfigChange:
            oneEuroConfigChangeRecord?.data ??
            null,
          effect:
            effectRecord
              ? {
                  revision:
                    effectRecord.data
                      ?.revision ?? null,
                  thresholdPx:
                    effectRecord.data
                      ?.thresholdPx ?? null,
                  heldCount:
                    effectRecord.data
                      ?.heldCount ?? null,
                  changedCount:
                    effectRecord.data
                      ?.changedCount ?? null,
                  totalPoints:
                    effectRecord.data
                      ?.totalPoints ?? null,
                  heldRatio:
                    effectRecord.data
                      ?.heldRatio ?? null,
                  geometrySuppressionRatio:
                    effectRecord.data
                      ?.geometrySuppressionRatio ??
                    null,
                  geometryOutputMotionMeanPx:
                    effectRecord.data
                      ?.geometryOutputMotionPx
                      ?.mean ?? null,
                  renderedMotionProxyMeanPx:
                    effectRecord.data
                      ?.renderedMotionProxyPx
                      ?.mean ?? null,
                  renderedVsGeometryRatio:
                    effectRecord.data
                      ?.renderedVsGeometryRatio ??
                    null,
                }
              : null,
        }),
      );
    }

    sendJson(res, 200, {
      ok: true,
      sessionId,
      appended: records.length,
    });
  } catch (error) {
    const status =
      Number(error?.statusCode) || 400;

    sendJson(res, status, {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    });
  }
}

function getLatestSessionId() {
  const candidates =
    readdirSync(
      LOG_DIR,
      {
        withFileTypes: true,
      },
    )
      .filter(
        (entry) =>
          entry.isFile() &&
          entry.name.endsWith(
            '.ndjson',
          ),
      )
      .map((entry) => {
        const filePath =
          path.join(
            LOG_DIR,
            entry.name,
          );

        return {
          sessionId:
            entry.name.slice(
              0,
              -'.ndjson'.length,
            ),
          mtimeMs:
            statSync(
              filePath,
            ).mtimeMs,
        };
      })
      .filter(
        (item) =>
          isValidSessionId(
            item.sessionId,
          ),
      )
      .sort(
        (a, b) =>
          b.mtimeMs -
          a.mtimeMs,
      );

  return (
    candidates[0]
      ?.sessionId ?? null
  );
}

async function loadRecords(sessionId) {
  const filePath =
    getLogPath(sessionId);

  if (!existsSync(filePath)) {
    return null;
  }

  const text =
    await readFile(
      filePath,
      'utf8',
    );

  const records = [];

  for (
    const line of
    text.split('\n')
  ) {
    if (!line.trim()) {
      continue;
    }

    try {
      records.push(
        JSON.parse(line),
      );
    } catch {
      // Keep the rest of the session analyzable if one line is incomplete.
    }
  }

  return records;
}

function mean(values) {
  if (values.length === 0) {
    return 0;
  }

  return (
    values.reduce(
      (sum, value) =>
        sum + value,
      0,
    ) / values.length
  );
}

function minValue(values) {
  return values.length
    ? Math.min(...values)
    : 0;
}

function maxValue(values) {
  return values.length
    ? Math.max(...values)
    : 0;
}

function percentileValue(
  values,
  q,
) {
  if (values.length === 0) {
    return 0;
  }

  const sorted =
    [...values].sort(
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

function buildPointDeadbandSummary(
  records,
) {
  const effects =
    records.filter(
      (record) =>
        record?.type ===
        'point_deadband_effect',
    );

  const configChanges =
    records.filter(
      (record) =>
        record?.type ===
        'point_deadband_config_change',
    );

  const groups =
    new Map();

  for (const record of effects) {
    const data =
      record?.data || {};

    const thresholdPx =
      Number(
        data.thresholdPx || 0,
      );

    const key =
      thresholdPx.toFixed(2);

    if (!groups.has(key)) {
      groups.set(key, {
        thresholdPx,
        heldRatios: [],
        changedRatios: [],
        decisionMeans: [],
        decisionP95s: [],
        inputMeans: [],
        outputMeans: [],
        outputP95s: [],
        renderedMeans: [],
        renderedP95s: [],
        suppressions: [],
        renderedVsGeometry: [],
      });
    }

    const group =
      groups.get(key);

    group.heldRatios.push(
      Number(
        data.heldRatio || 0,
      ),
    );

    group.changedRatios.push(
      Number(
        data.changedRatio || 0,
      ),
    );

    group.decisionMeans.push(
      Number(
        data.decisionDistancePx
          ?.mean || 0,
      ),
    );

    group.decisionP95s.push(
      Number(
        data.decisionDistancePx
          ?.p95 || 0,
      ),
    );

    group.inputMeans.push(
      Number(
        data.inputMotionPx
          ?.mean || 0,
      ),
    );

    group.outputMeans.push(
      Number(
        data.geometryOutputMotionPx
          ?.mean || 0,
      ),
    );

    group.outputP95s.push(
      Number(
        data.geometryOutputMotionPx
          ?.p95 || 0,
      ),
    );

    group.renderedMeans.push(
      Number(
        data.renderedMotionProxyPx
          ?.mean || 0,
      ),
    );

    group.renderedP95s.push(
      Number(
        data.renderedMotionProxyPx
          ?.p95 || 0,
      ),
    );

    group.suppressions.push(
      Number(
        data.geometrySuppressionRatio ||
          0,
      ),
    );

    group.renderedVsGeometry.push(
      Number(
        data.renderedVsGeometryRatio ||
          0,
      ),
    );
  }

  const byThreshold =
    Array.from(
      groups.values(),
    )
      .map((group) => ({
        thresholdPx:
          group.thresholdPx,
        sampleCount:
          group.heldRatios.length,
        heldRatioMean:
          mean(
            group.heldRatios,
          ),
        changedRatioMean:
          mean(
            group.changedRatios,
          ),
        decisionDistanceMeanPx:
          mean(
            group.decisionMeans,
          ),
        decisionDistanceP95MeanPx:
          mean(
            group.decisionP95s,
          ),
        inputMotionMeanPx:
          mean(
            group.inputMeans,
          ),
        geometryOutputMotionMeanPx:
          mean(
            group.outputMeans,
          ),
        geometryOutputMotionP95Px:
          percentileValue(
            group.outputP95s,
            0.95,
          ),
        geometrySuppressionRatioMean:
          mean(
            group.suppressions,
          ),
        renderedMotionProxyMeanPx:
          mean(
            group.renderedMeans,
          ),
        renderedMotionProxyP95Px:
          percentileValue(
            group.renderedP95s,
            0.95,
          ),
        renderedVsGeometryRatioMean:
          mean(
            group.renderedVsGeometry,
          ),
      }))
      .sort(
        (a, b) =>
          a.thresholdPx -
          b.thresholdPx,
      );

  return {
    effectEventCount:
      effects.length,
    configChangeCount:
      configChanges.length,
    configChanges:
      configChanges.map(
        (record) => ({
          perfMs:
            Number(
              record.perfMs || 0,
            ),
          wallTime:
            record.wallTime || null,
          ...(record.data || {}),
        }),
      ),
    currentThresholdPx:
      effects.length > 0
        ? Number(
            effects[
              effects.length - 1
            ]?.data?.thresholdPx ||
              0,
          )
        : 0,
    byThreshold,
  };
}

function buildDiagnosticSummary(
  sessionId,
  records,
) {
  const pointDeadband =
    buildPointDeadbandSummary(
      records,
    );

  const evaluations =
    records.filter(
      (record) =>
        record?.type ===
          'gate_evaluation' &&
        record?.data?.gate,
    );

  const tuningEvents =
    records.filter(
      (record) =>
        record?.type ===
        'auto_tune',
    );

  const convergenceEvents =
    records.filter(
      (record) =>
        record?.type ===
        'calibration_converged',
    );

  if (
    evaluations.length === 0
  ) {
    return {
      sessionId,
      evaluationCount: 0,
      pointDeadband,
      diagnosis: [
        'NO_GATE_EVALUATIONS',
      ],
    };
  }

  const first =
    evaluations[0];

  const last =
    evaluations[
      evaluations.length - 1
    ];

  const durationSeconds =
    Math.max(
      0.001,
      (
        Number(last.perfMs) -
        Number(first.perfMs)
      ) / 1000,
    );

  const evaluationGapsMs = [];

  for (
    let i = 1;
    i < evaluations.length;
    i++
  ) {
    const gap =
      Number(evaluations[i].perfMs) -
      Number(evaluations[i - 1].perfMs);

    if (
      Number.isFinite(gap) &&
      gap > 0
    ) {
      evaluationGapsMs.push(gap);
    }
  }

  // Long pauses, tab suspension and face-loss intervals must not be counted as
  // active verification time. The previous summary divided by wall-clock
  // duration and could falsely report VERIFICATION_RATE_LOW.
  const activeEvaluationGapsMs =
    evaluationGapsMs.filter(
      (gap) => gap <= 500,
    );

  const activeEvaluationSeconds =
    Math.max(
      0.001,
      activeEvaluationGapsMs.reduce(
        (sum, gap) =>
          sum + gap,
        0,
      ) / 1000,
    );

  let acceptedCount = 0;
  let staticCount = 0;
  let staticAcceptedCount = 0;
  let expressionEventCount = 0;
  let expressionCapturedCount = 0;
  let rigidEventCount = 0;
  let rigidCapturedCount = 0;

  const reasons = {};
  const thresholds = [];
  const expressionThresholds = [];
  const noiseFloors = [];
  const expressionNoiseFloors = [];
  const trackerFpsValues = [];
  const rigidSignals = [];
  const expressionSignals = [];
  const suppressedRigidSignals = [];
  const holdDurationsMs = [];
  const heldRigidSignals = [];

  for (
    const record of
    evaluations
  ) {
    const data =
      record.data || {};

    const gate =
      data.gate || {};

    const accepted =
      Boolean(gate.accepted);

    if (accepted) {
      acceptedCount++;
    }

    const reason =
      String(
        gate.decisionReason ||
        'unknown',
      );

    reasons[reason] =
      (reasons[reason] || 0) + 1;

    const threshold =
      Number(
        gate.decisionThresholdPx ??
        gate.thresholdPx ??
        0,
      );

    const expressionThreshold =
      Number(
        gate.decisionExpressionThresholdPx ??
        gate.expressionThresholdPx ??
        0,
      );

    const rigidSignal =
      Number(
        gate.rigidSignalPx || 0,
      );

    const expressionSignal =
      Number(
        gate.expressionSignalPx || 0,
      );

    thresholds.push(
      Number(gate.thresholdPx || 0),
    );

    expressionThresholds.push(
      Number(
        gate.expressionThresholdPx ||
        0,
      ),
    );

    noiseFloors.push(
      Number(
        gate.noiseFloorPx || 0,
      ),
    );

    expressionNoiseFloors.push(
      Number(
        gate.expressionNoiseFloorPx ||
        0,
      ),
    );

    rigidSignals.push(
      rigidSignal,
    );

    expressionSignals.push(
      expressionSignal,
    );

    if (
      Number.isFinite(
        Number(data.trackerFps),
      )
    ) {
      trackerFpsValues.push(
        Number(data.trackerFps),
      );
    }

    if (!accepted) {
      const holdMs =
        Number(
          gate.timeSinceLastAcceptMs ||
          0,
        );

      if (holdMs > 0) {
        holdDurationsMs.push(
          holdMs,
        );
      }

      heldRigidSignals.push(
        rigidSignal,
      );
    }

    if (gate.staticLikely) {
      staticCount++;

      if (accepted) {
        staticAcceptedCount++;
      } else {
        suppressedRigidSignals.push(
          rigidSignal,
        );
      }
    }

    const expressionEvent =
      expressionSignal >=
      expressionThreshold;

    if (expressionEvent) {
      expressionEventCount++;

      if (accepted) {
        expressionCapturedCount++;
      }
    }

    const rigidEvent =
      rigidSignal >= threshold;

    if (rigidEvent) {
      rigidEventCount++;

      if (accepted) {
        rigidCapturedCount++;
      }
    }
  }

  const requestedVerificationHz =
    Number(
      last.data?.gate
        ?.verificationHz || 0,
    );

  const trackerFpsMean =
    mean(
      trackerFpsValues,
    );

  const possibleEvaluationHz =
    Math.min(
      requestedVerificationHz ||
        Number.POSITIVE_INFINITY,
      trackerFpsMean ||
        Number.POSITIVE_INFINITY,
    );

  const actualEvaluationHz =
    evaluations.length /
    durationSeconds;

  const activeEvaluationHz =
    activeEvaluationGapsMs.length > 0
      ? activeEvaluationGapsMs.length /
        activeEvaluationSeconds
      : actualEvaluationHz;

  const maxHoldMs =
    maxValue(
      holdDurationsMs,
    );

  const maxHeldRigidSignalPx =
    maxValue(
      heldRigidSignals,
    );

  const outputUpdateHz =
    acceptedCount /
    durationSeconds;

  const staticFalseAcceptRate =
    staticCount > 0
      ? staticAcceptedCount /
        staticCount
      : 0;

  const expressionCaptureRate =
    expressionEventCount > 0
      ? expressionCapturedCount /
        expressionEventCount
      : 1;

  const rigidCaptureRate =
    rigidEventCount > 0
      ? rigidCapturedCount /
        rigidEventCount
      : 1;

  const lastGate =
    last.data?.gate || {};

  const diagnosis = [];

  if (
    evaluations.length < 20
  ) {
    diagnosis.push(
      'SHORT_SESSION',
    );
  }

  if (
    Number(
      lastGate
        .autoTuneConfidence || 0,
    ) < 0.6
  ) {
    diagnosis.push(
      'TUNING_STILL_LEARNING',
    );
  }

  if (
    staticCount >= 5 &&
    staticFalseAcceptRate > 0.1
  ) {
    diagnosis.push(
      'STATIC_FALSE_ACCEPT_HIGH',
    );
  }

  if (
    expressionEventCount >= 3 &&
    expressionCaptureRate < 0.98
  ) {
    diagnosis.push(
      'EXPRESSION_CAPTURE_LOW',
    );
  }

  if (
    Number.isFinite(
      possibleEvaluationHz,
    ) &&
    possibleEvaluationHz > 0 &&
    activeEvaluationHz <
      possibleEvaluationHz * 0.75
  ) {
    diagnosis.push(
      'VERIFICATION_RATE_LOW',
    );
  }

  if (
    outputUpdateHz > 8 &&
    staticFalseAcceptRate > 0.1
  ) {
    diagnosis.push(
      'OUTPUT_UPDATE_RATE_HIGH',
    );
  }

  if (
    maxHoldMs > 350 &&
    maxHeldRigidSignalPx > 3
  ) {
    diagnosis.push(
      'FOLLOW_LAG_HIGH',
    );
  }

  const deadbandGroups =
    pointDeadband.byThreshold || [];

  const latestDeadbandGroup =
    deadbandGroups.length > 0
      ? deadbandGroups[
          deadbandGroups.length - 1
        ]
      : null;

  if (
    latestDeadbandGroup &&
    latestDeadbandGroup.heldRatioMean >
      0.5 &&
    latestDeadbandGroup
      .geometrySuppressionRatioMean <
      0.1
  ) {
    diagnosis.push(
      'DEADBAND_NOT_AFFECTING_GEOMETRY',
    );
  }

  if (
    latestDeadbandGroup &&
    latestDeadbandGroup
      .geometrySuppressionRatioMean >
      0.3 &&
    latestDeadbandGroup
      .renderedMotionProxyMeanPx >
      Math.max(
        0.5,
        latestDeadbandGroup
          .geometryOutputMotionMeanPx *
          2,
      )
  ) {
    diagnosis.push(
      'POSE_DOMINATES_VISIBLE_MOTION',
    );
  }

  if (
    diagnosis.length === 0
  ) {
    diagnosis.push(
      'NO_OBVIOUS_GATE_FAILURE',
    );
  }

  return {
    sessionId,
    durationSeconds,
    evaluationCount:
      evaluations.length,
    autoTuneEventCount:
      tuningEvents.length,
    calibrationConverged:
      convergenceEvents.length > 0,
    calibration:
      convergenceEvents.length > 0
        ? convergenceEvents[
            convergenceEvents.length - 1
          ]?.data?.calibration ?? null
        : null,
    acceptedCount,
    acceptanceRate:
      acceptedCount /
      evaluations.length,
    actualEvaluationHz,
    activeEvaluationHz,
    requestedVerificationHz,
    trackerFpsMean,
    outputUpdateHz,
    maxHoldMs,
    maxHeldRigidSignalPx,
    reasons,
    static: {
      sampleCount: staticCount,
      acceptedCount:
        staticAcceptedCount,
      falseAcceptRate:
        staticFalseAcceptRate,
      meanSuppressedRigidSignalPx:
        mean(
          suppressedRigidSignals,
        ),
    },
    expression: {
      eventCount:
        expressionEventCount,
      capturedCount:
        expressionCapturedCount,
      captureRate:
        expressionCaptureRate,
      signalMeanPx:
        mean(
          expressionSignals,
        ),
      signalMaxPx:
        maxValue(
          expressionSignals,
        ),
    },
    rigidMotion: {
      eventCount:
        rigidEventCount,
      capturedCount:
        rigidCapturedCount,
      captureRate:
        rigidCaptureRate,
      signalMeanPx:
        mean(
          rigidSignals,
        ),
      signalMaxPx:
        maxValue(
          rigidSignals,
        ),
    },
    threshold: {
      startPx:
        thresholds[0] || 0,
      endPx:
        thresholds[
          thresholds.length - 1
        ] || 0,
      minPx:
        minValue(thresholds),
      maxPx:
        maxValue(thresholds),
      targetEndPx:
        Number(
          lastGate
            .targetThresholdPx || 0,
        ),
      noiseFloorEndPx:
        Number(
          lastGate
            .noiseFloorPx || 0,
        ),
    },
    expressionThreshold: {
      startPx:
        expressionThresholds[0] ||
        0,
      endPx:
        expressionThresholds[
          expressionThresholds.length -
            1
        ] || 0,
      minPx:
        minValue(
          expressionThresholds,
        ),
      maxPx:
        maxValue(
          expressionThresholds,
        ),
      targetEndPx:
        Number(
          lastGate
            .targetExpressionThresholdPx ||
          0,
        ),
      noiseFloorEndPx:
        Number(
          lastGate
            .expressionNoiseFloorPx ||
          0,
        ),
    },
    pointDeadband,
    autoTune: {
      enabled:
        Boolean(
          lastGate
            .autoTuningEnabled,
        ),
      confidence:
        Number(
          lastGate
            .autoTuneConfidence || 0,
        ),
      staticAcceptRate:
        Number(
          lastGate
            .staticAcceptRate || 0,
        ),
      outputUpdateRate:
        Number(
          lastGate
            .outputUpdateRate || 0,
        ),
    },
    diagnosis,
  };
}

async function handleDebugSummary(
  pathname,
  res,
) {
  const match =
    pathname.match(
      /^\/__mask-debug\/session\/([A-Za-z0-9_-]{16,80})\/summary\.json$/,
    );

  if (!match) {
    return false;
  }

  const sessionId =
    match[1];

  const records =
    await loadRecords(
      sessionId,
    );

  if (!records) {
    sendJson(res, 404, {
      ok: false,
      error:
        'debug session not found',
    });
    return true;
  }

  sendJson(
    res,
    200,
    buildDiagnosticSummary(
      sessionId,
      records,
    ),
  );

  return true;
}

async function handleLatestDebugStatus(
  pathname,
  res,
) {
  if (
    pathname !==
    '/__mask-debug/latest/status.json'
  ) {
    return false;
  }

  const latestSessionId =
    getLatestSessionId();

  if (!latestSessionId) {
    sendJson(
      res,
      200,
      {
        ok: true,
        runtimeVersion:
          MASK_RUNTIME_VERSION,
        railwayCommitSha:
          process.env
            .RAILWAY_GIT_COMMIT_SHA ||
          null,
        latestSession:
          null,
        message:
          'No diagnostic session exists on this deployment yet.',
      },
    );

    return true;
  }

  const records =
    await loadRecords(
      latestSessionId,
    );

  if (!records) {
    sendJson(
      res,
      404,
      {
        ok: false,
        error:
          'latest debug session disappeared',
      },
    );

    return true;
  }

  const sessionStart =
    records.find(
      (record) =>
        record?.type ===
        'session_start',
    );

  const runtimeProbe =
    [...records]
      .reverse()
      .find(
        (record) =>
          record?.type ===
          'runtime_probe',
      );

  const deadbandEffects =
    records.filter(
      (record) =>
        record?.type ===
        'point_deadband_effect',
    );

  const deadbandConfigChanges =
    records.filter(
      (record) =>
        record?.type ===
        'point_deadband_config_change',
    );

  const oneEuroConfigChanges =
    records.filter(
      (record) =>
        record?.type ===
        'one_euro_config_change',
    );

  const clientRuntimeVersion =
    sessionStart?.data
      ?.runtimeVersion ??
    runtimeProbe?.data
      ?.clientRuntimeVersion ??
    null;

  const pointDeadband =
    buildPointDeadbandSummary(
      records,
    );

  sendJson(
    res,
    200,
    {
      ok: true,
      runtimeVersion:
        MASK_RUNTIME_VERSION,
      railwayCommitSha:
        process.env
          .RAILWAY_GIT_COMMIT_SHA ||
        null,
      features:
        MASK_RUNTIME_FEATURES,
      latestSession: {
        sessionId:
          latestSessionId,
        clientRuntimeVersion,
        clientMatchesServer:
          clientRuntimeVersion ===
          MASK_RUNTIME_VERSION,
        staleClientDetected:
          clientRuntimeVersion !==
          MASK_RUNTIME_VERSION,
        recordCount:
          records.length,
        runtimeProbe:
          runtimeProbe?.data ??
          null,
        pointDeadbandEffectCount:
          deadbandEffects.length,
        pointDeadbandConfigChangeCount:
          deadbandConfigChanges.length,
        oneEuroConfigChangeCount:
          oneEuroConfigChanges.length,
        lastOneEuroConfigChange:
          oneEuroConfigChanges.length > 0
            ? oneEuroConfigChanges[
                oneEuroConfigChanges.length - 1
              ]?.data ?? null
            : null,
        lastPointDeadbandEffect:
          deadbandEffects.length > 0
            ? deadbandEffects[
                deadbandEffects.length - 1
              ]?.data ?? null
            : null,
        lastPointDeadbandConfigChange:
          deadbandConfigChanges.length > 0
            ? deadbandConfigChanges[
                deadbandConfigChanges.length - 1
              ]?.data ?? null
            : null,
        pointDeadband,
        effectLoggingActive:
          deadbandEffects.length > 0,
        sliderChangeLoggingActive:
          deadbandConfigChanges.length > 0,
        oneEuroSliderChangeLoggingActive:
          oneEuroConfigChanges.length > 0,
      },
    },
  );

  return true;
}

async function handleDebugDownload(
  pathname,
  res,
) {
  const match =
    pathname.match(
      /^\/__mask-debug\/session\/([A-Za-z0-9_-]{16,80})\.ndjson$/,
    );

  if (!match) {
    return false;
  }

  const sessionId = match[1];
  const filePath =
    getLogPath(sessionId);

  if (!existsSync(filePath)) {
    sendJson(res, 404, {
      ok: false,
      error: 'debug session not found',
    });
    return true;
  }

  const stat = statSync(filePath);

  res.writeHead(200, {
    'content-type':
      'application/x-ndjson; charset=utf-8',
    'content-length': stat.size,
    'content-disposition':
      `attachment; filename="mask-debug-${sessionId}.ndjson"`,
    'cache-control': 'no-store',
  });

  createReadStream(filePath).pipe(res);
  return true;
}

function resolveStaticPath(pathname) {
  let relativePath;

  try {
    relativePath =
      decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (
    relativePath === '/' ||
    relativePath === ''
  ) {
    relativePath = '/index.html';
  }

  const normalized =
    path.normalize(relativePath)
      .replace(
        /^(\.\.(\/|\\|$))+/,
        '',
      );

  const absolutePath =
    path.resolve(
      DIST_DIR,
      `.${normalized}`,
    );

  if (
    !absolutePath.startsWith(
      path.resolve(DIST_DIR),
    )
  ) {
    return null;
  }

  return absolutePath;
}

function serveFile(
  filePath,
  res,
  cache = true,
) {
  if (
    !filePath ||
    !existsSync(filePath) ||
    !statSync(filePath).isFile()
  ) {
    return false;
  }

  const ext =
    path.extname(filePath)
      .toLowerCase();

  const stat =
    statSync(filePath);

  const sdkRoot =
    path.join(
      DIST_DIR,
      'sdk',
    ) + path.sep;

  const isSdkAsset =
    filePath.startsWith(
      sdkRoot,
    );

  res.writeHead(200, {
    'content-type':
      MIME_TYPES[ext] ||
      'application/octet-stream',
    'content-length': stat.size,
    'cache-control':
      cache
        ? 'public, max-age=3600'
        : 'no-cache',
    ...(isSdkAsset
      ? {
          'access-control-allow-origin':
            '*',
          'cross-origin-resource-policy':
            'cross-origin',
        }
      : {}),
  });

  createReadStream(filePath).pipe(res);
  return true;
}

const server =
  http.createServer(
    async (req, res) => {
      const url = new URL(
        req.url || '/',
        `http://${req.headers.host || 'localhost'}`,
      );

      const crossOriginSdkRequest =
        url.pathname.startsWith(
          '/sdk/',
        );

      const crossOriginDiagnosticRequest =
        url.pathname ===
          '/__runtime-probe' ||
        url.pathname.startsWith(
          '/__mask-debug/',
        );

      if (
        crossOriginSdkRequest ||
        crossOriginDiagnosticRequest
      ) {
        res.setHeader(
          'access-control-allow-origin',
          '*',
        );
        res.setHeader(
          'cross-origin-resource-policy',
          'cross-origin',
        );
      }

      if (
        req.method === 'OPTIONS' &&
        crossOriginDiagnosticRequest
      ) {
        res.writeHead(204, {
          'access-control-allow-origin':
            '*',
          'access-control-allow-methods':
            'GET,POST,OPTIONS',
          'access-control-allow-headers':
            'content-type',
          'access-control-max-age':
            '86400',
        });
        res.end();
        return;
      }

      if (
        req.method === 'GET' &&
        url.pathname ===
          '/__runtime-probe'
      ) {
        sendJson(
          res,
          200,
          {
            ok: true,
            runtimeVersion:
              MASK_RUNTIME_VERSION,
            railwayCommitSha:
              process.env
                .RAILWAY_GIT_COMMIT_SHA ||
              null,
            railwayDeploymentId:
              process.env
                .RAILWAY_DEPLOYMENT_ID ||
              null,
            features:
              MASK_RUNTIME_FEATURES,
          },
        );
        return;
      }

      if (
        req.method === 'GET' &&
        url.pathname ===
          '/__mask-debug/health'
      ) {
        sendJson(res, 200, {
          ok: true,
          storage: LOG_DIR,
          summaryEndpoint:
            '/__mask-debug/session/<sessionId>/summary.json',
        });
        return;
      }

      if (
        req.method === 'POST' &&
        url.pathname ===
          '/__mask-debug/log'
      ) {
        await handleDebugPost(
          req,
          res,
        );
        return;
      }

      if (req.method === 'GET') {
        if (
          await handleLatestDebugStatus(
            url.pathname,
            res,
          )
        ) {
          return;
        }

        if (
          await handleDebugSummary(
            url.pathname,
            res,
          )
        ) {
          return;
        }

        if (
          await handleDebugDownload(
            url.pathname,
            res,
          )
        ) {
          return;
        }
      }

      if (
        req.method !== 'GET' &&
        req.method !== 'HEAD'
      ) {
        sendJson(res, 405, {
          ok: false,
          error: 'method not allowed',
        });
        return;
      }

      const requestedPath =
        resolveStaticPath(
          url.pathname,
        );

      if (
        requestedPath &&
        serveFile(
          requestedPath,
          res,
          url.pathname !== '/',
        )
      ) {
        return;
      }

      const indexPath =
        path.join(
          DIST_DIR,
          'index.html',
        );

      if (
        serveFile(
          indexPath,
          res,
          false,
        )
      ) {
        return;
      }

      sendJson(res, 404, {
        ok: false,
        error:
          'frontend build not found',
      });
    },
  );

function runStartupEndpointSelfTest() {
  const paths = [
    '/__runtime-probe',
    '/__mask-debug/latest/status.json',
  ];

  for (const pathname of paths) {
    const request =
      http.get(
        {
          host: '127.0.0.1',
          port: PORT,
          path: pathname,
          headers: {
            host: `127.0.0.1:${PORT}`,
          },
        },
        (response) => {
          const chunks = [];

          response.on(
            'data',
            (chunk) => {
              chunks.push(chunk);
            },
          );

          response.on(
            'end',
            () => {
              const body =
                Buffer.concat(
                  chunks,
                ).toString(
                  'utf8',
                );

              console.log(
                '[mask-endpoint-selftest]',
                JSON.stringify({
                  path: pathname,
                  statusCode:
                    response.statusCode,
                  body:
                    body.slice(
                      0,
                      1800,
                    ),
                }),
              );
            },
          );
        },
      );

    request.on(
      'error',
      (error) => {
        console.error(
          '[mask-endpoint-selftest]',
          JSON.stringify({
            path: pathname,
            error:
              error instanceof Error
                ? error.message
                : String(error),
          }),
        );
      },
    );
  }
}

server.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `video-town-front listening on ${PORT}`,
    );
    console.log(
      `mask debug logs: ${LOG_DIR}`,
    );

    runStartupEndpointSelfTest();
  },
);
