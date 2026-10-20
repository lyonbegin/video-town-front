import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createMaskedCameraStream,
  DEFAULT_GLOBAL_THRESHOLD_PX,
  DEFAULT_GATE_VERIFICATION_HZ,
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
  const [globalThresholdPx, setGlobalThresholdPx] =
    useState(DEFAULT_GLOBAL_THRESHOLD_PX);
  const [verificationHz, setVerificationHz] =
    useState(DEFAULT_GATE_VERIFICATION_HZ);
  const [autoTuningEnabled, setAutoTuningEnabled] =
    useState(true);
  const [debugSession, setDebugSession] =
    useState<{
      sessionId: string;
      downloadUrl: string;
      summaryUrl: string;
      startedAt: string;
    } | null>(null);

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
    setDebugSession(null);

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
          controller.setGlobalThresholdPx(
            globalThresholdPx,
          );
          controller.setVerificationHz(
            verificationHz,
          );
          controller.setAutoTuningEnabled(
            autoTuningEnabled,
          );
          outgoing = controller.stream;
          setTrackingStatus(controller.getTrackingStatus());
          setDebugSession(controller.getDebugSession());
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
                실시간 로그와 동일한 측정값으로 자동 튜닝합니다. 안정적인 얼굴 기준점의
                frame-to-frame 노이즈를 계속 학습해 전체 움직임 threshold를 수렴시키고,
                입·눈썹·턱의 상대 변형은 별도 expression threshold로 통과시켜 표정 변화가
                전체 안정화 threshold 때문에 막히지 않도록 분리했습니다.
              </p>

              <div className="preview-badge">
                adaptive noise floor · rigid motion gate · expression bypass
              </div>

              <label>
                <span>
                  자동 threshold 튜닝 · {autoTuningEnabled ? 'ON' : 'OFF'}
                </span>
                <input
                  type="checkbox"
                  checked={autoTuningEnabled}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setAutoTuningEnabled(enabled);
                    maskControllerRef.current
                      ?.setAutoTuningEnabled(enabled);
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
                  수동 전체 threshold · {globalThresholdPx.toFixed(2)} px
                </span>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.25"
                  value={globalThresholdPx}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setGlobalThresholdPx(value);
                    maskControllerRef.current
                      ?.setGlobalThresholdPx(value);
                    setTrackingStatus(
                      maskControllerRef.current
                        ?.getTrackingStatus() ?? null,
                    );
                  }}
                  disabled={busy || ready || autoTuningEnabled}
                />
              </label>

              <label>
                <span>
                  검증 횟수 · {verificationHz.toFixed(0)} 회/초
                </span>
                <input
                  type="range"
                  min="3"
                  max="30"
                  step="1"
                  value={verificationHz}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setVerificationHz(value);
                    maskControllerRef.current
                      ?.setVerificationHz(value);
                    setTrackingStatus(
                      maskControllerRef.current
                        ?.getTrackingStatus() ?? null,
                    );
                  }}
                  disabled={busy || ready}
                />
              </label>

              <p className="muted-text">
                자동 튜닝 ON에서는 수동 threshold를 사용하지 않고, 측정된 noise floor와
                정지 상태 오검출률을 이용해 threshold가 계속 올라가거나 내려갑니다.
                표정 변화는 별도 expression threshold로 판정합니다.
              </p>

              <div className="section-kicker">
                진단 로그
              </div>

              <p className="muted-text">
                복면 카메라가 켜진 동안 raw 468 좌표, smoothing 후 468 좌표,
                핵심 20개 포인트별 이동량, gate 판정, estimator 결과,
                faceMatrix와 처리시간을 시간순으로 Railway 로그 파일에 자동 기록합니다.
              </p>

              {debugSession && (
                <div className="device-grid">
                  <label>
                    <span>진단 세션 ID</span>
                    <input
                      readOnly
                      value={debugSession.sessionId}
                    />
                  </label>

                  <label>
                    <span>로그 시작 시각</span>
                    <input
                      readOnly
                      value={debugSession.startedAt}
                    />
                  </label>

                  <a
                    className="primary-button"
                    href={debugSession.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    진단 로그 다운로드
                  </a>

                  <a
                    className="primary-button"
                    href={debugSession.summaryUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    자동 분석 요약 보기
                  </a>
                </div>
              )}

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
                  <span>현재 자동 threshold</span>
                  <input
                    readOnly
                    value={
                      trackingStatus
                        ? `${trackingStatus.globalThresholdPx.toFixed(2)} px`
                        : '-'
                    }
                  />
                </label>

                <label>
                  <span>목표 threshold</span>
                  <input
                    readOnly
                    value={
                      trackingStatus
                        ? `${trackingStatus.targetThresholdPx.toFixed(2)} px`
                        : '-'
                    }
                  />
                </label>

                <label>
                  <span>noise floor</span>
                  <input
                    readOnly
                    value={
                      trackingStatus
                        ? `${trackingStatus.noiseFloorPx.toFixed(2)} px`
                        : '-'
                    }
                  />
                </label>

                <label>
                  <span>표정 threshold</span>
                  <input
                    readOnly
                    value={
                      trackingStatus
                        ? `${trackingStatus.expressionThresholdPx.toFixed(2)} px`
                        : '-'
                    }
                  />
                </label>

                <label>
                  <span>표정 signal</span>
                  <input
                    readOnly
                    value={
                      trackingStatus
                        ? `${trackingStatus.expressionSignalPx.toFixed(2)} px`
                        : '-'
                    }
                  />
                </label>

                <label>
                  <span>전체 움직임 signal</span>
                  <input
                    readOnly
                    value={
                      trackingStatus
                        ? `${trackingStatus.rigidSignalPx.toFixed(2)} px`
                        : '-'
                    }
                  />
                </label>

                <label>
                  <span>자동학습 진행률</span>
                  <input
                    readOnly
                    value={
                      trackingStatus
                        ? `${(trackingStatus.autoTuneConfidence * 100).toFixed(0)}%`
                        : '-'
                    }
                  />
                </label>

                <label>
                  <span>정지 오적용률</span>
                  <input
                    readOnly
                    value={
                      trackingStatus
                        ? `${(trackingStatus.staticAcceptRate * 100).toFixed(1)}%`
                        : '-'
                    }
                  />
                </label>

                <label>
                  <span>전체 갱신률</span>
                  <input
                    readOnly
                    value={
                      trackingStatus
                        ? `${(trackingStatus.outputUpdateRate * 100).toFixed(1)}%`
                        : '-'
                    }
                  />
                </label>

                <label>
                  <span>현재 판정</span>
                  <input
                    readOnly
                    value={
                      trackingStatus
                        ? `${trackingStatus.gateAccepted ? '적용' : '고정'} / ${trackingStatus.gateReason}`
                        : '-'
                    }
                  />
                </label>

                <label>
                  <span>마지막 적용 후</span>
                  <input
                    readOnly
                    value={
                      trackingStatus
                        ? `${trackingStatus.timeSinceLastAcceptMs.toFixed(0)} ms`
                        : '-'
                    }
                  />
                </label>

                <label>
                  <span>검증 설정</span>
                  <input
                    readOnly
                    value={
                      trackingStatus
                        ? `${trackingStatus.verificationHz.toFixed(0)} 회/초`
                        : `${verificationHz.toFixed(0)} 회/초`
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
