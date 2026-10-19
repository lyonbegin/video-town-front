import React, { useMemo, useState } from 'react';
import type { ClinicalScreenSpec } from '../screenRegistry';
import { ClinicalBadge, ClinicalButton, ClinicalCard, ClinicalField, ClinicalNotice } from '../ui/ClinicalUi';
import { useClinicalRouteContext } from '../state/ClinicalRouteContext';

function toneFor(_index:number) {
  return 'neutral';
}

export function GenericClinicalScreen({ screen }: { screen: ClinicalScreenSpec }) {
  const { context, update }=useClinicalRouteContext();
  const [values,setValues]=useState<Record<string,string>>({});
  const split=Math.ceil(screen.sections.length/2);
  const left=screen.sections.slice(0,split);
  const right=screen.sections.slice(split);

  const isForm=useMemo(()=>['form','alertform','prescription_edit','followup_form'].includes(screen.layout),[screen.layout]);

  if(isForm){
    return (
      <div className="cf-grid-2">
        <ClinicalCard title={screen.title}>
          {left.map((item)=><ClinicalField key={item} label={item} value={values[item]||''} onChange={(v)=>setValues((p)=>({...p,[item]:v}))}/>)}
          <ClinicalButton>저장</ClinicalButton>
        </ClinicalCard>
        <ClinicalCard title="확인">
          {right.map((item,i)=><div className="cf-status-row" key={item}><strong>{item}</strong><ClinicalBadge tone={toneFor(i) as any}>데이터 대기</ClinicalBadge></div>)}
          <ClinicalNotice>실제 상태변경은 해당 Backend command API 응답으로만 확정합니다.</ClinicalNotice>
        </ClinicalCard>
      </div>
    );
  }

  if(screen.layout==='table' || screen.layout==='quality_table'){
    return (
      <ClinicalCard title={screen.title}>
        <table className="cf-table">
          <thead><tr>{screen.sections.map((x)=><th key={x}>{x}</th>)}</tr></thead>
          <tbody>{[0,1,2,3].map((r)=><tr key={r}>{screen.sections.map((x,c)=><td key={x}>{c===screen.sections.length-1?<ClinicalBadge tone={r%2?'info':'success'}>데이터 대기</ClinicalBadge>:'—'}</td>)}</tr>)}</tbody>
        </table>
      </ClinicalCard>
    );
  }

  if(screen.layout==='dashboard'){
    return (
      <>
        <div className="cf-grid-4">{screen.sections.slice(0,4).map((x,i)=><ClinicalCard title={x} key={x}><strong className="cf-metric">{i+1}</strong></ClinicalCard>)}</div>
        <ClinicalCard title="진행 현황">{screen.sections.map((x,i)=><div className="cf-status-row" key={x}><strong>{x}</strong><ClinicalBadge tone={toneFor(i) as any}>데이터 대기</ClinicalBadge></div>)}</ClinicalCard>
      </>
    );
  }

  if(screen.layout==='status' || screen.layout==='suitability' || screen.layout==='escalation'){
    return (
      <>
        <ClinicalNotice tone={screen.layout==='escalation'?'danger':'info'}>
          {screen.layout==='suitability'?'플랫폼은 의료적 판단을 대신하지 않습니다. 의료인이 최종 판단합니다.':screen.subtitle}
        </ClinicalNotice>
        <div className="cf-grid-2">
          <ClinicalCard title="현재 상태">{left.map((x,i)=><div className="cf-status-row" key={x}><strong>{x}</strong><ClinicalBadge tone={toneFor(i) as any}>데이터 대기</ClinicalBadge></div>)}</ClinicalCard>
          <ClinicalCard title="다음 단계">{right.map((x,i)=><div className="cf-status-row" key={x}><strong>{x}</strong><ClinicalBadge tone={toneFor(i+1) as any}>데이터 대기</ClinicalBadge></div>)}</ClinicalCard>
        </div>
      </>
    );
  }

  return (
    <div className="cf-grid-2">
      <ClinicalCard title={screen.title}>
        {left.map((x,i)=><div className="cf-status-row" key={x}><strong>{x}</strong><ClinicalBadge tone={toneFor(i) as any}>데이터 대기</ClinicalBadge></div>)}
        <ClinicalButton>계속</ClinicalButton>
      </ClinicalCard>
      <ClinicalCard title="확인 사항">
        {right.map((x,i)=><div className="cf-status-row" key={x}><strong>{x}</strong><span>정보 표시</span></div>)}
        <ClinicalNotice>
          {screen.basis}{screen.extension?` · ${screen.extension}`:''}
          <br/>연결할 Read API가 없는 화면은 임의 임상 데이터를 만들지 않고 빈 상태로 유지합니다.
        </ClinicalNotice>
      </ClinicalCard>
    </div>
  );
}
