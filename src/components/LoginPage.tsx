import { useEffect, useState } from 'react';
import { API_BASE_URL, getHealth, issueDevToken } from '../lib/api';
import type { AuthProfile, PlatformRole } from '../types';

export default function LoginPage({ onLogin }: { onLogin: (profile: AuthProfile) => void }) {
  const [userId, setUserId] = useState('doctor-1');
  const [name, setName] = useState('테스트 의사');
  const [role, setRole] = useState<PlatformRole>('doctor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverOk, setServerOk] = useState<boolean | null>(null);

  useEffect(() => {
    getHealth().then(() => setServerOk(true)).catch(() => setServerOk(false));
  }, []);

  function applyPreset(next: 'doctor' | 'patient' | 'doctor2') {
    if (next === 'doctor') {
      setUserId('doctor-1'); setName('테스트 의사'); setRole('doctor');
    } else if (next === 'patient') {
      setUserId('patient-1'); setName('테스트 환자'); setRole('user');
    } else {
      setUserId('doctor-2'); setName('협진 의사'); setRole('doctor');
    }
  }

  async function submit() {
    setLoading(true);
    setError('');
    try {
      const profile = await issueDevToken({ userId: userId.trim(), name: name.trim(), platformRole: role });
      onLogin(profile);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-hero">
        <div className="brand-row"><span className="brand-mark">C</span><strong>CareLink</strong></div>
        <div>
          <div className="section-kicker light">Realtime Care Platform</div>
          <h1>진료는 간단하게,<br />연결은 안정적으로.</h1>
          <p>원격진료를 첫 Wrapper로 사용하는 범용 실시간 세션 클라이언트입니다. 협진과 다자 진료까지 같은 미디어 코어에서 처리합니다.</p>
        </div>
        <div className="hero-points">
          <span>다대다 SFU</span><span>대기실</span><span>장치 사전 점검</span><span>재연결</span>
        </div>
      </section>

      <section className="login-panel">
        <div className="server-pill">
          <i className={serverOk === true ? 'ok' : serverOk === false ? 'bad' : ''} />
          {serverOk === true ? '로컬 서버 연결됨' : serverOk === false ? '서버 연결 실패' : '서버 확인 중'}
          <small>{API_BASE_URL}</small>
        </div>
        <h2>개발 테스트 로그인</h2>
        <p className="muted-text">현재는 로컬 개발 토큰을 사용합니다. 실제 서비스에서는 기존 인증 시스템으로 교체합니다.</p>

        <div className="preset-row">
          <button onClick={() => applyPreset('doctor')} className={userId === 'doctor-1' ? 'active' : ''}>주치의</button>
          <button onClick={() => applyPreset('patient')} className={userId === 'patient-1' ? 'active' : ''}>환자</button>
          <button onClick={() => applyPreset('doctor2')} className={userId === 'doctor-2' ? 'active' : ''}>협진의</button>
        </div>

        <label className="field"><span>사용자 ID</span><input value={userId} onChange={(e) => setUserId(e.target.value)} /></label>
        <label className="field"><span>표시 이름</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field"><span>플랫폼 권한</span>
          <select value={role} onChange={(e) => setRole(e.target.value as PlatformRole)}>
            <option value="doctor">doctor</option><option value="user">user</option><option value="staff">staff</option><option value="admin">admin</option>
          </select>
        </label>

        <button className="primary-button large full" onClick={submit} disabled={loading || !userId.trim()}>{loading ? '로그인 중…' : '테스트 로그인'}</button>
        {error && <div className="error-box">{error}</div>}
        <div className="login-tip">두 사람 테스트 시 <b>일반 창=의사</b>, <b>시크릿 창=환자</b>로 접속하면 가장 쉽습니다.</div>
      </section>
    </main>
  );
}
