import { state, saveState, addLog, formatMoney, showModal, closeModal, genTid, matById, projectById, supplierById, hasPermission } from './state.js';
import { handleIntegerInput, handleQuantityInput, getNumberFromInput, getIntegerFromInput, setInputValue, formatMoneyVND, formatNumberVN } from './utils.js';

let currentInvoiceBase64 = null;

// ========== NHẬP KHO ==========
export function openPurchaseModal() {
  if (!hasPermission('canImport')) { alert('Bạn không có quyền nhập kho'); return; }
  if(state.data.materials.length === 0) return alert('Chưa có vật tư trong kho');
  if(state.data.suppliers.length === 0) return alert('Chưa có nhà cung cấp. Vào mục Nhà cung cấp để thêm.');
  
  const optsMat = state.data.materials.map(m => `<option value="${m.id}">${m.name} (Đơn giá gốc: ${formatMoneyVND(m.cost)}/${m.unit})</option>`).join('');
  const optsSup = state.data.suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  
  showModal(`<div class="modal-hd"><span class="modal-title">📥 Nhập kho (Có VAT & Hóa đơn)</span><button class="xbtn" onclick="closeModal()">✕</button></div>
    <div class="modal-bd">
      <div class="form-group"><label class="form-label">🏭 Nhà cung cấp</label><select id="purchase-supplier">${optsSup}</select></div>
      <div class="form-group"><label class="form-label">📦 Vật tư</label><select id="purchase-mid">${optsMat}</select></div>
      <div class="form-group"><label class="form-label">🔢 Số lượng</label><input type="text" id="purchase-qty" value="1" style="text-align: right;"></div>
      <div class="form-group"><label class="form-label">💰 Đơn giá nhập (VNĐ)</label><input type="text" id="purchase-price" value="" placeholder="Nhập giá thực tế" style="text-align: right;"></div>
      <div class="form-group"><label class="form-label">🧾 Thuế VAT (%)</label><input type="number" id="purchase-vat" value="10" step="0.1" style="text-align: right;"></div>
      <div class="metric-card" style="margin-bottom:12px">
        <div class="metric-sub">💰 Thành tiền trước VAT: <strong id="preview-subtotal">0 ₫</strong></div>
        <div class="metric-sub">🧾 Tiền VAT: <strong id="preview-vat">0 ₫</strong></div>
        <div class="metric-val" style="font-size:18px">💵 Tổng thanh toán: <strong id="preview-total">0 ₫</strong></div>
      </div>
      <div class="form-group"><label class="form-label">📎 Ảnh hóa đơn (tùy chọn)</label><input type="file" id="purchase-invoice" accept="image/*" onchange="previewInvoiceImage()"></div>
      <div id="invoice-preview"></div>
      <div class="form-group"><label class="form-label">📝 Ghi chú</label><input id="purchase-note" placeholder="Mã hóa đơn, số chứng từ..."></div>
    </div>
    <div class="modal-ft"><button onclick="closeModal()">Hủy</button><button class="primary" onclick="savePurchase()">Xác nhận nhập kho</button></div>`);
  
  const midSelect = document.getElementById('purchase-mid');
  const updateDefaultPrice = () => {
    const mid = midSelect.value;
    const mat = matById(mid);
    if (mat) {
      const priceInput = document.getElementById('purchase-price');
      if (priceInput && !priceInput.value) {
        setInputValue(priceInput, mat.cost);
      }
    }
    calculatePurchaseTotal();
  };
  
  setTimeout(() => {
    const qtyInput = document.getElementById('purchase-qty');
    const priceInput = document.getElementById('purchase-price');
    const vatInput = document.getElementById('purchase-vat');
    
    if (qtyInput) {
      qtyInput.addEventListener('input', handleQuantityInput);
      qtyInput.addEventListener('change', () => calculatePurchaseTotal());
    }
    if (priceInput) {
      priceInput.addEventListener('input', handleQuantityInput);
      priceInput.addEventListener('change', () => calculatePurchaseTotal());
    }
    if (vatInput) vatInput.addEventListener('input', () => calculatePurchaseTotal());
    
    if (midSelect) midSelect.addEventListener('change', updateDefaultPrice);
    updateDefaultPrice();
  }, 100);
}

export function calculatePurchaseTotal() {
  const qtyInput = document.getElementById('purchase-qty');
  const priceInput = document.getElementById('purchase-price');
  const vatInput = document.getElementById('purchase-vat');
  
  const qty = getNumberFromInput(qtyInput);
  const price = getNumberFromInput(priceInput);
  const vatRate = parseFloat(vatInput?.value) || 0;
  
  const subtotal = qty * price;
  const vatAmount = subtotal * vatRate / 100;
  const total = subtotal + vatAmount;
  
  const subtotalEl = document.getElementById('preview-subtotal');
  const vatEl = document.getElementById('preview-vat');
  const totalEl = document.getElementById('preview-total');
  if (subtotalEl) subtotalEl.innerText = formatMoneyVND(subtotal);
  if (vatEl) vatEl.innerText = formatMoneyVND(vatAmount);
  if (totalEl) totalEl.innerText = formatMoneyVND(total);
}

window.previewInvoiceImage = function() {
  const file = document.getElementById('purchase-invoice')?.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    currentInvoiceBase64 = e.target.result;
    const previewDiv = document.getElementById('invoice-preview');
    if (previewDiv) {
      previewDiv.innerHTML = `<img src="${currentInvoiceBase64}" class="invoice-img" onclick="window.open(this.src)"><br><button class="sm" onclick="clearInvoiceImage()">🗑️ Xóa ảnh</button>`;
    }
  };
  reader.readAsDataURL(file);
};

window.clearInvoiceImage = function() {
  currentInvoiceBase64 = null;
  const previewDiv = document.getElementById('invoice-preview');
  if (previewDiv) previewDiv.innerHTML = '';
  const fileInput = document.getElementById('purchase-invoice');
  if (fileInput) fileInput.value = '';
};

export function savePurchase() {
  const supplierId = document.getElementById('purchase-supplier')?.value;
  const mid = document.getElementById('purchase-mid')?.value;
  
  const qtyInput = document.getElementById('purchase-qty');
  const priceInput = document.getElementById('purchase-price');
  
  const qty = getNumberFromInput(qtyInput);
  const unitPrice = getNumberFromInput(priceInput);
  const vatRate = parseFloat(document.getElementById('purchase-vat')?.value) || 0;
  const note = document.getElementById('purchase-note')?.value || '';
  
  if (!supplierId) return alert('Chọn nhà cung cấp');
  if (!mid) return alert('Chọn vật tư');
  if (!qty || qty <= 0) return alert('Số lượng không hợp lệ');
  if (!unitPrice || unitPrice <= 0) return alert('Đơn giá nhập không hợp lệ');
  
  const mat = matById(mid);
  if (!mat) return alert('Không tìm thấy vật tư');
  
  const subtotal = qty * unitPrice;
  const vatAmount = subtotal * vatRate / 100;
  const totalAmount = subtotal + vatAmount;
  
  mat.qty += qty;
  
  const transaction = {
    id: genTid(),
    mid: mid,
    supplierId: supplierId,
    date: new Date().toISOString().split('T')[0],
    type: 'purchase',
    qty: qty,
    unitPrice: unitPrice,
    vatRate: vatRate,
    subtotal: subtotal,
    vatAmount: vatAmount,
    totalAmount: totalAmount,
    note: note,
    invoiceImage: currentInvoiceBase64 || null
  };
  
  state.data.transactions.unshift(transaction);
  
  const supplier = supplierById(supplierId);
  addLog('Nhập kho', `${mat.name} - SL: ${qty} ${mat.unit} - Giá nhập: ${formatMoneyVND(unitPrice)} - VAT: ${vatRate}% - Tổng: ${formatMoneyVND(totalAmount)} - Nhà cung cấp: ${supplier?.name}`);
  
  saveState(); 
  closeModal(); 
  currentInvoiceBase64 = null;
  if(window.render) window.render();
}

// ========== XUẤT KHO ==========
export function openTxnModal(type) {
  if(type === 'usage' && !hasPermission('canExport')) { alert('Bạn không có quyền xuất kho'); return; }
  if(state.data.materials.length === 0) return alert('Chưa có vật tư trong kho');
  if(type === 'usage' && state.data.projects.length === 0) return alert('Chưa có công trình nào. Hãy thêm công trình trước.');
  
  // Hiển thị số lượng tồn có dấu chấm phân cách
  const optsMat = state.data.materials.map(m => `<option value="${m.id}">${m.name} (Tồn: ${m.qty.toLocaleString('vi-VN')} ${m.unit})</option>`).join('');
  const optsProj = state.data.projects.map(p => `<option value="${p.id}">${p.name} (Ngân sách: ${formatMoneyVND(p.budget)})</option>`).join('');
  
  showModal(`<div class="modal-hd"><span class="modal-title">📤 Xuất kho cho công trình</span><button class="xbtn" onclick="closeModal()">✕</button></div>
    <div class="modal-bd">
      <div class="form-group"><label class="form-label">🏗️ Công trình thi công</label><select id="txn-project">${optsProj}</select></div>
      <div class="form-group"><label class="form-label">📦 Vật tư</label><select id="txn-mid">${optsMat}</select></div>
      <div class="form-group"><label class="form-label">🔢 Số lượng</label><input type="text" id="txn-qty" value="1" style="text-align: right;"></div>
      <div class="metric-card" style="margin-top:8px"><div class="metric-sub">💰 Thành tiền dự kiến: <strong id="preview-export-total">0 ₫</strong></div></div>
      <div class="form-group"><label class="form-label">📝 Ghi chú</label><input id="txn-note" placeholder="Mô tả thêm"></div>
    </div>
    <div class="modal-ft"><button onclick="closeModal()">Hủy</button><button class="primary" onclick="saveExport()">Xác nhận xuất kho</button></div>`);
  
  setTimeout(() => {
    const qtyInput = document.getElementById('txn-qty');
    const midSelect = document.getElementById('txn-mid');
    
    const updatePreview = () => {
      const mid = midSelect?.value;
      const mat = matById(mid);
      const qty = getNumberFromInput(qtyInput);
      const total = (mat?.cost || 0) * qty;
      const previewEl = document.getElementById('preview-export-total');
      if (previewEl) previewEl.innerText = formatMoneyVND(total);
    };
    
    if (qtyInput) {
      qtyInput.addEventListener('input', handleQuantityInput);
      qtyInput.addEventListener('change', updatePreview);
    }
    if (midSelect) midSelect.addEventListener('change', updatePreview);
    updatePreview();
  }, 100);
}

export function calculateExportTotal() {
  const mid = document.getElementById('txn-mid')?.value;
  const mat = matById(mid);
  const qtyInput = document.getElementById('txn-qty');
  const qty = getNumberFromInput(qtyInput);
  const total = (mat?.cost || 0) * qty;
  const previewEl = document.getElementById('preview-export-total');
  if (previewEl) previewEl.innerText = formatMoneyVND(total);
}

export function saveExport() {
  const projectId = document.getElementById('txn-project')?.value;
  const mid = document.getElementById('txn-mid')?.value;
  const qtyInput = document.getElementById('txn-qty');
  const qty = getNumberFromInput(qtyInput);
  const note = document.getElementById('txn-note')?.value || '';
  
  if (!projectId) return alert('Chọn công trình');
  if (!mid) return alert('Chọn vật tư');
  if (!qty || qty <= 0) return alert('Số lượng không hợp lệ');
  
  const mat = matById(mid);
  if (!mat) return alert('Không tìm thấy vật tư');
  if (mat.qty < qty) return alert(`Không đủ tồn kho! Hiện còn ${mat.qty.toLocaleString('vi-VN')} ${mat.unit}`);
  
  const totalAmount = qty * mat.cost;
  
  mat.qty -= qty;
  const project = projectById(projectId);
  if (project) project.spent = (project.spent || 0) + totalAmount;
  
  const transaction = {
    id: genTid(),
    mid: mid,
    projectId: projectId,
    date: new Date().toISOString().split('T')[0],
    type: 'usage',
    qty: qty,
    unitPrice: mat.cost,
    totalAmount: totalAmount,
    note: note
  };
  
  state.data.transactions.unshift(transaction);
  addLog('Xuất kho', `${mat.name} - SL: ${qty} ${mat.unit} - Công trình: ${project?.name} - Thành tiền: ${formatMoneyVND(totalAmount)}`);
  
  saveState(); 
  closeModal(); 
  if(window.render) window.render();
}
// ========== EXPORTS CHO app.js ==========
export const importMaterial = savePurchase;
export const exportMaterial = saveExport;
export const getTransactions = () => {
    return state.data.transactions;
};