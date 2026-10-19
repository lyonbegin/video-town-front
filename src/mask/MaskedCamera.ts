export type CameraMode = 'mask' | 'original';

export interface MaskedCameraController {
  stream: MediaStream;
  stop: () => void;
}

type Landmark = {
  x: number;
  y: number;
  z?: number;
};

type TrackedFace = {
  score: number;
  landmarks: Landmark[];
};

type FacePose = {
  cx: number;
  cy: number;
  width: number;
  height: number;
  rotation: number;
};

type FilteredPose = FacePose & {
  vx: number;
  vy: number;
  rawCx: number;
  rawCy: number;
  lastMeasurementAt: number;
};

type FacemeshApi = {
  detect: (source: HTMLCanvasElement) => Promise<TrackedFace[]>;
  reset: () => void;
  dispose: () => void;
};

type MicroFacemeshModule = {
  createFacemesh: (options?: {
    weightsUrl?: string;
    scoreThreshold?: number;
    faceScoreThreshold?: number;
    maxFaces?: number;
  }) => Promise<FacemeshApi>;
};

type VideoFrameMetadataLite = {
  presentationTime?: number;
  mediaTime?: number;
};

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    callback: (now: number, metadata: VideoFrameMetadataLite) => void,
  ) => number;
  cancelVideoFrameCallback?: (id: number) => void;
};

const MICRO_FACEMESH_MODULE =
  'https://cdn.jsdelivr.net/npm/@svenflow/micro-facemesh@0.1.2/+esm';

const MICRO_FACEMESH_WEIGHTS =
  'https://cdn.jsdelivr.net/npm/@svenflow/micro-facemesh@0.1.2/weights';

// Stable landmarks. Width/height no longer comes from min/max of all 478 points.
const LEFT_FACE = 234;
const RIGHT_FACE = 454;
const FOREHEAD = 10;
const CHIN = 152;
const LEFT_EYE_OUTER = 33;
const RIGHT_EYE_OUTER = 263;

const INFERENCE_MAX_WIDTH = 512;
const INFERENCE_MAX_HEIGHT = 288;

// The tracker has sub-pixel landmark noise even when the head is still.
// Small motion is locked; large motion is allowed through quickly.
const POSITION_DEADBAND_X_RATIO = 0.012;
const POSITION_DEADBAND_Y_RATIO = 0.010;
const POSITION_TAU_SLOW_MS = 150;
const POSITION_TAU_FAST_MS = 24;
const POSITION_FAST_RATIO = 0.10;

const ROTATION_DEADBAND_RAD = 0.014;
const ROTATION_TAU_MS = 110;

const SIZE_TAU_MS = 220;
const SIZE_DEADBAND = 0.020;
const MAX_SIZE_CHANGE_PER_MEASUREMENT = 0.022;

const VELOCITY_BLEND = 0.26;
const PREDICTION_MIN_SPEED_RATIO_PER_MS = 0.00055;

// Prediction is only used for deliberate movement. It is disabled while the
// face is effectively stationary so landmark noise cannot become visible drift.
const MAX_PREDICTION_MS = 70;
const MAX_PREDICTION_FACE_RATIO = 0.10;

let facemeshPromise: Promise<FacemeshApi> | undefined;

function hasWebGpu(): boolean {
  return Boolean((navigator as Navigator & { gpu?: unknown }).gpu);
}

async function getFacemesh(): Promise<FacemeshApi> {
  if (!hasWebGpu()) {
    throw new Error(
      '복면 모드는 WebGPU가 필요합니다. Chrome/Edge 113+ 또는 Safari 18+에서 실행해주세요.',
    );
  }

  if (!facemeshPromise) {
    facemeshPromise = (async () => {
      const moduleUrl = MICRO_FACEMESH_MODULE;
      const mod = (await import(
        /* @vite-ignore */ moduleUrl
      )) as MicroFacemeshModule;

      return mod.createFacemesh({
        weightsUrl: MICRO_FACEMESH_WEIGHTS,
        scoreThreshold: 0.5,
        faceScoreThreshold: 0.5,
        maxFaces: 1,
      });
    })();
  }

  return facemeshPromise;
}

function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('카메라 영상 초기화 시간이 초과되었습니다.'));
    }, 10000);

    const onReady = () => {
      if (video.videoWidth <= 0 || video.videoHeight <= 0) return;
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error('카메라 영상을 초기화하지 못했습니다.'));
    };

    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener('loadedmetadata', onReady);
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('error', onError);
    };

    video.addEventListener('loadedmetadata', onReady);
    video.addEventListener('canplay', onReady);
    video.addEventListener('error', onError);
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function alphaFor(dtMs: number, tauMs: number): number {
  return 1 - Math.exp(-Math.max(1, dtMs) / tauMs);
}

function normalizeAngle(angle: number): number {
  let value = angle;

  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;

  return value;
}

function distancePx(
  a: Landmark,
  b: Landmark,
  outputWidth: number,
  outputHeight: number,
): number {
  const dx = (b.x - a.x) * outputWidth;
  const dy = (b.y - a.y) * outputHeight;
  return Math.hypot(dx, dy);
}

function poseFromLandmarks(
  face: TrackedFace,
  outputWidth: number,
  outputHeight: number,
): FacePose | undefined {
  const landmarks = face.landmarks;

  const left = landmarks[LEFT_FACE];
  const right = landmarks[RIGHT_FACE];
  const forehead = landmarks[FOREHEAD];
  const chin = landmarks[CHIN];
  const leftEye = landmarks[LEFT_EYE_OUTER];
  const rightEye = landmarks[RIGHT_EYE_OUTER];

  if (!left || !right || !forehead || !chin || !leftEye || !rightEye) {
    return undefined;
  }

  const horizontalCenterX = ((left.x + right.x) * 0.5) * outputWidth;
  const horizontalCenterY = ((left.y + right.y) * 0.5) * outputHeight;
  const verticalCenterX = ((forehead.x + chin.x) * 0.5) * outputWidth;
  const verticalCenterY = ((forehead.y + chin.y) * 0.5) * outputHeight;

  // Averaging the horizontal and vertical center pairs makes the center much
  // less sensitive to mouth/eyebrow expression than a 478-point bounding box.
  const cx = (horizontalCenterX + verticalCenterX) * 0.5;
  const cy = (horizontalCenterY + verticalCenterY) * 0.5;

  const faceWidth = distancePx(left, right, outputWidth, outputHeight);
  const faceHeight = distancePx(forehead, chin, outputWidth, outputHeight);

  if (
    !Number.isFinite(cx) ||
    !Number.isFinite(cy) ||
    !Number.isFinite(faceWidth) ||
    !Number.isFinite(faceHeight) ||
    faceWidth < 8 ||
    faceHeight < 8
  ) {
    return undefined;
  }

  const rotation = Math.atan2(
    (rightEye.y - leftEye.y) * outputHeight,
    (rightEye.x - leftEye.x) * outputWidth,
  );

  return {
    cx,
    cy,
    width: faceWidth,
    height: faceHeight,
    rotation,
  };
}

function softDeadband(delta: number, deadband: number): number {
  const magnitude = Math.abs(delta);

  if (magnitude <= deadband) {
    return 0;
  }

  return Math.sign(delta) * (magnitude - deadband);
}

function stabilizeSize(
  current: number,
  measured: number,
  dtMs: number,
): number {
  const safeCurrent = Math.max(1, current);
  const relativeChange = Math.abs(measured - current) / safeCurrent;

  // Ignore the tiny 1-2% landmark "breathing" that made the paper mask pump.
  if (relativeChange < SIZE_DEADBAND) {
    return current;
  }

  // Even on a real change, never allow one inference result to abruptly resize
  // the mask. The target can move only a small percentage per measurement.
  const maxStep = safeCurrent * MAX_SIZE_CHANGE_PER_MEASUREMENT;
  const limitedTarget =
    current + clamp(measured - current, -maxStep, maxStep);

  const alpha = alphaFor(dtMs, SIZE_TAU_MS);
  return current + (limitedTarget - current) * alpha;
}

function updateFilteredPose(
  current: FilteredPose | undefined,
  measured: FacePose,
  measurementAt: number,
): FilteredPose {
  if (!current) {
    return {
      ...measured,
      vx: 0,
      vy: 0,
      rawCx: measured.cx,
      rawCy: measured.cy,
      lastMeasurementAt: measurementAt,
    };
  }

  const dtMs = clamp(measurementAt - current.lastMeasurementAt, 8, 160);

  const deadX = Math.max(1.5, current.width * POSITION_DEADBAND_X_RATIO);
  const deadY = Math.max(1.5, current.height * POSITION_DEADBAND_Y_RATIO);

  // Lock the mask completely for tiny landmark movement instead of merely
  // smoothing it. This removes the visible left/right/up/down "buzz".
  const moveX = softDeadband(measured.cx - current.cx, deadX);
  const moveY = softDeadband(measured.cy - current.cy, deadY);

  const movementRatio = Math.hypot(
    moveX / Math.max(1, current.width),
    moveY / Math.max(1, current.height),
  );

  const fastMix = clamp(movementRatio / POSITION_FAST_RATIO, 0, 1);
  const positionTau =
    POSITION_TAU_SLOW_MS +
    (POSITION_TAU_FAST_MS - POSITION_TAU_SLOW_MS) * fastMix;
  const positionAlpha = alphaFor(dtMs, positionTau);

  const nextCx = current.cx + moveX * positionAlpha;
  const nextCy = current.cy + moveY * positionAlpha;

  // Compute velocity from consecutive raw measurements, not from the filtered
  // position. A deadband is applied again so sensor noise cannot generate
  // prediction movement while the face is stationary.
  const rawMoveX = softDeadband(
    measured.cx - current.rawCx,
    deadX * 0.75,
  );
  const rawMoveY = softDeadband(
    measured.cy - current.rawCy,
    deadY * 0.75,
  );

  let measuredVx = rawMoveX / dtMs;
  let measuredVy = rawMoveY / dtMs;

  const minVx = current.width * PREDICTION_MIN_SPEED_RATIO_PER_MS;
  const minVy = current.height * PREDICTION_MIN_SPEED_RATIO_PER_MS;

  if (Math.abs(measuredVx) < minVx) measuredVx = 0;
  if (Math.abs(measuredVy) < minVy) measuredVy = 0;

  const maxVelocity = Math.max(current.width, current.height) * 0.014;

  let vx = clamp(
    current.vx * (1 - VELOCITY_BLEND) + measuredVx * VELOCITY_BLEND,
    -maxVelocity,
    maxVelocity,
  );

  let vy = clamp(
    current.vy * (1 - VELOCITY_BLEND) + measuredVy * VELOCITY_BLEND,
    -maxVelocity,
    maxVelocity,
  );

  // Kill residual velocity quickly after the user stops moving.
  if (measuredVx === 0) vx *= 0.52;
  if (measuredVy === 0) vy *= 0.52;
  if (Math.abs(vx) < minVx * 0.65) vx = 0;
  if (Math.abs(vy) < minVy * 0.65) vy = 0;

  let rotationDelta = normalizeAngle(measured.rotation - current.rotation);

  if (Math.abs(rotationDelta) <= ROTATION_DEADBAND_RAD) {
    rotationDelta = 0;
  } else {
    rotationDelta =
      Math.sign(rotationDelta) *
      (Math.abs(rotationDelta) - ROTATION_DEADBAND_RAD);
  }

  const rotationAlpha = alphaFor(dtMs, ROTATION_TAU_MS);

  return {
    cx: nextCx,
    cy: nextCy,
    width: stabilizeSize(current.width, measured.width, dtMs),
    height: stabilizeSize(current.height, measured.height, dtMs),
    rotation: current.rotation + rotationDelta * rotationAlpha,
    vx,
    vy,
    rawCx: measured.cx,
    rawCy: measured.cy,
    lastMeasurementAt: measurementAt,
  };
}

function predictPose(current: FilteredPose, now: number): FacePose {
  const normalizedSpeed = Math.hypot(
    current.vx / Math.max(1, current.width),
    current.vy / Math.max(1, current.height),
  );

  // No extrapolation at low speed. Previously, tiny noisy velocity was
  // projected forward and was the main source of visible micro-shaking.
  const predictionEnabled =
    normalizedSpeed >= PREDICTION_MIN_SPEED_RATIO_PER_MS;

  const ageMs = predictionEnabled
    ? clamp(now - current.lastMeasurementAt, 0, MAX_PREDICTION_MS)
    : 0;

  let dx = current.vx * ageMs;
  let dy = current.vy * ageMs;

  const maxDx = current.width * MAX_PREDICTION_FACE_RATIO;
  const maxDy = current.height * MAX_PREDICTION_FACE_RATIO;

  dx = clamp(dx, -maxDx, maxDx);
  dy = clamp(dy, -maxDy, maxDy);

  return {
    // Pixel snapping removes sub-pixel anti-alias shimmer on the mask edge.
    cx: Math.round(current.cx + dx),
    cy: Math.round(current.cy + dy),
    width: Math.round(current.width * 2) / 2,
    height: Math.round(current.height * 2) / 2,
    rotation: current.rotation,
  };
}

function drawPaperMask(ctx: CanvasRenderingContext2D, pose: FacePose) {
  // Stable face landmarks already describe the actual face dimensions.
  // Keep only enough margin to cover the face fully.
  const width = pose.width * 1.22;
  const height = pose.height * 1.26;

  ctx.save();
  ctx.translate(pose.cx, pose.cy - pose.height * 0.015);
  ctx.rotate(pose.rotation);

  ctx.shadowColor = 'rgba(0, 0, 0, 0.30)';
  ctx.shadowBlur = Math.max(6, width * 0.035);
  ctx.shadowOffsetY = Math.max(2, height * 0.018);

  ctx.beginPath();
  ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#eee9dc';
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.lineWidth = Math.max(2, width * 0.010);
  ctx.strokeStyle = 'rgba(54, 49, 43, 0.76)';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, -height * 0.43);
  ctx.lineTo(0, height * 0.43);
  ctx.strokeStyle = 'rgba(116, 103, 86, 0.18)';
  ctx.lineWidth = Math.max(1, width * 0.005);
  ctx.stroke();

  ctx.fillStyle = '#191919';
  const eyeY = -height * 0.10;

  ctx.beginPath();
  ctx.ellipse(
    -width * 0.19,
    eyeY,
    width * 0.085,
    height * 0.027,
    -0.06,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(
    width * 0.19,
    eyeY,
    width * 0.085,
    height * 0.027,
    0.06,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, -height * 0.015);
  ctx.lineTo(-width * 0.025, height * 0.10);
  ctx.lineTo(width * 0.022, height * 0.10);
  ctx.strokeStyle = 'rgba(35, 35, 35, 0.62)';
  ctx.lineWidth = Math.max(1.5, width * 0.007);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-width * 0.12, height * 0.23);
  ctx.quadraticCurveTo(0, height * 0.27, width * 0.12, height * 0.23);
  ctx.strokeStyle = '#242424';
  ctx.lineWidth = Math.max(2, width * 0.009);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-width * 0.49, -height * 0.02);
  ctx.lineTo(-width * 0.60, 0);
  ctx.moveTo(width * 0.49, -height * 0.02);
  ctx.lineTo(width * 0.60, 0);
  ctx.strokeStyle = 'rgba(240, 240, 235, 0.90)';
  ctx.lineWidth = Math.max(2, width * 0.008);
  ctx.stroke();

  ctx.restore();
}

export async function createMaskedCameraStream(
  source: MediaStream,
): Promise<MaskedCameraController> {
  const sourceVideoTrack = source.getVideoTracks()[0];

  if (!sourceVideoTrack) {
    throw new Error('복면 모드에 사용할 카메라 트랙이 없습니다.');
  }

  if (!HTMLCanvasElement.prototype.captureStream) {
    throw new Error('현재 브라우저는 복면 영상 출력을 지원하지 않습니다.');
  }

  const facemesh = await getFacemesh();
  facemesh.reset();

  const video = document.createElement('video');
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.srcObject = new MediaStream([sourceVideoTrack]);

  await video.play().catch(() => undefined);
  await waitForVideoReady(video);

  const sourceWidth = video.videoWidth || 1280;
  const sourceHeight = video.videoHeight || 720;

  const outputScale = Math.min(1, 1280 / sourceWidth, 720 / sourceHeight);
  const outputWidth = Math.max(320, Math.round(sourceWidth * outputScale));
  const outputHeight = Math.max(240, Math.round(sourceHeight * outputScale));

  const inferenceScale = Math.min(
    1,
    INFERENCE_MAX_WIDTH / sourceWidth,
    INFERENCE_MAX_HEIGHT / sourceHeight,
  );

  const inferenceWidth = Math.max(256, Math.round(sourceWidth * inferenceScale));
  const inferenceHeight = Math.max(144, Math.round(sourceHeight * inferenceScale));

  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const ctx = canvas.getContext('2d', {
    alpha: false,
    desynchronized: true,
  });

  if (!ctx) {
    throw new Error('복면 렌더링 Canvas를 만들지 못했습니다.');
  }

  // Important performance change:
  // micro-facemesh receives a small canvas, not the 1280x720 video element.
  // Its own source shows HTMLVideoElement triggers createImageBitmap(), while
  // HTMLCanvasElement goes straight to GPU upload.
  const inferenceCanvas = document.createElement('canvas');
  inferenceCanvas.width = inferenceWidth;
  inferenceCanvas.height = inferenceHeight;

  const inferenceCtx = inferenceCanvas.getContext('2d', {
    alpha: false,
    desynchronized: true,
  });

  if (!inferenceCtx) {
    throw new Error('복면 추적용 Canvas를 만들지 못했습니다.');
  }

  const canvasStream = canvas.captureStream(30);
  const maskedVideoTrack = canvasStream.getVideoTracks()[0];

  if (!maskedVideoTrack) {
    throw new Error('복면 영상 트랙을 만들지 못했습니다.');
  }

  maskedVideoTrack.contentHint = 'motion';

  const output = new MediaStream([
    maskedVideoTrack,
    ...source.getAudioTracks(),
  ]);

  let stopped = false;
  let renderRaf = 0;
  let fallbackInferenceRaf = 0;
  let videoFrameCallbackId = 0;
  let detecting = false;
  let lastSubmittedAt: number | undefined;
  let hadFaceOnPreviousResult = false;
  let filteredPose: FilteredPose | undefined;

  const runInference = async (submittedAt: number) => {
    if (stopped || detecting) return;

    detecting = true;

    // In the normal micro-facemesh tracking path, detect() returns the previous
    // pipelined frame. Associate that result with the previous submission time.
    const measurementAt =
      hadFaceOnPreviousResult && lastSubmittedAt !== undefined
        ? lastSubmittedAt
        : submittedAt;

    lastSubmittedAt = submittedAt;

    try {
      const faces = await facemesh.detect(inferenceCanvas);
      const face = faces[0];

      if (!face || face.score < 0.1) {
        hadFaceOnPreviousResult = false;
        filteredPose = undefined;
        return;
      }

      hadFaceOnPreviousResult = true;

      const measured = poseFromLandmarks(face, outputWidth, outputHeight);

      if (!measured) {
        filteredPose = undefined;
        return;
      }

      filteredPose = updateFilteredPose(
        filteredPose,
        measured,
        measurementAt,
      );
    } catch (error) {
      console.warn('[mask] micro-facemesh tracking failed', error);
      filteredPose = undefined;
      hadFaceOnPreviousResult = false;
    } finally {
      detecting = false;
    }
  };

  const processVideoFrame = (now: number) => {
    if (stopped) return;

    if (!detecting && video.readyState >= 2) {
      inferenceCtx.drawImage(
        video,
        0,
        0,
        inferenceWidth,
        inferenceHeight,
      );

      void runInference(now);
    }
  };

  const frameVideo = video as VideoWithFrameCallback;

  if (frameVideo.requestVideoFrameCallback) {
    const onVideoFrame = (now: number, _metadata: VideoFrameMetadataLite) => {
      if (stopped) return;

      processVideoFrame(now);

      videoFrameCallbackId =
        frameVideo.requestVideoFrameCallback!(onVideoFrame);
    };

    videoFrameCallbackId =
      frameVideo.requestVideoFrameCallback(onVideoFrame);
  } else {
    // Fallback for browsers without requestVideoFrameCallback.
    let lastFallbackInferenceAt = 0;

    const fallbackInference = (now: number) => {
      if (stopped) return;

      if (now - lastFallbackInferenceAt >= 30) {
        lastFallbackInferenceAt = now;
        processVideoFrame(now);
      }

      fallbackInferenceRaf = requestAnimationFrame(fallbackInference);
    };

    fallbackInferenceRaf = requestAnimationFrame(fallbackInference);
  }

  const render = (now: number) => {
    if (stopped) return;

    ctx.drawImage(video, 0, 0, outputWidth, outputHeight);

    if (filteredPose) {
      drawPaperMask(ctx, predictPose(filteredPose, now));
    }

    renderRaf = requestAnimationFrame(render);
  };

  const stop = () => {
    if (stopped) return;

    stopped = true;

    if (renderRaf) cancelAnimationFrame(renderRaf);
    if (fallbackInferenceRaf) cancelAnimationFrame(fallbackInferenceRaf);

    if (videoFrameCallbackId && frameVideo.cancelVideoFrameCallback) {
      frameVideo.cancelVideoFrameCallback(videoFrameCallbackId);
    }

    video.pause();
    video.srcObject = null;

    source.getTracks().forEach((track) => {
      if (track.readyState !== 'ended') track.stop();
    });

    canvasStream.getTracks().forEach((track) => {
      if (track.readyState !== 'ended') track.stop();
    });

    try {
      facemesh.reset();
    } catch {
      // Camera switching must not be blocked by tracker cleanup.
    }
  };

  maskedVideoTrack.addEventListener('ended', stop, { once: true });
  sourceVideoTrack.addEventListener('ended', stop, { once: true });

  renderRaf = requestAnimationFrame(render);

  return {
    stream: output,
    stop,
  };
}
