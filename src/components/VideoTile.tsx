import { useEffect, useRef } from 'react';

export default function VideoTile({
  stream,
  label,
  muted = false,
  local = false,
  screen = false,
}: {
  stream?: MediaStream;
  label: string;
  muted?: boolean;
  local?: boolean;
  screen?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream ?? null;
  }, [stream]);

  return (
    <div className={`video-tile ${screen ? 'screen-tile' : ''}`}>
      {stream ? (
        <video ref={ref} autoPlay playsInline muted={muted} className={screen ? 'contain' : ''} />
      ) : (
        <div className="video-placeholder">
          <div className="avatar-circle">{label.slice(0, 1)}</div>
        </div>
      )}
      <div className="video-label">
        <span>{label}</span>
        {local && <span className="tiny-chip">나</span>}
        {screen && <span className="tiny-chip">화면 공유</span>}
      </div>
    </div>
  );
}
