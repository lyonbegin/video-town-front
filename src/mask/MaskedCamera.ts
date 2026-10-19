import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

export type CameraMode = 'mask' | 'original';

export interface MaskedCameraController {
  stream: MediaStream;
  stop: () => void;
}

type FacePose = {
  cx: number;
  cy: number;
  width: number;
  height: number;
  rotation: number;
};

const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

let detectorPromise: Promise<FaceDetector> | undefined;

async function getFaceDetector(): Promise<FaceDetector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      return FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.5,
        minSuppressionThreshold: 0.3,
      });
    })();
  }
  return detectorPromise;
}

function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('카메라 영상 초기화 시간이 초과되었습니다.'));
    }, 8000);

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

function smoothPose(current: FacePose | undefined, next: FacePose): FacePose {
  if (!current) return next;

  // Responsive enough to avoid face exposure while still removing jitter.
  const a = 0.58;
  return {
    cx: current.cx + (next.cx - current.cx) * a,
    cy: current.cy + (next.cy - current.cy) * a,
    width: current.width + (next.width - current.width) * a,
    height: current.height + (next.height - current.height) * a,
    rotation: current.rotation + (next.rotation - current.rotation) * a,
  };
}

function drawPaperMask(ctx: CanvasRenderingContext2D, pose: FacePose) {
  const width = pose.width * 1.58;
  const height = pose.height * 1.78;

  ctx.save();
  ctx.translate(pose.cx, pose.cy + pose.height * 0.02);
  ctx.rotate(pose.rotation);

  // Soft shadow makes the mask visually read as a physical paper mask.
  ctx.shadowColor = 'rgba(0, 0, 0, 0.34)';
  ctx.shadowBlur = Math.max(8, width * 0.05);
  ctx.shadowOffsetY = Math.max(3, height * 0.025);

  ctx.beginPath();
  ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#eee9dc';
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.lineWidth = Math.max(2, width * 0.012);
  ctx.strokeStyle = 'rgba(54, 49, 43, 0.78)';
  ctx.stroke();

  // Paper fold.
  ctx.beginPath();
  ctx.moveTo(0, -height * 0.43);
  ctx.lineTo(0, height * 0.43);
  ctx.strokeStyle = 'rgba(116, 103, 86, 0.20)';
  ctx.lineWidth = Math.max(1, width * 0.006);
  ctx.stroke();

  // Printed eye marks; these are opaque, not holes.
  ctx.fillStyle = '#191919';
  const eyeY = -height * 0.10;
  const eyeW = width * 0.18;
  const eyeH = height * 0.055;

  ctx.beginPath();
  ctx.ellipse(-width * 0.19, eyeY, eyeW / 2, eyeH / 2, -0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(width * 0.19, eyeY, eyeW / 2, eyeH / 2, 0.08, 0, Math.PI * 2);
  ctx.fill();

  // Minimal printed nose and mouth.
  ctx.beginPath();
  ctx.moveTo(0, -height * 0.015);
  ctx.lineTo(-width * 0.03, height * 0.10);
  ctx.lineTo(width * 0.025, height * 0.10);
  ctx.strokeStyle = 'rgba(35, 35, 35, 0.65)';
  ctx.lineWidth = Math.max(1.5, width * 0.009);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-width * 0.13, height * 0.24);
  ctx.quadraticCurveTo(0, height * 0.28, width * 0.13, height * 0.24);
  ctx.strokeStyle = '#242424';
  ctx.lineWidth = Math.max(2, width * 0.011);
  ctx.stroke();

  // Tiny string marks enhance the physical-mask impression.
  ctx.beginPath();
  ctx.moveTo(-width * 0.49, -height * 0.03);
  ctx.lineTo(-width * 0.61, -height * 0.01);
  ctx.moveTo(width * 0.49, -height * 0.03);
  ctx.lineTo(width * 0.61, -height * 0.01);
  ctx.strokeStyle = 'rgba(240, 240, 235, 0.9)';
  ctx.lineWidth = Math.max(2, width * 0.010);
  ctx.stroke();

  ctx.restore();
}

function drawPrivacyFallback(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  // Never leak an unmasked face before initial detection or after tracking loss.
  ctx.save();
  ctx.fillStyle = 'rgba(13, 17, 19, 0.96)';
  ctx.fillRect(0, 0, width, height);

  const size = Math.min(width, height) * 0.34;
  ctx.translate(width / 2, height / 2);
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.62, size * 0.82, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#eee9dc';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = Math.max(2, size * 0.018);
  ctx.stroke();

  ctx.fillStyle = '#171717';
  ctx.beginPath();
  ctx.ellipse(-size * 0.20, -size * 0.08, size * 0.11, size * 0.035, 0, 0, Math.PI * 2);
  ctx.ellipse(size * 0.20, -size * 0.08, size * 0.11, size * 0.035, 0, 0, Math.PI * 2);
  ctx.fill();

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

  const detector = await getFaceDetector();

  const video = document.createElement('video');
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.srcObject = new MediaStream([sourceVideoTrack]);

  await video.play().catch(() => undefined);
  await waitForVideoReady(video);

  const sourceWidth = video.videoWidth || 1280;
  const sourceHeight = video.videoHeight || 720;

  // Keep mask mode deliberately light for phones.
  const scale = Math.min(1, 640 / sourceWidth, 480 / sourceHeight);
  const outputWidth = Math.max(240, Math.round(sourceWidth * scale));
  const outputHeight = Math.max(180, Math.round(sourceHeight * scale));

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
  let lastDetectAt = 0;
  let lastFaceAt = 0;
  let face: FacePose | undefined;

  const sx = outputWidth / sourceWidth;
  const sy = outputHeight / sourceHeight;

  const render = (now: number) => {
    if (stopped) return;

    ctx.drawImage(video, 0, 0, outputWidth, outputHeight);

    // About 11 detections/sec. Rendering still runs at browser frame rate.
    if (video.readyState >= 2 && now - lastDetectAt >= 90) {
      lastDetectAt = now;

      try {
        const result = detector.detectForVideo(video, now);
        const detection = result.detections?.[0];
        const box = detection?.boundingBox;

        if (box && box.width > 0 && box.height > 0) {
          let rotation = 0;
          const keypoints = detection.keypoints ?? [];

          // BlazeFace normally exposes the two eyes first.
          if (keypoints.length >= 2) {
            const left = keypoints[0];
            const right = keypoints[1];
            rotation = Math.atan2(
              (right.y - left.y) * outputHeight,
              (right.x - left.x) * outputWidth,
            );
          }

          const next: FacePose = {
            cx: (box.originX + box.width / 2) * sx,
            cy: (box.originY + box.height / 2) * sy,
            width: box.width * sx,
            height: box.height * sy,
            rotation,
          };

          face = smoothPose(face, next);
          lastFaceAt = now;
        }
      } catch {
        // Keep the last valid pose. Fallback below prevents raw-face leakage.
      }
    }

    if (face && now - lastFaceAt <= 850) {
      drawPaperMask(ctx, face);
    } else {
      drawPrivacyFallback(ctx, outputWidth, outputHeight);
    }

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
  };

  maskedVideoTrack.addEventListener('ended', stop, { once: true });
  sourceVideoTrack.addEventListener('ended', stop, { once: true });

  raf = requestAnimationFrame(render);

  return {
    stream: output,
    stop,
  };
}
