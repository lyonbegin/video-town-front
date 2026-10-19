import React, { useMemo, useState } from 'react';
import type { ClinicalScreenSpec } from '../screenRegistry';
import type { ClinicalRouteContext } from '../types';
import { useClinicalApi } from '../api/ClinicalApiContext';
import { useClinicalRouteContext } from '../state/ClinicalRouteContext';
import {
  ClinicalBadge,
  ClinicalButton,
  ClinicalCard,
  ClinicalEmpty,
  ClinicalField,
  ClinicalNotice,
} from '../ui/ClinicalUi';

type Api = ReturnType<typeof useClinicalApi>;
type ContextKey = keyof ClinicalRouteContext;

type FieldKind = 'text'|'number'|'select'|'json'|'datetime-local';
interface FieldSpec {
  key: string;
  label: string;
  kind?: FieldKind;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  defaultValue?: string;
}

interface ActionSpec {
  id: string;
  label: string;
  kind: 'read'|'command';
  requiredContext?: ContextKey[];
  fields?: FieldSpec[];
  execute: (
    api: Api,
    context: ClinicalRouteContext,
    values: Record<string,string>,
  ) => Promise<unknown>;
  capture?: (result: any) => Partial<ClinicalRouteContext>;
}

function stringValue(values: Record<string,string>, key: string): string {
  return String(values[key] ?? '').trim();
}

function optionalString(values: Record<string,string>, key: string): string|undefined {
  const value=stringValue(values,key);
  return value || undefined;
}

function numberValue(values: Record<string,string>, key: string, fallback?: number): number {
  const raw=stringValue(values,key);
  if (!raw && fallback !== undefined) return fallback;
  const parsed=Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`${key}: 숫자를 입력하세요.`);
  return parsed;
}

function boolValue(values: Record<string,string>, key: string, fallback=false): boolean {
  const raw=stringValue(values,key);
  if (!raw) return fallback;
  return raw === 'true';
}

function jsonValue(values: Record<string,string>, key: string, fallback: unknown = {}): any {
  const raw=stringValue(values,key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${key}: 올바른 JSON 형식이 아닙니다.`);
  }
}

function requireContext(context: ClinicalRouteContext, key: ContextKey): string {
  const value=context[key];
  if (!value) throw new Error(`${String(key)}가 필요합니다. 상단 작업 컨텍스트에 입력하세요.`);
  return String(value);
}

function omitUndefined<T extends Record<string,unknown>>(input:T):T {
  return Object.fromEntries(
    Object.entries(input).filter(([,value])=>value !== undefined && value !== ''),
  ) as T;
}

const RELATION_TYPES=[
  'LEGAL_GUARDIAN','FAMILY','CAREGIVER','ACTIVITY_ASSISTANT',
  'PUBLIC_HEALTH_STAFF','INTERPRETER','OTHER',
];
const IDENTITY_METHODS=[
  'MOBILE_ID','PASS','CERTIFICATE','STAFF_ASSISTED','GUARDIAN_ASSISTED',
  'MANUAL_REVIEW','OTHER',
];
const HEALTH_SOURCES=['HIRA','MYHEALTHWAY','HOSPITAL','FHIR','OTHER'];
const INTAKE_ROLES=['PATIENT','GUARDIAN','CAREGIVER','PUBLIC_HEALTH_STAFF','CLINICIAN'];
const ANSWER_SOURCES=['PATIENT','GUARDIAN','CAREGIVER','CLINICIAN','PUBLIC_HEALTH_STAFF','DEVICE','EXTERNAL_SYSTEM'];
const FOLLOWUP_SOURCES=['PATIENT','GUARDIAN','CAREGIVER','STAFF'];
const MEASUREMENT_SOURCES=['PATIENT','CAREGIVER','PUBLIC_HEALTH_CENTER','DEVICE','HOSPITAL','EXTERNAL_SYSTEM'];
const PRIORITIES=['ROUTINE','PRIORITY','URGENT','EMERGENCY'];
const QUALITY_OUTCOMES=['ACCEPTABLE','ACCEPTABLE_WITH_LIMITATIONS','REPEAT_REQUIRED','UNUSABLE'];

const BINDINGS: Record<string,ActionSpec[]> = {
  P05: [
    {
      id:'support-list',label:'등록된 보호자·대리인 불러오기',kind:'read',
      requiredContext:['patientUserId'],
      execute:(api,c)=>api.patient.supportRelations(requireContext(c,'patientUserId')),
    },
    {
      id:'support-create',label:'보호자·대리인 등록',kind:'command',
      requiredContext:['patientUserId'],
      fields:[
        {key:'supporterUserId',label:'지원자 사용자 ID',required:true},
        {key:'relationType',label:'관계 유형',kind:'select',options:RELATION_TYPES,defaultValue:'FAMILY',required:true},
        {key:'scope',label:'참여 범위(JSON)',kind:'json',defaultValue:'{}'},
        {key:'verificationRef',label:'관계 확인 참조'},
      ],
      execute:(api,c,v)=>api.patient.createSupportRelation(requireContext(c,'patientUserId'),omitUndefined({
        supporterUserId:stringValue(v,'supporterUserId'),
        relationType:stringValue(v,'relationType'),
        scope:jsonValue(v,'scope',{}),
        verificationRef:optionalString(v,'verificationRef'),
      })),
    },
  ],

  P06: [
    {
      id:'identity-start',label:'본인확인 시작',kind:'command',
      requiredContext:['encounterId'],
      fields:[
        {key:'method',label:'본인확인 방법',kind:'select',options:IDENTITY_METHODS,defaultValue:'MOBILE_ID',required:true},
        {key:'providerTransactionRef',label:'인증기관 거래 참조'},
        {key:'evidenceRef',label:'증빙 참조'},
      ],
      execute:(api,c,v)=>api.encounter.startIdentity(requireContext(c,'encounterId'),omitUndefined({
        method:stringValue(v,'method'),
        providerTransactionRef:optionalString(v,'providerTransactionRef'),
        evidenceRef:optionalString(v,'evidenceRef'),
      })),
    },
  ],

  P08: [
    {
      id:'health-snapshots',label:'연동된 건강정보 불러오기',kind:'read',
      requiredContext:['patientUserId'],
      execute:(api,c)=>api.patient.healthInfoSnapshots(requireContext(c,'patientUserId')),
    },
    {
      id:'health-sync',label:'건강정보 연동 요청',kind:'command',
      requiredContext:['patientUserId'],
      fields:[
        {key:'sourceSystem',label:'정보 출처',kind:'select',options:HEALTH_SOURCES,defaultValue:'HOSPITAL',required:true},
        {key:'requestedScope',label:'요청 범위(JSON)',kind:'json',defaultValue:'{}',required:true},
      ],
      execute:(api,c,v)=>api.patient.requestHealthInfoSync(requireContext(c,'patientUserId'),omitUndefined({
        sourceSystem:stringValue(v,'sourceSystem'),
        careEncounterId:c.encounterId,
        requestedScope:jsonValue(v,'requestedScope',{}),
      })),
    },
  ],

  P09: [
    {
      id:'intake-start',label:'사전 문진 시작',kind:'command',
      requiredContext:['encounterId'],
      fields:[
        {key:'intakeTemplateId',label:'문진 템플릿 ID',required:true},
        {key:'sourceRole',label:'작성 주체',kind:'select',options:INTAKE_ROLES,defaultValue:'PATIENT',required:true},
      ],
      execute:(api,c,v)=>api.encounter.startIntake(requireContext(c,'encounterId'),{
        intakeTemplateId:stringValue(v,'intakeTemplateId'),
        sourceRole:stringValue(v,'sourceRole'),
      }),
      capture:(r)=>({ intakeSubmissionId:String(r?.id ?? r?.submissionId ?? '') || undefined }),
    },
    {
      id:'intake-answer',label:'문진 답변 저장',kind:'command',
      requiredContext:['encounterId','intakeSubmissionId'],
      fields:[
        {key:'intakeQuestionId',label:'문진 질문 ID',required:true},
        {key:'answer',label:'답변(JSON)',kind:'json',defaultValue:'{}',required:true},
        {key:'source',label:'답변 출처',kind:'select',options:ANSWER_SOURCES,defaultValue:'PATIENT',required:true},
      ],
      execute:(api,c,v)=>api.encounter.answerIntake(
        requireContext(c,'encounterId'),
        requireContext(c,'intakeSubmissionId'),
        {
          intakeQuestionId:stringValue(v,'intakeQuestionId'),
          answer:jsonValue(v,'answer',{}),
          source:stringValue(v,'source'),
        },
      ),
    },
    {
      id:'intake-submit',label:'사전 문진 제출',kind:'command',
      requiredContext:['encounterId','intakeSubmissionId'],
      execute:(api,c)=>api.encounter.submitIntake(
        requireContext(c,'encounterId'),
        requireContext(c,'intakeSubmissionId'),
        {},
      ),
    },
  ],

  P12: [
    {
      id:'redflags',label:'진료 전 확인 결과 불러오기',kind:'read',
      requiredContext:['encounterId'],
      execute:(api,c)=>api.encounter.redFlags(requireContext(c,'encounterId')),
    },
  ],

  P18: [
    {
      id:'prescriptions',label:'처방 내역 불러오기',kind:'read',
      requiredContext:['patientUserId'],
      execute:(api,c)=>api.patient.prescriptions(requireContext(c,'patientUserId')),
    },
  ],

  P19: [
    {
      id:'pharmacy-list',label:'약국 목록 불러오기',kind:'read',
      requiredContext:['patientUserId'],
      fields:[
        {key:'regionCode',label:'지역 코드'},
        {key:'q',label:'약국 검색어'},
      ],
      execute:(api,c,v)=>api.patient.pharmacies(requireContext(c,'patientUserId'),omitUndefined({
        regionCode:optionalString(v,'regionCode'),
        q:optionalString(v,'q'),
      })),
    },
    {
      id:'pharmacy-select',label:'처방 전달 약국 선택',kind:'command',
      requiredContext:['prescriptionId'],
      fields:[
        {key:'pharmacyDirectoryEntryId',label:'약국 디렉터리 ID',required:true},
        {key:'supportRelationId',label:'대리관계 ID'},
      ],
      execute:(api,c,v)=>api.patient.selectPharmacy(requireContext(c,'prescriptionId'),omitUndefined({
        pharmacyDirectoryEntryId:stringValue(v,'pharmacyDirectoryEntryId'),
        supportRelationId:optionalString(v,'supportRelationId'),
      })),
    },
  ],

  P21: [
    {
      id:'follow-current',label:'현재 사후관리 계획 불러오기',kind:'read',
      requiredContext:['patientUserId'],
      execute:(api,c)=>api.patient.currentFollowUp(requireContext(c,'patientUserId')),
      capture:(r)=>({ followUpPlanId:String(r?.id ?? r?.followUpPlanId ?? '') || undefined }),
    },
  ],

  P22: [
    {
      id:'follow-checkin',label:'경과 확인 제출',kind:'command',
      requiredContext:['followUpPlanId'],
      fields:[
        {key:'sourceRole',label:'작성 주체',kind:'select',options:FOLLOWUP_SOURCES,defaultValue:'PATIENT',required:true},
        {key:'symptomPayload',label:'증상 변화(JSON)',kind:'json',defaultValue:'{}',required:true},
        {key:'overallStatus',label:'전체 상태',kind:'select',options:['IMPROVING','STABLE','WORSENING','URGENT_REVIEW'],defaultValue:'STABLE',required:true},
      ],
      execute:(api,c,v)=>api.followUp.checkIn(requireContext(c,'followUpPlanId'),{
        sourceRole:stringValue(v,'sourceRole'),
        symptomPayload:jsonValue(v,'symptomPayload',{}),
        overallStatus:stringValue(v,'overallStatus'),
      }),
    },
  ],

  P23: [
    {
      id:'follow-measurement',label:'자가측정 기록 저장',kind:'command',
      requiredContext:['followUpPlanId'],
      fields:[
        {key:'measurementType',label:'측정 종류',required:true},
        {key:'values',label:'측정값(JSON)',kind:'json',defaultValue:'{}',required:true},
        {key:'unitCode',label:'단위 코드'},
        {key:'source',label:'측정 출처',kind:'select',options:MEASUREMENT_SOURCES,defaultValue:'PATIENT',required:true},
        {key:'deviceInstanceId',label:'장비 인스턴스 ID'},
        {key:'measuredAt',label:'측정 시각',kind:'datetime-local',required:true},
      ],
      execute:(api,c,v)=>api.followUp.measurement(requireContext(c,'followUpPlanId'),omitUndefined({
        measurementType:stringValue(v,'measurementType'),
        values:jsonValue(v,'values',{}),
        unitCode:optionalString(v,'unitCode'),
        source:stringValue(v,'source'),
        deviceInstanceId:optionalString(v,'deviceInstanceId'),
        measuredAt:stringValue(v,'measuredAt'),
      })),
    },
  ],

  P24: [
    {
      id:'adverse-event',label:'이상반응·증상 악화 신고',kind:'command',
      requiredContext:['followUpPlanId'],
      fields:[
        {key:'prescriptionOrderId',label:'관련 처방 ID'},
        {key:'eventSeverity',label:'중증도',kind:'select',options:['MILD','MODERATE','SEVERE','LIFE_THREATENING'],defaultValue:'MILD',required:true},
        {key:'eventRef',label:'증상·사건 기록 참조',required:true},
      ],
      execute:(api,c,v)=>api.followUp.adverseEvent(requireContext(c,'followUpPlanId'),omitUndefined({
        prescriptionOrderId:optionalString(v,'prescriptionOrderId'),
        eventSeverity:stringValue(v,'eventSeverity'),
        eventRef:stringValue(v,'eventRef'),
      })),
    },
  ],

  P26: [
    {
      id:'history',label:'과거 진료 불러오기',kind:'read',
      requiredContext:['patientUserId'],
      execute:(api,c)=>api.patient.history(requireContext(c,'patientUserId')),
    },
    {
      id:'reports',label:'보고서 불러오기',kind:'read',
      requiredContext:['patientUserId'],
      execute:(api,c)=>api.patient.reports(requireContext(c,'patientUserId')),
    },
    {
      id:'rx-history',label:'처방 이력 불러오기',kind:'read',
      requiredContext:['patientUserId'],
      execute:(api,c)=>api.patient.prescriptions(requireContext(c,'patientUserId')),
    },
  ],

  S11: [
    {
      id:'site-orders',label:'검사오더 대기열 불러오기',kind:'read',
      requiredContext:['siteId'],
      fields:[{key:'status',label:'상태 필터'}],
      execute:(api,c,v)=>api.site.examOrderQueue(requireContext(c,'siteId'),optionalString(v,'status')),
    },
  ],

  S15: [
    {
      id:'acquisition-start',label:'검사 수집 시작',kind:'command',
      requiredContext:['acquisitionId'],
      fields:[
        {key:'expectedVersion',label:'현재 버전',kind:'number',defaultValue:'1',required:true},
        {key:'reasonCode',label:'사유 코드',defaultValue:'START_ACQUISITION',required:true},
        {key:'reasonRef',label:'사유 참조'},
      ],
      execute:(api,c,v)=>api.exams.start(requireContext(c,'acquisitionId'),omitUndefined({
        expectedVersion:numberValue(v,'expectedVersion',1),
        reasonCode:stringValue(v,'reasonCode'),
        reasonRef:optionalString(v,'reasonRef'),
      })),
    },
    {
      id:'acquisition-stop',label:'검사 수집 종료',kind:'command',
      requiredContext:['acquisitionId'],
      fields:[
        {key:'expectedVersion',label:'현재 버전',kind:'number',defaultValue:'1',required:true},
        {key:'reasonCode',label:'사유 코드',defaultValue:'STOP_ACQUISITION',required:true},
        {key:'reasonRef',label:'사유 참조'},
      ],
      execute:(api,c,v)=>api.exams.stop(requireContext(c,'acquisitionId'),omitUndefined({
        expectedVersion:numberValue(v,'expectedVersion',1),
        reasonCode:stringValue(v,'reasonCode'),
        reasonRef:optionalString(v,'reasonRef'),
      })),
    },
  ],

  S18: [
    {
      id:'quality-review',label:'기술 품질 검토 저장',kind:'command',
      requiredContext:['acquisitionId'],
      fields:[
        {key:'reviewerCapabilityGrantId',label:'검토자 Capability Grant ID',required:true},
        {key:'outcome',label:'기술 품질 결과',kind:'select',options:QUALITY_OUTCOMES,defaultValue:'ACCEPTABLE',required:true},
        {key:'limitationOrInstructionRef',label:'제한·재검 지시 참조'},
        {key:'correctionOfReviewId',label:'정정 대상 검토 ID'},
      ],
      execute:(api,c,v)=>api.exams.qualityReview(requireContext(c,'acquisitionId'),omitUndefined({
        reviewerCapabilityGrantId:stringValue(v,'reviewerCapabilityGrantId'),
        outcome:stringValue(v,'outcome'),
        limitationOrInstructionRef:optionalString(v,'limitationOrInstructionRef'),
        correctionOfReviewId:optionalString(v,'correctionOfReviewId'),
      })),
    },
  ],

  C06: [
    {
      id:'exam-create',label:'검사오더 생성',kind:'command',
      requiredContext:['encounterId','siteId','workforceId'],
      fields:[
        {key:'examDefinitionId',label:'검사 정의 ID',required:true},
        {key:'examDefinitionRevision',label:'검사 정의 Revision',kind:'number',defaultValue:'1',required:true},
        {key:'orderingCapabilityGrantId',label:'오더 Capability Grant ID',required:true},
        {key:'priority',label:'우선순위',kind:'select',options:PRIORITIES,defaultValue:'ROUTINE'},
        {key:'clinicalReasonCode',label:'임상 사유 코드'},
        {key:'clinicalIndicationRef',label:'임상 적응증 참조'},
        {key:'specialInstructionRef',label:'현장 지시 참조'},
      ],
      execute:(api,c,v)=>api.exams.createOrder(omitUndefined({
        careEncounterId:requireContext(c,'encounterId'),
        targetSiteId:requireContext(c,'siteId'),
        examDefinitionId:stringValue(v,'examDefinitionId'),
        examDefinitionRevision:numberValue(v,'examDefinitionRevision',1),
        orderedByWorkforceId:requireContext(c,'workforceId'),
        orderingCapabilityGrantId:stringValue(v,'orderingCapabilityGrantId'),
        priority:optionalString(v,'priority'),
        clinicalReasonCode:optionalString(v,'clinicalReasonCode'),
        clinicalIndicationRef:optionalString(v,'clinicalIndicationRef'),
        specialInstructionRef:optionalString(v,'specialInstructionRef'),
      })),
      capture:(r)=>({ examOrderId:String(r?.id ?? r?.examOrderId ?? '') || undefined }),
    },
    {
      id:'exam-submit',label:'검사오더 제출',kind:'command',
      requiredContext:['examOrderId'],
      fields:[
        {key:'expectedVersion',label:'현재 오더 버전',kind:'number',defaultValue:'1',required:true},
        {key:'reasonCode',label:'제출 사유 코드',defaultValue:'SUBMIT',required:true},
        {key:'reasonRef',label:'사유 참조'},
      ],
      execute:(api,c,v)=>api.exams.submitOrder(requireContext(c,'examOrderId'),omitUndefined({
        expectedVersion:numberValue(v,'expectedVersion',1),
        reasonCode:stringValue(v,'reasonCode'),
        reasonRef:optionalString(v,'reasonRef'),
      })),
    },
  ],

  C14: [
    {
      id:'interpretation-create',label:'판독 케이스 생성',kind:'command',
      requiredContext:['encounterId','examOrderId','acquisitionId'],
      fields:[{key:'canonicalDatasetId',label:'Canonical Dataset ID'}],
      execute:(api,c,v)=>api.clinician.createInterpretation(omitUndefined({
        careEncounterId:requireContext(c,'encounterId'),
        examOrderId:requireContext(c,'examOrderId'),
        acceptedAcquisitionId:requireContext(c,'acquisitionId'),
        canonicalDatasetId:optionalString(v,'canonicalDatasetId'),
      })),
      capture:(r)=>({ interpretationId:String(r?.id ?? r?.interpretationCaseId ?? '') || undefined }),
    },
  ],

  C15: [
    {
      id:'report-create',label:'진단 보고서 생성',kind:'command',
      requiredContext:['interpretationId'],
      fields:[
        {key:'title',label:'보고서 제목',required:true},
        {key:'impressionRef',label:'결론·Impression 참조'},
        {key:'narrativeRef',label:'서술 소견 참조'},
      ],
      execute:(api,c,v)=>api.clinician.createReport(omitUndefined({
        interpretationCaseId:requireContext(c,'interpretationId'),
        title:stringValue(v,'title'),
        impressionRef:optionalString(v,'impressionRef'),
        narrativeRef:optionalString(v,'narrativeRef'),
      })),
      capture:(r)=>({ reportId:String(r?.id ?? r?.reportId ?? '') || undefined }),
    },
    {
      id:'report-sign',label:'진단 보고서 서명',kind:'command',
      requiredContext:['reportId'],
      fields:[
        {key:'signingCapabilityGrantId',label:'서명 Capability Grant ID',required:true},
        {key:'reportFingerprintSha256',label:'보고서 SHA-256 Fingerprint',required:true},
        {key:'reasonCode',label:'서명 사유 코드'},
      ],
      execute:(api,c,v)=>api.clinician.signReport(requireContext(c,'reportId'),omitUndefined({
        signingCapabilityGrantId:stringValue(v,'signingCapabilityGrantId'),
        reportFingerprintSha256:stringValue(v,'reportFingerprintSha256'),
        reasonCode:optionalString(v,'reasonCode'),
      })),
    },
  ],

  C17: [
    {
      id:'prescription-create',label:'처방 생성',kind:'command',
      requiredContext:['encounterId'],
      fields:[
        {key:'prescriberCapabilityGrantId',label:'처방 Capability Grant ID',required:true},
        {key:'expiresAt',label:'처방 만료 시각',kind:'datetime-local'},
        {key:'clinicalNoteRef',label:'임상 메모 참조'},
      ],
      execute:(api,c,v)=>api.clinician.createPrescription(omitUndefined({
        careEncounterId:requireContext(c,'encounterId'),
        remoteVisitSessionId:c.visitId,
        prescriberCapabilityGrantId:stringValue(v,'prescriberCapabilityGrantId'),
        expiresAt:optionalString(v,'expiresAt'),
        clinicalNoteRef:optionalString(v,'clinicalNoteRef'),
      })),
      capture:(r)=>({ prescriptionId:String(r?.id ?? r?.prescriptionOrderId ?? '') || undefined }),
    },
  ],

  C20: [
    {
      id:'followup-create',label:'사후관리 계획 생성',kind:'command',
      requiredContext:['encounterId'],
      fields:[
        {key:'nextReviewAt',label:'다음 확인 시각',kind:'datetime-local'},
        {key:'symptomCheckinRequired',label:'증상 체크인 필요',kind:'select',options:['true','false'],defaultValue:'true',required:true},
        {key:'selfMonitoringRequired',label:'자가측정 필요',kind:'select',options:['true','false'],defaultValue:'false',required:true},
        {key:'medicationFollowupRequired',label:'복약 확인 필요',kind:'select',options:['true','false'],defaultValue:'false',required:true},
        {key:'escalationInstructionRef',label:'대면·응급 전환 기준 참조'},
        {key:'planRef',label:'계획 문서 참조'},
        {key:'items',label:'세부 항목(JSON 배열)',kind:'json',defaultValue:'[]'},
      ],
      execute:(api,c,v)=>api.encounter.followUpPlan(requireContext(c,'encounterId'),omitUndefined({
        nextReviewAt:optionalString(v,'nextReviewAt'),
        symptomCheckinRequired:boolValue(v,'symptomCheckinRequired',true),
        selfMonitoringRequired:boolValue(v,'selfMonitoringRequired',false),
        medicationFollowupRequired:boolValue(v,'medicationFollowupRequired',false),
        escalationInstructionRef:optionalString(v,'escalationInstructionRef'),
        planRef:optionalString(v,'planRef'),
        items:jsonValue(v,'items',[]),
      })),
      capture:(r)=>({ followUpPlanId:String(r?.id ?? r?.followUpPlanId ?? '') || undefined }),
    },
  ],
};

const CONTEXT_LABELS: Record<ContextKey,string> = {
  patientUserId:'환자 사용자 ID',
  siteId:'현장 기관 ID',
  workforceId:'의료인력 ID',
  encounterId:'진료 Encounter ID',
  visitId:'원격진료 Visit ID',
  examOrderId:'검사오더 ID',
  acquisitionId:'Acquisition ID',
  reportId:'진단 보고서 ID',
  prescriptionId:'처방 ID',
  followUpPlanId:'사후관리 계획 ID',
  interpretationId:'판독 Case ID',
  intakeSubmissionId:'문진 Submission ID',
};

function initialValues(fields: FieldSpec[] = []): Record<string,string> {
  return Object.fromEntries(fields.map((field)=>[field.key,field.defaultValue ?? '']));
}

function requiredMissing(action:ActionSpec, context:ClinicalRouteContext, values:Record<string,string>):string[] {
  const missing:string[]=[];
  for (const key of action.requiredContext ?? []) {
    if (!context[key]) missing.push(CONTEXT_LABELS[key]);
  }
  for (const field of action.fields ?? []) {
    if (field.required && !stringValue(values,field.key)) missing.push(field.label);
  }
  return missing;
}

function FieldEditor({
  field,value,onChange,
}:{
  field:FieldSpec;
  value:string;
  onChange:(next:string)=>void;
}) {
  if (field.kind === 'select') {
    return (
      <label className="cf-field">
        <span>{field.label}{field.required?' *':''}</span>
        <select className="cf-select" value={value} onChange={(e)=>onChange(e.target.value)}>
          {(field.options ?? []).map((option)=><option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    );
  }
  if (field.kind === 'json') {
    return (
      <label className="cf-field">
        <span>{field.label}{field.required?' *':''}</span>
        <textarea
          className="cf-textarea"
          value={value}
          placeholder={field.placeholder ?? '{}'}
          onChange={(e)=>onChange(e.target.value)}
        />
      </label>
    );
  }
  return (
    <ClinicalField
      label={`${field.label}${field.required?' *':''}`}
      value={value}
      type={field.kind === 'number' ? 'number' : field.kind === 'datetime-local' ? 'datetime-local' : 'text'}
      placeholder={field.placeholder}
      onChange={onChange}
    />
  );
}

function ResultView({ value }: { value: unknown }) {
  if (value === undefined) return <ClinicalEmpty message="API 호출 전입니다."/>;
  if (value === null) return <ClinicalEmpty message="조회 결과가 없습니다."/>;
  if (Array.isArray(value)) {
    if (!value.length) return <ClinicalEmpty message="조회된 항목이 없습니다."/>;
    const rows=value.slice(0,50);
    const first=rows.find((row)=>row && typeof row === 'object' && !Array.isArray(row)) as Record<string,unknown>|undefined;
    if (!first) return <pre className="cf-pre">{JSON.stringify(rows,null,2)}</pre>;
    const columns=Object.keys(first).slice(0,8);
    return (
      <div className="cf-api-table-wrap">
        <table className="cf-table">
          <thead><tr>{columns.map((column)=><th key={column}>{column}</th>)}</tr></thead>
          <tbody>
            {rows.map((row,index)=>{
              const record=(row && typeof row === 'object' && !Array.isArray(row)) ? row as Record<string,unknown> : {};
              return <tr key={index}>{columns.map((column)=><td key={column}>{formatCell(record[column])}</td>)}</tr>;
            })}
          </tbody>
        </table>
      </div>
    );
  }
  if (typeof value === 'object') {
    const entries=Object.entries(value as Record<string,unknown>);
    if (!entries.length) return <ClinicalEmpty message="빈 객체가 반환되었습니다."/>;
    return (
      <dl className="cf-api-definition">
        {entries.slice(0,30).map(([key,val])=><React.Fragment key={key}><dt>{key}</dt><dd>{formatCell(val)}</dd></React.Fragment>)}
      </dl>
    );
  }
  return <div className="cf-api-scalar">{String(value)}</div>;
}

function formatCell(value:unknown):React.ReactNode {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') return <code>{JSON.stringify(value)}</code>;
  return String(value);
}

function ActionCard({
  action,context,onContextUpdate,
}:{
  action:ActionSpec;
  context:ClinicalRouteContext;
  onContextUpdate:(patch:Partial<ClinicalRouteContext>)=>void;
}) {
  const api=useClinicalApi();
  const [values,setValues]=useState<Record<string,string>>(()=>initialValues(action.fields));
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [result,setResult]=useState<unknown>(undefined);
  const missing=requiredMissing(action,context,values);

  async function run() {
    setBusy(true);
    setError('');
    try {
      const response=await action.execute(api,context,values);
      setResult(response);
      const patch=action.capture?.(response as any);
      if (patch) onContextUpdate(patch);
    } catch (e:any) {
      const message=
        e?.response?.data?.message ??
        e?.response?.data?.error ??
        e?.message ??
        'API 요청에 실패했습니다.';
      setError(Array.isArray(message)?message.join(', '):String(message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ClinicalCard title={action.label}>
      {(action.fields ?? []).map((field)=>(
        <FieldEditor
          key={field.key}
          field={field}
          value={values[field.key] ?? field.defaultValue ?? ''}
          onChange={(next)=>setValues((prev)=>({...prev,[field.key]:next}))}
        />
      ))}
      {missing.length>0 && <ClinicalNotice tone="warning">필수 입력: {missing.join(', ')}</ClinicalNotice>}
      {error && <ClinicalNotice tone="danger">{error}</ClinicalNotice>}
      <ClinicalButton onClick={run} disabled={busy || missing.length>0}>
        {busy?'처리 중…':action.kind==='read'?'불러오기':'실행'}
      </ClinicalButton>
      <div className="cf-api-result">
        <ResultView value={result}/>
      </div>
    </ClinicalCard>
  );
}

export function ApiBoundClinicalScreen({ screen }: { screen: ClinicalScreenSpec }) {
  const { context,update }=useClinicalRouteContext();
  const actions=BINDINGS[screen.code] ?? [];
  const contextKeys=useMemo(()=>{
    const keys=new Set<ContextKey>();
    actions.forEach((action)=>(action.requiredContext ?? []).forEach((key)=>keys.add(key)));
    return Array.from(keys);
  },[actions]);

  if (!actions.length) {
    return <ClinicalNotice tone="warning">{screen.code} API 바인딩이 정의되지 않았습니다.</ClinicalNotice>;
  }

  return (
    <>
      <ClinicalNotice>
        이 화면은 실제 Clinical Backend API를 호출합니다. 임상 상태는 화면에서 임의로 확정하지 않고 서버 응답을 그대로 표시합니다.
      </ClinicalNotice>

      {contextKeys.length>0 && (
        <ClinicalCard title="작업 컨텍스트">
          <div className="cf-grid-2 cf-context-grid">
            {contextKeys.map((key)=>(
              <ClinicalField
                key={key}
                label={CONTEXT_LABELS[key]}
                value={String(context[key] ?? '')}
                onChange={(value)=>update({[key]:value || undefined} as Partial<ClinicalRouteContext>)}
                placeholder={`${String(key)} 입력`}
              />
            ))}
          </div>
          <div className="cf-context-badges">
            {contextKeys.map((key)=>(
              <ClinicalBadge key={key} tone={context[key]?'success':'neutral'}>
                {CONTEXT_LABELS[key]} {context[key]?'설정됨':'미설정'}
              </ClinicalBadge>
            ))}
          </div>
        </ClinicalCard>
      )}

      <div className={actions.length===1?'':'cf-grid-2'}>
        {actions.map((action)=>(
          <ActionCard
            key={action.id}
            action={action}
            context={context}
            onContextUpdate={update}
          />
        ))}
      </div>
    </>
  );
}
