import { renderSourcedResult, wrapSourceResult } from './result-display.js';
import { resultDisplayProfile } from './result-display-profiles.js';
import { isCameraDevice, mountSyntheticCamera } from './camera-webrtc.js';
const integrationQuery=new URLSearchParams(window.location.search);
const integrationEmbed=integrationQuery.get('embed')||'';
if(integrationEmbed){
  document.body.classList.add('embed');
  if(integrationEmbed==='viewer')document.body.classList.add('viewer-only');
}
const $=(s)=>document.querySelector(s);
let catalog=[],selected=null,instance=null,stream=null,lastOutput=null,sourceGate=null;
let activeOsd=null,activeVtk=null,activeCamera=null,activeCameraAssetUrl=null;
function cleanupExternal(){try{activeOsd?.destroy?.()}catch{} activeOsd=null;try{activeVtk?.delete?.()}catch{} activeVtk=null;try{activeCamera?.close?.()}catch{} activeCamera=null;activeCameraAssetUrl=null;}

async function api(path,options={}){const res=await fetch(path,{headers:{'content-type':'application/json'},...options});const body=await res.json();if(!res.ok)throw new Error(body.message||body.error||`HTTP ${res.status}`);return body;}
function categories(){return [...new Set(catalog.map(d=>d.categoryCode))].sort()}
function renderList(){const q=$('#search').value.trim().toLowerCase(),c=$('#category').value;const items=catalog.filter(d=>(!c||d.categoryCode===c)&&(!q||d.code.toLowerCase().includes(q)||d.displayNameKo.toLowerCase().includes(q)));$('#deviceList').innerHTML=items.map(d=>`<div class="device-item ${selected?.code===d.code?'active':''}" data-code="${d.code}"><div>${d.displayNameKo}</div><div class="code">${d.code}</div></div>`).join('');document.querySelectorAll('.device-item').forEach(el=>el.onclick=()=>selectDevice(el.dataset.code));}
async function selectDevice(code){cleanupExternal();selected=catalog.find(d=>d.code===code);instance=null;lastOutput=null;if(stream){stream.close();stream=null}$('#empty').hidden=true;$('#detail').hidden=false;$('#instanceSection').hidden=true;$('#deviceName').textContent=selected.displayNameKo;$('#deviceCode').textContent=`${selected.code} · ${selected.categoryCode}`;const plan=await api(`/api/vdev2/devices/${selected.code}/external-plan`);const eu=selected.externalUi.kind==='NONE'?'장비 UI: VDEV2 자체 제작':`결과 Viewer: ${selected.externalUi.kind}`;const rp=resultDisplayProfile(selected.code);const rs=rp.sourceAnchors.length?rp.sourceAnchors.map(x=>x.repoId).join('+'):'VDEV2_SAFETY_CUSTOM';$('#sourceSummary').textContent=`Source gate ${sourceGate?.ok?'PASS':'NOT READY'} · ${selected.githubSource.mode} · ${eu} · plan=${plan.kind} · result=${rp.renderer} · ${rs}`;renderList();}
async function createInstance(){if(!selected)return;instance=await api('/api/vdev2/instances',{method:'POST',body:JSON.stringify({deviceCode:selected.code})});$('#instanceSection').hidden=false;renderInstance();connectStream();await refreshEvents();}
function renderAxes(){const a=instance.axes,cells=[['Provisioning',a.provisioning],['Process',a.process],['Power',a.power],['Device',a.device],['Procedure',a.procedure],['Connectivity',`${a.connectivity.adapter}/${a.connectivity.gateway}`]];$('#axes').innerHTML=cells.map(([k,v])=>`<div class="axis"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');}
const allCommands=['POWER_ON','BOOT','RUN_SELF_TEST','SELF_TEST_PASS','PREPARE','ACQUIRE','COMPLETE','START_ACQUISITION','PAUSE','RESUME','STOP_ACQUISITION','CAPTURE','PROCESS_COMPLETE','RUN_TEST','RESULT_ACCEPTED','ARM','ACTUATE_SIMULATED','DELIVERY_COMPLETE','COOL_COMPLETE','RESET','EMERGENCY_STOP','RESET_EMERGENCY','POWER_OFF'];
function renderCommands(){$('#commands').innerHTML=allCommands.map(c=>`<button data-command="${c}">${c}</button>`).join('');document.querySelectorAll('#commands button').forEach(b=>b.onclick=()=>sendCommand(b.dataset.command));const box=$('#interlockBox');if(selected.requiresInterlock){box.hidden=false;box.innerHTML=`Safety interlock: <strong>${instance.interlock}</strong> <button id="toggleInterlock">${instance.interlock==='CLOSED'?'OPEN':'CLOSE'} INTERLOCK</button>`;$('#toggleInterlock').onclick=toggleInterlock;}else box.hidden=true;}
function renderInstance(){renderAxes();renderCommands();renderPanel(lastOutput)}
async function sendCommand(command){try{const r=await api(`/api/vdev2/instances/${instance.id}/commands`,{method:'POST',body:JSON.stringify({command})});instance=r.state;if(r.output)lastOutput=r.output;renderInstance();await refreshEvents();}catch(e){alert(e.message)}}
async function toggleInterlock(){const value=instance.interlock==='CLOSED'?'OPEN':'CLOSED';try{instance=await api(`/api/vdev2/instances/${instance.id}/interlock`,{method:'POST',body:JSON.stringify({value})});renderInstance();await refreshEvents()}catch(e){alert(e.message)}}
function prepCanvas(canvas,h=240){const rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;canvas.width=Math.max(600,rect.width*dpr);canvas.height=h*dpr;const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);return {ctx,w:canvas.width/dpr,h};}
function grid(ctx,w,h,major=25){ctx.fillStyle='#06100e';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#17362c';ctx.lineWidth=1;for(let x=0;x<w;x+=major){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}for(let y=0;y<h;y+=major){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}}
function line(ctx,samples,w,h,color='#62f59d',min=null,max=null){if(!samples?.length)return;min=min??Math.min(...samples);max=max??Math.max(...samples);const span=Math.max(.001,max-min);ctx.strokeStyle=color;ctx.lineWidth=1.6;ctx.beginPath();samples.forEach((v,i)=>{const x=i/(samples.length-1)*w,y=h-(v-min)/span*h*.78-h*.11;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();}
function renderEcg12(out){const leads=out?.leads||[];return `<div class="ecg-meta">HR ${out?.heartRateBpm??'--'} bpm · ${out?.paperSpeedMmSec??25} mm/s · ${out?.gainMmMv??10} mm/mV</div><div class="lead-grid">${leads.map((l,i)=>`<div class="lead"><span>${l.name}</span><canvas id="lead-${i}"></canvas></div>`).join('')}</div>`;}
function drawEcg12(out){(out?.leads||[]).forEach((l,i)=>{const c=$(`#lead-${i}`);if(!c)return;const {ctx,w,h}=prepCanvas(c,105);grid(ctx,w,h,20);line(ctx,l.samples,w,h);});}
function renderMonitor(out){const n=out?.numerics||{}, bp=n.nibp||{};return `<div class="monitor-layout"><div class="monitor-wave"><canvas id="mon-ecg"></canvas><canvas id="mon-pleth"></canvas><canvas id="mon-etco2"></canvas></div><div class="monitor-num"><div>HR <b>${n.heartRateBpm??'--'}</b></div><div>SpO₂ <b>${n.spo2Pct??'--'}%</b></div><div>RR <b>${n.respRateBpm??'--'}</b></div><div>EtCO₂ <b>${n.etco2MmHg??'--'}</b></div><div>NIBP <b>${bp.systolic??'--'}/${bp.diastolic??'--'}</b></div><div>T <b>${n.temperatureC??'--'}℃</b></div></div></div>`;}
function drawMonitor(out){['mon-ecg','mon-pleth','mon-etco2'].forEach((id,i)=>{const c=$('#'+id);if(!c)return;const {ctx,w,h}=prepCanvas(c,115);grid(ctx,w,h,24);const wf=out?.waveforms?.[i];line(ctx,wf?.samples,w,h,['#62f59d','#66d9ff','#ffd166'][i]);});}
function renderCtg(out){return `<div class="ctg-summary">Baseline ${out?.summary?.baselineFhrBpm??'--'} bpm · variability ${out?.summary?.variability??'--'} · contractions ${out?.summary?.contractionsPer10Min??'--'}/10min</div><div class="ctg"><canvas id="ctg-fhr"></canvas><canvas id="ctg-toco"></canvas></div>`;}
function drawCtg(out){[['ctg-fhr',out?.fetalHeartRateBpm,100,200],['ctg-toco',out?.uterineActivityPct,0,100]].forEach(([id,s,min,max],i)=>{const c=$('#'+id);if(!c)return;const {ctx,w,h}=prepCanvas(c,150);ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#f4b0b0';for(let x=0;x<w;x+=25){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}for(let y=0;y<h;y+=25){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}line(ctx,s,w,h,i?'#2b5d85':'#9b1c31',min,max);});}
function renderSpiro(out){const m=out?.metrics||{};return `<div class="spiro-head"><div>FVC <b>${m.fvcL??'--'} L</b></div><div>FEV1 <b>${m.fev1L??'--'} L</b></div><div>FEV1/FVC <b>${m.fev1FvcPct??'--'}%</b></div><div>PEF <b>${m.pefLps??'--'} L/s</b></div></div><div class="hold">SOURCE-PORT HOLD: ${out?.sourcePort?.reason||'OpenSpirometer gate pending'}</div><div class="spiro-charts"><canvas id="spiro-vt"></canvas><canvas id="spiro-fv"></canvas></div>`;}
function drawSpiro(out){const vt=$('#spiro-vt'),fv=$('#spiro-fv');if(vt){const {ctx,w,h}=prepCanvas(vt,210);grid(ctx,w,h,28);line(ctx,(out?.curves?.volumeTime||[]).map(x=>x.volumeL),w,h,'#66d9ff',0,Math.max(5,out?.metrics?.fvcL||5));}if(fv){const {ctx,w,h}=prepCanvas(fv,210);grid(ctx,w,h,28);line(ctx,(out?.curves?.flowVolume||[]).map(x=>x.flowLps),w,h,'#ffd166',0,Math.max(10,out?.metrics?.pefLps||10));}}

function renderOsd(out){
  const url=out?.assetUrl;
  return `<div class="ext-viewer"><div class="viewer-toolbar"><span>OpenSeadragon · source-locked</span><button id="osdMinus">−</button><button id="osdHome">HOME</button><button id="osdPlus">＋</button></div><div id="osdViewer" class="osd-viewer"></div>${url?'':`<div class="viewer-error">CAPTURE 명령을 실행하세요.</div>`}</div>`;
}
function mountOsd(out){
  if(!out?.assetUrl||!window.OpenSeadragon)return;
  cleanupExternal();
  activeOsd=window.OpenSeadragon({id:'osdViewer',showNavigationControl:false,showNavigator:true,tileSources:{type:'image',url:out.assetUrl}});
  $('#osdMinus').onclick=()=>activeOsd.viewport.zoomBy(0.75);$('#osdPlus').onclick=()=>activeOsd.viewport.zoomBy(1.35);$('#osdHome').onclick=()=>activeOsd.viewport.goHome();
}
function renderVtk(out){
  return `<div class="ext-viewer"><div class="viewer-toolbar"><span>vtk.js STL · source-locked</span><button id="vtkReset">RESET CAMERA</button></div><div id="vtkViewer" class="vtk-viewer"></div>${out?.assetUrl?'':`<div class="viewer-error">ACQUIRE 명령을 실행하세요.</div>`}</div>`;
}
async function mountVtk(out){
  if(!out?.assetUrl||!window.vtk)return;
  cleanupExternal();
  const container=$('#vtkViewer'),vtk=window.vtk;
  const grw=vtk.Rendering.Misc.vtkGenericRenderWindow.newInstance({background:[0.055,0.07,0.09]});
  grw.setContainer(container);grw.resize();
  const reader=vtk.IO.Geometry.vtkSTLReader.newInstance();
  reader.parseAsArrayBuffer(await (await fetch(out.assetUrl)).arrayBuffer());
  const mapper=vtk.Rendering.Core.vtkMapper.newInstance(),actor=vtk.Rendering.Core.vtkActor.newInstance();
  mapper.setInputConnection(reader.getOutputPort());actor.setMapper(mapper);actor.getProperty().setColor(0.92,0.87,0.76);
  grw.getRenderer().addActor(actor);grw.getRenderer().resetCamera();grw.getRenderWindow().render();
  activeVtk=grw;$('#vtkReset').onclick=()=>{grw.getRenderer().resetCamera();grw.getRenderWindow().render();};
}
function renderSourceWaveform(out){
  const ch=out?.channels||[];
  return `<div class="source-wave-meta">${out?.runtimeEngine?.engine||'SOURCE-LOCKED'} · ${out?.sampleRateHz||'--'} Hz · ${out?.wfdbRecord?.recordName||''}</div><div class="source-wave-grid">${ch.slice(0,8).map((c,i)=>`<div class="source-wave"><span>${c.name}</span><canvas id="sw-${i}"></canvas></div>`).join('')}</div>`;
}
function drawSourceWaveform(out){
  (out?.channels||[]).slice(0,8).forEach((c,i)=>{const el=$(`#sw-${i}`);if(!el)return;const {ctx,w,h}=prepCanvas(el,90);grid(ctx,w,h,22);line(ctx,c.samples,w,h,'#66d9ff');});
}


function renderCameraPanel(out){
  const still=selected.generatorKind==='IMAGE';
  return `<div class="camera-panel ${still?'with-still':''}">
    <section class="camera-live">
      <div class="viewer-toolbar"><span>WebRTC · SYNTHETIC LOOPBACK · physical camera disabled</span></div>
      <div id="cameraVideoHost" class="camera-video-host"><div class="viewer-error">WebRTC synthetic stream starting…</div></div>
    </section>
    ${still?`<section class="camera-still"><div class="viewer-toolbar"><span>Captured still · OpenSeadragon</span><button id="osdMinus">−</button><button id="osdHome">HOME</button><button id="osdPlus">＋</button></div><div id="osdViewer" class="osd-viewer"></div><div id="cameraStillHint" class="viewer-error"${out?.assetUrl?' hidden':''}>CAPTURE 명령을 실행하면 정지영상이 표시됩니다.</div></section>`:`<section class="camera-video-meta"><div class="asset"><strong>Video runtime</strong><pre id="cameraVideoMeta">${JSON.stringify(out||{transport:'WEBRTC',streamMode:'SYNTHETIC_LOOPBACK',physicalCameraAccess:false},null,2)}</pre></div></section>`}
  </div>`;
}
function mountCameraStill(out){
  if(selected.generatorKind!=='IMAGE'||!out?.assetUrl||!window.OpenSeadragon)return;
  const hint=$('#cameraStillHint');if(hint)hint.hidden=true;
  if(activeOsd){
    activeOsd.open({type:'image',url:out.assetUrl});
  }else{
    activeOsd=window.OpenSeadragon({id:'osdViewer',showNavigationControl:false,showNavigator:true,tileSources:{type:'image',url:out.assetUrl}});
    $('#osdMinus').onclick=()=>activeOsd.viewport.zoomBy(0.75);
    $('#osdPlus').onclick=()=>activeOsd.viewport.zoomBy(1.35);
    $('#osdHome').onclick=()=>activeOsd.viewport.goHome();
  }
  activeCameraAssetUrl=out.assetUrl;
}
async function mountCameraPanel(out){
  try{
    activeCamera=await mountSyntheticCamera($('#cameraVideoHost'),selected.code,{width:960,height:540,fps:12});
    mountCameraStill(out);
  }catch(error){
    const host=$('#cameraVideoHost');if(host)host.innerHTML=`<div class="viewer-error">WebRTC runtime failed: ${error.message}</div>`;
  }
}
function updateCameraPanel(out){
  if(selected.generatorKind==='IMAGE'){
    if(out?.assetUrl&&out.assetUrl!==activeCameraAssetUrl)mountCameraStill(out);
  }else{
    const meta=$('#cameraVideoMeta');if(meta)meta.textContent=JSON.stringify(out||{},null,2);
  }
}


const DICOM_DEVICE_CODES=new Set(['CT_SCANNER','MRI_SCANNER','XRAY_FIXED_DR','XRAY_MOBILE_DR','MAMMOGRAPHY_SYSTEM','DENTAL_INTRAORAL_XRAY','DENTAL_PANORAMIC_XRAY','DENTAL_CBCT','ULTRASOUND_CART','ULTRASOUND_HANDHELD','OPHTHALMIC_OCT']);
function isDicomDevice(code){return DICOM_DEVICE_CODES.has(code)}
function renderDicomPanel(out){
 const conditional=out?.compatibility==='CONDITIONAL';
 return `<div class="dicom-panel"><div class="viewer-toolbar"><span>${out?.modality||'DICOM'} · ${out?.sopName||''}</span>${conditional?'<span class="badge">CONDITIONAL</span>':''}</div><div class="dicom-summary"><div><b>Study</b><code>${out?.studyInstanceUid||'CAPTURE 명령을 실행하세요.'}</code></div><div><b>SOP</b><code>${out?.sopClassUid||''}</code></div><div><b>Expected instances</b><code>${out?.expectedInstances??'--'}</code></div></div>${out?.viewerUrl?`<div class="dicom-actions"><a class="button-link" href="${out.viewerUrl}" target="_blank" rel="noopener">OHIF 열기</a><button id="dicomEmbedBtn">OHIF 패널 열기</button></div><div id="dicomViewerHost"></div>`:''}${out?.previewAssetUrl?`<div class="dicom-preview"><img src="${out.previewAssetUrl}" alt="synthetic preview"></div>`:''}</div>`;
}
function mountDicomPanel(out){const b=$('#dicomEmbedBtn'),host=$('#dicomViewerHost');if(b&&host)b.onclick=()=>{host.innerHTML=`<iframe class="ohif-frame" src="${out.viewerUrl}" title="OHIF Viewer"></iframe>`}}

function jsonCard(title,obj,cls='asset'){return `<div class="${cls}"><strong>${title}</strong><pre>${JSON.stringify(obj||{},null,2)}</pre></div>`}
function renderPanel(out){const rp=resultDisplayProfile(selected.code);$('#panelTitle').textContent=rp.screenTitle;$('#viewerBadge').innerHTML=selected.externalUi.kind==='NONE'?'':`<span class="badge">${selected.externalUi.kind}</span>`;const panel=$('#panel');if(selected.code==='ECG_12_LEAD'){panel.innerHTML=wrapSourceResult(selected.code,renderEcg12(out));requestAnimationFrame(()=>drawEcg12(out));return}if(selected.code==='MULTIPARAMETER_PATIENT_MONITOR'){panel.innerHTML=wrapSourceResult(selected.code,renderMonitor(out));requestAnimationFrame(()=>drawMonitor(out));return}if(selected.code==='CTG_MONITOR'){panel.innerHTML=wrapSourceResult(selected.code,renderCtg(out));requestAnimationFrame(()=>drawCtg(out));return}if(selected.code==='SPIROMETER'){panel.innerHTML=wrapSourceResult(selected.code,renderSpiro(out));requestAnimationFrame(()=>drawSpiro(out));return}if(isCameraDevice(selected.code)){if(!activeCamera||activeCamera.code!==selected.code||!$('#cameraVideoHost')){cleanupExternal();panel.innerHTML=wrapSourceResult(selected.code,renderCameraPanel(out));requestAnimationFrame(()=>mountCameraPanel(out));}else{updateCameraPanel(out)}return}if(isDicomDevice(selected.code)){panel.innerHTML=wrapSourceResult(selected.code,renderDicomPanel(out));requestAnimationFrame(()=>mountDicomPanel(out));return}if(resultDisplayProfile(selected.code).renderer==='CORNEAL_TOPOGRAPHY'){panel.innerHTML=renderSourcedResult(selected.code,out,instance);return}if(selected.externalUi.kind==='OPENSEADRAGON'){panel.innerHTML=wrapSourceResult(selected.code,renderOsd(out));requestAnimationFrame(()=>mountOsd(out));return}if(selected.code==='INTRAORAL_SCANNER'){panel.innerHTML=wrapSourceResult(selected.code,renderVtk(out));requestAnimationFrame(()=>mountVtk(out));return}if(['EEG_SYSTEM','EMG_NCS_SYSTEM','HOLTER_RECORDER'].includes(selected.code)){panel.innerHTML=wrapSourceResult(selected.code,renderSourceWaveform(out));requestAnimationFrame(()=>drawSourceWaveform(out));return}if(false&&selected.code==='CBC_ANALYZER'){}const detailed=renderSourcedResult(selected.code,out,instance);if(detailed){panel.innerHTML=detailed;return}const fam=selected.frontPanelFamily;if(fam==='THERAPEUTIC_ENERGY'){panel.innerHTML=`<div class="therapy"><div class="danger">SIMULATION ONLY — 물리 출력 경로 없음</div><p>Interlock: ${instance?.interlock}</p><p>실제 치료기 SDK/driver는 사용하지 않습니다.</p></div>`;return}if(fam==='WAVEFORM_DIAGNOSTIC'||fam==='CONTINUOUS_MONITOR'){panel.innerHTML='<div class="wave-wrap"><canvas id="wave"></canvas></div>';requestAnimationFrame(()=>{const c=$('#wave'),{ctx,w,h}=prepCanvas(c,240);grid(ctx,w,h);line(ctx,out?.channels?.[0]?.samples,w,h)});return}if(fam==='LAB_ANALYZER'){const vals=out?.values||{};panel.innerHTML=`<table class="lab-table">${Object.entries(vals).map(([k,v])=>`<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`;return}if(['IMAGING_CAPTURE','VIDEO_CAPTURE','AUDIO_CAPTURE','DICOM_MODALITY','THREE_D_SCANNER'].includes(fam)){panel.innerHTML=jsonCard(out?.kind||selected.generatorKind,out||{status:'아직 synthetic asset 생성 전'});return}const vals=out?.values||{};panel.innerHTML=`<div class="numeric-grid">${Object.entries(vals).map(([k,v])=>`<div class="metric"><div class="label">${k}</div><div class="value">${v}</div></div>`).join('')||'<div class="asset">측정 명령을 실행하세요.</div>'}</div>`;}
function connectStream(){if(stream)stream.close();stream=new EventSource(`/api/vdev2/instances/${instance.id}/stream`);stream.addEventListener('telemetry',(e)=>{lastOutput=JSON.parse(e.data);renderPanel(lastOutput)});}
async function refreshEvents(){const r=await api(`/api/vdev2/instances/${instance.id}/events`);$('#events').textContent=JSON.stringify(r.items.slice(-12).reverse(),null,2)}
$('#createBtn').onclick=createInstance;$('#search').oninput=renderList;$('#category').onchange=renderList;const boot=await api('/api/vdev2/devices');catalog=boot.items;sourceGate=await api('/api/vdev2/source-lock/status');$('#category').innerHTML+=categories().map(c=>`<option value="${c}">${c}</option>`).join('');renderList();
const requestedDevice=integrationQuery.get('device');
if(requestedDevice&&catalog.some(d=>d.code===requestedDevice)){
  await selectDevice(requestedDevice);
  if(integrationQuery.get('autocreate')==='1')await createInstance();
}
