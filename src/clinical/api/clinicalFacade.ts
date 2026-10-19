import type { ClinicalApi } from './clinicalApi';

export function createClinicalFacade(api: ClinicalApi) {
  return {
    patient: {
      appointmentSlots: (patientUserId: string, siteId: string) =>
        api.get(`/clinical/patients/${patientUserId}/appointment-slots`, { params: { siteId } }),
      appointments: (patientUserId: string) =>
        api.get(`/clinical/patients/${patientUserId}/appointments`),
      bookAppointment: (body: unknown) =>
        api.post('/clinical/appointments', body),
      cancelAppointment: (appointmentId: string, body: unknown) =>
        api.post(`/clinical/appointments/${appointmentId}/cancel-self`, body),
      supportRelations: (patientUserId: string) =>
        api.get(`/clinical/patients/${patientUserId}/support-relations`),
      createSupportRelation: (patientUserId: string, body: unknown) =>
        api.post(`/clinical/patients/${patientUserId}/support-relations`, body),
      healthInfoRequests: (patientUserId: string) =>
        api.get(`/clinical/patients/${patientUserId}/health-information/requests`),
      healthInfoSnapshots: (patientUserId: string) =>
        api.get(`/clinical/patients/${patientUserId}/health-information/snapshots`),
      requestHealthInfoSync: (patientUserId: string, body: unknown) =>
        api.post(`/clinical/patients/${patientUserId}/health-information/sync`, body),
      history: (patientUserId: string) =>
        api.get(`/clinical/patients/${patientUserId}/history`),
      reports: (patientUserId: string) =>
        api.get(`/clinical/patients/${patientUserId}/reports`),
      prescriptions: (patientUserId: string) =>
        api.get(`/clinical/patients/${patientUserId}/prescriptions`),
      activeVisit: (patientUserId: string) =>
        api.get(`/clinical/patients/${patientUserId}/active-visit`),
      currentFollowUp: (patientUserId: string) =>
        api.get(`/clinical/patients/${patientUserId}/follow-up/current`),
      notifications: (patientUserId: string) =>
        api.get(`/clinical/patients/${patientUserId}/notifications`),
      pharmacies: (patientUserId: string, params?: { regionCode?: string; q?: string }) =>
        api.get(`/clinical/patients/${patientUserId}/pharmacies`, { params }),
      selectPharmacy: (prescriptionId: string, body: unknown) =>
        api.post(`/clinical/prescriptions/${prescriptionId}/pharmacy-selection`, body),
    },

    encounter: {
      create: (body: unknown) => api.post('/clinical/encounters', body),
      get: (id: string) => api.get(`/clinical/encounters/${id}`),
      startIdentity: (id: string, body: unknown) =>
        api.post(`/clinical/encounters/${id}/identity/start`, body),
      consents: (id: string) => api.get(`/clinical/encounters/${id}/consents`),
      acceptConsent: (id: string, body: unknown) =>
        api.post(`/clinical/encounters/${id}/consents`, body),
      startIntake: (id: string, body: unknown) =>
        api.post(`/clinical/encounters/${id}/intake`, body),
      answerIntake: (id: string, submissionId: string, body: unknown) =>
        api.post(`/clinical/encounters/${id}/intake/${submissionId}/answers`, body),
      submitIntake: (id: string, submissionId: string, body: unknown) =>
        api.post(`/clinical/encounters/${id}/intake/${submissionId}/submit`, body),
      measurements: (id: string, body: unknown) =>
        api.post(`/clinical/encounters/${id}/measurements`, body),
      redFlags: (id: string) => api.get(`/clinical/encounters/${id}/red-flags`),
      followUpPlan: (id: string, body: unknown) =>
        api.post(`/clinical/encounters/${id}/follow-up-plans`, body),
    },

    visit: {
      selfPrecheck: (visitId: string, body: unknown) =>
        api.post(`/clinical/visits/${visitId}/self-precheck`, body),
      start: (visitId: string, body: unknown) =>
        api.post(`/clinical/visits/${visitId}/start`, body),
      end: (visitId: string, body: unknown) =>
        api.post(`/clinical/visits/${visitId}/end`, body),
    },

    site: {
      dashboard: (siteId: string) =>
        api.get(`/clinical/dashboards/sites/${siteId}`),
      examOrderQueue: (siteId: string, status?: string) =>
        api.get(`/clinical/dashboards/sites/${siteId}/exam-orders`, { params: status ? { status } : {} }),
      readiness: (siteId: string, examDefinitionId: string) =>
        api.get(`/clinical/readiness/sites/${siteId}/exams`),
      devices: (siteId: string, examDefinitionId: string) =>
        api.get(`/clinical/readiness/sites/${siteId}/exams/${examDefinitionId}/devices`),
    },

    exams: {
      createOrder: (body: unknown) => api.post('/clinical/exam-orders', body),
      submitOrder: (orderId: string, body: unknown) =>
        api.post(`/clinical/exam-orders/${orderId}/submit`, body),
      acceptOrder: (orderId: string, body: unknown) =>
        api.post(`/clinical/exam-orders/${orderId}/accept`, body),
      createAcquisition: (body: unknown) => api.post('/clinical/acquisitions', body),
      bindWorkforce: (acquisitionId: string, body: unknown) =>
        api.post(`/clinical/acquisitions/${acquisitionId}/resources/workforce`, body),
      bindDevice: (acquisitionId: string, body: unknown) =>
        api.post(`/clinical/acquisitions/${acquisitionId}/resources/device`, body),
      commitResources: (acquisitionId: string, body: unknown) =>
        api.post(`/clinical/acquisitions/${acquisitionId}/resources/commit`, body),
      ready: (acquisitionId: string, body: unknown) =>
        api.post(`/clinical/acquisitions/${acquisitionId}/ready`, body),
      start: (acquisitionId: string, body: unknown) =>
        api.post(`/clinical/acquisitions/${acquisitionId}/start`, body),
      stop: (acquisitionId: string, body: unknown) =>
        api.post(`/clinical/acquisitions/${acquisitionId}/stop`, body),
      qualityReview: (acquisitionId: string, body: unknown) =>
        api.post(`/clinical/acquisitions/${acquisitionId}/quality-review`, body),
    },

    clinician: {
      dashboard: (workforceId: string, siteId: string) =>
        api.get(`/clinical/dashboards/specialists/${workforceId}`, { params: { siteId } }),
      interpretations: (workforceId: string, siteId: string, status?: string) =>
        api.get(`/clinical/dashboards/specialists/${workforceId}/interpretations`, {
          params: { siteId, ...(status ? { status } : {}) },
        }),
      criticalResults: (workforceId: string, siteId: string) =>
        api.get(`/clinical/dashboards/specialists/${workforceId}/critical-results`, { params: { siteId } }),
      createInterpretation: (body: unknown) =>
        api.post('/clinical/interpretations', body),
      createReport: (body: unknown) =>
        api.post('/clinical/diagnostic-reports', body),
      signReport: (reportId: string, body: unknown) =>
        api.post(`/clinical/diagnostic-reports/${reportId}/sign`, body),
      createPrescription: (body: unknown) =>
        api.post('/clinical/prescriptions', body),
    },

    followUp: {
      get: (planId: string) => api.get(`/clinical/follow-up-plans/${planId}`),
      checkIn: (planId: string, body: unknown) =>
        api.post(`/clinical/follow-up-plans/${planId}/check-ins`, body),
      measurement: (planId: string, body: unknown) =>
        api.post(`/clinical/follow-up-plans/${planId}/measurements`, body),
      adverseEvent: (planId: string, body: unknown) =>
        api.post(`/clinical/follow-up-plans/${planId}/adverse-events`, body),
      setStatus: (planId: string, body: unknown) =>
        api.post(`/clinical/follow-up-plans/${planId}/status`, body),
    },
  };
}
