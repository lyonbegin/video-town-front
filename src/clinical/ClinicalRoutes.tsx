import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ClinicalShell } from './layout/ClinicalShell';
import { CLINICAL_SCREENS } from './screenRegistry';
import { ClinicalRoleGate } from './auth/ClinicalRoleGate';
import { ClinicalScreenResolver } from './screens/ClinicalScreenResolver';

export function ClinicalRoutes(){
  return (
    <Routes>
      <Route element={<ClinicalShell/>}>
        {CLINICAL_SCREENS.map((screen)=>{
          const relative=screen.path.replace(/^\/clinical\//,'');
          return (
            <Route
              key={screen.code}
              path={relative}
              element={
                <ClinicalRoleGate requiredRoles={screen.requiredRoles}>
                  <ClinicalScreenResolver screen={screen}/>
                </ClinicalRoleGate>
              }
            />
          );
        })}
        <Route index element={<Navigate replace to="common/g01"/>}/>
        <Route path="*" element={<Navigate replace to="common/g01"/>}/>
      </Route>
    </Routes>
  );
}
