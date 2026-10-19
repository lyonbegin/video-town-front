import React from 'react';
import { ExistingRtcBridge } from '../rtc/ExistingRtcBridge';
import { useClinicalRouteContext } from '../state/ClinicalRouteContext';
import { ClinicalBadge, ClinicalButton, ClinicalCard } from '../ui/ClinicalUi';

export function LiveVisitScreen({ clinician=false }: { clinician?: boolean }) {
  const { context }=useClinicalRouteContext();
  return (
    <>
      <div className="cf-clinical-workspace">
        <aside>
          <ClinicalCard title="환자 요약">
            <strong>{context.patientUserId || '환자 Context 필요'}</strong>
            <div className="cf-status-row"><span>Red Flag</span><ClinicalBadge tone="success">확인</ClinicalBadge></div>
            <div className="cf-status-row"><span>Vital</span><span>연결 데이터 표시</span></div>
          </ClinicalCard>
        </aside>
        <ExistingRtcBridge visitId={context.visitId}/>
        <aside>
          <ClinicalCard title={clinician?'Clinical Actions':'현장 Action'}>
            {clinician ? (
              <>
                <ClinicalButton>검사오더</ClinicalButton>
                <ClinicalButton variant="secondary">대면전환</ClinicalButton>
                <ClinicalButton variant="secondary">처방</ClinicalButton>
              </>
            ) : (
              <>
                <ClinicalButton>검사오더 확인</ClinicalButton>
                <ClinicalButton variant="secondary">현장 메모</ClinicalButton>
              </>
            )}
          </ClinicalCard>
        </aside>
      </div>
      <div className="cf-viewer-tabs"><button>ECG</button><button>DICOM</button><button>청진</button><button>초음파</button><button>Lab</button></div>
    </>
  );
}
