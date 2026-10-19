export type ClinicalRoleKey = 'COMMON'|'PATIENT'|'ONSITE'|'CLINICIAN'|'OPERATIONS';

export interface ClinicalScreenSpec {
  code: string;
  role: string;
  roleKey: ClinicalRoleKey;
  title: string;
  subtitle: string;
  layout: string;
  sections: string[];
  basis: string;
  extension: string;
  path: string;
  requiredRoles: string[];
}

export const CLINICAL_SCREENS: ClinicalScreenSpec[] = [
  {
    "code": "G01",
    "role": "공통",
    "title": "로그인",
    "subtitle": "환자와 의료인·기관 계정을 구분해 안전하게 로그인합니다.",
    "layout": "login",
    "sections": [
      "환자·보호자 이용",
      "의료인·기관 이용",
      "본인확인 또는 기관 계정",
      "접근성 설정"
    ],
    "basis": "보고서: 주체별 역할·본인확인",
    "extension": "",
    "roleKey": "COMMON",
    "path": "/clinical/common/g01",
    "requiredRoles": []
  },
  {
    "code": "G02",
    "role": "공통",
    "title": "업무 선택",
    "subtitle": "여러 권한이 있을 때 허용된 업무만 선택합니다.",
    "layout": "choices",
    "sections": [
      "현장 의료인력",
      "원격 의료인",
      "운영 관리자",
      "허용된 역할만 표시"
    ],
    "basis": "보고서: 주체별 역할",
    "extension": "",
    "roleKey": "COMMON",
    "path": "/clinical/common/g02",
    "requiredRoles": []
  },
  {
    "code": "G03",
    "role": "공통",
    "title": "접근성 설정",
    "subtitle": "큰 글씨·고대비·음성 안내·언어를 설정합니다.",
    "layout": "settings",
    "sections": [
      "글자 크기",
      "고대비",
      "음성 안내",
      "언어",
      "화면 읽기 지원"
    ],
    "basis": "보고서 표 35: 접근성",
    "extension": "",
    "roleKey": "COMMON",
    "path": "/clinical/common/g03",
    "requiredRoles": []
  },
  {
    "code": "G04",
    "role": "공통",
    "title": "연결 상태 안내",
    "subtitle": "통신 장애 시 현재 상태와 재연결 방법을 안내합니다.",
    "layout": "status",
    "sections": [
      "네트워크 상태",
      "재연결",
      "입력 보존",
      "전화 지원"
    ],
    "basis": "보고서: 기술 및 품질",
    "extension": "",
    "roleKey": "COMMON",
    "path": "/clinical/common/g04",
    "requiredRoles": []
  },
  {
    "code": "P01",
    "role": "환자",
    "title": "비대면진료 이용 시작",
    "subtitle": "진료 요청은 환자 본인의 선택으로 시작합니다.",
    "layout": "home",
    "sections": [
      "비대면진료 예약",
      "예약 내역",
      "전화 예약 지원",
      "접근성"
    ],
    "basis": "보고서: 예약·환자 자율성",
    "extension": "",
    "roleKey": "PATIENT",
    "path": "/clinical/patient/p01",
    "requiredRoles": [
      "PATIENT",
      "PATIENT_SUPPORTER"
    ]
  },
  {
    "code": "P02",
    "role": "환자",
    "title": "진료 요청 방법",
    "subtitle": "온라인·전화·보호자 지원 등 가능한 이용 방법을 확인합니다.",
    "layout": "choices",
    "sections": [
      "온라인 직접 예약",
      "전화 예약 지원",
      "보호자·대리인 도움"
    ],
    "basis": "보고서: 비대면진료 요청/예약",
    "extension": "",
    "roleKey": "PATIENT",
    "path": "/clinical/patient/p02",
    "requiredRoles": [
      "PATIENT",
      "PATIENT_SUPPORTER"
    ]
  },
  {
    "code": "P03",
    "role": "환자",
    "title": "의료기관·시간 선택",
    "subtitle": "추천 순위 없이 이용 가능한 기관과 시간을 확인합니다.",
    "layout": "booking",
    "sections": [
      "의료기관 목록",
      "진료과",
      "예약 가능 시간",
      "대면 연계 가능 여부"
    ],
    "basis": "보고서: 중립적 예약 정보",
    "extension": "",
    "roleKey": "PATIENT",
    "path": "/clinical/patient/p03",
    "requiredRoles": [
      "PATIENT",
      "PATIENT_SUPPORTER"
    ]
  },
  {
    "code": "P04",
    "role": "환자",
    "title": "예약 전 안내",
    "subtitle": "한계·대면전환 가능성·예상 절차를 먼저 확인합니다.",
    "layout": "guide",
    "sections": [
      "비대면진료의 한계",
      "대면전환 가능성",
      "통신 장애",
      "본인확인·동의 필요"
    ],
    "basis": "보고서: 예약 전 안내",
    "extension": "",
    "roleKey": "PATIENT",
    "path": "/clinical/patient/p04",
    "requiredRoles": [
      "PATIENT",
      "PATIENT_SUPPORTER"
    ]
  },
  {
    "code": "P05",
    "role": "환자",
    "title": "보호자·대리인 확인",
    "subtitle": "대리 참여가 필요한 경우 관계와 참여 범위를 확인합니다.",
    "layout": "relation",
    "sections": [
      "본인이 직접 이용",
      "보호자·대리인 참여",
      "관계 확인",
      "참여 범위"
    ],
    "basis": "보고서 표 35: 보호자 지원",
    "extension": "",
    "roleKey": "PATIENT",
    "path": "/clinical/patient/p05",
    "requiredRoles": [
      "PATIENT",
      "PATIENT_SUPPORTER"
    ]
  },
  {
    "code": "P06",
    "role": "환자",
    "title": "본인확인",
    "subtitle": "진료 당사자의 본인확인을 완료합니다.",
    "layout": "form",
    "sections": [
      "이름",
      "생년월일",
      "휴대폰 번호",
      "본인확인 상태"
    ],
    "basis": "보고서: 본인확인",
    "extension": "",
    "roleKey": "PATIENT",
    "path": "/clinical/patient/p06",
    "requiredRoles": [
      "PATIENT",
      "PATIENT_SUPPORTER"
    ]
  },
  {
    "code": "P07",
    "role": "환자",
    "title": "비대면진료 설명 및 동의",
    "subtitle": "한계·위험성·대면전환 가능성을 확인하고 동의합니다.",
    "layout": "consent",
    "sections": [
      "진찰 제한",
      "대면진료 필요 가능",
      "통신 장애",
      "의료진의 전환 판단",
      "동의 확인"
    ],
    "basis": "보고서: 설명 및 동의",
    "extension": "",
    "roleKey": "PATIENT",
    "path": "/clinical/patient/p07",
    "requiredRoles": [
      "PATIENT",
      "PATIENT_SUPPORTER"
    ]
  },
  {
    "code": "P08",
    "role": "환자",
    "title": "건강정보 연동",
    "subtitle": "진료에 필요한 최근 진료·처방·검사정보 범위를 선택합니다.",
    "layout": "choices",
    "sections": [
      "최근 진료정보",
      "최근 처방이력",
      "최근 검사결과",
      "연동 범위 확인"
    ],
    "basis": "보고서 표 35: 자동연동",
    "extension": "",
    "roleKey": "PATIENT",
    "path": "/clinical/patient/p08",
    "requiredRoles": [
      "PATIENT",
      "PATIENT_SUPPORTER"
    ]
  },
  {
    "code": "P09",
    "role": "환자",
    "title": "사전 문진",
    "subtitle": "현재 증상·병력·복용약·알레르기 등 공통 문진을 작성합니다.",
    "layout": "form",
    "sections": [
      "주요 증상",
      "발병 시점",
      "알레르기",
      "복용약",
      "동반질환"
    ],
    "basis": "보고서 표 33: 공통 문진",
    "extension": "",
    "roleKey": "PATIENT",
    "path": "/clinical/patient/p09",
    "requiredRoles": [
      "PATIENT",
      "PATIENT_SUPPORTER"
    ]
  },
  {
    "code": "P10",
    "role": "환자",
    "title": "추가 문진",
    "subtitle": "환자 특성이나 증상에 필요한 질문만 추가로 표시합니다.",
    "layout": "form",
    "sections": [
      "고령자 추가질문",
      "급성증상 추가질문",
      "환자군별 추가질문",
      "필요 정보만 표시"
    ],
    "basis": "보고서 표 34: 선택 문진",
    "extension": "",
    "roleKey": "PATIENT",
    "path": "/clinical/patient/p10",
    "requiredRoles": [
      "PATIENT",
      "PATIENT_SUPPORTER"
    ]
  },
  {
    "code": "P11",
    "role": "환자",
    "title": "입력 확인",
    "subtitle": "필수 항목 누락과 입력 오류를 확인합니다.",
    "layout": "validation",
    "sections": [
      "필수항목 누락",
      "형식 오류",
      "완료 항목",
      "수정 후 제출"
    ],
    "basis": "보고서 표 35: 자동검증",
    "extension": "",
    "roleKey": "PATIENT",
    "path": "/clinical/patient/p11",
    "requiredRoles": [
      "PATIENT",
      "PATIENT_SUPPORTER"
    ]
  },
  {
    "code": "P12",
    "role": "환자",
    "title": "진료 전 확인 결과",
    "subtitle": "응급·중증 위험 신호가 있으면 대면·응급 안내를 우선합니다.",
    "layout": "status",
    "sections": [
      "위험 신호 결과",
      "의료진 최종 판단",
      "대면진료 권고",
      "응급 안내"
    ],
    "basis": "보고서 표 35: 위험신호",
    "extension": "",
    "roleKey": "PATIENT",
    "path": "/clinical/patient/p12",
    "requiredRoles": [
      "PATIENT",
      "PATIENT_SUPPORTER"
    ]
  },
  {
    "code": "P13",
    "role": "환자",
    "title": "진료 환경 점검",
    "subtitle": "카메라·마이크·스피커·네트워크 상태를 확인합니다.",
    "layout": "precheck",
    "sections": [
      "카메라",
      "마이크",
      "스피커",
      "네트워크 지연"
    ],
    "basis": "보고서: 기술 및 품질",
    "extension": "",
    "roleKey": "PATIENT",
    "path": "/clinical/patient/p13",
    "requiredRoles": [
      "PATIENT",
      "PATIENT_SUPPORTER"
    ]
  },
  {
    "code": "P14",
    "role": "환자",
    "title": "진료 대기",
    "subtitle": "예정 시간과 접속 상태를 확인하며 의료진 연결을 기다립니다.",
    "layout": "waiting",
    "sections": [
      "예약 시간",
      "진료기관",
      "카메라 상태",
      "마이크 상태",
      "연결 상태"
    ],
    "basis": "보고서: 진료 방식·시간",
    "extension": "",
    "roleKey": "PATIENT",
    "path": "/clinical/patient/p14",
    "requiredRoles": [
      "PATIENT",
      "PATIENT_SUPPORTER"
    ]
  },
  {
    "code": "P15",
    "role": "환자",
    "title": "비대면진료",
    "subtitle": "의료진과 화상으로 진료합니다.",
    "layout": "patient_video",
    "sections": [
      "의료진 영상",
      "마이크",
      "카메라",
      "연결 상태",
      "종료"
    ],
    "basis": "보고서: 비대면진료",
    "extension": "",
    "roleKey": "PATIENT",
    "path": "/clinical/patient/p15",
    "requiredRoles": [
      "PATIENT",
      "PATIENT_SUPPORTER"
    ]
  },
  {
    "code": "P16",
    "role": "환자",
    "title": "검사 진행 안내",
    "subtitle": "의료진이 요청한 현장 검사의 진행 상태만 안내합니다.",
    "layout": "exam_status",
    "sections": [
      "검사 요청됨",
      "현장 준비",
      "검사 중",
      "데이터 전달 완료"
    ],
    "basis": "보고서: 진료 프로세스",
    "extension": "우리 확장: 현장 검사",
    "roleKey": "PATIENT",
    "path": "/clinical/patient/p16",
    "requiredRoles": [
      "PATIENT",
      "PATIENT_SUPPORTER"
    ]
  },
  {
    "code": "P17",
    "role": "환자",
    "title": "진료 결과 안내",
    "subtitle": "의료진이 설명한 결과와 다음 조치를 확인합니다.",
    "layout": "summary",
    "sections": [
      "현재 상태",
      "다음 조치",
      "처방 여부",
      "추가 진료 안내"
    ],
    "basis": "보고서: 진료 후 연속성",
    "extension": "",
    "roleKey": "PATIENT",
    "path": "/clinical/patient/p17",
    "requiredRoles": [
      "PATIENT",
      "PATIENT_SUPPORTER"
    ]
  },
  {
    "code": "P18",
    "role": "환자",
    "title": "처방 확인",
    "subtitle": "처방 여부와 안전성 확인 결과를 확인합니다.",
    "layout": "prescription",
    "sections": [
      "처방 상태",
      "약제 수",
      "안전성 확인",
      "처방전 보기"
    ],
    "basis": "보고서: 처방",
    "extension": "",
    "roleKey": "PATIENT",
    "path": "/clinical/patient/p18",
    "requiredRoles": [
      "PATIENT",
      "PATIENT_SUPPORTER"
    ]
  },
  {
    "code": "P19",
    "role": "환자",
    "title": "처방전·약국",
    "subtitle": "처방전 전달과 약국 선택·수령 방법을 확인합니다.",
    "layout": "pharmacy",
    "sections": [
      "전자처방전",
      "약국 목록",
      "객관적 정보",
      "전달 상태"
    ],
    "basis": "보고서: 약국·처방전",
    "extension": "",
    "roleKey": "PATIENT",
    "path": "/clinical/patient/p19",
    "requiredRoles": [
      "PATIENT",
      "PATIENT_SUPPORTER"
    ]
  },
  {
    "code": "P20",
    "role": "환자",
    "title": "진료 요약",
    "subtitle": "이번 진료 요약과 주의사항을 확인합니다.",
    "layout": "summary",
    "sections": [
      "진료일",
      "진료과",
      "진료 결과",
      "처방",
      "주의사항"
    ],
    "basis": "보고서: 후속관리",
    "extension": "",
    "roleKey": "PATIENT",
    "path": "/clinical/patient/p20",
    "requiredRoles": [
      "PATIENT",
      "PATIENT_SUPPORTER"
    ]
  },
  {
    "code": "P21",
    "role": "환자",
    "title": "사후관리 계획",
    "subtitle": "다음 확인 시점·복약·자가측정·대면전환 기준을 확인합니다.",
    "layout": "followup",
    "sections": [
      "다음 경과확인",
      "자가측정",
      "복약",
      "대면전환 기준"
    ],
    "basis": "보고서 표 36: T0",
    "extension": "",
    "roleKey": "PATIENT",
    "path": "/clinical/patient/p21",
    "requiredRoles": [
      "PATIENT",
      "PATIENT_SUPPORTER"
    ]
  },
  {
    "code": "P22",
    "role": "환자",
    "title": "경과 확인",
    "subtitle": "증상 변화와 복약 상태를 기록합니다.",
    "layout": "form",
    "sections": [
      "증상 변화",
      "복약 상태",
      "새로운 증상",
      "의료진 검토"
    ],
    "basis": "보고서 표 36: T1",
    "extension": "",
    "roleKey": "PATIENT",
    "path": "/clinical/patient/p22",
    "requiredRoles": [
      "PATIENT",
      "PATIENT_SUPPORTER"
    ]
  },
  {
    "code": "P23",
    "role": "환자",
    "title": "자가측정 기록",
    "subtitle": "혈압·혈당 등 지정된 자가측정 값을 기록합니다.",
    "layout": "measure",
    "sections": [
      "혈압",
      "맥박",
      "측정 시간",
      "최근 기록"
    ],
    "basis": "보고서 표 36: T2",
    "extension": "",
    "roleKey": "PATIENT",
    "path": "/clinical/patient/p23",
    "requiredRoles": [
      "PATIENT",
      "PATIENT_SUPPORTER"
    ]
  },
  {
    "code": "P24",
    "role": "환자",
    "title": "이상반응·증상 악화",
    "subtitle": "이상반응이나 증상 악화를 신고하고 안내를 받습니다.",
    "layout": "alertform",
    "sections": [
      "증상",
      "정도",
      "발생 시점",
      "응급 안내"
    ],
    "basis": "보고서 표 36: T3",
    "extension": "",
    "roleKey": "PATIENT",
    "path": "/clinical/patient/p24",
    "requiredRoles": [
      "PATIENT",
      "PATIENT_SUPPORTER"
    ]
  },
  {
    "code": "P25",
    "role": "환자",
    "title": "대면·응급 전환",
    "subtitle": "필요 시 대면진료 또는 응급의료기관 안내를 확인합니다.",
    "layout": "escalation",
    "sections": [
      "대면진료 필요",
      "이용 시점",
      "응급 증상",
      "119 안내"
    ],
    "basis": "보고서 표 36: T4",
    "extension": "",
    "roleKey": "PATIENT",
    "path": "/clinical/patient/p25",
    "requiredRoles": [
      "PATIENT",
      "PATIENT_SUPPORTER"
    ]
  },
  {
    "code": "P26",
    "role": "환자",
    "title": "진료 기록·재진",
    "subtitle": "과거 진료·보고서·처방·사후관리와 재진을 확인합니다.",
    "layout": "history",
    "sections": [
      "과거 진료",
      "보고서",
      "처방",
      "사후관리",
      "재진 예약"
    ],
    "basis": "보고서 표 36: T5",
    "extension": "",
    "roleKey": "PATIENT",
    "path": "/clinical/patient/p26",
    "requiredRoles": [
      "PATIENT",
      "PATIENT_SUPPORTER"
    ]
  },
  {
    "code": "S01",
    "role": "현장 의료인력",
    "title": "현장 진료 대시보드",
    "subtitle": "오늘 환자·진료·검사·장비 상태를 확인합니다.",
    "layout": "dashboard",
    "sections": [
      "오늘 예약",
      "대기",
      "진료 중",
      "검사 대기",
      "현장 상태"
    ],
    "basis": "보고서: 기술·품질/의료인 보조",
    "extension": "우리 확장: ExamOrder·Acquisition·Device·Edge",
    "roleKey": "ONSITE",
    "path": "/clinical/site/s01",
    "requiredRoles": [
      "ONSITE_CLINICAL_STAFF",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "S02",
    "role": "현장 의료인력",
    "title": "환자 대기 목록",
    "subtitle": "도착·대기·진료 중 환자를 시간 순서로 확인합니다.",
    "layout": "table",
    "sections": [
      "시간",
      "환자",
      "예약",
      "현재 상태",
      "작업"
    ],
    "basis": "보고서: 기술·품질/의료인 보조",
    "extension": "우리 확장: ExamOrder·Acquisition·Device·Edge",
    "roleKey": "ONSITE",
    "path": "/clinical/site/s02",
    "requiredRoles": [
      "ONSITE_CLINICAL_STAFF",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "S03",
    "role": "현장 의료인력",
    "title": "환자 접수",
    "subtitle": "예약과 환자 정보를 확인하고 오늘 진료 건을 연결합니다.",
    "layout": "summary",
    "sections": [
      "예약 정보",
      "본인확인",
      "Encounter 연결",
      "접수"
    ],
    "basis": "보고서: 기술·품질/의료인 보조",
    "extension": "우리 확장: ExamOrder·Acquisition·Device·Edge",
    "roleKey": "ONSITE",
    "path": "/clinical/site/s03",
    "requiredRoles": [
      "ONSITE_CLINICAL_STAFF",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "S04",
    "role": "현장 의료인력",
    "title": "본인확인 지원",
    "subtitle": "환자의 본인확인 진행 상태를 확인하고 필요한 지원을 제공합니다.",
    "layout": "status",
    "sections": [
      "환자",
      "인증 수단",
      "확인 상태",
      "지원 원칙"
    ],
    "basis": "보고서: 기술·품질/의료인 보조",
    "extension": "우리 확장: ExamOrder·Acquisition·Device·Edge",
    "roleKey": "ONSITE",
    "path": "/clinical/site/s04",
    "requiredRoles": [
      "ONSITE_CLINICAL_STAFF",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "S05",
    "role": "현장 의료인력",
    "title": "보호자·대리인 확인",
    "subtitle": "동행자·보호자의 신원과 관계·참여 범위를 확인합니다.",
    "layout": "relation",
    "sections": [
      "동행자",
      "환자와의 관계",
      "검증 상태",
      "허용 범위"
    ],
    "basis": "보고서: 기술·품질/의료인 보조",
    "extension": "우리 확장: ExamOrder·Acquisition·Device·Edge",
    "roleKey": "ONSITE",
    "path": "/clinical/site/s05",
    "requiredRoles": [
      "ONSITE_CLINICAL_STAFF",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "S06",
    "role": "현장 의료인력",
    "title": "동의·문진 지원",
    "subtitle": "환자가 직접 입력하기 어려운 경우 허용 범위 내에서 지원합니다.",
    "layout": "progress",
    "sections": [
      "문진 진행률",
      "필수항목",
      "대리 입력 주체",
      "지원 원칙"
    ],
    "basis": "보고서: 기술·품질/의료인 보조",
    "extension": "우리 확장: ExamOrder·Acquisition·Device·Edge",
    "roleKey": "ONSITE",
    "path": "/clinical/site/s06",
    "requiredRoles": [
      "ONSITE_CLINICAL_STAFF",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "S07",
    "role": "현장 의료인력",
    "title": "기초 측정",
    "subtitle": "혈압·체온·SpO₂ 등 진료 전 측정값을 기록합니다.",
    "layout": "measure",
    "sections": [
      "혈압",
      "SpO₂",
      "체온",
      "측정 출처"
    ],
    "basis": "보고서: 기술·품질/의료인 보조",
    "extension": "우리 확장: ExamOrder·Acquisition·Device·Edge",
    "roleKey": "ONSITE",
    "path": "/clinical/site/s07",
    "requiredRoles": [
      "ONSITE_CLINICAL_STAFF",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "S08",
    "role": "현장 의료인력",
    "title": "위험 신호 확인",
    "subtitle": "문진의 위험 신호와 의료진 검토 필요 여부를 확인합니다.",
    "layout": "status",
    "sections": [
      "자동경보",
      "의료진 검토",
      "주요 증상",
      "복용약"
    ],
    "basis": "보고서: 기술·품질/의료인 보조",
    "extension": "우리 확장: ExamOrder·Acquisition·Device·Edge",
    "roleKey": "ONSITE",
    "path": "/clinical/site/s08",
    "requiredRoles": [
      "ONSITE_CLINICAL_STAFF",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "S09",
    "role": "현장 의료인력",
    "title": "진료 사전 점검",
    "subtitle": "카메라·마이크·네트워크와 진료실 준비 상태를 확인합니다.",
    "layout": "precheck",
    "sections": [
      "카메라",
      "마이크",
      "스피커",
      "네트워크",
      "비상 연락"
    ],
    "basis": "보고서: 기술·품질/의료인 보조",
    "extension": "우리 확장: ExamOrder·Acquisition·Device·Edge",
    "roleKey": "ONSITE",
    "path": "/clinical/site/s09",
    "requiredRoles": [
      "ONSITE_CLINICAL_STAFF",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "S10",
    "role": "현장 의료인력",
    "title": "현장 진료 화면",
    "subtitle": "환자와 원격 의료진을 연결하고 임상 정보를 함께 확인합니다.",
    "layout": "clinical_workspace",
    "sections": [
      "환자 요약",
      "원격 의료인 영상",
      "Vital",
      "검사오더",
      "현장 액션"
    ],
    "basis": "보고서: 기술·품질/의료인 보조",
    "extension": "우리 확장: ExamOrder·Acquisition·Device·Edge",
    "roleKey": "ONSITE",
    "path": "/clinical/site/s10",
    "requiredRoles": [
      "ONSITE_CLINICAL_STAFF",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "S11",
    "role": "현장 의료인력",
    "title": "검사오더",
    "subtitle": "원격 의료진이 요청한 구조화된 검사 항목을 확인합니다.",
    "layout": "table",
    "sections": [
      "우선순위",
      "검사",
      "임상 질문",
      "상태",
      "작업"
    ],
    "basis": "보고서: 기술·품질/의료인 보조",
    "extension": "우리 확장: ExamOrder·Acquisition·Device·Edge",
    "roleKey": "ONSITE",
    "path": "/clinical/site/s11",
    "requiredRoles": [
      "ONSITE_CLINICAL_STAFF",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "S12",
    "role": "현장 의료인력",
    "title": "검사 준비도 확인",
    "subtitle": "검사에 필요한 인력·장비·공간이 준비됐는지 확인합니다.",
    "layout": "readiness",
    "sections": [
      "인력",
      "장비",
      "공간",
      "현재 준비도"
    ],
    "basis": "보고서: 기술·품질/의료인 보조",
    "extension": "우리 확장: ExamOrder·Acquisition·Device·Edge",
    "roleKey": "ONSITE",
    "path": "/clinical/site/s12",
    "requiredRoles": [
      "ONSITE_CLINICAL_STAFF",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "S13",
    "role": "현장 의료인력",
    "title": "검사 담당자 배정",
    "subtitle": "자격과 현재 근무 상태를 확인해 검사 담당자를 배정합니다.",
    "layout": "table",
    "sections": [
      "직원",
      "업무 자격",
      "현재 상태",
      "유효기간",
      "선택"
    ],
    "basis": "보고서: 기술·품질/의료인 보조",
    "extension": "우리 확장: ExamOrder·Acquisition·Device·Edge",
    "roleKey": "ONSITE",
    "path": "/clinical/site/s13",
    "requiredRoles": [
      "ONSITE_CLINICAL_STAFF",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "S14",
    "role": "현장 의료인력",
    "title": "사용 장비 선택",
    "subtitle": "검사 요구조건을 충족하는 현재 사용 가능한 장비만 선택합니다.",
    "layout": "table",
    "sections": [
      "장비",
      "모델",
      "상태",
      "교정",
      "연동",
      "선택"
    ],
    "basis": "보고서: 기술·품질/의료인 보조",
    "extension": "우리 확장: ExamOrder·Acquisition·Device·Edge",
    "roleKey": "ONSITE",
    "path": "/clinical/site/s14",
    "requiredRoles": [
      "ONSITE_CLINICAL_STAFF",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "S15",
    "role": "현장 의료인력",
    "title": "검사 수행",
    "subtitle": "준비 완료 후 검사를 시작하고 수집 상태를 확인합니다.",
    "layout": "waveform",
    "sections": [
      "Acquisition",
      "담당자",
      "장비",
      "채널",
      "수집 상태"
    ],
    "basis": "보고서: 기술·품질/의료인 보조",
    "extension": "우리 확장: ExamOrder·Acquisition·Device·Edge",
    "roleKey": "ONSITE",
    "path": "/clinical/site/s15",
    "requiredRoles": [
      "ONSITE_CLINICAL_STAFF",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "S16",
    "role": "현장 의료인력",
    "title": "전송·오프라인 큐",
    "subtitle": "네트워크가 불안정해도 로컬 저장과 재전송 상태를 확인합니다.",
    "layout": "transfer",
    "sections": [
      "전송률",
      "Store & Forward",
      "오프라인 큐",
      "재시도"
    ],
    "basis": "보고서: 기술·품질/의료인 보조",
    "extension": "우리 확장: ExamOrder·Acquisition·Device·Edge",
    "roleKey": "ONSITE",
    "path": "/clinical/site/s16",
    "requiredRoles": [
      "ONSITE_CLINICAL_STAFF",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "S17",
    "role": "현장 의료인력",
    "title": "데이터 수신·무결성",
    "subtitle": "전송 데이터의 수신량과 무결성 검증 상태를 확인합니다.",
    "layout": "integrity",
    "sections": [
      "수신량",
      "Chunk",
      "SHA-256",
      "Device captured",
      "Central received"
    ],
    "basis": "보고서: 기술·품질/의료인 보조",
    "extension": "우리 확장: ExamOrder·Acquisition·Device·Edge",
    "roleKey": "ONSITE",
    "path": "/clinical/site/s17",
    "requiredRoles": [
      "ONSITE_CLINICAL_STAFF",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "S18",
    "role": "현장 의료인력",
    "title": "기술 품질 확인",
    "subtitle": "진단과 별개로 데이터가 판독 가능한 기술 품질인지 확인합니다.",
    "layout": "quality",
    "sections": [
      "ACCEPTABLE",
      "LIMITATIONS",
      "REPEAT REQUIRED",
      "UNUSABLE"
    ],
    "basis": "보고서: 기술·품질/의료인 보조",
    "extension": "우리 확장: ExamOrder·Acquisition·Device·Edge",
    "roleKey": "ONSITE",
    "path": "/clinical/site/s18",
    "requiredRoles": [
      "ONSITE_CLINICAL_STAFF",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "S19",
    "role": "현장 의료인력",
    "title": "재검 요청",
    "subtitle": "재검 사유와 이전 검사 보존 상태를 확인하고 새 검사를 준비합니다.",
    "layout": "repeat",
    "sections": [
      "이전 검사",
      "재검 사유",
      "원본 보존",
      "새 Acquisition"
    ],
    "basis": "보고서: 기술·품질/의료인 보조",
    "extension": "우리 확장: ExamOrder·Acquisition·Device·Edge",
    "roleKey": "ONSITE",
    "path": "/clinical/site/s19",
    "requiredRoles": [
      "ONSITE_CLINICAL_STAFF",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "S20",
    "role": "현장 의료인력",
    "title": "검체·POC 검사",
    "subtitle": "검체 채취부터 분석 결과까지 계보를 확인합니다.",
    "layout": "specimen",
    "sections": [
      "검체",
      "채취자",
      "Analyzer",
      "결과",
      "시간"
    ],
    "basis": "보고서: 기술·품질/의료인 보조",
    "extension": "우리 확장: ExamOrder·Acquisition·Device·Edge",
    "roleKey": "ONSITE",
    "path": "/clinical/site/s20",
    "requiredRoles": [
      "ONSITE_CLINICAL_STAFF",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "S21",
    "role": "현장 의료인력",
    "title": "장비·Edge 상태",
    "subtitle": "장비·Gateway·로컬 큐·연결 상태를 확인합니다.",
    "layout": "edge",
    "sections": [
      "Gateway",
      "연결 장비",
      "오프라인 큐",
      "Adapter Health"
    ],
    "basis": "보고서: 기술·품질/의료인 보조",
    "extension": "우리 확장: ExamOrder·Acquisition·Device·Edge",
    "roleKey": "ONSITE",
    "path": "/clinical/site/s21",
    "requiredRoles": [
      "ONSITE_CLINICAL_STAFF",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "S22",
    "role": "현장 의료인력",
    "title": "검사 종료·전달",
    "subtitle": "품질 승인된 검사와 판독 대기 상태를 원격 의료진에게 전달합니다.",
    "layout": "handoff",
    "sections": [
      "검사 완료",
      "QUALITY ACCEPTED",
      "판독 대기",
      "인계"
    ],
    "basis": "보고서: 기술·품질/의료인 보조",
    "extension": "우리 확장: ExamOrder·Acquisition·Device·Edge",
    "roleKey": "ONSITE",
    "path": "/clinical/site/s22",
    "requiredRoles": [
      "ONSITE_CLINICAL_STAFF",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "C01",
    "role": "원격 의료인",
    "title": "의료진 대시보드",
    "subtitle": "대기 진료·진행 중·판독·중요 결과를 확인합니다.",
    "layout": "dashboard",
    "sections": [
      "대기 진료",
      "진료 중",
      "판독 대기",
      "중요 결과"
    ],
    "basis": "보고서: 의료인 역할·진료·처방·사후관리",
    "extension": "우리 확장: 검사오더·Viewer·판독",
    "roleKey": "CLINICIAN",
    "path": "/clinical/clinician/c01",
    "requiredRoles": [
      "CLINICIAN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "C02",
    "role": "원격 의료인",
    "title": "진료 대기 목록",
    "subtitle": "환자와 사이트별 진료 대기 상태를 확인합니다.",
    "layout": "table",
    "sections": [
      "시간",
      "환자",
      "현장",
      "사전 상태",
      "작업"
    ],
    "basis": "보고서: 의료인 역할·진료·처방·사후관리",
    "extension": "우리 확장: 검사오더·Viewer·판독",
    "roleKey": "CLINICIAN",
    "path": "/clinical/clinician/c02",
    "requiredRoles": [
      "CLINICIAN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "C03",
    "role": "원격 의료인",
    "title": "환자 임상 요약",
    "subtitle": "문진·측정값·처방 이력·위험 신호를 한 화면에서 확인합니다.",
    "layout": "clinical_summary",
    "sections": [
      "주요 증상",
      "Vital",
      "위험 신호",
      "문진",
      "건강정보"
    ],
    "basis": "보고서: 의료인 역할·진료·처방·사후관리",
    "extension": "우리 확장: 검사오더·Viewer·판독",
    "roleKey": "CLINICIAN",
    "path": "/clinical/clinician/c03",
    "requiredRoles": [
      "CLINICIAN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "C04",
    "role": "원격 의료인",
    "title": "비대면진료 적합성 검토",
    "subtitle": "비대면 진행 여부와 대면·응급 전환 필요성을 의료인이 판단합니다.",
    "layout": "suitability",
    "sections": [
      "응급 위험신호",
      "문진 완결성",
      "비대면 진행",
      "대면 권고",
      "응급전환"
    ],
    "basis": "보고서: 의료인 역할·진료·처방·사후관리",
    "extension": "우리 확장: 검사오더·Viewer·판독",
    "roleKey": "CLINICIAN",
    "path": "/clinical/clinician/c04",
    "requiredRoles": [
      "CLINICIAN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "C05",
    "role": "원격 의료인",
    "title": "원격진료 워크스페이스",
    "subtitle": "화상·환자 요약·임상 액션·검사 데이터를 함께 봅니다.",
    "layout": "clinical_workspace",
    "sections": [
      "환자 요약",
      "Live Video",
      "Clinical Actions",
      "검사 상태",
      "Viewer tabs"
    ],
    "basis": "보고서: 의료인 역할·진료·처방·사후관리",
    "extension": "우리 확장: 검사오더·Viewer·판독",
    "roleKey": "CLINICIAN",
    "path": "/clinical/clinician/c05",
    "requiredRoles": [
      "CLINICIAN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "C06",
    "role": "원격 의료인",
    "title": "검사오더 작성",
    "subtitle": "검사 종류와 임상 질문을 구조화해 현장에 요청합니다.",
    "layout": "form",
    "sections": [
      "검사",
      "우선순위",
      "임상 질문",
      "필요 시점",
      "현장 준비도"
    ],
    "basis": "보고서: 의료인 역할·진료·처방·사후관리",
    "extension": "우리 확장: 검사오더·Viewer·판독",
    "roleKey": "CLINICIAN",
    "path": "/clinical/clinician/c06",
    "requiredRoles": [
      "CLINICIAN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "C07",
    "role": "원격 의료인",
    "title": "검사 진행 모니터",
    "subtitle": "검사 진행·전송 지연·데이터 신선도를 확인합니다.",
    "layout": "monitor",
    "sections": [
      "ECG 수신",
      "청진 진행",
      "영상 Store & Forward",
      "Captured/Received"
    ],
    "basis": "보고서: 의료인 역할·진료·처방·사후관리",
    "extension": "우리 확장: 검사오더·Viewer·판독",
    "roleKey": "CLINICIAN",
    "path": "/clinical/clinician/c07",
    "requiredRoles": [
      "CLINICIAN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "C08",
    "role": "원격 의료인",
    "title": "ECG Viewer",
    "subtitle": "12유도 파형과 시간·기술 품질 정보를 확인합니다.",
    "layout": "waveform",
    "sections": [
      "12 Lead",
      "500 Hz",
      "Captured time",
      "Quality"
    ],
    "basis": "보고서: 의료인 역할·진료·처방·사후관리",
    "extension": "우리 확장: 검사오더·Viewer·판독",
    "roleKey": "CLINICIAN",
    "path": "/clinical/clinician/c08",
    "requiredRoles": [
      "CLINICIAN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "C09",
    "role": "원격 의료인",
    "title": "DICOM Viewer",
    "subtitle": "영상 시리즈와 주요 메타데이터를 확인합니다.",
    "layout": "dicom",
    "sections": [
      "Study",
      "Series",
      "Modality",
      "Transfer Syntax",
      "Quality"
    ],
    "basis": "보고서: 의료인 역할·진료·처방·사후관리",
    "extension": "우리 확장: 검사오더·Viewer·판독",
    "roleKey": "CLINICIAN",
    "path": "/clinical/clinician/c09",
    "requiredRoles": [
      "CLINICIAN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "C10",
    "role": "원격 의료인",
    "title": "초음파·영상 Viewer",
    "subtitle": "초음파 또는 임상 영상을 확인합니다.",
    "layout": "ultrasound",
    "sections": [
      "Clip",
      "재생",
      "Captured",
      "Received",
      "신선도"
    ],
    "basis": "보고서: 의료인 역할·진료·처방·사후관리",
    "extension": "우리 확장: 검사오더·Viewer·판독",
    "roleKey": "CLINICIAN",
    "path": "/clinical/clinician/c10",
    "requiredRoles": [
      "CLINICIAN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "C11",
    "role": "원격 의료인",
    "title": "청진 Viewer",
    "subtitle": "심음·폐음 오디오와 구간 정보를 확인합니다.",
    "layout": "auscultation",
    "sections": [
      "폐음",
      "구간",
      "샘플링",
      "Quality",
      "재생"
    ],
    "basis": "보고서: 의료인 역할·진료·처방·사후관리",
    "extension": "우리 확장: 검사오더·Viewer·판독",
    "roleKey": "CLINICIAN",
    "path": "/clinical/clinician/c11",
    "requiredRoles": [
      "CLINICIAN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "C12",
    "role": "원격 의료인",
    "title": "검사수치 Viewer",
    "subtitle": "POC·Vital·검사 수치를 시간 순서로 확인합니다.",
    "layout": "lab",
    "sections": [
      "CRP",
      "Glucose",
      "SpO₂",
      "Trend",
      "출처"
    ],
    "basis": "보고서: 의료인 역할·진료·처방·사후관리",
    "extension": "우리 확장: 검사오더·Viewer·판독",
    "roleKey": "CLINICIAN",
    "path": "/clinical/clinician/c12",
    "requiredRoles": [
      "CLINICIAN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "C13",
    "role": "원격 의료인",
    "title": "기술 품질·재검 상태",
    "subtitle": "기술 품질 결과와 재검 요청 상태를 확인합니다.",
    "layout": "quality_table",
    "sections": [
      "검사",
      "기술 품질",
      "재검",
      "판독 가능"
    ],
    "basis": "보고서: 의료인 역할·진료·처방·사후관리",
    "extension": "우리 확장: 검사오더·Viewer·판독",
    "roleKey": "CLINICIAN",
    "path": "/clinical/clinician/c13",
    "requiredRoles": [
      "CLINICIAN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "C14",
    "role": "원격 의료인",
    "title": "전문의 판독",
    "subtitle": "기술 품질과 별개로 임상 소견을 기록합니다.",
    "layout": "form",
    "sections": [
      "Finding",
      "Impression",
      "근거 자료",
      "판독 저장"
    ],
    "basis": "보고서: 의료인 역할·진료·처방·사후관리",
    "extension": "우리 확장: 검사오더·Viewer·판독",
    "roleKey": "CLINICIAN",
    "path": "/clinical/clinician/c14",
    "requiredRoles": [
      "CLINICIAN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "C15",
    "role": "원격 의료인",
    "title": "진단 보고서",
    "subtitle": "소견과 근거 자료를 연결하고 보고서를 서명합니다.",
    "layout": "form",
    "sections": [
      "검사",
      "소견",
      "결론",
      "근거자료",
      "서명"
    ],
    "basis": "보고서: 의료인 역할·진료·처방·사후관리",
    "extension": "우리 확장: 검사오더·Viewer·판독",
    "roleKey": "CLINICIAN",
    "path": "/clinical/clinician/c15",
    "requiredRoles": [
      "CLINICIAN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "C16",
    "role": "원격 의료인",
    "title": "중요 결과 전달",
    "subtitle": "중요 결과의 전달·수신확인·에스컬레이션을 추적합니다.",
    "layout": "critical",
    "sections": [
      "중요 결과",
      "전달 시각",
      "수신 확인",
      "에스컬레이션"
    ],
    "basis": "보고서: 의료인 역할·진료·처방·사후관리",
    "extension": "우리 확장: 검사오더·Viewer·판독",
    "roleKey": "CLINICIAN",
    "path": "/clinical/clinician/c16",
    "requiredRoles": [
      "CLINICIAN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "C17",
    "role": "원격 의료인",
    "title": "처방 작성",
    "subtitle": "약제와 용법·기간을 작성합니다.",
    "layout": "prescription_edit",
    "sections": [
      "약제",
      "용법",
      "기간",
      "처방 항목"
    ],
    "basis": "보고서: 의료인 역할·진료·처방·사후관리",
    "extension": "우리 확장: 검사오더·Viewer·판독",
    "roleKey": "CLINICIAN",
    "path": "/clinical/clinician/c17",
    "requiredRoles": [
      "CLINICIAN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "C18",
    "role": "원격 의료인",
    "title": "DUR·처방 서명",
    "subtitle": "안전성 경고를 확인하고 필요한 조치 후 처방을 서명합니다.",
    "layout": "dur",
    "sections": [
      "중복 처방",
      "병용 금기",
      "주의사항",
      "확인 내용",
      "서명"
    ],
    "basis": "보고서: 의료인 역할·진료·처방·사후관리",
    "extension": "우리 확장: 검사오더·Viewer·판독",
    "roleKey": "CLINICIAN",
    "path": "/clinical/clinician/c18",
    "requiredRoles": [
      "CLINICIAN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "C19",
    "role": "원격 의료인",
    "title": "대면·응급 전환",
    "subtitle": "임상적 필요에 따라 대면 또는 응급 연계를 결정합니다.",
    "layout": "suitability",
    "sections": [
      "비대면 계속",
      "대면진료 전환",
      "응급전환",
      "판단 사유"
    ],
    "basis": "보고서: 의료인 역할·진료·처방·사후관리",
    "extension": "우리 확장: 검사오더·Viewer·판독",
    "roleKey": "CLINICIAN",
    "path": "/clinical/clinician/c19",
    "requiredRoles": [
      "CLINICIAN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "C20",
    "role": "원격 의료인",
    "title": "진료 종료·사후관리 계획",
    "subtitle": "진료를 종료하고 T0 사후관리 계획을 작성합니다.",
    "layout": "followup_form",
    "sections": [
      "다음 확인 시점",
      "자가측정",
      "복약 확인",
      "대면전환 기준"
    ],
    "basis": "보고서: 의료인 역할·진료·처방·사후관리",
    "extension": "우리 확장: 검사오더·Viewer·판독",
    "roleKey": "CLINICIAN",
    "path": "/clinical/clinician/c20",
    "requiredRoles": [
      "CLINICIAN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "O01",
    "role": "운영·관리",
    "title": "Clinical Command Center",
    "subtitle": "전체 사이트와 진료·장애·긴급 상태를 운영 관점에서 확인합니다.",
    "layout": "dashboard",
    "sections": [
      "운영 사이트",
      "진료 중",
      "장애",
      "중요 결과"
    ],
    "basis": "보고서: 플랫폼 관리·품질·보안",
    "extension": "우리 확장: Device·Edge·Interop·Validation",
    "roleKey": "OPERATIONS",
    "path": "/clinical/operations/o01",
    "requiredRoles": [
      "OPERATIONS_ADMIN",
      "SECURITY_ADMIN",
      "QUALITY_ADMIN",
      "PLATFORM_ADMIN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "O02",
    "role": "운영·관리",
    "title": "원격 사이트 관리",
    "subtitle": "사이트·진료실·운영 상태를 관리합니다.",
    "layout": "table",
    "sections": [
      "사이트",
      "유형",
      "상태",
      "진료실",
      "장비",
      "작업"
    ],
    "basis": "보고서: 플랫폼 관리·품질·보안",
    "extension": "우리 확장: Device·Edge·Interop·Validation",
    "roleKey": "OPERATIONS",
    "path": "/clinical/operations/o02",
    "requiredRoles": [
      "OPERATIONS_ADMIN",
      "SECURITY_ADMIN",
      "QUALITY_ADMIN",
      "PLATFORM_ADMIN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "O03",
    "role": "운영·관리",
    "title": "네트워크·진료실 상태",
    "subtitle": "사이트별 네트워크와 진료실 상태를 확인합니다.",
    "layout": "status_grid",
    "sections": [
      "네트워크",
      "진료실",
      "지연",
      "Availability"
    ],
    "basis": "보고서: 플랫폼 관리·품질·보안",
    "extension": "우리 확장: Device·Edge·Interop·Validation",
    "roleKey": "OPERATIONS",
    "path": "/clinical/operations/o03",
    "requiredRoles": [
      "OPERATIONS_ADMIN",
      "SECURITY_ADMIN",
      "QUALITY_ADMIN",
      "PLATFORM_ADMIN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "O04",
    "role": "운영·관리",
    "title": "의료기기 카탈로그",
    "subtitle": "검사와 Device Capability 기준 카탈로그를 관리합니다.",
    "layout": "table",
    "sections": [
      "DeviceType",
      "Capability",
      "검사 연결",
      "상태"
    ],
    "basis": "보고서: 플랫폼 관리·품질·보안",
    "extension": "우리 확장: Device·Edge·Interop·Validation",
    "roleKey": "OPERATIONS",
    "path": "/clinical/operations/o04",
    "requiredRoles": [
      "OPERATIONS_ADMIN",
      "SECURITY_ADMIN",
      "QUALITY_ADMIN",
      "PLATFORM_ADMIN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "O05",
    "role": "운영·관리",
    "title": "의료기기 인벤토리",
    "subtitle": "실제 설치 장비와 식별자·상태를 관리합니다.",
    "layout": "table",
    "sections": [
      "장비",
      "사이트",
      "모델",
      "Lifecycle",
      "Clinical Use",
      "Health"
    ],
    "basis": "보고서: 플랫폼 관리·품질·보안",
    "extension": "우리 확장: Device·Edge·Interop·Validation",
    "roleKey": "OPERATIONS",
    "path": "/clinical/operations/o05",
    "requiredRoles": [
      "OPERATIONS_ADMIN",
      "SECURITY_ADMIN",
      "QUALITY_ADMIN",
      "PLATFORM_ADMIN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "O06",
    "role": "운영·관리",
    "title": "교정·점검",
    "subtitle": "교정·유지보수·만료 예정 상태를 관리합니다.",
    "layout": "table",
    "sections": [
      "장비",
      "최근 교정",
      "다음 기한",
      "상태",
      "작업"
    ],
    "basis": "보고서: 플랫폼 관리·품질·보안",
    "extension": "우리 확장: Device·Edge·Interop·Validation",
    "roleKey": "OPERATIONS",
    "path": "/clinical/operations/o06",
    "requiredRoles": [
      "OPERATIONS_ADMIN",
      "SECURITY_ADMIN",
      "QUALITY_ADMIN",
      "PLATFORM_ADMIN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "O07",
    "role": "운영·관리",
    "title": "현장 인력 자격",
    "subtitle": "현장 인력의 자격·유효기간을 관리합니다.",
    "layout": "table",
    "sections": [
      "인력",
      "자격",
      "발급기관",
      "유효기간",
      "상태"
    ],
    "basis": "보고서: 플랫폼 관리·품질·보안",
    "extension": "우리 확장: Device·Edge·Interop·Validation",
    "roleKey": "OPERATIONS",
    "path": "/clinical/operations/o07",
    "requiredRoles": [
      "OPERATIONS_ADMIN",
      "SECURITY_ADMIN",
      "QUALITY_ADMIN",
      "PLATFORM_ADMIN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "O08",
    "role": "운영·관리",
    "title": "업무 Capability",
    "subtitle": "검사·진료에 필요한 Capability 부여 상태를 관리합니다.",
    "layout": "table",
    "sections": [
      "인력",
      "Capability",
      "감독 조건",
      "Scope",
      "상태"
    ],
    "basis": "보고서: 플랫폼 관리·품질·보안",
    "extension": "우리 확장: Device·Edge·Interop·Validation",
    "roleKey": "OPERATIONS",
    "path": "/clinical/operations/o08",
    "requiredRoles": [
      "OPERATIONS_ADMIN",
      "SECURITY_ADMIN",
      "QUALITY_ADMIN",
      "PLATFORM_ADMIN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "O09",
    "role": "운영·관리",
    "title": "Edge Gateway",
    "subtitle": "Gateway 인증서·heartbeat·queue 상태를 관리합니다.",
    "layout": "table",
    "sections": [
      "Gateway",
      "사이트",
      "인증서",
      "상태",
      "Queue",
      "마지막 수신"
    ],
    "basis": "보고서: 플랫폼 관리·품질·보안",
    "extension": "우리 확장: Device·Edge·Interop·Validation",
    "roleKey": "OPERATIONS",
    "path": "/clinical/operations/o09",
    "requiredRoles": [
      "OPERATIONS_ADMIN",
      "SECURITY_ADMIN",
      "QUALITY_ADMIN",
      "PLATFORM_ADMIN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "O10",
    "role": "운영·관리",
    "title": "Adapter·Firmware 검증",
    "subtitle": "장비 모델·firmware·adapter qualification을 관리합니다.",
    "layout": "table",
    "sections": [
      "장비 모델",
      "Firmware",
      "Adapter",
      "검증",
      "운영 허용"
    ],
    "basis": "보고서: 플랫폼 관리·품질·보안",
    "extension": "우리 확장: Device·Edge·Interop·Validation",
    "roleKey": "OPERATIONS",
    "path": "/clinical/operations/o10",
    "requiredRoles": [
      "OPERATIONS_ADMIN",
      "SECURITY_ADMIN",
      "QUALITY_ADMIN",
      "PLATFORM_ADMIN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "O11",
    "role": "운영·관리",
    "title": "외부 시스템",
    "subtitle": "EMR·PACS·FHIR 등 외부 시스템 연결을 관리합니다.",
    "layout": "table",
    "sections": [
      "시스템",
      "종류",
      "연결",
      "프로파일",
      "상태"
    ],
    "basis": "보고서: 플랫폼 관리·품질·보안",
    "extension": "우리 확장: Device·Edge·Interop·Validation",
    "roleKey": "OPERATIONS",
    "path": "/clinical/operations/o11",
    "requiredRoles": [
      "OPERATIONS_ADMIN",
      "SECURITY_ADMIN",
      "QUALITY_ADMIN",
      "PLATFORM_ADMIN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "O12",
    "role": "운영·관리",
    "title": "Interop Queue",
    "subtitle": "전송·ACK·재시도·격리 상태를 확인합니다.",
    "layout": "table",
    "sections": [
      "시각",
      "대상",
      "메시지",
      "상태",
      "시도",
      "작업"
    ],
    "basis": "보고서: 플랫폼 관리·품질·보안",
    "extension": "우리 확장: Device·Edge·Interop·Validation",
    "roleKey": "OPERATIONS",
    "path": "/clinical/operations/o12",
    "requiredRoles": [
      "OPERATIONS_ADMIN",
      "SECURITY_ADMIN",
      "QUALITY_ADMIN",
      "PLATFORM_ADMIN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "O13",
    "role": "운영·관리",
    "title": "Audit·접근기록",
    "subtitle": "임상 및 접근 로그를 조회합니다.",
    "layout": "table",
    "sections": [
      "시각",
      "사용자",
      "행위",
      "리소스",
      "결과"
    ],
    "basis": "보고서: 플랫폼 관리·품질·보안",
    "extension": "우리 확장: Device·Edge·Interop·Validation",
    "roleKey": "OPERATIONS",
    "path": "/clinical/operations/o13",
    "requiredRoles": [
      "OPERATIONS_ADMIN",
      "SECURITY_ADMIN",
      "QUALITY_ADMIN",
      "PLATFORM_ADMIN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "O14",
    "role": "운영·관리",
    "title": "개인정보·Break Glass",
    "subtitle": "긴급접근·보존·법적보류 정책을 관리합니다.",
    "layout": "privacy",
    "sections": [
      "Break Glass",
      "Legal Hold",
      "폐기 대기",
      "감사"
    ],
    "basis": "보고서: 플랫폼 관리·품질·보안",
    "extension": "우리 확장: Device·Edge·Interop·Validation",
    "roleKey": "OPERATIONS",
    "path": "/clinical/operations/o14",
    "requiredRoles": [
      "OPERATIONS_ADMIN",
      "SECURITY_ADMIN",
      "QUALITY_ADMIN",
      "PLATFORM_ADMIN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "O15",
    "role": "운영·관리",
    "title": "보안·운영 Incident",
    "subtitle": "보안 및 서비스 사고를 접수하고 추적합니다.",
    "layout": "table",
    "sections": [
      "번호",
      "분류",
      "심각도",
      "상태",
      "발생",
      "담당"
    ],
    "basis": "보고서: 플랫폼 관리·품질·보안",
    "extension": "우리 확장: Device·Edge·Interop·Validation",
    "roleKey": "OPERATIONS",
    "path": "/clinical/operations/o15",
    "requiredRoles": [
      "OPERATIONS_ADMIN",
      "SECURITY_ADMIN",
      "QUALITY_ADMIN",
      "PLATFORM_ADMIN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "O16",
    "role": "운영·관리",
    "title": "Backup·DR",
    "subtitle": "백업·복구훈련·RTO/RPO 증거를 관리합니다.",
    "layout": "dr",
    "sections": [
      "최근 Backup",
      "복구 Drill",
      "RTO",
      "RPO",
      "Evidence"
    ],
    "basis": "보고서: 플랫폼 관리·품질·보안",
    "extension": "우리 확장: Device·Edge·Interop·Validation",
    "roleKey": "OPERATIONS",
    "path": "/clinical/operations/o16",
    "requiredRoles": [
      "OPERATIONS_ADMIN",
      "SECURITY_ADMIN",
      "QUALITY_ADMIN",
      "PLATFORM_ADMIN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "O17",
    "role": "운영·관리",
    "title": "Validation·Traceability",
    "subtitle": "요구사항과 시험·증거 추적성을 관리합니다.",
    "layout": "table",
    "sections": [
      "요구사항",
      "Control",
      "시험",
      "결과",
      "Evidence"
    ],
    "basis": "보고서: 플랫폼 관리·품질·보안",
    "extension": "우리 확장: Device·Edge·Interop·Validation",
    "roleKey": "OPERATIONS",
    "path": "/clinical/operations/o17",
    "requiredRoles": [
      "OPERATIONS_ADMIN",
      "SECURITY_ADMIN",
      "QUALITY_ADMIN",
      "PLATFORM_ADMIN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "O18",
    "role": "운영·관리",
    "title": "Release Gate",
    "subtitle": "배포 후보의 시험과 승인 상태를 확인합니다.",
    "layout": "release",
    "sections": [
      "Engineering",
      "Clinical",
      "Security",
      "Privacy",
      "Operations",
      "Quality"
    ],
    "basis": "보고서: 플랫폼 관리·품질·보안",
    "extension": "우리 확장: Device·Edge·Interop·Validation",
    "roleKey": "OPERATIONS",
    "path": "/clinical/operations/o18",
    "requiredRoles": [
      "OPERATIONS_ADMIN",
      "SECURITY_ADMIN",
      "QUALITY_ADMIN",
      "PLATFORM_ADMIN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "O19",
    "role": "운영·관리",
    "title": "역할·권한·Scope",
    "subtitle": "사용자 역할과 Site/Encounter/Patient Scope를 관리합니다.",
    "layout": "rbac",
    "sections": [
      "Role",
      "Permission",
      "SITE",
      "ENCOUNTER",
      "PATIENT"
    ],
    "basis": "보고서: 플랫폼 관리·품질·보안",
    "extension": "우리 확장: Device·Edge·Interop·Validation",
    "roleKey": "OPERATIONS",
    "path": "/clinical/operations/o19",
    "requiredRoles": [
      "OPERATIONS_ADMIN",
      "SECURITY_ADMIN",
      "QUALITY_ADMIN",
      "PLATFORM_ADMIN",
      "CLINICAL_ADMIN"
    ]
  },
  {
    "code": "O20",
    "role": "운영·관리",
    "title": "서비스 품질·성과",
    "subtitle": "진료 품질·접근성·후속관리 지표를 모니터링합니다.",
    "layout": "metrics",
    "sections": [
      "진료 완료율",
      "대면전환",
      "재검률",
      "후속관리 응답",
      "접근성"
    ],
    "basis": "보고서: 플랫폼 관리·품질·보안",
    "extension": "우리 확장: Device·Edge·Interop·Validation",
    "roleKey": "OPERATIONS",
    "path": "/clinical/operations/o20",
    "requiredRoles": [
      "OPERATIONS_ADMIN",
      "SECURITY_ADMIN",
      "QUALITY_ADMIN",
      "PLATFORM_ADMIN",
      "CLINICAL_ADMIN"
    ]
  }
] as ClinicalScreenSpec[];

export const CLINICAL_SCREEN_BY_CODE = Object.fromEntries(
  CLINICAL_SCREENS.map((screen) => [screen.code, screen]),
) as Record<string, ClinicalScreenSpec>;

export const CLINICAL_SCREEN_BY_PATH = Object.fromEntries(
  CLINICAL_SCREENS.map((screen) => [screen.path, screen]),
) as Record<string, ClinicalScreenSpec>;

export function firstScreenForRole(roleKey: ClinicalRoleKey): ClinicalScreenSpec | undefined {
  return CLINICAL_SCREENS.find((screen) => screen.roleKey === roleKey);
}
