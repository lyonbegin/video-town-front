import type { AuthProfile, ConsultationSession, PlatformRole, TelemedicineRole } from '../types';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8888').replace(/\/$/, '');
export const TEST_LOGIN_KEY = import.meta.env.VITE_TEST_LOGIN_KEY || '';
async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  const body = await response.json().catch(() => null);

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

  const result = await request<{ accessToken: string }>('/auth/dev-token', {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  return { ...input, token: result.accessToken };
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
