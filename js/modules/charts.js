import { state, formatMoney, escapeHtml } from './state.js';
import { formatMoneyVND } from './utils.js';

let stockChart = null;
let projectChart = null;
let supplierChart = null;
let categoryChart = null;
let monthlyChart = null;

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
            new Notification('SteelTrack Pro', { body: 'Thông báo đã được bật!', icon: '🏭' });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification('SteelTrack Pro', { body: 'Bạn sẽ nhận được cảnh báo khi hàng sắp hết!', icon: '🏭' });
                }
            });
        }
    } else {
        alert('Trình duyệt của bạn không hỗ trợ thông báo');
    }
}

function getMonthlyStats() {
    const months = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months[key] = { import: 0, export: 0, label: `${d.getMonth() + 1}/${d.getFullYear()}` };
    }
    state.data.transactions.forEach(t => {
        const date = new Date(t.date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (months[key]) {
            if (t.type === 'purchase') months[key].import += t.totalAmount || 0;
            if (t.type === 'usage') months[key].export += t.totalAmount || 0;
        }
    });
    return Object.values(months);
}

export function renderDashboard() {
    const totalVal = state.data.materials.reduce((s, m) => s + (m.qty * m.cost), 0);
    const totalProjectCost = state.data.transactions.filter(t => t.type === 'usage').reduce((s, t) => s + (t.totalAmount || 0), 0);
    const totalPurchaseCost = state.data.transactions.filter(t => t.type === 'purchase').reduce((s, t) => s + (t.totalAmount || 0), 0);
    const lowStockItems = state.data.materials.filter(m => m.qty <= m.low);
    const lowStockCount = lowStockItems.length;
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentImports = state.data.transactions.filter(t => t.type === 'purchase' && new Date(t.date) >= thirtyDaysAgo);
    const materialImportStats = {};
    recentImports.forEach(t => {
        if (!materialImportStats[t.mid]) materialImportStats[t.mid] = { qty: 0, name: '' };
        materialImportStats[t.mid].qty += t.qty;
        const mat = state.data.materials.find(m => m.id === t.mid);
        if (mat) materialImportStats[t.mid].name = mat.name;
    });
    const topMaterials = Object.entries(materialImportStats).map(([id, data]) => ({ id, name: data.name, qty: data.qty })).sort((a, b) => b.qty - a.qty).slice(0, 10);
    
    const lowStockHtml = lowStockCount > 0 ? `
        <div class="card" style="margin-bottom: 16px; background: var(--warn-bg); border-color: var(--warn);">
            <div class="sec-title" style="color: var(--warn-text);">⚠️ CẢNH BÁO TỒN KHO THẤP</div>
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                ${lowStockItems.map(m => `<div class="metric-card" style="background: var(--surface);"><div><strong>${escapeHtml(m.name)}</strong></div><div>Tồn: ${m.qty.toLocaleString('vi-VN')} ${m.unit}</div><div>Ngưỡng: ${m.low}</div></div>`).join('')}
            </div>
            <button class="sm" id="request-notification" style="margin-top: 10px;" onclick="window.requestNotification()">🔔 Bật thông báo</button>
        </div>
    ` : '';
    
    return `
        <div class="grid4">
            <div class="metric-card"><div class="metric-label">💰 Giá trị tồn kho</div><div class="metric-val">${formatMoneyVND(totalVal)}</div></div>
            <div class="metric-card"><div class="metric-label">📦 Số mặt hàng</div><div class="metric-val">${state.data.materials.length}</div></div>
            <div class="metric-card"><div class="metric-label">🏗️ Chi phí công trình</div><div class="metric-val">${formatMoneyVND(totalProjectCost)}</div></div>
            <div class="metric-card"><div class="metric-label">📥 Tổng nhập kho</div><div class="metric-val">${formatMoneyVND(totalPurchaseCost)}</div></div>
        </div>
        ${lowStockHtml}
        <div class="grid2" style="margin-bottom:18px">
            <div class="card"><div class="sec-title">🏆 TOP 10 VẬT TƯ NHẬP NHIỀU NHẤT (30 ngày)</div>
                ${topMaterials.length > 0 ? `<div class="tbl-wrap"><table><thead><tr><th>#</th><th>Tên vật tư</th><th>Số lượng nhập</th></tr></thead><tbody>${topMaterials.map((m, idx) => `<tr><td>${idx + 1}</td><td><strong>${escapeHtml(m.name)}</strong></td><td>${m.qty.toLocaleString('vi-VN')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="metric-sub">Chưa có dữ liệu nhập trong 30 ngày qua</div>'}
            </div>
            <div class="card"><div class="sec-title">📈 THỐNG KÊ NHẬP/XUẤT THEO THÁNG</div><div class="chart-container" style="height: 200px;"><canvas id="monthly-chart"></canvas></div></div>
        </div>
        <div class="grid2" style="margin-bottom:18px">
            <div class="card"><div class="sec-title">📈 BIỂU ĐỒ TỒN KHO</div><div class="chart-container" style="height:250px"><canvas id="ch-stock"></canvas></div></div>
            <div class="card"><div class="sec-title">🥧 TỶ LỆ GIÁ TRỊ THEO DANH MỤC</div><div class="chart-container" style="height:250px"><canvas id="category-chart"></canvas></div></div>
        </div>
        <div class="card"><div class="sec-title">🏭 NHẬP HÀNG THEO NHÀ CUNG CẤP</div><div class="chart-container" style="height:250px"><canvas id="ch-supplier"></canvas></div></div>
    `;
}

export function renderDashboardChart() {
    const ctx = document.getElementById('ch-stock');
    if (!ctx) return;
    if (stockChart) stockChart.destroy();
    if (state.data.materials.length === 0) return;
    
    stockChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: state.data.materials.map(m => m.name), datasets: [{ label: 'Số lượng tồn', data: state.data.materials.map(m => m.qty), backgroundColor: '#378ADD', borderRadius: 6 }] },
        options: { maintainAspectRatio: true, responsive: true, plugins: { legend: { position: 'top' } } }
    });
    
    const supplierCtx = document.getElementById('ch-supplier');
    if (supplierCtx) {
        if (supplierChart) supplierChart.destroy();
        const supplierStats = state.data.suppliers.map(s => ({ name: s.name, total: state.data.transactions.filter(t => t.type === 'purchase' && t.supplierId === s.id).reduce((sum, t) => sum + (t.totalAmount || 0), 0) })).filter(s => s.total > 0);
        if (supplierStats.length > 0) {
            supplierChart = new Chart(supplierCtx, {
                type: 'bar',
                data: { labels: supplierStats.map(s => s.name), datasets: [{ label: 'Giá trị nhập hàng (VNĐ)', data: supplierStats.map(s => s.total), backgroundColor: '#97C459', borderRadius: 6 }] },
                options: { maintainAspectRatio: false }
            });
        }
    }
    
    const categoryCtx = document.getElementById('category-chart');
    if (categoryCtx) {
        if (categoryChart) categoryChart.destroy();
        const categoryStats = {};
        state.data.materials.forEach(m => { if (!categoryStats[m.cat]) categoryStats[m.cat] = 0; categoryStats[m.cat] += m.qty * m.cost; });
        const labels = Object.keys(categoryStats);
        const data = Object.values(categoryStats);
        if (labels.length > 0) {
            categoryChart = new Chart(categoryCtx, {
                type: 'pie',
                data: { labels: labels, datasets: [{ data: data, backgroundColor: ['#378ADD', '#97C459', '#FAC775', '#F09595', '#85B7EB', '#BA7517', '#3B6D11', '#A32D2D'] }] },
                options: { maintainAspectRatio: true, responsive: true, plugins: { legend: { position: 'right' } } }
            });
        }
    }
    
    const monthlyCtx = document.getElementById('monthly-chart');
    if (monthlyCtx) {
        const monthlyStats = getMonthlyStats();
        if (monthlyChart) monthlyChart.destroy();
        monthlyChart = new Chart(monthlyCtx, {
            type: 'line',
            data: { labels: monthlyStats.map(m => m.label), datasets: [{ label: 'Nhập kho', data: monthlyStats.map(m => m.import), borderColor: '#97C459', backgroundColor: 'transparent', tension: 0.3, fill: false }, { label: 'Xuất kho', data: monthlyStats.map(m => m.export), borderColor: '#F09595', backgroundColor: 'transparent', tension: 0.3, fill: false }] },
            options: { maintainAspectRatio: true, responsive: true, plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatMoneyVND(ctx.raw)}` } } } }
        });
    }
}

export function renderCharts() {}
export function renderProjectCharts() {}