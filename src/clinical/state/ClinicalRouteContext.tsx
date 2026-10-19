import React, { createContext, useContext, useMemo, useState } from 'react';
import type { ClinicalRouteContext } from '../types';
import { useClinicalAuth } from '../auth/ClinicalAuthContext';

const KEY = 'clinical_route_context_v1';

function load(): ClinicalRouteContext {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const Ctx = createContext<{
  context: ClinicalRouteContext;
  update: (patch: Partial<ClinicalRouteContext>) => void;
} | null>(null);

export function ClinicalRouteContextProvider({ children }: { children: React.ReactNode }) {
  const { session } = useClinicalAuth();
  const [local, setLocal] = useState<ClinicalRouteContext>(() => load());

  const context = useMemo(() => ({
    patientUserId: local.patientUserId || session.patientUserId,
    siteId: local.siteId || session.siteId,
    workforceId: local.workforceId || session.workforceId,
    ...local,
  }), [local, session]);

  const value = useMemo(() => ({
    context,
    update: (patch: Partial<ClinicalRouteContext>) => {
      setLocal((prev) => {
        const next = { ...prev, ...patch };
        localStorage.setItem(KEY, JSON.stringify(next));
        return next;
      });
    },
  }), [context]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useClinicalRouteContext() {
  const value = useContext(Ctx);
  if (!value) throw new Error('useClinicalRouteContext must be used inside provider');
  return value;
}
