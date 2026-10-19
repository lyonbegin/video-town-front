import React from 'react';
import { ClinicalBadge, ClinicalCard } from '../ui/ClinicalUi';

export function DicomViewer() {
  return (
    <div className="cf-viewer-split">
      <div className="cf-dicom-stage">
        <div className="cf-xray-placeholder"><span>CHEST<br/>PA</span></div>
      </div>
      <ClinicalCard title="DICOM 정보">
        <dl className="cf-definition">
          <dt>Study</dt><dd>Chest X-ray</dd>
          <dt>Modality</dt><dd>DX</dd>
          <dt>Series</dt><dd>1</dd>
          <dt>Quality</dt><dd><ClinicalBadge tone="success">ACCEPTED</ClinicalBadge></dd>
        </dl>
      </ClinicalCard>
    </div>
  );
}
