import { state, addLog, escapeHtml } from './state.js';

// ========== CÁC HÀM HIỆN CÓ ==========
export function renderLogin() {
  return `<div class="login-wrap"><div class="login-card">
    <div style="font-family:var(--mono);font-size:20px;font-weight:600;color:var(--accent);margin-bottom:8px">🏭 STEEL/TRACK PRO</div>
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

export function renderSidebar() {
  const hasAccessSettings = state.currentUser?.permissions?.canAccessSettings || state.currentUser?.role === 'admin';
  return `<div class="sidebar">
    <div class="sidebar-logo">🏭 STEEL/TRACK</div>
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
            <button class="sm" onclick="exportToExcel('materials')">📎 Export Excel</button>`;
  }
  if (state.currentPane === 'projects' && hasPermission('canCreateMaterial')) {
    btns = `<button class="sm primary" onclick="openProjectModal()">+ Công trình mới</button>
            <button class="sm" onclick="exportToExcel('projects')">📎 Export Excel</button>`;
  }
  if (state.currentPane === 'suppliers' && hasPermission('canManageSupplier')) {
    btns = `<button class="sm primary" onclick="openSupplierModal()">+ Nhà cung cấp mới</button>
            <button class="sm" onclick="exportToExcel('suppliers')">📎 Export Excel</button>`;
  }
  return `<div class="topbar"><span class="topbar-title">${getPaneTitle()}</span>${btns}</div>`;
}

export function getPaneTitle() {
  const titles = { entry: 'Quản lý tồn kho', dashboard: 'Bảng điều khiển trung tâm', projects: 'Quản lý công trình', suppliers: 'Quản lý nhà cung cấp', logs: 'Nhật ký hệ thống', settings: 'Cấu hình hệ thống' };
  return titles[state.currentPane] || '';
}

// ========== HÀM XỬ LÝ SỐ - THEO CHUẨN VIỆT NAM ==========

export function parseNumber(str) {
    if (!str || str === '') return 0;
    let cleaned = str.toString().replace(/\./g, '').replace(/,/g, '.');
    let num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

export function getNumberFromInput(inputElement) {
    if (!inputElement) return 0;
    return parseNumber(inputElement.value);
}

export function getIntegerFromInput(inputElement) {
    if (!inputElement) return 0;
    return Math.floor(parseNumber(inputElement.value));
}

export function setInputValue(inputElement, value) {
    if (!inputElement) return;
    let num = typeof value === 'string' ? parseNumber(value) : value;
    if (isNaN(num)) num = 0;
    inputElement.value = num.toLocaleString('vi-VN');
}

export function formatMoneyVND(value) {
    let num = typeof value === 'string' ? parseNumber(value) : value;
    if (isNaN(num)) num = 0;
    return num.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ₫';
}

export function formatNumberVN(value, decimalPlaces = 0) {
    let num = typeof value === 'string' ? parseNumber(value) : value;
    if (isNaN(num)) num = 0;
    if (decimalPlaces > 0) {
        return num.toLocaleString('vi-VN', { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces });
    }
    if (num % 1 !== 0) {
        let decimalCount = (num.toString().split('.')[1] || '').length;
        return num.toLocaleString('vi-VN', { minimumFractionDigits: decimalCount, maximumFractionDigits: decimalCount });
    }
    return num.toLocaleString('vi-VN');
}

export function handleIntegerInput(event) {
    const input = event.target;
    let num = parseNumber(input.value);
    if (isNaN(num)) num = 0;
    input.value = num.toLocaleString('vi-VN');
    const changeEvent = new Event('change', { bubbles: true });
    input.dispatchEvent(changeEvent);
}

export function handleQuantityInput(event) {
    const input = event.target;
    let num = parseNumber(input.value);
    if (isNaN(num)) num = 0;
    input.value = num.toLocaleString('vi-VN');
    const changeEvent = new Event('change', { bubbles: true });
    input.dispatchEvent(changeEvent);
}

// ========== ALIAS ==========
export const getRawInteger = getIntegerFromInput;
export const getRawMoney = getIntegerFromInput;
export const getRawQuantity = getNumberFromInput;
export const setFormattedValue = setInputValue;
export const setMoneyValue = setInputValue;
export const setQuantityValue = setInputValue;
export const handleMoneyInput = handleIntegerInput;

// ========== COLUMN CONFIGURATION ==========
const COLUMN_CONFIG_KEY = 'steeltrack_column_config';

export const DEFAULT_COLUMNS = [
    { key: 'id', label: 'Mã', visible: true, width: 80, sortable: true },
    { key: 'name', label: 'Tên vật tư', visible: true, width: 200, sortable: true },
    { key: 'cat', label: 'Loại', visible: true, width: 120, sortable: true },
    { key: 'unit', label: 'ĐVT', visible: true, width: 80, sortable: true },
    { key: 'qty', label: 'Tồn kho', visible: true, width: 120, sortable: true },
    { key: 'cost', label: 'Đơn giá gốc', visible: true, width: 130, sortable: true },
    { key: 'status', label: 'TT', visible: true, width: 60, sortable: true },
    { key: 'note', label: 'Ghi chú', visible: true, width: 150, sortable: false },
    { key: 'actions', label: 'Thao tác', visible: true, width: 100, sortable: false }
];

export function getColumnConfig() {
    try {
        const saved = localStorage.getItem(COLUMN_CONFIG_KEY);
        if (saved) return JSON.parse(saved);
    } catch(e) {}
    return { columns: [...DEFAULT_COLUMNS], sortColumn: 'name', sortDirection: 'asc' };
}

export function saveColumnConfig(config) {
    try {
        localStorage.setItem(COLUMN_CONFIG_KEY, JSON.stringify(config));
    } catch(e) {}
}

export function updateColumnWidth(columnKey, width) {
    const config = getColumnConfig();
    const col = config.columns.find(c => c.key === columnKey);
    if (col) {
        col.width = Math.max(50, Math.min(400, width));
        saveColumnConfig(config);
    }
}

export function toggleColumnVisibility(columnKey) {
    const config = getColumnConfig();
    const col = config.columns.find(c => c.key === columnKey);
    if (col) {
        col.visible = !col.visible;
        saveColumnConfig(config);
    }
}

export function setSortConfig(columnKey) {
    const config = getColumnConfig();
    if (config.sortColumn === columnKey) {
        config.sortDirection = config.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        config.sortColumn = columnKey;
        config.sortDirection = 'asc';
    }
    saveColumnConfig(config);
}

export function getSortedData(data, sortColumn, sortDirection) {
    if (!sortColumn) return data;
    const col = DEFAULT_COLUMNS.find(c => c.key === sortColumn);
    if (!col || !col.sortable) return data;
    
    return [...data].sort((a, b) => {
        let valA = a[sortColumn];
        let valB = b[sortColumn];
        
        if (sortColumn === 'qty' || sortColumn === 'cost') {
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
        } else {
            valA = (valA || '').toString().toLowerCase();
            valB = (valB || '').toString().toLowerCase();
        }
        
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
}

// ========== FAVORITES ==========
const FAVORITES_KEY = 'steeltrack_favorites';

export function getFavorites() {
    try {
        const saved = localStorage.getItem(FAVORITES_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch(e) { return []; }
}

export function toggleFavorite(itemId) {
    let favorites = getFavorites();
    if (favorites.includes(itemId)) {
        favorites = favorites.filter(id => id !== itemId);
    } else {
        favorites.push(itemId);
    }
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    return favorites;
}

export function isFavorite(itemId) {
    return getFavorites().includes(itemId);
}

// ========== DEBOUNCE ==========
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}