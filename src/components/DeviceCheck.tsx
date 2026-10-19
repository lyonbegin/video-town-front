import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createMaskedCameraStream,
  DEFAULT_MASK_TUNING,
  type CalibrationResult,
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
  const [minCutoff, setMinCutoff] = useState(
    DEFAULT_MASK_TUNING.minCutoff,
  );
  const [beta, setBeta] = useState(
    DEFAULT_MASK_TUNING.beta,
  );
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationStartedAt, setCalibrationStartedAt] = useState(0);
  const [calibrationElapsed, setCalibrationElapsed] = useState(0);
  const [calibrationSamples, setCalibrationSamples] = useState(0);
  const [calibrationResult, setCalibrationResult] =
    useState<CalibrationResult | null>(null);
  const [calibrationMessage, setCalibrationMessage] = useState('');

  const currentTuning = (): MaskTuning => ({
    minCutoff,
    beta,
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

  useEffect(() => {
    if (!calibrating) {
      setCalibrationElapsed(0);
      return;
    }

    const update = () => {
      setCalibrationElapsed(
        Math.max(0, (performance.now() - calibrationStartedAt) / 1000),
      );

      setCalibrationSamples(
        maskControllerRef.current?.getCalibrationSampleCount() ?? 0,
      );
    };

    update();
    const timer = window.setInterval(update, 200);

    return () => window.clearInterval(timer);
  }, [calibrating, calibrationStartedAt]);

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
    setCalibrating(false);

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

  function startAutoCalibration() {
    const controller = maskControllerRef.current;

    if (!controller || cameraMode !== 'mask') {
      setCalibrationMessage('복면 카메라를 먼저 시작해주세요.');
      return;
    }

    setCalibrationResult(null);
    setCalibrationMessage(
      '녹화 중입니다. 처음에는 잠깐 정면으로 가만히 있고, 이어서 좌우·상하로 자연스럽게 움직여주세요.',
    );
    setCalibrationSamples(0);
    setCalibrationStartedAt(performance.now());
    controller.startCalibration();
    setCalibrating(true);
  }

  async function finishAutoCalibration() {
    const controller = maskControllerRef.current;

    if (!controller || !calibrating) return;

    setCalibrating(false);
    setCalibrationMessage('녹화를 끝냈습니다. 최적 필터 값을 계산하고 있습니다…');

    // Let React paint the analysis state before the synchronous replay search.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );

    try {
      const result = controller.finishCalibration();

      setCalibrationResult(result);
      setMinCutoff(result.tuning.minCutoff);
      setBeta(result.tuning.beta);

      setCalibrationMessage(
        `자동 캘리브레이션 완료 · ${result.sampleCount}프레임 · ${(
          result.durationMs / 1000
        ).toFixed(1)}초 · score ${result.score.toFixed(6)}`,
      );

      // Restart the MindAR pipeline once with the chosen single filter values.
      await acquire(
        cameraId,
        micId,
        'mask',
        result.tuning,
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setCalibrationMessage(`자동 캘리브레이션 실패: ${message}`);
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
                  <span>MindAR One Euro · minCutOff</span>
                  <input
                    type="number"
                    min="0.00005"
                    max="0.1"
                    step="0.0001"
                    value={minCutoff}
                    onChange={(e) =>
                      setMinCutoff(Number(e.target.value))
                    }
                    disabled={busy || ready}
                  />
                </label>

                <label>
                  <span>MindAR One Euro · beta</span>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    step="0.1"
                    value={beta}
                    onChange={(e) =>
                      setBeta(Number(e.target.value))
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
                실시간 보간 필터는 MindAR One Euro 하나만 사용합니다.
                기본값: minCutOff 0.001 / beta 1.0
              </p>

              <div className="section-kicker">자동 캘리브레이션</div>

              <p className="muted-text">
                시작 버튼부터 끝 버튼까지 실제 얼굴 landmark를 녹화한 뒤,
                같은 녹화 데이터를 MindAR One Euro의 minCutOff / beta
                조합으로 반복 계산해서 지터와 추적 오차가 가장 작은 값을 찾습니다.
              </p>

              <div className="camera-mode-selector">
                <button
                  type="button"
                  className={`camera-mode-button ${calibrating ? 'active' : ''}`}
                  onClick={startAutoCalibration}
                  disabled={
                    busy ||
                    ready ||
                    disabled ||
                    calibrating ||
                    !maskControllerRef.current
                  }
                >
                  <strong>● 캘리브레이션 시작</strong>
                  <span>얼굴 포인트 녹화 시작</span>
                </button>

                <button
                  type="button"
                  className="camera-mode-button"
                  onClick={() => void finishAutoCalibration()}
                  disabled={
                    busy ||
                    ready ||
                    disabled ||
                    !calibrating
                  }
                >
                  <strong>■ 캘리브레이션 끝</strong>
                  <span>녹화 종료 후 자동 분석·적용</span>
                </button>
              </div>

              {calibrating && (
                <p className="muted-text">
                  녹화 중 · {calibrationElapsed.toFixed(1)}초 ·
                  {' '}{calibrationSamples}프레임
                </p>
              )}

              {calibrationMessage && (
                <div className="preview-badge">
                  {calibrationMessage}
                </div>
              )}

              {calibrationResult && (
                <div className="device-grid">
                  <label>
                    <span>자동 결과 · tracking error</span>
                    <input
                      readOnly
                      value={calibrationResult.trackingError.toFixed(6)}
                    />
                  </label>

                  <label>
                    <span>자동 결과 · stationary jitter</span>
                    <input
                      readOnly
                      value={calibrationResult.stationaryJitter.toFixed(6)}
                    />
                  </label>
                </div>
              )}
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
