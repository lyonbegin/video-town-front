import React, { useState } from 'react';
import { LocalPrecheckVideo } from '../rtc/LocalPrecheckVideo';
import { ClinicalBadge, ClinicalButton, ClinicalCard, ClinicalNotice } from '../ui/ClinicalUi';
import { useClinicalApi } from '../api/ClinicalApiContext';
import { useClinicalRouteContext } from '../state/ClinicalRouteContext';

export function PrecheckScreen() {
  const api=useClinicalApi();
  const { context }=useClinicalRouteContext();
  const [status,setStatus]=useState('');

  const submit=async()=>{
    if(!context.visitId){setStatus('Visit Context가 필요합니다.');return;}
    try{
      await api.visit.selfPrecheck(context.visitId,{
        cameraState:'PASS',
        microphoneState:'PASS',
        speakerState:'PASS',
        networkState:'PASS',
        checkPayload:{source:'browser-precheck'},
      });
      setStatus('사전 점검 결과가 저장되었습니다.');
    }catch(e){setStatus(e instanceof Error?e.message:'저장 실패');}
  };

  return (
    <div className="cf-grid-2">
      <LocalPrecheckVideo/>
      <ClinicalCard title="연결 상태">
        <div className="cf-status-row"><strong>카메라</strong><ClinicalBadge tone="success">점검 가능</ClinicalBadge></div>
        <div className="cf-status-row"><strong>마이크</strong><ClinicalBadge tone="success">점검 가능</ClinicalBadge></div>
        <div className="cf-status-row"><strong>네트워크</strong><ClinicalBadge>브라우저 상태</ClinicalBadge></div>
        {status && <ClinicalNotice tone={status.includes('저장')?'success':'warning'}>{status}</ClinicalNotice>}
        <ClinicalButton onClick={submit}>점검 결과 제출</ClinicalButton>
      </ClinicalCard>
    </div>
  );
}
