import type { ClinicalSession, ClinicalWorkspaceRole } from '../types';

const ROLE_KEY = 'clinical_roles';
const TOKEN_KEY = 'clinical_access_token';
const LEGACY_PROFILE_KEY = 'carelink-dev-profile';

function parseRoles(raw: string | null): ClinicalWorkspaceRole[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is ClinicalWorkspaceRole => typeof x === 'string') : [];
  } catch {
    return raw.split(',').map((x) => x.trim()).filter(Boolean) as ClinicalWorkspaceRole[];
  }
}

function decodeJwtPayload(token?: string): Record<string, unknown> {
  if (!token) return {};
  try {
    const [, payload] = token.split('.');
    if (!payload) return {};
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = decodeURIComponent(
      atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );
    return JSON.parse(decoded);
  } catch {
    return {};
  }
}

function loadExistingProfile(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(LEGACY_PROFILE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function normalizeLegacyRole(value: unknown): ClinicalWorkspaceRole[] {
  if (typeof value !== 'string') return [];
  const role = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (!role) return [];
  if (role === 'PATIENT') return ['PATIENT'];
  if (['DOCTOR','PHYSICIAN','CLINICIAN','SPECIALIST','REMOTE_CLINICIAN'].includes(role)) return ['CLINICIAN'];
  if (['NURSE','RADIOLOGIC_TECH','RADIOLOGIST_TECH','LAB_TECH','ONSITE_STAFF','ONSITE_CLINICAL_STAFF','MEDICAL_STAFF'].includes(role)) return ['ONSITE_CLINICAL_STAFF'];
  if (['ADMIN','PLATFORM_ADMIN','SUPER_ADMIN'].includes(role)) return ['PLATFORM_ADMIN'];
  if (['OPERATIONS','OPERATIONS_ADMIN'].includes(role)) return ['OPERATIONS_ADMIN'];
  if (['SECURITY','SECURITY_ADMIN'].includes(role)) return ['SECURITY_ADMIN'];
  if (['QUALITY','QUALITY_ADMIN'].includes(role)) return ['QUALITY_ADMIN'];
  return [];
}

function rolesFromClaims(claims: Record<string, unknown>): ClinicalWorkspaceRole[] {
  const candidate = claims.roles ?? claims.role ?? claims.clinical_roles ?? claims.platformRole;
  if (Array.isArray(candidate)) {
    return candidate.flatMap((x) => normalizeLegacyRole(x).length ? normalizeLegacyRole(x) : (typeof x === 'string' ? [x as ClinicalWorkspaceRole] : []));
  }
  if (typeof candidate === 'string') {
    const mapped = normalizeLegacyRole(candidate);
    return mapped.length ? mapped : candidate.split(',').map((x) => x.trim()).filter(Boolean) as ClinicalWorkspaceRole[];
  }
  return [];
}

export function loadClinicalSession(): ClinicalSession {
  const legacy = loadExistingProfile();
  const legacyToken = typeof legacy.token === 'string' ? legacy.token : undefined;
  const accessToken = localStorage.getItem(TOKEN_KEY) || legacyToken || undefined;
  const claims = decodeJwtPayload(accessToken);

  const userId =
    localStorage.getItem('clinical_user_id') ||
    (typeof claims.sub === 'string' ? claims.sub : '') ||
    (typeof claims.userId === 'string' ? claims.userId : '') ||
    (typeof legacy.userId === 'string' ? legacy.userId : '') ||
    localStorage.getItem('ens_user_id') ||
    '';

  const production = import.meta.env.PROD === true;
  const devRole = !production ? String(import.meta.env.VITE_CLINICAL_DEV_ROLE || '') : '';
  const roles = parseRoles(localStorage.getItem(ROLE_KEY));
  if (!roles.length) roles.push(...rolesFromClaims(claims));
  if (!roles.length) roles.push(...normalizeLegacyRole(legacy.platformRole));
  if (!roles.length && devRole) roles.push(devRole as ClinicalWorkspaceRole);
  if (!roles.includes('COMMON')) roles.push('COMMON');

  const workforceId =
    localStorage.getItem('clinical_workforce_id') ||
    (typeof claims.workforceId === 'string' ? claims.workforceId : undefined);
  const siteId =
    localStorage.getItem('clinical_site_id') ||
    (typeof claims.siteId === 'string' ? claims.siteId : undefined);
  const patientUserId =
    localStorage.getItem('clinical_patient_user_id') ||
    (typeof claims.patientUserId === 'string' ? claims.patientUserId : undefined) ||
    (roles.includes('PATIENT') ? userId : undefined);

  return {
    userId,
    workforceId,
    accessToken,
    roles: Array.from(new Set(roles)),
    siteId,
    patientUserId,
    purposeOfUse: localStorage.getItem('clinical_purpose_of_use') || 'TREATMENT',
  };
}

export function saveClinicalRoles(roles: ClinicalWorkspaceRole[]): void {
  localStorage.setItem(ROLE_KEY, JSON.stringify(roles));
}

export function hasAnyRole(session: ClinicalSession, required: string[]): boolean {
  if (!required.length) return true;
  return required.some((role) => session.roles.includes(role as ClinicalWorkspaceRole));
}
