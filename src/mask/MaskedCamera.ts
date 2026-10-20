import {
  CORE_LANDMARK_INDICES,
  EXPRESSION_LANDMARK_INDICES,
  GlobalLandmarkGate,
  RIGID_LANDMARK_INDICES,
} from './GlobalLandmarkGate';
import {
  MaskDebugLogger,
  type MaskDebugSessionInfo,
} from './MaskDebugLogger';

export type CameraMode = 'mask' | 'original';

export interface TrackingStatus {
  fps: number;
  frameIntervalMs: number;
  smoothing: 'mediapipe-relative-velocity';
  windowSize: number;
  velocityScale: number;
  globalThresholdPx: number;
  expressionThresholdPx: number;
  targetThresholdPx: number;
  targetExpressionThresholdPx: number;
  verificationHz: number;
  gateAccepted: boolean;
  gateReason: string;
  rigidSignalPx: number;
  expressionSignalPx: number;
  frameRigidMotionPx: number;
  frameExpressionMotionPx: number;
  noiseFloorPx: number;
  expressionNoiseFloorPx: number;
  autoTuningEnabled: boolean;
  autoTuneConfidence: number;
  calibrationConverged: boolean;
  convergenceProgress: number;
  calibrationSeedSource: 'saved' | 'default';
  staticAcceptRate: number;
  outputUpdateRate: number;
  timeSinceLastAcceptMs: number;
}

export const DEFAULT_GLOBAL_THRESHOLD_PX = 3.0;
export const DEFAULT_EXPRESSION_THRESHOLD_PX = 1.5;
export const DEFAULT_GATE_VERIFICATION_HZ = 15;

export interface MaskedCameraController {
  stream: MediaStream;
  stop: () => void;
  setGlobalThresholdPx: (threshold: number) => void;
  setVerificationHz: (hz: number) => void;
  setAutoTuningEnabled: (enabled: boolean) => void;
  getTrackingStatus: () => TrackingStatus;
  getDebugSession: () => MaskDebugSessionInfo;
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

type FaceMeshHelperLike = {
  detect: (
    input: HTMLVideoElement | HTMLCanvasElement,
  ) => Promise<FaceMeshDetectionResult>;
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
  matrix?: {
    elements?: ArrayLike<number>;
  };
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

const FACE_LOSS_GRACE_MS = 120;
const CALIBRATION_STORAGE_KEY =
  'video-town-mask-calibration-v1';

type SavedMaskCalibration = {
  thresholdPx: number;
  expressionThresholdPx: number;
  verificationHz: number;
  updatedAt: string;
};

function makeCalibrationDeviceKey(
  deviceId: string | null,
  width: number,
  height: number,
) {
  return [
    deviceId || 'default-camera',
    `${width}x${height}`,
  ].join(':');
}

function loadSavedCalibration(
  deviceKey: string,
): SavedMaskCalibration | null {
  try {
    const raw =
      localStorage.getItem(
        CALIBRATION_STORAGE_KEY,
      );

    if (!raw) return null;

    const parsed =
      JSON.parse(raw) as
        Record<
          string,
          SavedMaskCalibration
        >;

    const saved =
      parsed[deviceKey];

    if (
      !saved ||
      !Number.isFinite(
        saved.thresholdPx,
      ) ||
      !Number.isFinite(
        saved.expressionThresholdPx,
      )
    ) {
      return null;
    }

    return saved;
  } catch {
    return null;
  }
}

function saveCalibration(
  deviceKey: string,
  calibration: SavedMaskCalibration,
) {
  try {
    const raw =
      localStorage.getItem(
        CALIBRATION_STORAGE_KEY,
      );

    const parsed =
      raw
        ? JSON.parse(raw)
        : {};

    parsed[deviceKey] =
      calibration;

    localStorage.setItem(
      CALIBRATION_STORAGE_KEY,
      JSON.stringify(parsed),
    );
  } catch {
    // Calibration persistence must never interrupt video.
  }
}

// Exact Face Effect smoothing parameters used by MediaPipe's
// face_landmarks_smoothing.pbtxt.
const VELOCITY_FILTER_WINDOW_SIZE = 5;
const VELOCITY_FILTER_SCALE = 20.0;
const ASSUMED_FRAME_MS = 1000 / 30;

function numericDetectedLandmarks(
  landmarks: NormalizedLandmark[],
) {
  return landmarks.map((point) => [
    point.x,
    point.y,
    point.z,
  ]);
}

function flattenDetectedLandmarks(
  landmarks: NormalizedLandmark[],
) {
  const output =
    new Array<number>(
      landmarks.length * 3,
    );

  let offset = 0;

  for (
    let i = 0;
    i < landmarks.length;
    i++
  ) {
    const point = landmarks[i];

    output[offset++] = point.x;
    output[offset++] = point.y;
    output[offset++] = point.z;
  }

  return output;
}

function flattenNumericLandmarks(
  landmarks: number[][],
) {
  const output =
    new Array<number>(
      landmarks.length * 3,
    );

  let offset = 0;

  for (
    let i = 0;
    i < landmarks.length;
    i++
  ) {
    const point = landmarks[i];

    output[offset++] = point[0] ?? 0;
    output[offset++] = point[1] ?? 0;
    output[offset++] = point[2] ?? 0;
  }

  return output;
}

function copyFaceMatrix(
  faceMesh: FaceMeshLike,
) {
  const elements =
    faceMesh.matrix?.elements;

  return elements
    ? Array.from(elements)
    : null;
}

/**
 * TypeScript port of MediaPipe RelativeVelocityFilter.
 *
 * Source behavior:
 * - keep a short velocity window
 * - normalize movement by current object scale
 * - high velocity => high alpha => follow quickly
 * - low velocity => low alpha => stabilize
 *
 * This filter is used only for deformation stabilization and calibration.
 * Head pose uses RAW detected landmarks so translation/rotation can follow
 * every successful detector frame without smoothing lag.
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
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

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
  let debugLogger: MaskDebugLogger | undefined;
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

    const calibrationDeviceKey =
      makeCalibrationDeviceKey(
        deviceId,
        video.videoWidth,
        video.videoHeight,
      );

    const savedCalibration =
      loadSavedCalibration(
        calibrationDeviceKey,
      );

    const initialThresholdPx =
      savedCalibration?.thresholdPx ??
      DEFAULT_GLOBAL_THRESHOLD_PX;

    const initialExpressionThresholdPx =
      savedCalibration
        ?.expressionThresholdPx ??
      DEFAULT_EXPRESSION_THRESHOLD_PX;

    const initialVerificationHz =
      savedCalibration
        ?.verificationHz ??
      DEFAULT_GATE_VERIFICATION_HZ;

    const calibrationSeedSource:
      'saved' | 'default' =
        savedCalibration
          ? 'saved'
          : 'default';

    debugLogger =
      new MaskDebugLogger({
        version: 'mask-diagnostics-v1',
        video: {
          width: video.videoWidth,
          height: video.videoHeight,
          frameRate:
            (
              video.srcObject as
                | MediaStream
                | null
            )
              ?.getVideoTracks()[0]
              ?.getSettings()
              .frameRate ?? null,
        },
        smoother: {
          type:
            'mediapipe-relative-velocity',
          windowSize:
            VELOCITY_FILTER_WINDOW_SIZE,
          velocityScale:
            VELOCITY_FILTER_SCALE,
        },
        gate: {
          thresholdPx:
            initialThresholdPx,
          verificationHz:
            initialVerificationHz,
          initialExpressionThresholdPx:
            initialExpressionThresholdPx,
          calibrationSeedSource,
          savedCalibration,
          coreLandmarkIndices:
            Array.from(
              CORE_LANDMARK_INDICES,
            ),
          rigidLandmarkIndices:
            Array.from(
              RIGID_LANDMARK_INDICES,
            ),
          expressionLandmarkIndices:
            Array.from(
              EXPRESSION_LANDMARK_INDICES,
            ),
          autoTuning: true,
        },
      });

    // MindAR's built-in loop never started. Our custom path deliberately
    // separates HEAD POSE from FACE DEFORMATION:
    //
    // detect -> RAW landmarks -> estimator -> faceMatrix EVERY tracking frame
    //        \-> RelativeVelocity -> deformation gate -> geometry only on accept
    //
    // Head pose bypasses both smoothing and the gate. The stabilizer therefore
    // cannot leave the whole mask at an old screen position.

    const smoother =
      new FaceLandmarksSmoother();

    const globalGate =
      new GlobalLandmarkGate(
        initialThresholdPx,
        initialVerificationHz,
        initialExpressionThresholdPx,
      );

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
    let trackingFrameIndex = 0;
    let calibrationFinalized = false;

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

    const processFrame = async () => {
      if (
        stopped ||
        !trackingLoopEnabled
      ) {
        return;
      }

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

      const detectStartedAt =
        performance.now();

      try {
        const results =
          await controller.faceMeshHelper.detect(
            detectionInput,
          );

        if (
          stopped ||
          !trackingLoopEnabled
        ) {
          return;
        }

        const now = performance.now();
        const detectDurationMs =
          now - detectStartedAt;

        updateTrackingRate(now);
        trackingFrameIndex++;

        if (
          !results.faceLandmarks ||
          results.faceLandmarks.length === 0
        ) {
          controller.lastEstimateResult = null;
          controller.onUpdate({
            hasFace: false,
          });

          debugLogger?.log(
            'tracking_frame',
            {
              frameIndex:
                trackingFrameIndex,
              detected: false,
              detectDurationMs,
              trackerFps: fps,
              trackerFrameIntervalMs:
                frameIntervalMs,
              gate:
                globalGate.getStatus(),
              renderedFaceMatrix:
                copyFaceMatrix(
                  faceMesh,
                ),
            },
            now,
          );

          if (
            everSeenFace &&
            now - lastSeenAt <=
              FACE_LOSS_GRACE_MS
          ) {
            // Keep only a very short grace window for one/two transient misses.
            // Long stale-mask display is worse than hiding briefly because the
            // face may already be at a completely different screen position.
            faceMesh.visible = true;
          } else if (everSeenFace) {
            smoother.reset();
            globalGate.reset();
            faceMesh.visible = false;
          }
        } else {
          const rawLandmarks =
            numericDetectedLandmarks(
              results.faceLandmarks[0],
            );

          const smoothedLandmarks =
            smoother.smooth(
              results.faceLandmarks[0],
              now,
              video.videoWidth,
              video.videoHeight,
            );

          // Head pose uses RAW landmarks and updates on EVERY successful
          // detector frame. This removes RelativeVelocity lag from
          // translation/rotation.
          const livePoseEstimate =
            controller.estimator.estimate(
              rawLandmarks,
            );

          livePoseEstimate.blendshapes =
            results.faceBlendshapes?.[0];

          controller.lastEstimateResult =
            livePoseEstimate;

          controller.onUpdate({
            hasFace: true,
            estimateResult:
              livePoseEstimate,
          });

          // The adaptive gate is now used ONLY for mesh deformation. Holding a
          // deformation frame cannot hold the whole mask at an old position.
          const gateResult =
            globalGate.evaluate(
              smoothedLandmarks,
              video.videoWidth,
              video.videoHeight,
              now,
            );

          let appliedEstimate:
            | {
                faceScale: number;
                faceMatrix: number[];
                metricLandmarks: number[];
              }
            | null = null;

          if (gateResult.accepted) {
            // Geometry remains stabilized. Use the gate-approved smoothed
            // landmarks for deformation while the pose matrix keeps following
            // RAW landmarks independently.
            const deformationEstimate =
              controller.estimator.estimate(
                gateResult.points,
              );

            deformationEstimate.blendshapes =
              results.faceBlendshapes?.[0];

            for (
              const geometry of
              controller.customFaceGeometries
            ) {
              geometry.updatePositions(
                deformationEstimate.metricLandmarks,
              );
            }

            appliedEstimate = {
              faceScale:
                deformationEstimate.faceScale,
              faceMatrix:
                Array.from(
                  deformationEstimate.faceMatrix,
                ),
              metricLandmarks:
                flattenNumericLandmarks(
                  deformationEstimate.metricLandmarks,
                ),
            };
          }

          if (gateResult.evaluated) {
            if (gateResult.tuning.changed) {
              debugLogger?.log(
                'auto_tune',
                {
                  frameIndex:
                    trackingFrameIndex,
                  tuning:
                    gateResult.tuning,
                  gate:
                    globalGate.getStatus(),
                },
                now,
              );
            }

            debugLogger?.log(
              'gate_evaluation',
              {
                frameIndex:
                  trackingFrameIndex,
                detected: true,
                detectDurationMs,
                trackerFps: fps,
                trackerFrameIntervalMs:
                  frameIntervalMs,
                videoWidth:
                  video.videoWidth,
                videoHeight:
                  video.videoHeight,
                rawNormalized:
                  flattenDetectedLandmarks(
                    results.faceLandmarks[0],
                  ),
                rawPoseInput:
                  flattenNumericLandmarks(
                    rawLandmarks,
                  ),
                smoothedNormalized:
                  flattenNumericLandmarks(
                    smoothedLandmarks,
                  ),
                gate: {
                  ...globalGate.getStatus(),
                  firstFrame:
                    gateResult.firstFrame,
                  coreMeasurements:
                    gateResult.coreMeasurements,
                  tuning:
                    gateResult.tuning,
                },
                appliedEstimate,
                livePoseEstimate: {
                  faceScale:
                    livePoseEstimate.faceScale,
                  faceMatrix:
                    Array.from(
                      livePoseEstimate.faceMatrix,
                    ),
                },
                currentOutputEstimate:
                  controller.lastEstimateResult
                    ? {
                        faceScale:
                          controller
                            .lastEstimateResult
                            .faceScale,
                        faceMatrix:
                          Array.from(
                            controller
                              .lastEstimateResult
                              .faceMatrix,
                          ),
                      }
                    : null,
                renderedFaceMatrix:
                  copyFaceMatrix(
                    faceMesh,
                  ),
              },
              now,
            );

            const convergedStatus =
              globalGate.getStatus();

            if (
              convergedStatus
                .calibrationConverged &&
              !calibrationFinalized
            ) {
              calibrationFinalized = true;

              const savedAt =
                new Date().toISOString();

              const calibration = {
                thresholdPx:
                  convergedStatus
                    .thresholdPx,
                expressionThresholdPx:
                  convergedStatus
                    .expressionThresholdPx,
                verificationHz:
                  convergedStatus
                    .verificationHz,
                updatedAt: savedAt,
              };

              saveCalibration(
                calibrationDeviceKey,
                calibration,
              );

              debugLogger?.log(
                'calibration_converged',
                {
                  frameIndex:
                    trackingFrameIndex,
                  calibrationDeviceKey,
                  calibrationSeedSource,
                  calibration,
                  trackingStatus:
                    convergedStatus,
                },
                now,
              );

              // Full coordinate serialization, statistical tuning and network
              // log uploads end here. The lightweight fixed gate remains active.
              debugLogger?.stop({
                reason:
                  'calibration_converged',
                calibration,
              });
            }
          } else {
            debugLogger?.log(
              'tracking_tick',
              {
                frameIndex:
                  trackingFrameIndex,
                detected: true,
                detectDurationMs,
                trackerFps: fps,
                trackerFrameIntervalMs:
                  frameIntervalMs,
                gate:
                  globalGate.getStatus(),
                renderedFaceMatrix:
                  copyFaceMatrix(
                    faceMesh,
                  ),
              },
              now,
            );
          }

          lastSeenAt = now;
          everSeenFace = true;
          faceMesh.visible = true;
        }
      } finally {
        if (
          !stopped &&
          trackingLoopEnabled
        ) {
          requestAnimationFrame(
            () => void processFrame(),
          );
        }
      }
    };

    requestAnimationFrame(
      () => void processFrame(),
    );

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

    const canvasStream =
      outputCanvas.captureStream(60);

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

    renderer.setAnimationLoop(() => {
      if (stopped) return;

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
        globalThresholdPx:
          globalGate.getStatus().thresholdPx,
        expressionThresholdPx:
          globalGate.getStatus().expressionThresholdPx,
        targetThresholdPx:
          globalGate.getStatus().targetThresholdPx,
        targetExpressionThresholdPx:
          globalGate.getStatus().targetExpressionThresholdPx,
        verificationHz:
          globalGate.getStatus().verificationHz,
        gateAccepted:
          globalGate.getStatus().accepted,
        gateReason:
          globalGate.getStatus().decisionReason,
        rigidSignalPx:
          globalGate.getStatus().rigidSignalPx,
        expressionSignalPx:
          globalGate.getStatus().expressionSignalPx,
        frameRigidMotionPx:
          globalGate.getStatus().frameRigidMotionPx,
        frameExpressionMotionPx:
          globalGate.getStatus().frameExpressionMotionPx,
        noiseFloorPx:
          globalGate.getStatus().noiseFloorPx,
        expressionNoiseFloorPx:
          globalGate.getStatus().expressionNoiseFloorPx,
        autoTuningEnabled:
          globalGate.getStatus().autoTuningEnabled,
        autoTuneConfidence:
          globalGate.getStatus().autoTuneConfidence,
        calibrationConverged:
          globalGate.getStatus().calibrationConverged,
        convergenceProgress:
          globalGate.getStatus().convergenceProgress,
        calibrationSeedSource,
        staticAcceptRate:
          globalGate.getStatus().staticAcceptRate,
        outputUpdateRate:
          globalGate.getStatus().outputUpdateRate,
        timeSinceLastAcceptMs:
          globalGate.getStatus().timeSinceLastAcceptMs,
      });

    const setGlobalThresholdPx = (
      threshold: number,
    ) => {
      globalGate.setThresholdPx(
        threshold,
      );

      debugLogger?.log(
        'config_change',
        {
          globalThresholdPx:
            globalGate.getStatus()
              .thresholdPx,
          verificationHz:
            globalGate.getStatus()
              .verificationHz,
        },
      );
    };

    const setVerificationHz = (
      hz: number,
    ) => {
      globalGate.setVerificationHz(
        hz,
      );

      debugLogger?.log(
        'config_change',
        {
          globalThresholdPx:
            globalGate.getStatus()
              .thresholdPx,
          verificationHz:
            globalGate.getStatus()
              .verificationHz,
          autoTuningEnabled:
            globalGate.getStatus()
              .autoTuningEnabled,
        },
      );
    };

    const setAutoTuningEnabled = (
      enabled: boolean,
    ) => {
      globalGate.setAutoTuningEnabled(
        enabled,
      );

      debugLogger?.log(
        'config_change',
        {
          globalThresholdPx:
            globalGate.getStatus()
              .thresholdPx,
          expressionThresholdPx:
            globalGate.getStatus()
              .expressionThresholdPx,
          verificationHz:
            globalGate.getStatus()
              .verificationHz,
          autoTuningEnabled:
            enabled,
        },
      );
    };

    const getDebugSession =
      () =>
        debugLogger!.getSessionInfo();

    const stop = () => {
      if (stopped) return;

      stopped = true;
      trackingLoopEnabled = false;

      debugLogger?.stop({
        trackingFrameIndex,
        trackingStatus:
          getTrackingStatus(),
      });

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
      setGlobalThresholdPx,
      setVerificationHz,
      setAutoTuningEnabled,
      getTrackingStatus,
      getDebugSession,
    };
  } catch (error) {
    stopped = true;
    trackingLoopEnabled = false;

    debugLogger?.stop({
      error:
        error instanceof Error
          ? error.message
          : String(error),
    });

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
