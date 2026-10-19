import React, { createContext, useContext, useMemo } from 'react';
import { ClinicalApi } from './clinicalApi';
import { createClinicalFacade } from './clinicalFacade';
import { useClinicalAuth } from '../auth/ClinicalAuthContext';

type Facade = ReturnType<typeof createClinicalFacade>;
const ClinicalApiContext = createContext<Facade | null>(null);

export function ClinicalApiProvider({ children }: { children: React.ReactNode }) {
  const { session } = useClinicalAuth();
  const facade = useMemo(() => {
    const api = new ClinicalApi(() => session);
    return createClinicalFacade(api);
  }, [session]);
  return <ClinicalApiContext.Provider value={facade}>{children}</ClinicalApiContext.Provider>;
}

export function useClinicalApi(): Facade {
  const value = useContext(ClinicalApiContext);
  if (!value) throw new Error('useClinicalApi must be used inside ClinicalApiProvider');
  return value;
}
