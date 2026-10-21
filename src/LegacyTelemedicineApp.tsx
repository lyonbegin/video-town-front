import { useEffect, useState } from 'react';
import type { AuthProfile, ConsultationSession } from './types';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import ConsultationRoom from './components/ConsultationRoom';
import { DEV_PROFILE_UPDATED_EVENT, refreshDevProfile } from './lib/api';

const STORAGE_KEY = 'carelink-dev-profile';

function loadStoredProfile(): AuthProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as AuthProfile : null;
  } catch { return null; }
}

export default function App() {
  const [profile, setProfile] = useState<AuthProfile | null>(() => loadStoredProfile());
  const [selected, setSelected] = useState<ConsultationSession | null>(null);

  useEffect(() => {
    const onUpdated = (event: Event) => {
      const detail =
        (event as CustomEvent<AuthProfile>).detail;

      if (detail?.token) {
        setProfile(detail);
      }
    };

    window.addEventListener(
      DEV_PROFILE_UPDATED_EVENT,
      onUpdated,
    );

    const stored =
      loadStoredProfile();

    if (stored) {
      void refreshDevProfile(stored).catch(() => {
        // Login screen/API error handling remains the fallback when the
        // development token endpoint itself is unavailable.
      });
    }

    return () => {
      window.removeEventListener(
        DEV_PROFILE_UPDATED_EVENT,
        onUpdated,
      );
    };
  }, []);

  function login(next: AuthProfile) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setProfile(next);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setSelected(null);
    setProfile(null);
  }

  if (!profile) return <LoginPage onLogin={login} />;
  if (selected) return <ConsultationRoom profile={profile} initialSession={selected} onBack={() => setSelected(null)} />;
  return <Dashboard profile={profile} onOpen={setSelected} onLogout={logout} />;
}
