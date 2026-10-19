import {
  FacePaintRenderer,
  type FacePaintLandmark,
} from './FacePaintRenderer';

export type CameraMode = 'mask' | 'original';

export interface MaskedCameraController {
  stream: MediaStream;
  stop: () => void;
}

type TrackedFace = {
  score: number;
  landmarks: FacePaintLandmark[];
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

const FACE_VERTEX_COUNT = 468;

const INFERENCE_MAX_WIDTH = 512;
const INFERENCE_MAX_HEIGHT = 288;

const FILTER_FREQUENCY = 30;
const LANDMARK_MIN_CUTOFF = 0.8;
const LANDMARK_BETA = 12.0;
const LANDMARK_DERIVATIVE_CUTOFF = 1.0;

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
  const inferenceHeight = Math.max(
    144,
    Math.round(sourceHeight * inferenceScale),
  );

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = outputWidth;
  outputCanvas.height = outputHeight;

  const renderer = new FacePaintRenderer(outputCanvas);

  const inferenceCanvas = document.createElement('canvas');
  inferenceCanvas.width = inferenceWidth;
  inferenceCanvas.height = inferenceHeight;

  const inferenceCtx = inferenceCanvas.getContext('2d', {
    alpha: false,
    desynchronized: true,
  });

  if (!inferenceCtx) {
    renderer.dispose();
    throw new Error('복면 추적용 Canvas를 만들지 못했습니다.');
  }

  const { OneEuroFilter } = oneEuro;

  const filtersX = Array.from(
    { length: FACE_VERTEX_COUNT },
    () =>
      new OneEuroFilter(
        FILTER_FREQUENCY,
        LANDMARK_MIN_CUTOFF,
        LANDMARK_BETA,
        LANDMARK_DERIVATIVE_CUTOFF,
      ),
  );

  const filtersY = Array.from(
    { length: FACE_VERTEX_COUNT },
    () =>
      new OneEuroFilter(
        FILTER_FREQUENCY,
        LANDMARK_MIN_CUTOFF,
        LANDMARK_BETA,
        LANDMARK_DERIVATIVE_CUTOFF,
      ),
  );

  const resetFilters = () => {
    for (let i = 0; i < FACE_VERTEX_COUNT; i++) {
      filtersX[i].reset();
      filtersY[i].reset();
    }
  };

  const canvasStream = outputCanvas.captureStream(30);
  const maskedVideoTrack = canvasStream.getVideoTracks()[0];

  if (!maskedVideoTrack) {
    renderer.dispose();
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
  let filteredLandmarks: FacePaintLandmark[] | undefined;

  const runInference = async (submittedAt: number) => {
    if (stopped || detecting) return;

    detecting = true;

    // micro-facemesh returns the previous pipelined tracking result while the
    // ROI tracker is locked. Give One Euro the measurement timestamp rather
    // than the later render timestamp.
    const measurementAt =
      hadTrackedFace && lastSubmittedAt !== undefined
        ? lastSubmittedAt
        : submittedAt;

    lastSubmittedAt = submittedAt;

    try {
      const faces = await facemesh.detect(inferenceCanvas);
      const face = faces[0];

      if (
        !face ||
        face.score < 0.1 ||
        face.landmarks.length < FACE_VERTEX_COUNT
      ) {
        hadTrackedFace = false;
        filteredLandmarks = undefined;
        resetFilters();
        return;
      }

      hadTrackedFace = true;

      const timestampSeconds = measurementAt / 1000;
      const nextLandmarks = new Array<FacePaintLandmark>(FACE_VERTEX_COUNT);

      for (let i = 0; i < FACE_VERTEX_COUNT; i++) {
        const landmark = face.landmarks[i];

        nextLandmarks[i] = {
          x: filtersX[i].filter(landmark.x, timestampSeconds),
          y: filtersY[i].filter(landmark.y, timestampSeconds),
          z: landmark.z,
        };
      }

      filteredLandmarks = nextLandmarks;
    } catch (error) {
      console.warn('[mask] face mesh tracking/filtering failed', error);
      hadTrackedFace = false;
      filteredLandmarks = undefined;
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

    renderer.render(video, filteredLandmarks);

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
    renderer.dispose();

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
