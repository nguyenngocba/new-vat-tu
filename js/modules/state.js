export let state = {
  theme: 'dark', currentUser: null, currentPane: 'entry',
  data: {
    materials: [], transactions: [], projects: [], suppliers: [], logs: [],
    categories: ['Dầm thép', 'Tấm thép', 'Thép hộp', 'Thép góc', 'Vật tư tiêu hao', 'Bu lông - Ốc vít', 'Ống thép', 'Thép hình'],
    units: ['tấn', 'kg', 'cái', 'mét', 'thùng', 'tấm', 'cuộn'],
    nextMid: 1, nextTid: 1, nextPid: 1, nextSid: 1, nextLogId: 1,
    projectMaterialUsage: [], projectSchedules: [], structures: [],
    users: [
      { id: 'u1', name: 'Admin', username: 'admin', password: 'admin123', role: 'admin', permissions: { canCreateMaterial: true, canDeleteMaterial: true, canEditMaterial: true, canImport: true, canExport: true, canDeleteProject: true, canAccessSettings: true, canManageSupplier: true } },
      { id: 'u2', name: 'Nhân viên kho', username: 'staff', password: 'staff123', role: 'user', permissions: { canImport: true, canExport: true } },
    ]
  },
  filters: { projectSearch: '', supplierSearch: '', materialSearch: '' }
};

// DEBUG: Bẫy ai reset currentUser - ĐẶT SAU DẤU };
var _currentUser = state.currentUser;
Object.defineProperty(state, 'currentUser', {
  get: function() { return _currentUser; },
  set: function(val) {
    console.trace('🔥 currentUser thay đổi từ', _currentUser?.name, 'thành', val?.name);
    _currentUser = val;
  }
});
function timeCode() {
    const now = new Date();
    return String(now.getFullYear()).substr(2) +
           String(now.getMonth()+1).padStart(2,'0') +
           String(now.getDate()).padStart(2,'0') +
           String(now.getHours()).padStart(2,'0') +
           String(now.getMinutes()).padStart(2,'0');
}


export async function loadState() {
  try {
    // KHÔI PHỤC USER TỪ LOCALSTORAGE
    if (!state.currentUser || !state.currentUser.id) {
      var saved = localStorage.getItem('steeltrack_current_user');
      if (saved) {
        try { 
          state.currentUser = JSON.parse(saved); 
          console.log('Đã khôi phục user:', state.currentUser.name);
        } catch(e) {}
      }
    }
    
    const res = await fetch('/api/data').then(r => r.json());
 // LƯU USER HIỆN TẠI TRƯỚC KHI LOAD
    var savedUser = state.currentUser;
    if (res.success && res.data) {
// Giữ lại user đang đăng nhập
      if (res.data.materials?.length) state.data.materials = res.data.materials;
      if (res.data.transactions?.length) state.data.transactions = res.data.transactions.map(t => ({ ...t, supplierId: t.supplier_id, projectId: t.project_id, unitPrice: t.unit_price, vatRate: t.vat_rate, totalAmount: t.total_amount, vatAmount: t.vat_amount, invoiceImage: t.invoice_image }));
  console.log("First transaction attachment:", res.data.transactions[0]?.attachment);
      state.data.transactions = state.data.transactions.map(t => ({ ...t, attachment: t.attachment || "[]" }));
      if (res.data.projects?.length) state.data.projects = res.data.projects;
      if (res.data.suppliers?.length) state.data.suppliers = res.data.suppliers;
      if (res.data.users?.length) state.data.users = res.data.users;
if (res.data.logs?.length) state.data.logs = res.data.logs.map(function(l) { return { ...l, userName: l.user_name || l.userName, userId: l.user_id || l.userId }; });     
      if (res.data.categories?.length) state.data.categories = res.data.categories;
      if (res.data.units?.length) state.data.units = res.data.units;
      if (res.data.projectSchedules?.length) state.data.projectSchedules = res.data.projectSchedules.map(s => ({...s, ...(typeof s.data === 'string' ? JSON.parse(s.data) : s.data)}));
      if (res.data.projectMaterialUsage?.length) state.data.projectMaterialUsage = res.data.projectMaterialUsage;
      if (res.data.structures?.length) {
        state.data.structures = res.data.structures.map(s => {
          const mats = (res.data.structureMaterials||[]).filter(m => m.structure_id === s.id).map(m => ({ materialId: m.material_id, materialName: m.material_name, unit: m.unit, quantity: m.quantity }));
          return { ...s, materials: mats };
        });
      }
    }
  } catch(e) {}
//  if (savedUser) state.currentUser = savedUser;
// LUÔN KHÔI PHỤC USER TỪ LOCALSTORAGE SAU KHI LOAD
  var saved = localStorage.getItem('steeltrack_current_user');
  if (saved) {
    try { state.currentUser = JSON.parse(saved); } catch(e) {}
  }
  applyTheme(state.theme);
}


export function saveState() {
  fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categories: state.data.categories }) }).catch(function(){});
  fetch("/api/units", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ units: state.data.units }) }).catch(function(){});
  if (state.data.projectSchedules?.length) {
    state.data.projectSchedules.forEach(s => {
      fetch("/api/project-schedules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) }).catch(function(){});
    });
  }
  if (state.data.projectMaterialUsage?.length) {
    state.data.projectMaterialUsage.forEach(u => {
      fetch("/api/project-material-usage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(u) }).catch(function(){});
    });
  }
}
export function addLog(action, details) {
  var user = (window.state && window.state.currentUser) || state.currentUser;
  
  console.log('DEBUG addLog - state.currentUser:', state.currentUser?.name);
  console.log('DEBUG addLog - window.state.currentUser:', window.state?.currentUser?.name);
  console.log('DEBUG addLog - localStorage:', localStorage.getItem('steeltrack_current_user'));
  console.log('DEBUG addLog - user cuối cùng:', user?.name);
  
  if (!user || !user.id) {
    user = { id: "system", name: "System" };
  }
  
  var id = 'LOG' + timeCode() + String(state.data.nextLogId++).padStart(3,'0');
  var logEntry = { 
    id: id, 
    timestamp: new Date().toISOString(), 
    timeStr: new Date().toLocaleString('vi-VN', {hour:'2-digit',minute:'2-digit',second:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'}), 
    userId: user.id, 
    userName: user.name, 
    action: action, 
    details: details 
  };
  state.data.logs.unshift(logEntry);
  fetch('/api/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logEntry) });
}
// ID theo quy tắc: tvsvt = vật tư, tvsct = công trình, tvsnc = nhà cung cấp, tvskh = giao dịch
let _matCounter = 0, _projCounter = 0, _supCounter = 0, _txnCounter = 0;
export function genMid() { _matCounter++; return 'tvsvt' + timeCode() + String(_matCounter).padStart(3,'0'); }
export function genPid() { _projCounter++; return 'tvsct' + timeCode() + String(_projCounter).padStart(3,'0'); }
export function genSid() { _supCounter++; return 'tvsnc' + timeCode() + String(_supCounter).padStart(3,'0'); }
export function genTid() { _txnCounter++; return 'tvskh' + timeCode() + String(_txnCounter).padStart(3,'0'); }

export function applyTheme(t) { state.theme = t; document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : ''); localStorage.setItem('steel_theme', t); }
export function isAdmin() { return state.currentUser?.role === 'admin'; }
export function hasPermission(p) { return state.currentUser?.permissions?.[p] || state.currentUser?.role === 'admin'; }
export function matById(id) { return state.data.materials.find(m => m.id === id); }
export function projectById(id) { return state.data.projects.find(p => p.id === id); }
export function supplierById(id) { return state.data.suppliers.find(s => s.id === id); }
export function formatMoney(v) { let n = parseFloat(v)||0; return n.toLocaleString('vi-VN', {minimumFractionDigits:0, maximumFractionDigits:3}) + ' ₫'; }
export function escapeHtml(s) { return s ? s.replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'})[m]) : ''; }

let modalCb = null;
export function showModal(h, cb) { modalCb = cb; const a = document.getElementById('modal-area'); if (a) a.innerHTML = '<div class="modal-overlay"><div class="modal">' + h + '</div></div>'; }
export function closeModal() { const a = document.getElementById('modal-area'); if (a) a.innerHTML = ''; if (modalCb) modalCb(); modalCb = null; }
