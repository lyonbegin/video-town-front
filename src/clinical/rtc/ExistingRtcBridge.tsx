import React, { useEffect, useMemo, useState } from 'react';
import ConsultationRoom from '../../components/ConsultationRoom';
import { getConsultation } from '../../lib/api';
import type { AuthProfile, ConsultationSession } from '../../types';
import { ClinicalBadge, ClinicalButton, ClinicalCard } from '../ui/ClinicalUi';

const LEGACY_PROFILE_KEY = 'carelink-dev-profile';

function loadExistingProfile(): AuthProfile | null {
  try {
    const raw = localStorage.getItem(LEGACY_PROFILE_KEY);
    return raw ? (JSON.parse(raw) as AuthProfile) : null;
  } catch {
    return null;
  }
}

/**
 * Reuses the CURRENT telemedicine frontend's ConsultationRoom.
 * It does not create a second Socket.IO or mediasoup implementation.
 *
 * The Clinical visit id is first treated as the existing consultation id.
 * If the backend uses distinct ids, the UI fails closed and exposes that the
 * visit -> consultation mapping must be supplied rather than inventing one.
 */
export function ExistingRtcBridge({ visitId }: { visitId?: string }) {
  const profile = useMemo(() => loadExistingProfile(), []);
  const [session, setSession] = useState<ConsultationSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setSession(null);
    setOpen(false);
    setError(undefined);

    if (!visitId || !profile?.token) return;

    setLoading(true);
    getConsultation(profile.token, visitId)
      .then((value) => {
        if (!cancelled) setSession(value);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          const message = reason instanceof Error ? reason.message : String(reason);
          setError(message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profile?.token, visitId]);

  if (open && profile && session) {
    return (
      <div className="cf-existing-consultation-room">
        <ConsultationRoom
          profile={profile}
          initialSession={session}
          onBack={() => setOpen(false)}
        />
      </div>
    );
  }

  return (
    <ClinicalCard title="실시간 진료">
      <div className="cf-rtc-status">
        <ClinicalBadge tone={profile?.token ? 'success' : 'warning'}>
          {profile?.token ? '기존 RTC 로그인 연결됨' : '기존 로그인 필요'}
        </ClinicalBadge>
        {visitId && <span>Visit {visitId}</span>}
      </div>

      {!visitId && <p>진료 Visit Context가 선택되면 기존 실시간 상담실을 연결합니다.</p>}
      {loading && <p>기존 상담 세션을 확인하고 있습니다.</p>}
      {error && (
        <p>
          현재 Visit ID로 기존 Consultation 세션을 찾지 못했습니다. 임의 매핑은 하지 않습니다.
          {' '}서버의 Visit → Consultation 연결값이 확인되면 그대로 연결합니다. ({error})
        </p>
      )}
      {session && (
        <div className="cf-action-row">
          <ClinicalButton onClick={() => setOpen(true)}>기존 실시간 상담실 열기</ClinicalButton>
        </div>
      )}
    </ClinicalCard>
  );
}
