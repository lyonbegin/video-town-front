import React, { createContext, useContext, useMemo, useState } from 'react';
import { loadClinicalSession } from './clinicalSession';
import type { ClinicalSession } from '../types';

interface ClinicalAuthValue {
  session: ClinicalSession;
  refreshSession: () => void;
}

const ClinicalAuthContext = createContext<ClinicalAuthValue | null>(null);

export function ClinicalAuthProvider({ children }: { children: React.ReactNode }) {
  const [revision, setRevision] = useState(0);
  const session = useMemo(() => loadClinicalSession(), [revision]);
  const value = useMemo(
    () => ({ session, refreshSession: () => setRevision((v) => v + 1) }),
    [session],
  );
  return <ClinicalAuthContext.Provider value={value}>{children}</ClinicalAuthContext.Provider>;
}

export function useClinicalAuth(): ClinicalAuthValue {
  const value = useContext(ClinicalAuthContext);
  if (!value) throw new Error('useClinicalAuth must be used inside ClinicalAuthProvider');
  return value;
}
