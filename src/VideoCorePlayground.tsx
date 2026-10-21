import { useEffect, useState } from 'react';
import DeviceCheck from './components/DeviceCheck';

export default function VideoCorePlayground() {
  const [stream, setStream] = useState<MediaStream>();

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [stream]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-row dark">
          <span className="brand-mark">V</span>
          <strong>Video Core Playground</strong>
          <span className="environment-chip">DEV</span>
        </div>
      </header>

      <div className="dashboard-head">
        <div>
          <div className="section-kicker">VIDEO CORE</div>
          <h1>영상·마스크 개발 테스트</h1>
          <p>
            인증이나 진료 세션 없이 카메라, 마이크, 마스크 추적,
            안정화와 진단 로그만 직접 테스트합니다.
          </p>
        </div>
      </div>

      <DeviceCheck
        stream={stream}
        onStream={setStream}
        onReady={() => undefined}
        ready={false}
        showReadyButton={false}
      />
    </main>
  );
}
