import React, { useState } from 'react';
import { ClinicalButton, ClinicalCard, ClinicalNotice } from '../ui/ClinicalUi';
import { useClinicalApi } from '../api/ClinicalApiContext';
import { useClinicalRouteContext } from '../state/ClinicalRouteContext';
import { useClinicalAuth } from '../auth/ClinicalAuthContext';

export function ConsentScreen() {
  const [agreed,setAgreed]=useState(false);
  const [message,setMessage]=useState('');
  const api=useClinicalApi();
  const { context }=useClinicalRouteContext();
  const { session }=useClinicalAuth();

  const submit=async()=>{
    if (!context.encounterId || !context.patientUserId) {
      setMessage('Encounter와 환자 Context를 먼저 선택해야 합니다.');
      return;
    }
    if (!agreed) {
      setMessage('설명 내용을 확인하고 동의 여부를 선택해 주세요.');
      return;
    }
    try {
      await api.encounter.acceptConsent(context.encounterId,{
        patientUserId:context.patientUserId,
        agreed:true,
        method:'ELECTRONIC',
        actorRole:session.roles.includes('PATIENT')?'PATIENT':'AUTHORIZED_SUPPORTER',
      });
      setMessage('동의가 기록되었습니다.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '동의 저장에 실패했습니다.');
    }
  };

  return (
    <ClinicalCard title="비대면진료 설명">
      <ul className="cf-check-list">
        <li>비대면 환경에서는 일부 신체진찰에 제한이 있을 수 있습니다.</li>
        <li>정확한 진단을 위해 대면진료가 필요할 수 있습니다.</li>
        <li>통신 장애가 발생하면 진료가 일시 중단될 수 있습니다.</li>
        <li>의료진은 필요하다고 판단하면 대면 또는 응급진료를 안내할 수 있습니다.</li>
      </ul>
      <label className="cf-consent">
        <input type="checkbox" checked={agreed} onChange={(e)=>setAgreed(e.target.checked)}/>
        <span>위 내용을 확인하였으며 비대면진료의 한계와 위험성을 이해하고 동의합니다.</span>
      </label>
      {message && <ClinicalNotice tone={message.includes('기록')?'success':'warning'}>{message}</ClinicalNotice>}
      <ClinicalButton onClick={submit}>동의하고 계속</ClinicalButton>
    </ClinicalCard>
  );
}
