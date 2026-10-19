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
  detect: (source: HTMLVideoElement) => Promise<TrackedFace[]>;
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

const MICRO_FACEMESH_MODULE =
  'https://cdn.jsdelivr.net/npm/@svenflow/micro-facemesh@0.1.2/+esm';

const MICRO_FACEMESH_WEIGHTS =
  'https://cdn.jsdelivr.net/npm/@svenflow/micro-facemesh@0.1.2/weights';

const LEFT_EYE_OUTER = 33;
const RIGHT_EYE_OUTER = 263;

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

function normalizeRoll(angle: number): number {
  let value = angle;

  while (value > Math.PI / 2) value -= Math.PI;
  while (value < -Math.PI / 2) value += Math.PI;

  return value;
}

function poseFromLandmarks(
  face: TrackedFace,
  outputWidth: number,
  outputHeight: number,
): FacePose | undefined {
  const landmarks = face.landmarks;

  if (!landmarks || landmarks.length < 264) {
    return undefined;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of landmarks) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;

    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY) ||
    maxX <= minX ||
    maxY <= minY
  ) {
    return undefined;
  }

  const leftEye = landmarks[LEFT_EYE_OUTER];
  const rightEye = landmarks[RIGHT_EYE_OUTER];

  let rotation = 0;

  if (leftEye && rightEye) {
    rotation = normalizeRoll(
      Math.atan2(
        (rightEye.y - leftEye.y) * outputHeight,
        (rightEye.x - leftEye.x) * outputWidth,
      ),
    );
  }

  return {
    cx: ((minX + maxX) / 2) * outputWidth,
    cy: ((minY + maxY) / 2) * outputHeight,
    width: (maxX - minX) * outputWidth,
    height: (maxY - minY) * outputHeight,
    rotation,
  };
}

function drawPaperMask(ctx: CanvasRenderingContext2D, pose: FacePose) {
  const width = pose.width * 1.30;
  const height = pose.height * 1.38;

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

  const scale = Math.min(1, 1280 / sourceWidth, 720 / sourceHeight);
  const outputWidth = Math.max(320, Math.round(sourceWidth * scale));
  const outputHeight = Math.max(240, Math.round(sourceHeight * scale));

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
  let raf = 0;
  let detecting = false;
  let lastTrackAt = 0;
  let face: TrackedFace | undefined;

  const detect = async (now: number) => {
    if (
      stopped ||
      detecting ||
      now - lastTrackAt < 30 ||
      video.readyState < 2 ||
      video.videoWidth <= 0 ||
      video.videoHeight <= 0
    ) {
      return;
    }

    detecting = true;
    lastTrackAt = now;

    try {
      // micro-facemesh owns the tracking pipeline:
      // first frame / tracking loss -> BlazeFace full detection
      // tracked frames -> previous 478 landmarks -> next ROI -> landmark inference
      const faces = await facemesh.detect(video);
      face = faces[0];
    } catch (error) {
      console.warn('[mask] micro-facemesh tracking failed', error);
      face = undefined;
    } finally {
      detecting = false;
    }
  };

  const render = (now: number) => {
    if (stopped) return;

    ctx.drawImage(video, 0, 0, outputWidth, outputHeight);

    if (face && face.score >= 0.1) {
      const pose = poseFromLandmarks(face, outputWidth, outputHeight);

      if (pose) {
        drawPaperMask(ctx, pose);
      }
    }

    void detect(now);

    raf = requestAnimationFrame(render);
  };

  const stop = () => {
    if (stopped) return;

    stopped = true;

    if (raf) cancelAnimationFrame(raf);

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

  raf = requestAnimationFrame(render);

  return {
    stream: output,
    stop,
  };
}
