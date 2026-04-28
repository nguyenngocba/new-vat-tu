export const STORAGE_KEY = 'steel_pro_v12';

export let state = {
  theme: 'dark',
  currentUser: null,
  currentPane: 'entry',
  data: {
    materials: [],
    transactions: [],
    projects: [],
    suppliers: [],
    logs: [],
    categories: ['Dầm thép', 'Tấm thép', 'Thép hộp', 'Thép góc', 'Vật tư tiêu hao', 'Bu lông - Ốc vít', 'Ống thép', 'Thép hình'],
    units: ['tấn', 'kg', 'cái', 'mét', 'thùng', 'tấm', 'cuộn'],
    nextMid: 1,
    nextTid: 1,
    nextPid: 1,
    nextSid: 1,
    nextLogId: 1,
    users: [
      { id: 'u1', name: 'Admin System', username: 'admin', password: 'admin123', role: 'admin', permissions: { canCreateMaterial: true, canDeleteMaterial: true, canEditMaterial: true, canImport: true, canExport: true, canDeleteProject: true, canAccessSettings: true, canManageSupplier: true } },
      { id: 'u2', name: 'Nhân viên kho', username: 'staff', password: 'staff123', role: 'user', permissions: { canCreateMaterial: false, canDeleteMaterial: false, canEditMaterial: false, canImport: true, canExport: true, canDeleteProject: false, canAccessSettings: false, canManageSupplier: false } },
    ]
  },
  filters: { projectSearch: '', supplierSearch: '', materialSearch: '' }
};

export function saveState() {
  try {
    const toSave = {
      materials: state.data.materials,
      transactions: state.data.transactions,
      projects: state.data.projects,
      suppliers: state.data.suppliers,
      logs: state.data.logs,
      categories: state.data.categories,
      units: state.data.units,
      nextMid: state.data.nextMid,
      nextTid: state.data.nextTid,
      nextPid: state.data.nextPid,
      nextSid: state.data.nextSid,
      nextLogId: state.data.nextLogId,
      users: state.data.users
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch(e) { console.error(e); }
}

export function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      state.data = { ...state.data, ...parsed };
      if (!state.data.projects) state.data.projects = [];
      if (!state.data.suppliers) state.data.suppliers = [];
      if (!state.data.logs) state.data.logs = [];
      if (!state.data.categories || state.data.categories.length === 0) {
        state.data.categories = ['Dầm thép', 'Tấm thép', 'Thép hộp', 'Thép góc', 'Vật tư tiêu hao', 'Bu lông - Ốc vít', 'Ống thép', 'Thép hình'];
      }
      if (!state.data.units || state.data.units.length === 0) {
        state.data.units = ['tấn', 'kg', 'cái', 'mét', 'thùng', 'tấm', 'cuộn'];
      }
      if (!state.data.transactions) state.data.transactions = [];
      if (!state.data.materials) state.data.materials = [];
    }
    if (state.data.projects.length === 0) {
      state.data.projects = [
        { id: 'P001', name: 'Nhà kho A', budget: 50000000, spent: 0 },
        { id: 'P002', name: 'Mái nhà xưởng B', budget: 35000000, spent: 0 },
        { id: 'P003', name: 'Khung văn phòng C', budget: 28000000, spent: 0 }
      ];
      state.data.nextPid = 4;
    }
    if (state.data.suppliers.length === 0) {
      state.data.suppliers = [
        { id: 'S001', name: 'Thép Việt Đức', phone: '0243 123 456', email: 'contact@thepvietduc.com', address: 'Hà Nội' },
        { id: 'S002', name: 'Hòa Phát Group', phone: '0243 789 012', email: 'sales@hoaphat.com.vn', address: 'Hưng Yên' },
        { id: 'S003', name: 'Thép Pomina', phone: '0283 456 789', email: 'info@pomina.com', address: 'Bà Rịa - Vũng Tàu' }
      ];
      state.data.nextSid = 4;
    }
    if (state.data.materials.length === 0) seedData();
    const savedTheme = localStorage.getItem('steel_theme');
    if (savedTheme) state.theme = savedTheme;
  } catch(e) { console.error(e); seedData(); }
  applyTheme(state.theme);
}

function seedData() {
  state.data.materials = [
    { id: 'M001', name: 'Dầm H 200x200', cat: 'Dầm thép', unit: 'tấn', qty: 18.5, cost: 8500000, low: 5, note: '' },
    { id: 'M002', name: 'Tôn dày 10mm', cat: 'Tấm thép', unit: 'tấn', qty: 22.0, cost: 7600000, low: 6, note: '' },
    { id: 'M003', name: 'Que hàn E7018', cat: 'Vật tư tiêu hao', unit: 'thùng', qty: 40, cost: 120000, low: 15, note: '' },
    { id: 'M004', name: 'Bu lông M20', cat: 'Bu lông - Ốc vít', unit: 'cái', qty: 850, cost: 4500, low: 200, note: '' }
  ];
  state.data.nextMid = 5;
  state.data.transactions = [];
  state.data.nextTid = 1;
  saveState();
}

export function applyTheme(t) { 
  state.theme = t; 
  document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : ''); 
  localStorage.setItem('steel_theme', t); 
}

export function isAdmin() { return state.currentUser?.role === 'admin'; }
export function hasPermission(perm) { return state.currentUser?.permissions?.[perm] === true || state.currentUser?.role === 'admin'; }

export function genMid() { return `M${String(state.data.nextMid++).padStart(3, '0')}`; }
export function genTid() { return `T${String(state.data.nextTid++).padStart(3, '0')}`; }
export function genPid() { return `P${String(state.data.nextPid++).padStart(3, '0')}`; }
export function genSid() { return `S${String(state.data.nextSid++).padStart(3, '0')}`; }

export function matById(id) { return state.data.materials.find(m => m.id === id); }
export function projectById(id) { return state.data.projects.find(p => p.id === id); }
export function supplierById(id) { return state.data.suppliers.find(s => s.id === id); }

export function addLog(action, details = '') {
  if (!state.currentUser) return;
  const logEntry = {
    id: `LOG${String(state.data.nextLogId++).padStart(5, '0')}`,
    timestamp: new Date().toISOString(),
    timeStr: new Date().toLocaleString('vi-VN'),
    userId: state.currentUser.id,
    userName: state.currentUser.name,
    userRole: state.currentUser.role,
    action: action,
    details: details
  };
  state.data.logs.unshift(logEntry);
  if (state.data.logs.length > 500) state.data.logs = state.data.logs.slice(0, 500);
  saveState();
}

export function formatMoney(value) { 
    let num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) num = 0;
    return num.toLocaleString('vi-VN') + ' ₫'; 
}

export function escapeHtml(str) { if(!str) return ''; return str.replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'})[m]); }

let currentModalCallback = null;
export function showModal(html, callback) {
  currentModalCallback = callback;
  const modalArea = document.getElementById('modal-area');
  if (modalArea) {
    modalArea.innerHTML = `<div class="modal-overlay"><div class="modal">${html}</div></div>`;
  }
}
export function closeModal() {
  const modalArea = document.getElementById('modal-area');
  if (modalArea) modalArea.innerHTML = '';
  if (currentModalCallback) currentModalCallback();
  currentModalCallback = null;
}