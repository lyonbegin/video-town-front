import React, { useMemo } from 'react';
import { ClinicalBadge, ClinicalNotice } from '../ui/ClinicalUi';

export function Vdev2RuntimeFrame({
  title,
  deviceCode,
  sourceLabel,
  viewerOnly = false,
  autoCreate = false,
}: {
  title: string;
  deviceCode?: string;
  sourceLabel?: string;
  viewerOnly?: boolean;
  autoCreate?: boolean;
}) {
  const src = useMemo(() => {
    const params = new URLSearchParams();
    params.set('embed', viewerOnly ? 'viewer' : 'catalog');
    if (deviceCode) params.set('device', deviceCode);
    if (autoCreate) params.set('autocreate', '1');
    return `/vdev2-runtime/index.html?${params.toString()}`;
  }, [deviceCode, viewerOnly, autoCreate]);

  return (
    <section className="cf-vdev2-runtime">
      <div className="cf-vdev2-runtime-head">
        <div>
          <strong>{title}</strong>
          <div className="cf-vdev2-runtime-badges">
            <ClinicalBadge tone="success">SOURCE-LOCKED RUNTIME</ClinicalBadge>
            <ClinicalBadge tone="neutral">SYNTHETIC ONLY</ClinicalBadge>
            <ClinicalBadge tone="neutral">PHYSICAL ACTUATION DISABLED</ClinicalBadge>
            {sourceLabel && <span>{sourceLabel}</span>}
          </div>
        </div>
        <div className="cf-vdev2-runtime-links">
          <a href={src} target="_blank" rel="noreferrer">현재 Viewer 새 창</a>
          <a href="/vdev2-runtime/index.html?embed=catalog" target="_blank" rel="noreferrer">78종 전체 장비</a>
        </div>
      </div>
      <ClinicalNotice tone="info">
        아래 영역은 기존 임상 화면의 가짜 placeholder가 아니라 VDEV2 source-port 런타임입니다.
        OpenSeadragon·vtk.js는 실제 vendored GitHub runtime을 사용하고, DICOM은 실제 OHIF gateway로,
        ECG/EEG 등은 WFDB·BrainFlow/source-port 출력 데이터를 렌더링합니다.
      </ClinicalNotice>
      <iframe
        className={`cf-vdev2-runtime-frame ${viewerOnly ? 'cf-vdev2-runtime-frame--viewer' : ''}`}
        src={src}
        title={title}
        allow="autoplay; fullscreen"
      />
    </section>
  );
}
