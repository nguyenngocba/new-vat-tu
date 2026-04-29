import { state, saveState, loadState, addLog } from './modules/state.js';
import { renderLogin, renderSidebar, renderTopbar, switchPane, setCurrentUser, getCurrentUser, closeModal, showModal } from './modules/auth.js';
import { renderMaterials, addMaterial, updateMaterial, deleteMaterial, getMaterials, openMatModal, editMaterial, saveMat } from './modules/materials.js';
import { renderProjects, addProject, deleteProject, getProjects, openProjectModal, saveProject, filterProjects, clearProjectSearch, showProjectDetail, exportProjectDetail, exportAllProjectsReport } from './modules/projects.js';
import { renderSuppliers, addSupplier, deleteSupplier, getSuppliers, openSupplierModal, saveSupplier, updateSupplier, filterSuppliers, clearSupplierSearch, viewSupplierHistory, showSupplierDetail, exportSupplierDetail, exportAllSuppliersReport } from './modules/suppliers.js';
import { importMaterial, exportMaterial, getTransactions, openPurchaseModal, savePurchase, openTxnModal, saveExport, calculatePurchaseTotal, calculateExportTotal, openPurchaseModalWithSupplier, openReturnModal, saveReturn, clearReturnAttachment } from './modules/transactions.js';
import { renderLogs } from './modules/logs.js';
import { renderDashboard, renderDashboardChart, checkAutoBackup, checkLowStockNotification, requestNotificationPermission, bindDashboardSearchEvents } from './modules/charts.js';
import { exportToExcel } from './modules/export.js';
import { initShortcuts } from './modules/shortcuts.js';
import { renderSettings, addCategory, addUnit, toggleTheme, addUser, deleteUser, changePassword, toggleUserPermission } from './modules/settings.js';
import { showImportModal, importMaterialsFromExcel, importProjectsFromExcel, importSuppliersFromExcel } from './modules/import.js';

// Initialize
loadState();
checkAutoBackup();
initShortcuts();

setTimeout(() => {
    if (typeof XLSX !== 'undefined') {
        console.log('✅ Thư viện XLSX đã sẵn sàng');
    } else {
        console.warn('⚠️ Thư viện XLSX chưa được tải');
    }
}, 1000);

window.requestNotification = () => requestNotificationPermission();

// ===== SIDEBAR TOGGLE =====
let sidebarCollapsed = false;
const savedSidebarState = localStorage.getItem('steeltrack_sidebar_collapsed');
if (savedSidebarState === 'true') sidebarCollapsed = true;

window.toggleSidebar = function() {
    sidebarCollapsed = !sidebarCollapsed;
    localStorage.setItem('steeltrack_sidebar_collapsed', sidebarCollapsed);
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        if (sidebarCollapsed) {
            sidebar.classList.add('collapsed');
        } else {
            sidebar.classList.remove('collapsed');
        }
    }
};

function render() {
    const root = document.getElementById('root');
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
        root.innerHTML = renderLogin();
        return;
    }
    
    const currentPane = state.currentPane;
    const sidebarClass = sidebarCollapsed ? 'sidebar collapsed' : 'sidebar';
    
    root.innerHTML = `
        <div id="app-layout">
            <div class="${sidebarClass}">
                ${renderSidebarContent()}
            </div>
            <div class="main-content">
                ${renderTopbar()}
                <div id="pane-entry" class="pane ${currentPane === 'entry' ? 'active' : ''}">${renderMaterials()}</div>
                <div id="pane-dashboard" class="pane ${currentPane === 'dashboard' ? 'active' : ''}">${renderDashboard()}</div>
                <div id="pane-projects" class="pane ${currentPane === 'projects' ? 'active' : ''}">${renderProjects()}</div>
                <div id="pane-suppliers" class="pane ${currentPane === 'suppliers' ? 'active' : ''}">${renderSuppliers()}</div>
                <div id="pane-logs" class="pane ${currentPane === 'logs' ? 'active' : ''}">${renderLogs()}</div>
                <div id="pane-settings" class="pane ${currentPane === 'settings' ? 'active' : ''}">${renderSettings()}</div>
                <div id="modal-area"></div>
            </div>
        </div>
    `;
    
    if (state.currentPane === 'dashboard') {
        setTimeout(() => {
            renderDashboardChart();
            bindDashboardSearchEvents();
        }, 100);
    }
    if (state.currentPane === 'settings') {
        setTimeout(() => {
            import('./modules/settings.js').then(m => {
                if (m.bindUISettingsEvents) m.bindUISettingsEvents();
            });
        }, 100);
    }
}

// Render sidebar content (tách riêng để dùng trong app.js)
function renderSidebarContent() {
    const hasAccessSettings = state.currentUser?.permissions?.canAccessSettings || state.currentUser?.role === 'admin';
    // Import escapeHtml từ state
    const escapeHtml = (str) => { if(!str) return ''; return str.replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'})[m]); };
    
    return `
        <div class="sidebar-logo" onclick="if(document.querySelector('.sidebar').classList.contains('collapsed')) toggleSidebar()">
            🏭 TRIVIETSTEEL
            <button class="sidebar-toggle-btn" onclick="event.stopPropagation();toggleSidebar()" title="Ẩn/Hiện menu">
                ${sidebarCollapsed ? '▶' : '◀'}
            </button>
        </div>
        <div class="sidebar-user"><div class="uname">${escapeHtml(state.currentUser.name)}</div><div class="urole">${state.currentUser.role === 'admin' ? 'Quản trị viên' : 'Nhân viên kho'}</div></div>
        <div class="sidebar-nav">
            <div class="nav-item ${state.currentPane === 'entry' ? 'active' : ''}" onclick="switchPane('entry')">📦 <span>Quản lý kho</span></div>
            <div class="nav-item ${state.currentPane === 'dashboard' ? 'active' : ''}" onclick="switchPane('dashboard')">📊 <span>Thống kê</span></div>
            <div class="nav-item ${state.currentPane === 'projects' ? 'active' : ''}" onclick="switchPane('projects')">🏗️ <span>Công trình</span></div>
            <div class="nav-item ${state.currentPane === 'suppliers' ? 'active' : ''}" onclick="switchPane('suppliers')">🏭 <span>Nhà cung cấp</span></div>
            <div class="nav-item ${state.currentPane === 'logs' ? 'active' : ''}" onclick="switchPane('logs')">📋 <span>Nhật ký</span></div>
            ${hasAccessSettings ? `<div class="nav-item ${state.currentPane === 'settings' ? 'active' : ''}" onclick="switchPane('settings')">⚙️ <span>Cài đặt</span></div>` : ''}
        </div>
        <div class="sidebar-bottom"><button onclick="logout()" style="width:100%">🚪 <span>Đăng xuất</span></button></div>
    `;
}

function login(userId) {
    const user = state.data.users.find(u => u.id === userId);
    if (user) {
        setCurrentUser(user);
        addLog('Đăng nhập', `${user.name}`);
        render();
    }
}

function logout() {
    addLog('Đăng xuất', getCurrentUser()?.name);
    setCurrentUser(null);
    render();
}

// Global functions
window.login = login;
window.logout = logout;
window.switchPane = switchPane;
window.closeModal = closeModal;
window.showModal = showModal;
window.toggleSidebar = window.toggleSidebar;

// Material
window.openMatModal = openMatModal;
window.editMaterial = editMaterial;
window.updateMaterial = updateMaterial;
window.deleteMaterial = deleteMaterial;
window.saveMat = saveMat;

// Project
window.openProjectModal = openProjectModal;
window.saveProject = saveProject;
window.deleteProject = deleteProject;
window.filterProjects = filterProjects;
window.clearProjectSearch = clearProjectSearch;
window.showProjectDetail = showProjectDetail;
window.exportProjectDetail = exportProjectDetail;
window.exportAllProjectsReport = exportAllProjectsReport;

// Supplier
window.openSupplierModal = openSupplierModal;
window.saveSupplier = saveSupplier;
window.updateSupplier = updateSupplier;
window.deleteSupplier = deleteSupplier;
window.filterSuppliers = filterSuppliers;
window.clearSupplierSearch = clearSupplierSearch;
window.viewSupplierHistory = viewSupplierHistory;
window.showSupplierDetail = showSupplierDetail;
window.exportSupplierDetail = exportSupplierDetail;
window.exportAllSuppliersReport = exportAllSuppliersReport;

// Transaction
window.openPurchaseModal = openPurchaseModal;
window.savePurchase = savePurchase;
window.openTxnModal = (type, projectId = null) => openTxnModal(type, projectId);
window.saveExport = saveExport;
window.calculatePurchaseTotal = calculatePurchaseTotal;
window.calculateExportTotal = calculateExportTotal;
window.openPurchaseModalWithSupplier = openPurchaseModalWithSupplier;

// Return transaction
window.openReturnModal = openReturnModal;
window.saveReturn = saveReturn;
window.clearReturnAttachment = clearReturnAttachment;

// Settings
window.addCategory = addCategory;
window.addUnit = addUnit;
window.toggleTheme = toggleTheme;
window.addUser = addUser;
window.deleteUser = deleteUser;
window.changePassword = changePassword;
window.toggleUserPermission = toggleUserPermission;

// Export/Import
window.exportToExcel = exportToExcel;
window.showImportModal = showImportModal;
window.importMaterialsFromExcel = importMaterialsFromExcel;
window.importProjectsFromExcel = importProjectsFromExcel;
window.importSuppliersFromExcel = importSuppliersFromExcel;

// Preview invoice
window.previewInvoiceImage = function() {
    const file = document.getElementById('purchase-invoice')?.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        window.currentInvoiceBase64 = e.target.result;
        const previewDiv = document.getElementById('invoice-preview');
        if (previewDiv) {
            previewDiv.innerHTML = `<img src="${window.currentInvoiceBase64}" class="invoice-img" onclick="window.open(this.src)"><br><button class="sm" onclick="window.clearInvoiceImage()">🗑️ Xóa ảnh</button>`;
        }
    };
    reader.readAsDataURL(file);
};

window.clearInvoiceImage = function() {
    window.currentInvoiceBase64 = null;
    const previewDiv = document.getElementById('invoice-preview');
    if (previewDiv) previewDiv.innerHTML = '';
    const fileInput = document.getElementById('purchase-invoice');
    if (fileInput) fileInput.value = '';
};

window.clearExportAttachment = function() {
    window.currentExportAttachmentBase64 = null;
    const previewDiv = document.getElementById('export-attachment-preview');
    if (previewDiv) previewDiv.innerHTML = '';
    const fileInput = document.getElementById('export-attachment');
    if (fileInput) fileInput.value = '';
};

window.debug = { state, saveState, addLog };
window.renderApp = render;
window.render = render;

render();