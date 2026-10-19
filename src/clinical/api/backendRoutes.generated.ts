export type ClinicalHttpMethod = 'GET'|'POST'|'PUT'|'PATCH'|'DELETE';

export interface BackendRoute {
  method: ClinicalHttpMethod;
  path: string;
  handler: string;
}

export const BACKEND_ROUTES: BackendRoute[] = [
  {
    "method": "POST",
    "path": "/clinical/acquisitions",
    "handler": "AcquisitionController.create"
  },
  {
    "method": "GET",
    "path": "/clinical/acquisitions/:id",
    "handler": "AcquisitionController.get"
  },
  {
    "method": "POST",
    "path": "/clinical/acquisitions/:id/artifacts",
    "handler": "AcquisitionController.artifact"
  },
  {
    "method": "POST",
    "path": "/clinical/acquisitions/:id/data-received",
    "handler": "AcquisitionController.dr"
  },
  {
    "method": "POST",
    "path": "/clinical/acquisitions/:id/pause",
    "handler": "AcquisitionController.pause"
  },
  {
    "method": "POST",
    "path": "/clinical/acquisitions/:id/quality-pending",
    "handler": "AcquisitionController.qp"
  },
  {
    "method": "POST",
    "path": "/clinical/acquisitions/:id/quality-review",
    "handler": "AcquisitionController.q"
  },
  {
    "method": "POST",
    "path": "/clinical/acquisitions/:id/ready",
    "handler": "AcquisitionController.ready"
  },
  {
    "method": "POST",
    "path": "/clinical/acquisitions/:id/repeat",
    "handler": "AcquisitionController.repeat"
  },
  {
    "method": "POST",
    "path": "/clinical/acquisitions/:id/resources/commit",
    "handler": "AcquisitionController.rb"
  },
  {
    "method": "POST",
    "path": "/clinical/acquisitions/:id/resources/device",
    "handler": "AcquisitionController.bd"
  },
  {
    "method": "POST",
    "path": "/clinical/acquisitions/:id/resources/workforce",
    "handler": "AcquisitionController.bw"
  },
  {
    "method": "POST",
    "path": "/clinical/acquisitions/:id/resume",
    "handler": "AcquisitionController.resume"
  },
  {
    "method": "POST",
    "path": "/clinical/acquisitions/:id/start",
    "handler": "AcquisitionController.start"
  },
  {
    "method": "POST",
    "path": "/clinical/acquisitions/:id/stop",
    "handler": "AcquisitionController.stop"
  },
  {
    "method": "POST",
    "path": "/clinical/adverse-events/:id/action",
    "handler": "FrontendSupportController.adverseAction"
  },
  {
    "method": "POST",
    "path": "/clinical/appointment-slots",
    "handler": "FrontendSupportController.createSlot"
  },
  {
    "method": "POST",
    "path": "/clinical/appointments",
    "handler": "FrontendSupportController.book"
  },
  {
    "method": "POST",
    "path": "/clinical/appointments/:id/cancel-self",
    "handler": "FrontendSupportController.appointmentCancelSelf"
  },
  {
    "method": "POST",
    "path": "/clinical/appointments/:id/status",
    "handler": "FrontendSupportController.appointmentStatus"
  },
  {
    "method": "POST",
    "path": "/clinical/appointments/manage",
    "handler": "FrontendSupportController.bookManaged"
  },
  {
    "method": "POST",
    "path": "/clinical/artifact-transfers/:id/progress",
    "handler": "AcquisitionController.transferProgress"
  },
  {
    "method": "POST",
    "path": "/clinical/artifact-transfers/:id/state",
    "handler": "AcquisitionController.transferState"
  },
  {
    "method": "POST",
    "path": "/clinical/artifacts/:id/integrity",
    "handler": "AcquisitionController.integrity"
  },
  {
    "method": "POST",
    "path": "/clinical/artifacts/:id/received",
    "handler": "AcquisitionController.received"
  },
  {
    "method": "POST",
    "path": "/clinical/artifacts/:id/transfers",
    "handler": "AcquisitionController.transfer"
  },
  {
    "method": "GET",
    "path": "/clinical/clinical-review/follow-up-plans/:id",
    "handler": "FrontendSupportController.followDetailClinical"
  },
  {
    "method": "GET",
    "path": "/clinical/clinical-review/patients/:patientUserId/follow-up/current",
    "handler": "FrontendSupportController.followCurrentClinical"
  },
  {
    "method": "GET",
    "path": "/clinical/clinical-review/patients/:patientUserId/health-information/requests",
    "handler": "FrontendSupportController.healthRequestsClinical"
  },
  {
    "method": "GET",
    "path": "/clinical/clinical-review/patients/:patientUserId/health-information/snapshots",
    "handler": "FrontendSupportController.healthSnapshotsClinical"
  },
  {
    "method": "POST",
    "path": "/clinical/clinical-review/patients/:patientUserId/health-information/sync",
    "handler": "FrontendSupportController.healthSyncClinical"
  },
  {
    "method": "GET",
    "path": "/clinical/clinical-review/patients/:patientUserId/support-relations",
    "handler": "FrontendSupportController.supportClinical"
  },
  {
    "method": "POST",
    "path": "/clinical/critical-results",
    "handler": "InterpretationController.critical"
  },
  {
    "method": "POST",
    "path": "/clinical/critical-results/:id/acknowledge",
    "handler": "InterpretationController.ack"
  },
  {
    "method": "POST",
    "path": "/clinical/critical-results/:id/close",
    "handler": "InterpretationController.critClose"
  },
  {
    "method": "POST",
    "path": "/clinical/critical-results/:id/delivered",
    "handler": "InterpretationController.delivered"
  },
  {
    "method": "POST",
    "path": "/clinical/critical-results/:id/escalate",
    "handler": "InterpretationController.critEsc"
  },
  {
    "method": "GET",
    "path": "/clinical/dashboards/sites/:siteId",
    "handler": "FrontendSupportController.siteDashboard"
  },
  {
    "method": "GET",
    "path": "/clinical/dashboards/sites/:siteId/exam-orders",
    "handler": "FrontendSupportController.siteExamOrders"
  },
  {
    "method": "GET",
    "path": "/clinical/dashboards/specialists/:workforceId",
    "handler": "FrontendSupportController.specialistDashboard"
  },
  {
    "method": "GET",
    "path": "/clinical/dashboards/specialists/:workforceId/critical-results",
    "handler": "FrontendSupportController.specialistCritical"
  },
  {
    "method": "GET",
    "path": "/clinical/dashboards/specialists/:workforceId/interpretations",
    "handler": "FrontendSupportController.specialistInterpretations"
  },
  {
    "method": "POST",
    "path": "/clinical/diagnostic-reports",
    "handler": "InterpretationController.report"
  },
  {
    "method": "POST",
    "path": "/clinical/diagnostic-reports/:id/artifacts",
    "handler": "InterpretationController.link"
  },
  {
    "method": "POST",
    "path": "/clinical/diagnostic-reports/:id/sections",
    "handler": "InterpretationController.section"
  },
  {
    "method": "POST",
    "path": "/clinical/diagnostic-reports/:id/sign",
    "handler": "InterpretationController.sign"
  },
  {
    "method": "POST",
    "path": "/clinical/diagnostic-reports/amend",
    "handler": "InterpretationController.amend"
  },
  {
    "method": "POST",
    "path": "/clinical/encounters",
    "handler": "EncounterController.create"
  },
  {
    "method": "POST",
    "path": "/clinical/encounters/:encounterId/follow-up-plans",
    "handler": "FrontendSupportController.followPlan"
  },
  {
    "method": "GET",
    "path": "/clinical/encounters/:id",
    "handler": "EncounterController.get"
  },
  {
    "method": "POST",
    "path": "/clinical/encounters/:id/cancel",
    "handler": "EncounterController.cancel"
  },
  {
    "method": "POST",
    "path": "/clinical/encounters/:id/close",
    "handler": "EncounterController.close"
  },
  {
    "method": "GET",
    "path": "/clinical/encounters/:id/consents",
    "handler": "PrevisitController.consents"
  },
  {
    "method": "POST",
    "path": "/clinical/encounters/:id/consents",
    "handler": "PrevisitController.consent"
  },
  {
    "method": "POST",
    "path": "/clinical/encounters/:id/escalate",
    "handler": "PrevisitController.escalate"
  },
  {
    "method": "POST",
    "path": "/clinical/encounters/:id/identity/:verificationId/complete",
    "handler": "EncounterController.completeIdentity"
  },
  {
    "method": "POST",
    "path": "/clinical/encounters/:id/identity/:verificationId/verify-provider",
    "handler": "EncounterController.verifyProvider"
  },
  {
    "method": "POST",
    "path": "/clinical/encounters/:id/identity/start",
    "handler": "EncounterController.startIdentity"
  },
  {
    "method": "POST",
    "path": "/clinical/encounters/:id/intake",
    "handler": "PrevisitController.intake"
  },
  {
    "method": "POST",
    "path": "/clinical/encounters/:id/intake/:submissionId/answers",
    "handler": "PrevisitController.answer"
  },
  {
    "method": "POST",
    "path": "/clinical/encounters/:id/intake/:submissionId/submit",
    "handler": "PrevisitController.submit"
  },
  {
    "method": "POST",
    "path": "/clinical/encounters/:id/measurements",
    "handler": "PrevisitController.measurement"
  },
  {
    "method": "GET",
    "path": "/clinical/encounters/:id/red-flags",
    "handler": "PrevisitController.redflags"
  },
  {
    "method": "POST",
    "path": "/clinical/encounters/:id/red-flags",
    "handler": "PrevisitController.raise"
  },
  {
    "method": "POST",
    "path": "/clinical/exam-orders",
    "handler": "ExamOrderController.create"
  },
  {
    "method": "GET",
    "path": "/clinical/exam-orders/:id",
    "handler": "ExamOrderController.get"
  },
  {
    "method": "POST",
    "path": "/clinical/exam-orders/:id/accept",
    "handler": "ExamOrderController.accept"
  },
  {
    "method": "POST",
    "path": "/clinical/exam-orders/:id/cancel",
    "handler": "ExamOrderController.cancel"
  },
  {
    "method": "POST",
    "path": "/clinical/exam-orders/:id/complete-acquisition",
    "handler": "AcquisitionController.completeOrder"
  },
  {
    "method": "POST",
    "path": "/clinical/exam-orders/:id/fail",
    "handler": "ExamOrderController.fail"
  },
  {
    "method": "POST",
    "path": "/clinical/exam-orders/:id/reject",
    "handler": "ExamOrderController.reject"
  },
  {
    "method": "POST",
    "path": "/clinical/exam-orders/:id/submit",
    "handler": "ExamOrderController.submit"
  },
  {
    "method": "GET",
    "path": "/clinical/follow-up-plans/:id",
    "handler": "FrontendSupportController.followDetail"
  },
  {
    "method": "POST",
    "path": "/clinical/follow-up-plans/:id/adverse-events",
    "handler": "FrontendSupportController.adverse"
  },
  {
    "method": "POST",
    "path": "/clinical/follow-up-plans/:id/check-ins",
    "handler": "FrontendSupportController.checkin"
  },
  {
    "method": "POST",
    "path": "/clinical/follow-up-plans/:id/measurements",
    "handler": "FrontendSupportController.followMeasurement"
  },
  {
    "method": "POST",
    "path": "/clinical/follow-up-plans/:id/status",
    "handler": "FrontendSupportController.followStatus"
  },
  {
    "method": "POST",
    "path": "/clinical/interpretations",
    "handler": "InterpretationController.create"
  },
  {
    "method": "POST",
    "path": "/clinical/interpretations/:id/assign",
    "handler": "InterpretationController.assign"
  },
  {
    "method": "POST",
    "path": "/clinical/interpretations/:id/audit-events",
    "handler": "InterpretationController.ia"
  },
  {
    "method": "POST",
    "path": "/clinical/interpretations/:id/findings",
    "handler": "InterpretationController.finding"
  },
  {
    "method": "POST",
    "path": "/clinical/interpretations/:id/start",
    "handler": "InterpretationController.start"
  },
  {
    "method": "POST",
    "path": "/clinical/normalization/datasets/:id/imaging-studies",
    "handler": "NormalizationController.img"
  },
  {
    "method": "POST",
    "path": "/clinical/normalization/datasets/:id/lifecycle",
    "handler": "NormalizationController.life"
  },
  {
    "method": "POST",
    "path": "/clinical/normalization/datasets/:id/media-recordings",
    "handler": "NormalizationController.media"
  },
  {
    "method": "POST",
    "path": "/clinical/normalization/datasets/:id/observations",
    "handler": "NormalizationController.obs"
  },
  {
    "method": "POST",
    "path": "/clinical/normalization/datasets/:id/waveforms",
    "handler": "NormalizationController.wf"
  },
  {
    "method": "POST",
    "path": "/clinical/normalization/imaging-series/:id/artifacts",
    "handler": "NormalizationController.imga"
  },
  {
    "method": "POST",
    "path": "/clinical/normalization/imaging-studies/:id/series",
    "handler": "NormalizationController.imgs"
  },
  {
    "method": "POST",
    "path": "/clinical/normalization/runs",
    "handler": "NormalizationController.start"
  },
  {
    "method": "POST",
    "path": "/clinical/normalization/runs/:id/complete",
    "handler": "NormalizationController.complete"
  },
  {
    "method": "POST",
    "path": "/clinical/normalization/runs/:id/datasets",
    "handler": "NormalizationController.dataset"
  },
  {
    "method": "POST",
    "path": "/clinical/normalization/waveforms/:id/channels",
    "handler": "NormalizationController.wfc"
  },
  {
    "method": "POST",
    "path": "/clinical/notifications/:id/read",
    "handler": "FrontendSupportController.notificationRead"
  },
  {
    "method": "GET",
    "path": "/clinical/patients/:patientUserId/active-visit",
    "handler": "FrontendSupportController.activeVisit"
  },
  {
    "method": "GET",
    "path": "/clinical/patients/:patientUserId/appointment-slots",
    "handler": "FrontendSupportController.patientSlots"
  },
  {
    "method": "GET",
    "path": "/clinical/patients/:patientUserId/appointments",
    "handler": "FrontendSupportController.appointments"
  },
  {
    "method": "GET",
    "path": "/clinical/patients/:patientUserId/follow-up/current",
    "handler": "FrontendSupportController.followCurrent"
  },
  {
    "method": "GET",
    "path": "/clinical/patients/:patientUserId/health-information/requests",
    "handler": "FrontendSupportController.healthRequests"
  },
  {
    "method": "GET",
    "path": "/clinical/patients/:patientUserId/health-information/snapshots",
    "handler": "FrontendSupportController.healthSnapshots"
  },
  {
    "method": "POST",
    "path": "/clinical/patients/:patientUserId/health-information/sync",
    "handler": "FrontendSupportController.healthSync"
  },
  {
    "method": "GET",
    "path": "/clinical/patients/:patientUserId/history",
    "handler": "FrontendSupportController.history"
  },
  {
    "method": "GET",
    "path": "/clinical/patients/:patientUserId/notifications",
    "handler": "FrontendSupportController.notifications"
  },
  {
    "method": "POST",
    "path": "/clinical/patients/:patientUserId/notifications",
    "handler": "FrontendSupportController.notificationCreate"
  },
  {
    "method": "GET",
    "path": "/clinical/patients/:patientUserId/pharmacies",
    "handler": "FrontendSupportController.pharmacies"
  },
  {
    "method": "GET",
    "path": "/clinical/patients/:patientUserId/prescriptions",
    "handler": "FrontendSupportController.prescriptions"
  },
  {
    "method": "GET",
    "path": "/clinical/patients/:patientUserId/prescriptions/:prescriptionId",
    "handler": "FrontendSupportController.prescriptionDetail"
  },
  {
    "method": "GET",
    "path": "/clinical/patients/:patientUserId/reports",
    "handler": "FrontendSupportController.reports"
  },
  {
    "method": "GET",
    "path": "/clinical/patients/:patientUserId/reports/:reportId",
    "handler": "FrontendSupportController.reportDetail"
  },
  {
    "method": "GET",
    "path": "/clinical/patients/:patientUserId/support-relations",
    "handler": "FrontendSupportController.support"
  },
  {
    "method": "POST",
    "path": "/clinical/patients/:patientUserId/support-relations",
    "handler": "FrontendSupportController.supportCreate"
  },
  {
    "method": "POST",
    "path": "/clinical/pharmacies",
    "handler": "FrontendSupportController.pharmacyUpsert"
  },
  {
    "method": "POST",
    "path": "/clinical/prescriptions",
    "handler": "PrescriptionController.create"
  },
  {
    "method": "POST",
    "path": "/clinical/prescriptions/:id/cancel",
    "handler": "PrescriptionController.cancel"
  },
  {
    "method": "GET",
    "path": "/clinical/prescriptions/:id/fulfillment",
    "handler": "PrescriptionController.fulfill"
  },
  {
    "method": "POST",
    "path": "/clinical/prescriptions/:id/fulfillments",
    "handler": "PrescriptionController.fulfillmentRecord"
  },
  {
    "method": "POST",
    "path": "/clinical/prescriptions/:id/items",
    "handler": "PrescriptionController.item"
  },
  {
    "method": "GET",
    "path": "/clinical/prescriptions/:id/pharmacy-selection",
    "handler": "FrontendSupportController.pharmacySelected"
  },
  {
    "method": "POST",
    "path": "/clinical/prescriptions/:id/pharmacy-selection",
    "handler": "FrontendSupportController.pharmacySelect"
  },
  {
    "method": "POST",
    "path": "/clinical/prescriptions/:id/receipt-events",
    "handler": "PrescriptionController.receipt"
  },
  {
    "method": "POST",
    "path": "/clinical/prescriptions/:id/safety-alerts/:alertId/resolve",
    "handler": "PrescriptionController.resolve"
  },
  {
    "method": "POST",
    "path": "/clinical/prescriptions/:id/safety-check",
    "handler": "PrescriptionController.check"
  },
  {
    "method": "POST",
    "path": "/clinical/prescriptions/:id/sign",
    "handler": "PrescriptionController.sign"
  },
  {
    "method": "POST",
    "path": "/clinical/prescriptions/:id/transmit",
    "handler": "PrescriptionController.tx"
  },
  {
    "method": "POST",
    "path": "/clinical/prescriptions/safety-checks/:runId/complete",
    "handler": "PrescriptionController.done"
  },
  {
    "method": "POST",
    "path": "/clinical/quality-reviews/:id/finalize",
    "handler": "AcquisitionController.qf"
  },
  {
    "method": "GET",
    "path": "/clinical/readiness/devices/:deviceInstanceId/adapter-eligibility",
    "handler": "ReadinessController.adapter"
  },
  {
    "method": "GET",
    "path": "/clinical/readiness/sites/:siteId/devices",
    "handler": "ReadinessController.devices"
  },
  {
    "method": "GET",
    "path": "/clinical/readiness/sites/:siteId/devices/operational",
    "handler": "ReadinessController.operational"
  },
  {
    "method": "GET",
    "path": "/clinical/readiness/sites/:siteId/exams",
    "handler": "ReadinessController.exams"
  },
  {
    "method": "GET",
    "path": "/clinical/readiness/sites/:siteId/exams/:examDefinitionId/devices",
    "handler": "ReadinessController.candidates"
  },
  {
    "method": "GET",
    "path": "/clinical/readiness/sites/:siteId/workforce-capabilities",
    "handler": "ReadinessController.workforce"
  },
  {
    "method": "POST",
    "path": "/clinical/red-flags/:id/acknowledge",
    "handler": "PrevisitController.ack"
  },
  {
    "method": "POST",
    "path": "/clinical/red-flags/:id/resolve",
    "handler": "PrevisitController.resolve"
  },
  {
    "method": "POST",
    "path": "/clinical/repeat-requests/:id/accept",
    "handler": "AcquisitionController.repeatAccept"
  },
  {
    "method": "POST",
    "path": "/clinical/repeat-requests/:id/cancel",
    "handler": "AcquisitionController.repeatCancel"
  },
  {
    "method": "POST",
    "path": "/clinical/repeat-requests/:id/decline",
    "handler": "AcquisitionController.repeatDecline"
  },
  {
    "method": "POST",
    "path": "/clinical/repeat-requests/:id/satisfy",
    "handler": "AcquisitionController.repeatSatisfy"
  },
  {
    "method": "GET",
    "path": "/clinical/sites/:siteId/appointment-slots",
    "handler": "FrontendSupportController.siteSlots"
  },
  {
    "method": "GET",
    "path": "/clinical/sites/:siteId/patients/:patientUserId/active-visit",
    "handler": "FrontendSupportController.siteActiveVisit"
  },
  {
    "method": "GET",
    "path": "/clinical/sites/:siteId/patients/:patientUserId/history",
    "handler": "FrontendSupportController.siteHistory"
  },
  {
    "method": "GET",
    "path": "/clinical/sites/:siteId/patients/:patientUserId/prescriptions",
    "handler": "FrontendSupportController.sitePrescriptions"
  },
  {
    "method": "GET",
    "path": "/clinical/sites/:siteId/patients/:patientUserId/prescriptions/:prescriptionId",
    "handler": "FrontendSupportController.sitePrescriptionDetail"
  },
  {
    "method": "GET",
    "path": "/clinical/sites/:siteId/patients/:patientUserId/reports",
    "handler": "FrontendSupportController.siteReports"
  },
  {
    "method": "GET",
    "path": "/clinical/sites/:siteId/patients/:patientUserId/reports/:reportId",
    "handler": "FrontendSupportController.siteReportDetail"
  },
  {
    "method": "GET",
    "path": "/clinical/sites/:siteId/pharmacies",
    "handler": "FrontendSupportController.sitePharmacies"
  },
  {
    "method": "POST",
    "path": "/clinical/support-relations/:id/revoke",
    "handler": "FrontendSupportController.supportRevoke"
  },
  {
    "method": "POST",
    "path": "/clinical/support-relations/:id/verify",
    "handler": "FrontendSupportController.supportVerify"
  },
  {
    "method": "POST",
    "path": "/clinical/visits",
    "handler": "VisitController.create"
  },
  {
    "method": "GET",
    "path": "/clinical/visits/:id",
    "handler": "VisitController.get"
  },
  {
    "method": "POST",
    "path": "/clinical/visits/:id/end",
    "handler": "VisitController.end"
  },
  {
    "method": "POST",
    "path": "/clinical/visits/:id/interruptions",
    "handler": "VisitController.interrupt"
  },
  {
    "method": "POST",
    "path": "/clinical/visits/:id/modality",
    "handler": "VisitController.modality"
  },
  {
    "method": "POST",
    "path": "/clinical/visits/:id/participants",
    "handler": "VisitController.participant"
  },
  {
    "method": "POST",
    "path": "/clinical/visits/:id/precheck",
    "handler": "VisitController.precheck"
  },
  {
    "method": "POST",
    "path": "/clinical/visits/:id/ready",
    "handler": "VisitController.ready"
  },
  {
    "method": "POST",
    "path": "/clinical/visits/:id/self-precheck",
    "handler": "FrontendSupportController.selfPrecheck"
  },
  {
    "method": "POST",
    "path": "/clinical/visits/:id/start",
    "handler": "VisitController.start"
  },
  {
    "method": "POST",
    "path": "/edge/control/command-acks",
    "handler": "EdgeControlController.commandAck"
  },
  {
    "method": "GET",
    "path": "/edge/control/commands",
    "handler": "EdgeControlController.pending"
  },
  {
    "method": "POST",
    "path": "/edge/control/commands",
    "handler": "EdgeControlController.command"
  },
  {
    "method": "POST",
    "path": "/edge/control/events",
    "handler": "EdgeControlController.event"
  },
  {
    "method": "POST",
    "path": "/edge/control/faults",
    "handler": "EdgeControlController.fault"
  },
  {
    "method": "POST",
    "path": "/edge/control/heartbeat",
    "handler": "EdgeControlController.heartbeat"
  },
  {
    "method": "POST",
    "path": "/edge/control/uploads",
    "handler": "EdgeControlController.upload"
  },
  {
    "method": "POST",
    "path": "/edge/control/uploads/:uploadId/finalize",
    "handler": "EdgeControlController.uploadFinalize"
  },
  {
    "method": "POST",
    "path": "/edge/control/uploads/:uploadId/parts",
    "handler": "EdgeControlController.uploadPart"
  },
  {
    "method": "GET",
    "path": "/health/clinical-db/live",
    "handler": "ClinicalDatabaseHealthController.live"
  },
  {
    "method": "POST",
    "path": "/interop/connections",
    "handler": "InteropController.conn"
  },
  {
    "method": "POST",
    "path": "/interop/connections/:id/activate",
    "handler": "InteropController.ca"
  },
  {
    "method": "POST",
    "path": "/interop/messages",
    "handler": "InteropController.msg"
  },
  {
    "method": "POST",
    "path": "/interop/messages/:id/acks",
    "handler": "InteropController.ack"
  },
  {
    "method": "POST",
    "path": "/interop/messages/:id/dicom-manifest",
    "handler": "InteropController.dicom"
  },
  {
    "method": "POST",
    "path": "/interop/messages/:id/fhir-manifest",
    "handler": "InteropController.fhir"
  },
  {
    "method": "POST",
    "path": "/interop/messages/:id/retry",
    "handler": "InteropController.retry"
  },
  {
    "method": "POST",
    "path": "/interop/profiles",
    "handler": "InteropController.profile"
  },
  {
    "method": "POST",
    "path": "/interop/profiles/:id/approve",
    "handler": "InteropController.pa"
  },
  {
    "method": "GET",
    "path": "/interop/quarantine",
    "handler": "InteropController.q"
  },
  {
    "method": "POST",
    "path": "/interop/quarantine/:id/resolve",
    "handler": "InteropController.qr"
  },
  {
    "method": "POST",
    "path": "/interop/systems",
    "handler": "InteropController.sys"
  },
  {
    "method": "POST",
    "path": "/operations/backups",
    "handler": "OperationsController.backup"
  },
  {
    "method": "POST",
    "path": "/operations/changes",
    "handler": "OperationsController.change"
  },
  {
    "method": "POST",
    "path": "/operations/changes/:id/status",
    "handler": "OperationsController.changeS"
  },
  {
    "method": "POST",
    "path": "/operations/components",
    "handler": "OperationsController.component"
  },
  {
    "method": "POST",
    "path": "/operations/degraded-policies",
    "handler": "OperationsController.degraded"
  },
  {
    "method": "POST",
    "path": "/operations/degraded-policies/:id/activate",
    "handler": "OperationsController.degradedA"
  },
  {
    "method": "GET",
    "path": "/operations/health",
    "handler": "OperationsController.health"
  },
  {
    "method": "POST",
    "path": "/operations/health-observations",
    "handler": "OperationsController.obs"
  },
  {
    "method": "POST",
    "path": "/operations/incidents",
    "handler": "OperationsController.incident"
  },
  {
    "method": "POST",
    "path": "/operations/incidents/:id/status",
    "handler": "OperationsController.incidentStatus"
  },
  {
    "method": "POST",
    "path": "/operations/nodes",
    "handler": "OperationsController.node"
  },
  {
    "method": "GET",
    "path": "/operations/readiness",
    "handler": "OperationsController.ready"
  },
  {
    "method": "POST",
    "path": "/operations/recovery-drills",
    "handler": "OperationsController.drill"
  },
  {
    "method": "POST",
    "path": "/operations/recovery-drills/:id/complete",
    "handler": "OperationsController.drillDone"
  },
  {
    "method": "POST",
    "path": "/operations/replication-checkpoints",
    "handler": "OperationsController.repl"
  },
  {
    "method": "POST",
    "path": "/operations/site-connectivity",
    "handler": "OperationsController.conn"
  },
  {
    "method": "POST",
    "path": "/operations/slos",
    "handler": "OperationsController.slo"
  },
  {
    "method": "GET",
    "path": "/security/audit",
    "handler": "SecurityController.audit"
  },
  {
    "method": "POST",
    "path": "/security/break-glass",
    "handler": "SecurityController.bg"
  },
  {
    "method": "POST",
    "path": "/security/break-glass/:id/review",
    "handler": "SecurityController.bgr"
  },
  {
    "method": "POST",
    "path": "/security/encryption-keys/metadata",
    "handler": "SecurityController.key"
  },
  {
    "method": "POST",
    "path": "/security/evidence",
    "handler": "SecurityController.ev"
  },
  {
    "method": "POST",
    "path": "/security/incidents",
    "handler": "SecurityController.inc"
  },
  {
    "method": "POST",
    "path": "/security/incidents/:id/status",
    "handler": "SecurityController.incu"
  },
  {
    "method": "POST",
    "path": "/security/legal-holds",
    "handler": "SecurityController.hold"
  },
  {
    "method": "POST",
    "path": "/security/legal-holds/:id/release",
    "handler": "SecurityController.release"
  },
  {
    "method": "POST",
    "path": "/security/patient-bindings",
    "handler": "SecurityController.patientBinding"
  },
  {
    "method": "GET",
    "path": "/security/permissions",
    "handler": "SecurityController.permissions"
  },
  {
    "method": "POST",
    "path": "/security/retention/dispositions",
    "handler": "SecurityController.disp"
  },
  {
    "method": "POST",
    "path": "/security/retention/dispositions/:id/approve",
    "handler": "SecurityController.dispa"
  },
  {
    "method": "POST",
    "path": "/security/retention/policies",
    "handler": "SecurityController.rp"
  },
  {
    "method": "POST",
    "path": "/security/retention/policies/:id/activate",
    "handler": "SecurityController.rpa"
  },
  {
    "method": "POST",
    "path": "/security/role-assignments",
    "handler": "SecurityController.assign"
  },
  {
    "method": "POST",
    "path": "/security/role-assignments/:id/revoke",
    "handler": "SecurityController.revoke"
  },
  {
    "method": "GET",
    "path": "/security/roles",
    "handler": "SecurityController.roles"
  },
  {
    "method": "POST",
    "path": "/security/supporter-bindings",
    "handler": "SecurityController.supporterBinding"
  },
  {
    "method": "POST",
    "path": "/validation/changes",
    "handler": "ValidationController.ch"
  },
  {
    "method": "POST",
    "path": "/validation/changes/:id/approve",
    "handler": "ValidationController.cha"
  },
  {
    "method": "POST",
    "path": "/validation/controls",
    "handler": "ValidationController.ctl"
  },
  {
    "method": "POST",
    "path": "/validation/evidence-packages/:id/verify",
    "handler": "ValidationController.epv"
  },
  {
    "method": "POST",
    "path": "/validation/release-gates",
    "handler": "ValidationController.gate"
  },
  {
    "method": "GET",
    "path": "/validation/release-gates/summary",
    "handler": "ValidationController.summary"
  },
  {
    "method": "POST",
    "path": "/validation/releases",
    "handler": "ValidationController.rel"
  },
  {
    "method": "POST",
    "path": "/validation/releases/:id/approve",
    "handler": "ValidationController.approval"
  },
  {
    "method": "POST",
    "path": "/validation/releases/:id/evaluate",
    "handler": "ValidationController.eval"
  },
  {
    "method": "POST",
    "path": "/validation/releases/:id/evidence-packages",
    "handler": "ValidationController.ep"
  },
  {
    "method": "POST",
    "path": "/validation/releases/:id/finalize-approval",
    "handler": "ValidationController.final"
  },
  {
    "method": "POST",
    "path": "/validation/releases/:id/ready-for-approval",
    "handler": "ValidationController.ready"
  },
  {
    "method": "POST",
    "path": "/validation/releases/:id/start-validation",
    "handler": "ValidationController.relv"
  },
  {
    "method": "POST",
    "path": "/validation/requirement-control-links",
    "handler": "ValidationController.rcl"
  },
  {
    "method": "POST",
    "path": "/validation/requirement-test-links",
    "handler": "ValidationController.rtl"
  },
  {
    "method": "POST",
    "path": "/validation/requirements",
    "handler": "ValidationController.req"
  },
  {
    "method": "POST",
    "path": "/validation/requirements/:id/approve",
    "handler": "ValidationController.reqa"
  },
  {
    "method": "POST",
    "path": "/validation/test-cases",
    "handler": "ValidationController.tc"
  },
  {
    "method": "POST",
    "path": "/validation/test-runs",
    "handler": "ValidationController.run"
  },
  {
    "method": "POST",
    "path": "/validation/test-runs/:id/complete",
    "handler": "ValidationController.runDone"
  },
  {
    "method": "POST",
    "path": "/validation/test-runs/:id/results",
    "handler": "ValidationController.result"
  },
  {
    "method": "GET",
    "path": "/validation/traceability",
    "handler": "ValidationController.trace"
  }
] as BackendRoute[];

export const BACKEND_ROUTE_KEYS = new Set(
  BACKEND_ROUTES.map((route) => `${route.method} ${route.path}`),
);

export function assertBackendRoute(method: ClinicalHttpMethod, path: string): void {
  const key = `${method} ${path}`;
  if (!BACKEND_ROUTE_KEYS.has(key)) {
    throw new Error(`Unknown clinical backend route: ${key}`);
  }
}
