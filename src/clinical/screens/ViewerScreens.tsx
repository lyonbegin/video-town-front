import React from 'react';
import { Vdev2RuntimeFrame } from '../viewers/Vdev2RuntimeFrame';

export function ViewerScreen({ kind }: { kind: 'ECG'|'DICOM'|'ULTRASOUND'|'AUSCULTATION'|'LAB' }) {
  const config = {
    ECG: {
      deviceCode: 'ECG_12_LEAD',
      title: '12유도 ECG · WFDB/source-port waveform',
      source: 'WFDB + VDEV2 source-port',
    },
    DICOM: {
      deviceCode: 'XRAY_FIXED_DR',
      title: 'DICOM · OHIF/Cornerstone',
      source: 'Modality-Emulator + OHIF',
    },
    ULTRASOUND: {
      deviceCode: 'ULTRASOUND_CART',
      title: '초음파 · DICOM/OHIF',
      source: 'Modality-Emulator + OHIF',
    },
    AUSCULTATION: {
      deviceCode: 'DIGITAL_STETHOSCOPE',
      title: '디지털 청진 · source-port waveform',
      source: 'Digital-Stethoscope source-port',
    },
    LAB: {
      deviceCode: 'CRP_ANALYZER',
      title: 'POC 검사 결과 · VDEV2 analyzer',
      source: 'VDEV2 analyzer protocol/runtime',
    },
  } as const;

  const selected = config[kind];
  return (
    <Vdev2RuntimeFrame
      title={selected.title}
      deviceCode={selected.deviceCode}
      sourceLabel={selected.source}
      viewerOnly
      autoCreate
    />
  );
}
