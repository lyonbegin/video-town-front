# Video Core

여러 서비스가 영상·음성·실시간 얼굴 가면 코드를 복사하지 않고 공통으로 사용하는 브라우저 SDK입니다.

## 역할

- 카메라 / 마이크
- MediaStream
- 원본 영상 / 가면 영상 전환
- MindAR 얼굴 추적과 3D 가면 합성
- OneEuro / deadband / 자동 튜닝
- WebRTC RTCRtpSender.replaceTrack() 연동
- 추적 상태와 진단 로그

병원, 상담, AI, 예약, 결제, 커뮤니티 같은 서비스 기능은 이 저장소에 넣지 않습니다.

## Railway

Playground: https://video-town-front-production.up.railway.app/

Standalone SDK Playground: https://video-town-front-production.up.railway.app/sdk-playground.html

SDK: https://video-town-front-production.up.railway.app/sdk/video-core.esm.js

## 외부 웹에서 사용

MindAR가 사용하는 import map을 페이지 head에 한 번 설정합니다.

```html
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/",
    "mindar-face-three": "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-face-three.prod.js"
  }
}
</script>
```

그 다음 SDK를 불러옵니다.

```js
const { VideoCore } = await import(
  "https://video-town-front-production.up.railway.app/sdk/video-core.esm.js"
);

const core = await VideoCore.create();
const camera = await core.openCamera({ mode: "mask" });
const outgoingStream = camera.stream;
```

가면 전환:

```js
await camera.disableMask();
await camera.enableMask();
```

이미 WebRTC 연결 중이면:

```js
await camera.replaceVideoTrack(videoSender);
await camera.replaceAudioTrack(audioSender);
```

## 빌드

```bash
npm install
npm run build
npm start
```

`npm run build`는 웹 Playground와 `dist/sdk/video-core.esm.js`를 함께 생성합니다.

## 진단

- GET /__runtime-probe
- GET /__mask-debug/health
- GET /__mask-debug/latest/status.json
- POST /__mask-debug/log
