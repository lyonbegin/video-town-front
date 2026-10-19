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

type OneEuroFilterApi = {
  filter: (value: number, timestamp?: number) => number;
  reset: () => void;
};

type OneEuroFilterConstructor = new (
  freq: number,
  mincutoff?: number,
  beta?: number,
  dcutoff?: number,
) => OneEuroFilterApi;

type OneEuroFilterModule = {
  OneEuroFilter: OneEuroFilterConstructor;
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

const ONE_EURO_MODULE =
  'https://cdn.jsdelivr.net/npm/1eurofilter@1.3.0/+esm';

const LEFT_FACE = 234;
const RIGHT_FACE = 454;
const FOREHEAD = 10;
const CHIN = 152;
const LEFT_EYE_OUTER = 33;
const RIGHT_EYE_OUTER = 263;

const INFERENCE_MAX_WIDTH = 512;
const INFERENCE_MAX_HEIGHT = 288;
const FILTER_FREQUENCY = 30;

// One Euro Filter parameters.
// Position: strong jitter suppression at rest, cutoff opens quickly with motion.
// Scale: intentionally much steadier than position.
// Rotation: moderate smoothing with adaptive response.
const POSITION_MIN_CUTOFF = 0.8;
const POSITION_BETA = 12.0;
const SCALE_MIN_CUTOFF = 0.35;
const SCALE_BETA = 1.5;
const ROTATION_MIN_CUTOFF = 0.8;
const ROTATION_BETA = 4.0;
const DERIVATIVE_CUTOFF = 1.0;

let facemeshPromise: Promise<FacemeshApi> | undefined;
let oneEuroModulePromise: Promise<OneEuroFilterModule> | undefined;

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

async function getOneEuroModule(): Promise<OneEuroFilterModule> {
  if (!oneEuroModulePromise) {
    oneEuroModulePromise = (async () => {
      const moduleUrl = ONE_EURO_MODULE;
      return (await import(
        /* @vite-ignore */ moduleUrl
      )) as OneEuroFilterModule;
    })();
  }

  return oneEuroModulePromise;
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

  const cx = (horizontalCenterX + verticalCenterX) * 0.5;
  const cy = (horizontalCenterY + verticalCenterY) * 0.5;

  const width = distancePx(left, right, outputWidth, outputHeight);
  const height = distancePx(forehead, chin, outputWidth, outputHeight);

  if (
    !Number.isFinite(cx) ||
    !Number.isFinite(cy) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 8 ||
    height < 8
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
    width,
    height,
    rotation,
  };
}

function drawPaperMask(ctx: CanvasRenderingContext2D, pose: FacePose) {
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

  const [facemesh, oneEuro] = await Promise.all([
    getFacemesh(),
    getOneEuroModule(),
  ]);

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

  const { OneEuroFilter } = oneEuro;

  const filterX = new OneEuroFilter(
    FILTER_FREQUENCY,
    POSITION_MIN_CUTOFF,
    POSITION_BETA,
    DERIVATIVE_CUTOFF,
  );
  const filterY = new OneEuroFilter(
    FILTER_FREQUENCY,
    POSITION_MIN_CUTOFF,
    POSITION_BETA,
    DERIVATIVE_CUTOFF,
  );
  const filterWidth = new OneEuroFilter(
    FILTER_FREQUENCY,
    SCALE_MIN_CUTOFF,
    SCALE_BETA,
    DERIVATIVE_CUTOFF,
  );
  const filterHeight = new OneEuroFilter(
    FILTER_FREQUENCY,
    SCALE_MIN_CUTOFF,
    SCALE_BETA,
    DERIVATIVE_CUTOFF,
  );
  const filterRotation = new OneEuroFilter(
    FILTER_FREQUENCY,
    ROTATION_MIN_CUTOFF,
    ROTATION_BETA,
    DERIVATIVE_CUTOFF,
  );

  const resetFilters = () => {
    filterX.reset();
    filterY.reset();
    filterWidth.reset();
    filterHeight.reset();
    filterRotation.reset();
  };

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
  let hadTrackedFace = false;
  let filteredPose: FacePose | undefined;

  const runInference = async (submittedAt: number) => {
    if (stopped || detecting) return;

    detecting = true;

    // micro-facemesh's tracked path returns the previous pipelined result.
    // Feed One Euro with that result's measurement time, not render time.
    const measurementAt =
      hadTrackedFace && lastSubmittedAt !== undefined
        ? lastSubmittedAt
        : submittedAt;

    lastSubmittedAt = submittedAt;

    try {
      const faces = await facemesh.detect(inferenceCanvas);
      const face = faces[0];

      if (!face || face.score < 0.1) {
        hadTrackedFace = false;
        filteredPose = undefined;
        resetFilters();
        return;
      }

      const measured = poseFromLandmarks(face, outputWidth, outputHeight);

      if (!measured) {
        filteredPose = undefined;
        resetFilters();
        return;
      }

      hadTrackedFace = true;

      const timestampSeconds = measurementAt / 1000;

      // Filter normalized values so the One Euro parameters remain independent
      // of camera resolution.
      const cx = filterX.filter(
        measured.cx / outputWidth,
        timestampSeconds,
      ) * outputWidth;

      const cy = filterY.filter(
        measured.cy / outputHeight,
        timestampSeconds,
      ) * outputHeight;

      const width = filterWidth.filter(
        measured.width / outputWidth,
        timestampSeconds,
      ) * outputWidth;

      const height = filterHeight.filter(
        measured.height / outputHeight,
        timestampSeconds,
      ) * outputHeight;

      const rotation = filterRotation.filter(
        measured.rotation,
        timestampSeconds,
      );

      filteredPose = {
        cx,
        cy,
        width,
        height,
        rotation,
      };
    } catch (error) {
      console.warn('[mask] tracking/filtering failed', error);
      filteredPose = undefined;
      hadTrackedFace = false;
      resetFilters();
    } finally {
      detecting = false;
    }
  };

  const processVideoFrame = (now: number) => {
    if (stopped || detecting || video.readyState < 2) return;

    inferenceCtx.drawImage(
      video,
      0,
      0,
      inferenceWidth,
      inferenceHeight,
    );

    void runInference(now);
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

  const render = () => {
    if (stopped) return;

    ctx.drawImage(video, 0, 0, outputWidth, outputHeight);

    if (filteredPose) {
      drawPaperMask(ctx, filteredPose);
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

    resetFilters();

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
