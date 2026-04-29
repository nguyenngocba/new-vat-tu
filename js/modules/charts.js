import { state, formatMoney, escapeHtml } from './state.js';
import { formatMoneyVND } from './utils.js';

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
            if (t.type === 'purchase') months[key].import += t.totalAmount || 0;
            if (t.type === 'usage') months[key].export += t.totalAmount || 0;
            if (t.type === 'return') months[key].return += t.totalAmount || 0;
        }
    });
    
    return Object.values(months);
}

function getTotalsForPeriod(transactions) {
    let totalImport = 0, totalExport = 0, totalReturn = 0;
    transactions.forEach(t => {
        if (t.type === 'purchase') totalImport += t.totalAmount || 0;
        if (t.type === 'usage') totalExport += t.totalAmount || 0;
        if (t.type === 'return') totalReturn += t.totalAmount || 0;
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
        localStorage.setItem('steeltrack_auto_backup', JSON.stringify(backupData));
        localStorage.setItem(lastBackupKey, today);
    }
}

export function checkLowStockNotification() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const lowStockItems = state.data.materials.filter(m => m.qty <= m.low);
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
    updateDashboardContent();
}

function resetFilters() {
    advancedFilters = { dateFrom: '', dateTo: '', materialCategory: 'all', projectId: 'all', supplierId: 'all', transactionType: 'all' };
    ['filter-date-from','filter-date-to','filter-transaction-type','filter-material-category','filter-project','filter-supplier'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = 'all';
    });
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

function renderKPICards() {
    const allTxns = getFilteredTransactions();
    const { totalImport, totalExport, totalReturn, netSpent } = getTotalsForPeriod(allTxns);
    const totalInventory = state.data.materials.reduce((s, m) => s + (m.qty * m.cost), 0);
    const lowStockCount = state.data.materials.filter(m => m.qty <= m.low).length;
    
    // So sánh với tháng trước
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
    const monthlyData = getMonthlyData();
    const allTxns = getFilteredTransactions();
    
    // Category stats
    const catStats = {};
    allTxns.forEach(t => {
        const mat = state.data.materials.find(m => m.id === t.mid);
        if (mat) {
            if (!catStats[mat.cat]) catStats[mat.cat] = { import: 0, export: 0, qty: 0 };
            if (t.type === 'purchase') catStats[mat.cat].import += t.totalAmount || 0;
            if (t.type === 'usage') catStats[mat.cat].export += t.totalAmount || 0;
        }
    });
    
    // Top projects
    const projectStats = {};
    allTxns.filter(t => t.type === 'usage' && t.projectId).forEach(t => {
        if (!projectStats[t.projectId]) projectStats[t.projectId] = 0;
        projectStats[t.projectId] += t.totalAmount || 0;
    });
    const topProjects = Object.entries(projectStats)
        .map(([id, total]) => ({ name: state.data.projects.find(p=>p.id===id)?.name||'Khác', total, id }))
        .sort((a,b) => b.total - a.total).slice(0, 5);
    const maxProject = topProjects[0]?.total || 1;
    
    // Top suppliers
    const supplierStats = {};
    allTxns.filter(t => t.type === 'purchase' && t.supplierId).forEach(t => {
        if (!supplierStats[t.supplierId]) supplierStats[t.supplierId] = 0;
        supplierStats[t.supplierId] += t.totalAmount || 0;
    });
    const topSuppliers = Object.entries(supplierStats)
        .map(([id, total]) => ({ name: state.data.suppliers.find(s=>s.id===id)?.name||'Khác', total, id }))
        .sort((a,b) => b.total - a.total).slice(0, 5);
    const maxSupplier = topSuppliers[0]?.total || 1;
    
    // Recent transactions
    const recentTxns = allTxns.sort((a,b) => new Date(b.datetime||b.date) - new Date(a.datetime||a.date)).slice(0, 10);
    
    return `
        ${renderFiltersAndTabs()}
        ${renderKPICards()}
        
        <!-- Biểu đồ chính -->
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
        
        <!-- Top + Chart -->
        <div class="grid2" style="margin-bottom: 18px;">
            <div class="card">
                <div class="sec-title">🏗️ TOP 5 CÔNG TRÌNH TIÊU THỤ NHIỀU NHẤT</div>
                <div style="display:flex;flex-direction:column;gap:10px;">
                    ${topProjects.map((p, i) => `
                        <div style="cursor:pointer;" onclick="window.showProjectDetail('${p.id}')">
                            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                                <span>${i+1}. ${escapeHtml(p.name)}</span>
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
                                <span>${i+1}. ${escapeHtml(s.name)}</span>
                                <strong>${formatMoneyVND(s.total)}</strong>
                            </div>
                            <div class="progress-bar" style="height:8px;"><div class="progress-fill" style="width:${(s.total/maxSupplier)*100}%;background:${i===0?'#378ADD':i===1?'#97C459':i===2?'#FAC775':'#85B7EB'};border-radius:4px;"></div></div>
                        </div>
                    `).join('')}
                    ${topSuppliers.length === 0 ? '<div class="metric-sub">Chưa có dữ liệu</div>' : ''}
                </div>
            </div>
        </div>
        
        <!-- Recent Transactions -->
        <div class="card">
            <div class="sec-title">📋 GIAO DỊCH GẦN ĐÂY</div>
            <div class="tbl-wrap">
                <table style="min-width: 800px;">
                    <thead><tr><th>Thời gian</th><th>Loại</th><th>Vật tư</th><th style="text-align:right;">SL</th><th style="text-align:right;">Thành tiền</th><th>Đối tượng</th></tr></thead>
                    <tbody>
                        ${recentTxns.map(t => {
                            const mat = state.data.materials.find(m=>m.id===t.mid);
                            const dt = t.datetime ? new Date(t.datetime).toLocaleString('vi-VN') : t.date;
                            let icon = '📥', label = 'Nhập kho', target = '';
                            if (t.type === 'usage') { icon = '📤'; label = 'Xuất kho'; target = state.data.projects.find(p=>p.id===t.projectId)?.name || ''; }
                            else if (t.type === 'return') { icon = '🔄'; label = 'Trả hàng'; target = state.data.projects.find(p=>p.id===t.projectId)?.name || ''; }
                            else { target = state.data.suppliers.find(s=>s.id===t.supplierId)?.name || ''; }
                            return `<tr>
                                <td style="white-space:nowrap;">${dt}</td>
                                <td>${icon} ${label}</td>
                                <td>${escapeHtml(mat?.name||'N/A')}</td>
                                <td style="text-align:right;">${(t.qty||0).toLocaleString('vi-VN')} ${mat?.unit||''}</td>
                                <td style="text-align:right;font-weight:500;">${formatMoneyVND(t.totalAmount)}</td>
                                <td>${escapeHtml(target)}</td>
                            </tr>`;
                        }).join('')}
                        ${recentTxns.length === 0 ? '<tr><td colspan="6" style="text-align:center;">📭 Chưa có giao dịch</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderFiltersAndTabs() {
    return `
        <div class="dashboard-tabs">
            <div class="dashboard-tab ${currentDashboardTab==='overview'?'active':''}" onclick="window.switchDashboardTab('overview')">📊 Tổng quan</div>
            <div class="dashboard-tab ${currentDashboardTab==='projects'?'active':''}" onclick="window.switchDashboardTab('projects')">🏗️ Công trình</div>
            <div class="dashboard-tab ${currentDashboardTab==='suppliers'?'active':''}" onclick="window.switchDashboardTab('suppliers')">🏭 Nhà cung cấp</div>
        </div>
        ${renderAdvancedFilters()}
    `;
}

window.switchDashboardTab = function(tab) {
    currentDashboardTab = tab;
    if (tab === 'projects' || tab === 'suppliers') {
        document.getElementById('pane-dashboard').innerHTML = renderTabContent(tab);
    } else {
        updateDashboardContent();
    }
};

function renderTabContent(tab) {
    const filters = renderFiltersAndTabs();
    
    if (tab === 'projects') {
        const projects = state.data.projects.map(p => {
            const u = state.data.transactions.filter(t=>t.projectId===p.id&&t.type==='usage').reduce((s,t)=>s+(t.totalAmount||0),0);
            const r = state.data.transactions.filter(t=>t.projectId===p.id&&t.type==='return').reduce((s,t)=>s+(t.totalAmount||0),0);
            return { ...p, spent: u-r, pct: p.budget>0?(u-r)/p.budget*100:0 };
        }).sort((a,b)=>b.spent-a.spent);
        
        const maxPct = Math.max(...projects.map(p=>p.pct), 1);
        
        return filters + `
            <div class="card">
                <div class="sec-title">🏗️ CHI TIẾT TẤT CẢ CÔNG TRÌNH</div>
                <div class="tbl-wrap">
                    <table style="min-width:900px;">
                        <thead><tr><th>Mã</th><th>Tên</th><th>Ngân sách</th><th>Đã chi</th><th>Còn lại</th><th>%</th><th>Tiến độ</th></tr></thead>
                        <tbody>
                            ${projects.map(p => `
                                <tr style="cursor:pointer;" onclick="window.showProjectDetail('${p.id}')">
                                    <td>${p.id}</td>
                                    <td><strong>${escapeHtml(p.name)}</strong></td>
                                    <td style="text-align:right;">${formatMoneyVND(p.budget)}</td>
                                    <td style="text-align:right;" class="text-warning">${formatMoneyVND(p.spent)}</td>
                                    <td style="text-align:right;color:var(--success-text);">${formatMoneyVND(p.budget-p.spent)}</td>
                                    <td style="text-align:center;font-weight:bold;">${p.pct.toFixed(1)}%</td>
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
            return { ...s, total: txns.reduce((sum,t)=>sum+(t.totalAmount||0),0), count: txns.length };
        }).sort((a,b)=>b.total-a.total);
        
        return filters + `
            <div class="card">
                <div class="sec-title">🏭 CHI TIẾT TẤT CẢ NHÀ CUNG CẤP</div>
                <div class="tbl-wrap">
                    <table style="min-width:800px;">
                        <thead><tr><th>Mã</th><th>Tên</th><th>SĐT</th><th>Email</th><th>Tổng chi</th><th>Số lần</th><th>TB/Lần</th></tr></thead>
                        <tbody>
                            ${suppliers.map(s => `
                                <tr style="cursor:pointer;" onclick="window.showSupplierDetail('${s.id}')">
                                    <td>${s.id}</td>
                                    <td><strong>${escapeHtml(s.name)}</strong></td>
                                    <td>${s.phone||'—'}</td>
                                    <td>${s.email||'—'}</td>
                                    <td style="text-align:right;" class="text-warning">${formatMoneyVND(s.total)}</td>
                                    <td style="text-align:center;">${s.count}</td>
                                    <td style="text-align:right;">${s.count>0?formatMoneyVND(s.total/s.count):'0 ₫'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    return '';
}

// ========== CHARTS ==========

export function renderDashboardChart() {
    const monthlyData = getMonthlyData();
    
    // Monthly chart
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
    
    // Category Pie chart
    const catCtx = document.getElementById('category-pie-chart');
    if (catCtx) {
        if (categoryPieChart) categoryPieChart.destroy();
        
        // Tổng tồn kho theo danh mục
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