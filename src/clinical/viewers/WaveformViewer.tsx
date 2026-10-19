import React, { useMemo } from 'react';
import { ClinicalBadge, ClinicalCard } from '../ui/ClinicalUi';

function pathFor(seed: number, width=900, height=220) {
  const points: string[] = [];
  for (let x=0; x<width; x+=2) {
    const m=(x+seed)%140;
    let y=height/2 + Math.sin((x+seed)/17)*4;
    if (m>54 && m<61) y-=45*(1-Math.abs(m-58)/4);
    if (m>=61 && m<66) y+=62*(1-Math.abs(m-64)/3);
    if (m>=66 && m<73) y-=22*(1-Math.abs(m-69)/4);
    points.push(`${x},${y.toFixed(1)}`);
  }
  return points.join(' ');
}

export function WaveformViewer({ title='12유도 ECG' }: { title?: string }) {
  const p1=useMemo(()=>pathFor(0),[]);
  const p2=useMemo(()=>pathFor(25),[]);
  return (
    <ClinicalCard title={title}>
      {[p1,p2].map((points,i)=>(
        <svg className="cf-wave" viewBox="0 0 900 220" key={i} preserveAspectRatio="none">
          <defs>
            <pattern id={`grid-${i}`} width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#dfe8ee" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="900" height="220" fill={`url(#grid-${i})`} />
          <polyline points={points} fill="none" stroke="#168078" strokeWidth="2.2"/>
        </svg>
      ))}
      <div className="cf-action-row">
        <ClinicalBadge tone="success">QUALITY ACCEPTED</ClinicalBadge>
        <span>500 Hz</span><span>12 leads</span><span>Captured time 표시</span>
      </div>
    </ClinicalCard>
  );
}
