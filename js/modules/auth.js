import { state, addLog, escapeHtml } from './state.js';

export function renderLogin() {
  return `<div class="login-wrap"><div class="login-card">
    <div style="text-align:center;margin-bottom:24px;">
        <img src="/images/logo.png" alt="TRIVIET STEEL" style="max-width:200px;height:auto;">
    </div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:28px;text-align:center;">Quản lý kho & Công trình & Nhà cung cấp</div>
    <div class="form-group"><label class="form-label">👤 TÀI KHOẢN</label><input type="text" id="login-username" placeholder="Nhập tài khoản..." autocomplete="off"></div>
    <div class="form-group"><label class="form-label">🔒 MẬT KHẨU</label><input type="password" id="login-password" placeholder="Nhập mật khẩu..." autocomplete="off"></div>
    <div id="login-error" style="color:var(--danger-text);font-size:12px;margin-bottom:12px;display:none;text-align:center;"></div>
    <button class="primary" onclick="window.doLogin()" style="width:100%;padding:12px;font-size:14px;font-weight:600;">🚪 ĐĂNG NHẬP</button>
  </div></div>`;
}

window.doLogin = function() {
    const username = document.getElementById('login-username')?.value.trim().toLowerCase();
    const password = document.getElementById('login-password')?.value;
    const errorEl = document.getElementById('login-error');
    if (!username || !password) { if (errorEl) { errorEl.textContent = '⚠️ Vui lòng nhập đầy đủ!'; errorEl.style.display = 'block'; } return; }
    const user = state.data.users.find(u => u.username.toLowerCase() === username && u.password === password);
    if (user) { if (errorEl) errorEl.style.display = 'none'; login(user.id); }
    else { if (errorEl) { errorEl.textContent = '❌ Sai tài khoản hoặc mật khẩu!'; errorEl.style.display = 'block'; } }
};

document.addEventListener('keydown', function(e) { if (e.key === 'Enter' && document.getElementById('login-username')) window.doLogin(); });

export function login(uid) { state.currentUser = state.data.users.find(u => u.id === uid); addLog('Đăng nhập', 'Đăng nhập thành công'); state.currentPane = 'dashboard'; if (window.render) window.render(); }
export function logout() { addLog('Đăng xuất', 'Đăng xuất'); state.currentUser = null; if (window.render) window.render(); }
export function switchPane(pane) { state.currentPane = pane; if (window.render) window.render(); }
export function setCurrentUser(user) { state.currentUser = user; }
export function getCurrentUser() { return state.currentUser; }

export function renderSidebar() {
  const hasAccessSettings = state.currentUser?.permissions?.canAccessSettings || state.currentUser?.role === 'admin';
  return `<div class="sidebar">
    <div class="sidebar-logo" onclick="if(document.querySelector('.sidebar').classList.contains('collapsed')) toggleSidebar()">
        <img src="/images/logo.png" alt="LOGO" class="logo-full" style="height:28px;width:auto;">
        <img src="/images/logo-tv.png" alt="LOGO" class="logo-mini" style="height:28px;width:auto;display:none;">
        <button class="sidebar-toggle-btn" onclick="event.stopPropagation();toggleSidebar()">◀</button>
    </div>
    <div class="sidebar-user"><div class="uname">${escapeHtml(state.currentUser.name)}</div><div class="urole">${state.currentUser.role === 'admin' ? 'Quản trị viên' : 'Nhân viên kho'}</div></div>
    <div class="sidebar-nav">
        <div class="nav-item ${state.currentPane === 'dashboard' ? 'active' : ''}" onclick="switchPane('dashboard')"><img src="/images/logo-tk.png" class="nav-icon" style="width:20px;height:20px;display:none;"><img src="/images/logo-tk.png" class="nav-icon" style="width:20px;height:20px;display:none;">📊 <span>Thống kê</span></div>
        <div class="nav-item ${state.currentPane === 'entry' ? 'active' : ''}" onclick="switchPane('entry')"><img src="/images/logo-qlk.png" class="nav-icon" style="width:20px;height:20px;display:none;"><img src="/images/logo-qlk.png" class="nav-icon" style="width:20px;height:20px;display:none;">📦 <span>Quản lý kho</span></div>
        <div class="nav-item ${state.currentPane === 'projects' ? 'active' : ''}" onclick="switchPane('projects')"><img src="/images/logo-ct.png" class="nav-icon" style="width:20px;height:20px;display:none;"><img src="/images/logo-ct.png" class="nav-icon" style="width:20px;height:20px;display:none;">🏗️ <span>Công trình</span></div>
        <div class="nav-item ${state.currentPane === 'suppliers' ? 'active' : ''}" onclick="switchPane('suppliers')"><img src="/images/logo-ncc.png" class="nav-icon" style="width:20px;height:20px;display:none;"><img src="/images/logo-ncc.png" class="nav-icon" style="width:20px;height:20px;display:none;">🏭 <span>Nhà cung cấp</span></div>
        <div class="nav-item ${state.currentPane === 'logs' ? 'active' : ''}" onclick="switchPane('logs')"><img src="/images/logo-nk.png" class="nav-icon" style="width:20px;height:20px;display:none;"><img src="/images/logo-nk.png" class="nav-icon" style="width:20px;height:20px;display:none;">📋 <span>Nhật ký</span></div>
        ${hasAccessSettings ? `<div class="nav-item ${state.currentPane === 'settings' ? 'active' : ''}" onclick="switchPane('settings')"><img src="/images/logo-cd.png" class="nav-icon" style="width:20px;height:20px;display:none;"><img src="/images/logo-cd.png" class="nav-icon" style="width:20px;height:20px;display:none;">⚙️ <span>Cài đặt</span></div>` : ''}
    </div>
    <div class="sidebar-bottom"><button onclick="logout()" style="width:100%">🚪 <span>Đăng xuất</span></button></div>
  </div>`;
}

export function renderTopbar() {
  let btns = '';
  const hasPermission = (perm) => state.currentUser?.permissions?.[perm] === true || state.currentUser?.role === 'admin';
  if (state.currentPane === 'entry') btns = `${hasPermission('canCreateMaterial') ? '<button class="sm" onclick="openMatModal()">+ Thêm vật tư</button>' : ''} ${hasPermission('canImport') ? '<button class="sm primary" onclick="openPurchaseModal()">📥 Nhập kho</button>' : ''} ${hasPermission('canExport') ? '<button class="sm" onclick="openTxnModal(\'usage\')">📤 Xuất kho</button>' : ''} <button class="sm" onclick="showImportModal(\'materials\', () => window.render())">📂 Import Excel</button> <button class="sm" onclick="exportToExcel(\'materials\')">📎 Export Excel</button>`;
  if (state.currentPane === 'projects') btns = `${hasPermission('canCreateMaterial') ? '<button class="sm primary" onclick="openProjectModal()">+ Công trình mới</button>' : ''} <button class="sm" onclick="showImportModal('projects', () => window.render())">📂 Import Excel</button> <button class="sm" onclick="exportAllProjectsReport()">📎 Export Excel</button>`;
  if (state.currentPane === 'suppliers') btns = `${hasPermission('canManageSupplier') ? '<button class="sm primary" onclick="openSupplierModal()">+ Nhà cung cấp mới</button>' : ''} <button class="sm" onclick="showImportModal('suppliers', () => window.render())">📂 Import Excel</button> <button class="sm" onclick="exportAllSuppliersReport()">📎 Export Excel</button>`;
  return `<div class="topbar"><span class="topbar-title">${getPaneTitle()}</span>${btns}</div>`;
}

export function getPaneTitle() {
  const titles = { entry: 'Quản lý tồn kho', dashboard: 'Bảng điều khiển trung tâm', projects: 'Quản lý công trình', suppliers: 'Quản lý nhà cung cấp', logs: 'Nhật ký hệ thống', settings: 'Cấu hình hệ thống' };
  return titles[state.currentPane] || '';
}

let currentModalCallback = null;
export function showModal(html, callback) { currentModalCallback = callback; const modalArea = document.getElementById('modal-area'); if (modalArea) modalArea.innerHTML = `<div class="modal-overlay"><div class="modal">${html}</div></div>`; }
export function closeModal() { const modalArea = document.getElementById('modal-area'); if (modalArea) modalArea.innerHTML = ''; if (currentModalCallback) currentModalCallback(); currentModalCallback = null; }
