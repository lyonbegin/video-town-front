export const CAMERA_DEVICE_CODES=Object.freeze([
  'DIGITAL_OTOSCOPE','VIDEO_RHINOLARYNGOSCOPE','DIGITAL_SLIT_LAMP',
  'CLINICAL_MACRO_CAMERA','DIGITAL_DERMATOSCOPE','WOUND_IMAGING_CAMERA',
  'SKIN_ANALYZER','INTRAORAL_CAMERA','DIGITAL_MICROSCOPE','TELEEXAM_CAMERA'
]);
const CAMERA_SET=new Set(CAMERA_DEVICE_CODES);

export function isCameraDevice(code){ return CAMERA_SET.has(code); }

function palette(code){
  if(code==='DIGITAL_OTOSCOPE') return ['#ae6559','#4b2221','#efbe95'];
  if(code==='VIDEO_RHINOLARYNGOSCOPE') return ['#a25c63','#28181d','#e9a7a3'];
  if(code==='DIGITAL_SLIT_LAMP') return ['#6d8ea8','#131d27','#d6efff'];
  if(code==='INTRAORAL_CAMERA') return ['#d08f87','#532b2d','#f5d2be'];
  if(code==='DIGITAL_MICROSCOPE') return ['#8296aa','#101820','#d8e8ef'];
  return ['#b57968','#3b2525','#e8b9a6'];
}
function paintSyntheticFrame(ctx,w,h,code,frame){
  const [a,b,c]=palette(code),t=frame/30;
  ctx.fillStyle=b;ctx.fillRect(0,0,w,h);
  const g=ctx.createRadialGradient(w*.5,h*.5,20,w*.5,h*.5,Math.max(w,h)*.62);
  g.addColorStop(0,a);g.addColorStop(.72,c);g.addColorStop(1,b);
  ctx.fillStyle=g;ctx.globalAlpha=.78;ctx.fillRect(0,0,w,h);ctx.globalAlpha=1;
  ctx.strokeStyle='rgba(255,255,255,.23)';ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(w*.5,h*.5,Math.min(w,h)*(.28+.015*Math.sin(t)),0,Math.PI*2);ctx.stroke();
  for(let i=0;i<18;i++){
    const q=t*.18+i*.83,rr=Math.min(w,h)*(.08+(i%7)*.028);
    const x=w*.5+Math.cos(q)*rr*2.2,y=h*.5+Math.sin(q*1.31)*rr*1.45;
    ctx.fillStyle=`rgba(64,24,28,${0.08+(i%4)*.035})`;
    ctx.beginPath();ctx.arc(x,y,4+(i%5)*3,0,Math.PI*2);ctx.fill();
  }
  ctx.fillStyle='rgba(255,255,255,.9)';ctx.font='18px ui-monospace, monospace';
  ctx.fillText('VDEV2 SYNTHETIC WEBRTC',18,28);
  ctx.font='13px ui-monospace, monospace';ctx.fillStyle='rgba(255,255,255,.72)';
  ctx.fillText(code,18,50);ctx.fillText(`frame ${frame}`,18,h-18);
}
function waitForTrack(pc,timeoutMs=6000){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('WebRTC remote track timeout')),timeoutMs);
    pc.ontrack=e=>{clearTimeout(timer);resolve(e.streams[0]||new MediaStream([e.track]));};
  });
}
async function connectLoopback(sourceStream){
  const sender=new RTCPeerConnection({iceServers:[]});
  const receiver=new RTCPeerConnection({iceServers:[]});
  sender.onicecandidate=e=>{if(e.candidate)receiver.addIceCandidate(e.candidate).catch(()=>{});};
  receiver.onicecandidate=e=>{if(e.candidate)sender.addIceCandidate(e.candidate).catch(()=>{});};
  sourceStream.getTracks().forEach(track=>sender.addTrack(track,sourceStream));
  const remotePromise=waitForTrack(receiver);
  await sender.setLocalDescription(await sender.createOffer());
  await receiver.setRemoteDescription(sender.localDescription);
  await receiver.setLocalDescription(await receiver.createAnswer());
  await sender.setRemoteDescription(receiver.localDescription);
  const remoteStream=await remotePromise;
  return {sender,receiver,remoteStream};
}
export async function createSyntheticWebRtcSession(code,{width=960,height=540,fps=12}={}){
  if(!isCameraDevice(code)) throw new Error(`Unsupported VDEV2 camera device: ${code}`);
  if(typeof document==='undefined'||typeof RTCPeerConnection==='undefined') throw new Error('Browser WebRTC runtime is required');
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{alpha:false});
  let frame=0,closed=false,raf=0,last=0;
  const interval=1000/fps;
  const draw=(ts=0)=>{
    if(closed)return;
    if(ts-last>=interval){paintSyntheticFrame(ctx,width,height,code,frame++);last=ts;}
    raf=requestAnimationFrame(draw);
  };
  paintSyntheticFrame(ctx,width,height,code,frame++);
  raf=requestAnimationFrame(draw);
  const sourceStream=canvas.captureStream(fps);
  const {sender,receiver,remoteStream}=await connectLoopback(sourceStream);
  const close=()=>{
    if(closed)return;closed=true;
    cancelAnimationFrame(raf);
    sourceStream.getTracks().forEach(t=>t.stop());
    remoteStream.getTracks().forEach(t=>t.stop());
    sender.close();receiver.close();
  };
  return {
    code,width,height,fps,canvas,sourceStream,remoteStream,sender,receiver,close,
    descriptor:{transport:'WEBRTC',mode:'SYNTHETIC_LOOPBACK',physicalCameraAccess:false,syntheticOnly:true}
  };
}
export async function mountSyntheticCamera(container,code,options={}){
  const session=await createSyntheticWebRtcSession(code,options);
  const video=document.createElement('video');
  video.autoplay=true;video.muted=true;video.playsInline=true;video.className='camera-video';
  video.srcObject=session.remoteStream;
  container.replaceChildren(video);
  await video.play().catch(()=>{});
  return session;
}
