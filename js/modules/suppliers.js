import { state, saveState, addLog, formatMoney, escapeHtml, showModal, closeModal, genSid, supplierById, hasPermission } from './state.js';
import { debounce, formatMoneyVND } from './utils.js';

let supplierFilters = { keyword: '', phone: '', minPurchase: '', maxPurchase: '' };
let supplierListContainer = null;

function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return '';
    const date = new Date(dateTimeStr);
    return date.toLocaleString('vi-VN');
}

function getFilteredSuppliers() {
    let result = [...state.data.suppliers];
    const f = supplierFilters;
    
    if (f.keyword) {
        const kw = f.keyword.toLowerCase();
        result = result.filter(s => s.name.toLowerCase().includes(kw) || s.id.toLowerCase().includes(kw));
    }
    if (f.phone) {
        result = result.filter(s => s.phone && s.phone.includes(f.phone));
    }
    if (f.minPurchase !== '' && f.minPurchase !== null && f.minPurchase !== undefined) {
        const min = Number(f.minPurchase);
        if (!isNaN(min)) {
            result = result.filter(s => {
                const total = state.data.transactions.filter(t => t.type === 'purchase' && t.supplierId === s.id).reduce((sum, t) => sum + (t.totalAmount || 0), 0);
                return total >= min;
            });
        }
    }
    if (f.maxPurchase !== '' && f.maxPurchase !== null && f.maxPurchase !== undefined) {
        const max = Number(f.maxPurchase);
        if (!isNaN(max)) {
            result = result.filter(s => {
                const total = state.data.transactions.filter(t => t.type === 'purchase' && t.supplierId === s.id).reduce((sum, t) => sum + (t.totalAmount || 0), 0);
                return total <= max;
            });
        }
    }
    return result;
}

function renderSupplierHistory() {
    const transactions = state.data.transactions
        .filter(t => t.type === 'purchase' && t.supplierId)
        .sort((a, b) => new Date(b.datetime || b.date) - new Date(a.datetime || a.date))
        .slice(0, 50);
    
    if (transactions.length === 0) {
        return '<tr><td colspan="8" style="text-align: center;">📭 Chưa có dữ liệu nhập hàng nào</td></tr>';
    }
    
    return transactions.map(t => {
        const mat = state.data.materials.find(m => m.id === t.mid);
        const supplier = supplierById(t.supplierId);
        const displayDateTime = t.datetime ? formatDateTime(t.datetime) : t.date;
        const invoiceHtml = t.invoiceImage ? `<a href="${t.invoiceImage}" target="_blank" style="color: var(--accent);">📄 Xem</a>` : '—';
        // Định dạng số lượng hiển thị đẹp
        const displayQty = typeof t.qty === 'number' ? t.qty.toLocaleString('vi-VN') : parseFloat(t.qty || 0).toLocaleString('vi-VN');
        const displayUnitPrice = formatMoneyVND(t.unitPrice);
        const displayTotal = formatMoneyVND(t.totalAmount);
        
        return `<tr>
            <td style="white-space: nowrap;"><strong>${escapeHtml(supplier?.name || 'N/A')}</strong></td>
            <td style="white-space: nowrap;">${escapeHtml(mat?.name || 'N/A')}</td>
            <td style="text-align: right; white-space: nowrap;">${displayQty} ${mat?.unit || ''}</td>
            <td style="text-align: right; white-space: nowrap;">${displayUnitPrice}</td>
            <td style="text-align: center; white-space: nowrap;">${t.vatRate || 0}%</td>
            <td style="text-align: right; white-space: nowrap;" class="text-warning">${displayTotal}</td>
            <td style="white-space: nowrap;">${displayDateTime}</td>
            <td style="text-align: center; white-space: nowrap;">${invoiceHtml}</td>
        </tr>`;
    }).join('');
}

function updateSupplierList() {
    if (!supplierListContainer) return;
    const filtered = getFilteredSuppliers();
    
    if (filtered.length === 0) {
        supplierListContainer.innerHTML = '<div class="metric-sub">📭 Không tìm thấy nhà cung cấp phù hợp</div>';
        return;
    }
    
    supplierListContainer.innerHTML = `
        <div class="grid2" style="grid-template-columns:repeat(auto-fill, minmax(350px,1fr))">
            ${filtered.map(s => {
                const purchaseTxns = state.data.transactions.filter(t => t.type === 'purchase' && t.supplierId === s.id);
                const totalSpent = purchaseTxns.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
                const purchaseCount = purchaseTxns.length;
                return `<div class="supplier-card" data-supplier-id="${s.id}" style="cursor: pointer;" onclick="window.showSupplierDetail('${s.id}')">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                        <strong style="font-size: 16px;">🏭 ${escapeHtml(s.name)}</strong> 
                        <span class="tag">${s.id}</span>
                    </div>
                    <div class="metric-sub" style="margin-top: 8px;">📞 ${s.phone || 'Chưa có'}</div>
                    <div class="metric-sub">✉️ ${s.email || 'Chưa có'}</div>
                    <div class="metric-sub">📍 ${s.address || 'Chưa có'}</div>
                    <div class="metric-sub" style="margin-top:8px">📦 Số lần nhập: ${purchaseCount}</div>
                    <div class="metric-val" style="font-size: 20px; margin-top: 8px; color: var(--success-text);">💰 ${formatMoneyVND(totalSpent)}</div>
                    <div style="margin-top:12px;display:flex;gap:8px">
                        <button class="sm" onclick="event.stopPropagation(); openSupplierModal(${JSON.stringify(s).replace(/"/g, '&quot;')})">✏️ Sửa</button>
                        <button class="sm danger-btn" onclick="event.stopPropagation(); window.deleteSupplierHandler('${s.id}')">🗑️ Xóa</button>
                        <button class="sm" onclick="event.stopPropagation(); viewSupplierHistory('${s.id}')">📜 Lịch sử</button>
                    </div>
                </div>`;
            }).join('')}
        </div>
    `;
}

function updateSupplierHistoryDisplay() {
    const historyContainer = document.getElementById('supplier-history-tbody');
    if (historyContainer) {
        historyContainer.innerHTML = renderSupplierHistory();
    }
}

function renderSupplierSearchBar() {
    return `
        <div class="card" style="margin-bottom: 16px;">
            <div class="sec-title">🔍 TÌM KIẾM NÂNG CAO - NHÀ CUNG CẤP</div>
            <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center;">
                <input type="text" id="sup-search-keyword" placeholder="Tên hoặc mã..." 
                       value="${escapeHtml(supplierFilters.keyword)}" style="flex: 2; min-width: 180px;">
                <input type="text" id="sup-search-phone" placeholder="Số điện thoại..." 
                       value="${escapeHtml(supplierFilters.phone)}" style="width: 140px;">
                <input type="number" id="sup-search-min" placeholder="Tổng chi ≥" 
                       value="${supplierFilters.minPurchase || ''}" style="width: 130px;">
                <input type="number" id="sup-search-max" placeholder="Tổng chi ≤" 
                       value="${supplierFilters.maxPurchase || ''}" style="width: 130px;">
                <button id="sup-clear-filters" class="sm">🗑️ Xóa bộ lọc</button>
            </div>
        </div>
    `;
}

function bindSupplierSearchEvents() {
    const keywordInput = document.getElementById('sup-search-keyword');
    const phoneInput = document.getElementById('sup-search-phone');
    const minInput = document.getElementById('sup-search-min');
    const maxInput = document.getElementById('sup-search-max');
    const clearBtn = document.getElementById('sup-clear-filters');
    
    const debouncedUpdate = debounce(() => {
        supplierFilters.keyword = keywordInput?.value || '';
        supplierFilters.phone = phoneInput?.value || '';
        supplierFilters.minPurchase = minInput?.value || '';
        supplierFilters.maxPurchase = maxInput?.value || '';
        updateSupplierList();
        updateSupplierHistoryDisplay();
    }, 300);
    
    const updateFilters = () => { debouncedUpdate(); };
    
    if (keywordInput) keywordInput.oninput = updateFilters;
    if (phoneInput) phoneInput.oninput = updateFilters;
    if (minInput) minInput.oninput = updateFilters;
    if (maxInput) maxInput.oninput = updateFilters;
    if (clearBtn) clearBtn.onclick = () => {
        supplierFilters = { keyword: '', phone: '', minPurchase: '', maxPurchase: '' };
        if (keywordInput) keywordInput.value = '';
        if (phoneInput) phoneInput.value = '';
        if (minInput) minInput.value = '';
        if (maxInput) maxInput.value = '';
        updateSupplierList();
        updateSupplierHistoryDisplay();
    };
}

function initResizablePanels() {
    const container = document.getElementById('suppliers-resizable-container');
    if (!container) return;
    
    const handles = container.querySelectorAll('.panel-resize-handle');
    
    handles.forEach(handle => {
        const newHandle = handle.cloneNode(true);
        handle.parentNode.replaceChild(newHandle, handle);
        
        const targetId = newHandle.dataset.target;
        const panel = document.getElementById(targetId);
        if (!panel) return;
        
        const content = panel.querySelector('.panel-content');
        let startY = 0;
        let startHeight = 0;
        let isResizing = false;
        
        newHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            isResizing = true;
            startY = e.clientY;
            startHeight = content.offsetHeight;
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
        });
        
        const onMouseMove = (e) => {
            if (!isResizing) return;
            e.preventDefault();
            const diff = e.clientY - startY;
            let newHeight = startHeight + diff;
            newHeight = Math.max(150, Math.min(500, newHeight));
            content.style.height = newHeight + 'px';
            content.style.maxHeight = newHeight + 'px';
        };
        
        const onMouseUp = () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }
        };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

export function showSupplierDetail(supplierId) {
    const supplier = supplierById(supplierId);
    if (!supplier) return;
    
    const transactions = state.data.transactions
        .filter(t => t.type === 'purchase' && t.supplierId === supplierId)
        .sort((a, b) => new Date(b.datetime || b.date) - new Date(a.datetime || a.date));
    
    const totalSpent = transactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    
    const materialStats = {};
    transactions.forEach(t => {
        const mat = state.data.materials.find(m => m.id === t.mid);
        if (mat) {
            if (!materialStats[t.mid]) {
                materialStats[t.mid] = { name: mat.name, unit: mat.unit, qty: 0, totalAmount: 0, lastPrice: t.unitPrice };
            }
            materialStats[t.mid].qty += t.qty;
            materialStats[t.mid].totalAmount += t.totalAmount;
            materialStats[t.mid].lastPrice = t.unitPrice;
        }
    });
    const materialStatsArray = Object.values(materialStats).sort((a, b) => b.totalAmount - a.totalAmount);
    
    const monthlyStats = {};
    transactions.forEach(t => {
        const date = new Date(t.datetime || t.date);
        const monthKey = `${date.getMonth() + 1}/${date.getFullYear()}`;
        if (!monthlyStats[monthKey]) monthlyStats[monthKey] = { month: monthKey, total: 0, count: 0 };
        monthlyStats[monthKey].total += t.totalAmount;
        monthlyStats[monthKey].count++;
    });
    const monthlyStatsArray = Object.values(monthlyStats).sort((a, b) => {
        const [aMonth, aYear] = a.month.split('/');
        const [bMonth, bYear] = b.month.split('/');
        return new Date(bYear, bMonth - 1) - new Date(aYear, aMonth - 1);
    });
    
    const modalContent = `
        <div class="modal-hd" style="background: var(--accent-bg);">
            <span class="modal-title" style="font-size: 20px;">🏭 ${escapeHtml(supplier.name)}</span>
            <button class="xbtn" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-bd" style="max-height: 70vh; overflow-y: auto;">
            <div class="grid2" style="margin-bottom: 20px;">
                <div class="metric-card"><div class="metric-label">📋 MÃ NHÀ CUNG CẤP</div><div class="metric-val" style="font-size: 18px;">${supplier.id}</div></div>
                <div class="metric-card"><div class="metric-label">💰 TỔNG CHI</div><div class="metric-val" style="font-size: 18px; color: var(--success-text);">${formatMoneyVND(totalSpent)}</div></div>
                <div class="metric-card"><div class="metric-label">📞 SỐ ĐIỆN THOẠI</div><div class="metric-val" style="font-size: 16px;">${supplier.phone || '—'}</div></div>
                <div class="metric-card"><div class="metric-label">✉️ EMAIL</div><div class="metric-val" style="font-size: 14px;">${supplier.email || '—'}</div></div>
                <div class="metric-card" style="grid-column: span 2;"><div class="metric-label">📍 ĐỊA CHỈ</div><div class="metric-val" style="font-size: 14px;">${supplier.address || '—'}</div></div>
            </div>
            
            <div class="grid2" style="margin-bottom: 20px;">
                <div class="metric-card" style="text-align: center;"><div class="metric-label">📦 SỐ LẦN NHẬP HÀNG</div><div class="metric-val" style="font-size: 28px;">${transactions.length}</div></div>
                <div class="metric-card" style="text-align: center;"><div class="metric-label">📊 TRUNG BÌNH MỖI LẦN NHẬP</div><div class="metric-val" style="font-size: 28px;">${transactions.length > 0 ? formatMoneyVND(totalSpent / transactions.length) : '0 ₫'}</div></div>
            </div>
            
            ${monthlyStatsArray.length > 0 ? `
                <div class="sec-title">📈 THỐNG KÊ NHẬP HÀNG THEO THÁNG</div>
                <div class="chart-container" style="height: 200px; margin-bottom: 20px;">
                    <canvas id="supplier-monthly-chart-${supplier.id.replace(/[^a-zA-Z0-9]/g, '')}"></canvas>
                </div>
            ` : ''}
            
            ${materialStatsArray.length > 0 ? `
                <div class="sec-title">📦 TOP VẬT TƯ ĐÃ MUA</div>
                <div class="tbl-wrap"><table style="min-width: 500px;"><thead><tr><th>Vật tư</th><th>Số lượng</th><th>Đơn vị</th><th>Lần mua cuối</th><th>Tổng chi</th><th>Tỷ lệ</th></tr></thead>
                <tbody>${materialStatsArray.slice(0, 10).map(stat => {
                    const percentOfTotal = totalSpent > 0 ? (stat.totalAmount / totalSpent) * 100 : 0;
                    return `<tr>
                        <td><strong>${escapeHtml(stat.name)}</strong></td>
                        <td>${stat.qty.toLocaleString('vi-VN')}</td>
                        <td>${stat.unit}</td>
                        <td>${formatMoneyVND(stat.lastPrice)}/đv</td>
                        <td class="text-warning">${formatMoneyVND(stat.totalAmount)}</td>
                        <td><div class="progress-bar" style="width: 100px; display: inline-block;"><div class="progress-fill" style="width: ${percentOfTotal}%; background: var(--accent);"></div></div> ${percentOfTotal.toFixed(1)}%</td>
                    </tr>`;
                }).join('')}</tbody></table></div>
            ` : '<div class="metric-card"><div class="metric-sub">📭 Chưa có giao dịch nhập hàng nào</div></div>'}
            
            <div class="sec-title" style="margin-top: 20px;">📜 LỊCH SỬ NHẬP HÀNG CHI TIẾT</div>
            <div class="tbl-wrap">
                <table style="min-width: 900px; width: 100%;">
                    <thead>
                        <tr>
                            <th style="width: 15%;">Nhà cung cấp</th>
                            <th style="width: 15%;">Vật tư</th>
                            <th style="width: 10%;">Số lượng</th>
                            <th style="width: 12%;">Đơn giá</th>
                            <th style="width: 5%;">VAT</th>
                            <th style="width: 15%;">Thành tiền</th>
                            <th style="width: 15%;">Ngày giờ nhập</th>
                            <th style="width: 8%;">Hóa đơn</th>
                        </tr>
                    </thead>
                    <tbody id="supplier-history-modal-tbody">
                        ${transactions.map(t => {
                            const mat = state.data.materials.find(m => m.id === t.mid);
                            const displayDateTime = t.datetime ? formatDateTime(t.datetime) : t.date;
                            const invoiceHtml = t.invoiceImage ? `<a href="${t.invoiceImage}" target="_blank" style="color: var(--accent);">📄 Xem</a>` : '—';
                            const displayQty = typeof t.qty === 'number' ? t.qty.toLocaleString('vi-VN') : parseFloat(t.qty || 0).toLocaleString('vi-VN');
                            const displayUnitPrice = formatMoneyVND(t.unitPrice);
                            const displayTotal = formatMoneyVND(t.totalAmount);
                            return `<tr>
                                <td style="white-space: nowrap;"><strong>${escapeHtml(supplier.name)}</strong></td>
                                <td style="white-space: nowrap;">${escapeHtml(mat?.name || 'N/A')}</td>
                                <td style="text-align: right; white-space: nowrap;">${displayQty} ${mat?.unit || ''}</td>
                                <td style="text-align: right; white-space: nowrap;">${displayUnitPrice}</td>
                                <td style="text-align: center; white-space: nowrap;">${t.vatRate || 0}%</td>
                                <td style="text-align: right; white-space: nowrap;" class="text-warning">${displayTotal}</td>
                                <td style="white-space: nowrap;">${displayDateTime}</td>
                                <td style="text-align: center; white-space: nowrap;">${invoiceHtml}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            
            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                <button class="sm" onclick="closeModal(); window.exportSupplierDetail('${supplierId}')">📎 Xuất báo cáo Excel</button>
            </div>
        </div>
        <div class="modal-ft">
            <button onclick="closeModal()">Đóng</button>
            ${hasPermission('canManageSupplier') ? `<button class="primary" onclick="closeModal(); openSupplierModal(${JSON.stringify(supplier).replace(/"/g, '&quot;')})">✏️ Sửa thông tin</button>` : ''}
            ${hasPermission('canImport') ? `<button class="primary" onclick="closeModal(); window.openPurchaseModalWithSupplier('${supplierId}')">📥 Nhập kho từ nhà cung cấp này</button>` : ''}
        </div>
    `;
    
    showModal(modalContent, null);
    
    if (monthlyStatsArray.length > 0) {
        setTimeout(() => {
            const chartId = `supplier-monthly-chart-${supplier.id.replace(/[^a-zA-Z0-9]/g, '')}`;
            const ctx = document.getElementById(chartId);
            if (ctx && window.Chart) {
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: monthlyStatsArray.map(m => m.month),
                        datasets: [{
                            label: 'Giá trị nhập hàng (VNĐ)',
                            data: monthlyStatsArray.map(m => m.total),
                            borderColor: '#378ADD',
                            backgroundColor: 'rgba(55, 138, 221, 0.1)',
                            fill: true,
                            tension: 0.3
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: (context) => `${formatMoneyVND(context.raw)}` } } } }
                });
            }
        }, 100);
    }
}

export function exportSupplierDetail(supplierId) {
    const supplier = supplierById(supplierId);
    if (!supplier) return;
    const transactions = state.data.transactions.filter(t => t.type === 'purchase' && t.supplierId === supplierId).sort((a, b) => new Date(b.datetime || b.date) - new Date(a.datetime || a.date));
    const totalSpent = transactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    
    const summaryData = [
        { 'Thông tin': 'Tên nhà cung cấp', 'Giá trị': supplier.name },
        { 'Thông tin': 'Mã nhà cung cấp', 'Giá trị': supplier.id },
        { 'Thông tin': 'Số điện thoại', 'Giá trị': supplier.phone || '' },
        { 'Thông tin': 'Email', 'Giá trị': supplier.email || '' },
        { 'Thông tin': 'Địa chỉ', 'Giá trị': supplier.address || '' },
        { 'Thông tin': 'Tổng chi', 'Giá trị': formatMoneyVND(totalSpent) },
        { 'Thông tin': 'Số lần nhập hàng', 'Giá trị': transactions.length },
        { 'Thông tin': 'Trung bình mỗi lần nhập', 'Giá trị': transactions.length > 0 ? formatMoneyVND(totalSpent / transactions.length) : '0 ₫' }
    ];
    
    const detailData = transactions.map(t => {
        const mat = state.data.materials.find(m => m.id === t.mid);
        const displayDateTime = t.datetime ? formatDateTime(t.datetime) : t.date;
        return { 
            'Ngày giờ nhập': displayDateTime, 
            'Mã vật tư': t.mid, 
            'Tên vật tư': mat?.name || 'N/A', 
            'Số lượng': t.qty, 
            'Đơn vị': mat?.unit || '', 
            'Đơn giá (VNĐ)': t.unitPrice, 
            'VAT (%)': t.vatRate || 0, 
            'Thành tiền (VNĐ)': t.totalAmount, 
            'Ghi chú': t.note || '',
            'Có hóa đơn': t.invoiceImage ? 'Có' : 'Không'
        };
    });
    
    if (typeof XLSX !== 'undefined') {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'Tổng quan');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailData), 'Chi tiết nhập hàng');
        XLSX.writeFile(wb, `baocao_nhacungcap_${supplier.id}_${new Date().toISOString().split('T')[0]}.xlsx`);
        addLog('Xuất báo cáo', `Xuất báo cáo chi tiết nhà cung cấp: ${supplier.name}`);
        alert('✅ Đã xuất báo cáo Excel!');
    } else alert('Đang tải thư viện Excel, vui lòng thử lại sau.');
}

export function exportAllSuppliersReport() {
    const suppliers = state.data.suppliers.map(s => {
        const transactions = state.data.transactions.filter(t => t.type === 'purchase' && t.supplierId === s.id);
        const totalSpent = transactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
        return { 'Mã nhà cung cấp': s.id, 'Tên nhà cung cấp': s.name, 'Số điện thoại': s.phone || '', 'Email': s.email || '', 'Địa chỉ': s.address || '', 'Tổng chi (VNĐ)': totalSpent, 'Số lần nhập': transactions.length };
    });
    if (typeof XLSX !== 'undefined') {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(suppliers), 'Danh sách nhà cung cấp');
        XLSX.writeFile(wb, `danh_sach_nha_cung_cap_${new Date().toISOString().split('T')[0]}.xlsx`);
        addLog('Xuất báo cáo', 'Xuất danh sách tất cả nhà cung cấp');
        alert('✅ Đã xuất báo cáo!');
    } else alert('Đang tải thư viện Excel, vui lòng thử lại sau.');
}

export function renderSuppliers() {
    const result = `
    <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div class="sec-title" style="margin-bottom: 0;">🏭 DANH SÁCH NHÀ CUNG CẤP</div>
            <button class="sm" onclick="exportAllSuppliersReport()" style="font-size: 11px;">📎 Xuất tất cả báo cáo</button>
        </div>
        <div class="resizable-container" id="suppliers-resizable-container">
            <div class="resizable-panel" id="suppliers-list-panel">
                <div class="panel-header">
                    <div class="sec-title">📋 DANH SÁCH NHÀ CUNG CẤP</div>
                    <span class="resize-icon">⤥ Kéo để điều chỉnh</span>
                </div>
                <div class="panel-content" id="supplier-list-container" style="max-height: 400px; overflow-y: auto;"></div>
                <div class="panel-resize-handle" data-target="suppliers-list-panel"></div>
            </div>
            <div class="resizable-panel" id="suppliers-history-panel">
                <div class="panel-header">
                    <div class="sec-title">📜 LỊCH SỬ NHẬP HÀNG CHI TIẾT</div>
                    <span class="resize-icon">⤥ Kéo để điều chỉnh</span>
                </div>
                <div class="panel-content" style="max-height: 300px; overflow-y: auto;">
                    ${renderSupplierSearchBar()}
                    <div class="tbl-wrap">
                        <table style="min-width: 1000px; width: 100%;">
                            <thead>
                                <tr>
                                    <th style="width: 15%;">Nhà cung cấp</th>
                                    <th style="width: 15%;">Vật tư</th>
                                    <th style="width: 10%;">Số lượng</th>
                                    <th style="width: 12%;">Đơn giá</th>
                                    <th style="width: 5%;">VAT</th>
                                    <th style="width: 15%;">Thành tiền</th>
                                    <th style="width: 15%;">Ngày giờ nhập</th>
                                    <th style="width: 8%;">Hóa đơn</th>
                                </tr>
                            </thead>
                            <tbody id="supplier-history-tbody">
                                ${renderSupplierHistory()}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="panel-resize-handle" data-target="suppliers-history-panel"></div>
            </div>
        </div>
        <div id="supplier-history-modal" style="display:none"></div>
    </div>`;
    
    setTimeout(() => {
        bindSupplierSearchEvents();
        supplierListContainer = document.getElementById('supplier-list-container');
        updateSupplierList();
        initResizablePanels();
    }, 50);
    return result;
}

export function openSupplierModal(supplier = null) {
  if (!hasPermission('canManageSupplier')) { alert('Bạn không có quyền quản lý nhà cung cấp'); return; }
  const isEdit = !!supplier;
  showModal(`<div class="modal-hd"><span class="modal-title">${isEdit ? '✏️ Sửa nhà cung cấp' : '➕ Thêm nhà cung cấp mới'}</span><button class="xbtn" onclick="closeModal()">✕</button></div>
    <div class="modal-bd">
      <div class="form-group"><label class="form-label">Tên nhà cung cấp *</label><input id="sup-name" value="${supplier ? escapeHtml(supplier.name) : ''}" placeholder="VD: Công ty Thép ABC"></div>
      <div class="form-group"><label class="form-label">Số điện thoại</label><input id="sup-phone" value="${supplier ? escapeHtml(supplier.phone || '') : ''}" placeholder="VD: 0912 345 678"></div>
      <div class="form-group"><label class="form-label">Email</label><input id="sup-email" value="${supplier ? escapeHtml(supplier.email || '') : ''}" placeholder="VD: contact@thepabc.com"></div>
      <div class="form-group"><label class="form-label">Địa chỉ</label><input id="sup-address" value="${supplier ? escapeHtml(supplier.address || '') : ''}" placeholder="VD: Hà Nội"></div>
    </div>
    <div class="modal-ft"><button onclick="closeModal()">Hủy</button><button class="primary" onclick="${isEdit ? `updateSupplier('${supplier.id}')` : 'saveSupplier()'}">${isEdit ? 'Cập nhật' : 'Lưu'}</button></div>`);
}

export function saveSupplier() {
  const name = document.getElementById('sup-name')?.value.trim();
  if (!name) return alert('Vui lòng nhập tên nhà cung cấp');
  const newSupplier = { id: genSid(), name: name, phone: document.getElementById('sup-phone')?.value || '', email: document.getElementById('sup-email')?.value || '', address: document.getElementById('sup-address')?.value || '' };
  state.data.suppliers.push(newSupplier);
  addLog('Thêm nhà cung cấp', `Đã thêm nhà cung cấp: ${name} (${newSupplier.id})`);
  saveState(); closeModal(); if(window.render) window.render();
}

export function updateSupplier(sid) {
  const supplier = supplierById(sid);
  if (!supplier) return;
  const name = document.getElementById('sup-name')?.value.trim();
  if (!name) return alert('Vui lòng nhập tên nhà cung cấp');
  supplier.name = name;
  supplier.phone = document.getElementById('sup-phone')?.value || '';
  supplier.email = document.getElementById('sup-email')?.value || '';
  supplier.address = document.getElementById('sup-address')?.value || '';
  addLog('Cập nhật nhà cung cấp', `Đã cập nhật thông tin nhà cung cấp: ${name} (${sid})`);
  saveState(); closeModal(); if(window.render) window.render();
}

export function deleteSupplier(sid) {
  if (!hasPermission('canManageSupplier')) { alert('Bạn không có quyền xóa nhà cung cấp'); return; }
  const supplier = supplierById(sid);
  if (!supplier) return;
  const relatedTxns = state.data.transactions.filter(t => t.supplierId === sid);
  if (!confirm(relatedTxns.length > 0 ? `⚠️ Nhà cung cấp "${supplier.name}" đã có ${relatedTxns.length} giao dịch nhập hàng.\nXóa sẽ XÓA LUÔN các giao dịch này.\nTiếp tục?` : `Xóa nhà cung cấp "${supplier.name}"?`)) return;
  state.data.suppliers = state.data.suppliers.filter(s => s.id !== sid);
  state.data.transactions = state.data.transactions.filter(t => t.supplierId !== sid);
  addLog('Xóa nhà cung cấp', `Đã xóa nhà cung cấp: ${supplier.name} (${sid})`);
  saveState(); if(window.render) window.render();
}

window.deleteSupplierHandler = (sid) => { deleteSupplier(sid); };
export function filterSuppliers() {}
export function clearSupplierSearch() {}

export function viewSupplierHistory(sid) {
  const supplier = supplierById(sid);
  const purchaseTxns = state.data.transactions.filter(t => t.type === 'purchase' && t.supplierId === sid).sort((a,b) => new Date(b.datetime || b.date) - new Date(a.datetime || a.date));
  const totalSpent = purchaseTxns.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
  
  showModal(`<div class="modal-hd"><span class="modal-title">📜 Lịch sử nhập hàng - ${escapeHtml(supplier?.name)}</span><button class="xbtn" onclick="closeModal()">✕</button></div>
    <div class="modal-bd"><div class="metric-card" style="margin-bottom:16px"><div class="metric-label">Tổng chi</div><div class="metric-val" style="font-size:20px">${formatMoneyVND(totalSpent)}</div></div>
    <div class="tbl-wrap"><table style="min-width:900px"><thead><tr><th>Ngày giờ</th><th>Vật tư</th><th>SL</th><th>Đơn giá</th><th>VAT</th><th>Thành tiền</th><th>Ghi chú</th><th>Hóa đơn</th></tr></thead>
    <tbody>${purchaseTxns.map(t => {
        const mat = state.data.materials.find(m => m.id === t.mid);
        const displayDateTime = t.datetime ? formatDateTime(t.datetime) : t.date;
        const invoiceHtml = t.invoiceImage ? `<a href="${t.invoiceImage}" target="_blank">📄 Xem</a>` : '—';
        return `<tr>
          <td>${displayDateTime}</td>
          <td>${mat?.name || 'N/A'}</td>
          <td>${t.qty} ${mat?.unit || ''}</td>
          <td>${formatMoneyVND(t.unitPrice)}</td>
          <td>${t.vatRate || 0}%</td>
          <td class="text-warning">${formatMoneyVND(t.totalAmount)}</td>
          <td>${escapeHtml(t.note || '—')}</td>
          <td>${invoiceHtml}</td>
        </tr>`;
    }).join('') || '<tr><td colspan="8">Chưa có giao dịch nào</td></tr>'}</tbody>;</table></div>
    </div><div class="modal-ft"><button onclick="closeModal()">Đóng</button></div>`);
}

export const addSupplier = (data) => { const newId = genSid(); const newSupplier = { id: newId, name: data.name, phone: data.phone || '', email: data.email || '', address: data.address || '' }; state.data.suppliers.push(newSupplier); addLog('Thêm nhà cung cấp', `Đã thêm nhà cung cấp: ${newSupplier.name} (${newSupplier.id})`); saveState(); if(window.render) window.render(); return newSupplier; };
export const getSuppliers = () => state.data.suppliers;