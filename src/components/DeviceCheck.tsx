import { useEffect, useMemo, useRef, useState } from 'react';

interface Props {
  stream?: MediaStream;
  onStream: (stream: MediaStream) => void;
  onReady: () => void;
  ready: boolean;
  disabled?: boolean;
}

export default function DeviceCheck({ stream, onStream, onReady, ready, disabled }: Props) {
  const previewRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState('');
  const [micId, setMicId] = useState('');
  const [level, setLevel] = useState(0);

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
    const source = context.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((sum, value) => sum + value, 0) / Math.max(1, data.length);
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

  const cameras = useMemo(() => devices.filter((d) => d.kind === 'videoinput'), [devices]);
  const microphones = useMemo(() => devices.filter((d) => d.kind === 'audioinput'), [devices]);

  async function acquire(nextCameraId = cameraId, nextMicId = micId) {
    setBusy(true);
    setError('');
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        video: nextCameraId
          ? { deviceId: { exact: nextCameraId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: nextMicId
          ? { deviceId: { exact: nextMicId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          : { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      stream?.getTracks().forEach((track) => track.stop());
      onStream(next);
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      setDevices(allDevices);
      const videoSettings = next.getVideoTracks()[0]?.getSettings();
      const audioSettings = next.getAudioTracks()[0]?.getSettings();
      if (videoSettings?.deviceId) setCameraId(videoSettings.deviceId);
      if (audioSettings?.deviceId) setMicId(audioSettings.deviceId);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(`카메라 또는 마이크를 사용할 수 없습니다. 브라우저 권한을 확인해주세요. (${message})`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="device-card">
      <div className="section-kicker">진료 전 장치 확인</div>
      <h2>카메라와 마이크를 확인해주세요</h2>
      <p className="muted-text">권한 요청은 이 버튼을 눌렀을 때만 나타납니다. 한 번 허용하면 같은 사이트에서는 보통 다시 묻지 않습니다.</p>

      {!stream ? (
        <button className="primary-button large" onClick={() => acquire()} disabled={busy || disabled}>
          {busy ? '장치 연결 중…' : '카메라·마이크 확인 시작'}
        </button>
      ) : (
        <>
          <div className="device-preview-wrap">
            <video ref={previewRef} autoPlay playsInline muted className="device-preview" />
            <div className="preview-badge">내 화면</div>
          </div>

          <div className="device-grid">
            <label>
              <span>카메라</span>
              <select value={cameraId} onChange={(e) => { setCameraId(e.target.value); void acquire(e.target.value, micId); }} disabled={busy || ready}>
                {cameras.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `카메라 ${index + 1}`}</option>)}
              </select>
            </label>
            <label>
              <span>마이크</span>
              <select value={micId} onChange={(e) => { setMicId(e.target.value); void acquire(cameraId, e.target.value); }} disabled={busy || ready}>
                {microphones.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `마이크 ${index + 1}`}</option>)}
              </select>
            </label>
          </div>

          <div className="mic-meter-row">
            <span>마이크 입력</span>
            <div className="meter"><i style={{ width: `${Math.max(4, level)}%` }} /></div>
            <strong>{level > 8 ? '정상' : '말해보세요'}</strong>
          </div>

          <button className="primary-button large" onClick={onReady} disabled={ready || disabled}>
            {ready ? '준비 완료됨' : '준비 완료'}
          </button>
        </>
      )}
      {error && <div className="error-box">{error}</div>}
    </section>
  );
}
