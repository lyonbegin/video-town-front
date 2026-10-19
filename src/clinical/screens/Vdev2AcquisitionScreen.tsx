import React from 'react';
import { useClinicalRouteContext } from '../state/ClinicalRouteContext';
import { ClinicalBadge, ClinicalCard, ClinicalNotice } from '../ui/ClinicalUi';
import { Vdev2RuntimeFrame } from '../viewers/Vdev2RuntimeFrame';

export function Vdev2AcquisitionScreen() {
  const { context } = useClinicalRouteContext();

  return (
    <div>
      <ClinicalNotice tone="success">
        VDEV2 6/6 검증을 통과한 synthetic-only 장비 런타임을 현장 검사 화면에 연결했습니다.
        검사오더·Acquisition 식별자는 기존 임상 흐름을 유지하고, 아래 장비 패널은 실제 source-locked
        GitHub/runtime 모듈 출력을 보여줍니다.
      </ClinicalNotice>

      <ClinicalCard title="현재 임상 연결">
        <div className="cf-vdev2-context">
          <span>ExamOrder <ClinicalBadge tone={context.examOrderId ? 'success' : 'neutral'}>{context.examOrderId || '미선택'}</ClinicalBadge></span>
          <span>Acquisition <ClinicalBadge tone={context.acquisitionId ? 'success' : 'neutral'}>{context.acquisitionId || '미선택'}</ClinicalBadge></span>
          <span>Encounter <ClinicalBadge tone={context.encounterId ? 'success' : 'neutral'}>{context.encounterId || '미선택'}</ClinicalBadge></span>
          <span>Site <ClinicalBadge tone={context.siteId ? 'success' : 'neutral'}>{context.siteId || '미선택'}</ClinicalBadge></span>
        </div>
      </ClinicalCard>

      <ClinicalCard title="장비별 검사 UI">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <strong style={{ display: 'block', marginBottom: 5 }}>자동 비침습 혈압계</strong>
            <span style={{ color: '#647780', fontSize: 13 }}>
              AUTOMATED_BP_MONITOR · Main Connector를 통해 실제 장비/Simulator Endpoint와 연결합니다.
            </span>
          </div>
          <a
            href="/vdev2/devices/automated-bp-monitor/"
            style={{
              display: 'inline-block',
              borderRadius: 10,
              padding: '10px 14px',
              background: '#167d75',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 700,
            }}
          >
            혈압계 전용 UI 열기
          </a>
        </div>
      </ClinicalCard>

      <Vdev2RuntimeFrame
        title="검사 장비 · GitHub/runtime 통합 패널"
        sourceLabel="78 DeviceDefinitions / actual source-port UI"
      />
    </div>
  );
}
