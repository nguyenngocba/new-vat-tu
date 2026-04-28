import { state, saveState, addLog, formatMoney, escapeHtml, showModal, closeModal, genSid, supplierById, hasPermission } from './state.js';
import { debounce, formatMoneyVND } from './utils.js';

let supplierFilters = { keyword: '', phone: '', minPurchase: '', maxPurchase: '' };
let supplierListContainer = null;

const resizableStyle = `
<style>
.resizable-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
}
.resizable-panel {
    border: 0.5px solid var(--border);
    border-radius: var(--rl);
    overflow: hidden;
    background: var(--surface);
}
.panel-header {
    background: var(--surface2);
    padding: 12px 16px;
    cursor: ns-resize;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 0.5px solid var(--border);
}
.panel-header .sec-title {
    margin-bottom: 0;
}
.panel-content {
    overflow: auto;
    transition: height 0.1s ease;
    padding: 16px;
}
.panel-resize-handle {
    height: 6px;
    background: var(--border2);
    cursor: ns-resize;
    transition: background 0.2s;
}
.panel-resize-handle:hover {
    background: var(--accent);
}
.resize-icon {
    font-size: 11px;
    color: var(--muted);
}
</style>
`;

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
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 50);
    
    if (transactions.length === 0) {
        return '<tr><td colspan="7" style="text-align: center;">📭 Chưa có dữ liệu nhập hàng nào</td></tr>';
    }
    
    return transactions.map(t => {
        const mat = state.data.materials.find(m => m.id === t.mid);
        const supplier = supplierById(t.supplierId);
        return `<tr>
            <td><strong>${supplier?.name || 'N/A'}</strong></td>
            <td>${mat?.name || 'N/A'}</td>
            <td>${t.qty.toLocaleString('vi-VN')} ${mat?.unit || ''}</td>
            <td>${formatMoneyVND(t.unitPrice)}</td>
            <td>${t.vatRate || 0}%</td>
            <td class="text-warning">${formatMoneyVND(t.totalAmount)}</td>
            <td>${t.date}</td>
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
                return `<div class="supplier-card project-card" data-supplier-id="${s.id}" style="cursor: pointer;" onclick="window.showSupplierDetail('${s.id}')">
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
    const handles = document.querySelectorAll('.panel-resize-handle');
    
    handles.forEach(handle => {
        const targetId = handle.dataset.target;
        const panel = document.getElementById(targetId);
        if (!panel) return;
        
        const content = panel.querySelector('.panel-content');
        let startY = 0;
        let startHeight = 0;
        let isResizing = false;
        
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isResizing = true;
            startY = e.clientY;
            startHeight = content.offsetHeight;
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const diff = e.clientY - startY;
            let newHeight = startHeight + diff;
            newHeight = Math.max(150, Math.min(600, newHeight));
            content.style.height = newHeight + 'px';
            content.style.maxHeight = newHeight + 'px';
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    });
}

// ... (các hàm showSupplierDetail, exportSupplierDetail, exportAllSuppliersReport, openSupplierModal, saveSupplier, updateSupplier, deleteSupplier, viewSupplierHistory giữ nguyên như cũ)

export function renderSuppliers() {
    const result = resizableStyle + renderSupplierSearchBar() + `<div class="card">
        <div class="sec-title" style="display: flex; justify-content: space-between; align-items: center;">
            <span>🏭 DANH SÁCH NHÀ CUNG CẤP</span>
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
                    <div class="tbl-wrap">
                        <table style="min-width: 700px">
                            <thead><tr><th>Nhà cung cấp</th><th>Vật tư</th><th>Số lượng</th><th>Đơn giá</th><th>VAT</th><th>Thành tiền</th><th>Ngày nhập</th></tr></thead>
                            <tbody id="supplier-history-tbody">
                                ${renderSupplierHistory()}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="panel-resize-handle" data-target="suppliers-history-panel"></div>
            </div>
        </div>
    </div>`;
    
    setTimeout(() => {
        bindSupplierSearchEvents();
        supplierListContainer = document.getElementById('supplier-list-container');
        updateSupplierList();
        initResizablePanels();
    }, 50);
    return result;
}

// ... (các hàm còn lại giữ nguyên)