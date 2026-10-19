import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CLINICAL_SCREENS } from '../screenRegistry';
import { ClinicalButton } from '../ui/ClinicalUi';
import { useClinicalAuth } from '../auth/ClinicalAuthContext';
import { hasAnyRole } from '../auth/clinicalSession';

export function ClinicalFlowFooter() {
  const location=useLocation();
  const navigate=useNavigate();
  const { session }=useClinicalAuth();
  const current=CLINICAL_SCREENS.find((screen)=>screen.path===location.pathname);
  if(!current)return null;

  const sameRole=CLINICAL_SCREENS.filter(
    (screen)=>screen.roleKey===current.roleKey && hasAnyRole(session,screen.requiredRoles),
  );
  const index=sameRole.findIndex((screen)=>screen.code===current.code);
  const prev=index>0?sameRole[index-1]:undefined;
  const next=index>=0 && index<sameRole.length-1?sameRole[index+1]:undefined;

  return (
    <div className="cf-flow-footer">
      <div>{prev && <ClinicalButton variant="secondary" onClick={()=>navigate(prev.path)}>← {prev.code} 이전</ClinicalButton>}</div>
      <div>{next && <ClinicalButton onClick={()=>navigate(next.path)}>{next.code} 다음 →</ClinicalButton>}</div>
    </div>
  );
}
