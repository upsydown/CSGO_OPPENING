// Nouvelle version — ordonner fenêtres, Start All, balance grise / rate verte, insert position
(() => {
  const libPathsToTry = ['./CSGO_OPENNING/index.json','./CSGO_OPPENING/index.json'];
  const STATE_KEY = 'knife_bank_state_v1';

  let library = []; // { name, path }
  let windows = []; // {id,name,slots:[{name,path,value}]}
  let balance = 0;

  // earning state
  let earningInterval = null;
  let earningMode = null; // null | {type:'single', id} | {type:'all'}
  let perWindowStats = {}; // id -> {earned: number, elapsed: number}

  function qsa(sel, root=document) { return Array.from((root||document).querySelectorAll(sel)); }
  function escapeHtml(s){ return String(s||'').replace(/[&<>"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

  function saveState(){ try { localStorage.setItem(STATE_KEY, JSON.stringify({windows,library,balance})); } catch(e){} }
  function loadState(){ try { const s = localStorage.getItem(STATE_KEY); if (s) { const obj = JSON.parse(s); windows = obj.windows || []; library = obj.library || []; balance = obj.balance || 0; } } catch(e){} }

  async function tryLoadIndex(){
    for (const p of libPathsToTry){
      try {
        const r = await fetch(p,{cache:'no-store'});
        if (!r.ok) continue;
        const json = await r.json();
        if (!Array.isArray(json)) continue;
        json.forEach(it => {
          if (!it) return;
          if (typeof it === 'string') library.push({ name: it.split('/').pop(), path: it });
          else if (it.path) library.push({ name: it.name || it.path.split('/').pop(), path: it.path });
        });
        return;
      } catch(e){ /* ignore */ }
    }
  }

  function mount(){
    loadState();
    // remove left sidebar to free space (user requested)
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.remove();

    ensureTopControls();
    renderHeaderBalance(0);
    renderSidebar(); // still populates banks-list if present, but sidebar removed so safe
    // Prepare canvas as responsive container
    const canvas = document.getElementById('canvas');
    if (canvas){
      canvas.style.display = 'flex';
      canvas.style.flexWrap = 'wrap';
      canvas.style.justifyContent = 'flex-start';
      canvas.style.gap = '12px';
    }
    renderAllPreviews();
  }

  // ensure global controls exist (NEW + Start All + Reset + Simulate)
  function ensureTopControls(){
    const controls = document.querySelector('.controls');
    if (!controls) return;
    // NEW button
    if (!document.getElementById('btn-new')){
      const btn = document.createElement('button'); btn.id='btn-new'; btn.className='btn btn-new'; btn.textContent='NEW';
      controls.appendChild(btn);
      btn.addEventListener('click', () => openCreateModal());
    } else {
      document.getElementById('btn-new').addEventListener('click', () => openCreateModal());
    }
    // Start All
    if (!document.getElementById('btn-start-all')){
      const btnAll = document.createElement('button'); btnAll.id='btn-start-all'; btnAll.className='btn'; btnAll.textContent='Start All';
      controls.appendChild(btnAll);
      btnAll.addEventListener('click', () => {
        if (earningMode && earningMode.type === 'all') stopEarning();
        else startEarning({ type: 'all' });
      });
    }
    // Stop All
    if (!document.getElementById('btn-stop-all')){
      const btnStopAll = document.createElement('button'); btnStopAll.id='btn-stop-all'; btnStopAll.className='btn'; btnStopAll.textContent='Stop All';
      controls.appendChild(btnStopAll);
      btnStopAll.addEventListener('click', () => stopEarning());
    }
    // Reset (reset per-window counters and stop)
    if (!document.getElementById('btn-reset')){
      const btnReset = document.createElement('button'); btnReset.id='btn-reset'; btnReset.className='btn'; btnReset.textContent='Reset';
      controls.appendChild(btnReset);
      btnReset.addEventListener('click', () => {
        if (!confirm('Arrêter et remettre à zéro les compteurs par fenêtre ? (le solde reste inchangé)')) return;
        stopEarning();
        Object.keys(perWindowStats).forEach(k => { perWindowStats[k].earned = 0; perWindowStats[k].elapsed = 0; });
        // ensure entries exist for all windows
        windows.forEach(w => { perWindowStats[w.id] = { earned:0, elapsed:0 }; });
        renderAllPreviews();
        saveState();
      });
    }
    // Simulate duration (fast-forward)
    if (!document.getElementById('btn-simulate')){
      const btnSim = document.createElement('button'); btnSim.id='btn-simulate'; btnSim.className='btn'; btnSim.textContent='Simuler durée';
      controls.appendChild(btnSim);
      btnSim.addEventListener('click', () => {
        const raw = prompt('Entrer la durée à simuler en secondes (ex: 3600 pour 1h) :', '60');
        if (!raw) return;
        const secs = Math.max(0, Math.floor(Number(String(raw).replace(',', '.')) || 0));
        if (secs <= 0) { alert('Durée invalide'); return; }
        simulateDuration(secs);
      });
    }
  }

  /* Header balance display */
  function renderHeaderBalance(currentRate=0){
    const topbar = document.querySelector('.topbar');
    if (!topbar) return;
    let bd = document.getElementById('balance-display');
    if (!bd) {
      bd = document.createElement('div');
      bd.id = 'balance-display';
      bd.style.display='flex';
      bd.style.flexDirection='column';
      bd.style.alignItems='flex-end';
      bd.style.gap='2px';
      bd.style.minWidth='220px';
      topbar.appendChild(bd);
    }
    updateBalanceDisplay(currentRate);
  }

  function formatMoney(n){ return `${Math.round((n + Number.EPSILON)*100)/100}`; }

  // Balance in muted (gris); rate shown separately in green where needed
  function updateBalanceDisplay(currentRate=0){
    const bd = document.getElementById('balance-display');
    if (!bd) return;
    bd.innerHTML = `<div style="font-weight:700;color:var(--muted);font-size:16px">${formatMoney(balance)} coins</div>
                    <div style="font-size:13px;color:var(--muted)">Total général: <span style="color:var(--accent);font-weight:800;font-size:16px">${currentRate}</span>/s</div>`;
  }

  /* Sidebar (kept function but sidebar element removed) */
  function renderSidebar(){
    const list = document.getElementById('banks-list');
    if (!list) return;
    list.innerHTML = '';
    if (windows.length === 0){
      list.innerHTML = `<div style="color:var(--muted);font-size:13px">Aucune fenêtre. Clique NEW.</div>`;
      return;
    }
    windows.forEach((w, idx) => {
      const div = document.createElement('div');
      div.className = 'bank-card-small';
      const thumb = document.createElement('div');
      if (w.slots[0] && w.slots[0].path) thumb.innerHTML = `<img src="${w.slots[0].path}" alt="">`;
      else thumb.innerHTML = `<div style="width:44px;height:28px;background:rgba(255,255,255,0.03);border-radius:4px"></div>`;
      const meta = document.createElement('div'); meta.className = 'meta';
      meta.innerHTML = `<strong style="display:block">${escapeHtml(w.name)}</strong><span style="font-size:12px;color:var(--muted)">${w.slots.filter(s=>s.path).length}/5 rempl.</span>`;
      const actions = document.createElement('div'); actions.className = 'actions';
      const btnOpen = document.createElement('button'); btnOpen.className='btn small-btn'; btnOpen.textContent='Afficher';
      btnOpen.addEventListener('click', () => {
        renderAllPreviews();
        const el = document.querySelector(`[data-winid="${w.id}"]`);
        if (el) el.scrollIntoView({behavior:'smooth', block:'center'});
      });
      const btnUp = document.createElement('button'); btnUp.className='btn small-btn'; btnUp.textContent='↑';
      btnUp.addEventListener('click', () => moveWindow(w.id, -1));
      const btnDown = document.createElement('button'); btnDown.className='btn small-btn'; btnDown.textContent='↓';
      btnDown.addEventListener('click', () => moveWindow(w.id, +1));
      const btnDel = document.createElement('button'); btnDel.className='btn small-btn'; btnDel.textContent='Suppr';
      btnDel.addEventListener('click', () => { if(confirm('Supprimer cette fenêtre ?')) { windows = windows.filter(x=>x.id!==w.id); saveState(); renderSidebar(); renderAllPreviews(); } });
      actions.appendChild(btnOpen); actions.appendChild(btnUp); actions.appendChild(btnDown); actions.appendChild(btnDel);
      div.appendChild(thumb); div.appendChild(meta); div.appendChild(actions);
      list.appendChild(div);
    });
  }

  function moveWindow(id, delta){
    const idx = windows.findIndex(w => w.id === id);
    if (idx === -1) return;
    const newIdx = Math.max(0, Math.min(windows.length-1, idx + delta));
    if (newIdx === idx) return;
    const [win] = windows.splice(idx,1);
    windows.splice(newIdx,0,win);
    saveState();
    renderSidebar();
    renderAllPreviews();
  }

  // ranking helpers
  function computeTop3Ids(){
    const arr = windows.map(w => ({ id: w.id, rate: (w.slots||[]).reduce((a,s)=>a + (parseFloat(s.value)||0), 0) }));
    arr.sort((a,b) => b.rate - a.rate);
    return arr.slice(0,3).map(x => x.id);
  }
  function applyRankingStyles(topIds){
    // colors
    const colors = {
      [0]: '#D4AF37', // gold
      [1]: '#C0C0C0', // silver
      [2]: '#CD7F32'  // bronze
    };
    windows.forEach((w, i) => {
      const el = document.querySelector(`[data-winid="${w.id}"]`);
      if (!el) return;
      const rank = topIds.indexOf(w.id);
      if (rank === 0) {
        el.style.border = `2px solid ${colors[0]}`;
        el.style.boxShadow = `0 6px 18px ${colors[0]}33`;
      } else if (rank === 1) {
        el.style.border = `2px solid ${colors[1]}`;
        el.style.boxShadow = `0 6px 18px ${colors[1]}33`;
      } else if (rank === 2) {
        el.style.border = `2px solid ${colors[2]}`;
        el.style.boxShadow = `0 6px 18px ${colors[2]}33`;
      } else {
        el.style.border = '1px solid rgba(255,255,255,0.02)';
        el.style.boxShadow = 'none';
      }
    });
  }

  /* Render all previews in order — previews wider so 5 images readably visible */
  function renderAllPreviews(){
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    canvas.innerHTML = '';
    if (windows.length === 0){
      const big = document.createElement('div');
      big.style.width = '100%';
      big.style.maxWidth = '1000px';
      big.style.minHeight = '360px';
      big.style.borderRadius = '12px';
      big.style.border = '2px dashed rgba(255,255,255,0.04)';
      big.style.display = 'flex';
      big.style.flexDirection = 'column';
      big.style.alignItems = 'center';
      big.style.justifyContent = 'center';
      big.style.gap = '12px';
      big.innerHTML = `<div style="font-size:18px;font-weight:700">Aucune fenêtre</div>
                       <div style="color:var(--muted);max-width:800px;text-align:center">Clique sur <strong style="color:var(--accent)">NEW</strong> pour créer une fenêtre avec 5 emplacements. Chaque emplacement peut contenir une image de couteau et une valeur (ex: 7/s).</div>`;
      canvas.appendChild(big);
      updateBalanceDisplay(0);
      return;
    }

    // compute global total rate for header
    const globalRate = windows.reduce((sum,w) => sum + (w.slots || []).reduce((a,s)=> a + (parseFloat(s.value)||0), 0), 0);
    updateBalanceDisplay(globalRate);

    windows.forEach(w => {
      const node = document.createElement('div'); node.className = 'side-preview'; node.dataset.winid = w.id;
      node.style.flex = '0 0 100%';
      node.style.maxWidth = '100%';
      node.style.boxSizing = 'border-box';
      node.style.marginBottom = '12px';

      // header row with name, per-window rate (green and larger), earned & controls
      const header = document.createElement('div'); header.className = 'preview-header';
      const nameEl = document.createElement('div'); nameEl.innerHTML = `<strong>${escapeHtml(w.name)}</strong>`;
      const statsWrap = document.createElement('div'); statsWrap.className = 'preview-stats';
      const rateEl = document.createElement('div'); rateEl.className = 'preview-rate'; rateEl.id = `preview-rate-${w.id}`;
      rateEl.style.fontSize = '20px';
      rateEl.style.fontWeight = '900';
      rateEl.style.color = 'var(--accent)';
      const earnedEl = document.createElement('div'); earnedEl.className = 'earned-ticker'; earnedEl.id = `preview-earned-${w.id}`;
      const controls = document.createElement('div');
      const btnStart = document.createElement('button'); btnStart.className='btn small-btn'; btnStart.textContent='Start';
      const btnStop = document.createElement('button'); btnStop.className='btn small-btn'; btnStop.textContent='Stop';
      const btnEdit = document.createElement('button'); btnEdit.className='btn small-btn'; btnEdit.textContent='Edit';
      const btnRemove = document.createElement('button'); btnRemove.className='btn small-btn'; btnRemove.textContent='Suppr';
      btnStart.addEventListener('click', () => startEarning({ type:'single', id: w.id }));
      btnStop.addEventListener('click', () => stopEarning());
      btnEdit.addEventListener('click', () => openCreateModal(w));
      btnRemove.addEventListener('click', () => { if(confirm('Supprimer cette fenêtre ?')) { windows = windows.filter(x=>x.id!==w.id); saveState(); renderSidebar(); renderAllPreviews(); } });
      controls.appendChild(btnStart); controls.appendChild(btnStop); controls.appendChild(btnEdit); controls.appendChild(btnRemove);

      statsWrap.appendChild(rateEl);
      statsWrap.appendChild(earnedEl);
      header.appendChild(nameEl);
      header.appendChild(statsWrap);
      header.appendChild(controls);
      node.appendChild(header);

      // slots row — taille augmentée pour rendu visuel plus agréable
      const slotsRow = document.createElement('div'); slotsRow.className = 'slots-row';
      slotsRow.style.overflowX = 'auto';
      slotsRow.style.paddingBottom = '6px';
      slotsRow.style.gap = '12px';
      for (let i=0;i<5;i++){
        const s = (w.slots && w.slots[i]) ? w.slots[i] : {path:null,name:'',value:0};
        const slotEl = document.createElement('div'); slotEl.className = 'slot-large';
        // taille agrandie : largeur ~180px, hauteur ~140px (image area + overlay + caption)
        slotEl.style.flex = '0 0 180px';
        slotEl.style.height = '140px';
        slotEl.style.minWidth = '180px';
        slotEl.style.display = 'flex';
        slotEl.style.flexDirection = 'column';
        slotEl.style.alignItems = 'stretch';
        slotEl.style.justifyContent = 'flex-start';
        slotEl.style.padding = '8px';
        slotEl.style.boxSizing = 'border-box';

        if (s && s.path){
          const imgWrap = document.createElement('div');
          imgWrap.style.position = 'relative';
          imgWrap.style.width = '100%';
          imgWrap.style.height = '110px'; // image area, espace pour overlay
          imgWrap.style.overflow = 'hidden';
          imgWrap.style.borderRadius = '8px';
          const img = document.createElement('img');
          img.src = s.path; img.alt = s.name || '';
          img.style.width = '100%'; img.style.height = '100%'; img.style.objectFit = 'cover';
          imgWrap.appendChild(img);
          // overlay bottom (blanc, gras, discret mais lisible)
          const overlay = document.createElement('div');
          overlay.style.position = 'absolute';
          overlay.style.left = '8px';
          overlay.style.right = '8px';
          overlay.style.bottom = '8px';
          overlay.style.padding = '6px 8px';
          overlay.style.textAlign = 'center';
          overlay.style.color = '#fff';
          overlay.style.fontWeight = '800';
          overlay.style.fontSize = '14px';
          overlay.style.background = 'linear-gradient(180deg, rgba(0,0,0,0.0), rgba(0,0,0,0.6))';
          overlay.style.borderRadius = '6px';
          overlay.textContent = `${s.value || 0}/s`;
          imgWrap.appendChild(overlay);
          slotEl.appendChild(imgWrap);

          // petit espace pour légende (vide car nom retiré)
          const caption = document.createElement('div');
          caption.style.marginTop = '6px';
          caption.style.height = '18px';
          caption.style.fontSize = '12px';
          caption.style.color = 'rgba(255,255,255,0.95)';
          caption.style.fontWeight = '700';
          caption.textContent = ''; // nom retiré
          slotEl.appendChild(caption);
        } else {
          const empty = document.createElement('div'); empty.style.color='var(--muted)'; empty.textContent='vide';
          empty.style.marginTop = '48px';
          empty.style.fontSize = '13px';
          slotEl.appendChild(empty);
        }
        slotsRow.appendChild(slotEl);
      }
      node.appendChild(slotsRow);

      canvas.appendChild(node);

      // initialize per-window stats if missing
      if (!perWindowStats[w.id]) perWindowStats[w.id] = { earned: 0, elapsed: 0 };
      // update rate & earned displays
      const rate = (w.slots || []).reduce((acc,s) => acc + (parseFloat(s.value) || 0), 0);
      const rateElDom = document.getElementById(`preview-rate-${w.id}`);
      const earnedElDom = document.getElementById(`preview-earned-${w.id}`);
      if (rateElDom) rateElDom.textContent = `${rate}/s`;
      if (earnedElDom) earnedElDom.textContent = `Gagné: ${Math.round((perWindowStats[w.id].earned + Number.EPSILON)*100)/100}`;
    });

    // apply ranking styles (gold/silver/bronze)
    const topIds = computeTop3Ids();
    applyRankingStyles(topIds);
  }

  /* Earnings engine: unified tick for 'single' or 'all' */
  function startEarning(mode){
    if (!mode) return;
    // reset per-window earned/elapsed when starting a new mode
    Object.keys(perWindowStats).forEach(k => { perWindowStats[k].earned = 0; perWindowStats[k].elapsed = 0; });
    earningMode = mode;
    if (earningInterval) clearInterval(earningInterval);
    // immediate update then every second
    tickEarning();
    earningInterval = setInterval(tickEarning, 1000);
  }

  function tickEarning(){
    if (!earningMode) return;
    if (earningMode.type === 'single'){
      const w = windows.find(x=>x.id===earningMode.id);
      if (!w) return stopEarning();
      const rate = (w.slots || []).reduce((acc,s) => acc + (parseFloat(s.value) || 0), 0);
      balance = (parseFloat(balance) || 0) + rate;
      perWindowStats[w.id].earned += rate;
      perWindowStats[w.id].elapsed += 1;
      // update displays
      updateBalanceDisplay(rate);
      updatePreviewForWindow(w.id, rate);
    } else if (earningMode.type === 'all'){
      // sum rates and add
      let totalRate = 0;
      windows.forEach(w => {
        const r = (w.slots || []).reduce((acc,s) => acc + (parseFloat(s.value) || 0), 0);
        totalRate += r;
        if (!perWindowStats[w.id]) perWindowStats[w.id] = { earned:0, elapsed:0 };
        perWindowStats[w.id].earned += r;
        perWindowStats[w.id].elapsed += 1;
      });
      balance = (parseFloat(balance) || 0) + totalRate;
      // update header and each preview
      updateBalanceDisplay(totalRate);
      windows.forEach(w => updatePreviewForWindow(w.id));
    }
    // update ranking visuals on each tick
    const topIds = computeTop3Ids();
    applyRankingStyles(topIds);

    saveState();
  }

  function stopEarning(){
    if (earningInterval) { clearInterval(earningInterval); earningInterval = null; }
    earningMode = null;
    updateBalanceDisplay(0);
    windows.forEach(w => updatePreviewForWindow(w.id));
  }

  function updatePreviewForWindow(id, lastRate){
    const w = windows.find(x=>x.id===id);
    if (!w) return;
    const rate = (w.slots || []).reduce((acc,s) => acc + (parseFloat(s.value) || 0), 0);
    const rateEl = document.getElementById(`preview-rate-${id}`);
    const earnedEl = document.getElementById(`preview-earned-${id}`);
    if (rateEl) rateEl.innerHTML = `<span style="color:var(--accent);font-weight:900;font-size:20px">${rate}</span>/s`;
    if (earnedEl) earnedEl.textContent = `Gagné: ${Math.round((perWindowStats[id]?.earned || 0 + Number.EPSILON)*100)/100}`;
    const globalRate = windows.reduce((sum,w) => sum + (w.slots || []).reduce((a,s)=> a + (parseFloat(s.value)||0), 0), 0);
    updateBalanceDisplay(globalRate);
  }

  // simulate a duration (secs): apply earnings as if that many seconds passed
  function simulateDuration(secs){
    if (!Number.isFinite(secs) || secs <= 0) return;
    // ensure perWindowStats exists
    windows.forEach(w => { if (!perWindowStats[w.id]) perWindowStats[w.id] = { earned:0, elapsed:0 }; });
    let totalAdded = 0;
    windows.forEach(w => {
      const rate = (w.slots || []).reduce((acc,s) => acc + (parseFloat(s.value) || 0), 0);
      const added = rate * secs;
      perWindowStats[w.id].earned += added;
      perWindowStats[w.id].elapsed += secs;
      totalAdded += added;
    });
    balance = (parseFloat(balance) || 0) + totalAdded;
    // update displays and ranking
    renderAllPreviews();
    updateBalanceDisplay(windows.reduce((sum,w) => sum + (w.slots || []).reduce((a,s)=> a + (parseFloat(s.value)||0), 0), 0));
    const topIds = computeTop3Ids();
    applyRankingStyles(topIds);
    saveState();
    alert(`Simulation : ${secs} secondes simulées. +${Math.round((totalAdded+Number.EPSILON)*100)/100} coins`);
  }

  /* Create / Edit modal with position select (unchanged) */
  async function openCreateModal(editWin){
    if (library.length === 0) await tryLoadIndex();

    const modal = document.createElement('div'); modal.className='modal-backdrop';
    const inner = document.createElement('div'); inner.className='modal';
    // position select options (1..windows.length+1)
    let posOptions = '';
    for (let i=1;i<=windows.length+1;i++) posOptions += `<option value="${i}">${i}</option>`;
    inner.innerHTML = `
      <div class="header">
        <h2>${editWin ? 'Modifier fenêtre' : 'Nouvelle fenêtre'}</h2>
        <div class="top-actions">
          <input id="win-name" placeholder="Nom de la fenêtre" style="padding:8px;border-radius:8px;background:transparent;border:1px solid rgba(255,255,255,0.04);color:inherit;" />
          <select id="win-pos" style="padding:8px;border-radius:8px;background:transparent;border:1px solid rgba(255,255,255,0.04);color:inherit;">${posOptions}</select>
          <button id="btn-cancel" class="btn small-btn">Annuler</button>
        </div>
      </div>
      <div class="grid" id="slots-grid"></div>
      <div style="margin-top:12px;display:flex;justify-content:flex-end;gap:8px;">
        <button id="btn-validate" class="btn small-btn">Valider</button>
      </div>
      <div class="footer-note">Tu peux aussi ajouter des images via "Ajouter images" dans la bibliothèque.</div>
    `;
    modal.appendChild(inner);
    document.body.appendChild(modal);

    const slotsGrid = inner.querySelector('#slots-grid');
    const slots = editWin ? JSON.parse(JSON.stringify(editWin.slots)) : Array.from({length:5}).map(()=>({name:'',path:'',value:0}));

    function renderSlots(){
      slotsGrid.innerHTML = '';
      slots.forEach((s,i) => {
        const el = document.createElement('div'); el.className='slot'; el.dataset.idx = i;
        if (s.path) el.innerHTML = `<img src="${s.path}" alt=""><div class="label">${escapeHtml(s.name||'')} - ${s.value||0}/s</div>`;
        else el.innerHTML = `<div class="slot-empty">+</div><div class="label">vide</div>`;
        el.addEventListener('click', () => openLibraryChooser(i, (picked) => {
          slots[i] = { name: picked.name || picked.path.split('/').pop(), path: picked.path, value: picked.value || 0 };
          renderSlots();
        }));
        slotsGrid.appendChild(el);
      });
    }
    renderSlots();

    // upload button in modal (small library add)
    const addBtn = document.createElement('button'); addBtn.className='btn small-btn'; addBtn.textContent='Ajouter images';
    addBtn.addEventListener('click', () => {
      const inp = document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.multiple=true;
      inp.addEventListener('change', (ev) => {
        const files = Array.from(ev.target.files || []);
        let loaded = 0;
        files.forEach(f => {
          const r = new FileReader();
          r.onload = (ev2) => {
            library.unshift({ name: f.name, path: ev2.target.result });
            loaded++;
            if (loaded === files.length) { saveState(); }
          };
          r.readAsDataURL(f);
        });
      });
      inp.click();
    });
    inner.querySelector('.header .top-actions').prepend(addBtn);

    inner.querySelector('#btn-cancel').addEventListener('click', () => { modal.remove(); });

    inner.querySelector('#btn-validate').addEventListener('click', () => {
      const nameInput = inner.querySelector('#win-name');
      const posSelect = inner.querySelector('#win-pos');
      const name = (nameInput.value || `Fenêtre ${windows.length+1}`).trim();
      const id = editWin ? editWin.id : Date.now();
      const winObj = { id, name, slots };
      if (editWin) {
        const idx = windows.findIndex(w => w.id === id);
        if (idx !== -1) windows.splice(idx,1);
        const insertAt = Math.max(0, Math.min(windows.length, (parseInt(posSelect.value,10) - 1)));
        windows.splice(insertAt,0,winObj);
      } else {
        const insertAt = Math.max(0, Math.min(windows.length, (parseInt(posSelect.value,10) - 1)));
        windows.splice(insertAt,0,winObj);
      }
      saveState();
      renderSidebar();
      renderAllPreviews();
      modal.remove();
    });

    if (editWin){
      inner.querySelector('#win-name').value = editWin.name || '';
      const curIndex = windows.findIndex(w => w.id === editWin.id);
      if (curIndex >= 0 && inner.querySelector('#win-pos')) inner.querySelector('#win-pos').value = (curIndex+1).toString();
    } else {
      inner.querySelector('#win-pos').value = (windows.length+1).toString();
    }

    inner.querySelector('#win-name').focus();

    modal.addEventListener('click', (e) => { if (e.target === modal) { modal.remove(); } });
  }

  /* Library chooser modal for selecting one image for a slot + set value */
  function openLibraryChooser(slotIndex, onPick){
    const chooser = document.createElement('div'); chooser.className='modal-backdrop';
    const inner = document.createElement('div'); inner.className='modal';
    inner.innerHTML = `
      <div class="header">
        <h2>Choisir une image</h2>
        <div class="top-actions">
          <input id="lib-search" placeholder="Rechercher..." style="padding:8px;border-radius:8px;background:transparent;border:1px solid rgba(255,255,255,0.04);color:inherit;" />
          <button id="lib-add" class="btn small-btn">Ajouter images</button>
          <button id="lib-close" class="btn small-btn">Fermer</button>
        </div>
      </div>
      <div class="library" id="lib-list"></div>
    `;
    chooser.appendChild(inner);
    document.body.appendChild(chooser);

    const libList = inner.querySelector('#lib-list');
    function refreshLib(){
      libList.innerHTML = '';
      library.forEach((it, idx) => {
        const b = document.createElement('div'); b.className='lib-item'; b.dataset.idx=idx;
        b.innerHTML = `<img src="${it.path}" alt=""><div class="iname">${escapeHtml(it.name)}</div>`;
        b.addEventListener('click', () => {
          let val = prompt(`Valeur par seconde pour "${it.name}" (nombre, ex: 7) :`, "0");
          if (val === null) return;
          val = parseFloat(String(val).replace(',', '.'));
          if (isNaN(val)) val = 0;
          const picked = { name: it.name, path: it.path, value: val };
          onPick(picked);
          chooser.remove();
        });
        libList.appendChild(b);
      });
      if (library.length===0) libList.innerHTML = `<div style="color:var(--muted)">Aucune image trouvée. Ajoute des images via "Ajouter images".</div>`;
    }
    refreshLib();

    inner.querySelector('#lib-search').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      qsa('.lib-item', libList).forEach(el => {
        const name = (el.querySelector('.iname')?.textContent || '').toLowerCase();
        el.style.display = name.includes(q) ? '' : 'none';
      });
    });

    inner.querySelector('#lib-add').addEventListener('click', () => {
      const inp = document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.multiple=true;
      inp.addEventListener('change', (ev) => {
        const files = Array.from(ev.target.files || []);
        let loaded=0;
        files.forEach(f => {
          const r=new FileReader();
          r.onload = (ev2) => {
            library.unshift({ name: f.name, path: ev2.target.result });
            loaded++; if (loaded===files.length){ saveState(); refreshLib(); }
          };
          r.readAsDataURL(f);
        });
      });
      inp.click();
    });

    inner.querySelector('#lib-close').addEventListener('click', () => chooser.remove());
    chooser.addEventListener('click', (e)=>{ if (e.target===chooser) chooser.remove(); });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await tryLoadIndex();
    loadState();
    mount();
  });

  // Instructions:
  // - Place an index.json listing relative paths to your .pngs (example in project root):
  //   ["CSGO_OPPENING/knife1.png","CSGO_OPPENING/knife2.png",...]
  // - Or use "Ajouter images" to upload from your PC (images deviennent disponibles dans le sélecteur).
})();