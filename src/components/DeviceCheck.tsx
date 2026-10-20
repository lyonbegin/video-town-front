import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createMaskedCameraStream,
  DEFAULT_DEADBAND_THRESHOLD,
  DEFAULT_VELOCITY_THRESHOLD,
  type CameraMode,
  type MaskedCameraController,
  type TrackingStatus,
} from '../mask/MaskedCamera';

interface Props {
  stream?: MediaStream;
  onStream: (stream: MediaStream) => void;
  onReady: () => void;
  ready: boolean;
  disabled?: boolean;
}

export default function DeviceCheck({
  stream,
  onStream,
  onReady,
  ready,
  disabled,
}: Props) {
  const previewRef = useRef<HTMLVideoElement>(null);
  const maskControllerRef = useRef<MaskedCameraController>();

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState('');
  const [micId, setMicId] = useState('');
  const [level, setLevel] = useState(0);
  const [cameraMode, setCameraMode] = useState<CameraMode>('mask');
  const [trackingStatus, setTrackingStatus] =
    useState<TrackingStatus | null>(null);
  const [deadbandThreshold, setDeadbandThreshold] =
    useState(DEFAULT_DEADBAND_THRESHOLD);
  const [velocityThreshold, setVelocityThreshold] =
    useState(DEFAULT_VELOCITY_THRESHOLD);

  useEffect(() => {
    if (previewRef.current) {
      previewRef.current.srcObject = stream ?? null;
    }
  }, [stream]);

  useEffect(() => {
    if (!stream?.getAudioTracks().length) {
      setLevel(0);
      return;
    }

    const Context =
      window.AudioContext || (window as any).webkitAudioContext;

    const context = new Context();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;

    const source = context.createMediaStreamSource(
      new MediaStream(stream.getAudioTracks()),
    );

    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;

    const tick = () => {
      analyser.getByteFrequencyData(data);

      const avg =
        data.reduce((sum, value) => sum + value, 0) /
        Math.max(1, data.length);

      setLevel(Math.min(100, Math.round(avg * 1.4)));
      raf = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      void context.close();
    };
  }, [stream]);

  useEffect(() => {
    if (cameraMode !== 'mask' || !stream) {
      setTrackingStatus(null);
      return;
    }

    const update = () => {
      const controller = maskControllerRef.current;

      if (!controller) {
        setTrackingStatus(null);
        return;
      }

      setTrackingStatus(controller.getTrackingStatus());
    };

    update();
    const timer = window.setInterval(update, 250);

    return () => window.clearInterval(timer);
  }, [cameraMode, stream]);

  const cameras = useMemo(
    () => devices.filter((d) => d.kind === 'videoinput'),
    [devices],
  );

  const microphones = useMemo(
    () => devices.filter((d) => d.kind === 'audioinput'),
    [devices],
  );

  async function acquire(
    nextCameraId = cameraId,
    nextMicId = micId,
    nextMode: CameraMode = cameraMode,
  ) {
    setBusy(true);
    setError('');
    setTrackingStatus(null);

    try {
      maskControllerRef.current?.stop();
      maskControllerRef.current = undefined;

      stream?.getTracks().forEach((track) => track.stop());

      const raw = await navigator.mediaDevices.getUserMedia({
        video: nextCameraId
          ? {
              deviceId: { exact: nextCameraId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user',
            },
        audio: nextMicId
          ? {
              deviceId: { exact: nextMicId },
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          : {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
      });

      let outgoing = raw;

      if (nextMode === 'mask') {
        try {
          const controller = await createMaskedCameraStream(raw);

          maskControllerRef.current = controller;
          controller.setDeadbandThreshold(
            deadbandThreshold,
          );
          controller.setVelocityThreshold(
            velocityThreshold,
          );
          outgoing = controller.stream;
          setTrackingStatus(controller.getTrackingStatus());
        } catch (maskError) {
          raw.getTracks().forEach((track) => track.stop());
          throw maskError;
        }
      }

      onStream(outgoing);

      const allDevices =
        await navigator.mediaDevices.enumerateDevices();

      setDevices(allDevices);

      const videoSettings =
        raw.getVideoTracks()[0]?.getSettings();

      const audioSettings =
        raw.getAudioTracks()[0]?.getSettings();

      if (videoSettings?.deviceId) {
        setCameraId(videoSettings.deviceId);
      }

      if (audioSettings?.deviceId) {
        setMicId(audioSettings.deviceId);
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : String(e);

      setError(
        `카메라 또는 마이크를 사용할 수 없습니다. 브라우저 권한과 복면 모듈을 확인해주세요. (${message})`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function changeMode(nextMode: CameraMode) {
    setCameraMode(nextMode);

    if (stream) {
      await acquire(cameraId, micId, nextMode);
    }
  }

  return (
    <section className="device-card">
      <div className="section-kicker">영상 모드 선택</div>
      <h2>얼굴 공개 또는 복면 모드를 선택하세요</h2>

      <p className="muted-text">
        복면 모드는 이 브라우저에서 얼굴에 마스크를 합성한 뒤
        그 결과 영상만 WebRTC로 전송합니다.
      </p>

      <div className="camera-mode-selector">
        <button
          type="button"
          className={`camera-mode-button ${
            cameraMode === 'mask' ? 'active' : ''
          }`}
          onClick={() => void changeMode('mask')}
          disabled={busy || ready || disabled}
        >
          <strong>🎭 복면</strong>
          <span>마스크가 합성된 영상만 전송</span>
        </button>

        <button
          type="button"
          className={`camera-mode-button ${
            cameraMode === 'original' ? 'active' : ''
          }`}
          onClick={() => void changeMode('original')}
          disabled={busy || ready || disabled}
        >
          <strong>📹 얼굴 공개</strong>
          <span>기존 카메라 영상을 그대로 전송</span>
        </button>
      </div>

      {!stream ? (
        <button
          className="primary-button large"
          onClick={() => acquire()}
          disabled={busy || disabled}
        >
          {busy
            ? cameraMode === 'mask'
              ? '복면 카메라 준비 중…'
              : '장치 연결 중…'
            : cameraMode === 'mask'
              ? '복면 카메라 시작'
              : '카메라·마이크 확인 시작'}
        </button>
      ) : (
        <>
          <div className="device-preview-wrap">
            <video
              ref={previewRef}
              autoPlay
              playsInline
              muted
              className="device-preview"
            />

            <div className="preview-badge">
              {cameraMode === 'mask'
                ? '🎭 복면 송출 화면'
                : '📹 얼굴 공개 화면'}
            </div>
          </div>

          <div className="device-grid">
            <label>
              <span>카메라</span>
              <select
                value={cameraId}
                onChange={(e) => {
                  setCameraId(e.target.value);

                  void acquire(
                    e.target.value,
                    micId,
                    cameraMode,
                  );
                }}
                disabled={busy || ready}
              >
                {cameras.map((device, index) => (
                  <option
                    key={device.deviceId}
                    value={device.deviceId}
                  >
                    {device.label || `카메라 ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>마이크</span>
              <select
                value={micId}
                onChange={(e) => {
                  setMicId(e.target.value);

                  void acquire(
                    cameraId,
                    e.target.value,
                    cameraMode,
                  );
                }}
                disabled={busy || ready}
              >
                {microphones.map((device, index) => (
                  <option
                    key={device.deviceId}
                    value={device.deviceId}
                  >
                    {device.label || `마이크 ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {cameraMode === 'mask' && (
            <>
              <div className="section-kicker">
                얼굴 메쉬 안정화
              </div>

              <p className="muted-text">
                Relative Velocity smoothing 뒤에 위치 deadband와 순간속도 bypass를 적용합니다.
                위치 변화가 작으면 이전 좌표를 고정하지만, 프레임 간 순간 이동속도가
                velocity threshold를 넘으면 위치 threshold와 관계없이 현재 좌표를 즉시 반영합니다.
              </p>

              <div className="preview-badge">
                Relative Velocity · position deadband · instantaneous velocity bypass
              </div>

              <label>
                <span>
                  위치 threshold · {deadbandThreshold.toFixed(2)} px
                </span>
                <input
                  type="range"
                  min="0"
                  max="15"
                  step="0.25"
                  value={deadbandThreshold}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setDeadbandThreshold(value);
                    maskControllerRef.current
                      ?.setDeadbandThreshold(value);
                    setTrackingStatus(
                      maskControllerRef.current
                        ?.getTrackingStatus() ?? null,
                    );
                  }}
                  disabled={busy || ready}
                />
              </label>

              <label>
                <span>
                  순간속도 threshold · {velocityThreshold.toFixed(0)} px/s
                </span>
                <input
                  type="range"
                  min="0"
                  max="600"
                  step="10"
                  value={velocityThreshold}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setVelocityThreshold(value);
                    maskControllerRef.current
                      ?.setVelocityThreshold(value);
                    setTrackingStatus(
                      maskControllerRef.current
                        ?.getTrackingStatus() ?? null,
                    );
                  }}
                  disabled={busy || ready}
                />
              </label>

              <p className="muted-text">
                위치 threshold를 올리면 정지 시 미세 흔들림은 더 강하게 고정됩니다.
                순간속도 threshold보다 빠른 움직임은 위치 threshold를 무시하고 즉시 따라갑니다.
                순간속도 threshold를 낮출수록 빠른 움직임을 더 쉽게 bypass합니다.
              </p>

              <div className="device-grid">
                <label>
                  <span>추적 FPS</span>
                  <input
                    readOnly
                    value={
                      trackingStatus
                        ? trackingStatus.fps.toFixed(1)
                        : '-'
                    }
                  />
                </label>

                <label>
                  <span>추적 프레임 간격(ms)</span>
                  <input
                    readOnly
                    value={
                      trackingStatus
                        ? trackingStatus.frameIntervalMs.toFixed(1)
                        : '-'
                    }
                  />
                </label>

                <label>
                  <span>현재 deadband 유지율(%)</span>
                  <input
                    readOnly
                    value={
                      trackingStatus
                        ? (trackingStatus.deadbandHoldRatio * 100).toFixed(1)
                        : '-'
                    }
                  />
                </label>

                <label>
                  <span>현재 위치 threshold</span>
                  <input
                    readOnly
                    value={
                      trackingStatus
                        ? `${trackingStatus.deadbandThreshold.toFixed(2)} px`
                        : `${deadbandThreshold.toFixed(2)} px`
                    }
                  />
                </label>

                <label>
                  <span>현재 순간속도 threshold</span>
                  <input
                    readOnly
                    value={
                      trackingStatus
                        ? `${trackingStatus.velocityThreshold.toFixed(0)} px/s`
                        : `${velocityThreshold.toFixed(0)} px/s`
                    }
                  />
                </label>

                <label>
                  <span>속도 bypass 비율(%)</span>
                  <input
                    readOnly
                    value={
                      trackingStatus
                        ? (trackingStatus.velocityBypassRatio * 100).toFixed(1)
                        : '-'
                    }
                  />
                </label>
              </div>
            </>
          )}

          <div className="mic-meter-row">
            <span>마이크 입력</span>

            <div className="meter">
              <i
                style={{
                  width: `${Math.max(4, level)}%`,
                }}
              />
            </div>

            <strong>
              {level > 8 ? '정상' : '말해보세요'}
            </strong>
          </div>

          <button
            className="primary-button large"
            onClick={onReady}
            disabled={ready || disabled}
          >
            {ready ? '준비 완료됨' : '준비 완료'}
          </button>
        </>
      )}

      {error && <div className="error-box">{error}</div>}
    </section>
  );
}
