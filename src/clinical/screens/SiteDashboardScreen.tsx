import React from 'react';
import { ClinicalCard, ClinicalEmpty, ClinicalNotice, JsonDebug } from '../ui/ClinicalUi';
import { useClinicalApi } from '../api/ClinicalApiContext';
import { useClinicalRouteContext } from '../state/ClinicalRouteContext';
import { useClinicalResource } from '../hooks/useClinicalResource';

export function SiteDashboardScreen() {
  const api=useClinicalApi();
  const { context }=useClinicalRouteContext();
  const siteId=context.siteId || '';
  const state=useClinicalResource(Boolean(siteId),()=>api.site.dashboard(siteId) as Promise<any>,[siteId]);

  if(!siteId)return <ClinicalEmpty message="Site Scope가 필요합니다."/>;
  return (
    <>
      {state.error && <ClinicalNotice tone="danger">{state.error}</ClinicalNotice>}
      <div className="cf-grid-4">
        {['오늘 예약','대기','검사 대기','장비·Edge'].map((x,i)=><ClinicalCard key={x} title={x}><strong className="cf-metric">{i===0?'—':'0'}</strong></ClinicalCard>)}
      </div>
      <ClinicalCard title="현장 상태">
        {state.loading?<ClinicalEmpty message="현장 상태를 불러오는 중입니다."/>:
          <pre className="cf-pre">{JSON.stringify(state.data?.queue || state.data || {},null,2)}</pre>}
      </ClinicalCard>
      <JsonDebug value={state.data}/>
    </>
  );
}
