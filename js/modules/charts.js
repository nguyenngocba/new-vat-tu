import { state, formatMoney, escapeHtml } from './state.js';
import { getStructureStats, renderStructureKPIs, renderStructureInventory, renderStructureDashboardCharts } from './structure_dashboard.js';
import { formatMoneyVND } from './utils.js?v=1777963068';

let stockChart = null;
let monthlyChart = null;
let categoryPieChart = null;
let topProjectsChart = null;
let topSuppliersChart = null;
let trendChart = null;

let advancedFilters = {
    dateFrom: '',
    dateTo: '',
    materialCategory: 'all',
    projectId: 'all',
    supplierId: 'all',
    transactionType: 'all'
};

let currentDashboardTab = 'overview';

// ========== CACHE CHO DASHBOARD ==========
let dashboardCache = {
    html_cache: null,
    data_cache: null,
    timestamp: 0,
    ttl: 60000 // 60 giây cache
};

let transactionsCache = {
    data: null,
    filters: null,
    timestamp: 0,
    ttl: 30000 // 30 giây
};

// Hàm lấy cached transactions
function getCachedTransactions(filters) {
    const filterKey = JSON.stringify(filters);
    if (transactionsCache.data && transactionsCache.filters === filterKey && 
        (Date.now() - transactionsCache.timestamp) < transactionsCache.ttl) {
        return transactionsCache.data;
    }
    return null;
}

function setCachedTransactions(filters, data) {
    transactionsCache.data = data;
    transactionsCache.filters = JSON.stringify(filters);
    transactionsCache.timestamp = Date.now();
}

// Hàm lấy cached dashboard HTML
function getCachedDashboardHTML() {
    if (dashboardCache.html_cache && (Date.now() - dashboardCache.timestamp) < dashboardCache.ttl) {
        return dashboardCache.html_cache;
    }
    return null;
}

function setCachedDashboardHTML(html) {
    dashboardCache.html_cache = html;
    dashboardCache.timestamp = Date.now();
}

// Clear cache
function clearDashboardCache() {
    dashboardCache.html_cache = null;
    dashboardCache.data_cache = null;
    dashboardCache.timestamp = 0;
    transactionsCache.data = null;
    transactionsCache.filters = null;
    console.log('🗑️ Đã xóa cache dashboard');
}

// ========== HELPER FUNCTIONS ==========

function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getLastMonth() {
    const now = new Date();
    now.setMonth(now.getMonth() - 1);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthName(monthKey) {
    const [year, month] = monthKey.split('-');
    return `T${parseInt(month)}/${year}`;
}

function getFilteredTransactions(useCache = true) {
    const currentFilters = {
        dateFrom: advancedFilters.dateFrom,
        dateTo: advancedFilters.dateTo,
        transactionType: advancedFilters.transactionType,
        materialCategory: advancedFilters.materialCategory,
        projectId: advancedFilters.projectId,
        supplierId: advancedFilters.supplierId
    };
    
    if (useCache) {
        const cached = getCachedTransactions(currentFilters);
        if (cached) return cached;
    }
    
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
    
    setCachedTransactions(currentFilters, transactions);
    return transactions;
}

function getMonthlyData() {
    const months = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months[key] = { month: key, label: `T${d.getMonth()+1}/${d.getFullYear()}`, import: 0, export: 0, return: 0 };
    }
    
    getFilteredTransactions().forEach(t => {
        const d = new Date(t.datetime || t.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (months[key]) {
            if (t.type === 'purchase') months[key].import += (parseFloat(parseFloat(t.totalAmount))||0);
            if (t.type === 'usage') months[key].export += (parseFloat(parseFloat(t.totalAmount))||0);
            if (t.type === 'return') months[key].return += (parseFloat(parseFloat(t.totalAmount))||0);
        }
    });
    
    return Object.values(months);
}

function getTotalsForPeriod(transactions) {
    let totalImport = 0, totalExport = 0, totalReturn = 0;
    transactions.forEach(t => {
        if (t.type === 'purchase') totalImport += (parseFloat(parseFloat(t.totalAmount))||0);
        if (t.type === 'usage') totalExport += (parseFloat(parseFloat(t.totalAmount))||0);
        if (t.type === 'return') totalReturn += (parseFloat(parseFloat(t.totalAmount))||0);
    });
    return { totalImport, totalExport, totalReturn, netSpent: totalExport - totalReturn };
}

// ========== CHECK FUNCTIONS ==========

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
        localStorage.setItem(lastBackupKey, today);
    }
}

export function checkLowStockNotification() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const lowStockItems = state.data.materials.filter(m => m.qty <= parseFloat(m.low));
    if (lowStockItems.length > 0) {
        new Notification('⚠️ Cảnh báo tồn kho thấp', {
            body: `${lowStockItems.length} vật tư sắp hết: ${lowStockItems.slice(0,3).map(m=>m.name).join(', ')}`,
        });
    }
}

export function requestNotificationPermission() {
    if ('Notification' in window) {
        if (Notification.permission === 'granted') {
            new Notification('TRIVIETSTEEL Pro', { body: 'Thông báo đã được bật! 🏭' });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification('TRIVIETSTEEL Pro', { body: 'Bạn sẽ nhận cảnh báo khi hàng sắp hết!' });
                }
            });
        }
    }
}

// ========== FILTERS ==========

function renderAdvancedFilters() {
    const categories = ['all', ...state.data.categories];
    const projects = [{ id: 'all', name: 'Tất cả công trình' }, ...state.data.projects];
    const suppliers = [{ id: 'all', name: 'Tất cả nhà cung cấp' }, ...state.data.suppliers];
    
    return `
        <div class="card" style="margin-bottom: 16px; padding: 12px 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="window.toggleAdvancedFilters()">
                <span class="sec-title" style="margin-bottom: 0;">🔧 BỘ LỌC NÂNG CAO</span>
                <span id="filter-toggle-icon" style="font-size: 14px;">▶</span>
            </div>
            <div id="advanced-filters-content" style="display: none; margin-top: 12px;">
                <div class="grid2" style="margin-bottom: 10px;">
                    <div class="form-group"><label class="form-label">Từ ngày</label><input type="date" id="filter-date-from" value="${advancedFilters.dateFrom}"></div>
                    <div class="form-group"><label class="form-label">Đến ngày</label><input type="date" id="filter-date-to" value="${advancedFilters.dateTo}"></div>
                </div>
                <div class="grid2" style="margin-bottom: 10px;">
                    <div class="form-group"><label class="form-label">Loại giao dịch</label>
                        <select id="filter-transaction-type">
                            <option value="all">Tất cả</option>
                            <option value="purchase" ${advancedFilters.transactionType==='purchase'?'selected':''}>📥 Nhập kho</option>
                            <option value="usage" ${advancedFilters.transactionType==='usage'?'selected':''}>📤 Xuất kho</option>
                            <option value="return" ${advancedFilters.transactionType==='return'?'selected':''}>🔄 Trả hàng</option>
                        </select>
                    </div>
                    <div class="form-group"><label class="form-label">Danh mục</label>
                        <select id="filter-material-category">${categories.map(c=>`<option value="${c}" ${advancedFilters.materialCategory===c?'selected':''}>${c==='all'?'Tất cả':c}</option>`).join('')}</select>
                    </div>
                </div>
                <div class="grid2" style="margin-bottom: 10px;">
                    <div class="form-group"><label class="form-label">Công trình</label>
                        <select id="filter-project">${projects.map(p=>`<option value="${p.id}" ${advancedFilters.projectId===p.id?'selected':''}>${escapeHtml(p.name)}</option>`).join('')}</select>
                    </div>
                    <div class="form-group"><label class="form-label">Nhà cung cấp</label>
                        <select id="filter-supplier">${suppliers.map(s=>`<option value="${s.id}" ${advancedFilters.supplierId===s.id?'selected':''}>${escapeHtml(s.name)}</option>`).join('')}</select>
                    </div>
                </div>
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button id="filter-apply" class="sm primary">🔍 Áp dụng</button>
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
        if (content.style.display === 'none') {
            content.style.display = 'block';
            icon.innerHTML = '▼';
        } else {
            content.style.display = 'none';
            icon.innerHTML = '▶';
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
    clearDashboardCache();
    updateDashboardContent();
}

function resetFilters() {
    advancedFilters = { dateFrom: '', dateTo: '', materialCategory: 'all', projectId: 'all', supplierId: 'all', transactionType: 'all' };
    ['filter-date-from','filter-date-to','filter-transaction-type','filter-material-category','filter-project','filter-supplier'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = 'all';
    });
    clearDashboardCache();
    updateDashboardContent();
}

function updateDashboardContent() {
    const pane = document.getElementById('pane-dashboard');
    if (pane) {
        pane.innerHTML = renderDashboard();
        setTimeout(() => { renderDashboardChart(); bindDashboardFilterEvents(); }, 100);
    }
}

// ========== KPI CARDS ==========

function getLowStockHTML() {
    const lowStockItems = state.data.materials.filter(m => parseFloat(m.qty) <= parseFloat(m.low || 0));
    if (lowStockItems.length === 0) return '';
    return `<div class="card" style="margin-bottom:18px;border-left:3px solid var(--danger);">
        <div class="sec-title" style="color:var(--danger-text);">⚠️ SẮP HẾT HÀNG (${lowStockItems.length} mặt hàng)</div>
        <div class="tbl-wrap"><table class="dashboard-table" style="min-width:600px;">
            <thead><tr><th>Tên vật tư</th><th style="text-align:right;">Tồn kho</th><th style="text-align:right;">Ngưỡng</th><th style="text-align:right;">Cần nhập</th></tr></thead>
            <tbody>${lowStockItems.slice(0,10).map(m => {
                const need = parseFloat(m.low) - parseFloat(m.qty);
                return '<tr style="cursor:pointer;" onclick="window.showMaterialDetail(\''+m.id+'\')"><td><strong>'+escapeHtml(m.name)+'</strong></td><td style="text-align:right;color:var(--danger-text);font-weight:bold;">'+Number(m.qty).toLocaleString('vi-VN')+' '+m.unit+'</td><td style="text-align:right;">'+Number(m.low).toLocaleString('vi-VN')+' '+m.unit+'</td><td style="text-align:right;color:var(--accent);">'+Number(need).toLocaleString('vi-VN')+' '+m.unit+'</td></tr>';
            }).join('')}</tbody>
        </table></div>
        ${lowStockItems.length > 10 ? '<div class="metric-sub" style="text-align:center;">Còn '+(lowStockItems.length-10)+' mặt hàng khác...</div>' : ''}
    </div>`;
}

function renderKPICards() {
    const allTxns = getFilteredTransactions();
    const { totalImport, totalExport, totalReturn, netSpent } = getTotalsForPeriod(allTxns);
    const totalInventory = state.data.materials.reduce((s, m) => s + (m.qty * m.cost), 0);
    const lowStockCount = state.data.materials.filter(m => m.qty <= parseFloat(m.low)).length;
    
    const lastMonthTxns = state.data.transactions.filter(t => {
        const d = new Date(t.datetime || t.date);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        return key === getLastMonth();
    });
    const lastMonth = getTotalsForPeriod(lastMonthTxns);
    const importTrend = lastMonth.totalImport > 0 ? ((totalImport - lastMonth.totalImport) / lastMonth.totalImport * 100) : 0;
    const exportTrend = lastMonth.totalExport > 0 ? ((totalExport - lastMonth.totalExport) / lastMonth.totalExport * 100) : 0;
    
    return `
        <div class="kpi-grid">
            <div class="kpi-card kpi-import">
                <div class="kpi-icon">📥</div>
                <div class="kpi-info">
                    <div class="kpi-label">TỔNG NHẬP KHO</div>
                    <div class="kpi-value">${formatMoneyVND(totalImport)}</div>
                    <div class="kpi-trend ${importTrend >= 0 ? 'trend-up' : 'trend-down'}">
                        ${importTrend >= 0 ? '▲' : '▼'} ${Math.abs(importTrend).toFixed(1)}% so với tháng trước
                    </div>
                </div>
            </div>
            <div class="kpi-card kpi-export">
                <div class="kpi-icon">📤</div>
                <div class="kpi-info">
                    <div class="kpi-label">TỔNG XUẤT KHO</div>
                    <div class="kpi-value">${formatMoneyVND(totalExport)}</div>
                    <div class="kpi-trend ${exportTrend <= 0 ? 'trend-up' : 'trend-down'}">
                        ${exportTrend >= 0 ? '▲' : '▼'} ${Math.abs(exportTrend).toFixed(1)}% so với tháng trước
                    </div>
                </div>
            </div>
            <div class="kpi-card kpi-inventory">
                <div class="kpi-icon">🏪</div>
                <div class="kpi-info">
                    <div class="kpi-label">GIÁ TRỊ TỒN KHO</div>
                    <div class="kpi-value">${formatMoneyVND(totalInventory)}</div>
                    <div class="kpi-sub">${state.data.materials.length} mặt hàng</div>
                </div>
            </div>
            <div class="kpi-card kpi-warning">
                <div class="kpi-icon">⚠️</div>
                <div class="kpi-info">
                    <div class="kpi-label">SẮP HẾT HÀNG</div>
                    <div class="kpi-value" style="color: ${lowStockCount > 0 ? 'var(--danger-text)' : 'var(--success-text)'};">${lowStockCount}</div>
                    <div class="kpi-sub">${lowStockCount > 0 ? 'Cần nhập hàng gấp' : 'Tất cả đều ổn ✅'}</div>
                </div>
            </div>
        </div>
    `;
}

// ========== RENDER DASHBOARD ==========

export function renderDashboard() {
    // Kiểm tra cache
    const cachedHtml = getCachedDashboardHTML();
    if (cachedHtml) {
        return cachedHtml;
    }
    
    const monthlyData = getMonthlyData();
    const allTxns = getFilteredTransactions();
    
    // Category stats
    const catStats = {};
    allTxns.forEach(t => {
        const mat = state.data.materials.find(m => m.id === t.mid);
        if (mat) {
            if (!catStats[mat.cat]) catStats[mat.cat] = { import: 0, export: 0, qty: 0 };
            if (t.type === 'purchase') catStats[mat.cat].import += (parseFloat(parseFloat(t.totalAmount))||0);
            if (t.type === 'usage') catStats[mat.cat].export += (parseFloat(parseFloat(t.totalAmount))||0);
        }
    });
    
    // Top projects
    const projectStats = {};
    allTxns.filter(t => t.type === 'usage' && t.projectId).forEach(t => {
        if (!projectStats[t.projectId]) projectStats[t.projectId] = 0;
        projectStats[t.projectId] += (parseFloat(parseFloat(t.totalAmount))||0);
    });
    const topProjects = Object.entries(projectStats)
        .map(([id, total]) => ({ name: state.data.projects.find(p=>p.id===id)?.name||'Khác', total, id }))
        .sort((a,b) => b.total - a.total).slice(0, 5);
    const maxProject = topProjects[0]?.total || 1;
    
    // Top suppliers
    const supplierStats = {};
    allTxns.filter(t => t.type === 'purchase' && t.supplierId).forEach(t => {
        if (!supplierStats[t.supplierId]) supplierStats[t.supplierId] = 0;
        supplierStats[t.supplierId] += (parseFloat(parseFloat(t.totalAmount))||0);
    });
    const topSuppliers = Object.entries(supplierStats)
        .map(([id, total]) => ({ name: state.data.suppliers.find(s=>s.id===id)?.name||'Khác', total, id }))
        .sort((a,b) => b.total - a.total).slice(0, 5);
    const maxSupplier = topSuppliers[0]?.total || 1;
    
    // Recent transactions
    const recentTxns = allTxns.sort((a,b) => new Date(b.datetime||b.date) - new Date(a.datetime||a.date)).slice(0, parseInt(document.getElementById('recent-limit')?.value||10));
    
    const html = `
        ${renderFiltersAndTabs()}
        ${renderKPICards()}
        ${getLowStockHTML()}
        
        <div class="grid2" style="margin-bottom: 18px;">
            <div class="card">
                <div class="sec-title">📈 XU HƯỚNG NHẬP / XUẤT 6 THÁNG GẦN NHẤT</div>
                <div class="chart-container" style="height: 280px;"><canvas id="monthly-chart"></canvas></div>
            </div>
            <div class="card">
                <div class="sec-title">🎯 CƠ CẤU TỒN KHO THEO DANH MỤC</div>
                <div class="chart-container" style="height: 280px;"><canvas id="category-pie-chart"></canvas></div>
            </div>
        </div>
        
        <div class="grid2" style="margin-bottom: 18px;">
            <div class="card">
                <div class="sec-title">🏗️ TOP 5 CÔNG TRÌNH TIÊU THỤ NHIỀU NHẤT</div>
                <div style="display:flex;flex-direction:column;gap:10px;">
                    ${topProjects.map((p, i) => `
                        <div style="cursor:pointer;" onclick="window.showProjectDetail('${p.id}')">
                            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                                <span><strong style="color:${i===0?'#FFD700':i===1?'#C0C0C0':i===2?'#CD7F32':'var(--muted)'};margin-right:6px;">#${i+1}</strong>${escapeHtml(p.name)}</span>
                                <strong>${formatMoneyVND(p.total)}</strong>
                            </div>
                            <div class="progress-bar" style="height:8px;"><div class="progress-fill" style="width:${(p.total/maxProject)*100}%;background:${i===0?'#378ADD':i===1?'#97C459':i===2?'#FAC775':'#85B7EB'};border-radius:4px;"></div></div>
                        </div>
                    `).join('')}
                    ${topProjects.length === 0 ? '<div class="metric-sub">Chưa có dữ liệu</div>' : ''}
                </div>
            </div>
            <div class="card">
                <div class="sec-title">🏭 TOP 5 NHÀ CUNG CẤP</div>
                <div style="display:flex;flex-direction:column;gap:10px;">
                    ${topSuppliers.map((s, i) => `
                        <div style="cursor:pointer;" onclick="window.showSupplierDetail('${s.id}')">
                            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                                <span><strong style="color:${i===0?'#FFD700':i===1?'#C0C0C0':i===2?'#CD7F32':'var(--muted)'};margin-right:6px;">#${i+1}</strong>${escapeHtml(s.name)}</span>
                                <strong>${formatMoneyVND(s.total)}</strong>
                            </div>
                            <div class="progress-bar" style="height:8px;"><div class="progress-fill" style="width:${(s.total/maxSupplier)*100}%;background:${i===0?'#378ADD':i===1?'#97C459':i===2?'#FAC775':'#85B7EB'};border-radius:4px;"></div></div>
                        </div>
                    `).join('')}
                    ${topSuppliers.length === 0 ? '<div class="metric-sub">Chưa có dữ liệu</div>' : ''}
                </div>
            </div>
        </div>
        
        <div class="card">
            <div class="sec-title" style="display:flex;justify-content:space-between;"><span>📋 GIAO DỊCH GẦN ĐÂY</span><select id="recent-limit" onchange="updateDashboardContent()" style="width:100px;"><option value="10">10</option><option value="50">50</option><option value="100">100</option></select></div>
            <div class="tbl-wrap">
                <table class="dashboard-table" style="min-width: 800px;">
                    <thead><tr><th>Thời gian</th><th>Loại</th><th>Vật tư</th><th style="text-align:right;">SL</th><th style="text-align:right;">Thành tiền</th><th>Đối tượng</th></tr></thead>
                    <tbody>
                        ${recentTxns.map(t => {
                            const mat = state.data.materials.find(m=>m.id===t.mid);
                            const dt = t.datetime ? new Date(t.datetime).toLocaleString('vi-VN', {hour:'2-digit',minute:'2-digit',second:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'}) : t.date;
                            let icon = '📥', label = 'Nhập kho', target = '';
                            if (t.type === 'usage') { icon = '📤'; label = 'Xuất kho'; target = state.data.projects.find(p=>p.id===t.projectId)?.name || ''; }
                            else if (t.type === 'return') { icon = '🔄'; label = 'Trả hàng'; target = state.data.projects.find(p=>p.id===t.projectId)?.name || ''; }
                            else { target = state.data.suppliers.find(s=>s.id===t.supplierId)?.name || ''; }
                            return `<tr>
                                <td style="white-space:nowrap;">${dt}</td>
                                <td><span class="status-badge ${t.type==='purchase'?'status-good':t.type==='usage'?'status-warn':'status-danger'}" style="font-size:11px;">${icon} ${label}</span></td>
                                <td>${escapeHtml(mat?.name||'N/A')}</td>
                                <td style="text-align:right;">${Number(t.qty||0).toLocaleString('vi-VN', {minimumFractionDigits:0, maximumFractionDigits:3})} ${mat?.unit||''}</td>
                                <td style="text-align:right;font-weight:500;">${formatMoneyVND(parseFloat(parseFloat(t.totalAmount)))}</td>
                                <td>${escapeHtml(target)}</td>
                            </tr>`;
                        }).join('')}
                        ${recentTxns.length === 0 ? '<tr><td colspan="6" style="text-align:center;">📭 Chưa có giao dịch</td>' : ''}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // Lưu vào cache
    setCachedDashboardHTML(html);
    
    return html;
}

function renderFiltersAndTabs() {
    return `
        <div class="dashboard-tabs">
	    <div class="dashboard-tab ${currentDashboardTab==='forecast'?'active':''}" onclick="window.switchDashboardTab('forecast')">📈 Dự báo</div>
            <div class="dashboard-tab ${currentDashboardTab==='overview'?'active':''}" onclick="window.switchDashboardTab('overview')">📊 Tổng quan</div>
            <div class="dashboard-tab ${currentDashboardTab==='projects'?'active':''}" onclick="window.switchDashboardTab('projects')">🏗️ Công trình</div>
            <div class="dashboard-tab ${currentDashboardTab==='suppliers'?'active':''}" onclick="window.switchDashboardTab('suppliers')">🏭 Nhà cung cấp</div>
            <div class="dashboard-tab ${currentDashboardTab==='structures'?'active':''}" onclick="window.switchDashboardTab('structures')">🏗️ Cấu kiện</div>
        </div>
        ${renderAdvancedFilters()}
    `;
}
window.switchDashboardTab = function(tab) {
    currentDashboardTab = tab;
    clearDashboardCache();   
 if (tab === 'projects' || tab === 'suppliers' || tab === 'structures' || tab === 'forecast') {
        document.getElementById('pane-dashboard').innerHTML = renderTabContent(tab);
        setTimeout(function(){
            if (tab === 'projects') {
                var ctx1 = document.getElementById('top-projects-chart');
                var ctx2 = document.getElementById('budget-pie-chart');
                if (ctx1 && ctx2) {
                    if (topProjectsChart) topProjectsChart.destroy();
                    if (window._bp) window._bp.destroy();
                    var pdata = state.data.projects.map(function(p){
                        var u = state.data.transactions.filter(function(t){return t.projectId===p.id&&t.type==='usage'}).reduce(function(s,t){return s+Number(t.totalAmount||0)},0);
                        var r = state.data.transactions.filter(function(t){return t.projectId===p.id&&t.type==='return'}).reduce(function(s,t){return s+Number(t.totalAmount||0)},0);
                        return { name: p.name.length>20?p.name.substring(0,20):p.name, spent: u-r };
                    }).sort(function(a,b){return b.spent-a.spent}).slice(0,5);
                    topProjectsChart = new Chart(ctx1, { type:'bar', data:{ labels:pdata.map(function(p){return p.name}), datasets:[{ label:'Chi', data:pdata.map(function(p){return p.spent}), backgroundColor:['#378ADD','#97C459','#FAC775','#F09595','#85B7EB'], borderRadius:6 }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false} } } });
                    var tu = pdata.reduce(function(s,p){return s+p.spent},0);
                    var tb = state.data.projects.reduce(function(s,p){return s+Number(p.budget||0)},0);
                    window._bp = new Chart(ctx2, { type:'doughnut', data:{ labels:['Dung','Con'], datasets:[{ data:[tu, Math.max(0,tb-tu)], backgroundColor:['#F09595','#97C459'], borderWidth:0 }] }, options:{ responsive:true, maintainAspectRatio:false } });
                }
            }
            if (tab === 'suppliers') {
                var ctx1 = document.getElementById('top-suppliers-chart');
                var ctx2 = document.getElementById('supplier-pie-chart');
                if (ctx1 && ctx2) {
                    if (topSuppliersChart) topSuppliersChart.destroy();
                    if (window._sp) window._sp.destroy();
                    var sdata = state.data.suppliers.map(function(s){
                        var t = state.data.transactions.filter(function(x){return x.type==='purchase'&&x.supplierId===s.id}).reduce(function(a,x){return a+Number(x.totalAmount||0)},0);
                        return { name: s.name.length>20?s.name.substring(0,20):s.name, total: t };
                    }).sort(function(a,b){return b.total-a.total}).slice(0,5);
                    topSuppliersChart = new Chart(ctx1, { type:'bar', data:{ labels:sdata.map(function(s){return s.name}), datasets:[{ label:'Tong chi', data:sdata.map(function(s){return s.total}), backgroundColor:['#378ADD','#97C459','#FAC775','#F09595','#85B7EB'], borderRadius:6 }] }, options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false} } } });
                    var t5 = sdata.reduce(function(s,p){return s+p.total},0);
                    var at = state.data.suppliers.reduce(function(s,p){ var t=state.data.transactions.filter(function(x){return x.type==='purchase'&&x.supplierId===p.id}).reduce(function(a,x){return a+Number(x.totalAmount||0)},0); return s+t; },0);
                    window._sp = new Chart(ctx2, { type:'doughnut', data:{ labels:sdata.map(function(s){return s.name}).concat(['Khac']), datasets:[{ data:sdata.map(function(s){return s.total}).concat([Math.max(0,at-t5)]), backgroundColor:['#378ADD','#97C459','#FAC775','#F09595','#85B7EB','#BA7517'], borderWidth:0 }] }, options:{ responsive:true, maintainAspectRatio:false } });
                }
            }
	    if (tab === 'structures') {
                renderStructureDashboardCharts();            
		}
		if (tab === 'forecast') {
		 loadForecast();
            }
        }, 500);
    } else {
        updateDashboardContent();
    }
};

let _projLimit = 50, _supLimit = 50;
function renderTabContent(tab) {
    const filters = renderFiltersAndTabs();
    setTimeout(function(){
        var pl = document.getElementById('proj-limit');
        var sl = document.getElementById('sup-limit');
        if (pl) { pl.value = _projLimit; pl.onchange = function(){ _projLimit = parseInt(this.value); switchDashboardTab('projects'); }; }
        if (sl) { sl.value = _supLimit; sl.onchange = function(){ _supLimit = parseInt(this.value); switchDashboardTab('suppliers'); }; }
    }, 50);
    
    if (tab === 'projects') {
        const projects = state.data.projects.map(p => {
            const u = state.data.transactions.filter(t=>t.projectId===p.id&&t.type==='usage').reduce((s,t)=>s+(parseFloat(parseFloat(t.totalAmount))||0),0);
            const r = state.data.transactions.filter(t=>t.projectId===p.id&&t.type==='return').reduce((s,t)=>s+(parseFloat(parseFloat(t.totalAmount))||0),0);
            return { ...p, spent: u-r, pct: p.budget>0?(u-r)/p.budget*100:0 };
        }).sort((a,b)=>b.spent-a.spent);
        const displayProjects = projects.slice(0, _projLimit);
        
        const maxPct = Math.max(...projects.map(p=>p.pct), 1);
        
        const totalProjects = projects.length;
        const totalBudget = projects.reduce((s, p) => s + Number(p.budget||0), 0);
        const totalSpentAll = projects.reduce((s, p) => s + Number(p.spent||0), 0);
        const avgPct = totalBudget > 0 ? (totalSpentAll / totalBudget * 100) : 0;
        const projectKPIs = `<div class="kpi-grid" style="margin-bottom:16px;">
            <div class="kpi-card"><div class="kpi-icon" style="background:rgba(55,138,221,0.15)">🏗️</div><div class="kpi-info"><div class="kpi-label">TỔNG CÔNG TRÌNH</div><div class="kpi-value">${totalProjects}</div><div class="kpi-sub">Đang theo dõi</div></div></div>
            <div class="kpi-card"><div class="kpi-icon" style="background:rgba(151,196,89,0.15)">💰</div><div class="kpi-info"><div class="kpi-label">TỔNG NGÂN SÁCH</div><div class="kpi-value">${formatMoneyVND(totalBudget)}</div><div class="kpi-sub">Tất cả công trình</div></div></div>
            <div class="kpi-card"><div class="kpi-icon" style="background:rgba(240,149,149,0.15)">💸</div><div class="kpi-info"><div class="kpi-label">ĐÃ SỬ DỤNG</div><div class="kpi-value">${formatMoneyVND(totalSpentAll)}</div><div class="kpi-sub">${avgPct.toFixed(1)}% ngân sách</div></div></div>
            <div class="kpi-card"><div class="kpi-icon" style="background:rgba(250,199,117,0.15)">📊</div><div class="kpi-info"><div class="kpi-label">CÒN LẠI</div><div class="kpi-value">${formatMoneyVND(totalBudget - totalSpentAll)}</div><div class="kpi-sub">${(100 - avgPct).toFixed(1)}% còn lại</div></div></div>
        </div>`;
        return filters + projectKPIs + `
            <div class="card">
                <div class="grid2" style="margin-bottom:18px;">
                <div class="card"><div class="sec-title">📊 TOP 5 CÔNG TRÌNH</div><div class="chart-container" style="height:280px;"><canvas id="top-projects-chart"></canvas></div></div>
                <div class="card"><div class="sec-title">🎯 NGÂN SÁCH</div><div class="chart-container" style="height:280px;"><canvas id="budget-pie-chart"></canvas></div></div>
            </div>
            <div class="sec-title" style="display:flex;justify-content:space-between;"><span>🏗️ CHI TIẾT TẤT CẢ CÔNG TRÌNH</span><select id="proj-limit" onchange="switchDashboardTab('projects')" style="width:100px;"><option value="50">50</option><option value="100">100</option><option value="500">500</option><option value="9999">All</option></select></div>
                <div class="tbl-wrap">
                    <table class="dashboard-table" style="min-width:900px;">
                        <thead><tr><th style="text-align:left;">Tên</th><th style="text-align:right;white-space:nowrap;">Ngân sách</th><th style="text-align:right;white-space:nowrap;">Đã chi</th><th style="text-align:right;white-space:nowrap;">Còn lại</th><th style="text-align:center;white-space:nowrap;">%</th><th>Tiến độ</th></tr></thead>
                        <tbody>
                            ${displayProjects.map(p => `
                                <tr style="cursor:pointer;" onclick="window.showProjectDetail('${p.id}')">
                                    <td style="text-align:left;white-space:nowrap;"><strong>${escapeHtml(p.name)}</strong></td>
                                    <td style="text-align:right;white-space:nowrap;">${formatMoneyVND(parseFloat(p.budget))}</td>
                                    <td style="text-align:right;white-space:nowrap;" class="text-warning">${formatMoneyVND(parseFloat(p.spent))}</td>
                                    <td style="text-align:right;white-space:nowrap;"><span class="${(parseFloat(p.budget)-parseFloat(p.spent))<0?'status-danger':'status-good'}" style="font-weight:500;">${formatMoneyVND(parseFloat(p.budget)-parseFloat(p.spent))}</span></td>
                                    <td style="text-align:center;"><span class="status-badge ${p.pct>90?'status-danger':p.pct>70?'status-warn':'status-good'}">${parseFloat(p.pct).toFixed(1)}%</span></td>
                                    <td><div class="progress-bar" style="width:120px;"><div class="progress-fill" style="width:${(p.pct/maxPct)*100}%;background:${p.pct>90?'#A32D2D':'#378ADD'};"></div></div></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    if (tab === 'suppliers') {
        const suppliers = state.data.suppliers.map(s => {
            const txns = state.data.transactions.filter(t=>t.type==='purchase'&&t.supplierId===s.id);
            return { ...s, total: txns.reduce((sum,t)=>sum+(parseFloat(parseFloat(t.totalAmount))||0),0), count: txns.length };
        }).sort((a,b)=>b.total-a.total);
        const displaySuppliers = suppliers.slice(0, _supLimit);
        
        const totalSuppliers = suppliers.length;
        const totalSpentAll = suppliers.reduce((s, p) => s + Number(p.total||0), 0);
        const totalOrders = suppliers.reduce((s, p) => s + Number(p.count||0), 0);
        const topSup = suppliers[0];
        const supplierKPIs = `<div class="kpi-grid" style="margin-bottom:16px;">
            <div class="kpi-card"><div class="kpi-icon" style="background:rgba(55,138,221,0.15)">🏭</div><div class="kpi-info"><div class="kpi-label">TỔNG NHÀ CUNG CẤP</div><div class="kpi-value">${totalSuppliers}</div><div class="kpi-sub">Đang hợp tác</div></div></div>
            <div class="kpi-card"><div class="kpi-icon" style="background:rgba(240,149,149,0.15)">💸</div><div class="kpi-info"><div class="kpi-label">TỔNG CHI TIÊU</div><div class="kpi-value">${formatMoneyVND(totalSpentAll)}</div><div class="kpi-sub">Tất cả NCC</div></div></div>
            <div class="kpi-card"><div class="kpi-icon" style="background:rgba(151,196,89,0.15)">📦</div><div class="kpi-info"><div class="kpi-label">SỐ LẦN NHẬP</div><div class="kpi-value">${totalOrders}</div><div class="kpi-sub">Tổng giao dịch</div></div></div>
            <div class="kpi-card"><div class="kpi-icon" style="background:rgba(250,199,117,0.15)">⭐</div><div class="kpi-info"><div class="kpi-label">NCC LỚN NHẤT</div><div class="kpi-value" style="font-size:14px">${topSup?.name||'—'}</div><div class="kpi-sub">${topSup ? formatMoneyVND(topSup.total) : '0 ₫'}</div></div></div>
        </div>`;
        return filters + supplierKPIs + `
            <div class="card">
                <div class="grid2" style="margin-bottom:18px;">
                <div class="card"><div class="sec-title">📊 TOP 5 NHÀ CUNG CẤP</div><div class="chart-container" style="height:280px;"><canvas id="top-suppliers-chart"></canvas></div></div>
                <div class="card"><div class="sec-title">🎯 TỶ LỆ CHI TIÊU</div><div class="chart-container" style="height:280px;"><canvas id="supplier-pie-chart"></canvas></div></div>
            </div>
            <div class="sec-title" style="display:flex;justify-content:space-between;"><span>🏭 CHI TIẾT TẤT CẢ NHÀ CUNG CẤP</span><select id="sup-limit" onchange="switchDashboardTab('suppliers')" style="width:100px;"><option value="50">50</option><option value="100">100</option><option value="500">500</option><option value="9999">All</option></select></div>
                <div class="tbl-wrap">
                    <table class="dashboard-table" style="min-width:800px;">
                        <thead><tr><th style="text-align:left;">Tên</th><th style="text-align:left;">SĐT</th><th style="text-align:left;">Email</th><th style="text-align:right;">Tổng chi</th><th style="text-align:center;">Số lần</th><th style="text-align:right;">TB/Lần</th><table></thead>
                        <tbody>
                            ${displaySuppliers.map(s => `
                                <tr style="cursor:pointer;" onclick="window.showSupplierDetail('${s.id}')">
                                    <td style="text-align:left;"><strong>${escapeHtml(s.name)}</strong></td>
                                    <td style="text-align:left;">${s.phone||'—'}</td>
                                    <td style="text-align:left;">${s.email||'—'}</td>
                                    <td style="text-align:right;white-space:nowrap;"><span style="font-weight:600;color:${suppliers.indexOf(s)<3?'var(--accent)':'var(--text)'};">${formatMoneyVND(s.total)}</span></td>
                                    <td style="text-align:center;">${s.count}</td>
                                    <td style="text-align:right;white-space:nowrap;">${s.count>0?formatMoneyVND(s.total/s.count):'0 ₫'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
if (tab === 'structures') {
    const stats = getStructureStats();
    
    // KPI Cards riêng cho tab Cấu kiện
    const structureKPIs = `
        <div class="kpi-grid" style="margin-bottom:16px;">
            <div class="kpi-card">
                <div class="kpi-icon" style="background:rgba(55,138,221,0.15)">🏗️</div>
                <div class="kpi-info">
                    <div class="kpi-label">TỔNG CẤU KIỆN</div>
                    <div class="kpi-value">${stats.totalStructures || 0}</div>
                    <div class="kpi-sub">Loại cấu kiện</div>
                </div>
            </div>
            <div class="kpi-card">
                <div class="kpi-icon" style="background:rgba(151,196,89,0.15)">🏭</div>
                <div class="kpi-info">
                    <div class="kpi-label">ĐÃ SẢN XUẤT</div>
                    <div class="kpi-value">${Number(stats.totalProduced || 0).toLocaleString('vi-VN')}</div>
                    <div class="kpi-sub">${stats.totalProductionRuns || 0} đợt sản xuất</div>
                </div>
            </div>
            <div class="kpi-card">
                <div class="kpi-icon" style="background:rgba(240,149,149,0.15)">📤</div>
                <div class="kpi-info">
                    <div class="kpi-label">ĐÃ XUẤT CT</div>
                    <div class="kpi-value">${Number(stats.totalExported || 0).toLocaleString('vi-VN')}</div>
                    <div class="kpi-sub">${formatMoneyVND(stats.totalExportValue || 0)}</div>
                </div>
            </div>
            <div class="kpi-card">
                <div class="kpi-icon" style="background:rgba(250,199,117,0.15)">⚠️</div>
                <div class="kpi-info">
                    <div class="kpi-label">TỒN THẤP</div>
                    <div class="kpi-value" style="color: ${stats.lowStockCount > 0 ? 'var(--danger-text)' : 'var(--success-text)'};">${stats.lowStockCount || 0}</div>
                    <div class="kpi-sub">${stats.lowStockCount > 0 ? 'Cần sản xuất thêm' : 'Tất cả ổn ✅'}</div>
                </div>
            </div>
        </div>
    `;
    
    // Tạo bảng top cấu kiện
    let topListHtml = '<div class="metric-sub" style="text-align:center;padding:20px;">📭 Chưa có dữ liệu sản xuất</div>';
    if (stats.topProduced && stats.topProduced.length > 0) {
        topListHtml = `
            <div class="tbl-wrap">
                <table style="min-width: 300px;">
                    <thead>
                        <tr>
                            <th>Tên cấu kiện</th>
                            <th style="text-align:right;">Số lượng</th>
                            <th>ĐVT</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${stats.topProduced.map(p => `
                            <tr>
                                <td><strong>${escapeHtml(p.name)}</strong></td>
                                <td style="text-align:right;font-weight:bold;color:var(--accent);">${Number(p.qty).toLocaleString('vi-VN')}</td>
                                <td>${p.unit}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    // Bảng tồn kho cấu kiện có phân trang
    const limit = parseInt(document.getElementById('structure-limit')?.value || '50');
    const page = parseInt(document.getElementById('structure-page')?.value || '1');
    const stockStats = stats.stockStats || [];
    const totalItems = stockStats.length;
    const totalPages = Math.ceil(totalItems / limit) || 1;
    const startIdx = (page - 1) * limit;
    const paginatedData = stockStats.slice(startIdx, startIdx + limit);
    
    const inventoryHtml = stockStats.length > 0 ? `
        <div class="card">
            <div class="sec-title" style="display:flex;justify-content:space-between;align-items:center;">
                <span>📦 TỒN KHO CẤU KIỆN CHI TIẾT</span>
                <div style="display:flex;gap:8px;align-items:center;">
                    <span class="metric-sub">Hiển thị:</span>
                    <select id="structure-limit" onchange="switchDashboardTab('structures')" style="width:80px;">
                        <option value="20" ${limit === 20 ? 'selected' : ''}>20</option>
                        <option value="50" ${limit === 50 ? 'selected' : ''}>50</option>
                        <option value="100" ${limit === 100 ? 'selected' : ''}>100</option>
                        <option value="500" ${limit === 500 ? 'selected' : ''}>500</option>
                    </select>
                </div>
            </div>
            <div class="tbl-wrap">
                <table style="min-width: 700px;">
                    <thead>
                        <tr>
                            <th>Tên cấu kiện</th>
                            <th style="text-align:right;">Tồn kho</th>
                            <th>ĐVT</th>
                            <th style="text-align:right;">Đơn giá</th>
                            <th style="text-align:right;">Thành tiền</th>
                            <th>Trạng thái</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${paginatedData.map(s => {
                            const statusClass = s.qty < 10 ? 'status-danger' : s.qty < 30 ? 'status-warn' : 'status-good';
                            const statusText = s.qty < 10 ? '⚠️ Sắp hết' : s.qty < 30 ? '📦 TB' : '✅ Tốt';
                            return `<tr style="cursor:pointer;" onclick="window.showStructureDetail('${s.id}')">
                                <td><strong style="color:var(--accent);">${escapeHtml(s.name)}</strong></td>
                                <td style="text-align:right; ${s.qty < 10 ? 'color:var(--danger-text);font-weight:bold;' : ''}">${Number(s.qty || 0).toLocaleString('vi-VN')} ${s.unit}</td>
                                <td>${s.unit}</td>
                                <td style="text-align:right;">${formatMoneyVND(s.cost || 0)}</td>
                                <td style="text-align:right;color:var(--accent);font-weight:500;">${formatMoneyVND(s.totalValue || 0)}</td>
                                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding: 0 8px;">
                <button class="sm" onclick="document.getElementById('structure-page').value=${page-1};switchDashboardTab('structures')" ${page <= 1 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>◀ Trang trước</button>
                <span class="metric-sub">Trang ${page} / ${totalPages} (${totalItems} cấu kiện)</span>
                <button class="sm" onclick="document.getElementById('structure-page').value=${page+1};switchDashboardTab('structures')" ${page >= totalPages ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>Trang sau ▶</button>
            </div>
            <input type="hidden" id="structure-page" value="${page}">
        </div>
    ` : '<div class="card"><div class="metric-sub" style="text-align:center;padding:20px;">📭 Chưa có cấu kiện nào</div></div>';
    
    return filters + structureKPIs + `
        <div class="grid2" style="margin-bottom:18px;">
            <div class="card">
                <div class="sec-title">📈 XU HƯỚNG SẢN XUẤT 6 THÁNG</div>
                <div class="chart-container" style="height:280px;"><canvas id="structure-trend-chart"></canvas></div>
            </div>
            <div class="card">
                <div class="sec-title">🥧 TOP CẤU KIỆN SẢN XUẤT NHIỀU NHẤT</div>
                ${topListHtml}
            </div>
        </div>
        ${inventoryHtml}
    `;
}
if (tab === 'forecast') {
    return `
        ${renderFiltersAndTabs()}
        <div class="kpi-grid" style="margin-bottom:16px;">
            <div class="kpi-card">
                <div class="kpi-icon" style="background:rgba(55,138,221,0.15)">📊</div>
                <div class="kpi-info">
                    <div class="kpi-label">TỔNG VẬT TƯ</div>
                    <div class="kpi-value">${state.data.materials.length}</div>
                    <div class="kpi-sub">Đang theo dõi</div>
                </div>
            </div>
            <div class="kpi-card">
                <div class="kpi-icon" style="background:rgba(240,149,149,0.15)">⚠️</div>
                <div class="kpi-info">
                    <div class="kpi-label">CẦN NHẬP GẤP</div>
                    <div class="kpi-value" id="forecast-urgent-count" style="color:var(--danger-text);">—</div>
                    <div class="kpi-sub">Dưới ngưỡng an toàn</div>
                </div>
            </div>
            <div class="kpi-card">
                <div class="kpi-icon" style="background:rgba(250,199,117,0.15)">📦</div>
                <div class="kpi-info">
                    <div class="kpi-label">SẮP HẾT</div>
                    <div class="kpi-value" id="forecast-warning-count" style="color:var(--warn-text);">—</div>
                    <div class="kpi-sub">Cần theo dõi</div>
                </div>
            </div>
            <div class="kpi-card">
                <div class="kpi-icon" style="background:rgba(151,196,89,0.15)">✅</div>
                <div class="kpi-info">
                    <div class="kpi-label">ĐỦ HÀNG</div>
                    <div class="kpi-value" id="forecast-good-count" style="color:var(--success-text);">—</div>
                    <div class="kpi-sub">An toàn</div>
                </div>
            </div>
        </div>
        <div class="card">
            <div class="sec-title">📦 DỰ BÁO NHU CẦU VẬT TƯ (3 tháng gần nhất)</div>
            <div id="forecast-container">
                <div class="metric-sub" style="text-align:center;">🔄 Đang tải dữ liệu...</div>
            </div>
        </div>
    `;
}


    return '';
}

// ========== CHARTS ==========

export function renderDashboardChart() {
    const monthlyData = getMonthlyData();
    
    const monthlyCtx = document.getElementById('monthly-chart');
    if (monthlyCtx) {
        if (monthlyChart) monthlyChart.destroy();
        monthlyChart = new Chart(monthlyCtx, {
            type: 'bar',
            data: {
                labels: monthlyData.map(m => m.label),
                datasets: [
                    { label: 'Nhập kho', data: monthlyData.map(m => m.import), backgroundColor: 'rgba(55,138,221,0.7)', borderColor: '#378ADD', borderWidth: 1, borderRadius: 4 },
                    { label: 'Xuất kho', data: monthlyData.map(m => m.export), backgroundColor: 'rgba(240,149,149,0.7)', borderColor: '#F09595', borderWidth: 1, borderRadius: 4 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatMoneyVND(ctx.raw)}` } }
                },
                scales: {
                    y: { ticks: { callback: (v) => formatMoneyVND(v) } }
                }
            }
        });
    }
    
    const catCtx = document.getElementById('category-pie-chart');
    if (catCtx) {
        if (categoryPieChart) categoryPieChart.destroy();
        
        const catInventory = {};
        state.data.materials.forEach(m => {
            if (!catInventory[m.cat]) catInventory[m.cat] = 0;
            catInventory[m.cat] += m.qty * m.cost;
        });
        
        const labels = Object.keys(catInventory);
        const data = Object.values(catInventory);
        
        if (labels.length > 0) {
            categoryPieChart = new Chart(catCtx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: ['#378ADD','#97C459','#FAC775','#F09595','#85B7EB','#BA7517','#3B6D11','#A32D2D'],
                        borderWidth: 2,
                        borderColor: 'var(--surface)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right', labels: { padding: 15, usePointStyle: true } },
                        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatMoneyVND(ctx.raw)}` } }
                    }
                }
            });
        }
    }
}

setTimeout(() => {
    const projCtx = document.getElementById('top-projects-chart');
    const pieCtx = document.getElementById('budget-pie-chart');
    if (projCtx && pieCtx && projCtx.offsetParent !== null) {
        if (topProjectsChart) topProjectsChart.destroy();
        if (window._budgetPie) window._budgetPie.destroy();
        
        const projects2 = state.data.projects.map(p => {
            const u = state.data.transactions.filter(t=>t.projectId===p.id&&t.type==='usage').reduce((s,t)=>s+Number(t.totalAmount||0),0);
            const r = state.data.transactions.filter(t=>t.projectId===p.id&&t.type==='return').reduce((s,t)=>s+Number(t.totalAmount||0),0);
            return { name: p.name.length>20?p.name.substring(0,20)+'...':p.name, spent: u-r, budget: Number(p.budget||0) };
        }).sort((a,b)=>b.spent-a.spent).slice(0,5);
        
        topProjectsChart = new Chart(projCtx, {
            type: 'bar', data: {
                labels: projects2.map(p=>p.name),
                datasets: [{
                    label: 'Đã chi', data: projects2.map(p=>p.spent),
                    backgroundColor: ['#378ADD','#97C459','#FAC775','#F09595','#85B7EB'],
                    borderRadius: 6, borderWidth: 0
                }]
            },
            options: { responsive:true, maintainAspectRatio:false,
                plugins: { legend:{display:false}, tooltip:{ callbacks:{ label: (ctx) => formatMoneyVND(ctx.raw) } } },
                scales: { y: { ticks: { callback: (v) => formatMoneyVND(v) } } }
            }
        });
        
        const totalUsed = projects2.reduce((s,p)=>s+p.spent,0);
        const totalBud = state.data.projects.reduce((s,p)=>s+Number(p.budget||0),0);
        window._budgetPie = new Chart(pieCtx, {
            type: 'doughnut', data: {
                labels: ['Đã dùng','Còn lại'],
                datasets: [{ data: [totalUsed, Math.max(0,totalBud-totalUsed)], backgroundColor: ['#F09595','#97C459'], borderWidth: 0, borderRadius: 4 }]
            },
            options: { responsive:true, maintainAspectRatio:false,
                plugins: { legend:{ position:'bottom' } }
            }
        });
    }
    
    const supCtx = document.getElementById('top-suppliers-chart');
    const pieCtx2 = document.getElementById('supplier-pie-chart');
    if (supCtx && pieCtx2 && supCtx.offsetParent !== null) {
        if (topSuppliersChart) topSuppliersChart.destroy();
        if (window._supPie) window._supPie.destroy();
        
        const sups2 = state.data.suppliers.map(s => {
            const total = state.data.transactions.filter(t=>t.type==='purchase'&&t.supplierId===s.id).reduce((a,t)=>a+Number(t.totalAmount||0),0);
            return { name: s.name.length>20?s.name.substring(0,20)+'...':s.name, total };
        }).sort((a,b)=>b.total-a.total).slice(0,5);
        
        topSuppliersChart = new Chart(supCtx, {
            type: 'bar', data: {
                labels: sups2.map(s=>s.name),
                datasets: [{
                    label: 'Tổng chi', data: sups2.map(s=>s.total),
                    backgroundColor: ['#378ADD','#97C459','#FAC775','#F09595','#85B7EB'],
                    borderRadius: 6, borderWidth: 0
                }]
            },
            options: { indexAxis: 'y', responsive:true, maintainAspectRatio:false,
                plugins: { legend:{display:false}, tooltip:{ callbacks:{ label: (ctx) => formatMoneyVND(ctx.raw) } } },
                scales: { x: { ticks: { callback: (v) => formatMoneyVND(v) } } }
            }
        });
        
        const top5Total = sups2.reduce((s,p)=>s+p.total,0);
        const allTotal = state.data.suppliers.reduce((s,p)=>{ const t=state.data.transactions.filter(x=>x.type==='purchase'&&x.supplierId===p.id).reduce((a,x)=>a+Number(x.totalAmount||0),0); return s+t; },0);
        window._supPie = new Chart(pieCtx2, {
            type: 'doughnut', data: {
                labels: [...sups2.map(s=>s.name), 'Khác'],
                datasets: [{ data: [...sups2.map(s=>s.total), Math.max(0,allTotal-top5Total)], backgroundColor: ['#378ADD','#97C459','#FAC775','#F09595','#85B7EB','#BA7517'], borderWidth: 0, borderRadius: 4 }]
            },
            options: { responsive:true, maintainAspectRatio:false,
                plugins: { legend:{ position:'bottom', labels:{ padding:10, usePointStyle:true } } }
            }
        });
    }
}, 400);

// ========== EVENT BINDING ==========

export function bindDashboardFilterEvents() {
    const applyBtn = document.getElementById('filter-apply');
    const resetBtn = document.getElementById('filter-reset');
    if (applyBtn) { applyBtn.onclick = applyFilters; }
    if (resetBtn) { resetBtn.onclick = resetFilters; }
}

export function bindDashboardSearchEvents() {
    bindDashboardFilterEvents();
}

export function renderCharts() {}
export function renderProjectCharts() {}

// Lắng nghe sự kiện từ socket.io để clear cache
if (typeof window !== 'undefined' && window.socket) {
    window.socket.on('dataChanged', function() {
        clearDashboardCache();
        console.log('🔄 Socket: dataChanged - cache cleared');
    });
}

window.clearDashboardCache = clearDashboardCache;
window.renderDashboardChart = renderDashboardChart;
window.getFilteredTransactions = getFilteredTransactions;
window.topProjectsChart = topProjectsChart;
window.topSuppliersChart = topSuppliersChart;
// ========== DỰ BÁO NHU CẦU ==========
let forecastDataCache = null;
let forecastPage = 1;
let forecastLimit = 50;

async function loadForecast() {
    console.log('🔍 loadForecast called');
    const container = document.getElementById('forecast-container');
    if (!container) return;
    
    container.innerHTML = '<div class="metric-sub" style="text-align:center;">🔄 Đang tải dữ liệu...</div>';
    
    try {
        const res = await fetch('/api/forecast');
        const data = await res.json();
        
        if (!data.success || !data.data || data.data.length === 0) {
            container.innerHTML = '<div class="metric-sub" style="text-align:center;">📭 Chưa có dữ liệu dự báo</div>';
            document.getElementById('forecast-urgent-count').textContent = '0';
            document.getElementById('forecast-warning-count').textContent = '0';
            document.getElementById('forecast-good-count').textContent = '0';
            return;
        }
        
        // Cache dữ liệu
        forecastDataCache = data.data;
        forecastPage = 1;
        
        // Cập nhật KPI cards
        const urgentCount = data.data.filter(item => item.warning_level === 'danger').length;
        const warningCount = data.data.filter(item => item.warning_level === 'warning').length;
        const goodCount = data.data.filter(item => item.warning_level === 'good' || item.warning_level === 'info').length;
        
        const urgentEl = document.getElementById('forecast-urgent-count');
        const warningEl = document.getElementById('forecast-warning-count');
        const goodEl = document.getElementById('forecast-good-count');
        
        if (urgentEl) urgentEl.textContent = urgentCount;
        if (warningEl) warningEl.textContent = warningCount;
        if (goodEl) goodEl.textContent = goodCount;
        
        // Render bảng với phân trang
        renderForecastTable();
    } catch(e) {
        console.error('❌ Forecast error:', e);
        container.innerHTML = '<div class="metric-sub" style="text-align:center;">❌ Lỗi tải dữ liệu: ' + e.message + '</div>';
    }
}

function renderForecastTable() {
    const container = document.getElementById('forecast-container');
    if (!container || !forecastDataCache) return;
    
    const totalItems = forecastDataCache.length;
    const totalPages = Math.ceil(totalItems / forecastLimit) || 1;
    if (forecastPage > totalPages) forecastPage = totalPages;
    if (forecastPage < 1) forecastPage = 1;
    
    const startIdx = (forecastPage - 1) * forecastLimit;
    const paginatedData = forecastDataCache.slice(startIdx, startIdx + forecastLimit);
    
    let html = '<div class="tbl-wrap"><table style="min-width:800px;"><thead><tr>' +
        '<th>Vật tư</th><th>ĐVT</th><th style="text-align:right;">Tồn kho</th>' +
        '<th style="text-align:right;">TB tháng</th><th style="text-align:right;">Đề xuất nhập</th>' +
        '<th>Trạng thái</th><th>Gợi ý</th>' +
        '</tr></thead><tbody>';
    
    paginatedData.forEach(item => {
        const statusClass = item.warning_level === 'danger' ? 'status-danger' : 
                           item.warning_level === 'warning' ? 'status-warn' : 
                           item.warning_level === 'info' ? 'status-good' : 'status-good';
        let suggestion = '';
        if (item.current_stock <= item.min_stock) {
            suggestion = '⚠️ Cần nhập gấp!';
        } else if (item.total_exported > 0 && item.current_stock < item.avg_monthly_usage) {
            suggestion = '📦 Nên nhập ' + item.suggested_order + ' ' + item.unit;
        } else if (item.total_exported === 0) {
            suggestion = '💤 Chưa có nhu cầu';
        } else {
            suggestion = '✅ Tạm ổn';
        }
        
        html += '<tr onclick="window.showMaterialDetail(\'' + item.id + '\')" style="cursor:pointer;">' +
            '<td><strong>' + escapeHtml(item.name) + '</strong></td>' +
            '<td>' + item.unit + '</td>' +
            '<td style="text-align:right;' + (item.warning_level === 'danger' ? 'color:var(--danger-text);font-weight:bold;' : '') + '">' + Number(item.current_stock).toLocaleString('vi-VN') + '</td>' +
            '<td style="text-align:right;">' + Number(item.avg_monthly_usage).toLocaleString('vi-VN') + '</td>' +
            '<td style="text-align:right;color:var(--accent);font-weight:bold;">' + Number(item.suggested_order).toLocaleString('vi-VN') + ' ' + item.unit + '</td>' +
            '<td><span class="status-badge ' + statusClass + '">' + item.status + '</span></td>' +
            '<td>' + suggestion + '</td>' +
            '</tr>';
    });
    
    html += '</tbody></table></div>';
    
    // Phân trang
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding:8px 12px;background:var(--surface2);border-radius:8px;">';
    html += '<div style="display:flex;gap:8px;align-items:center;">';
    html += '<span class="metric-sub">Hiển thị:</span>';
    html += '<select id="forecast-limit" onchange="forecastLimit=parseInt(this.value);forecastPage=1;renderForecastTable()" style="width:80px;">';
    html += '<option value="20"' + (forecastLimit===20?' selected':'') + '>20</option>';
    html += '<option value="50"' + (forecastLimit===50?' selected':'') + '>50</option>';
    html += '<option value="100"' + (forecastLimit===100?' selected':'') + '>100</option>';
    html += '<option value="500"' + (forecastLimit===500?' selected':'') + '>500</option>';
    html += '</select>';
    html += '</div>';
    
    html += '<div style="display:flex;gap:8px;align-items:center;">';
    html += '<button class="sm" onclick="forecastPage=' + (forecastPage-1) + ';renderForecastTable()"' + (forecastPage<=1?' disabled style="opacity:0.5;cursor:not-allowed;"':'') + '>◀ Trang trước</button>';
    html += '<span class="metric-sub">Trang ' + forecastPage + ' / ' + totalPages + ' (' + totalItems + ' vật tư)</span>';
    html += '<button class="sm" onclick="forecastPage=' + (forecastPage+1) + ';renderForecastTable()"' + (forecastPage>=totalPages?' disabled style="opacity:0.5;cursor:not-allowed;"':'') + '>Trang sau ▶</button>';
    html += '</div>';
    html += '</div>';
    
    html += '<div class="metric-sub" style="margin-top:8px;">📌 Dự báo dựa trên nhu cầu 3 tháng gần nhất (trung bình tháng × 2 - tồn kho hiện tại)</div>';
    
    container.innerHTML = html;
}

// Export global
window.loadForecast = loadForecast;
window.renderForecastTable = renderForecastTable;
