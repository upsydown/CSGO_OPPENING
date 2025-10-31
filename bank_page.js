// Nouvelle version — banques 5 emplacements + sélection d'image en cliquant sur la case
(() => {
  const STORAGE_KEY = "my_banks_v1_work";
  const LIB_KEY = "knife_library_v1";
  const USE_PERSISTENCE = false;

  function makePlaceholder(color, label = "") {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='160' viewBox='0 0 320 160'><rect rx='12' width='320' height='160' fill='${color}'/><text x='160' y='86' font-family='Arial,Helvetica,sans-serif' font-size='18' fill='white' text-anchor='middle' font-weight='700'>${label}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  const INITIAL_LIBRARY = [
    { name: "placeholder-1", dataUrl: makePlaceholder("#7c3aed") },
    { name: "placeholder-2", dataUrl: makePlaceholder("#a78bfa") }
  ];

  function makeEmptySlots() { return { images: Array(5).fill(null), knifeName: Array(5).fill(null) }; }

  const defaultBanks = [
    { id: Date.now() + 1, name: "Banque principale", items: 12, closed: false, ...makeEmptySlots() },
    { id: Date.now() + 2, name: "Banque secondaire", items: 5, closed: false, ...makeEmptySlots() }
  ];

  let banks = USE_PERSISTENCE ? JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || defaultBanks.slice() : defaultBanks.slice();
  let knifeLibrary = USE_PERSISTENCE ? JSON.parse(localStorage.getItem(LIB_KEY) || "null") || INITIAL_LIBRARY.slice() : INITIAL_LIBRARY.slice();

  function save() {
    if (!USE_PERSISTENCE) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(banks));
    localStorage.setItem(LIB_KEY, JSON.stringify(knifeLibrary));
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c])); }

  // load external list ./knives/index.json (optional)
  async function loadExternalIndex() {
    try {
      const res = await fetch('./knives/index.json', { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      if (!Array.isArray(json)) return;
      const external = json.map(it => {
        if (!it) return null;
        if (typeof it === 'string') return { name: it.split('/').pop(), dataUrl: it };
        if (typeof it === 'object' && it.path) return { name: it.name || it.path.split('/').pop(), dataUrl: it.path };
        return null;
      }).filter(Boolean);
      if (external.length) {
        const existing = new Set(knifeLibrary.map(k => k.dataUrl));
        external.reverse().forEach(item => { if (!existing.has(item.dataUrl)) knifeLibrary.unshift(item); });
      }
    } catch (e) {
      console.warn('No external knives index or failed to load ./knives/index.json', e);
    }
  }

  // render banks
  function render() {
    const list = document.getElementById('bank-list');
    if (!list) return;
    if (banks.length === 0) { list.innerHTML = `<div class="toast">Aucune banque. Crée-en une !</div>`; return; }
    list.innerHTML = banks.map(b => {
      const slotsHtml = Array.from({ length: 5 }).map((_, i) => {
        const img = b.images[i];
        const name = b.knifeName[i];
        return `
          <div class="slot" data-id="${b.id}" data-slot="${i}">
            <div class="slot-thumb" data-id="${b.id}" data-slot="${i}" role="button" tabindex="0">${ img ? `<img src="${img}" alt="${escapeHtml(b.name)}-${i}" />` : `<div class="slot-empty">+</div>` }</div>
            <div class="slot-controls">
              <button class="btn small choose-knife" data-id="${b.id}" data-slot="${i}">${ name ? escapeHtml(name) : "Choisir couteau" }</button>
              <button class="btn small clear-slot" data-id="${b.id}" data-slot="${i}">Effacer</button>
            </div>
          </div>`;
      }).join('');
      return `
        <div class="bank-card ${b.closed ? "closed" : ""}" data-id="${b.id}">
          <div class="card-top">
            <div class="title-area">
              <div class="title">${escapeHtml(b.name)}</div>
              <div class="meta">${b.items} éléments • ${b.closed ? "fermée" : "ouverte"}</div>
            </div>
            <div class="actions">
              <button class="btn toggle">${b.closed ? "Réouvrir" : "Fermer"}</button>
              <button class="btn ghost export">Exporter</button>
              <button class="btn danger delete">Supprimer</button>
            </div>
          </div>
          <div class="slots">${slotsHtml}</div>
        </div>`;
    }).join('');

    const headerArea = document.querySelector('.wrap > h1');
    if (headerArea && !document.getElementById('open-library')) {
      const btn = document.createElement('button');
      btn.id = 'open-library';
      btn.className = 'btn ghost';
      btn.style.marginLeft = '12px';
      btn.textContent = 'Gérer la bibliothèque';
      headerArea.insertAdjacentElement('afterend', btn);
      btn.addEventListener('click', openLibraryModal);
    }
  }

  // dropdown UI
  let dropdownEl = null;
  function ensureDropdown() {
    if (dropdownEl) return dropdownEl;
    dropdownEl = document.createElement('div');
    dropdownEl.className = 'knife-dropdown';
    dropdownEl.style.position = 'absolute';
    dropdownEl.style.display = 'none';
    dropdownEl.style.zIndex = 9999;
    dropdownEl.innerHTML = `
      <div style="padding:6px;"><input type="search" class="knife-search" placeholder="Rechercher..." style="width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.04);background:transparent;color:inherit;" /></div>
      <div class="knife-list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;max-height:360px;overflow:auto;padding:8px;"></div>
    `;
    document.body.appendChild(dropdownEl);

    const searchEl = dropdownEl.querySelector('.knife-search');
    const listEl = dropdownEl.querySelector('.knife-list');

    searchEl.addEventListener('input', () => {
      const q = searchEl.value.trim().toLowerCase();
      Array.from(listEl.children).forEach(it => {
        const name = (it.dataset.name || "").toLowerCase();
        it.style.display = q === "" || name.includes(q) ? "" : "none";
      });
      listEl.scrollTop = 0;
    });

    listEl.addEventListener('click', (ev) => {
      const it = ev.target.closest('.knife-item');
      if (!it || !dropdownEl._target) return;
      const idx = Number(it.dataset.idx);
      const asset = knifeLibrary[idx];
      if (!asset) return;
      const { bankId, slot } = dropdownEl._target;
      selectKnife(bankId, slot, asset);
      hideDropdown();
    });

    document.addEventListener('click', (e) => {
      if (!dropdownEl) return;
      if (!dropdownEl.contains(e.target) && !e.target.closest('.slot-thumb') && !e.target.closest('.choose-knife')) hideDropdown();
    });

    return dropdownEl;
  }

  function populateDropdown() {
    const dd = ensureDropdown();
    const listEl = dd.querySelector('.knife-list');
    listEl.innerHTML = knifeLibrary.map((a, idx) => `
      <button class="knife-item" data-idx="${idx}" data-name="${escapeHtml(a.name || '')}" style="padding:6px;border-radius:8px;border:1px solid rgba(255,255,255,0.03);background:transparent;">
        <img src="${a.dataUrl}" alt="${escapeHtml(a.name || '')}" style="width:100%;height:84px;object-fit:cover;border-radius:6px;display:block" />
      </button>
    `).join('');
  }

  function showDropdown(anchorEl, bankId, slot) {
    populateDropdown();
    const dd = ensureDropdown();
    dd._target = { bankId, slot };
    const rect = anchorEl.getBoundingClientRect();
    const width = Math.min(520, window.innerWidth - 24);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    dd.style.width = width + 'px';
    dd.style.left = left + 'px';
    dd.style.top = (rect.bottom + 8 + window.scrollY) + 'px';
    dd.style.display = 'block';
    const search = dd.querySelector('.knife-search'); if (search) search.value = '';
  }

  function hideDropdown() {
    if (!dropdownEl) return;
    dropdownEl.style.display = 'none';
    dropdownEl._target = null;
  }

  function selectKnife(bankId, slot, asset) {
    const idx = banks.findIndex(b => b.id === bankId);
    if (idx === -1) return;
    banks[idx].images[slot] = asset.dataUrl;
    banks[idx].knifeName[slot] = asset.name || '';
    save();
    render();
  }

  // Library modal (upload only)
  function openLibraryModal() {
    const modal = document.createElement('div');
    modal.className = 'knife-modal';
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.background = 'rgba(0,0,0,0.6)';
    modal.style.zIndex = 10000;

    const sheet = document.createElement('div');
    sheet.style.width = 'min(920px,96%)';
    sheet.style.maxHeight = '86vh';
    sheet.style.overflow = 'auto';
    sheet.style.padding = '16px';
    sheet.style.borderRadius = '12px';
    sheet.style.background = 'linear-gradient(180deg, rgba(18,3,23,0.98), rgba(43,11,59,0.98))';
    sheet.style.border = '1px solid rgba(167,139,250,0.12)';

    sheet.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;">
        <h3 style="margin:0;color:var(--accent)">Bibliothèque — images locales</h3>
        <div style="display:flex;gap:8px;align-items:center;">
          <input id="lib-upload" type="file" accept="image/*" multiple style="display:none" />
          <button id="lib-add" class="btn">Ajouter images (depuis PC)</button>
          <button id="lib-close" class="btn ghost">Fermer</button>
        </div>
      </div>
      <div style="margin-bottom:8px;"><small style="color:var(--muted)">Tu peux aussi lister des images présentes dans le projet via ./knives/index.json (chemins relatifs). Sinon upload depuis PC.</small></div>
      <div class="lib-list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;"></div>
    `;
    modal.appendChild(sheet);
    document.body.appendChild(modal);

    const libList = sheet.querySelector('.lib-list');
    function refreshLibList() {
      libList.innerHTML = knifeLibrary.map((a, idx) => `
        <div class="lib-item" data-idx="${idx}" style="background:rgba(255,255,255,0.02);padding:8px;border-radius:8px;position:relative;">
          <img src="${a.dataUrl}" style="width:100%;height:88px;object-fit:cover;border-radius:6px;display:block" alt="${escapeHtml(a.name || '')}">
          <div style="margin-top:6px;font-size:13px;color:var(--muted);display:flex;justify-content:space-between;align-items:center;">
            <span class="lib-name">${escapeHtml(a.name || '')}</span>
          </div>
          <div style="position:absolute;top:6px;right:6px;display:flex;gap:6px">
            <button class="btn small lib-delete" data-idx="${idx}">Suppr</button>
          </div>
        </div>
      `).join('');
    }
    refreshLibList();

    const libUpload = sheet.querySelector('#lib-upload');
    sheet.querySelector('#lib-add').addEventListener('click', () => libUpload.click());
    libUpload.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      let loaded = 0;
      files.forEach((f) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const name = f.name || `img-${knifeLibrary.length+1}`;
          knifeLibrary.unshift({ name, dataUrl: ev.target.result });
          loaded++;
          if (loaded === files.length) {
            save();
            refreshLibList();
            populateDropdown();
            render();
          }
        };
        reader.readAsDataURL(f);
      });
    });

    libList.addEventListener('click', (ev) => {
      const del = ev.target.closest('.lib-delete');
      if (!del) return;
      const idx = Number(del.dataset.idx);
      if (!confirm('Supprimer cette image de la bibliothèque ?')) return;
      knifeLibrary.splice(idx, 1);
      save();
      refreshLibList();
      populateDropdown();
      render();
    });

    sheet.querySelector('#lib-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  }

  // handlers: open dropdown by clicking thumb or choose-knife
  function attachHandlers() {
    const list = document.getElementById('bank-list');
    if (!list) return;

    list.addEventListener('click', (ev) => {
      const thumb = ev.target.closest('.slot-thumb');
      if (thumb) {
        // open selection dropdown anchored to the thumb
        const slotEl = thumb.closest('.slot');
        const bankId = Number(slotEl.dataset.id);
        const slot = Number(slotEl.dataset.slot);
        showDropdown(thumb, bankId, slot);
        return;
      }

      const choose = ev.target.closest('.choose-knife');
      if (choose) { showDropdown(choose, Number(choose.dataset.id), Number(choose.dataset.slot)); return; }

      const clearBtn = ev.target.closest('.clear-slot');
      if (clearBtn) {
        const bankId = Number(clearBtn.dataset.id), slot = Number(clearBtn.dataset.slot);
        const idx = banks.findIndex(b => b.id === bankId); if (idx === -1) return;
        banks[idx].images[slot] = null; banks[idx].knifeName[slot] = null; save(); render(); return;
      }

      const btnClose = ev.target.closest('.delete');
      if (btnClose) { const id = Number(ev.target.closest('.bank-card').dataset.id); if (confirm(`Supprimer "${getBankName(id)}" définitivement ?`)) deleteBank(id); return; }

      const closeBtn = ev.target.closest('.close-btn');
      if (closeBtn) { const id = Number(ev.target.closest('.bank-card').dataset.id); if (!confirm(`Fermer la banque "${getBankName(id)}" ?`)) return; toggleClose(id); return; }

      const btn = ev.target.closest('button');
      if (btn && btn.classList.contains('toggle')) { const id = Number(ev.target.closest('.bank-card').dataset.id); toggleClose(id); return; }
    });

    const addBtn = document.getElementById('add-btn');
    const input = document.getElementById('new-name');
    if (addBtn && input) {
      addBtn.addEventListener('click', () => { addBank(input.value); input.value = ''; });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { addBank(input.value); input.value = ''; }});
    }

    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (!confirm('Remettre l\'état à l\'initial ?')) return;
        banks = defaultBanks.map(b => ({ ...b, ...makeEmptySlots() }));
        if (USE_PERSISTENCE) { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(LIB_KEY); }
        save(); render();
      });
    }
  }

  function getBankName(id) { const b = banks.find(x => x.id === id); return b ? b.name : 'la banque'; }
  function toggleClose(id) { const idx = banks.findIndex(b => b.id === id); if (idx === -1) return; banks[idx].closed = !banks[idx].closed; save(); render(); }
  function deleteBank(id) { banks = banks.filter(b => b.id !== id); save(); render(); }
  function addBank(name) { if (!name || !name.trim()) return; banks.unshift({ id: Date.now(), name: name.trim(), items: 0, closed: false, ...makeEmptySlots() }); save(); render(); }

  document.addEventListener('DOMContentLoaded', async () => {
    await loadExternalIndex();
    render();
    attachHandlers();
  });
})();