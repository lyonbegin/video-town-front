import React from 'react';
import { ClinicalCard, ClinicalEmpty, ClinicalNotice, JsonDebug } from '../ui/ClinicalUi';
import { useClinicalApi } from '../api/ClinicalApiContext';
import { useClinicalRouteContext } from '../state/ClinicalRouteContext';
import { useClinicalResource } from '../hooks/useClinicalResource';

export function ClinicianDashboardScreen() {
  const api=useClinicalApi();
  const { context }=useClinicalRouteContext();
  const workforce=context.workforceId || '';
  const site=context.siteId || '';
  const state=useClinicalResource(Boolean(workforce && site),()=>api.clinician.dashboard(workforce,site) as Promise<any>,[workforce,site]);

  if(!workforce || !site)return <ClinicalEmpty message="Workforce와 Site Scope가 필요합니다."/>;
  return (
    <>
      {state.error && <ClinicalNotice tone="danger">{state.error}</ClinicalNotice>}
      <div className="cf-grid-4">
        {['대기 진료','진료 중','판독 대기','중요 결과'].map((x)=><ClinicalCard key={x} title={x}><strong className="cf-metric">—</strong></ClinicalCard>)}
      </div>
      <ClinicalCard title="전문의 Queue">
        {state.loading?<ClinicalEmpty message="Queue를 불러오는 중입니다."/>:<pre className="cf-pre">{JSON.stringify(state.data?.queue || state.data || {},null,2)}</pre>}
      </ClinicalCard>
      <JsonDebug value={state.data}/>
    </>
  );
}
