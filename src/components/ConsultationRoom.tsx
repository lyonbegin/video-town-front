import { useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { API_BASE_URL, refreshDevProfile } from '../lib/api';
import { MediasoupSession } from '../realtime/MediasoupSession';
import { createRealtimeSocket, emitAck, waitForSocketReady } from '../realtime/socket';
import type { AuthProfile, ConsultationSession, RemoteTile } from '../types';
import DeviceCheck from './DeviceCheck';
import VideoTile from './VideoTile';

function roleLabel(role?: string) {
  return ({
    DOCTOR: '주치의',
    CONSULTING_DOCTOR: '협진의',
    NURSE: '간호사',
    PATIENT: '환자',
    GUARDIAN: '보호자',
    INTERPRETER: '통역사',
  } as Record<string, string>)[role || ''] || role || '참가자';
}

function statusLabel(status: ConsultationSession['status']) {
  return ({ SCHEDULED: '예약됨', WAITING: '대기 중', READY: '준비 완료', LIVE: '진료 중', ENDED: '진료 종료', CANCELLED: '취소됨' } as const)[status];
}

export default function ConsultationRoom({
  profile,
  initialSession,
  onBack,
}: {
  profile: AuthProfile;
  initialSession: ConsultationSession;
  onBack: () => void;
}) {
  const [session, setSession] = useState(initialSession);
  const [socketState, setSocketState] = useState<'connecting' | 'connected' | 'reconnecting' | 'failed'>('connecting');
  const [localStream, setLocalStream] = useState<MediaStream>();
  const [localScreen, setLocalScreen] = useState<MediaStream>();
  const [remoteTiles, setRemoteTiles] = useState<RemoteTile[]>([]);
  const [ready, setReady] = useState(false);
  const [rtcStarted, setRtcStarted] = useState(false);
  const [rtcStatus, setRtcStatus] = useState('대기실');
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const socketRef = useRef<Socket>();
  const engineRef = useRef<MediasoupSession>();
  const joinedRef = useRef(false);
  const liveRef = useRef(false);
  const localStreamRef = useRef<MediaStream>();
  const authRefreshInFlightRef =
    useRef(false);

  const me = useMemo(() => session.participants.find((p) => p.userId === profile.userId), [session, profile.userId]);
  const isHost = session.hostUserIds.includes(profile.userId);
  const canShareScreen = Boolean(me?.permissions.shareScreen);
  const displayByUser = useMemo(() => new Map(session.participants.map((p) => [p.userId, p.displayName || p.userId])), [session.participants]);

  useEffect(() => { liveRef.current = session.status === 'LIVE'; }, [session.status]);
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

  useEffect(() => {
    let cancelled = false;
    const base = initialSession.mediaNodePublicUrl || API_BASE_URL;
    const socket = createRealtimeSocket(base, profile.token);
    socketRef.current = socket;

    const refreshState = async () => {
      if (!joinedRef.current || !socket.connected) return;
      try {
        const data = await emitAck<{ session: ConsultationSession }>(socket, 'session:get-state', { sessionId: initialSession.id });
        if (!cancelled) setSession(data.session);
      } catch {}
    };

    const onStarted = (payload: { session: ConsultationSession }) => {
      if (payload.session.id !== initialSession.id) return;
      setSession(payload.session);
      liveRef.current = true;
      if (localStreamRef.current) void enterRtc(socket, localStreamRef.current);
    };
    const onEnded = (payload: { session: ConsultationSession }) => {
      if (payload.session.id !== initialSession.id) return;
      setSession(payload.session);
      liveRef.current = false;
      setRtcStarted(false);
      void engineRef.current?.dispose(false);
      engineRef.current = undefined;
      setRtcStatus('진료가 종료되었습니다');
    };
    const onConnectionReady = async () => {
      setSocketState('connected');
      if (!joinedRef.current) return;
      try {
        await emitAck(socket, 'session:join', { sessionId: initialSession.id });
        if (engineRef.current?.isStarted() && liveRef.current) {
          const resumed = await engineRef.current.resumeSignaling();
          if (!resumed && localStreamRef.current) {
            await engineRef.current.dispose(false);
            const rebuilt = new MediasoupSession(socket, initialSession.id, setRemoteTiles, setRtcStatus);
            engineRef.current = rebuilt;
            await rebuilt.start(localStreamRef.current, false);
            setRtcStarted(true);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    };
    const onDisconnect = () => setSocketState('reconnecting');
    const onConnectError = (error: Error) => {
      setSocketState('failed');

      const message =
        error?.message || '';

      if (
        /token|expired|unauthor|auth/i.test(
          message,
        ) &&
        !authRefreshInFlightRef.current
      ) {
        authRefreshInFlightRef.current =
          true;

        void refreshDevProfile(
          profile,
        )
          .catch((refreshError) => {
            if (!cancelled) {
              setError(
                refreshError instanceof Error
                  ? refreshError.message
                  : String(
                      refreshError,
                    ),
              );
            }
          })
          .finally(() => {
            authRefreshInFlightRef.current =
              false;
          });
      }
    };
    const stateEvents = ['session:participant-joined', 'session:participant-ready', 'session:participant-disconnected', 'session:participant-left', 'rtc:peer-joined', 'rtc:peer-resumed', 'rtc:peer-left'];

    socket.on('session:started', onStarted);
    socket.on('session:ended', onEnded);
    socket.on('connection:ready', onConnectionReady);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    stateEvents.forEach((event) => socket.on(event, refreshState));

    void (async () => {
      try {
        await waitForSocketReady(socket);
        const data = await emitAck<{ session: ConsultationSession }>(socket, 'session:join', { sessionId: initialSession.id });
        joinedRef.current = true;
        if (!cancelled) {
          setSession(data.session);
          liveRef.current = data.session.status === 'LIVE';
          const mine = data.session.participants.find((p) => p.userId === profile.userId);
          setReady(Boolean(mine?.ready));
          setSocketState('connected');
        }
      } catch (e) {
        if (!cancelled) {
          setSocketState('failed');
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();

    return () => {
      cancelled = true;
      stateEvents.forEach((event) => socket.off(event, refreshState));
      socket.off('session:started', onStarted);
      socket.off('session:ended', onEnded);
      socket.off('connection:ready', onConnectionReady);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      void engineRef.current?.dispose(false);
      engineRef.current = undefined;
      socket.disconnect();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localScreen?.getTracks().forEach((track) => track.stop());
    };
    // Session identity is intentionally fixed while this screen is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSession.id, profile.token]);

  async function enterRtc(socket = socketRef.current, stream = localStream) {
    if (!socket || !stream || engineRef.current?.isStarted()) return;
    setBusy(true); setError('');
    try {
      const engine = new MediasoupSession(socket, session.id, setRemoteTiles, setRtcStatus);
      engineRef.current = engine;
      await engine.start(stream, false);
      setRtcStarted(true);
    } catch (e) {
      engineRef.current = undefined;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function markReady() {
    const socket = socketRef.current;
    if (!socket || !localStream) return;
    setBusy(true); setError('');
    try {
      const data = await emitAck<{ session: ConsultationSession }>(socket, 'session:ready', { sessionId: session.id, ready: true });
      setReady(true);
      setSession(data.session);
      if (data.session.status === 'LIVE') await enterRtc(socket, localStream);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  async function startSession() {
    const socket = socketRef.current;
    if (!socket || !localStream) return;
    setBusy(true); setError('');
    try {
      if (!ready) {
        const readyData = await emitAck<{ session: ConsultationSession }>(socket, 'session:ready', { sessionId: session.id, ready: true });
        setReady(true); setSession(readyData.session);
      }
      const data = await emitAck<{ session: ConsultationSession }>(socket, 'session:start', { sessionId: session.id });
      setSession(data.session);
      liveRef.current = true;
      await enterRtc(socket, localStream);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  async function leaveSession() {
    setBusy(true);
    try {
      const socket = socketRef.current;
      if (socket?.connected) await emitAck(socket, 'session:leave', { sessionId: session.id }, 5000).catch(() => undefined);
      await engineRef.current?.dispose(false);
      engineRef.current = undefined;
      localStream?.getTracks().forEach((track) => track.stop());
      localScreen?.getTracks().forEach((track) => track.stop());
      socket?.disconnect();
      onBack();
    } finally { setBusy(false); }
  }

  async function endSession() {
    const socket = socketRef.current;
    if (!socket) return;
    if (!window.confirm('모든 참가자의 진료를 종료할까요?')) return;
    setBusy(true); setError('');
    try {
      const data = await emitAck<{ session: ConsultationSession }>(socket, 'session:end', { sessionId: session.id });
      setSession(data.session);
      await engineRef.current?.dispose(false);
      engineRef.current = undefined;
      setRtcStarted(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  async function toggleMic() {
    const next = !micEnabled;
    setMicEnabled(next);
    try { await engineRef.current?.setMicrophoneEnabled(next); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  async function toggleCamera() {
    const next = !cameraEnabled;
    setCameraEnabled(next);
    try { await engineRef.current?.setCameraEnabled(next); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  async function toggleScreen() {
    try {
      if (localScreen) {
        await engineRef.current?.stopScreenShare();
        localScreen.getTracks().forEach((track) => track.stop());
        setLocalScreen(undefined);
      } else {
        const stream = await engineRef.current?.startScreenShare();
        if (stream) {
          setLocalScreen(stream);
          stream.getVideoTracks()[0]?.addEventListener('ended', () => setLocalScreen(undefined), { once: true });
        }
      }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  const participantReadyCount = session.participants.filter((p) => p.ready).length;
  const remoteCount = remoteTiles.filter((tile) => tile.source === 'camera').length;

  if (session.status === 'ENDED' || session.status === 'CANCELLED') {
    return <main className="room-shell ended-screen"><div className="ended-card"><div className="ended-icon">✓</div><div className="section-kicker">Session closed</div><h1>{session.status === 'ENDED' ? '진료가 종료되었습니다' : '진료가 취소되었습니다'}</h1><p>미디어 연결과 임시 RTC 리소스가 정리되었습니다.</p><button className="primary-button large" onClick={onBack}>진료 목록으로</button></div></main>;
  }

  if (rtcStarted && session.status === 'LIVE') {
    const videoTiles = remoteTiles;
    return (
      <main className="call-shell">
        <header className="call-topbar">
          <div><div className="brand-row dark compact"><span className="brand-mark">C</span><strong>CareLink</strong></div><span className="call-title">{session.title}</span></div>
          <div className="call-status"><i className={socketState === 'connected' ? 'ok' : 'warn'} />{socketState === 'connected' ? rtcStatus : '재연결 중…'}<small>{remoteCount + 1}명 연결</small></div>
        </header>

        <div className="call-body">
          <section className={`video-grid count-${Math.min(6, videoTiles.length + 1 + (localScreen ? 1 : 0))}`}>
            <VideoTile stream={localStream} label={profile.name} muted local />
            {localScreen && <VideoTile stream={localScreen} label={`${profile.name}의 화면`} muted local screen />}
            {videoTiles.map((tile) => <VideoTile key={tile.key} stream={tile.stream} label={displayByUser.get(tile.userId) || tile.userId} screen={tile.source === 'screen'} />)}
          </section>

          <aside className="participant-panel">
            <div className="panel-title"><b>참가자</b><span>{session.participants.length}</span></div>
            {session.participants.map((participant) => <div className="participant-row" key={participant.userId}>
              <div className="small-avatar">{(participant.displayName || participant.userId).slice(0,1)}</div>
              <div><b>{participant.displayName || participant.userId}</b><span>{roleLabel(participant.role)}</span></div>
              <i className={`presence-dot ${participant.presence.toLowerCase()}`} title={participant.presence} />
            </div>)}
          </aside>
        </div>

        <div className="call-controls">
          <button className={`control-button ${!micEnabled ? 'off' : ''}`} onClick={() => void toggleMic()}><span>{micEnabled ? '🎙' : '🔇'}</span><small>{micEnabled ? '마이크' : '음소거'}</small></button>
          <button className={`control-button ${!cameraEnabled ? 'off' : ''}`} onClick={() => void toggleCamera()}><span>{cameraEnabled ? '▣' : '▢'}</span><small>{cameraEnabled ? '카메라' : '카메라 끔'}</small></button>
          {canShareScreen && <button className={`control-button ${localScreen ? 'active' : ''}`} onClick={() => void toggleScreen()}><span>↗</span><small>{localScreen ? '공유 중지' : '화면 공유'}</small></button>}
          <button className="control-button leave" onClick={() => void leaveSession()} disabled={busy}><span>↩</span><small>나가기</small></button>
          {isHost && <button className="end-call-button" onClick={() => void endSession()} disabled={busy}>진료 종료</button>}
        </div>
        {error && <div className="floating-error">{error}<button onClick={() => setError('')}>×</button></div>}
      </main>
    );
  }

  return (
    <main className="room-shell">
      <header className="room-topbar">
        <button className="back-button" onClick={() => void leaveSession()}>← 목록</button>
        <div className="room-title-wrap"><span className={`status-badge ${session.status.toLowerCase()}`}>{statusLabel(session.status)}</span><b>{session.title || '원격진료'}</b></div>
        <div className={`socket-indicator ${socketState}`}><i />{socketState === 'connected' ? '서버 연결됨' : socketState === 'connecting' ? '연결 중' : '재연결 중'}</div>
      </header>

      <div className="waiting-layout">
        <section className="waiting-main">
          <div className="waiting-copy"><div className="section-kicker">Waiting room</div><h1>{session.status === 'LIVE' ? '진료가 이미 시작되었습니다' : isHost ? '환자 입장을 기다리고 있어요' : '의료진이 진료를 시작하면 연결됩니다'}</h1><p>{participantReadyCount}명이 장치 확인을 마쳤습니다. 카메라와 마이크 권한은 아래의 장치 확인 버튼을 눌렀을 때만 요청합니다.</p></div>

          <DeviceCheck stream={localStream} onStream={(stream) => { setLocalStream(stream); setMicEnabled(true); setCameraEnabled(true); }} onReady={() => void markReady()} ready={ready} disabled={busy || socketState !== 'connected'} />

          {session.status === 'LIVE' && localStream && !rtcStarted && <button className="primary-button large full enter-live" onClick={() => void enterRtc()} disabled={busy}>{busy ? '연결 중…' : '진료실 입장'}</button>}
          {isHost && session.status !== 'LIVE' && <button className="start-session-button" disabled={!localStream || busy || socketState !== 'connected'} onClick={() => void startSession()}>{busy ? '진료실 준비 중…' : '진료 시작'}<small>참가자가 준비되지 않았어도 시작할 수 있습니다.</small></button>}
          {!isHost && ready && session.status !== 'LIVE' && <div className="waiting-banner"><span className="pulse-dot" />준비가 완료되었습니다. 의료진의 진료 시작을 기다리고 있습니다.</div>}
          {error && <div className="error-box wide">{error}</div>}
        </section>

        <aside className="waiting-side">
          <div className="side-card"><div className="panel-title"><b>참가자</b><span>{session.participants.length}/{session.policy.maxParticipants}</span></div>{session.participants.map((participant) => <div className="participant-row" key={participant.userId}><div className="small-avatar">{(participant.displayName || participant.userId).slice(0,1)}</div><div><b>{participant.displayName || participant.userId}{participant.userId === profile.userId ? ' (나)' : ''}</b><span>{roleLabel(participant.role)}</span></div><span className={`ready-chip ${participant.ready ? 'yes' : ''}`}>{participant.ready ? '준비됨' : participant.presence === 'INVITED' ? '미입장' : '대기'}</span></div>)}</div>
          <div className="side-card info-card"><b>이 세션은 다대다를 지원합니다</b><p>현재 정책은 {session.policy.topology}이며 최대 {session.policy.maxParticipants}명까지 참가할 수 있습니다.</p></div>
        </aside>
      </div>
    </main>
  );
}
