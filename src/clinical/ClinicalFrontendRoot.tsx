import React from 'react';
import { ClinicalAuthProvider } from './auth/ClinicalAuthContext';
import { ClinicalApiProvider } from './api/ClinicalApiContext';
import { ClinicalRouteContextProvider } from './state/ClinicalRouteContext';
import { ClinicalRoutes } from './ClinicalRoutes';
import './styles/clinical.css';

export default function ClinicalFrontendRoot(){
  return (
    <ClinicalAuthProvider>
      <ClinicalApiProvider>
        <ClinicalRouteContextProvider>
          <ClinicalRoutes/>
        </ClinicalRouteContextProvider>
      </ClinicalApiProvider>
    </ClinicalAuthProvider>
  );
}
