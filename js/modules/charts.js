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
    transactionType: 'all' // all, purchase, usage, return
};

let searchTimeout = null;

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
    
    // Lọc theo ngày
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
    
    // Lọc theo loại giao dịch
    if (advancedFilters.transactionType !== 'all') {
        transactions = transactions.filter(t => t.type === advancedFilters.transactionType);
    }
    
    // Lọc theo danh mục vật tư
    if (advancedFilters.materialCategory !== 'all') {
        transactions = transactions.filter(t => {
            const mat = state.data.materials.find(m => m.id === t.mid);
            return mat && mat.cat === advancedFilters.materialCategory;
        });
    }
    
    // Lọc theo công trình
    if (advancedFilters.projectId !== 'all') {
        transactions = transactions.filter(t => t.projectId === advancedFilters.projectId);
    }
    
    // Lọc theo nhà cung cấp
    if (advancedFilters.supplierId !== 'all') {
        transactions = transactions.filter(t => t.supplierId === advancedFilters.supplierId);
    }
    
    return transactions;
}

// Lấy thống kê theo tháng với bộ lọc
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
            if (t.type === 'return') months[key].export -= t.totalAmount || 0; // Trả hàng làm giảm chi phí
        }
    });
    
    return Object.values(months);
}

// Lấy thống kê theo danh mục
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

// Lấy thống kê theo nhà cung cấp
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

// Lấy thống kê theo công trình
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

// Tính tổng giá trị theo bộ lọc
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

// Render bộ lọc nâng cao
function renderAdvancedFilters() {
    const categories = ['all', ...state.data.categories];
    const projects = [{ id: 'all', name: '📂 Tất cả công trình' }, ...state.data.projects];
    const suppliers = [{ id: 'all', name: '📂 Tất cả nhà cung cấp' }, ...state.data.suppliers];
    
    return `
        <div class="card" style="margin-bottom: 16px;">
            <div class="sec-title" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="toggleAdvancedFilters()">
                <span>🔧 TÌM KIẾM NÂNG CAO</span>
                <span id="filter-toggle-icon" style="font-size: 16px;">▼</span>
            </div>
            <div id="advanced-filters-content" style="display: block;">
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

// Hàm toggle hiển thị bộ lọc nâng cao
window.toggleAdvancedFilters = function() {
    const content = document.getElementById('advanced-filters-content');
    const icon = document.getElementById('filter-toggle-icon');
    if (content && icon) {
        if (content.style.display === 'none') {
            content.style.display = 'block';
            icon.innerHTML = '▼';
        } else {
            content.style.display = 'none';
            icon.innerHTML = '▶';
        }
    }
};

// Hàm áp dụng bộ lọc
function applyFilters() {
    advancedFilters.dateFrom = document.getElementById('filter-date-from')?.value || '';
    advancedFilters.dateTo = document.getElementById('filter-date-to')?.value || '';
    advancedFilters.transactionType = document.getElementById('filter-transaction-type')?.value || 'all';
    advancedFilters.materialCategory = document.getElementById('filter-material-category')?.value || 'all';
    advancedFilters.projectId = document.getElementById('filter-project')?.value || 'all';
    advancedFilters.supplierId = document.getElementById('filter-supplier')?.value || 'all';
    
    updateDashboardContent();
}

// Hàm đặt lại bộ lọc
function resetFilters() {
    advancedFilters = {
        dateFrom: '',
        dateTo: '',
        materialCategory: 'all',
        projectId: 'all',
        supplierId: 'all',
        transactionType: 'all'
    };
    
    // Cập nhật giá trị trên form
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

// Cập nhật nội dung dashboard
function updateDashboardContent() {
    const dashboardPane = document.getElementById('pane-dashboard');
    if (dashboardPane) {
        dashboardPane.innerHTML = renderDashboard();
        setTimeout(() => {
            renderDashboardChart();
            bindDashboardEvents();
        }, 50);
    }
}

// Bind events cho dashboard
function bindDashboardEvents() {
    const applyBtn = document.getElementById('filter-apply');
    const resetBtn = document.getElementById('filter-reset');
    
    if (applyBtn) {
        applyBtn.onclick = () => applyFilters();
    }
    if (resetBtn) {
        resetBtn.onclick = () => resetFilters();
    }
}

// Lấy vật tư đã lọc
function getFilteredMaterials() {
    const filteredTransactions = getFilteredTransactions();
    const materialIds = new Set(filteredTransactions.map(t => t.mid));
    if (materialIds.size === 0) return state.data.materials;
    return state.data.materials.filter(m => materialIds.has(m.id));
}

export function renderDashboard() {
    const filteredMaterials = getFilteredMaterials();
    const { totalImport, totalExport, totalReturn, netSpent } = getTotalValues();
    
    // Tính giá trị tồn kho hiện tại
    const totalInventory = state.data.materials.reduce((s, m) => s + (m.qty * m.cost), 0);
    
    // Lấy thống kê danh mục
    const categoryStats = getCategoryStats();
    const topCategories = Object.entries(categoryStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    // Lấy thống kê nhà cung cấp
    const supplierStats = getSupplierStats();
    const topSuppliers = Object.entries(supplierStats)
        .map(([id, total]) => {
            const supplier = state.data.suppliers.find(s => s.id === id);
            return { name: supplier?.name || 'Khác', total };
        })
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
    
    // Lấy thống kê công trình
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
    
    return renderAdvancedFilters() + `
        <!-- Thống kê nhanh -->
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
        
        <!-- Giá trị tồn kho -->
        <div class="grid4" style="margin-bottom: 18px;">
            <div class="metric-card" style="grid-column: span 4; background: var(--accent-bg);">
                <div class="metric-label">🏪 GIÁ TRỊ TỒN KHO HIỆN TẠI</div>
                <div class="metric-val" style="font-size: 28px;">${formatMoneyVND(totalInventory)}</div>
                <div class="metric-sub">Tổng số mặt hàng: ${state.data.materials.length}</div>
            </div>
        </div>
        
        ${lowStockHtml}
        
        <!-- Thống kê theo nhóm -->
        <div class="grid2" style="margin-bottom: 18px;">
            <div class="card">
                <div class="sec-title">🏷️ TOP DANH MỤC VẬT TƯ (THEO GIÁ TRỊ NHẬP/XUẤT)</div>
                ${topCategories.length > 0 ? `
                    <div class="tbl-wrap">
                        <table style="width: 100%;">
                            <thead><tr><th>Danh mục</th><th>Giá trị</th></td></thead>
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
                <div class="sec-title">🏭 TOP NHÀ CUNG CẤP (THEO GIÁ TRỊ NHẬP)</div>
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
                <div class="sec-title">🏗️ TOP CÔNG TRÌNH (THEO CHI PHÍ PHÁT SINH)</div>
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
        
        <!-- Biểu đồ tròn -->
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
        const displayDateTime = t.datetime ? formatDateTime(t.datetime) : t.date;
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

function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return '';
    const date = new Date(dateTimeStr);
    return date.toLocaleString('vi-VN');
}

export function renderDashboardChart() {
    const monthlyStats = getMonthlyStats();
    const categoryStats = getCategoryStats();
    const supplierStats = getSupplierStats();
    
    // Biểu đồ nhập/xuất theo tháng
    const monthlyCtx = document.getElementById('monthly-chart');
    if (monthlyCtx && monthlyChart) monthlyChart.destroy();
    if (monthlyCtx && monthlyStats.length > 0) {
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
    
    // Biểu đồ tròn danh mục
    const categoryPieCtx = document.getElementById('category-pie-chart');
    if (categoryPieCtx && categoryChart) categoryChart.destroy();
    if (categoryPieCtx && Object.keys(categoryStats).length > 0) {
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
    
    // Biểu đồ tròn nhà cung cấp
    const supplierPieCtx = document.getElementById('supplier-pie-chart');
    if (supplierPieCtx && supplierChart) supplierChart.destroy();
    if (supplierPieCtx && Object.keys(supplierStats).length > 0) {
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

export function bindDashboardEvents() {
    const applyBtn = document.getElementById('filter-apply');
    const resetBtn = document.getElementById('filter-reset');
    
    if (applyBtn) {
        applyBtn.onclick = () => applyFilters();
    }
    if (resetBtn) {
        resetBtn.onclick = () => resetFilters();
    }
}

export function bindDashboardSearchEvents() {
    bindDashboardEvents();
}

export function renderCharts() {}
export function renderProjectCharts() {}