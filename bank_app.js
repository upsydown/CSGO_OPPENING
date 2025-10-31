const STORAGE_KEY = "my_banks_v1";

// Mettre à false pour ne pas persister : à chaque reload on repart du state par défaut
const USE_PERSISTENCE = false;

const defaultBanks = [
  { id: Date.now() + 1, name: "Banque principale", items: 12, closed: false },
  { id: Date.now() + 2, name: "Banque secondaire", items: 5, closed: false },
];

// si la persistence est désactivée, on utilise une copie du defaultBanks à chaque chargement
let banks = USE_PERSISTENCE
  ? JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || defaultBanks.slice()
  : defaultBanks.slice();

function save() {
  if (!USE_PERSISTENCE) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(banks));
}

function render() {
  const list = document.getElementById("bank-list");
  if (!list) return;

  if (banks.length === 0) {
    list.innerHTML = `<div class="toast">Aucune banque. Crée-en une !</div>`;
    return;
  }

  list.innerHTML = banks
    .map(
      (b) => `
    <div class="bank-card ${b.closed ? "closed" : ""}" data-id="${b.id}">
      <button class="btn close-btn" title="Fermer la banque" aria-label="Fermer" ${b.closed ? 'style="display:none"' : ""}>×</button>
      <div class="header">
        <div>
          <div class="title">${escapeHtml(b.name)}</div>
          <div class="meta">${b.items} éléments • ${b.closed ? "fermée" : "ouverte"}</div>
        </div>
        <div class="actions">
          <button class="btn toggle">${b.closed ? "Réouvrir" : "Fermer"}</button>
          <button class="btn ghost export">Exporter</button>
          <button class="btn danger delete">Supprimer</button>
        </div>
      </div>
      <div class="desc">Aperçu visuel rapide — personnalise selon tes besoins.</div>
    </div>
  `
    )
    .join("");
}

// event delegation pour gérer tous les boutons dans la liste
function attachListHandlers() {
  const list = document.getElementById("bank-list");
  if (!list) return;

  list.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button");
    if (!btn) return;

    const card = ev.target.closest(".bank-card");
    if (!card) return;
    const id = Number(card.dataset.id);

    if (btn.classList.contains("close-btn")) {
      ev.stopPropagation();
      if (!confirm(`Fermer la banque "${getBankName(id)}" ?`)) return;
      toggleClose(id);
      return;
    }

    if (btn.classList.contains("toggle")) {
      toggleClose(id);
      return;
    }

    if (btn.classList.contains("delete")) {
      if (confirm(`Supprimer "${getBankName(id)}" définitivement ?`)) deleteBank(id);
      return;
    }

    if (btn.classList.contains("export")) {
      alert("Export: fonctionnalité à implémenter");
      return;
    }
  });
}

function getBankName(id) {
  const b = banks.find((x) => x.id === id);
  return b ? b.name : "la banque";
}

function toggleClose(id) {
  const idx = banks.findIndex((b) => b.id === id);
  if (idx === -1) return;
  const bank = banks[idx];

  if (!bank.closed) {
    if (!confirm(`Fermer la banque "${bank.name}" ?\nElle sera marquée comme fermée (réversible).`)) return;
  }

  banks[idx] = { ...bank, closed: !bank.closed };
  save();
  render();
}

function deleteBank(id) {
  banks = banks.filter((b) => b.id !== id);
  save();
  render();
}

function addBank(name) {
  if (!name || !name.trim()) return;
  banks.unshift({ id: Date.now(), name: name.trim(), items: 0, closed: false });
  save();
  render();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

document.addEventListener("DOMContentLoaded", () => {
  const addBtn = document.getElementById("add-btn");
  const input = document.getElementById("new-name");
  if (addBtn && input) {
    addBtn.addEventListener("click", () => {
      addBank(input.value);
      input.value = "";
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        addBank(input.value);
        input.value = "";
      }
    });
  }

  render();
  attachListHandlers();
});