export const SCREEN_API_REQUIREMENTS: Record<string,string[]> = {
  "P03": [
    "GET /clinical/patients/:patientUserId/appointment-slots",
    "POST /clinical/appointments"
  ],
  "P05": [
    "GET /clinical/patients/:patientUserId/support-relations",
    "POST /clinical/patients/:patientUserId/support-relations"
  ],
  "P06": [
    "POST /clinical/encounters/:id/identity/start"
  ],
  "P07": [
    "GET /clinical/encounters/:id/consents",
    "POST /clinical/encounters/:id/consents"
  ],
  "P08": [
    "POST /clinical/patients/:patientUserId/health-information/sync",
    "GET /clinical/patients/:patientUserId/health-information/snapshots"
  ],
  "P09": [
    "POST /clinical/encounters/:id/intake",
    "POST /clinical/encounters/:id/intake/:submissionId/answers",
    "POST /clinical/encounters/:id/intake/:submissionId/submit"
  ],
  "P12": [
    "GET /clinical/encounters/:id/red-flags"
  ],
  "P13": [
    "POST /clinical/visits/:id/self-precheck"
  ],
  "P18": [
    "GET /clinical/patients/:patientUserId/prescriptions"
  ],
  "P19": [
    "GET /clinical/patients/:patientUserId/pharmacies",
    "POST /clinical/prescriptions/:id/pharmacy-selection"
  ],
  "P21": [
    "GET /clinical/patients/:patientUserId/follow-up/current"
  ],
  "P22": [
    "POST /clinical/follow-up-plans/:id/check-ins"
  ],
  "P23": [
    "POST /clinical/follow-up-plans/:id/measurements"
  ],
  "P24": [
    "POST /clinical/follow-up-plans/:id/adverse-events"
  ],
  "P26": [
    "GET /clinical/patients/:patientUserId/history",
    "GET /clinical/patients/:patientUserId/reports",
    "GET /clinical/patients/:patientUserId/prescriptions"
  ],
  "S01": [
    "GET /clinical/dashboards/sites/:siteId"
  ],
  "S11": [
    "GET /clinical/dashboards/sites/:siteId/exam-orders"
  ],
  "S15": [
    "POST /clinical/acquisitions/:id/start",
    "POST /clinical/acquisitions/:id/stop"
  ],
  "S18": [
    "POST /clinical/acquisitions/:id/quality-review"
  ],
  "C01": [
    "GET /clinical/dashboards/specialists/:workforceId"
  ],
  "C06": [
    "POST /clinical/exam-orders",
    "POST /clinical/exam-orders/:id/submit"
  ],
  "C14": [
    "POST /clinical/interpretations"
  ],
  "C15": [
    "POST /clinical/diagnostic-reports",
    "POST /clinical/diagnostic-reports/:id/sign"
  ],
  "C17": [
    "POST /clinical/prescriptions"
  ],
  "C20": [
    "POST /clinical/encounters/:encounterId/follow-up-plans"
  ]
};
