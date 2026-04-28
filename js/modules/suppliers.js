import { state, saveState, addLog, formatMoney, escapeHtml, showModal, closeModal, genSid, supplierById, hasPermission } from './state.js';
import { debounce, formatMoneyVND } from './utils.js';

let supplierFilters = { keyword: '', phone: '', minPurchase: '', maxPurchase: '' };
let supplierListContainer = null;

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
                return `<div class="supplier-card">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                        <strong>${escapeHtml(s.name)}</strong> 
                        <span class="tag">${s.id}</span>
                    </div>
                    <div class="metric-sub">📞 ${s.phone || 'Chưa có'}</div>
                    <div class="metric-sub">✉️ ${s.email || 'Chưa có'}</div>
                    <div class="metric-sub">📍 ${s.address || 'Chưa có'}</div>
                    <div class="metric-sub" style="margin-top:8px">📦 Số lần nhập: ${purchaseCount}</div>
                    <div class="metric-sub" style="color:var(--success-text)">💰 Tổng chi: ${formatMoneyVND(totalSpent)}</div>
                    <div style="margin-top:8px;display:flex;gap:8px">
                        <button class="sm" onclick="openSupplierModal(${JSON.stringify(s).replace(/"/g, '&quot;')})">✏️ Sửa</button>
                        <button class="sm danger-btn" onclick="window.deleteSupplierHandler('${s.id}')">🗑️ Xóa</button>
                        <button class="sm" onclick="viewSupplierHistory('${s.id}')">📜 Lịch sử</button>
                    </div>
                </div>`;
            }).join('')}
        </div>
    `;
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
    };
}

export function renderSuppliers() {
  const result = renderSupplierSearchBar() + `<div class="card">
    <div class="sec-title">🏭 DANH SÁCH NHÀ CUNG CẤP</div>
    <div id="supplier-list-container"></div>
    <div id="supplier-history-modal" style="display:none"></div>
  </div>`;
  
  setTimeout(() => {
      bindSupplierSearchEvents();
      supplierListContainer = document.getElementById('supplier-list-container');
      updateSupplierList();
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
  const newSupplier = {
    id: genSid(),
    name: name,
    phone: document.getElementById('sup-phone')?.value || '',
    email: document.getElementById('sup-email')?.value || '',
    address: document.getElementById('sup-address')?.value || ''
  };
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
  if (relatedTxns.length > 0) {
    if (!confirm(`⚠️ Nhà cung cấp "${supplier.name}" đã có ${relatedTxns.length} giao dịch nhập hàng.\nXóa sẽ XÓA LUÔN các giao dịch này.\nBạn có chắc chắn?`)) return;
  } else {
    if (!confirm(`Xóa nhà cung cấp "${supplier.name}"?`)) return;
  }
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
  const purchaseTxns = state.data.transactions.filter(t => t.type === 'purchase' && t.supplierId === sid).sort((a,b) => new Date(b.date) - new Date(a.date));
  const totalSpent = purchaseTxns.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
  
  showModal(`<div class="modal-hd"><span class="modal-title">📜 Lịch sử nhập hàng - ${escapeHtml(supplier?.name)}</span><button class="xbtn" onclick="closeModal()">✕</button></div>
    <div class="modal-bd">
      <div class="metric-card" style="margin-bottom:16px"><div class="metric-label">Tổng chi</div><div class="metric-val" style="font-size:20px">${formatMoneyVND(totalSpent)}</div></div>
      <div class="tbl-wrap"><table style="min-width:500px"><thead><tr><th>Ngày</th><th>Vật tư</th><th>SL</th><th>Đơn giá</th><th>VAT</th><th>Thành tiền</th></tr></thead>
      <tbody>${purchaseTxns.map(t => {
        const mat = state.data.materials.find(m => m.id === t.mid);
        return `<tr>
          <td>${t.date}</td>
          <td>${mat?.name || 'N/A'}</td>
          <td>${t.qty} ${mat?.unit || ''}</td>
          <td>${formatMoneyVND(t.unitPrice)}</td>
          <td>${t.vatRate || 0}%</td>
          <td class="text-warning">${formatMoneyVND(t.totalAmount || 0)}</td>
        </tr>`;
      }).join('') || '<tr><td colspan="6">Chưa có giao dịch nào</td></tr>'}</tbody></table></div>
      ${purchaseTxns.filter(t => t.invoiceImage).length > 0 ? `<div class="sec-title" style="margin-top:16px">📎 Hóa đơn đính kèm</div>
      ${purchaseTxns.filter(t => t.invoiceImage).map(t => `<div><a href="${t.invoiceImage}" target="_blank">📄 Xem hóa đơn ngày ${t.date}</a></div>`).join('')}` : ''}
    </div>
    <div class="modal-ft"><button onclick="closeModal()">Đóng</button></div>`);
}

export const addSupplier = (data) => {
    const newId = genSid();
    const newSupplier = {
        id: newId,
        name: data.name,
        phone: data.phone || '',
        email: data.email || '',
        address: data.address || ''
    };
    state.data.suppliers.push(newSupplier);
    addLog('Thêm nhà cung cấp', `Đã thêm nhà cung cấp: ${newSupplier.name} (${newSupplier.id})`);
    saveState();
    if(window.render) window.render();
    return newSupplier;
};

export const getSuppliers = () => state.data.suppliers;