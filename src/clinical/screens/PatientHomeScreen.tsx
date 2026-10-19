import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ClinicalButton, ClinicalCard, ClinicalNotice } from '../ui/ClinicalUi';

export function PatientHomeScreen() {
  const navigate=useNavigate();
  return (
    <>
      <ClinicalNotice>
        비대면진료는 환자의 요청으로 시작되며, 진료 내용에 따라 의료진이 대면진료를 권할 수 있습니다.
      </ClinicalNotice>
      <div className="cf-grid-2">
        <ClinicalCard title="비대면진료 예약">
          <p>이용 가능한 의료기관과 시간을 확인해 예약합니다.</p>
          <ClinicalButton onClick={()=>navigate('/clinical/patient/p02')}>진료 예약</ClinicalButton>
        </ClinicalCard>
        <ClinicalCard title="예약 내역">
          <p>예정된 진료와 준비사항을 확인합니다.</p>
          <ClinicalButton variant="secondary" onClick={()=>navigate('/clinical/patient/p14')}>예약 확인</ClinicalButton>
        </ClinicalCard>
      </div>
      <div className="cf-grid-3">
        <ClinicalCard title="전화 예약 지원"><p>디지털 이용이 어려운 경우 지원 경로를 안내합니다.</p></ClinicalCard>
        <ClinicalCard title="보호자 지원"><p>확인된 보호자·대리인이 허용된 범위에서 진료 준비를 도울 수 있습니다.</p></ClinicalCard>
        <ClinicalCard title="접근성"><p>큰 글씨, 음성 안내, 언어 설정을 사용할 수 있습니다.</p></ClinicalCard>
      </div>
    </>
  );
}
