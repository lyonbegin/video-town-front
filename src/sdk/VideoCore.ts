import {
  createMaskedCameraStream,
  type CameraMode,
  type MaskedCameraController,
  type TrackingStatus,
} from '../mask/MaskedCamera';

export const VIDEO_CORE_SDK_VERSION = '1.0.0';

export interface VideoCoreOptions {
  diagnosticsBaseUrl?: string;
}

export interface OpenCameraOptions {
  mode?: CameraMode;
  cameraId?: string;
  microphoneId?: string;
  video?: boolean | MediaTrackConstraints;
  audio?: boolean | MediaTrackConstraints;
  onStreamChanged?: (
    stream: MediaStream,
    mode: CameraMode,
  ) => void;
}

export interface VideoCoreCameraSession {
  readonly stream: MediaStream;
  readonly mode: CameraMode;
  setMode: (mode: CameraMode) => Promise<MediaStream>;
  enableMask: () => Promise<MediaStream>;
  disableMask: () => Promise<MediaStream>;
  replaceVideoTrack: (
    sender: RTCRtpSender,
  ) => Promise<void>;
  replaceAudioTrack: (
    sender: RTCRtpSender,
  ) => Promise<void>;
  getTrackingStatus: () => TrackingStatus | null;
  stop: () => void;
}

function defaultDiagnosticsBaseUrl() {
  try {
    const moduleUrl =
      new URL(import.meta.url);

    if (
      moduleUrl.protocol === 'http:' ||
      moduleUrl.protocol === 'https:'
    ) {
      return moduleUrl.origin;
    }
  } catch {
    // Fall back to the host page below.
  }

  if (typeof window === 'undefined') {
    return '';
  }

  return window.location.origin;
}

function withExactDevice(
  base: boolean | MediaTrackConstraints | undefined,
  deviceId?: string,
): boolean | MediaTrackConstraints {
  if (base === false) {
    return false;
  }

  const constraints: MediaTrackConstraints =
    typeof base === 'object'
      ? { ...base }
      : {};

  if (deviceId) {
    constraints.deviceId = {
      exact: deviceId,
    };
  }

  return constraints;
}

class BrowserCameraSession
  implements VideoCoreCameraSession
{
  private currentStream!: MediaStream;
  private currentMode: CameraMode;
  private maskController?: MaskedCameraController;
  private stopped = false;

  constructor(
    private readonly options: OpenCameraOptions,
    private readonly diagnosticsBaseUrl: string,
  ) {
    this.currentMode =
      options.mode ?? 'original';
  }

  get stream() {
    return this.currentStream;
  }

  get mode() {
    return this.currentMode;
  }

  async start() {
    await this.acquire(this.currentMode);
    return this;
  }

  async setMode(
    mode: CameraMode,
  ): Promise<MediaStream> {
    if (this.stopped) {
      throw new Error(
        '이미 종료된 VideoCore 카메라 세션입니다.',
      );
    }

    if (
      mode === this.currentMode &&
      this.currentStream
    ) {
      return this.currentStream;
    }

    await this.acquire(mode);
    return this.currentStream;
  }

  enableMask() {
    return this.setMode('mask');
  }

  disableMask() {
    return this.setMode('original');
  }

  async replaceVideoTrack(
    sender: RTCRtpSender,
  ) {
    const track =
      this.currentStream
        .getVideoTracks()[0];

    if (!track) {
      throw new Error(
        '교체할 영상 트랙이 없습니다.',
      );
    }

    await sender.replaceTrack(track);
  }

  async replaceAudioTrack(
    sender: RTCRtpSender,
  ) {
    const track =
      this.currentStream
        .getAudioTracks()[0];

    await sender.replaceTrack(
      track ?? null,
    );
  }

  getTrackingStatus() {
    return (
      this.maskController
        ?.getTrackingStatus() ??
      null
    );
  }

  stop() {
    if (this.stopped) {
      return;
    }

    this.stopped = true;

    this.maskController?.stop();
    this.maskController = undefined;

    this.currentStream
      ?.getTracks()
      .forEach((track) => {
        if (
          track.readyState !== 'ended'
        ) {
          track.stop();
        }
      });
  }

  private async acquire(
    mode: CameraMode,
  ) {
    this.maskController?.stop();
    this.maskController = undefined;

    this.currentStream
      ?.getTracks()
      .forEach((track) => {
        if (
          track.readyState !== 'ended'
        ) {
          track.stop();
        }
      });

    const raw =
      await navigator.mediaDevices
        .getUserMedia({
          video: withExactDevice(
            this.options.video ?? {
              width: {
                ideal: 1280,
              },
              height: {
                ideal: 720,
              },
              facingMode: 'user',
            },
            this.options.cameraId,
          ),
          audio: withExactDevice(
            this.options.audio ?? {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            this.options.microphoneId,
          ),
        });

    try {
      if (mode === 'mask') {
        const controller =
          await createMaskedCameraStream(
            raw,
            {
              serviceBaseUrl:
                this.diagnosticsBaseUrl,
            },
          );

        this.maskController =
          controller;
        this.currentStream =
          controller.stream;
      } else {
        this.currentStream = raw;
      }

      this.currentMode = mode;

      this.options
        .onStreamChanged?.(
          this.currentStream,
          this.currentMode,
        );
    } catch (error) {
      raw
        .getTracks()
        .forEach((track) => {
          if (
            track.readyState !== 'ended'
          ) {
            track.stop();
          }
        });

      throw error;
    }
  }
}

export class VideoCore {
  readonly version =
    VIDEO_CORE_SDK_VERSION;

  private readonly diagnosticsBaseUrl: string;

  constructor(
    options: VideoCoreOptions = {},
  ) {
    this.diagnosticsBaseUrl =
      options.diagnosticsBaseUrl ??
      defaultDiagnosticsBaseUrl();
  }

  static async create(
    options: VideoCoreOptions = {},
  ) {
    return new VideoCore(options);
  }

  async openCamera(
    options: OpenCameraOptions = {},
  ): Promise<VideoCoreCameraSession> {
    const session =
      new BrowserCameraSession(
        options,
        this.diagnosticsBaseUrl,
      );

    return session.start();
  }

  async listDevices() {
    return navigator.mediaDevices
      .enumerateDevices();
  }
}

export async function createVideoCore(
  options: VideoCoreOptions = {},
) {
  return VideoCore.create(options);
}
