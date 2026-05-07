import { state, saveState, addLog, formatMoney, escapeHtml, showModal, closeModal } from './state.js';
import { formatMoneyVND } from './utils.js';

let structureChart = null;
let productionChart = null;

// ========== LẤY DỮ LIỆU THỐNG KÊ ==========
export function getStructureStats() {
    const structures = state.data.structures || [];
    const transactions = state.data.transactions || [];
    
    // Thống kê tồn kho cấu kiện
    const stockStats = structures.map(s => ({
        id: s.id,
        name: s.name,
        unit: s.unit,
        qty: s.qty || 0,
        cost: s.cost || 0,
        totalValue: (s.qty || 0) * (s.cost || 0)
    })).sort((a, b) => b.totalValue - a.totalValue);
    
    // Thống kê sản xuất
    const produceTxns = transactions.filter(t => t.type === 'produce');
    const totalProduced = produceTxns.reduce((sum, t) => sum + (t.qty || 0), 0);
    const totalProductionRuns = produceTxns.length;
    
    // Thống kê xuất cấu kiện ra công trình
    const exportTxns = transactions.filter(t => t.type === 'structure_export');
    const totalExported = exportTxns.reduce((sum, t) => sum + (t.qty || 0), 0);
    const totalExportValue = exportTxns.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    
    // Top cấu kiện sản xuất nhiều nhất
    const productionStats = {};
    produceTxns.forEach(t => {
        const structure = structures.find(s => s.id === t.mid);
        if (structure) {
            if (!productionStats[structure.id]) {
                productionStats[structure.id] = { name: structure.name, unit: structure.unit, qty: 0 };
            }
            productionStats[structure.id].qty += t.qty || 0;
        }
    });
    const topProduced = Object.values(productionStats).sort((a, b) => b.qty - a.qty).slice(0, 5);
    
    // Sản xuất theo tháng (6 tháng gần nhất)
    const monthlyProduction = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlyProduction[key] = { month: key, label: `T${d.getMonth()+1}/${d.getFullYear()}`, produce: 0, export: 0 };
    }
    
    produceTxns.forEach(t => {
        const d = new Date(t.datetime || t.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyProduction[key]) {
            monthlyProduction[key].produce += t.qty || 0;
        }
    });
    
    exportTxns.forEach(t => {
        const d = new Date(t.datetime || t.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyProduction[key]) {
            monthlyProduction[key].export += t.qty || 0;
        }
    });
    return {
        stockStats,
        totalProduced: Number(totalProduced) || 0,
        totalProductionRuns: Number(totalProductionRuns) || 0,
        totalExported: Number(totalExported) || 0,
        totalExportValue: Number(totalExportValue) || 0,
        topProduced,
        monthlyProduction: Object.values(monthlyProduction)
    };    
}

// ========== RENDER KPI CARDS ==========
export function renderStructureKPIs(stats) {
    const stockValue = stats.stockStats.reduce((sum, s) => sum + s.totalValue, 0);
    const lowStockCount = stats.stockStats.filter(s => s.qty < 10).length;
    
    return `
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-icon">🏗️</div>
                <div class="kpi-info">
                    <div class="kpi-label">TỔNG CẤU KIỆN</div>
                    <div class="kpi-value">${stats.stockStats.length}</div>
                    <div class="kpi-sub">Loại cấu kiện</div>
                </div>
            </div>
            <div class="kpi-card">
                <div class="kpi-icon">🏭</div>
                <div class="kpi-info">
                    <div class="kpi-label">ĐÃ SẢN XUẤT</div>
                    <div class="kpi-value"> ${Number(stats.totalProduced || 0).toLocaleString('vi-VN')}</div>
                    <div class="kpi-sub">${Number(stats.totalProductionRuns || 0)} đợt sản xuất</div>
                </div>
            </div>
            <div class="kpi-card">
                <div class="kpi-icon">📤</div>
                <div class="kpi-info">
                    <div class="kpi-label">ĐÃ XUẤT CT</div>
                    <div class="kpi-value"> ${Number(stats.totalExported || 0).toLocaleString('vi-VN')}</div>
                    <div class="kpi-sub">${formatMoneyVND(stats.totalExportValue)}</div>
                </div>
            </div>
            <div class="kpi-card">
                <div class="kpi-icon">💰</div>
                <div class="kpi-info">
                    <div class="kpi-label">GIÁ TRỊ TỒN</div>
                    <div class="kpi-value">${formatMoneyVND(stockValue)}</div>
                    <div class="kpi-sub">${lowStockCount} cấu kiện tồn thấp</div>
                </div>
            </div>
        </div>
    `;
}

// ========== RENDER BIỂU ĐỒ ==========
function renderStructureCharts(stats) {
    setTimeout(() => {
        // Biểu đồ xu hướng sản xuất
        const ctx1 = document.getElementById('structure-trend-chart');
        if (ctx1 && window.Chart) {
            if (productionChart) productionChart.destroy();
            productionChart = new Chart(ctx1, {
                type: 'bar',
                data: {
                    labels: stats.monthlyProduction.map(m => m.label),
                    datasets: [
                        { label: 'Sản xuất', data: stats.monthlyProduction.map(m => m.produce), backgroundColor: '#378ADD', borderRadius: 6 },
                        { label: 'Xuất CT', data: stats.monthlyProduction.map(m => m.export), backgroundColor: '#F09595', borderRadius: 6 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'top' } },
                    scales: { y: { ticks: { callback: v => v.toLocaleString('vi-VN') } } }
                }
            });
        }
        
        // Biểu đồ tròn top cấu kiện sản xuất
        const ctx2 = document.getElementById('top-produced-chart');
        if (ctx2 && window.Chart && stats.topProduced.length > 0) {
            if (structureChart) structureChart.destroy();
            structureChart = new Chart(ctx2, {
                type: 'doughnut',
                data: {
                    labels: stats.topProduced.map(s => s.name),
                    datasets: [{ data: stats.topProduced.map(s => s.qty), backgroundColor: ['#378ADD', '#97C459', '#FAC775', '#F09595', '#85B7EB'], borderWidth: 0 }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
            });
        }
    }, 100);
}

// ========== RENDER BẢNG TỒN KHO ==========
export function renderStructureInventory(stats) {
    if (!stats || !stats.stockStats || stats.stockStats.length === 0) {
        return '<div class="metric-sub" style="text-align:center;padding:20px;">📭 Chưa có cấu kiện nào</div>';
    }
    
    console.log('Stock stats:', stats.stockStats); // Debug
    
    return `
        <div class="tbl-wrap">
            <table style="min-width: 600px;">
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
                    ${stats.stockStats.map(s => {
                        const statusClass = s.qty < 10 ? 'b-low' : s.qty < 30 ? 'b-warning' : 'b-ok';
                        const statusText = s.qty < 10 ? '⚠️ Sắp hết' : s.qty < 30 ? '📦 Trung bình' : '✅ Tốt';
                        return `<tr>
                            <td style="cursor:pointer;color:var(--accent);" onclick="window.showStructureDetail('${s.id}')"><strong>${escapeHtml(s.name)}</strong></td>
                            <td style="text-align:right; ${s.qty < 10 ? 'color:var(--danger-text);font-weight:bold;' : ''}">${(s.qty || 0).toLocaleString('vi-VN')} ${s.unit}</td>
                            <td>${s.unit}</td>
                            <td style="text-align:right;">${formatMoneyVND(s.cost || 0)}</span></td>
                            <td style="text-align:right;">${formatMoneyVND(s.totalValue || 0)}</span></td>
                            <td><span class="badge ${statusClass}">${statusText}</span></span></td>
                        </td>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}
// ========== RENDER DASHBOARD CHÍNH ==========
export function renderStructureDashboard() {
    const stats = getStructureStats();
    
    return `
        <div class="structure-dashboard">
            ${renderStructureKPIs(stats)}
            
            <div class="grid2" style="margin-bottom: 18px;">
                <div class="card">
                    <div class="sec-title">📈 XU HƯỚNG SẢN XUẤT 6 THÁNG</div>
                    <div class="chart-container" style="height: 280px;">
                        <canvas id="structure-trend-chart"></canvas>
                    </div>
                </div>
                <div class="card">
                    <div class="sec-title">🥧 TOP CẤU KIỆN SẢN XUẤT NHIỀU NHẤT</div>
                    <div class="chart-container" style="height: 280px;">
                        <canvas id="top-produced-chart"></canvas>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="sec-title">📦 TỒN KHO CẤU KIỆN CHI TIẾT</div>
                ${renderStructureInventory(stats)}
            </div>
        </div>
    `;
}

// ========== HÀM TẢI DASHBOARD ==========
export function loadStructureDashboard() {
    const stats = getStructureStats();
    renderStructureCharts(stats);
}

window.renderStructureDashboard = renderStructureDashboard;
window.loadStructureDashboard = loadStructureDashboard;


// ========== RENDER BIỂU ĐỒ CHO DASHBOARD ==========
export function renderStructureDashboardCharts() {
    const stats = getStructureStats();
    renderStructureCharts(stats);
}
