import { state, saveState, loadState, addLog } from './modules/state.js';
import { renderLogin, renderSidebar, renderTopbar, switchPane, setCurrentUser, getCurrentUser, closeModal, showModal } from './modules/auth.js';
import { renderMaterials, addMaterial, updateMaterial, deleteMaterial, getMaterials, openMatModal, editMaterial, saveMat } from './modules/materials.js';
import { renderProjects, addProject, deleteProject, getProjects, openProjectModal, saveProject, filterProjects, clearProjectSearch, showProjectDetail, exportProjectDetail, exportAllProjectsReport } from './modules/projects.js';
import { renderSuppliers, addSupplier, deleteSupplier, getSuppliers, openSupplierModal, saveSupplier, updateSupplier, filterSuppliers, clearSupplierSearch, viewSupplierHistory, showSupplierDetail, exportSupplierDetail, exportAllSuppliersReport } from './modules/suppliers.js';
import { importMaterial, exportMaterial, getTransactions, openPurchaseModal, savePurchase, openTxnModal, saveExport, calculatePurchaseTotal, calculateExportTotal, openPurchaseModalWithSupplier } from './modules/transactions.js';
import { renderLogs } from './modules/logs.js';
import { renderDashboard, renderDashboardChart, checkAutoBackup, checkLowStockNotification, requestNotificationPermission } from './modules/charts.js';
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

function render() {
    const root = document.getElementById('root');
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
        root.innerHTML = renderLogin();
        return;
    }
    
    const currentPane = state.currentPane;
    
    root.innerHTML = `
        <div style="display:flex">
            ${renderSidebar()}
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
        setTimeout(() => renderDashboardChart(), 100);
    }
    if (state.currentPane === 'settings') {
        setTimeout(() => {
            import('./modules/settings.js').then(m => {
                if (m.bindUISettingsEvents) m.bindUISettingsEvents();
            });
        }, 100);
    }
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

window.debug = { state, saveState, addLog };
window.renderApp = render;
window.render = render;

render();