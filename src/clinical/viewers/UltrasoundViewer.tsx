import React from 'react';
import { ClinicalBadge, ClinicalCard } from '../ui/ClinicalUi';

export function UltrasoundViewer() {
  return (
    <div className="cf-viewer-split">
      <div className="cf-ultrasound-stage"><div className="cf-ultrasound-cone"/><button className="cf-play">▶</button></div>
      <ClinicalCard title="영상 정보">
        <dl className="cf-definition">
          <dt>Clip</dt><dd>00:18</dd>
          <dt>Captured</dt><dd>13:46:12</dd>
          <dt>Received</dt><dd>13:46:15</dd>
          <dt>Freshness</dt><dd><ClinicalBadge>NEAR REALTIME</ClinicalBadge></dd>
        </dl>
      </ClinicalCard>
    </div>
  );
}
