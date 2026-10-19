import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ClinicalButton, ClinicalCard, ClinicalField, ClinicalNotice } from '../ui/ClinicalUi';
import { useClinicalAuth } from '../auth/ClinicalAuthContext';

export function LoginScreen() {
  const navigate=useNavigate();
  const location=useLocation();
  const { refreshSession }=useClinicalAuth();
  const [patientId,setPatientId]=useState(localStorage.getItem('clinical_user_id') || '');
  const [token,setToken]=useState(localStorage.getItem('clinical_access_token') || '');

  const save=()=>{
    if (patientId) {
      localStorage.setItem('clinical_user_id',patientId);
      localStorage.setItem('clinical_patient_user_id',patientId);
    }
    if (token) localStorage.setItem('clinical_access_token',token);
    refreshSession();
    const back=(location.state as any)?.returnTo || '/clinical/patient/p01';
    navigate(back,{replace:true});
  };

  return (
    <div className="cf-grid-2">
      <ClinicalCard title="환자·보호자 이용">
        <ClinicalNotice>비대면진료는 환자 본인의 요청에 따라 시작됩니다.</ClinicalNotice>
        <ClinicalField label="사용자 식별자" value={patientId} onChange={setPatientId}/>
        <ClinicalField label="인증 토큰" value={token} onChange={setToken} type="password"/>
        <ClinicalButton onClick={save}>인증 후 이용</ClinicalButton>
      </ClinicalCard>
      <ClinicalCard title="의료인·기관 이용">
        <p>기존 인증 계정의 JWT와 Role/Scope를 사용합니다. 화면에서 임의로 의료인 권한을 부여하지 않습니다.</p>
        <ClinicalButton variant="secondary" onClick={()=>navigate('/clinical/common/g02')}>업무 선택 확인</ClinicalButton>
      </ClinicalCard>
    </div>
  );
}
