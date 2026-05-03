export let state = {
  theme: 'dark', currentUser: null, currentPane: 'entry',
  data: {
    materials: [], transactions: [], projects: [], suppliers: [], logs: [],
    categories: ['Dầm thép', 'Tấm thép', 'Thép hộp', 'Thép góc', 'Vật tư tiêu hao', 'Bu lông - Ốc vít', 'Ống thép', 'Thép hình'],
    units: ['tấn', 'kg', 'cái', 'mét', 'thùng', 'tấm', 'cuộn'],
    nextMid: 1, nextTid: 1, nextPid: 1, nextSid: 1, nextLogId: 1,
    projectMaterialUsage: [], projectSchedules: [],
    users: [
      { id: 'u1', name: 'Admin', username: 'admin', password: 'admin123', role: 'admin', permissions: { canCreateMaterial: true, canDeleteMaterial: true, canEditMaterial: true, canImport: true, canExport: true, canDeleteProject: true, canAccessSettings: true, canManageSupplier: true } },
      { id: 'u2', name: 'Nhân viên kho', username: 'staff', password: 'staff123', role: 'user', permissions: { canImport: true, canExport: true } },
    ]
  },
  filters: { projectSearch: '', supplierSearch: '', materialSearch: '' }
};

export async function loadState() {
  try {
    const res = await fetch('/api/data').then(r => r.json());
    if (res.success && res.data) {
      if (res.data.materials?.length) state.data.materials = res.data.materials;
      if (res.data.transactions?.length) state.data.transactions = res.data.transactions.map(t => ({ ...t, supplierId: t.supplier_id, projectId: t.project_id, unitPrice: t.unit_price, vatRate: t.vat_rate, totalAmount: t.total_amount, vatAmount: t.vat_amount, invoiceImage: t.invoice_image }));
      if (res.data.projects?.length) state.data.projects = res.data.projects;
      if (res.data.suppliers?.length) state.data.suppliers = res.data.suppliers;
      if (res.data.users?.length) state.data.users = res.data.users;
      if (res.data.logs?.length) state.data.logs = res.data.logs;
      if (res.data.categories?.length) state.data.categories = res.data.categories;
      if (res.data.units?.length) state.data.units = res.data.units;
      state.data.nextMid = Math.max(...state.data.materials.map(m => +String(m.id).replace('M','')||0), 0) + 1;
      state.data.nextTid = Math.max(...state.data.transactions.map(t => +String(t.id).replace('T','')||0), 0) + 1;
      state.data.nextPid = Math.max(...state.data.projects.map(p => +String(p.id).replace('P','')||0), 0) + 1;
      state.data.nextSid = Math.max(...state.data.suppliers.map(s => +String(s.id).replace('S','')||0), 0) + 1;
      state.data.nextLogId = Math.max(...state.data.logs.map(l => { let n = String(l.id).replace('LOG',''); return parseInt(n)||0; }), 0) + 1;
    }
  } catch(e) { console.error(e); }
  applyTheme(state.theme);
}

export function saveState() {
  fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categories: state.data.categories }) });
  fetch("/api/units", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ units: state.data.units }) });
  state.data.users.forEach(u => fetch("/api/users-table", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: u.id, name: u.name, username: u.username, password: u.password, role: u.role, permissions: u.permissions || {} }) }));
}

export function applyTheme(t) { state.theme = t; document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : ''); localStorage.setItem('steel_theme', t); }
export function isAdmin() { return state.currentUser?.role === 'admin'; }
export function hasPermission(p) { return state.currentUser?.permissions?.[p] || state.currentUser?.role === 'admin'; }
export function genMid() { return 'M' + String(state.data.nextMid++).padStart(3,'0'); }
export function genTid() { return 'T' + String(state.data.nextTid++).padStart(3,'0'); }
export function genPid() { return 'P' + String(state.data.nextPid++).padStart(3,'0'); }
export function genSid() { return 'S' + String(state.data.nextSid++).padStart(3,'0'); }
export function matById(id) { return state.data.materials.find(m => m.id === id); }
export function projectById(id) { return state.data.projects.find(p => p.id === id); }
export function supplierById(id) { return state.data.suppliers.find(s => s.id === id); }
export function formatMoney(v) { let n = parseFloat(v)||0; return n.toLocaleString('vi-VN') + ' ₫'; }
export function escapeHtml(s) { return s ? s.replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'})[m]) : ''; }

export function addLog(action, details) {
  if (!state.currentUser) return;
  const id = 'LOG' + String(state.data.nextLogId++).padStart(5, '0');
  const logEntry = { id, timestamp: new Date().toISOString(), userId: state.currentUser.id, userName: state.currentUser.name, action, details };
  state.data.logs.unshift(logEntry);
  fetch("/api/logs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "LOG" + String(state.data.nextLogId++).padStart(5, "0"), userId: state.currentUser.id, userName: state.currentUser.name, action, details }) });
  fetch('/api/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logEntry) });
}

let modalCb = null;
export function showModal(h, cb) { modalCb = cb; const a = document.getElementById('modal-area'); if (a) a.innerHTML = '<div class="modal-overlay"><div class="modal">' + h + '</div></div>'; }
export function closeModal() { const a = document.getElementById('modal-area'); if (a) a.innerHTML = ''; if (modalCb) modalCb(); modalCb = null; }
