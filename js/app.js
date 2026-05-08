// Detect mobile device
import { isMobileDevice } from './modules/mobile_view.js';
const isMobile = isMobileDevice();
import { state, saveState, loadState, addLog } from './modules/state.js';
window.state = state;
window.saveState = saveState;
window.loadState = loadState;
window.addLog = addLog;

import { renderLogin, renderSidebar, renderTopbar, switchPane, setCurrentUser, getCurrentUser, closeModal, showModal } from './modules/auth.js';
import { renderMaterials, openMatModal, editMaterial, updateMaterial, deleteMaterial, saveMat } from './modules/materials.js';
import { renderProjects, openProjectModal, saveProject, deleteProject, showProjectDetail, exportProjectDetail, exportAllProjectsReport } from './modules/projects.js';
import { renderStructures } from './modules/structures.js';
import { renderSuppliers, openSupplierModal, saveSupplier, updateSupplier, deleteSupplier, viewSupplierHistory, showSupplierDetail, exportSupplierDetail, exportAllSuppliersReport } from './modules/suppliers.js';
import { openPurchaseModal, savePurchase, openTxnModal, saveExport, calculatePurchaseTotal, calculateExportTotal, openPurchaseModalWithSupplier, openReturnModal, saveReturn, savePurchaseWithSupplier, clearReturnAttachment } from './modules/transactions.js';
import { renderLogs } from './modules/logs.js';
import { renderDashboard, renderDashboardChart, checkAutoBackup, requestNotificationPermission, bindDashboardSearchEvents } from './modules/charts.js';
import { exportToExcel } from './modules/export.js';
import { initShortcuts } from './modules/shortcuts.js';
import { renderSettings, addCategory, addUnit, toggleTheme, addUser, deleteUser, changePassword, toggleUserPermission } from './modules/settings.js';
import { showImportModal, importMaterialsFromExcel, importProjectsFromExcel, importSuppliersFromExcel } from './modules/import.js';

let sidebarCollapsed = localStorage.getItem('steeltrack_sidebar_collapsed') === 'true';

function render() {
    const root = document.getElementById('root');
    const currentUser = getCurrentUser();
    if (!currentUser) { root.innerHTML = renderLogin(); return; }
// ===== MOBILE: GIAO DIỆN RIÊNG =====
    if (isMobile) {
        import('./modules/mobile_view.js').then(function(m) {
            root.innerHTML = m.renderMobileView();
            m.initMobileEvents();
        });
        return;
    }
    // ===== HẾT MOBILE =====
    
    const cp = state.currentPane;    
    root.innerHTML = `<div id="app-layout"><div class="sidebar ${sidebarCollapsed ? 'collapsed' : ''}">${renderSidebar()}</div><div class="main-content">${renderTopbar()}<div id="pane-entry" class="pane ${cp==='entry'?'active':''}">${renderMaterials()}</div><div id="pane-dashboard" class="pane ${cp==='dashboard'?'active':''}">${renderDashboard()}</div><div id="pane-structures" class="pane ${cp==='structures'?'active':''}">${renderStructures()}</div>
        <div id="pane-projects" class="pane ${cp==='projects'?'active':''}">${renderProjects()}</div><div id="pane-suppliers" class="pane ${cp==='suppliers'?'active':''}">${renderSuppliers()}</div><div id="pane-logs" class="pane ${cp==='logs'?'active':''}">${renderLogs()}</div><div id="pane-settings" class="pane ${cp==='settings'?'active':''}">${renderSettings()}</div><div id="modal-area"></div></div></div>`;
    if (cp === 'dashboard') setTimeout(() => { renderDashboardChart(); bindDashboardSearchEvents(); }, 100);
}

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
    render();
};

loadState().then(() => {
    checkAutoBackup();
    initShortcuts();
    window.requestNotification = requestNotificationPermission;
    window.login = (uid) => { setCurrentUser(state.data.users.find(u => u.id === uid)); addLog('Đăng nhập', 'OK'); switchPane('entry'); render(); };
    window.logout = () => { addLog('Đăng xuất', 'OK'); setCurrentUser(null); render(); };
    window.switchPane = switchPane;
    window.closeModal = closeModal; window.showModal = showModal;
    window.openMatModal = openMatModal; window.editMaterial = editMaterial;
    window.updateMaterial = updateMaterial; window.deleteMaterial = deleteMaterial; window.saveMat = saveMat;
    window.openProjectModal = openProjectModal; window.saveProject = saveProject; window.deleteProject = deleteProject;
    window.showProjectDetail = showProjectDetail; window.exportProjectDetail = exportProjectDetail; window.exportAllProjectsReport = exportAllProjectsReport;
    window.openSupplierModal = openSupplierModal; window.saveSupplier = saveSupplier; window.updateSupplier = updateSupplier;
    window.deleteSupplier = deleteSupplier; window.showSupplierDetail = showSupplierDetail; window.viewSupplierHistory = viewSupplierHistory;
    window.exportSupplierDetail = exportSupplierDetail; window.exportAllSuppliersReport = exportAllSuppliersReport;
    window.openPurchaseModal = openPurchaseModal; window.savePurchase = savePurchase;
    window.openTxnModal = (type, pid = null) => openTxnModal(type, pid); window.saveExport = saveExport;
    window.calculatePurchaseTotal = calculatePurchaseTotal; window.calculateExportTotal = calculateExportTotal;
    window.openPurchaseModalWithSupplier = openPurchaseModalWithSupplier;
    window.savePurchaseWithSupplier = savePurchaseWithSupplier;
    window.openReturnModal = openReturnModal; window.saveReturn = saveReturn; window.clearReturnAttachment = clearReturnAttachment;
    window.addCategory = addCategory; window.addUnit = addUnit; window.toggleTheme = toggleTheme;
    window.saveNow = function() { saveState(); alert("✅ Đã lưu vào database!"); };
    window.addUser = addUser; window.deleteUser = deleteUser; window.changePassword = changePassword; window.toggleUserPermission = toggleUserPermission;
    window.exportToExcel = exportToExcel; window.showImportModal = showImportModal;
    window.render = render;
    render();
});
