import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { CLINICAL_SCREENS } from '../screenRegistry';
import { useClinicalAuth } from '../auth/ClinicalAuthContext';
import { hasAnyRole } from '../auth/clinicalSession';
import { ClinicalFlowFooter } from './ClinicalFlowFooter';

const groups=[
  {label:'공통',key:'COMMON'},
  {label:'환자',key:'PATIENT'},
  {label:'현장 의료인력',key:'ONSITE'},
  {label:'원격 의료인',key:'CLINICIAN'},
  {label:'운영·관리',key:'OPERATIONS'},
] as const;

export function ClinicalShell(){
  const { session }=useClinicalAuth();
  const location=useLocation();
  const current=CLINICAL_SCREENS.find((x)=>x.path===location.pathname);

  const visibleGroups=groups.filter((group)=>{
    const screens=CLINICAL_SCREENS.filter((x)=>x.roleKey===group.key);
    return screens.some((screen)=>hasAnyRole(session,screen.requiredRoles));
  });

  const activeGroup=current?.roleKey || visibleGroups[0]?.key || 'COMMON';
  const nav=CLINICAL_SCREENS.filter((x)=>x.roleKey===activeGroup && hasAnyRole(session,x.requiredRoles));

  return (
    <div className="cf-app">
      <header className="cf-topbar">
        <div className="cf-brand-mark">+</div>
        <div className="cf-brand"><strong>비대면진료</strong><small>Telemedicine Service</small></div>
        <div className="cf-top-spacer"/>
        <button className="cf-top-action">한국어</button>
        <NavLink className="cf-top-action" to="/clinical/common/g03">접근성</NavLink>
        <span className="cf-user">{session.userId || '로그인 필요'}</span>
      </header>
      <div className="cf-body">
        <aside className="cf-sidebar">
          <div className="cf-role-switch">
            {visibleGroups.map((group)=><NavLink key={group.key} to={CLINICAL_SCREENS.find((x)=>x.roleKey===group.key)?.path || '/clinical/common/g01'} className={group.key===activeGroup?'active':''}>{group.label}</NavLink>)}
          </div>
          <nav className="cf-nav">
            {nav.map((screen)=><NavLink to={screen.path} key={screen.code}><span>{screen.code}</span>{screen.title}</NavLink>)}
          </nav>
        </aside>
        <main className="cf-content">
          {current && <div className="cf-page-head"><div><h1>{current.title}</h1><p>{current.subtitle}</p></div><span>{current.code}</span></div>}
          <Outlet/>
          <ClinicalFlowFooter/>
        </main>
      </div>
    </div>
  );
}
