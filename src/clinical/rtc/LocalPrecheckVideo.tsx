import React, { useEffect, useRef, useState } from 'react';
import { ClinicalBadge, ClinicalButton, ClinicalCard } from '../ui/ClinicalUi';

export function LocalPrecheckVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState('');

  const start = async () => {
    try {
      setError('');
      const next = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(next);
      if (videoRef.current) videoRef.current.srcObject = next;
    } catch (e) {
      setError(e instanceof Error ? e.message : '카메라/마이크를 열 수 없습니다.');
    }
  };

  useEffect(() => () => stream?.getTracks().forEach((track) => track.stop()), [stream]);

  return (
    <ClinicalCard title="카메라·마이크 점검">
      <div className="cf-precheck-video"><video ref={videoRef} autoPlay muted playsInline /></div>
      <div className="cf-action-row">
        <ClinicalButton onClick={start}>점검 시작</ClinicalButton>
        <ClinicalBadge tone={error ? 'danger' : stream ? 'success' : 'neutral'}>
          {error || (stream ? '미디어 정상' : '점검 전')}
        </ClinicalBadge>
      </div>
    </ClinicalCard>
  );
}
