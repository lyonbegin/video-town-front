# CareLink Frontend

새 Realtime Session Server에 맞춘 독립 React/Vite 프론트입니다. 기존 프론트와 호환하지 않습니다.

## 기본 구조

- 개발 로그인: `/auth/dev-token`
- 진료 목록/생성: `/telemedicine/consultations`
- Socket.IO namespace: `/realtime`
- mediasoup-client 기반 N:N SFU
- 사용자가 `카메라·마이크 확인 시작`을 누를 때만 `getUserMedia()` 실행
- 대기실 → 준비 완료 → Host 진료 시작 → RTC 연결
- 카메라/마이크 pause/resume
- 주치의 화면 공유
- Socket.IO 재연결 및 RTC peer resume
- video simulcast 3 layers

## 로컬 실행

서버가 `http://localhost:8888`에서 실행 중이라고 가정합니다.

```powershell
cd C:\telemedicine-front
Copy-Item .env.example .env
npm install
npm run dev
```

브라우저에서:

```text
http://localhost:5173
```

`.env` 기본값:

```env
VITE_API_BASE_URL=http://localhost:8888
```

서버 `.env`에는 최소한 아래가 포함되어야 합니다.

```env
PORT=8888
MEDIA_NODE_PUBLIC_URL=http://localhost:8888
CORS_ORIGINS=http://localhost:5173
MEDIASOUP_ANNOUNCED_ADDRESS=127.0.0.1
```

## 두 명으로 로컬 테스트

1. 서버 실행
2. Chrome 일반 창에서 `http://localhost:5173` → `주치의` → 로그인
3. `테스트 진료 생성` → 기본 환자 ID `patient-1` → 생성
4. Chrome 시크릿 창에서 같은 주소 → `환자` → 로그인
5. 환자 화면에서 새로고침 → 같은 진료 선택
6. 양쪽에서 `카메라·마이크 확인 시작` → 브라우저 권한 허용
7. 양쪽 `준비 완료`
8. 의사 창에서 `진료 시작`
9. 양쪽이 mediasoup Router에 연결되고 서로의 영상/음성이 표시됨

같은 PC에서 두 창을 테스트하면 스피커-마이크 하울링이 생길 수 있으므로 한쪽 창의 스피커를 음소거하거나 이어폰을 사용하세요.

## 같은 Wi-Fi의 휴대폰 테스트

`localhost`는 휴대폰에서 PC를 뜻하지 않습니다. PC의 LAN IP가 예를 들어 `192.168.0.10`이라면 서버와 프론트의 환경변수를 그 주소 기준으로 변경해야 합니다. 또한 브라우저 카메라 권한은 일반적으로 보안 컨텍스트(HTTPS 또는 localhost)가 필요하므로, 휴대폰 실기기 테스트는 HTTPS 개발 터널 또는 실제 HTTPS 배포 환경에서 진행하는 것을 권장합니다.
