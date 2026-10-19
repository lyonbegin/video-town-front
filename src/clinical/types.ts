export type ClinicalWorkspaceRole =
  | 'COMMON'
  | 'PATIENT'
  | 'PATIENT_SUPPORTER'
  | 'ONSITE_CLINICAL_STAFF'
  | 'CLINICIAN'
  | 'CLINICAL_ADMIN'
  | 'OPERATIONS_ADMIN'
  | 'SECURITY_ADMIN'
  | 'QUALITY_ADMIN'
  | 'PLATFORM_ADMIN';

export interface ClinicalSession {
  userId: string;
  workforceId?: string;
  accessToken?: string;
  roles: ClinicalWorkspaceRole[];
  siteId?: string;
  patientUserId?: string;
  purposeOfUse: string;
}

export interface ClinicalRouteContext {
  patientUserId?: string;
  siteId?: string;
  workforceId?: string;
  encounterId?: string;
  visitId?: string;
  examOrderId?: string;
  acquisitionId?: string;
  reportId?: string;
  prescriptionId?: string;
  followUpPlanId?: string;
  interpretationId?: string;
  intakeSubmissionId?: string;
}

export interface ApiState<T=unknown> {
  loading: boolean;
  error?: string;
  data?: T;
}
