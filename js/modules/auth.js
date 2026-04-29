import { state, addLog, escapeHtml } from './state.js';

export function renderLogin() {
  return `<div class="login-wrap"><div class="login-card">
    <div style="font-family:var(--mono);font-size:20px;font-weight:600;color:var(--accent);margin-bottom:8px">🏭 TRIVIETSTEEL PRO</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:28px">Quản lý kho & Công trình & Nhà cung cấp</div>
    ${state.data.users.map(u => `<div class="user-pill" onclick="login('${u.id}')">
        <div class="avatar">${u.name[0]}</div><div><div style="font-weight:500">${escapeHtml(u.name)}</div><div class="tag">${u.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}</div></div>
    </div>`).join('')}
  </div></div>`;
}

export function login(uid) { 
  state.currentUser = state.data.users.find(u => u.id === uid); 
  addLog('Đăng nhập', `Đăng nhập thành công`);
  state.currentPane = 'entry'; 
  if (window.render) window.render();
}

export function logout() { 
  addLog('Đăng xuất', `Đăng xuất khỏi hệ thống`);
  state.currentUser = null; 
  if (window.render) window.render();
}

export function switchPane(pane) { 
  state.currentPane = pane; 
  if (window.render) window.render();
}

export function setCurrentUser(user) { state.currentUser = user; }
export function getCurrentUser() { return state.currentUser; }

export function renderSidebar() {
  const hasAccessSettings = state.currentUser?.permissions?.canAccessSettings || state.currentUser?.role === 'admin';
  return `<div class="sidebar">
    <div class="sidebar-logo">🏭 TRIVIETSTEEL</div>
    <div class="sidebar-user"><div class="uname">${escapeHtml(state.currentUser.name)}</div><div class="urole">${state.currentUser.role === 'admin' ? 'Quản trị viên' : 'Nhân viên kho'}</div></div>
    <div class="nav-item ${state.currentPane === 'entry' ? 'active' : ''}" onclick="switchPane('entry')">📦 Quản lý kho</div>
    <div class="nav-item ${state.currentPane === 'dashboard' ? 'active' : ''}" onclick="switchPane('dashboard')">📊 Thống kê</div>
    <div class="nav-item ${state.currentPane === 'projects' ? 'active' : ''}" onclick="switchPane('projects')">🏗️ Công trình</div>
    <div class="nav-item ${state.currentPane === 'suppliers' ? 'active' : ''}" onclick="switchPane('suppliers')">🏭 Nhà cung cấp</div>
    <div class="nav-item ${state.currentPane === 'logs' ? 'active' : ''}" onclick="switchPane('logs')">📋 Nhật ký</div>
    ${hasAccessSettings ? `<div class="nav-item ${state.currentPane === 'settings' ? 'active' : ''}" onclick="switchPane('settings')">⚙️ Cài đặt</div>` : ''}
    <div class="sidebar-bottom"><button onclick="logout()" style="width:100%">🚪 Đăng xuất</button></div>
  </div>`;
}

export function renderTopbar() {
  let btns = '';
  const hasPermission = (perm) => state.currentUser?.permissions?.[perm] === true || state.currentUser?.role === 'admin';
  
  if (state.currentPane === 'entry') {
    btns = `${hasPermission('canCreateMaterial') ? `<button class="sm" onclick="openMatModal()">+ Thêm vật tư</button>` : ''}
            ${hasPermission('canImport') ? `<button class="sm primary" onclick="openPurchaseModal()">📥 Nhập kho</button>` : ''}
            ${hasPermission('canExport') ? `<button class="sm" onclick="openTxnModal('usage')">📤 Xuất kho</button>` : ''}
            ${hasPermission('canImport') ? `<button class="sm" style="background: var(--success-bg); color: var(--success-text);" onclick="openReturnModal()">🔄 Trả hàng từ công trình</button>` : ''}
            <button class="sm" onclick="showImportModal('materials', () => window.render())">📂 Import Excel</button>
            <button class="sm" onclick="exportToExcel('materials')">📎 Export Excel</button>`;
  }
  if (state.currentPane === 'projects') {
    btns = `${hasPermission('canCreateMaterial') ? `<button class="sm primary" onclick="openProjectModal()">+ Công trình mới</button>` : ''}
            <button class="sm" onclick="showImportModal('projects', () => window.render())">📂 Import Excel</button>
            <button class="sm" onclick="exportAllProjectsReport()">📎 Export Excel</button>`;
  }
  if (state.currentPane === 'suppliers') {
    btns = `${hasPermission('canManageSupplier') ? `<button class="sm primary" onclick="openSupplierModal()">+ Nhà cung cấp mới</button>` : ''}
            <button class="sm" onclick="showImportModal('suppliers', () => window.render())">📂 Import Excel</button>
            <button class="sm" onclick="exportAllSuppliersReport()">📎 Export Excel</button>`;
  }
  return `<div class="topbar"><span class="topbar-title">${getPaneTitle()}</span>${btns}</div>`;
}

export function getPaneTitle() {
  const titles = { entry: 'Quản lý tồn kho', dashboard: 'Bảng điều khiển trung tâm', projects: 'Quản lý công trình', suppliers: 'Quản lý nhà cung cấp', logs: 'Nhật ký hệ thống', settings: 'Cấu hình hệ thống' };
  return titles[state.currentPane] || '';
}

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