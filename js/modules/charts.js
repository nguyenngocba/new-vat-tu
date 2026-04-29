import { state, formatMoney, escapeHtml } from './state.js';
import { formatMoneyVND } from './utils.js';

let stockChart = null;
let projectChart = null;
let supplierChart = null;
let categoryChart = null;
let monthlyChart = null;
let transactionChart = null;

// Bộ lọc nâng cao
let advancedFilters = {
    dateFrom: '',
    dateTo: '',
    materialCategory: 'all',
    projectId: 'all',
    supplierId: 'all',
    transactionType: 'all'
};

// Dashboard tab hiện tại
let currentDashboardTab = 'overview'; // 'overview' | 'projects' | 'suppliers'

let searchTimeout = null;

// ===== EXPORT CÁC HÀM CẦN THIẾT =====

export function checkAutoBackup() {
    const lastBackupKey = 'steeltrack_last_backup_date';
    const today = new Date().toISOString().split('T')[0];
    const lastBackup = localStorage.getItem(lastBackupKey);
    
    if (lastBackup !== today) {
        const backupData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            data: {
                materials: state.data.materials,
                transactions: state.data.transactions,
                projects: state.data.projects,
                suppliers: state.data.suppliers,
                logs: state.data.logs.slice(0, 100),
                categories: state.data.categories,
                units: state.data.units,
                nextId: { nextMid: state.data.nextMid, nextTid: state.data.nextTid, nextPid: state.data.nextPid, nextSid: state.data.nextSid, nextLogId: state.data.nextLogId }
            }
        };
        localStorage.setItem('steeltrack_auto_backup', JSON.stringify(backupData));
        localStorage.setItem(lastBackupKey, today);
        console.log('✅ Đã tạo backup tự động hàng ngày');
    }
}

export function checkLowStockNotification() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const lowStockItems = state.data.materials.filter(m => m.qty <= m.low);
    if (lowStockItems.length > 0) {
        new Notification('⚠️ Cảnh báo tồn kho thấp', {
            body: `${lowStockItems.length} vật tư đang sắp hết hàng: ${lowStockItems.slice(0, 3).map(m => m.name).join(', ')}${lowStockItems.length > 3 ? '...' : ''}`,
            icon: '⚠️'
        });
    }
}

export function requestNotificationPermission() {
    if ('Notification' in window) {
        if (Notification.permission === 'granted') {
            new Notification('TRIVIETSTEEL Pro', { body: 'Thông báo đã được bật!', icon: '🏭' });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification('TRIVIETSTEEL Pro', { body: 'Bạn sẽ nhận được cảnh báo khi hàng sắp hết!', icon: '🏭' });
                }
            });
        }
    } else {
        alert('Trình duyệt của bạn không hỗ trợ thông báo');
    }
}

// Hàm lọc giao dịch theo bộ lọc nâng cao
function getFilteredTransactions() {
    let transactions = [...state.data.transactions];
    
    if (advancedFilters.dateFrom) {
        const fromDate = new Date(advancedFilters.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        transactions = transactions.filter(t => new Date(t.datetime || t.date) >= fromDate);
    }
    if (advancedFilters.dateTo) {
        const toDate = new Date(advancedFilters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        transactions = transactions.filter(t => new Date(t.datetime || t.date) <= toDate);
    }
    
    if (advancedFilters.transactionType !== 'all') {
        transactions = transactions.filter(t => t.type === advancedFilters.transactionType);
    }
    
    if (advancedFilters.materialCategory !== 'all') {
        transactions = transactions.filter(t => {
            const mat = state.data.materials.find(m => m.id === t.mid);
            return mat && mat.cat === advancedFilters.materialCategory;
        });
    }
    
    if (advancedFilters.projectId !== 'all') {
        transactions = transactions.filter(t => t.projectId === advancedFilters.projectId);
    }
    
    if (advancedFilters.supplierId !== 'all') {
        transactions = transactions.filter(t => t.supplierId === advancedFilters.supplierId);
    }
    
    return transactions;
}

function getMonthlyStats() {
    const months = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months[key] = { import: 0, export: 0, label: `${d.getMonth() + 1}/${d.getFullYear()}` };
    }
    
    const filteredTransactions = getFilteredTransactions();
    
    filteredTransactions.forEach(t => {
        const dateStr = t.datetime || t.date;
        const date = new Date(dateStr);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (months[key]) {
            if (t.type === 'purchase') months[key].import += t.totalAmount || 0;
            if (t.type === 'usage') months[key].export += t.totalAmount || 0;
            if (t.type === 'return') months[key].export -= t.totalAmount || 0;
        }
    });
    
    return Object.values(months);
}

function getCategoryStats() {
    const filteredTransactions = getFilteredTransactions();
    const categoryStats = {};
    
    filteredTransactions.forEach(t => {
        const mat = state.data.materials.find(m => m.id === t.mid);
        if (mat) {
            const cat = mat.cat;
            if (!categoryStats[cat]) categoryStats[cat] = 0;
            if (t.type === 'purchase') categoryStats[cat] += t.totalAmount || 0;
            if (t.type === 'usage') categoryStats[cat] -= t.totalAmount || 0;
            if (t.type === 'return') categoryStats[cat] += t.totalAmount || 0;
        }
    });
    
    return categoryStats;
}

function getSupplierStats() {
    const filteredTransactions = getFilteredTransactions();
    const supplierStats = {};
    
    filteredTransactions.forEach(t => {
        if (t.type === 'purchase' && t.supplierId) {
            if (!supplierStats[t.supplierId]) supplierStats[t.supplierId] = 0;
            supplierStats[t.supplierId] += t.totalAmount || 0;
        }
    });
    
    return supplierStats;
}

function getProjectStats() {
    const filteredTransactions = getFilteredTransactions();
    const projectStats = {};
    
    filteredTransactions.forEach(t => {
        if ((t.type === 'usage' || t.type === 'return') && t.projectId) {
            if (!projectStats[t.projectId]) projectStats[t.projectId] = 0;
            if (t.type === 'usage') projectStats[t.projectId] += t.totalAmount || 0;
            if (t.type === 'return') projectStats[t.projectId] -= t.totalAmount || 0;
        }
    });
    
    return projectStats;
}

function getTotalValues() {
    const filteredTransactions = getFilteredTransactions();
    let totalImport = 0;
    let totalExport = 0;
    let totalReturn = 0;
    
    filteredTransactions.forEach(t => {
        if (t.type === 'purchase') totalImport += t.totalAmount || 0;
        if (t.type === 'usage') totalExport += t.totalAmount || 0;
        if (t.type === 'return') totalReturn += t.totalAmount || 0;
    });
    
    return { totalImport, totalExport, totalReturn, netSpent: totalExport - totalReturn };
}

function renderAdvancedFilters() {
    const categories = ['all', ...state.data.categories];
    const projects = [{ id: 'all', name: '📂 Tất cả công trình' }, ...state.data.projects];
    const suppliers = [{ id: 'all', name: '📂 Tất cả nhà cung cấp' }, ...state.data.suppliers];
    
    return `
        <div class="card advanced-filters-section" style="margin-bottom: 16px;">
            <div class="advanced-filters-header" onclick="window.toggleAdvancedFilters()">
                <span class="sec-title" style="margin-bottom:0;">🔧 TÌM KIẾM NÂNG CAO</span>
                <span id="filter-toggle-icon" style="font-size: 16px;">▶</span>
            </div>
            <div id="advanced-filters-content" class="advanced-filters-body">
                <div class="grid2" style="margin-bottom: 12px;">
                    <div class="form-group">
                        <label class="form-label">📅 Từ ngày</label>
                        <input type="date" id="filter-date-from" value="${advancedFilters.dateFrom}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">📅 Đến ngày</label>
                        <input type="date" id="filter-date-to" value="${advancedFilters.dateTo}">
                    </div>
                </div>
                <div class="grid2" style="margin-bottom: 12px;">
                    <div class="form-group">
                        <label class="form-label">📦 Loại giao dịch</label>
                        <select id="filter-transaction-type">
                            <option value="all" ${advancedFilters.transactionType === 'all' ? 'selected' : ''}>📂 Tất cả</option>
                            <option value="purchase" ${advancedFilters.transactionType === 'purchase' ? 'selected' : ''}>📥 Nhập kho</option>
                            <option value="usage" ${advancedFilters.transactionType === 'usage' ? 'selected' : ''}>📤 Xuất kho</option>
                            <option value="return" ${advancedFilters.transactionType === 'return' ? 'selected' : ''}>🔄 Trả hàng</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">🏷️ Danh mục vật tư</label>
                        <select id="filter-material-category">
                            ${categories.map(c => `<option value="${c}" ${advancedFilters.materialCategory === c ? 'selected' : ''}>${c === 'all' ? '📂 Tất cả' : c}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="grid2" style="margin-bottom: 12px;">
                    <div class="form-group">
                        <label class="form-label">🏗️ Công trình</label>
                        <select id="filter-project">
                            ${projects.map(p => `<option value="${p.id}" ${advancedFilters.projectId === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">🏭 Nhà cung cấp</label>
                        <select id="filter-supplier">
                            ${suppliers.map(s => `<option value="${s.id}" ${advancedFilters.supplierId === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="filter-apply" class="sm primary">🔍 Áp dụng bộ lọc</button>
                    <button id="filter-reset" class="sm">🗑️ Đặt lại</button>
                </div>
            </div>
        </div>
    `;
}

window.toggleAdvancedFilters = function() {
    const content = document.getElementById('advanced-filters-content');
    const icon = document.getElementById('filter-toggle-icon');
    if (content && icon) {
        if (content.classList.contains('show')) {
            content.classList.remove('show');
            icon.innerHTML = '▶';
        } else {
            content.classList.add('show');
            icon.innerHTML = '▼';
        }
    }
};

function applyFilters() {
    advancedFilters.dateFrom = document.getElementById('filter-date-from')?.value || '';
    advancedFilters.dateTo = document.getElementById('filter-date-to')?.value || '';
    advancedFilters.transactionType = document.getElementById('filter-transaction-type')?.value || 'all';
    advancedFilters.materialCategory = document.getElementById('filter-material-category')?.value || 'all';
    advancedFilters.projectId = document.getElementById('filter-project')?.value || 'all';
    advancedFilters.supplierId = document.getElementById('filter-supplier')?.value || 'all';
    
    updateDashboardContent();
}

function resetFilters() {
    advancedFilters = {
        dateFrom: '',
        dateTo: '',
        materialCategory: 'all',
        projectId: 'all',
        supplierId: 'all',
        transactionType: 'all'
    };
    
    const dateFromInput = document.getElementById('filter-date-from');
    const dateToInput = document.getElementById('filter-date-to');
    const transactionTypeSelect = document.getElementById('filter-transaction-type');
    const categorySelect = document.getElementById('filter-material-category');
    const projectSelect = document.getElementById('filter-project');
    const supplierSelect = document.getElementById('filter-supplier');
    
    if (dateFromInput) dateFromInput.value = '';
    if (dateToInput) dateToInput.value = '';
    if (transactionTypeSelect) transactionTypeSelect.value = 'all';
    if (categorySelect) categorySelect.value = 'all';
    if (projectSelect) projectSelect.value = 'all';
    if (supplierSelect) supplierSelect.value = 'all';
    
    updateDashboardContent();
}

function updateDashboardContent() {
    const dashboardPane = document.getElementById('pane-dashboard');
    if (dashboardPane) {
        dashboardPane.innerHTML = renderDashboard();
        setTimeout(() => {
            renderDashboardChart();
            bindDashboardFilterEvents();
        }, 50);
    }
}

function getFilteredMaterials() {
    const filteredTransactions = getFilteredTransactions();
    const materialIds = new Set(filteredTransactions.map(t => t.mid));
    if (materialIds.size === 0) return state.data.materials;
    return state.data.materials.filter(m => materialIds.has(m.id));
}

function renderTransactionList() {
    const filteredTransactions = getFilteredTransactions()
        .sort((a, b) => new Date(b.datetime || b.date) - new Date(a.datetime || a.date))
        .slice(0, 20);
    
    if (filteredTransactions.length === 0) {
        return '<tr><td colspan="7" style="text-align: center;">📭 Không có giao dịch nào phù hợp</td></tr>';
    }
    
    return filteredTransactions.map(t => {
        const mat = state.data.materials.find(m => m.id === t.mid);
        const displayDateTime = t.datetime ? new Date(t.datetime).toLocaleString('vi-VN') : t.date;
        let typeIcon = '';
        let typeLabel = '';
        let targetName = '';
        
        if (t.type === 'purchase') {
            typeIcon = '📥';
            typeLabel = 'Nhập kho';
            const supplier = state.data.suppliers.find(s => s.id === t.supplierId);
            targetName = supplier?.name || 'N/A';
        } else if (t.type === 'usage') {
            typeIcon = '📤';
            typeLabel = 'Xuất kho';
            const project = state.data.projects.find(p => p.id === t.projectId);
            targetName = project?.name || 'N/A';
        } else {
            typeIcon = '🔄';
            typeLabel = 'Trả hàng';
            const project = state.data.projects.find(p => p.id === t.projectId);
            targetName = project?.name || 'N/A';
        }
        
        const displayQty = typeof t.qty === 'number' ? t.qty.toLocaleString('vi-VN') : parseFloat(t.qty || 0).toLocaleString('vi-VN');
        
        return `<tr>
            <td style="white-space: nowrap;">${displayDateTime}</td>
            <td style="text-align: center; white-space: nowrap;">${typeIcon} ${typeLabel}</td>
            <td style="white-space: nowrap;">${escapeHtml(mat?.name || 'N/A')}</td>
            <td style="text-align: right; white-space: nowrap;">${displayQty} ${mat?.unit || ''}</td>
            <td style="text-align: right; white-space: nowrap;">${formatMoneyVND(t.unitPrice)}</td>
            <td style="text-align: right; white-space: nowrap;" class="text-warning">${formatMoneyVND(t.totalAmount)}</td>
            <td style="white-space: nowrap;">${escapeHtml(targetName)}</td>
        </tr>`;
    }).join('');
}

// ===== SWITCH DASHBOARD TAB =====
window.switchDashboardTab = function(tabName) {
    currentDashboardTab = tabName;
    updateDashboardContent();
};

// ===== RENDER DASHBOARD =====
export function renderDashboard() {
    const filteredMaterials = getFilteredMaterials();
    const { totalImport, totalExport, totalReturn, netSpent } = getTotalValues();
    
    const totalInventory = state.data.materials.reduce((s, m) => s + (m.qty * m.cost), 0);
    
    const categoryStats = getCategoryStats();
    const topCategories = Object.entries(categoryStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    const supplierStats = getSupplierStats();
    const topSuppliers = Object.entries(supplierStats)
        .map(([id, total]) => {
            const supplier = state.data.suppliers.find(s => s.id === id);
            return { name: supplier?.name || 'Khác', total };
        })
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
    
    const projectStats = getProjectStats();
    const topProjects = Object.entries(projectStats)
        .map(([id, total]) => {
            const project = state.data.projects.find(p => p.id === id);
            return { name: project?.name || 'Khác', total };
        })
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
    
    const lowStockItems = state.data.materials.filter(m => m.qty <= m.low);
    
    const lowStockHtml = lowStockItems.length > 0 ? `
        <div class="card" style="margin-bottom: 16px; background: var(--warn-bg); border-color: var(--warn);">
            <div class="sec-title" style="color: var(--warn-text);">⚠️ CẢNH BÁO TỒN KHO THẤP</div>
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                ${lowStockItems.map(m => `
                    <div class="metric-card" style="background: var(--surface);">
                        <div><strong>${escapeHtml(m.name)}</strong></div>
                        <div>Tồn: ${m.qty.toLocaleString('vi-VN')} ${m.unit}</div>
                        <div>Ngưỡng: ${m.low}</div>
                    </div>
                `).join('')}
            </div>
            <button class="sm" id="request-notification" style="margin-top: 10px;" onclick="window.requestNotification()">🔔 Bật thông báo</button>
        </div>
    ` : '';
    
    // ===== DASHBOARD TABS =====
    const tabsHtml = `
        <div class="dashboard-tabs">
            <div class="dashboard-tab ${currentDashboardTab === 'overview' ? 'active' : ''}" onclick="window.switchDashboardTab('overview')">📊 Tổng quan</div>
            <div class="dashboard-tab ${currentDashboardTab === 'projects' ? 'active' : ''}" onclick="window.switchDashboardTab('projects')">🏗️ Chi tiết công trình</div>
            <div class="dashboard-tab ${currentDashboardTab === 'suppliers' ? 'active' : ''}" onclick="window.switchDashboardTab('suppliers')">🏭 Chi tiết nhà cung cấp</div>
        </div>
    `;
    
    // ===== FILTERS (LUÔN ẨN MẶC ĐỊNH) =====
    const filtersHtml = renderAdvancedFilters();
    
    // ===== TAB CONTENT =====
    let tabContent = '';
    
    if (currentDashboardTab === 'overview') {
        tabContent = `
            <div class="grid4">
                <div class="metric-card">
                    <div class="metric-label">💰 TỔNG NHẬP KHO</div>
                    <div class="metric-val" style="color: var(--success-text);">${formatMoneyVND(totalImport)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">📤 TỔNG XUẤT KHO</div>
                    <div class="metric-val" style="color: var(--warn-text);">${formatMoneyVND(totalExport)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">🔄 TRẢ HÀNG VỀ KHO</div>
                    <div class="metric-val" style="color: var(--accent);">${formatMoneyVND(totalReturn)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">📦 CHI PHÍ THỰC TẾ</div>
                    <div class="metric-val">${formatMoneyVND(netSpent)}</div>
                </div>
            </div>
            
            <div class="grid4" style="margin-bottom: 18px;">
                <div class="metric-card" style="grid-column: span 4; background: var(--accent-bg);">
                    <div class="metric-label">🏪 GIÁ TRỊ TỒN KHO HIỆN TẠI</div>
                    <div class="metric-val" style="font-size: 28px;">${formatMoneyVND(totalInventory)}</div>
                    <div class="metric-sub">Tổng số mặt hàng: ${state.data.materials.length}</div>
                </div>
            </div>
            
            ${lowStockHtml}
            
            <div class="grid2" style="margin-bottom: 18px;">
                <div class="card">
                    <div class="sec-title">🏷️ TOP DANH MỤC VẬT TƯ</div>
                    ${topCategories.length > 0 ? `
                        <div class="tbl-wrap">
                            <table style="width: 100%;">
                                <thead><tr><th>Danh mục</th><th>Giá trị</th></tr></thead>
                                <tbody>
                                    ${topCategories.map(([cat, total]) => `
                                        <tr>
                                            <td><strong>${escapeHtml(cat)}</strong></td>
                                            <td class="text-warning">${formatMoneyVND(total)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : '<div class="metric-sub">Chưa có dữ liệu</div>'}
                </div>
                <div class="card">
                    <div class="sec-title">🏭 TOP NHÀ CUNG CẤP</div>
                    ${topSuppliers.length > 0 ? `
                        <div class="tbl-wrap">
                            <table style="width: 100%;">
                                <thead><tr><th>Nhà cung cấp</th><th>Giá trị</th></tr></thead>
                                <tbody>
                                    ${topSuppliers.map(s => `
                                        <tr>
                                            <td><strong>${escapeHtml(s.name)}</strong></td>
                                            <td class="text-warning">${formatMoneyVND(s.total)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : '<div class="metric-sub">Chưa có dữ liệu</div>'}
                </div>
            </div>
            
            <div class="grid2" style="margin-bottom: 18px;">
                <div class="card">
                    <div class="sec-title">🏗️ TOP CÔNG TRÌNH</div>
                    ${topProjects.length > 0 ? `
                        <div class="tbl-wrap">
                            <table style="width: 100%;">
                                <thead><tr><th>Công trình</th><th>Chi phí</th></tr></thead>
                                <tbody>
                                    ${topProjects.map(p => `
                                        <tr>
                                            <td><strong>${escapeHtml(p.name)}</strong></td>
                                            <td class="text-warning">${formatMoneyVND(p.total)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : '<div class="metric-sub">Chưa có dữ liệu</div>'}
                </div>
                <div class="card">
                    <div class="sec-title">📈 THỐNG KÊ NHẬP/XUẤT THEO THÁNG</div>
                    <div class="chart-container" style="height: 220px;"><canvas id="monthly-chart"></canvas></div>
                </div>
            </div>
            
            <div class="grid2" style="margin-bottom: 18px;">
                <div class="card">
                    <div class="sec-title">📊 BIỂU ĐỒ NHẬP/XUẤT THEO DANH MỤC</div>
                    <div class="chart-container" style="height: 250px;"><canvas id="category-pie-chart"></canvas></div>
                </div>
                <div class="card">
                    <div class="sec-title">📊 BIỂU ĐỒ NHẬP HÀNG THEO NHÀ CUNG CẤP</div>
                    <div class="chart-container" style="height: 250px;"><canvas id="supplier-pie-chart"></canvas></div>
                </div>
            </div>
            
            <div class="card">
                <div class="sec-title">📋 DANH SÁCH GIAO DỊCH THEO BỘ LỌC</div>
                <div class="tbl-wrap">
                    <table style="min-width: 800px; width: 100%;">
                        <thead>
                            <tr>
                                <th>Thời gian</th>
                                <th>Loại</th>
                                <th>Vật tư</th>
                                <th>Số lượng</th>
                                <th>Đơn giá</th>
                                <th>Thành tiền</th>
                                <th>Đối tượng</th>
                            </tr>
                        </thead>
                        <tbody id="transaction-list-tbody">
                            ${renderTransactionList()}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } else if (currentDashboardTab === 'projects') {
        // ===== TAB CHI TIẾT CÔNG TRÌNH =====
        const allProjects = state.data.projects.map(p => {
            const receiveTxns = state.data.transactions.filter(t => t.projectId === p.id && t.type === 'usage');
            const returnTxns = state.data.transactions.filter(t => t.projectId === p.id && t.type === 'return');
            const totalReceived = receiveTxns.reduce((s, t) => s + (t.totalAmount || 0), 0);
            const totalReturn = returnTxns.reduce((s, t) => s + (t.totalAmount || 0), 0);
            const netCost = totalReceived - totalReturn;
            const remaining = p.budget - netCost;
            const percent = p.budget > 0 ? (netCost / p.budget) * 100 : 0;
            return { ...p, netCost, totalReceived, totalReturn, remaining, percent, receiveCount: receiveTxns.length, returnCount: returnTxns.length };
        });
        
        tabContent = `
            <div class="grid4" style="margin-bottom: 18px;">
                <div class="metric-card">
                    <div class="metric-label">🏗️ TỔNG SỐ CÔNG TRÌNH</div>
                    <div class="metric-val">${allProjects.length}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">💰 TỔNG NGÂN SÁCH</div>
                    <div class="metric-val">${formatMoneyVND(allProjects.reduce((s, p) => s + p.budget, 0))}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">📤 TỔNG ĐÃ CHI</div>
                    <div class="metric-val" style="color: var(--warn-text);">${formatMoneyVND(allProjects.reduce((s, p) => s + p.netCost, 0))}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">📊 CÒN LẠI</div>
                    <div class="metric-val" style="color: var(--success-text);">${formatMoneyVND(allProjects.reduce((s, p) => s + p.remaining, 0))}</div>
                </div>
            </div>
            
            <div class="tbl-wrap">
                <table style="min-width: 900px; width: 100%;">
                    <thead>
                        <tr>
                            <th>Mã</th>
                            <th>Tên công trình</th>
                            <th>Ngân sách</th>
                            <th>Đã nhận</th>
                            <th>Đã trả</th>
                            <th>Đã chi</th>
                            <th>Còn lại</th>
                            <th>% sử dụng</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${allProjects.map(p => `
                            <tr style="cursor:pointer;" onclick="window.showProjectDetail('${p.id}')">
                                <td>${p.id}</td>
                                <td><strong>${escapeHtml(p.name)}</strong></td>
                                <td style="text-align: right;">${formatMoneyVND(p.budget)}</td>
                                <td style="text-align: right;">${formatMoneyVND(p.totalReceived)}</td>
                                <td style="text-align: right; color: var(--success-text);">${formatMoneyVND(p.totalReturn)}</td>
                                <td style="text-align: right;" class="text-warning">${formatMoneyVND(p.netCost)}</td>
                                <td style="text-align: right; color: var(--success-text);">${formatMoneyVND(p.remaining)}</td>
                                <td style="text-align: center;">
                                    <div class="progress-bar" style="width: 80px; display: inline-block;"><div class="progress-fill" style="width:${Math.min(100, p.percent)}%;background:${p.percent > 90 ? '#A32D2D' : '#378ADD'}"></div></div>
                                    ${p.percent.toFixed(1)}%
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } else if (currentDashboardTab === 'suppliers') {
        // ===== TAB CHI TIẾT NHÀ CUNG CẤP =====
        const allSuppliers = state.data.suppliers.map(s => {
            const purchases = state.data.transactions.filter(t => t.type === 'purchase' && t.supplierId === s.id);
            const totalSpent = purchases.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
            return { ...s, totalSpent, purchaseCount: purchases.length };
        }).sort((a, b) => b.totalSpent - a.totalSpent);
        
        tabContent = `
            <div class="grid4" style="margin-bottom: 18px;">
                <div class="metric-card">
                    <div class="metric-label">🏭 TỔNG SỐ NCC</div>
                    <div class="metric-val">${allSuppliers.length}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">💰 TỔNG CHI</div>
                    <div class="metric-val" style="color: var(--success-text);">${formatMoneyVND(allSuppliers.reduce((s, sup) => s + sup.totalSpent, 0))}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">📦 TỔNG LẦN NHẬP</div>
                    <div class="metric-val">${allSuppliers.reduce((s, sup) => s + sup.purchaseCount, 0)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">📊 TRUNG BÌNH/LẦN</div>
                    <div class="metric-val">${formatMoneyVND(allSuppliers.length > 0 ? allSuppliers.reduce((s, sup) => s + sup.totalSpent, 0) / Math.max(1, allSuppliers.reduce((s, sup) => s + sup.purchaseCount, 0)) : 0)}</div>
                </div>
            </div>
            
            <div class="tbl-wrap">
                <table style="min-width: 800px; width: 100%;">
                    <thead>
                        <tr>
                            <th>Mã</th>
                            <th>Tên nhà cung cấp</th>
                            <th>SĐT</th>
                            <th>Email</th>
                            <th>Tổng chi</th>
                            <th>Số lần nhập</th>
                            <th>Trung bình/lần</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${allSuppliers.map(s => `
                            <tr style="cursor:pointer;" onclick="window.showSupplierDetail('${s.id}')">
                                <td>${s.id}</td>
                                <td><strong>${escapeHtml(s.name)}</strong></td>
                                <td>${s.phone || '—'}</td>
                                <td>${s.email || '—'}</td>
                                <td style="text-align: right;" class="text-warning">${formatMoneyVND(s.totalSpent)}</td>
                                <td style="text-align: center;">${s.purchaseCount}</td>
                                <td style="text-align: right;">${s.purchaseCount > 0 ? formatMoneyVND(s.totalSpent / s.purchaseCount) : '0 ₫'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    return tabsHtml + filtersHtml + tabContent;
}

// ===== RENDER CHART =====
export function renderDashboardChart() {
    const monthlyStats = getMonthlyStats();
    const categoryStats = getCategoryStats();
    const supplierStats = getSupplierStats();
    
    if (currentDashboardTab !== 'overview') return; // Chỉ vẽ chart ở tab tổng quan
    
    const monthlyCtx = document.getElementById('monthly-chart');
    if (monthlyCtx) {
        if (monthlyChart) monthlyChart.destroy();
        if (monthlyStats.length > 0) {
            monthlyChart = new Chart(monthlyCtx, {
                type: 'line',
                data: {
                    labels: monthlyStats.map(m => m.label),
                    datasets: [
                        { label: 'Nhập kho', data: monthlyStats.map(m => m.import), borderColor: '#97C459', backgroundColor: 'transparent', tension: 0.3, fill: false },
                        { label: 'Xuất kho', data: monthlyStats.map(m => m.export), borderColor: '#F09595', backgroundColor: 'transparent', tension: 0.3, fill: false }
                    ]
                },
                options: { 
                    maintainAspectRatio: true, 
                    responsive: true, 
                    plugins: { 
                        tooltip: { 
                            callbacks: { 
                                label: (ctx) => `${ctx.dataset.label}: ${formatMoneyVND(ctx.raw)}` 
                            } 
                        } 
                    } 
                }
            });
        }
    }
    
    const categoryPieCtx = document.getElementById('category-pie-chart');
    if (categoryPieCtx) {
        if (categoryChart) categoryChart.destroy();
        if (Object.keys(categoryStats).length > 0) {
            categoryChart = new Chart(categoryPieCtx, {
                type: 'pie',
                data: {
                    labels: Object.keys(categoryStats),
                    datasets: [{ 
                        data: Object.values(categoryStats), 
                        backgroundColor: ['#378ADD', '#97C459', '#FAC775', '#F09595', '#85B7EB', '#BA7517', '#3B6D11', '#A32D2D'] 
                    }]
                },
                options: { maintainAspectRatio: true, responsive: true, plugins: { legend: { position: 'right' } } }
            });
        }
    }
    
    const supplierPieCtx = document.getElementById('supplier-pie-chart');
    if (supplierPieCtx) {
        if (supplierChart) supplierChart.destroy();
        if (Object.keys(supplierStats).length > 0) {
            const supplierNames = {};
            for (const [id, total] of Object.entries(supplierStats)) {
                const supplier = state.data.suppliers.find(s => s.id === id);
                supplierNames[supplier?.name || 'Khác'] = total;
            }
            supplierChart = new Chart(supplierPieCtx, {
                type: 'pie',
                data: {
                    labels: Object.keys(supplierNames),
                    datasets: [{ 
                        data: Object.values(supplierNames), 
                        backgroundColor: ['#378ADD', '#97C459', '#FAC775', '#F09595', '#85B7EB', '#BA7517', '#3B6D11', '#A32D2D'] 
                    }]
                },
                options: { maintainAspectRatio: true, responsive: true, plugins: { legend: { position: 'right' } } }
            });
        }
    }
}

export function bindDashboardFilterEvents() {
    const applyBtn = document.getElementById('filter-apply');
    const resetBtn = document.getElementById('filter-reset');
    
    if (applyBtn) {
        const newApplyBtn = applyBtn.cloneNode(true);
        applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);
        newApplyBtn.onclick = () => applyFilters();
    }
    if (resetBtn) {
        const newResetBtn = resetBtn.cloneNode(true);
        resetBtn.parentNode.replaceChild(newResetBtn, resetBtn);
        newResetBtn.onclick = () => resetFilters();
    }
}

export function bindDashboardSearchEvents() {
    bindDashboardFilterEvents();
}

export function renderCharts() {}
export function renderProjectCharts() {}