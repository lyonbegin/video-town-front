import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createMaskedCameraStream,
  DEFAULT_MASK_TUNING,
  type CameraMode,
  type MaskedCameraController,
  type MaskTuning,
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
  const [postMinCutoff, setPostMinCutoff] = useState(
    DEFAULT_MASK_TUNING.postMinCutoff,
  );
  const [postBeta, setPostBeta] = useState(
    DEFAULT_MASK_TUNING.postBeta,
  );
  const [mindarMinCutoff, setMindarMinCutoff] = useState(
    DEFAULT_MASK_TUNING.mindarMinCutoff,
  );
  const [mindarBeta, setMindarBeta] = useState(
    DEFAULT_MASK_TUNING.mindarBeta,
  );

  const currentTuning = (): MaskTuning => ({
    postMinCutoff,
    postBeta,
    mindarMinCutoff,
    mindarBeta,
  });

  useEffect(() => {
    if (previewRef.current) previewRef.current.srcObject = stream ?? null;
  }, [stream]);

  useEffect(() => {
    if (!stream?.getAudioTracks().length) {
      setLevel(0);
      return;
    }

    const Context = window.AudioContext || (window as any).webkitAudioContext;
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
    nextTuning: MaskTuning = currentTuning(),
  ) {
    setBusy(true);
    setError('');

    try {
      // Stop only the previous client camera pipeline.
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
          const controller = await createMaskedCameraStream(
            raw,
            nextTuning,
          );
          maskControllerRef.current = controller;
          outgoing = controller.stream;
        } catch (maskError) {
          raw.getTracks().forEach((track) => track.stop());
          throw maskError;
        }
      }

      onStream(outgoing);

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      setDevices(allDevices);

      // Device IDs must be read from the physical source, not the canvas track.
      const videoSettings = raw.getVideoTracks()[0]?.getSettings();
      const audioSettings = raw.getAudioTracks()[0]?.getSettings();

      if (videoSettings?.deviceId) setCameraId(videoSettings.deviceId);
      if (audioSettings?.deviceId) setMicId(audioSettings.deviceId);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
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
        복면 모드는 이 브라우저에서 얼굴을 가린 뒤 기존 WebRTC 서버로 전송합니다.
        Fly 서버와 mediasoup 프로토콜은 그대로 사용합니다.
      </p>

      <div className="camera-mode-selector">
        <button
          type="button"
          className={`camera-mode-button ${cameraMode === 'mask' ? 'active' : ''}`}
          onClick={() => void changeMode('mask')}
          disabled={busy || ready || disabled}
        >
          <strong>🎭 복면</strong>
          <span>얼굴을 종이 가면으로 가려서 전송</span>
        </button>

        <button
          type="button"
          className={`camera-mode-button ${cameraMode === 'original' ? 'active' : ''}`}
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
              {cameraMode === 'mask' ? '🎭 복면 송출 화면' : '📹 얼굴 공개 화면'}
            </div>
          </div>

          <div className="device-grid">
            <label>
              <span>카메라</span>
              <select
                value={cameraId}
                onChange={(e) => {
                  setCameraId(e.target.value);
                  void acquire(e.target.value, micId, cameraMode);
                }}
                disabled={busy || ready}
              >
                {cameras.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
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
                  void acquire(cameraId, e.target.value, cameraMode);
                }}
                disabled={busy || ready}
              >
                {microphones.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `마이크 ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {cameraMode === 'mask' && (
            <>
              <div className="section-kicker">복면 추적 필터 수동 조정</div>

              <div className="device-grid">
                <label>
                  <span>추가 One Euro · minCutOff</span>
                  <input
                    type="number"
                    min="0.00005"
                    max="0.1"
                    step="0.0001"
                    value={postMinCutoff}
                    onChange={(e) =>
                      setPostMinCutoff(Number(e.target.value))
                    }
                    disabled={busy || ready}
                  />
                </label>

                <label>
                  <span>추가 One Euro · beta</span>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    step="0.1"
                    value={postBeta}
                    onChange={(e) =>
                      setPostBeta(Number(e.target.value))
                    }
                    disabled={busy || ready}
                  />
                </label>
              </div>

              <div className="device-grid">
                <label>
                  <span>MindAR 원본 필터 · minCutOff</span>
                  <input
                    type="number"
                    min="0.00005"
                    max="0.1"
                    step="0.0001"
                    value={mindarMinCutoff}
                    onChange={(e) =>
                      setMindarMinCutoff(Number(e.target.value))
                    }
                    disabled={busy || ready}
                  />
                </label>

                <label>
                  <span>MindAR 원본 필터 · beta</span>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    step="0.1"
                    value={mindarBeta}
                    onChange={(e) =>
                      setMindarBeta(Number(e.target.value))
                    }
                    disabled={busy || ready}
                  />
                </label>
              </div>

              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  void acquire(
                    cameraId,
                    micId,
                    'mask',
                    currentTuning(),
                  )
                }
                disabled={busy || ready || disabled}
              >
                {busy ? '필터 적용 중…' : '필터 값 적용'}
              </button>

              <p className="muted-text">
                추가 필터 기본값: minCutOff 0.0007 / beta 3.0 ·
                MindAR 원본 기본값: minCutOff 0.001 / beta 1.0
              </p>
            </>
          )}

          <div className="mic-meter-row">
            <span>마이크 입력</span>
            <div className="meter">
              <i style={{ width: `${Math.max(4, level)}%` }} />
            </div>
            <strong>{level > 8 ? '정상' : '말해보세요'}</strong>
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
