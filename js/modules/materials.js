import { state, saveState, addLog, formatMoney, escapeHtml, showModal, closeModal, genMid, matById, hasPermission } from './state.js';
import { 
    handleIntegerInput, getNumberFromInput, formatMoneyVND, setupNumberInput,
    getColumnConfig, saveColumnConfig, updateColumnWidth, toggleColumnVisibility, setSortConfig,
    getSortedData, DEFAULT_COLUMNS, getFavorites, toggleFavorite, isFavorite
} from './utils.js';

let materialFilters = { keyword: '', category: '', minStock: '', maxStock: '', showFavoritesOnly: false };
let materialListContainer = null;

function getFilteredMaterials() {
    let result = [...state.data.materials];
    const f = materialFilters;
    
    if (f.showFavoritesOnly) {
        const favorites = getFavorites();
        result = result.filter(m => favorites.includes(m.id));
    }
    
    if (f.keyword) {
        const kw = f.keyword.toLowerCase();
        result = result.filter(m => m.name.toLowerCase().includes(kw) || m.id.toLowerCase().includes(kw));
    }
    if (f.category && f.category !== 'all') {
        result = result.filter(m => m.cat === f.category);
    }
    if (f.minStock !== '' && f.minStock !== null && f.minStock !== undefined) {
        const min = Number(f.minStock);
        if (!isNaN(min)) result = result.filter(m => m.qty >= min);
    }
    if (f.maxStock !== '' && f.maxStock !== null && f.maxStock !== undefined) {
        const max = Number(f.maxStock);
        if (!isNaN(max)) result = result.filter(m => m.qty <= max);
    }
    return result;
}

function updateMaterialList() {
    if (!materialListContainer) return;
    const filtered = getFilteredMaterials();
    const config = getColumnConfig();
    const sorted = getSortedData(filtered, config.sortColumn, config.sortDirection);
    const favorites = getFavorites();
    
    if (sorted.length === 0) {
        materialListContainer.innerHTML = '<div class="metric-sub">📭 Không tìm thấy vật tư phù hợp</div>';
        return;
    }
    
    const visibleColumns = config.columns.filter(col => col.visible);
    
    materialListContainer.innerHTML = `
        <div class="tbl-wrap resizable-table">
            <table style="min-width: 600px; width: 100%; table-layout: fixed;">
                <thead>
                    <tr>
                        ${visibleColumns.map(col => `
                            <th style="width: ${col.width}px; position: relative;">
                                ${col.sortable ? `
                                    <div class="sortable-header" data-sort="${col.key}">
                                        ${col.label}
                                        <span class="sort-icon ${config.sortColumn === col.key ? config.sortDirection : ''}">▼</span>
                                    </div>
                                ` : col.label}
                                <div class="resize-handle" data-col="${col.key}"></div>
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${sorted.map(m => {
                        const displayQty = typeof m.qty === 'number' ? m.qty.toLocaleString('vi-VN') : parseFloat(m.qty || 0).toLocaleString('vi-VN');
                        const displayCost = formatMoneyVND(m.cost);
                        const totalValue = (typeof m.qty === 'number' ? m.qty : parseFloat(m.qty || 0)) * (typeof m.cost === 'number' ? m.cost : parseFloat(m.cost || 0));
                        const displayTotal = formatMoneyVND(totalValue);
                        
                        return `
                        <tr data-id="${m.id}">
                            ${visibleColumns.map(col => {
                                if (col.key === 'actions') {
                                    return `<td style="width: ${col.width}px; white-space: nowrap;">
                                        ${hasPermission('canEditMaterial') ? `<button class="sm" onclick="editMaterial('${m.id}')">✏️ Sửa</button>` : ''}
                                        ${hasPermission('canDeleteMaterial') ? `<button class="sm danger-btn" onclick="deleteMaterial('${m.id}')">🗑️ Xóa</button>` : ''}
                                       </td>`;
                                }
                                if (col.key === 'id') {
                                    return `<td style="width: ${col.width}px; font-family:mono">
                                        <button class="favorite-btn ${favorites.includes(m.id) ? 'active' : ''}" onclick="toggleFavoriteItem('${m.id}')">★</button>
                                        ${m.id}
                                       </td>`;
                                }
                                if (col.key === 'name') {
									return `<td style="width: ${col.width}px;"><strong style="cursor:pointer;color:var(--accent);text-decoration:underline;" onclick="window.showMaterialDetail('${m.id}')">${escapeHtml(m.name)}</strong></td>`;
								}
                                if (col.key === 'qty') {
                                    return `<td style="width: ${col.width}px;">${displayQty} ${m.unit}</td>`;
                                }
                                if (col.key === 'cost') {
                                    return `<td style="width: ${col.width}px;">${displayCost}</td>`;
                                }
                                if (col.key === 'totalValue') {
                                    return `<td style="width: ${col.width}px; color: var(--accent); font-weight: 500;">${displayTotal}</td>`;
                                }
                                if (col.key === 'status') {
                                    const statusClass = m.qty <= m.low ? 'b-low' : 'b-ok';
                                    const statusText = m.qty <= m.low ? '⚠️ Sắp hết' : '✅ OK';
                                    return `<td style="width: ${col.width}px;"><span class="badge ${statusClass}">${statusText}</span></td>`;
                                }
                                if (col.key === 'note') {
                                    return `<td style="width: ${col.width}px; word-break: break-word;">${escapeHtml(m.note || '—')}</td>`;
                                }
                                return `<td style="width: ${col.width}px;">${m[col.key] !== undefined ? m[col.key] : '—'}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    attachResizeEvents();
    attachSortEvents();
}

function attachResizeEvents() {
    const handles = document.querySelectorAll('.resize-handle');
    let currentHandle = null, startX = 0, startWidth = 0, currentTh = null;
    
    const onMouseMove = (e) => {
        if (!currentHandle) return;
        const diff = e.clientX - startX;
        const newWidth = Math.max(50, Math.min(400, startWidth + diff));
        if (currentTh) {
            currentTh.style.width = newWidth + 'px';
            updateColumnWidth(currentHandle.dataset.col, newWidth);
        }
    };
    
    const onMouseUp = () => {
        if (currentHandle) currentHandle.classList.remove('active');
        currentHandle = null; currentTh = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
    
    handles.forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault(); e.stopPropagation();
            currentHandle = handle;
            currentTh = handle.closest('th');
            if (currentTh) {
                startWidth = currentTh.offsetWidth;
                startX = e.clientX;
                handle.classList.add('active');
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            }
        });
    });
}

function attachSortEvents() {
    document.querySelectorAll('.sortable-header').forEach(header => {
        header.removeEventListener('click', handleSortClick);
        header.addEventListener('click', handleSortClick);
    });
}

function handleSortClick(e) {
    const colKey = e.currentTarget.dataset.sort;
    if (colKey) { setSortConfig(colKey); updateMaterialList(); }
}

function renderMaterialSearchBar() {
    const categories = ['all', ...state.data.categories];
    const favorites = getFavorites();
    const favoritesCount = favorites.filter(id => state.data.materials.some(m => m.id === id)).length;
    
    return `
        <div class="card" style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <div class="sec-title">🔍 TÌM KIẾM NÂNG CAO</div>
                <div style="display: flex; gap: 10px;">
                    <div class="favorite-filter">
                        <span class="star-icon ${materialFilters.showFavoritesOnly ? 'active' : ''}" onclick="toggleFavoriteFilter()">★</span>
                        <span style="font-size: 12px;">Yêu thích (${favoritesCount})</span>
                    </div>
                    <div class="column-toggle-panel">
                        <button class="column-toggle-btn" onclick="toggleColumnPanel()">📋 Ẩn/hiện cột</button>
                        <div id="column-toggle-dropdown" class="column-toggle-dropdown">
                            <div class="dropdown-header">Chọn cột hiển thị</div>
                            ${DEFAULT_COLUMNS.map(col => `
                                <div class="dropdown-item" onclick="toggleColumn('${col.key}')">
                                    <input type="checkbox" ${getColumnConfig().columns.find(c => c.key === col.key)?.visible !== false ? 'checked' : ''}>
                                    <label>${col.label}</label>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center;">
                <input type="text" id="mat-search-keyword" placeholder="Tên hoặc mã..." value="${escapeHtml(materialFilters.keyword)}" style="flex: 2; min-width: 150px;">
                <select id="mat-search-category" style="flex: 1; min-width: 120px;">
                    ${categories.map(c => `<option value="${c}" ${materialFilters.category === c ? 'selected' : ''}>${c === 'all' ? '📂 Tất cả' : c}</option>`).join('')}
                </select>
                <input type="text" id="mat-search-min" placeholder="Tồn ≥" value="${materialFilters.minStock || ''}" style="width: 100px;" dir="ltr">
                <input type="text" id="mat-search-max" placeholder="Tồn ≤" value="${materialFilters.maxStock || ''}" style="width: 100px;" dir="ltr">
                <button id="mat-clear-filters" class="sm">🗑️ Xóa bộ lọc</button>
            </div>
        </div>
    `;
}

function bindMaterialSearchEvents() {
    const keywordInput = document.getElementById('mat-search-keyword');
    const categorySelect = document.getElementById('mat-search-category');
    const minInput = document.getElementById('mat-search-min');
    const maxInput = document.getElementById('mat-search-max');
    const clearBtn = document.getElementById('mat-clear-filters');
    
    const updateFilters = () => {
        materialFilters.keyword = keywordInput?.value || '';
        materialFilters.category = categorySelect?.value || '';
        materialFilters.minStock = minInput?.value.replace(/[^0-9]/g, '') || '';
        materialFilters.maxStock = maxInput?.value.replace(/[^0-9]/g, '') || '';
        updateMaterialList();
    };
    
    if (keywordInput) keywordInput.oninput = updateFilters;
    if (categorySelect) categorySelect.onchange = updateFilters;
    if (minInput) { minInput.addEventListener('input', updateFilters); }
    if (maxInput) { maxInput.addEventListener('input', updateFilters); }
    if (clearBtn) clearBtn.onclick = () => {
        materialFilters = { keyword: '', category: '', minStock: '', maxStock: '', showFavoritesOnly: false };
        if (keywordInput) keywordInput.value = '';
        if (categorySelect) categorySelect.value = 'all';
        if (minInput) minInput.value = '';
        if (maxInput) maxInput.value = '';
        updateMaterialList();
        const starIcon = document.querySelector('.favorite-filter .star-icon');
        if (starIcon) starIcon.classList.remove('active');
    };
}

window.toggleColumnPanel = function() {
    const dropdown = document.getElementById('column-toggle-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
        setTimeout(() => {
            document.addEventListener('click', function closeDropdown(e) {
                if (!dropdown.contains(e.target) && !e.target.closest('.column-toggle-btn')) {
                    dropdown.classList.remove('show');
                    document.removeEventListener('click', closeDropdown);
                }
            });
        }, 0);
    }
};

window.toggleColumn = function(colKey) { toggleColumnVisibility(colKey); updateMaterialList(); };
window.toggleFavoriteItem = function(itemId) { toggleFavorite(itemId); updateMaterialList(); };
window.toggleFavoriteFilter = function() {
    materialFilters.showFavoritesOnly = !materialFilters.showFavoritesOnly;
    const starIcon = document.querySelector('.favorite-filter .star-icon');
    if (starIcon) starIcon.classList.toggle('active', materialFilters.showFavoritesOnly);
    updateMaterialList();
};

// ========== RENDER ==========
export function renderMaterials() {
    const result = renderMaterialSearchBar() + `<div class="card">
    <div class="sec-title" style="display: flex; justify-content: space-between; align-items: center;">
        <span>📋 DANH SÁCH VẬT TƯ TỒN KHO</span>
        <button class="sm" onclick="resetColumnConfig()" style="font-size: 11px;">🔄 Đặt lại cột</button>
    </div>
    <div id="material-list-container"></div>
  </div>`;
  
    setTimeout(() => {
        bindMaterialSearchEvents();
        materialListContainer = document.getElementById('material-list-container');
        updateMaterialList();
    }, 50);
    return result;
}

window.resetColumnConfig = function() {
    const config = getColumnConfig();
    config.columns = JSON.parse(JSON.stringify(DEFAULT_COLUMNS));
    config.sortColumn = 'name'; config.sortDirection = 'asc';
    saveColumnConfig(config); updateMaterialList();
};

// ========== CRUD ==========
export function openMatModal() {
    if (!hasPermission('canCreateMaterial')) { alert('Bạn không có quyền thêm vật tư'); return; }
    showModal(`<div class="modal-hd"><span class="modal-title">➕ Thêm vật tư mới</span><button class="xbtn" onclick="closeModal()">✕</button></div>
    <div class="modal-bd"><div class="form-grid2">
      <div class="form-group form-full"><label class="form-label">Tên vật tư *</label><input id="mn-name" placeholder="VD: Thép tấm 12mm"></div>
      <div class="form-group"><label class="form-label">Danh mục</label><select id="mn-cat">${state.data.categories.map(c => `<option>${c}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Đơn vị tính</label><select id="mn-unit">${state.data.units.map(u => `<option>${u}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Số lượng nhập đầu</label><input type="text" id="mn-qty" value="0" dir="ltr"></div>
      <div class="form-group"><label class="form-label">Đơn giá (VNĐ)</label><input type="text" id="mn-cost" value="0" dir="ltr"></div>
      <div class="form-group"><label class="form-label">Ngưỡng cảnh báo tồn</label><input type="text" id="mn-low" value="5" dir="ltr"></div>
      <div class="form-group form-full"><label class="form-label">Ghi chú</label><textarea id="mn-note" rows="2" placeholder="Ghi chú thêm về vật tư..."></textarea></div>
    </div></div>
    <div class="modal-ft"><button onclick="closeModal()">Hủy</button><button class="primary" onclick="saveMat()">Lưu vật tư</button></div>`);
  
    setTimeout(() => {
        const qtyInput = document.getElementById('mn-qty');
        const costInput = document.getElementById('mn-cost');
        const lowInput = document.getElementById('mn-low');
        if (qtyInput) setupNumberInput(qtyInput, { isInteger: false, decimals: 3 });
        if (costInput) setupNumberInput(costInput, { isInteger: false, decimals: 2 });
        if (lowInput) setupNumberInput(lowInput, { isInteger: true, decimals: 0 });
    }, 100);
}

export function saveMat() {
    const name = document.getElementById('mn-name')?.value.trim();
    if(!name) return alert('Vui lòng nhập tên vật tư');
  
    const qty = getNumberFromInput(document.getElementById('mn-qty'));
    const cost = getNumberFromInput(document.getElementById('mn-cost'));
    const low = getNumberFromInput(document.getElementById('mn-low'));
  
    const newMat = {
        id: genMid(), name, 
        cat: document.getElementById('mn-cat').value,
        unit: document.getElementById('mn-unit').value,
        qty: qty, cost: Math.round(cost), low: Math.round(low) || 5,
        note: document.getElementById('mn-note')?.value || ''
    };
  
    state.data.materials.push(newMat);
    addLog('Thêm vật tư', `Đã thêm: ${name} (${newMat.id}) - SL: ${newMat.qty} ${newMat.unit} - Giá: ${formatMoneyVND(newMat.cost)}`);
    saveState(); closeModal(); if(window.render) window.render();
}

export function editMaterial(mid) {
    if (!hasPermission('canEditMaterial')) { alert('Bạn không có quyền sửa vật tư'); return; }
    const mat = matById(mid);
    if (!mat) return;
  
    showModal(`<div class="modal-hd"><span class="modal-title">✏️ Sửa vật tư</span><button class="xbtn" onclick="closeModal()">✕</button></div>
    <div class="modal-bd"><div class="form-grid2">
      <div class="form-group form-full"><label class="form-label">Tên vật tư *</label><input id="mn-name" value="${escapeHtml(mat.name)}"></div>
      <div class="form-group"><label class="form-label">Danh mục</label><select id="mn-cat">${state.data.categories.map(c => `<option ${mat.cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Đơn vị tính</label><select id="mn-unit">${state.data.units.map(u => `<option ${mat.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Đơn giá (VNĐ)</label><input type="text" id="mn-cost" value="${mat.cost.toLocaleString('vi-VN')}" dir="ltr"></div>
      <div class="form-group"><label class="form-label">Ngưỡng cảnh báo tồn</label><input type="text" id="mn-low" value="${mat.low.toLocaleString('vi-VN')}" dir="ltr"></div>
      <div class="form-group form-full"><label class="form-label">Ghi chú</label><textarea id="mn-note" rows="2">${escapeHtml(mat.note || '')}</textarea></div>
    </div></div>
    <div class="modal-ft"><button onclick="closeModal()">Hủy</button><button class="primary" onclick="updateMaterial('${mid}')">Cập nhật</button></div>`);
  
    setTimeout(() => {
        const costInput = document.getElementById('mn-cost');
        const lowInput = document.getElementById('mn-low');
        if (costInput) setupNumberInput(costInput, { isInteger: false, decimals: 2 });
        if (lowInput) setupNumberInput(lowInput, { isInteger: true, decimals: 0 });
    }, 100);
}

export function updateMaterial(mid) {
    const mat = matById(mid);
    if (!mat) return;
    const name = document.getElementById('mn-name')?.value.trim();
    if (!name) return alert('Vui lòng nhập tên vật tư');
  
    mat.name = name;
    mat.cat = document.getElementById('mn-cat').value;
    mat.unit = document.getElementById('mn-unit').value;
    mat.cost = getNumberFromInput(document.getElementById('mn-cost'));
    mat.low = getNumberFromInput(document.getElementById('mn-low'));
    mat.note = document.getElementById('mn-note')?.value || '';
    addLog('Sửa vật tư', `Đã cập nhật: ${name} (${mid})`);
    saveState(); closeModal(); if(window.render) window.render();
}

export function deleteMaterial(mid) {
    if (!hasPermission('canDeleteMaterial')) { alert('Bạn không có quyền xóa vật tư'); return; }
    const mat = matById(mid);
    if (!confirm(`⚠️ Xóa vật tư "${mat?.name}"?`)) return;
    state.data.materials = state.data.materials.filter(m => m.id !== mid);
    state.data.transactions = state.data.transactions.filter(t => t.mid !== mid);
    addLog('Xóa vật tư', `Đã xóa: ${mat?.name} (${mid})`);
    saveState(); if(window.render) window.render();
}

export const addMaterial = (data) => {
    const newId = genMid();
    const newMat = { id: newId, name: data.name, cat: data.cat || data.category, unit: data.unit, qty: data.qty || 0, cost: data.cost || 0, low: data.low || 5, note: data.note || '' };
    state.data.materials.push(newMat);
    addLog('Thêm vật tư', `Đã thêm: ${newMat.name} (${newMat.id})`);
    saveState(); if(window.render) window.render();
    return newMat;
};
// ========== XEM CHI TIẾT VẬT TƯ ==========
window.showMaterialDetail = function(mid) {
    const mat = matById(mid);
    if (!mat) return;

    // Lấy giao dịch nhập (purchase)
    const purchaseTxns = state.data.transactions
        .filter(t => t.mid === mid && t.type === 'purchase')
        .sort((a, b) => new Date(b.datetime || b.date) - new Date(a.datetime || a.date));

    // Lấy giao dịch xuất (usage) và trả (return)
    const exportTxns = state.data.transactions
        .filter(t => t.mid === mid && (t.type === 'usage' || t.type === 'return'))
        .sort((a, b) => new Date(b.datetime || b.date) - new Date(a.datetime || a.date));

    // Tính tổng
    const totalImport = purchaseTxns.reduce((s, t) => s + (t.totalAmount || 0), 0);
    const totalExport = exportTxns.filter(t => t.type === 'usage').reduce((s, t) => s + (t.totalAmount || 0), 0);
    const totalReturn = exportTxns.filter(t => t.type === 'return').reduce((s, t) => s + (t.totalAmount || 0), 0);

    const html = `
        <div class="modal-hd" style="background: var(--accent-bg);">
            <span class="modal-title">📦 Chi tiết: ${escapeHtml(mat.name)} (${mat.id})</span>
            <button class="xbtn" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-bd" style="max-height: 70vh; overflow-y: auto;">
            <div class="grid4" style="margin-bottom: 20px;">
                <div class="metric-card">
                    <div class="metric-label">📦 TỒN KHO</div>
                    <div class="metric-val">${mat.qty.toLocaleString('vi-VN')} ${mat.unit}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">💰 ĐƠN GIÁ</div>
                    <div class="metric-val">${formatMoneyVND(mat.cost)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">📥 TỔNG NHẬP</div>
                    <div class="metric-val" style="color: var(--success-text);">${formatMoneyVND(totalImport)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">📤 TỔNG XUẤT</div>
                    <div class="metric-val" style="color: var(--warn-text);">${formatMoneyVND(totalExport)}</div>
                </div>
            </div>

            <div class="sec-title">📥 LỊCH SỬ NHẬP KHO</div>
            <div class="tbl-wrap" style="margin-bottom: 20px;">
                <table style="min-width: 700px;">
                    <thead><tr><th>Thời gian</th><th>Nhà cung cấp</th><th>SL</th><th>Đơn giá</th><th>VAT</th><th>Thành tiền</th><th>Ghi chú</th></tr></thead>
                    <tbody>
                        ${purchaseTxns.length > 0 ? purchaseTxns.map(t => {
                            const sup = supplierById(t.supplierId);
                            return `<tr>
                                <td style="white-space:nowrap;">${formatDateTime(t.datetime || t.date)}</td>
                                <td><strong>${escapeHtml(sup?.name || 'N/A')}</strong></td>
                                <td style="text-align:right;">${(t.qty||0).toLocaleString('vi-VN')} ${mat.unit}</td>
                                <td style="text-align:right;">${formatMoneyVND(t.unitPrice)}</td>
                                <td style="text-align:center;">${t.vatRate||0}%</td>
                                <td style="text-align:right;color:var(--success-text);font-weight:500;">${formatMoneyVND(t.totalAmount)}</td>
                                <td>${escapeHtml(t.note || '—')}</td>
                            </tr>`;
                        }).join('') : '<tr><td colspan="7" style="text-align:center;">📭 Chưa có giao dịch nhập</td></tr>'}
                    </tbody>
                </table>
            </div>

            <div class="sec-title">📤 LỊCH SỬ XUẤT KHO</div>
            <div class="tbl-wrap">
                <table style="min-width: 700px;">
                    <thead><tr><th>Thời gian</th><th>Loại</th><th>Công trình</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th><th>Ghi chú</th></tr></thead>
                    <tbody>
                        ${exportTxns.length > 0 ? exportTxns.map(t => {
                            const proj = projectById(t.projectId);
                            const isReturn = t.type === 'return';
                            return `<tr>
                                <td style="white-space:nowrap;">${formatDateTime(t.datetime || t.date)}</td>
                                <td style="color:${isReturn?'var(--success-text)':'var(--warn-text)'};font-weight:500;">${isReturn ? '🔄 Trả hàng' : '📤 Xuất kho'}</td>
                                <td><strong>${escapeHtml(proj?.name || 'N/A')}</strong></td>
                                <td style="text-align:right;">${(t.qty||0).toLocaleString('vi-VN')} ${mat.unit}</td>
                                <td style="text-align:right;">${formatMoneyVND(t.unitPrice)}</td>
                                <td style="text-align:right;font-weight:500;color:${isReturn?'var(--success-text)':'var(--warn-text)'};">${isReturn?'- ':''}${formatMoneyVND(t.totalAmount)}</td>
                                <td>${escapeHtml(t.note || '—')}</td>
                            </tr>`;
                        }).join('') : '<tr><td colspan="7" style="text-align:center;">📭 Chưa có giao dịch xuất</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
        <div class="modal-ft">
            <button onclick="closeModal()">Đóng</button>
            <button class="sm" onclick="closeModal();window.exportMaterialDetail('${mid}')">📎 Xuất Excel</button>
        </div>`;

    showModal(html, null);
};

// Hàm helper format datetime
function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return '';
    return new Date(dateTimeStr).toLocaleString('vi-VN');
}

// Hàm helper lấy supplier by id
function supplierById(sid) {
    return state.data.suppliers.find(s => s.id === sid);
}
window.exportMaterialDetail = function(mid) {
    const mat = matById(mid);
    if (!mat) return;

    const purchaseTxns = state.data.transactions.filter(t => t.mid === mid && t.type === 'purchase');
    const exportTxns = state.data.transactions.filter(t => t.mid === mid && (t.type === 'usage' || t.type === 'return'));

    const importData = purchaseTxns.map(t => ({
        'Thời gian': formatDateTime(t.datetime || t.date),
        'Nhà cung cấp': supplierById(t.supplierId)?.name || '',
        'Số lượng': t.qty,
        'Đơn giá': t.unitPrice,
        'VAT': t.vatRate + '%',
        'Thành tiền': t.totalAmount,
        'Ghi chú': t.note || ''
    }));

    const exportData = exportTxns.map(t => ({
        'Thời gian': formatDateTime(t.datetime || t.date),
        'Loại': t.type === 'return' ? 'Trả hàng' : 'Xuất kho',
        'Công trình': projectById(t.projectId)?.name || '',
        'Số lượng': t.qty,
        'Đơn giá': t.unitPrice,
        'Thành tiền': t.totalAmount,
        'Ghi chú': t.note || ''
    }));

    if (typeof XLSX !== 'undefined') {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(importData), 'Nhập kho');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportData), 'Xuất kho');
        XLSX.writeFile(wb, `chitiet_${mat.id}_${new Date().toISOString().split('T')[0]}.xlsx`);
        alert('✅ Đã xuất Excel!');
    } else {
        alert('Đang tải thư viện Excel...');
    }
};

function projectById(pid) {
    return state.data.projects.find(p => p.id === pid);
}
export const getMaterials = () => state.data.materials;