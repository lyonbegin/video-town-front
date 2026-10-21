import type { AuthProfile, ConsultationSession, PlatformRole, TelemedicineRole } from '../types';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8888').replace(/\/$/, '');
export const TEST_LOGIN_KEY = import.meta.env.VITE_TEST_LOGIN_KEY || '';
const DEV_PROFILE_KEY = 'carelink-dev-profile';
export const DEV_PROFILE_UPDATED_EVENT = 'carelink-dev-profile-updated';

function loadStoredDevProfile(): AuthProfile | null {
  try {
    const raw = localStorage.getItem(DEV_PROFILE_KEY);
    return raw ? JSON.parse(raw) as AuthProfile : null;
  } catch {
    return null;
  }
}

function persistDevProfile(profile: AuthProfile): void {
  localStorage.setItem(DEV_PROFILE_KEY, JSON.stringify(profile));
  window.dispatchEvent(new CustomEvent<AuthProfile>(DEV_PROFILE_UPDATED_EVENT, {
    detail: profile,
  }));
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
  allowDevTokenRefresh = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  const body = await response.json().catch(() => null);

  if (
    !response.ok &&
    response.status === 401 &&
    allowDevTokenRefresh &&
    path !== '/auth/dev-token'
  ) {
    const stored = loadStoredDevProfile();

    if (stored) {
      const refreshed = await issueDevToken({
        userId: stored.userId,
        name: stored.name,
        platformRole: stored.platformRole,
      });

      persistDevProfile(refreshed);

      return request<T>(
        path,
        init,
        refreshed.token,
        false,
      );
    }
  }

  if (!response.ok) {
    const message = body?.message || body?.error || `${response.status} ${response.statusText}`;
    throw new Error(Array.isArray(message) ? message.join(', ') : String(message));
  }

  return body as T;
}

export async function issueDevToken(input: {
  userId: string;
  name: string;
  platformRole: PlatformRole;
}): Promise<AuthProfile> {
  const headers: Record<string, string> = {};
  if (TEST_LOGIN_KEY) headers['x-test-login-key'] = TEST_LOGIN_KEY;

  const result = await request<{ accessToken: string }>(
    '/auth/dev-token',
    {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    },
    undefined,
    false,
  );

  return { ...input, token: result.accessToken };
}

export async function refreshDevProfile(
  profile?: AuthProfile | null,
): Promise<AuthProfile | null> {
  const current =
    profile ??
    loadStoredDevProfile();

  if (!current) {
    return null;
  }

  const refreshed =
    await issueDevToken({
      userId: current.userId,
      name: current.name,
      platformRole:
        current.platformRole,
    });

  persistDevProfile(refreshed);
  return refreshed;
}

export async function getHealth() {
  return request<any>('/health');
}

export async function listMyConsultations(token: string): Promise<ConsultationSession[]> {
  return request<ConsultationSession[]>('/telemedicine/consultations/me', {}, token);
}

export async function getConsultation(token: string, id: string): Promise<ConsultationSession> {
  return request<ConsultationSession>(`/telemedicine/consultations/${encodeURIComponent(id)}`, {}, token);
}

export async function createConsultation(
  token: string,
  input: {
    title: string;
    scheduledAt?: string;
    maxParticipants?: number;
    participants: Array<{ userId: string; displayName?: string; role: TelemedicineRole }>;
  },
): Promise<ConsultationSession> {
  return request<ConsultationSession>('/telemedicine/consultations', {
    method: 'POST',
    body: JSON.stringify(input),
  }, token);
}
