// Rewritten single-file script
// Keeps the UI simple and exposes a few global helpers for programmatic population.

(function(){
  const grid = document.getElementById('grid');
  const weaponNameEl = document.getElementById('weaponName');
  const previewImg = document.getElementById('previewImg');
  const basePriceEl = document.getElementById('basePrice');
  const multiplierEl = document.getElementById('multiplier');
  const resultPriceEl = document.getElementById('resultPrice');
  const conditionsRoot = document.getElementById('conditions');
  const stattrakCheckbox = document.getElementById('stattrakCheckbox');
  const caseSelect = document.getElementById('caseSelect');
  const thumbGamma = document.getElementById('thumbGamma');
  const thumbRevolver = document.getElementById('thumbRevolver');
  const caseTitleEl = document.getElementById('caseTitle');
  const sortSelect = document.getElementById('sortSelect');
  const blueGemSection = document.getElementById('blueGemSection');
  const blueGemRange = document.getElementById('blueGemRange');
  const blueGemValue = document.getElementById('blueGemValue');
  const blueGemEnable = document.getElementById('blueGemEnable');
  if(blueGemRange && blueGemValue){
    // display mapped initial value (slider is normalized 0..1000 and mapped by mapBlueGemSlider)
    const mappedInitial = typeof mapBlueGemSlider === 'function' ? mapBlueGemSlider(Number(blueGemRange.value)) : Number(blueGemRange.value);
    blueGemValue.textContent = (Number.isFinite(mappedInitial) ? mappedInitial.toFixed(2) : String(mappedInitial)) + '×';
  }
  if(blueGemEnable){ blueGemEnable.checked = false; }
  // ensure range is disabled until enabled
  if(blueGemRange) blueGemRange.disabled = true;
  if(blueGemSection) blueGemSection.classList.add('disabled');

  const CONDITION_MULT = { BS:1.0, WW:1.3, FT:2.0, MW:2.6, FN:3.3 };
  const STATTRAK_MULT = 2.5;

  // --- very soft click sound (gentle pok) ---
  let _audioCtx = null;
  function ensureAudio(){
    if(_audioCtx) return _audioCtx;
    try{
      const C = window.AudioContext || window.webkitAudioContext;
      _audioCtx = new C();
    }catch(e){ _audioCtx = null; }
    return _audioCtx;
  }

  function playSoftClick(){
    const ctx = ensureAudio();
    if(!ctx) return;
    try{
      if(ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      // gentle, not piercing
      osc.frequency.value = 600;
      const gain = ctx.createGain();
      // very low peak so it's barely audible
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.006, now + 0.006); // tiny attack
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07); // quick decay
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    }catch(e){ /* ignore audio errors */ }
  }

  // Play on left-clicks including buttons/checkboxes (user requested)
  document.addEventListener('click', (ev)=>{
    try{
      if(typeof ev.button === 'number' && ev.button !== 0) return; // only left button
      playSoftClick();
    }catch(e){ /* swallow */ }
  }, {passive:true});

  let framesData = new Array(30).fill(null).map(()=>({ name:null, img:null, basePrice:null, condition:null, stattrak:false, lastFinal:null }));
  let activeFrameIndex = null;
  let selectedCondition = null;
  let currentBoxName = 'Gamma 2 Case';
  const boxes = {};

  function formatPriceUSD(v){
    if(v===null||v===undefined) return '—';
    const n = Number(v);
    if(Number.isNaN(n)) return '—';
    // format integer part with spaces as thousand separators, keep two decimals
    const parts = n.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return '$' + parts.join('.');
  }

  function renderGrid(count=30){ if(!grid) return; grid.innerHTML=''; for(let i=0;i<count;i++){ const frame=document.createElement('div'); frame.className='frame'; frame.dataset.index=i; const thumb=document.createElement('div'); thumb.className='thumb'; thumb.textContent='Cadre '+(i+1); const ov=document.createElement('div'); ov.className='price-overlay'; ov.textContent=''; frame.appendChild(thumb); frame.appendChild(ov); frame.addEventListener('click', ()=> onFrameClick(i, frame)); grid.appendChild(frame); } }

  function onFrameClick(i, el){ document.querySelectorAll('.frame').forEach(f=>f.classList.remove('active')); el.classList.add('active'); activeFrameIndex = i; const fd = framesData[i] || {}; selectedCondition = fd.condition || null; if(stattrakCheckbox) stattrakCheckbox.checked = !!fd.stattrak; updatePreview(); }

  

  function setFrameData(i, { name=null, img=null, basePrice=null, condition=null, stattrak=false }={}){
  if(i<0||i>=framesData.length) return;
  framesData[i].name = name;
  framesData[i].img = img;
  framesData[i].basePrice = basePrice;
  if(condition!==undefined && condition!==null) framesData[i].condition = condition;
 	framesData[i].stattrak = !!stattrak;

 	const frame = document.querySelector(`.frame[data-index="${i}"]`);
 	if(!frame) return;

 	const thumb = frame.querySelector('.thumb');
 	thumb.textContent = '';

 	// attach image if available (tries png/jpg/webp)
 	if(img){
 		const exts = ['png','jpg','webp'];
 		let attached = false;
 		for(const ext of exts){
 			const im = new Image();
 			im.src = `${img}.${ext}`;
 			im.alt = name||'';
 			im.onload = ()=>{ if(!attached){ thumb.textContent = ''; im.className = 'frame-img'; thumb.appendChild(im); attached = true; } };
 		}
 		setTimeout(()=>{ if(!thumb.querySelector('img')) thumb.textContent = name||''; },600);
 	} else {
 		thumb.textContent = name||'';
 	}

 	// price overlay
 	const ov = frame.querySelector('.price-overlay');
 	if(ov) ov.textContent = (basePrice!=null)?formatPriceUSD(basePrice):'';

 	// title overlay (ensure it's present)
 	let titleOv = frame.querySelector('.title-overlay');
 	if(!titleOv){ titleOv = document.createElement('div'); titleOv.className = 'title-overlay'; frame.appendChild(titleOv); }
 	titleOv.textContent = name||'';
  }

  function setPreviewImage(imgBase, name){ if(!previewImg) return; previewImg.textContent=''; if(!imgBase){ previewImg.textContent = name||'Aperçu'; return; } const exts=['png','jpg','webp']; let attached=false; for(const ext of exts){ const im=new Image(); im.src=`${imgBase}.${ext}`; im.alt=name||''; im.onload=()=>{ if(!attached){ previewImg.textContent=''; im.className='preview-img-el'; previewImg.appendChild(im); attached=true; } }; } setTimeout(()=>{ if(!previewImg.querySelector('img')) previewImg.textContent = name||'Aperçu'; },600); }

  function computeMultiplier(){ let m=1.0; if(selectedCondition && CONDITION_MULT[selectedCondition]) m=CONDITION_MULT[selectedCondition]; if(stattrakCheckbox && stattrakCheckbox.checked) m *= STATTRAK_MULT; return m; }
  function computeMultiplierForFrame(i){ const fd = framesData[i] || {}; const cond = fd.condition || selectedCondition; let m=1.0; if(cond && CONDITION_MULT[cond]) m=CONDITION_MULT[cond]; if(fd.stattrak) m *= STATTRAK_MULT; return m; }

  // extended multiplier: apply blue-gem multiplier to names/images containing 'case_hardened' (only relevant for Revolver Case)
  function computeExtendedMultiplierForFrame(i){ const baseMul = computeMultiplierForFrame(i); const fd = framesData[i] || {}; let ext = 1.0; if(currentBoxName === 'Revolver Case'){
    // get slider mapped value (slider is normalized 0-1000 -> mapped non-linear for fine control)
    const gemMul = (blueGemEnable && !blueGemEnable.checked) ? 1.0 : (blueGemRange ? mapBlueGemSlider(parseFloat(blueGemRange.value)) : 28.5);
    const name = String(fd.name||'').toLowerCase();
    const img = String(fd.img||'').toLowerCase();
    if(name.includes('case hardened') || img.includes('case_hardened')){
      ext = gemMul;
    }
  }
  return baseMul * ext;
  }

  // Map the normalized slider (0..1000) into the requested non-linear multiplier range
  // with an ease-in exponent so the start of the slider moves slowly (fine control)
  // and the end accelerates. We allocate 75% of track to the low band (28.5..200)
  // and 25% to the high band (2300..5120.24), easing inside each band.
  function mapBlueGemSlider(norm){
    const n = Math.max(0, Math.min(1000, Number(norm || 0)));
    const EASE = 2.5; // >1 => ease-in (slow at start, faster later)
    const lowMax = 749;
    const highMax = 1000;
    // Low band: 28.5 -> 200 across 0..lowMax
    if(n <= lowMax){
      const t = Math.pow(n / lowMax, EASE); // eased 0..1
      return 28.5 + t * (200 - 28.5);
    }
    // High band: continuous from 200 -> 5120.24 across (lowMax..highMax)
    const t = Math.pow((n - lowMax) / (highMax - lowMax), EASE);
    return 200 + t * (5120.24 - 200);
  }

  // Returns true if Blue Gemmes control should apply to frame index i
  function isBlueGemApplicable(i){ if(!framesData[i]) return false; if(currentBoxName !== 'Revolver Case') return false; const fd = framesData[i]; const name = String(fd.name||'').toLowerCase(); const img = String(fd.img||'').toLowerCase(); return name.includes('case hardened') || img.includes('case_hardened'); }

  function updateFrameOverlay(i){ const fd=framesData[i]; const frame=document.querySelector(`.frame[data-index="${i}"]`); if(!frame) return; const ov=frame.querySelector('.price-overlay'); ov.textContent = (fd && fd.basePrice!=null)?formatPriceUSD(fd.basePrice):''; }

  function animateNumber(from,to,duration,onUpdate,onComplete){ const start=performance.now(); const diff=to-from; function step(now){ const t=Math.min(1,(now-start)/duration); const v=from+diff*t; onUpdate(v); if(t<1) requestAnimationFrame(step); else if(onComplete) onComplete(); } requestAnimationFrame(step); }

  function updatePreview(){
    let base = 0;
    if(activeFrameIndex!==null && framesData[activeFrameIndex] && framesData[activeFrameIndex].basePrice!=null) base = framesData[activeFrameIndex].basePrice;
    if(basePriceEl) basePriceEl.textContent = formatPriceUSD(base);
    // use extended multiplier (includes blue-gem when relevant)
    const mul = (activeFrameIndex!==null) ? computeExtendedMultiplierForFrame(activeFrameIndex) : computeMultiplier();
    if(multiplierEl) multiplierEl.textContent = mul.toFixed(2);
    const result = (base||0)*mul;
    if(resultPriceEl) resultPriceEl.textContent = formatPriceUSD(result);
    const name = (activeFrameIndex!==null && framesData[activeFrameIndex] && framesData[activeFrameIndex].name) || 'Aucune arme sélectionnée';
    if(weaponNameEl) weaponNameEl.textContent = name;
    const previewBase = (activeFrameIndex!==null && framesData[activeFrameIndex] && framesData[activeFrameIndex].img) ? framesData[activeFrameIndex].img : null;
    setPreviewImage(previewBase, name);
    if(activeFrameIndex!==null) updateFrameOverlay(activeFrameIndex);
    updateFinalLarge();
    // show/hide Blue Gemmes control only when the selected frame is applicable
    if(blueGemSection){
      const show = (activeFrameIndex!==null) && isBlueGemApplicable(activeFrameIndex);
      blueGemSection.style.display = show ? 'block' : 'none';
      // dim the value when disabled
      if(blueGemValue) blueGemValue.style.opacity = (show && blueGemEnable && blueGemEnable.checked) ? '1' : '0.5';
    }
  }

  // replace updateFinalLarge usage to include blue gem multiplier
  function updateFinalLarge(){ const el=document.getElementById('finalLargeValue'); if(!el) return; if(activeFrameIndex===null){ el.textContent='—'; return; } const fd=framesData[activeFrameIndex]; const base=(fd && fd.basePrice!=null)?fd.basePrice:0; const mul = computeExtendedMultiplierForFrame(activeFrameIndex); const finalP=(base||0)*mul; const prev=(fd && typeof fd.lastFinal==='number')?fd.lastFinal:null; if(prev===null){ el.textContent = formatPriceUSD(finalP); const small=document.getElementById('resultPrice'); if(small) small.textContent = formatPriceUSD(finalP); } else { animateNumber(prev, finalP, 400, (v)=>{ el.textContent = formatPriceUSD(v); const small=document.getElementById('resultPrice'); if(small) small.textContent = formatPriceUSD(v); }); } if(prev!==null){ const small=document.getElementById('resultPrice'); if(finalP>prev){ el.classList.add('price-up'); if(small) small.classList.add('price-up'); setTimeout(()=>{ el.classList.remove('price-up'); if(small) small.classList.remove('price-up'); },700); } else if(finalP<prev){ el.classList.add('price-down'); if(small) small.classList.add('price-down'); setTimeout(()=>{ el.classList.remove('price-down'); if(small) small.classList.remove('price-down'); },700); } } if(fd) fd.lastFinal = finalP; }

  const CONDITIONS = ['BS','WW','FT','MW','FN'];
  function renderConditions(){ if(!conditionsRoot) return; conditionsRoot.innerHTML=''; CONDITIONS.forEach(c=>{ const b=document.createElement('button'); b.className='cond-btn'; b.textContent=c; b.addEventListener('click', ()=>{ if(selectedCondition===c) selectedCondition=null; else selectedCondition=c; if(activeFrameIndex!==null) framesData[activeFrameIndex].condition = selectedCondition; updatePreview(); }); conditionsRoot.appendChild(b); }); }

  function renderConditions(){
    if(!conditionsRoot) return;
    conditionsRoot.innerHTML = '';
    CONDITIONS.forEach(c=>{
      const b = document.createElement('button');
      b.className = 'cond-btn';
      b.textContent = c;
      b.addEventListener('click', ()=>{
        if(selectedCondition === c) {
          selectedCondition = null;
        } else {
          selectedCondition = c;
        }
        // update active classes
        conditionsRoot.querySelectorAll('.cond-btn').forEach(btn=>btn.classList.remove('active'));
        if(selectedCondition) {
          const activeBtn = Array.from(conditionsRoot.querySelectorAll('.cond-btn')).find(x=>x.textContent===selectedCondition);
          if(activeBtn) activeBtn.classList.add('active');
        }
        if(activeFrameIndex!==null) framesData[activeFrameIndex].condition = selectedCondition;
        updatePreview();
      });
      conditionsRoot.appendChild(b);
    });
  }

  if(stattrakCheckbox) stattrakCheckbox.addEventListener('change', ()=>{ const val = stattrakCheckbox.checked; if(activeFrameIndex!==null){ framesData[activeFrameIndex].stattrak = val; updateFrameOverlay(activeFrameIndex); } updateFinalLarge(); });

  function prefillGamma2(){ renderGrid(30); const pre=[
	['BAYONET | Gamma Doppler','bayonet_gamma_doppler',491.46],['BAYONET | Autotronic','bayonet_autotronic',431.25],['BAYONET | Black Laminate','bayonet_black_laminate',300.42],['BAYONET | Bright Water','bayonet_bright_water',146.70],['BAYONET | Freehand','bayonet_freehand',430.00],['BAYONET | Lore','bayonet_lore',339.43],['FLIPKNIFE | Autotronic','flipknife_autotronic',252.90],['FLIPKNIFE | Black Laminate','flipknife_black_laminate',187.50],['FLIPKNIFE | Bright Water','flipknife_bright_water',105.70],['FLIPKNIFE | Freehand','flipknife_freehand',105.46],['FLIPKNIFE | Gamma Doppler','flipknife_gamma_doppler',504.50],['FLIPKNIFE | Lore','flipknife_lore',233.01],['GUTKNIFE | Autotronic','gutknife_autotronic',132.97],['GUTKNIFE | Black Laminate','gutknife_black_laminate',85.48],['GUTKNIFE | Bright Water','gutknife_bright_water',61.22],['GUTKNIFE | Freehand','gutknife_freehand',80.88],['GUTKNIFE | Gamma Doppler','gutknife_gamma_doppler',226.00],['GUTKNIFE | Lore','gutknife_lore',116.65],['KARAMBIT | Autotronic','karambit_autotronic',210.10],['KARAMBIT | Black Laminate','karambit_black_laminate',632.49],['KARAMBIT | Bright Water','karambit_bright_water',520.19],['KARAMBIT | Freehand','karambit_freehand',618.41],['KARAMBIT | Gamma Doppler','karambit_gamma_doppler',360.40],['KARAMBIT | Lore','karambit_lore',516.90],['M9 BAYONET | Autotronic','M9bayonet_autotronic',631.01],['M9 BAYONET | Black Laminate','M9bayonet_black_laminate',511.93],['M9 BAYONET | Bright Water','M9bayonet_bright_water',480.17],['M9 BAYONET | Freehand','M9bayonet_freehand',416.22],['M9 BAYONET | Gamma Doppler','M9bayonet_gamma_doppler',210.93],['M9 BAYONET | Lore','M9bayonet_lore',475.97]
  ]; for(let i=0;i<pre.length;i++){ const [n,img,p]=pre[i]; setFrameData(i,{ name:n, img:img, basePrice:p, condition:'BS' }); } boxes['Gamma 2 Case'] = framesData.map(f=>({ ...f })); }

  function buildRevolver(){
    // Reinitialized Revolver Case with the 65 items provided by the user (prices null where X)
    const revolverList = [
      ['bayonet_blue_steel',183.34],
      ['bayonet_boreal_forest',269.33],
      ['bayonet_case_hardened',303.42],
      ['bayonet_classic',220.21],
      ['bayonet_crimson_web',246.43],
      ['bayonet_fade',351.37],
      ['bayonet_forest_DDPAT',111.17],
      ['bayonet_night',335.74],
      ['bayonet_safari_mesh',150.6],
      ['bayonet_scorched',122.33],
      ['bayonet_slaughter',283.17],
      ['bayonet_stained',207.41],
      ['bayonet_urban_masked',138.76],

      ['flipknife_blue_steel',132.56],
      ['flipknife_boreal_forest',119.98],
      ['flipknife_case_hardened',182.13],
      ['flipknife_classic',175.03],
      ['flipknife_crimson_web',221.63],
      ['flipknife_fade',285.85],
      ['flipknife_forest_DDPAT',105.36],
      ['flipknife_night',278.22],
      ['flipknife_safari_mesh',106.75],
      ['flipknife_scorched',120.74],
      ['flipknife_slaughter',216.19],
      ['flipknife_stained',154.79],
      ['flipknife_urban_masked',102.60],

      ['gutknife_blue_steel',85.4],
      ['gutknife_boreal_forest',61.44],
      ['gutknife_case_hardened',78.06],
      ['gutknife_classic',54.1],
      ['gutknife_crimson_web',78.39],
      ['gutknife_fade',126.91],
      ['gutknife_forest_DDPAT',84.01],
      ['gutknife_night',210.80],
      ['gutknife_safari_mesh',147.09],
      ['gutknife_scorched',76.14],
      ['gutknife_slaughter',91.21],
      ['gutknife_stained',102.46],
      ['gutknife_urban_masked',69.11],

      ['karambit_blue_steel',624.19],
      ['karambit_boreal_forest',540.72],
      ['karambit_case_hardened',606.26],
      ['karambit_classic',300.37],
      ['karambit_crimson_web',519.04],
      ['karambit_fade',405.47],
      ['karambit_forest_DDPAT',419.38],
      ['karambit_night',420.05],
      ['karambit_safari_mesh',473.17],
      ['karambit_scorched',464.2],
      ['karambit_slaughter',345.76],
      ['karambit_stained',627.17],
      ['karambit_urban_masked',472.13],

      ['M9bayonet_blue_steel',540.47],
      ['M9bayonet_boreal_forest',322.18],
      ['M9bayonet_case_hardened',390.22],
      ['M9bayonet_classic',210.26],
      ['M9bayonet_crimson_web',387.18],
      ['M9bayonet_fade',300.68],
      ['M9bayonet_forest_DDPAT',323.18],
      ['M9bayonet_night',387.99],
      ['M9bayonet_safari_mesh',334.63],
      ['M9bayonet_scorched',371.24],
      ['M9bayonet_slaughter',608.06],
      ['M9bayonet_stained',506.68],
      ['M9bayonet_urban_masked',299.05]
    ];

    // ensure framesData has enough slots
    framesData = new Array(revolverList.length).fill(null).map(()=>({ name:null, img:null, basePrice:null, condition:null, stattrak:false, lastFinal:null }));

    boxes['Revolver Case'] = revolverList.map(([img,price])=>({ name: img.replace(/_/g,' ').toUpperCase(), img, basePrice: price, condition:null, stattrak:false, lastFinal:null }));
  }

  function wireCaseSelector(){
    // hide select if present
    if(caseSelect){ caseSelect.style.display = 'none'; }
    if(caseTitleEl) caseTitleEl.textContent = currentBoxName;

    const switchTo = (name)=>{
      boxes[currentBoxName] = framesData.map(f=>({ ...f }));
      currentBoxName = name;
      if(caseTitleEl) caseTitleEl.textContent = currentBoxName;
      loadBox(currentBoxName);
      // highlight active thumb
      document.querySelectorAll('.case-thumb').forEach(t=>t.classList.remove('active'));
      const sel = (name==='Gamma 2 Case') ? thumbGamma : thumbRevolver;
      if(sel) sel.classList.add('active');
    };

    if(thumbGamma) thumbGamma.addEventListener('click', ()=> switchTo('Gamma 2 Case'));
    if(thumbRevolver) thumbRevolver.addEventListener('click', ()=> switchTo('Revolver Case'));

    // initial highlight
    if(currentBoxName==='Gamma 2 Case' && thumbGamma) thumbGamma.classList.add('active');
    if(currentBoxName==='Revolver Case' && thumbRevolver) thumbRevolver.classList.add('active');
    // show/hide blue gem section depending on current box
    const toggleBlueGemVisibility = ()=>{
      if(blueGemSection) blueGemSection.style.display = (currentBoxName==='Revolver Case') ? 'block' : 'none';
    };
    toggleBlueGemVisibility();
    // ensure toggle happens on switch
    const originalSwitch = switchTo;
    // we already call toggle in switchTo via loadBox, so also call here after switch
    if(thumbGamma) thumbGamma.addEventListener('click', ()=> setTimeout(toggleBlueGemVisibility,50));
    if(thumbRevolver) thumbRevolver.addEventListener('click', ()=> setTimeout(toggleBlueGemVisibility,50));
  }

  if(blueGemRange){
    blueGemRange.addEventListener('input', ()=>{
      const mapped = mapBlueGemSlider(Number(blueGemRange.value));
      if(blueGemValue) blueGemValue.textContent = mapped.toFixed(2) + '×';
      // refresh displayed final price for selected frame
      updatePreview();
    });
  }

  if(blueGemEnable){
    blueGemEnable.addEventListener('change', ()=>{
      // when toggled, update display and recalc
      const enabled = !!blueGemEnable.checked;
      if(blueGemValue) blueGemValue.style.opacity = enabled ? '1' : '0.35';
      if(blueGemRange) blueGemRange.disabled = !enabled;
      if(blueGemSection){
        blueGemSection.classList.toggle('disabled', !enabled);
      }
      updatePreview();
    });
    // set initial visual opacity to indicate disabled
    if(blueGemValue) blueGemValue.style.opacity = '0.35';
    if(blueGemSection) blueGemSection.classList.add('disabled');
  }

  function loadBox(name){ const data = boxes[name]; if(!data) return; framesData = data.map(f=>({ ...f })); renderGrid(framesData.length); for(let i=0;i<framesData.length;i++){ const f=framesData[i]; setFrameData(i,{ name:f.name||null, img:f.img||null, basePrice:f.basePrice, condition:f.condition||null, stattrak:!!f.stattrak }); } activeFrameIndex=null; updatePreview(); }



  if(sortSelect) sortSelect.addEventListener('change',(e)=>{ const mode=e.target.value||'default'; if(mode==='default'){ if(boxes[currentBoxName]){ framesData = boxes[currentBoxName].map(f=>({ ...f })); renderGrid(framesData.length); for(let i=0;i<framesData.length;i++){ const f=framesData[i]; setFrameData(i,{ name:f.name, img:f.img, basePrice:f.basePrice, condition:f.condition, stattrak:f.stattrak }); } activeFrameIndex=null; updatePreview(); } } else if(mode==='group-pattern' || mode==='group-pattern-alpha'){
    // group by skin name pattern: e.g. items containing 'fade', 'case hardened', 'lore', etc.
    const patterns = ['fade','case hardened','lore','gamma doppler','bright water','crimson web','black laminate','blue steel','stained','slaughter','scorched','safari mesh','urban masked','autotronic','freehand','forest ddpat','night','safari mesh'];
    const normalize = s=>String(s||'').toLowerCase();
    const buckets = {};
    framesData.forEach(item=>{
      const keyCandidates = patterns.filter(p=> normalize(item.name).includes(p));
      const key = keyCandidates.length? keyCandidates[0] : 'zzz-other';
      if(!buckets[key]) buckets[key]=[];
      buckets[key].push(item);
    });
    let keys = Object.keys(buckets);
    if(mode==='group-pattern-alpha') keys = keys.sort();
    else {
      // try to order known patterns in a friendly way
      keys = patterns.filter(p=>keys.includes(p)).concat(keys.filter(k=>!patterns.includes(k)));
    }
    const newList = [];
    keys.forEach(k=>{ newList.push(...buckets[k]); });
    framesData = newList.map(n=>({ ...n }));
    renderGrid(framesData.length);
    for(let i=0;i<framesData.length;i++){ const f=framesData[i]; setFrameData(i,{ name:f.name, img:f.img, basePrice:f.basePrice, condition:f.condition, stattrak:f.stattrak }); }
    activeFrameIndex=null; updatePreview();
  } else { const arr=framesData.map((d,i)=>({i,d})); if(mode==='price-asc') arr.sort((a,b)=>((a.d.basePrice||0)-(b.d.basePrice||0))); else if(mode==='price-desc') arr.sort((a,b)=>((b.d.basePrice||0)-(a.d.basePrice||0))); else if(mode==='name-asc') arr.sort((a,b)=>String(a.d.name||'').localeCompare(String(b.d.name||''))); else if(mode==='name-desc') arr.sort((a,b)=>String(b.d.name||'').localeCompare(String(a.d.name||''))); for(let pos=0; pos<arr.length; pos++) framesData[pos] = { ...arr[pos].d }; renderGrid(framesData.length); for(let i=0;i<framesData.length;i++){ const f=framesData[i]; setFrameData(i,{ name:f.name, img:f.img, basePrice:f.basePrice, condition:f.condition, stattrak:f.stattrak }); } activeFrameIndex=null; updatePreview(); } });

  // expose API
  window.setFrameData = setFrameData;
  window.loadBox = loadBox;
  window.framesData = framesData;

  // init
  renderConditions(); prefillGamma2(); buildRevolver(); wireCaseSelector(); renderGrid(framesData.length); loadBox('Gamma 2 Case'); updatePreview();

})();
