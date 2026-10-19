import React from 'react';
import { ClinicalBadge, ClinicalButton, ClinicalCard, ClinicalEmpty, ClinicalNotice, JsonDebug } from '../ui/ClinicalUi';
import { useClinicalAuth } from '../auth/ClinicalAuthContext';
import { useClinicalRouteContext } from '../state/ClinicalRouteContext';
import { useClinicalApi } from '../api/ClinicalApiContext';
import { useClinicalResource } from '../hooks/useClinicalResource';

export function AppointmentScreen() {
  const { session }=useClinicalAuth();
  const { context }=useClinicalRouteContext();
  const api=useClinicalApi();
  const patientId=context.patientUserId || session.userId;
  const siteId=context.siteId || '';

  const state=useClinicalResource(
    Boolean(patientId && siteId),
    ()=>api.patient.appointmentSlots(patientId,siteId) as Promise<any[]>,
    [patientId,siteId],
  );

  return (
    <>
      <ClinicalNotice>의료기관은 추천 광고가 아니라 이용 가능 여부와 객관적 정보로 표시합니다.</ClinicalNotice>
      <div className="cf-grid-2">
        <ClinicalCard title="진료기관">
          {siteId ? <div className="cf-list-choice cf-list-choice--selected"><strong>현재 선택 Site</strong><span>{siteId}</span></div>
                  : <ClinicalEmpty message="Site Scope가 아직 선택되지 않았습니다."/>}
        </ClinicalCard>
        <ClinicalCard title="예약 가능 시간">
          {state.loading && <ClinicalEmpty message="예약 가능 시간을 불러오는 중입니다."/>}
          {state.error && <ClinicalNotice tone="danger">{state.error}</ClinicalNotice>}
          {Array.isArray(state.data) && state.data.length === 0 && <ClinicalEmpty message="현재 예약 가능한 시간이 없습니다."/>}
          {Array.isArray(state.data) && state.data.slice(0,8).map((slot:any)=>(
            <div className="cf-slot" key={slot.id}>
              <div><strong>{new Date(slot.slot_start_at).toLocaleString()}</strong><span>남은 수 {slot.remaining_capacity}</span></div>
              <ClinicalButton variant="secondary">선택</ClinicalButton>
            </div>
          ))}
        </ClinicalCard>
      </div>
      <JsonDebug value={state.data}/>
    </>
  );
}
