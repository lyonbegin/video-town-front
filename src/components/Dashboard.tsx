import { useEffect, useMemo, useState } from 'react';
import { createConsultation, listMyConsultations } from '../lib/api';
import type { AuthProfile, ConsultationSession, TelemedicineRole } from '../types';

function statusLabel(status: ConsultationSession['status']) {
  return ({ SCHEDULED: '예약', WAITING: '대기 중', READY: '준비 완료', LIVE: '진료 중', ENDED: '종료', CANCELLED: '취소' } as const)[status];
}

function formatTime(value?: string) {
  if (!value) return '시간 미정';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

export default function Dashboard({
  profile,
  onOpen,
  onLogout,
}: {
  profile: AuthProfile;
  onOpen: (session: ConsultationSession) => void;
  onLogout: () => void;
}) {
  const [sessions, setSessions] = useState<ConsultationSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('테스트 원격진료');
  const [patientIds, setPatientIds] = useState('patient-1');
  const [consultingDoctorIds, setConsultingDoctorIds] = useState('');
  const [creating, setCreating] = useState(false);

  const isClinical = profile.platformRole === 'doctor';
  const upcoming = useMemo(() => sessions.filter((s) => !['ENDED', 'CANCELLED'].includes(s.status)), [sessions]);
  const past = useMemo(() => sessions.filter((s) => ['ENDED', 'CANCELLED'].includes(s.status)), [sessions]);

  async function refresh() {
    setLoading(true); setError('');
    try { setSessions(await listMyConsultations(profile.token)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, [profile.token]);

  async function create() {
    setCreating(true); setError('');
    try {
      const participants: Array<{ userId: string; displayName?: string; role: TelemedicineRole }> = [];
      if (profile.platformRole === 'doctor') {
        participants.push({ userId: profile.userId, displayName: profile.name, role: 'DOCTOR' });
      } else {
        participants.push({ userId: 'doctor-1', displayName: '테스트 의사', role: 'DOCTOR' });
      }
      patientIds.split(',').map((v) => v.trim()).filter(Boolean).forEach((id, index) => participants.push({ userId: id, displayName: `환자 ${index + 1}`, role: 'PATIENT' }));
      consultingDoctorIds.split(',').map((v) => v.trim()).filter(Boolean).forEach((id, index) => participants.push({ userId: id, displayName: `협진의 ${index + 1}`, role: 'CONSULTING_DOCTOR' }));
      const session = await createConsultation(profile.token, {
        title: title.trim() || '원격진료',
        participants,
        maxParticipants: Math.max(4, participants.length),
      });
      setShowCreate(false);
      await refresh();
      onOpen(session);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-row dark"><span className="brand-mark">C</span><strong>CareLink</strong><span className="environment-chip">LOCAL</span></div>
        <div className="topbar-actions"><div className="user-summary"><b>{profile.name}</b><span>{profile.userId} · {profile.platformRole}</span></div><button className="ghost-button" onClick={onLogout}>로그아웃</button></div>
      </header>

      <div className="dashboard-head">
        <div><div className="section-kicker">오늘의 진료</div><h1>{profile.platformRole === 'user' ? '예약된 진료를 확인하세요' : '환자와 연결할 준비가 되었어요'}</h1><p>진료실 입장 전 카메라와 마이크를 먼저 점검합니다.</p></div>
        <div className="dashboard-actions"><button className="secondary-button" onClick={() => void refresh()}>새로고침</button>{isClinical && <button className="primary-button" onClick={() => setShowCreate(true)}>+ 테스트 진료 생성</button>}</div>
      </div>

      {error && <div className="error-box wide">{error}</div>}
      {loading ? <div className="empty-card">진료 목록을 불러오는 중…</div> : upcoming.length === 0 ? (
        <div className="empty-card"><div className="empty-icon">＋</div><h3>현재 예약된 진료가 없습니다</h3><p>{isClinical ? '테스트 진료를 하나 만들어보세요.' : '의사가 진료를 만든 뒤 새로고침하세요.'}</p></div>
      ) : (
        <section className="session-grid">
          {upcoming.map((session) => {
            const me = session.participants.find((p) => p.userId === profile.userId);
            const others = session.participants.filter((p) => p.userId !== profile.userId);
            return <article className="session-card" key={session.id} onClick={() => onOpen(session)}>
              <div className="card-top"><span className={`status-badge ${session.status.toLowerCase()}`}>{statusLabel(session.status)}</span><span>{formatTime(session.scheduledAt)}</span></div>
              <h3>{session.title || '원격진료'}</h3>
              <div className="participant-stack">{others.slice(0, 4).map((p) => <span key={p.userId} title={p.displayName || p.userId}>{(p.displayName || p.userId).slice(0,1)}</span>)}</div>
              <p>{others.map((p) => p.displayName || p.userId).join(', ') || '참가자 없음'}</p>
              <div className="card-bottom"><span>{me?.role || '참가자'}</span><button>진료실 열기 →</button></div>
            </article>;
          })}
        </section>
      )}

      {past.length > 0 && <section className="past-section"><h2>지난 진료</h2>{past.slice(0, 5).map((s) => <div className="past-row" key={s.id}><span>{s.title}</span><small>{statusLabel(s.status)}</small></div>)}</section>}

      {showCreate && <div className="modal-backdrop" onMouseDown={() => setShowCreate(false)}><div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head"><div><div className="section-kicker">개발 테스트</div><h2>원격진료 만들기</h2></div><button className="icon-button" onClick={() => setShowCreate(false)}>×</button></div>
        <label className="field"><span>진료 제목</span><input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="field"><span>환자 ID</span><input value={patientIds} onChange={(e) => setPatientIds(e.target.value)} placeholder="patient-1, patient-2" /><small>여러 명이면 쉼표로 구분합니다.</small></label>
        <label className="field"><span>협진 의사 ID (선택)</span><input value={consultingDoctorIds} onChange={(e) => setConsultingDoctorIds(e.target.value)} placeholder="doctor-2" /></label>
        <button className="primary-button large full" onClick={() => void create()} disabled={creating}>{creating ? '생성 중…' : '진료 생성하고 열기'}</button>
      </div></div>}
    </main>
  );
}
