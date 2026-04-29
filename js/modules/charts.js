import { state, formatMoney, escapeHtml } from './state.js';
import { formatMoneyVND } from './utils.js';

let stockChart = null;
let projectChart = null;
let supplierChart = null;
let categoryChart = null;
let monthlyChart = null;
let currentDashboardFilter = '';
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

function getMonthlyStats() {
    const months = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months[key] = { import: 0, export: 0, label: `${d.getMonth() + 1}/${d.getFullYear()}` };
    }
    
    let filteredTransactions = state.data.transactions;
    if (currentDashboardFilter) {
        const keyword = currentDashboardFilter.toLowerCase();
        filteredTransactions = state.data.transactions.filter(t => {
            const mat = state.data.materials.find(m => m.id === t.mid);
            const project = state.data.projects.find(p => p.id === t.projectId);
            const supplier = state.data.suppliers.find(s => s.id === t.supplierId);
            return (mat && mat.name.toLowerCase().includes(keyword)) ||
                   (project && project.name.toLowerCase().includes(keyword)) ||
                   (supplier && supplier.name.toLowerCase().includes(keyword));
        });
    }
    
    filteredTransactions.forEach(t => {
        const dateStr = t.datetime || t.date;
        const date = new Date(dateStr);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (months[key]) {
            if (t.type === 'purchase') months[key].import += t.totalAmount || 0;
            if (t.type === 'usage') months[key].export += t.totalAmount || 0;
        }
    });
    
    return Object.values(months);
}

function getFilteredMaterials() {
    if (!currentDashboardFilter) return state.data.materials;
    const keyword = currentDashboardFilter.toLowerCase();
    return state.data.materials.filter(m => 
        m.name.toLowerCase().includes(keyword) || 
        m.cat.toLowerCase().includes(keyword) ||
        m.id.toLowerCase().includes(keyword)
    );
}

function getFilteredSuppliers() {
    if (!currentDashboardFilter) return state.data.suppliers;
    const keyword = currentDashboardFilter.toLowerCase();
    return state.data.suppliers.filter(s => 
        s.name.toLowerCase().includes(keyword) || 
        s.id.toLowerCase().includes(keyword)
    );
}

export function renderDashboard() {
    const filteredMaterials = getFilteredMaterials();
    const totalVal = filteredMaterials.reduce((s, m) => s + (m.qty * m.cost), 0);
    const totalProjectCost = state.data.transactions.filter(t => t.type === 'usage').reduce((s, t) => s + (t.totalAmount || 0), 0);
    const totalPurchaseCost = state.data.transactions.filter(t => t.type === 'purchase').reduce((s, t) => s + (t.totalAmount || 0), 0);
    const lowStockItems = state.data.materials.filter(m => m.qty <= m.low);
    const lowStockCount = lowStockItems.length;
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    let recentImports = state.data.transactions.filter(t => t.type === 'purchase' && new Date(t.datetime || t.date) >= thirtyDaysAgo);
    
    if (currentDashboardFilter) {
        const keyword = currentDashboardFilter.toLowerCase();
        recentImports = recentImports.filter(t => {
            const mat = state.data.materials.find(m => m.id === t.mid);
            return mat && mat.name.toLowerCase().includes(keyword);
        });
    }
    
    const materialImportStats = {};
    recentImports.forEach(t => {
        if (!materialImportStats[t.mid]) materialImportStats[t.mid] = { qty: 0, name: '' };
        materialImportStats[t.mid].qty += t.qty;
        const mat = state.data.materials.find(m => m.id === t.mid);
        if (mat) materialImportStats[t.mid].name = mat.name;
    });
    const topMaterials = Object.entries(materialImportStats)
        .map(([id, data]) => ({ id, name: data.name, qty: data.qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10);
    
    const filteredSuppliers = getFilteredSuppliers();
    const supplierStats = filteredSuppliers.map(s => ({
        name: s.name,
        total: state.data.transactions.filter(t => t.type === 'purchase' && t.supplierId === s.id).reduce((sum, t) => sum + (t.totalAmount || 0), 0)
    })).filter(s => s.total > 0);
    
    const lowStockHtml = lowStockCount > 0 ? `
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
    
    return `
        <div class="card" style="margin-bottom: 16px;">
            <div class="sec-title">🔍 TÌM KIẾM THỐNG KÊ</div>
            <div style="display: flex; gap: 10px; align-items: center;">
                <input type="text" id="dashboard-search" placeholder="Tìm theo tên vật tư, công trình, nhà cung cấp..." 
                       value="${escapeHtml(currentDashboardFilter)}" style="flex: 1;">
                <button id="dashboard-clear-search" class="sm">🗑️ Xóa</button>
            </div>
        </div>
        <div class="grid4">
            <div class="metric-card"><div class="metric-label">💰 Giá trị tồn kho</div><div class="metric-val">${formatMoneyVND(totalVal)}</div></div>
            <div class="metric-card"><div class="metric-label">📦 Số mặt hàng</div><div class="metric-val">${filteredMaterials.length}</div></div>
            <div class="metric-card"><div class="metric-label">🏗️ Chi phí công trình</div><div class="metric-val">${formatMoneyVND(totalProjectCost)}</div></div>
            <div class="metric-card"><div class="metric-label">📥 Tổng nhập kho</div><div class="metric-val">${formatMoneyVND(totalPurchaseCost)}</div></div>
        </div>
        ${lowStockHtml}
        <div class="grid2" style="margin-bottom:18px">
            <div class="card"><div class="sec-title">🏆 TOP 10 VẬT TƯ NHẬP NHIỀU NHẤT (30 ngày)</div>
                ${topMaterials.length > 0 ? `
                    <div class="tbl-wrap">
                        <table style="width: 100%;">
                            <thead><tr><th>#</th><th>Tên vật tư</th><th>Số lượng nhập</th></tr></thead>
                            <tbody>
                                ${topMaterials.map((m, idx) => `
                                    <tr>
                                        <td>${idx + 1}</td>
                                        <td><strong>${escapeHtml(m.name)}</strong></td>
                                        <td>${m.qty.toLocaleString('vi-VN')}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<div class="metric-sub">Chưa có dữ liệu nhập trong 30 ngày qua</div>'}
            </div>
            <div class="card"><div class="sec-title">📈 THỐNG KÊ NHẬP/XUẤT THEO THÁNG</div>
                <div class="chart-container" style="height: 200px;"><canvas id="monthly-chart"></canvas></div>
            </div>
        </div>
        <div class="grid2" style="margin-bottom:18px">
            <div class="card"><div class="sec-title">📈 BIỂU ĐỒ TỒN KHO (${filteredMaterials.length} mặt hàng)</div>
                <div class="chart-container" style="height:250px"><canvas id="ch-stock"></canvas></div>
            </div>
            <div class="card"><div class="sec-title">🥧 TỶ LỆ GIÁ TRỊ THEO DANH MỤC</div>
                <div class="chart-container" style="height:250px"><canvas id="category-chart"></canvas></div>
            </div>
        </div>
        <div class="card"><div class="sec-title">🏭 NHẬP HÀNG THEO NHÀ CUNG CẤP</div>
            <div class="chart-container" style="height:250px"><canvas id="ch-supplier"></canvas></div>
        </div>
    `;
}

export function renderDashboardChart() {
    const filteredMaterials = getFilteredMaterials();
    const ctx = document.getElementById('ch-stock');
    if (!ctx) return;
    if (stockChart) stockChart.destroy();
    if (filteredMaterials.length === 0) return;
    
    stockChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: filteredMaterials.map(m => m.name),
            datasets: [{ label: 'Số lượng tồn', data: filteredMaterials.map(m => m.qty), backgroundColor: '#378ADD', borderRadius: 6 }]
        },
        options: { maintainAspectRatio: true, responsive: true, plugins: { legend: { position: 'top' } } }
    });
    
    const supplierCtx = document.getElementById('ch-supplier');
    if (supplierCtx) {
        if (supplierChart) supplierChart.destroy();
        const filteredSuppliers = getFilteredSuppliers();
        const supplierStats = filteredSuppliers.map(s => ({
            name: s.name,
            total: state.data.transactions.filter(t => t.type === 'purchase' && t.supplierId === s.id).reduce((sum, t) => sum + (t.totalAmount || 0), 0)
        })).filter(s => s.total > 0);
        if (supplierStats.length > 0) {
            supplierChart = new Chart(supplierCtx, {
                type: 'bar',
                data: {
                    labels: supplierStats.map(s => s.name),
                    datasets: [{ label: 'Giá trị nhập hàng (VNĐ)', data: supplierStats.map(s => s.total), backgroundColor: '#97C459', borderRadius: 6 }]
                },
                options: { maintainAspectRatio: false }
            });
        } else {
            supplierCtx.getContext('2d').clearRect(0, 0, supplierCtx.width, supplierCtx.height);
            supplierCtx.getContext('2d').fillStyle = '#7a8099';
            supplierCtx.getContext('2d').font = '14px sans-serif';
            supplierCtx.getContext('2d').fillText('Chưa có dữ liệu nhập hàng', 10, 50);
        }
    }
    
    const categoryCtx = document.getElementById('category-chart');
    if (categoryCtx) {
        if (categoryChart) categoryChart.destroy();
        const categoryStats = {};
        filteredMaterials.forEach(m => {
            if (!categoryStats[m.cat]) categoryStats[m.cat] = 0;
            categoryStats[m.cat] += m.qty * m.cost;
        });
        const labels = Object.keys(categoryStats);
        const data = Object.values(categoryStats);
        if (labels.length > 0) {
            categoryChart = new Chart(categoryCtx, {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{ data: data, backgroundColor: ['#378ADD', '#97C459', '#FAC775', '#F09595', '#85B7EB', '#BA7517', '#3B6D11', '#A32D2D'] }]
                },
                options: { maintainAspectRatio: true, responsive: true, plugins: { legend: { position: 'right' } } }
            });
        } else {
            categoryCtx.getContext('2d').clearRect(0, 0, categoryCtx.width, categoryCtx.height);
            categoryCtx.getContext('2d').fillStyle = '#7a8099';
            categoryCtx.getContext('2d').font = '14px sans-serif';
            categoryCtx.getContext('2d').fillText('Chưa có dữ liệu danh mục', 10, 50);
        }
    }
    
    const monthlyCtx = document.getElementById('monthly-chart');
    if (monthlyCtx) {
        const monthlyStats = getMonthlyStats();
        if (monthlyChart) monthlyChart.destroy();
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

export function bindDashboardSearchEvents() {
    const searchInput = document.getElementById('dashboard-search');
    const clearBtn = document.getElementById('dashboard-clear-search');
    
    if (searchInput) {
        // Xóa event cũ nếu có
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);
        
        newSearchInput.addEventListener('input', (e) => {
            // Clear timeout cũ
            if (searchTimeout) clearTimeout(searchTimeout);
            
            // Delay 300ms để tránh re-render liên tục
            searchTimeout = setTimeout(() => {
                currentDashboardFilter = e.target.value;
                // Cập nhật lại dashboard mà không render lại toàn bộ
                const dashboardPane = document.getElementById('pane-dashboard');
                if (dashboardPane) {
                    // Cập nhật lại biểu đồ
                    renderDashboardChart();
                    // Cập nhật các số liệu
                    const filteredMaterials = getFilteredMaterials();
                    const totalVal = filteredMaterials.reduce((s, m) => s + (m.qty * m.cost), 0);
                    
                    // Cập nhật các metric card
                    const metricCards = dashboardPane.querySelectorAll('.grid4 .metric-card');
                    if (metricCards.length >= 4) {
                        metricCards[0].querySelector('.metric-val').innerText = formatMoneyVND(totalVal);
                        metricCards[1].querySelector('.metric-val').innerText = filteredMaterials.length;
                    }
                    
                    // Cập nhật top 10
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    let recentImports = state.data.transactions.filter(t => t.type === 'purchase' && new Date(t.datetime || t.date) >= thirtyDaysAgo);
                    if (currentDashboardFilter) {
                        const keyword = currentDashboardFilter.toLowerCase();
                        recentImports = recentImports.filter(t => {
                            const mat = state.data.materials.find(m => m.id === t.mid);
                            return mat && mat.name.toLowerCase().includes(keyword);
                        });
                    }
                    const materialImportStats = {};
                    recentImports.forEach(t => {
                        if (!materialImportStats[t.mid]) materialImportStats[t.mid] = { qty: 0, name: '' };
                        materialImportStats[t.mid].qty += t.qty;
                        const mat = state.data.materials.find(m => m.id === t.mid);
                        if (mat) materialImportStats[t.mid].name = mat.name;
                    });
                    const topMaterials = Object.entries(materialImportStats)
                        .map(([id, data]) => ({ id, name: data.name, qty: data.qty }))
                        .sort((a, b) => b.qty - a.qty)
                        .slice(0, 10);
                    
                    const top10Container = dashboardPane.querySelector('.grid2 .card:first-child .tbl-wrap');
                    if (top10Container && topMaterials.length > 0) {
                        top10Container.innerHTML = `
                            <table style="width: 100%;">
                                <thead><tr><th>#</th><th>Tên vật tư</th><th>Số lượng nhập</th></tr></thead>
                                <tbody>
                                    ${topMaterials.map((m, idx) => `
                                        <tr>
                                            <td>${idx + 1}</td>
                                            <td><strong>${escapeHtml(m.name)}</strong></td>
                                            <td>${m.qty.toLocaleString('vi-VN')}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        `;
                    } else if (top10Container) {
                        top10Container.innerHTML = '<div class="metric-sub">Chưa có dữ liệu nhập trong 30 ngày qua</div>';
                    }
                }
            }, 300);
        });
    }
    
    if (clearBtn) {
        const newClearBtn = clearBtn.cloneNode(true);
        clearBtn.parentNode.replaceChild(newClearBtn, clearBtn);
        
        newClearBtn.onclick = () => {
            const searchInputEl = document.getElementById('dashboard-search');
            if (searchInputEl) searchInputEl.value = '';
            currentDashboardFilter = '';
            const dashboardPane = document.getElementById('pane-dashboard');
            if (dashboardPane) {
                dashboardPane.innerHTML = renderDashboard();
                setTimeout(() => {
                    renderDashboardChart();
                    bindDashboardSearchEvents();
                }, 50);
            }
        };
    }
}

export function renderCharts() {}
export function renderProjectCharts() {}