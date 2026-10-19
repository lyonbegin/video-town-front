import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

type JsonMap = Record<string, unknown>;

type BpStatus = {
  deviceCode?: string;
  endpointState?: string;
  transportState?: string;
  currentMeasurement?: JsonMap | null;
  previousReading?: JsonMap | null;
  lastReading?: JsonMap | null;
  lastCuff?: JsonMap | null;
  feature?: JsonMap | null;
  lastError?: unknown;
  lastEventAt?: string | null;
  reconnects?: number;
  historyCount?: number;
  endpoint?: string;
};

const API = '/api/main/devices/automated-bp-monitor/status';
const ACTIVE_PHASES = new Set(['CUFF_CHECK', 'INFLATING', 'MEASURING', 'DEFLATING']);

function asMap(value: unknown): JsonMap | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonMap) : null;
}

function numberFrom(obj: JsonMap | null, keys: string[]): number | null {
  if (!obj) return null;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function stringFrom(obj: JsonMap | null, keys: string[]): string | null {
  if (!obj) return null;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return null;
}

function boolFrom(obj: JsonMap | null, key: string): boolean {
  return Boolean(obj && obj[key] === true);
}

function num(value: number | null, digits = 0): string {
  if (value === null) return '--';
  return value.toFixed(digits);
}

function when(value: string | null): string {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('ko-KR', { hour12: false });
}

function phaseLabel(phase: string): string {
  switch (phase) {
    case 'CUFF_CHECK': return '커프 확인';
    case 'INFLATING': return '커프 팽창 중';
    case 'MEASURING': return '혈압 측정 중';
    case 'DEFLATING': return '감압 중';
    case 'RESULT_RECEIVED': return '결과 수신 중';
    case 'COMPLETE': return '측정 완료';
    case 'ERROR': return '측정 오류';
    default: return '측정 준비';
  }
}

export default function AutomatedBpMonitorScreen() {
  const [status, setStatus] = useState<BpStatus | null>(null);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState(false);
  const previousResultSeq = useRef<number | null>(null);

  async function refresh() {
    try {
      const response = await fetch(API, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const next = (await response.json()) as BpStatus;

      const nextReading = asMap(next.lastReading);
      const sequence = numberFrom(nextReading, ['sequence']);

      if (
        sequence !== null &&
        previousResultSeq.current !== null &&
        sequence !== previousResultSeq.current
      ) {
        setFlash(true);
        window.setTimeout(() => setFlash(false), 1400);
      }

      if (sequence !== null) previousResultSeq.current = sequence;

      setStatus(next);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 350);
    return () => window.clearInterval(timer);
  }, []);

  const connected =
    status?.endpointState === 'ONLINE' &&
    status?.transportState === 'CONNECTED';

  const current = asMap(status?.currentMeasurement);
  const reading = asMap(status?.lastReading);
  const previous = asMap(status?.previousReading);
  const cuff = asMap(status?.lastCuff);

  const phase = stringFrom(current, ['phase']) ?? 'READY';
  const active = ACTIVE_PHASES.has(phase);

  const sessionId = stringFrom(current, ['sessionId']);
  const readingSessionId = stringFrom(reading, ['sessionId']);
  const currentResultBelongsToSession =
    Boolean(reading) &&
    Boolean(sessionId) &&
    readingSessionId === sessionId &&
    !active;

  const displayReading =
    currentResultBelongsToSession || (!current && reading)
      ? reading
      : null;

  const systolic = numberFrom(displayReading, ['systolic']);
  const diastolic = numberFrom(displayReading, ['diastolic']);
  const map = numberFrom(displayReading, ['map']);
  const pulse = numberFrom(displayReading, ['pulse']);
  const unit =
    stringFrom(displayReading, ['unit']) ??
    stringFrom(current, ['cuffUnit']) ??
    stringFrom(cuff, ['unit']) ??
    'mmHg';

  const cuffPressure =
    active
      ? numberFrom(current, ['cuffPressure']) ?? numberFrom(cuff, ['pressure'])
      : 0;

  const resultStatus = asMap(displayReading?.status);

  const warnings = useMemo(() => {
    const list: string[] = [];
    if (boolFrom(resultStatus, 'movement')) list.push('측정 중 몸 움직임이 감지되었습니다.');
    if (boolFrom(resultStatus, 'looseCuff')) list.push('커프 착용 상태가 적절하지 않습니다.');
    if (boolFrom(resultStatus, 'irregularPulse')) list.push('불규칙 맥박이 감지되었습니다.');
    if (boolFrom(resultStatus, 'pulseOutOfRange')) list.push('맥박 범위 경고가 감지되었습니다.');
    if (boolFrom(resultStatus, 'badPosition')) list.push('측정 자세가 적절하지 않습니다.');
    return list;
  }, [resultStatus]);

  const previousSys = numberFrom(previous, ['systolic']);
  const previousDia = numberFrom(previous, ['diastolic']);
  const previousUnit = stringFrom(previous, ['unit']) ?? 'mmHg';
  const previousAt =
    stringFrom(previous, ['deviceTimestamp', 'observedAt']) ??
    null;

  const resultAt =
    stringFrom(displayReading, ['deviceTimestamp', 'observedAt']) ??
    null;

  const isSimulator = Boolean(
    status?.endpoint &&
    /127\.0\.0\.1:18101|localhost:18101/i.test(status.endpoint),
  );

  const topTitle = !connected
    ? '혈압계 연결 확인'
    : active
      ? phaseLabel(phase)
      : displayReading
        ? '측정 결과 수신 완료'
        : '측정 준비 완료';

  const topText = !connected
    ? '현장 Edge와 혈압계 연결 상태를 확인하십시오.'
    : active
      ? '새 측정이 진행 중입니다. 이전 결과와 섞이지 않도록 현재 측정값만 표시합니다.'
      : displayReading
        ? '현재 측정 세션의 결과입니다. 경고와 수치를 확인하십시오.'
        : '커프와 자세를 확인한 뒤 혈압계 본체의 START 버튼을 누르십시오.';

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <div>
            <div style={styles.eyebrow}>현장 검사 · 활력징후</div>
            <h1 style={styles.title}>자동 혈압 측정</h1>
            <p style={styles.subtitle}>
              현장 혈압계의 BLS 데이터를 Main Connector를 통해 실시간 수신합니다.
            </p>
          </div>

          <div style={styles.badges}>
            {isSimulator && <span style={styles.simBadge}>SIMULATION</span>}
            <span style={connected ? styles.onlineBadge : styles.offlineBadge}>
              {connected ? '혈압계 연결됨' : '혈압계 연결 안 됨'}
            </span>
          </div>
        </header>

        <section style={active ? styles.bannerActive : connected ? styles.bannerOk : styles.bannerWarn}>
          <div style={styles.bannerIcon}>{active ? '…' : connected ? '✓' : '!'}</div>
          <div style={{ flex: 1 }}>
            <div style={styles.bannerTitle}>{topTitle}</div>
            <div style={styles.bannerText}>{topText}</div>
          </div>
          <button type="button" style={styles.secondaryButton} onClick={() => void refresh()}>
            상태 확인
          </button>
        </section>

        <div style={styles.grid}>
          <section style={styles.monitorCard}>
            <div style={styles.monitorHeader}>
              <span>현재 측정</span>
              <span style={styles.phasePill}>{phaseLabel(phase)}</span>
            </div>

            {active && (
              <div style={styles.activeStrip}>
                <div>
                  <div style={styles.activeLabel}>현재 커프 압력</div>
                  <div style={styles.cuffValue}>
                    {num(cuffPressure, unit === 'kPa' ? 1 : 0)}
                    <span>{unit}</span>
                  </div>
                </div>
                <div style={styles.activeMessage}>
                  환자가 말하거나 움직이지 않도록 하고 측정이 끝날 때까지 기다리십시오.
                </div>
              </div>
            )}

            <div style={flash ? styles.bpFlash : styles.bpRow}>
              <div style={styles.bigBlock}>
                <strong style={{ fontSize: 76, lineHeight: 1, letterSpacing: '-0.06em' }}>{active ? '---' : num(systolic)}</strong>
                <span style={{ marginTop: 9, fontSize: 12, color: '#667085', fontWeight: 900, letterSpacing: '0.12em' }}>SYS</span>
              </div>
              <div style={styles.slash}>/</div>
              <div style={styles.bigBlock}>
                <strong style={{ fontSize: 76, lineHeight: 1, letterSpacing: '-0.06em' }}>{active ? '---' : num(diastolic)}</strong>
                <span style={{ marginTop: 9, fontSize: 12, color: '#667085', fontWeight: 900, letterSpacing: '0.12em' }}>DIA</span>
              </div>
              <div style={styles.bpUnit}>{unit}</div>
            </div>

            <div style={styles.metrics}>
              <div>
                <span style={{ display: 'block', color: '#667085', fontSize: 11, fontWeight: 900 }}>평균혈압 MAP</span>
                <strong style={{ fontSize: 28, marginRight: 6 }}>{active ? '--' : num(map)}</strong>
                <em style={{ color: '#667085', fontSize: 11, fontStyle: 'normal' }}>{unit}</em>
              </div>
              <div>
                <span style={{ display: 'block', color: '#667085', fontSize: 11, fontWeight: 900 }}>맥박</span>
                <strong style={{ fontSize: 28, marginRight: 6 }}>{active ? '--' : num(pulse)}</strong>
                <em style={{ color: '#667085', fontSize: 11, fontStyle: 'normal' }}>bpm</em>
              </div>
            </div>

            <div style={styles.sessionLine}>
              <span>측정 세션</span>
              <strong>{sessionId ? sessionId.slice(0, 8) : '--'}</strong>
              <span>최근 결과</span>
              <strong>{when(resultAt)}</strong>
            </div>

            {active && previous && (
              <div style={styles.previousBox}>
                <div>
                  <span style={styles.previousLabel}>직전 측정</span>
                  <strong style={styles.previousValue}>
                    {num(previousSys)} / {num(previousDia)} {previousUnit}
                  </strong>
                </div>
                <div style={styles.previousTime}>{when(previousAt)}</div>
              </div>
            )}
          </section>

          <aside style={styles.side}>
            <section style={styles.guideCard}>
              <h2 style={{ margin: '0 0 14px', fontSize: 17 }}>현장 측정 순서</h2>
              <ol style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 13, color: '#344054' }}>
                <li><strong style={{ display: 'block' }}>커프 착용</strong><span style={{ display: 'block', marginTop: 3, fontSize: 12, color: '#667085', lineHeight: 1.5 }}>상완에 올바르게 착용하고 느슨하지 않은지 확인합니다.</span></li>
                <li><strong style={{ display: 'block' }}>환자 자세 확인</strong><span style={{ display: 'block', marginTop: 3, fontSize: 12, color: '#667085', lineHeight: 1.5 }}>등과 팔을 지지하고 측정 중 움직이거나 말하지 않도록 합니다.</span></li>
                <li><strong style={{ display: 'block' }}>혈압계 본체 START</strong><span style={{ display: 'block', marginTop: 3, fontSize: 12, color: '#667085', lineHeight: 1.5 }}>VDEV2 Clinical UI에서는 원격 START 명령을 보내지 않습니다.</span></li>
                <li><strong style={{ display: 'block' }}>자동 수신</strong><span style={{ display: 'block', marginTop: 3, fontSize: 12, color: '#667085', lineHeight: 1.5 }}>커프 압력과 최종 혈압이 동일한 Connector 경로로 자동 수신됩니다.</span></li>
              </ol>
            </section>

            {warnings.length > 0 ? (
              <section style={styles.warningCard}>
                <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>측정 확인 필요</h2>
                {warnings.map((warning) => <div key={warning}>• {warning}</div>)}
                <p style={{ marginBottom: 0, fontSize: 12 }}>필요하면 커프와 자세를 교정한 뒤 새 측정을 시행하십시오.</p>
              </section>
            ) : (
              <section style={styles.okCard}>
                <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>측정 경고</h2>
                <p style={{ margin: 0, fontSize: 13 }}>{displayReading ? '현재 결과에 보고된 측정 경고가 없습니다.' : '결과 수신 대기 중입니다.'}</p>
              </section>
            )}

            {isSimulator && (
              <section style={styles.simCard}>
                <div>
                  <strong>개발용 가상 물리장비</strong>
                  <p style={{ margin: '6px 0 12px', color: '#c7d0df', fontSize: 12 }}>실제 장비 대신 Simulator 전면패널의 START를 누릅니다.</p>
                </div>
                <button
                  type="button"
                  style={{ width: '100%', border: 0, borderRadius: 11, padding: '11px 14px', background: '#fff', color: '#172033', fontWeight: 900, cursor: 'pointer' }}
                  onClick={() => window.open('http://127.0.0.1:18101/controller', '_blank', 'noopener,noreferrer')}
                >
                  가상 혈압계 전면패널 열기
                </button>
              </section>
            )}
          </aside>
        </div>

        <details style={styles.details}>
          <summary style={{ cursor: 'pointer', padding: '14px 18px', fontWeight: 800, color: '#667085' }}>장비 기술 정보</summary>
          <div style={styles.detailsGrid}>
            <div><span>Device</span><strong>{status?.deviceCode ?? 'AUTOMATED_BP_MONITOR'}</strong></div>
            <div><span>Endpoint</span><strong>{status?.endpointState ?? '--'}</strong></div>
            <div><span>Transport</span><strong>{status?.transportState ?? '--'}</strong></div>
            <div><span>Phase</span><strong>{phase}</strong></div>
            <div><span>Session</span><strong>{sessionId ?? '--'}</strong></div>
            <div><span>History</span><strong>{status?.historyCount ?? 0}</strong></div>
          </div>
        </details>

        {error && <div style={styles.error}>Main 상태 조회 실패: {error}</div>}
      </div>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    padding: 28,
    background: '#f4f7fb',
    color: '#172033',
    fontFamily: 'Inter, Pretendard, "Noto Sans KR", system-ui, sans-serif',
  },
  shell: { maxWidth: 1260, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', gap: 24, alignItems: 'flex-start', marginBottom: 22 },
  eyebrow: { color: '#667085', fontSize: 13, fontWeight: 900, letterSpacing: '0.08em', marginBottom: 8 },
  title: { margin: 0, fontSize: 34, letterSpacing: '-0.035em' },
  subtitle: { margin: '10px 0 0', color: '#667085', fontSize: 14 },
  badges: { display: 'flex', gap: 9, flexWrap: 'wrap', justifyContent: 'flex-end' },
  simBadge: { border: '1px solid #d0d5dd', background: '#fff', color: '#667085', borderRadius: 999, padding: '7px 10px', fontSize: 11, fontWeight: 900 },
  onlineBadge: { border: '1px solid #bfe6cf', background: '#eaf8ef', color: '#176b49', borderRadius: 999, padding: '8px 12px', fontSize: 12, fontWeight: 900 },
  offlineBadge: { border: '1px solid #fecaca', background: '#fff1f2', color: '#b42318', borderRadius: 999, padding: '8px 12px', fontSize: 12, fontWeight: 900 },
  bannerOk: { display: 'flex', alignItems: 'center', gap: 16, border: '1px solid #cde9d8', background: '#f2fbf6', borderRadius: 18, padding: '18px 20px', marginBottom: 20 },
  bannerActive: { display: 'flex', alignItems: 'center', gap: 16, border: '1px solid #bfd7ff', background: '#f1f6ff', borderRadius: 18, padding: '18px 20px', marginBottom: 20 },
  bannerWarn: { display: 'flex', alignItems: 'center', gap: 16, border: '1px solid #fed7aa', background: '#fff8ed', borderRadius: 18, padding: '18px 20px', marginBottom: 20 },
  bannerIcon: { width: 42, height: 42, borderRadius: '50%', background: '#173b67', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 20, fontWeight: 900, flex: '0 0 auto' },
  bannerTitle: { fontSize: 16, fontWeight: 900, marginBottom: 4 },
  bannerText: { color: '#5d697b', fontSize: 13 },
  secondaryButton: { border: '1px solid #ccd4df', background: '#fff', borderRadius: 11, padding: '10px 14px', color: '#344054', fontWeight: 800, cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: 'minmax(0,1.25fr) minmax(330px,.75fr)', gap: 20 },
  monitorCard: { background: '#fff', border: '1px solid #e3e8ef', borderRadius: 24, padding: 28, boxShadow: '0 12px 38px rgba(30,47,70,.08)' },
  monitorHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#475467', fontSize: 13, fontWeight: 900 },
  phasePill: { background: '#eef3f8', color: '#43536a', borderRadius: 999, padding: '7px 10px', fontSize: 11 },
  activeStrip: { marginTop: 20, padding: 18, borderRadius: 16, background: '#f3f7fd', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 22, alignItems: 'center' },
  activeLabel: { color: '#667085', fontSize: 11, fontWeight: 900, marginBottom: 4 },
  cuffValue: { fontSize: 30, fontWeight: 900 },
  activeMessage: { color: '#536176', fontSize: 13, lineHeight: 1.55 },
  bpRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 25, padding: '38px 8px 30px', position: 'relative' },
  bpFlash: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 25, padding: '38px 8px 30px', position: 'relative', borderRadius: 18, background: '#eef8ff' },
  bigBlock: { display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 180 },
  slash: { fontSize: 54, color: '#c3cad5', fontWeight: 300 },
  bpUnit: { position: 'absolute', right: 8, top: 18, color: '#667085', fontSize: 12, fontWeight: 800 },
  metrics: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '18px 0', borderTop: '1px solid #edf0f4', borderBottom: '1px solid #edf0f4' },
  sessionLine: { display: 'grid', gridTemplateColumns: 'auto 1fr auto 1fr', gap: 8, alignItems: 'center', marginTop: 16, color: '#7a8597', fontSize: 11 },
  previousBox: { marginTop: 15, borderRadius: 14, background: '#f8fafc', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  previousLabel: { color: '#7a8597', fontSize: 11, display: 'block', marginBottom: 3 },
  previousValue: { fontSize: 16 },
  previousTime: { color: '#7a8597', fontSize: 11 },
  side: { display: 'flex', flexDirection: 'column', gap: 14 },
  guideCard: { background: '#fff', border: '1px solid #e3e8ef', borderRadius: 20, padding: 22 },
  warningCard: { background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 20, padding: 20, color: '#8a3413' },
  okCard: { background: '#f1faf5', border: '1px solid #cde9d8', borderRadius: 20, padding: 20, color: '#176b49' },
  simCard: { background: '#172033', color: '#fff', borderRadius: 20, padding: 20 },
  details: { marginTop: 18, background: '#fff', border: '1px solid #e3e8ef', borderRadius: 16, overflow: 'hidden' },
  detailsGrid: { padding: '0 18px 18px', display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10 },
  error: { marginTop: 12, padding: '12px 15px', borderRadius: 12, background: '#fff2f0', color: '#b42318', fontSize: 13 },
};

// Inline style details that need nested text styling are set through this harmless browser-only rule.
if (typeof document !== 'undefined' && !document.getElementById('bp007-inline-style')) {
  const style = document.createElement('style');
  style.id = 'bp007-inline-style';
  style.textContent = `
    .bp007-unused {}
    main strong { font-weight: 800; }
  `;
  document.head.appendChild(style);
}

Object.assign(styles.bigBlock, {});
Object.assign(styles.bigBlock, {
  color: '#102a43',
});
