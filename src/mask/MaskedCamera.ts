import { AdaptiveLandmarkDeadband } from './AdaptiveDeadband';

export type CameraMode = 'mask' | 'original';

export interface TrackingStatus {
  fps: number;
  frameIntervalMs: number;
  smoothing: 'mediapipe-relative-velocity';
  windowSize: number;
  velocityScale: number;
  deadbandHoldRatio: number;
  deadbandNoiseRadius: number;
  deadbandMaxNoiseRadius: number;
}

export interface MaskedCameraController {
  stream: MediaStream;
  stop: () => void;
  getTrackingStatus: () => TrackingStatus;
}

type NormalizedLandmark = {
  x: number;
  y: number;
  z: number;
};

type FaceMeshDetectionResult = {
  faceLandmarks: NormalizedLandmark[][];
  faceBlendshapes: unknown[];
};

type MindAREstimate = {
  metricLandmarks: number[][];
  faceMatrix: number[];
  faceScale: number;
  blendshapes?: unknown;
};

type FaceGeometryLike = {
  updatePositions: (metricLandmarks: number[][]) => void;
};

type FaceLandmarkerLike = {
  setOptions: (options: {
    runningMode: 'IMAGE' | 'VIDEO';
  }) => Promise<void>;
  detectForVideo: (
    input: HTMLVideoElement | HTMLCanvasElement,
    timestampMs: number,
  ) => FaceMeshDetectionResult;
};

type FaceMeshHelperLike = {
  detect: (
    input: HTMLVideoElement | HTMLCanvasElement,
  ) => Promise<FaceMeshDetectionResult>;
  faceLandmarker?: FaceLandmarkerLike;
};

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    callback: (
      now: number,
      metadata: { mediaTime?: number },
    ) => void,
  ) => number;
  cancelVideoFrameCallback?: (
    handle: number,
  ) => void;
};

type EstimatorLike = {
  estimate: (landmarks: number[][]) => MindAREstimate;
};

type MindARController = {
  processingVideo?: boolean;
  flipFace: boolean;
  faceMeshHelper: FaceMeshHelperLike;
  estimator: EstimatorLike;
  customFaceGeometries: FaceGeometryLike[];
  lastEstimateResult: MindAREstimate | null;
  onUpdate: (payload: {
    hasFace: boolean;
    estimateResult?: MindAREstimate;
  }) => void;
  processVideo: (input: HTMLVideoElement) => void;
  stopProcessVideo: () => void;
};

type FaceMeshLike = {
  visible: boolean;
  material: {
    map?: unknown;
    transparent?: boolean;
    needsUpdate?: boolean;
  };
};

type MindARThreeInstance = {
  renderer: {
    domElement: HTMLCanvasElement;
    render: (scene: unknown, camera: unknown) => void;
    setAnimationLoop: (
      callback: ((time: number) => void) | null,
    ) => void;
    dispose?: () => void;
  };
  scene: {
    add: (...objects: unknown[]) => void;
  };
  camera: unknown;
  video?: HTMLVideoElement;
  controller: MindARController;
  addFaceMesh: () => FaceMeshLike;
  start: () => Promise<void>;
  stop: () => void;
};

type MindARThreeConstructor = new (options: {
  container: HTMLElement;
  userDeviceId?: string | null;
  filterMinCF?: number | null;
  filterBeta?: number | null;
}) => MindARThreeInstance;

type MindARModule = {
  MindARThree: MindARThreeConstructor;
};

type ThreeModule = {
  HemisphereLight: new (
    skyColor?: number,
    groundColor?: number,
    intensity?: number,
  ) => unknown;
  TextureLoader: new () => {
    load: (url: string) => unknown;
  };
};

type WindowElement = {
  distance: number;
  durationMs: number;
};

const MINDAR_SPECIFIER = 'mindar-face-three';
const THREE_SPECIFIER = 'three';

const FACE_TEXTURE_URL =
  'https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/face-tracking/assets/sparkar/face-mask.png';

const FACE_LOSS_GRACE_MS = 420;

// Exact Face Effect smoothing parameters used by MediaPipe's
// face_landmarks_smoothing.pbtxt.
const VELOCITY_FILTER_WINDOW_SIZE = 5;
const VELOCITY_FILTER_SCALE = 20.0;
const ASSUMED_FRAME_MS = 1000 / 30;

/**
 * TypeScript port of MediaPipe RelativeVelocityFilter.
 *
 * Source behavior:
 * - keep a short velocity window
 * - normalize movement by current object scale
 * - high velocity => high alpha => follow quickly
 * - low velocity => low alpha => stabilize
 *
 * This is intentionally used BEFORE MindAR's Estimator, so the same smoothed
 * landmarks produce both the face pose matrix and the deforming face geometry.
 */
class RelativeVelocityFilter {
  private lastValue = 0;
  private lastValueScale = 1;
  private lastTimestampMs = -1;
  private readonly window: WindowElement[];
  private lowPassInitialized = false;
  private lowPassValue = 0;

  constructor(
    private readonly maxWindowSize: number,
    private readonly velocityScale: number,
  ) {
    // MediaPipe's C++ RelativeVelocityFilter initializes its deque with
    // window_size zero-valued elements. Preserve that startup behavior too.
    this.window = Array.from(
      { length: maxWindowSize },
      () => ({
        distance: 0,
        durationMs: 0,
      }),
    );
  }

  reset() {
    this.lastValue = 0;
    this.lastValueScale = 1;
    this.lastTimestampMs = -1;
    this.window.length = 0;

    for (let i = 0; i < this.maxWindowSize; i++) {
      this.window.push({
        distance: 0,
        durationMs: 0,
      });
    }
    this.lowPassInitialized = false;
    this.lowPassValue = 0;
  }

  apply(
    timestampMs: number,
    value: number,
    valueScale: number,
  ) {
    if (this.lastTimestampMs >= timestampMs) {
      return value;
    }

    let alpha = 1;

    if (this.lastTimestampMs !== -1) {
      // MediaPipe RelativeVelocityFilter's default distance mode is
      // kLegacyTransition.
      const distance =
        value * valueScale -
        this.lastValue * this.lastValueScale;

      const durationMs =
        timestampMs - this.lastTimestampMs;

      let cumulativeDistance = distance;
      let cumulativeDurationMs = durationMs;

      const maxCumulativeDurationMs =
        (1 + this.window.length) * ASSUMED_FRAME_MS;

      for (const element of this.window) {
        if (
          cumulativeDurationMs + element.durationMs >
          maxCumulativeDurationMs
        ) {
          break;
        }

        cumulativeDistance += element.distance;
        cumulativeDurationMs += element.durationMs;
      }

      const durationSeconds =
        Math.max(0.000001, cumulativeDurationMs / 1000);

      const velocity =
        cumulativeDistance / durationSeconds;

      alpha =
        1 -
        1 /
          (
            1 +
            this.velocityScale *
              Math.abs(velocity)
          );

      this.window.unshift({
        distance,
        durationMs,
      });

      if (this.window.length > this.maxWindowSize) {
        this.window.pop();
      }
    }

    this.lastValue = value;
    this.lastValueScale = valueScale;
    this.lastTimestampMs = timestampMs;

    if (!this.lowPassInitialized) {
      this.lowPassInitialized = true;
      this.lowPassValue = value;
      return value;
    }

    this.lowPassValue =
      alpha * value +
      (1 - alpha) * this.lowPassValue;

    return this.lowPassValue;
  }
}

class FaceLandmarksSmoother {
  private xFilters: RelativeVelocityFilter[] = [];
  private yFilters: RelativeVelocityFilter[] = [];
  private zFilters: RelativeVelocityFilter[] = [];

  reset() {
    for (const filter of this.xFilters) filter.reset();
    for (const filter of this.yFilters) filter.reset();
    for (const filter of this.zFilters) filter.reset();

    this.xFilters = [];
    this.yFilters = [];
    this.zFilters = [];
  }

  smooth(
    landmarks: NormalizedLandmark[],
    timestampMs: number,
    imageWidth: number,
    imageHeight: number,
  ): number[][] {
    this.ensureFilters(landmarks.length);

    const pixelLandmarks = landmarks.map((landmark) => [
      landmark.x * imageWidth,
      landmark.y * imageHeight,
      landmark.z * imageWidth,
    ]);

    const objectScale =
      this.getObjectScale(pixelLandmarks);

    // This matches MediaPipe LandmarksSmoothingCalculator:
    // value_scale = 1 / object_scale.
    const valueScale =
      1 / Math.max(1e-6, objectScale);

    const output: number[][] =
      new Array(landmarks.length);

    for (let i = 0; i < landmarks.length; i++) {
      const point = pixelLandmarks[i];

      const x = this.xFilters[i].apply(
        timestampMs,
        point[0],
        valueScale,
      );

      const y = this.yFilters[i].apply(
        timestampMs,
        point[1],
        valueScale,
      );

      const z = this.zFilters[i].apply(
        timestampMs,
        point[2],
        valueScale,
      );

      output[i] = [
        x / imageWidth,
        y / imageHeight,
        z / imageWidth,
      ];
    }

    return output;
  }

  private ensureFilters(count: number) {
    if (this.xFilters.length === count) return;

    this.xFilters = [];
    this.yFilters = [];
    this.zFilters = [];

    for (let i = 0; i < count; i++) {
      this.xFilters.push(
        new RelativeVelocityFilter(
          VELOCITY_FILTER_WINDOW_SIZE,
          VELOCITY_FILTER_SCALE,
        ),
      );

      this.yFilters.push(
        new RelativeVelocityFilter(
          VELOCITY_FILTER_WINDOW_SIZE,
          VELOCITY_FILTER_SCALE,
        ),
      );

      this.zFilters.push(
        new RelativeVelocityFilter(
          VELOCITY_FILTER_WINDOW_SIZE,
          VELOCITY_FILTER_SCALE,
        ),
      );
    }
  }

  private getObjectScale(
    landmarks: number[][],
  ) {
    let xMin = Number.POSITIVE_INFINITY;
    let xMax = Number.NEGATIVE_INFINITY;
    let yMin = Number.POSITIVE_INFINITY;
    let yMax = Number.NEGATIVE_INFINITY;

    for (const landmark of landmarks) {
      xMin = Math.min(xMin, landmark[0]);
      xMax = Math.max(xMax, landmark[0]);
      yMin = Math.min(yMin, landmark[1]);
      yMax = Math.max(yMax, landmark[1]);
    }

    const objectWidth = xMax - xMin;
    const objectHeight = yMax - yMin;

    return (objectWidth + objectHeight) / 2;
  }
}

async function loadOfficialMindARModules() {
  const [mindar, three] = await Promise.all([
    import(
      /* @vite-ignore */ MINDAR_SPECIFIER
    ) as Promise<MindARModule>,
    import(
      /* @vite-ignore */ THREE_SPECIFIER
    ) as Promise<ThreeModule>,
  ]);

  return {
    MindARThree: mindar.MindARThree,
    THREE: three,
  };
}

function createOffscreenContainer() {
  const container = document.createElement('div');

  Object.assign(container.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: '960px',
    height: '540px',
    overflow: 'hidden',
    pointerEvents: 'none',
    opacity: '0',
  });

  document.body.appendChild(container);

  return container;
}

function createFlippedInput(
  width: number,
  height: number,
) {
  const maxTrackingWidth = 640;
  const scale = Math.min(
    1,
    maxTrackingWidth / Math.max(1, width),
  );

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(
    320,
    Math.round(width * scale),
  );
  canvas.height = Math.max(
    180,
    Math.round(height * scale),
  );

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error(
      'MindAR 얼굴 추적 입력 Canvas를 만들지 못했습니다.',
    );
  }

  return {
    canvas,
    context,
  };
}

export async function createMaskedCameraStream(
  source: MediaStream,
): Promise<MaskedCameraController> {
  const sourceVideoTrack = source.getVideoTracks()[0];

  if (!sourceVideoTrack) {
    throw new Error(
      '복면 모드에 사용할 카메라 트랙이 없습니다.',
    );
  }

  if (!HTMLCanvasElement.prototype.captureStream) {
    throw new Error(
      '현재 브라우저는 Canvas 영상 출력을 지원하지 않습니다.',
    );
  }

  const deviceId =
    sourceVideoTrack.getSettings().deviceId ?? null;

  // MindAR owns the physical camera while mask mode is active.
  sourceVideoTrack.stop();

  const container = createOffscreenContainer();

  let mindarThree: MindARThreeInstance | undefined;
  let outputStream: MediaStream | undefined;
  let stopped = false;
  let trackingLoopEnabled = false;

  try {
    const { MindARThree, THREE } =
      await loadOfficialMindARModules();

    // MindAR's original post-estimator One Euro stage is not used for the
    // custom tracking loop below. We keep the official MindAR module for
    // camera setup, detector, estimator, geometry, matrices and rendering.
    const mindar = new MindARThree({
      container,
      userDeviceId: deviceId,
    });

    mindarThree = mindar;

    // Prevent MindAR from starting its original post-estimator smoothing loop.
    // _startAR still performs detector setup, dummy warmup, camera geometry and
    // onUpdate wiring; only processVideo() is replaced.
    mindar.controller.processVideo = () => {};

    const { renderer, scene, camera } = mindar;

    const light = new THREE.HemisphereLight(
      0xffffff,
      0xbbbbff,
      1,
    );

    scene.add(light);

    const faceMesh = mindar.addFaceMesh();

    const texture =
      new THREE.TextureLoader().load(
        FACE_TEXTURE_URL,
      );

    faceMesh.material.map = texture;
    faceMesh.material.transparent = true;
    faceMesh.material.needsUpdate = true;

    scene.add(faceMesh);

    await mindar.start();

    const video = mindar.video;

    if (
      !video ||
      video.videoWidth <= 0 ||
      video.videoHeight <= 0
    ) {
      throw new Error(
        'MindAR FaceMesh 카메라 영상을 초기화하지 못했습니다.',
      );
    }

    const controller = mindar.controller;

    // MindAR 1.2.5 initializes FaceLandmarker in IMAGE mode. For a live camera
    // that repeats full image inference on every call. Switch the same tracker
    // to VIDEO mode so MediaPipe can reuse temporal tracking state.
    const faceLandmarker =
      controller.faceMeshHelper.faceLandmarker;

    let useVideoMode = false;

    if (
      faceLandmarker?.setOptions &&
      faceLandmarker?.detectForVideo
    ) {
      await faceLandmarker.setOptions({
        runningMode: 'VIDEO',
      });
      useVideoMode = true;
    }

    // MindAR's built-in loop never started. Our only tracking path is:
    // detect -> RelativeVelocity(raw landmarks) -> adaptive deadband
    //        -> estimate -> matrix + geometry from the SAME landmarks.

    const smoother =
      new FaceLandmarksSmoother();

    // Independent second-stage stabilizer:
    // it does not interpolate coordinates. It learns each landmark's recent
    // noise range with rolling median/MAD and simply holds the last output
    // while the new value stays inside that learned range.
    const deadband =
      new AdaptiveLandmarkDeadband({
        windowSize: 11,
        minSamples: 6,
        threshold: 3,
        constantScaleFactor: 1.4826,
        minRadius: 0.00045,
        maxRadius: 0.012,
        releaseRatio: 0.55,
        quietFramesToHold: 3,
      });

    const flipped =
      controller.flipFace
        ? createFlippedInput(
            video.videoWidth,
            video.videoHeight,
          )
        : null;

    let lastSeenAt = 0;
    let everSeenFace = false;

    let lastTrackingAt = 0;
    let frameIntervalMs = 33.3;
    let fps = 30;

    const updateTrackingRate = (
      timestampMs: number,
    ) => {
      if (lastTrackingAt > 0) {
        const dt =
          timestampMs - lastTrackingAt;

        frameIntervalMs +=
          0.12 * (dt - frameIntervalMs);

        fps =
          1000 /
          Math.max(1, frameIntervalMs);
      }

      lastTrackingAt = timestampMs;
    };

    trackingLoopEnabled = true;

    const videoWithFrameCallback =
      video as VideoWithFrameCallback;

    let videoFrameHandle = 0;
    let fallbackFrameHandle = 0;
    let processingFrame = false;

    const scheduleTrackingFrame = () => {
      if (
        stopped ||
        !trackingLoopEnabled
      ) {
        return;
      }

      if (
        videoWithFrameCallback
          .requestVideoFrameCallback
      ) {
        videoFrameHandle =
          videoWithFrameCallback
            .requestVideoFrameCallback(
              (now) => {
                void processFrame(now);
              },
            );
      } else {
        fallbackFrameHandle =
          requestAnimationFrame(
            (now) => {
              void processFrame(now);
            },
          );
      }
    };

    const processFrame = async (
      frameTimestampMs: number,
    ) => {
      if (
        stopped ||
        !trackingLoopEnabled ||
        processingFrame
      ) {
        return;
      }

      processingFrame = true;

      let detectionInput:
        | HTMLVideoElement
        | HTMLCanvasElement = video;

      if (flipped) {
        flipped.context.clearRect(
          0,
          0,
          flipped.canvas.width,
          flipped.canvas.height,
        );

        flipped.context.save();
        flipped.context.translate(
          flipped.canvas.width,
          0,
        );
        flipped.context.scale(-1, 1);

        flipped.context.drawImage(
          video,
          0,
          0,
          flipped.canvas.width,
          flipped.canvas.height,
        );

        flipped.context.restore();
        detectionInput = flipped.canvas;
      }

      try {
        const results =
          useVideoMode && faceLandmarker
            ? faceLandmarker.detectForVideo(
                detectionInput,
                frameTimestampMs,
              )
            : await controller.faceMeshHelper.detect(
                detectionInput,
              );

        if (
          stopped ||
          !trackingLoopEnabled
        ) {
          return;
        }

        updateTrackingRate(
          frameTimestampMs,
        );

        if (
          !results.faceLandmarks ||
          results.faceLandmarks.length === 0
        ) {
          controller.lastEstimateResult = null;
          controller.onUpdate({
            hasFace: false,
          });

          smoother.reset();
          deadband.reset();

          if (
            everSeenFace &&
            frameTimestampMs - lastSeenAt <=
              FACE_LOSS_GRACE_MS
          ) {
            faceMesh.visible = true;
          } else if (everSeenFace) {
            faceMesh.visible = false;
          }
        } else {
          const smoothedLandmarks =
            smoother.smooth(
              results.faceLandmarks[0],
              frameTimestampMs,
              video.videoWidth,
              video.videoHeight,
            );

          const stabilizedLandmarks =
            deadband.apply(
              smoothedLandmarks,
            );

          const estimateResult =
            controller.estimator.estimate(
              stabilizedLandmarks,
            );

          estimateResult.blendshapes =
            results.faceBlendshapes?.[0];

          controller.lastEstimateResult =
            estimateResult;

          controller.onUpdate({
            hasFace: true,
            estimateResult,
          });

          for (
            const geometry of
            controller.customFaceGeometries
          ) {
            geometry.updatePositions(
              estimateResult.metricLandmarks,
            );
          }

          lastSeenAt =
            frameTimestampMs;
          everSeenFace = true;
          faceMesh.visible = true;
        }
      } finally {
        processingFrame = false;
        scheduleTrackingFrame();
      }
    };

    scheduleTrackingFrame();

    const outputScale = Math.min(
      1,
      960 / video.videoWidth,
      540 / video.videoHeight,
    );

    const outputCanvas =
      document.createElement('canvas');

    outputCanvas.width = Math.max(
      320,
      Math.round(
        video.videoWidth * outputScale,
      ),
    );

    outputCanvas.height = Math.max(
      240,
      Math.round(
        video.videoHeight * outputScale,
      ),
    );

    const ctx = outputCanvas.getContext(
      '2d',
      {
        alpha: false,
        desynchronized: true,
      },
    );

    if (!ctx) {
      throw new Error(
        'MindAR FaceMesh 출력 Canvas를 만들지 못했습니다.',
      );
    }

    const mindarVideoTrack =
      (video.srcObject as MediaStream | null)
        ?.getVideoTracks()[0];

    const cameraFrameRate =
      mindarVideoTrack
        ?.getSettings()
        .frameRate ?? 30;

    const outputFrameRate =
      Math.min(
        60,
        Math.max(
          15,
          Math.round(cameraFrameRate),
        ),
      );

    const canvasStream =
      outputCanvas.captureStream(
        outputFrameRate,
      );

    const outputVideoTrack =
      canvasStream.getVideoTracks()[0];

    if (!outputVideoTrack) {
      throw new Error(
        'MindAR FaceMesh 출력 영상 트랙을 만들지 못했습니다.',
      );
    }

    outputVideoTrack.contentHint = 'motion';

    outputStream = new MediaStream([
      outputVideoTrack,
      ...source.getAudioTracks(),
    ]);

    let lastOutputAt = 0;
    const outputIntervalMs =
      1000 / outputFrameRate;

    renderer.setAnimationLoop((now) => {
      if (stopped) return;

      if (
        lastOutputAt > 0 &&
        now - lastOutputAt <
          outputIntervalMs - 1
      ) {
        return;
      }

      lastOutputAt = now;

      renderer.render(
        scene,
        camera,
      );

      // Camera background is mirrored for the local/self-view.
      ctx.save();
      ctx.translate(
        outputCanvas.width,
        0,
      );
      ctx.scale(-1, 1);

      ctx.drawImage(
        video,
        0,
        0,
        outputCanvas.width,
        outputCanvas.height,
      );

      ctx.restore();

      ctx.drawImage(
        renderer.domElement,
        0,
        0,
        outputCanvas.width,
        outputCanvas.height,
      );
    });

    const getTrackingStatus =
      (): TrackingStatus => ({
        fps,
        frameIntervalMs,
        smoothing:
          'mediapipe-relative-velocity',
        windowSize:
          VELOCITY_FILTER_WINDOW_SIZE,
        velocityScale:
          VELOCITY_FILTER_SCALE,
        deadbandHoldRatio:
          deadband.getStatus().holdRatio,
        deadbandNoiseRadius:
          deadband.getStatus().meanNoiseRadius,
        deadbandMaxNoiseRadius:
          deadband.getStatus().maxNoiseRadius,
      });

    const stop = () => {
      if (stopped) return;

      stopped = true;
      trackingLoopEnabled = false;

      if (
        videoFrameHandle &&
        videoWithFrameCallback
          .cancelVideoFrameCallback
      ) {
        videoWithFrameCallback
          .cancelVideoFrameCallback(
            videoFrameHandle,
          );
      }

      if (fallbackFrameHandle) {
        cancelAnimationFrame(
          fallbackFrameHandle,
        );
      }

      try {
        renderer.setAnimationLoop(null);
      } catch {
        // no-op
      }

      try {
        mindar.stop();
      } catch {
        // no-op
      }

      outputStream
        ?.getVideoTracks()
        .forEach((track) => {
          if (
            track.readyState !== 'ended'
          ) {
            track.stop();
          }
        });

      source
        .getAudioTracks()
        .forEach((track) => {
          if (
            track.readyState !== 'ended'
          ) {
            track.stop();
          }
        });

      try {
        renderer.dispose?.();
      } catch {
        // no-op
      }

      container.remove();
    };

    outputVideoTrack.addEventListener(
      'ended',
      stop,
      { once: true },
    );

    return {
      stream: outputStream,
      stop,
      getTrackingStatus,
    };
  } catch (error) {
    stopped = true;
    trackingLoopEnabled = false;

    try {
      mindarThree?.renderer.setAnimationLoop(
        null,
      );
    } catch {
      // no-op
    }

    try {
      mindarThree?.stop();
    } catch {
      // no-op
    }

    source
      .getAudioTracks()
      .forEach((track) => {
        if (
          track.readyState !== 'ended'
        ) {
          track.stop();
        }
      });

    container.remove();

    throw error;
  }
}
