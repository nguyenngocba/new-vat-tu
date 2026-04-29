import { state, saveState, addLog, showModal, closeModal, genTid, matById, projectById, supplierById, hasPermission, escapeHtml } from './state.js';
import { handleQuantityInput, getNumberFromInput, formatMoneyVND, setupNumberInput } from './utils.js';

let currentInvoiceBase64 = null;
let currentExportAttachmentBase64 = null;
let currentReturnAttachmentBase64 = null;

function getCurrentDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return '';
    const date = new Date(dateTimeStr);
    return date.toLocaleString('vi-VN');
}

// ========== NHẬP KHO ==========
export function openPurchaseModal() {
    if (!hasPermission('canImport')) { alert('Bạn không có quyền nhập kho'); return; }
    if (state.data.materials.length === 0) return alert('Chưa có vật tư trong kho');
    if (state.data.suppliers.length === 0) return alert('Chưa có nhà cung cấp');
    
    const optsMat = state.data.materials.map(m => `<option value="${m.id}">${m.name} (Tồn: ${m.qty.toLocaleString('vi-VN')} ${m.unit})</option>`).join('');
    const optsSup = state.data.suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    const currentDateTime = getCurrentDateTime();
    
    showModal(`<div class="modal-hd"><span class="modal-title">📥 Nhập kho (Có VAT & Hóa đơn)</span><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-bd">
            <div class="form-grid2">
                <div class="form-group"><label class="form-label">📅 Thời gian nhập</label><input type="datetime-local" id="purchase-datetime" value="${currentDateTime}" style="width: 100%;"></div>
                <div class="form-group"><label class="form-label">🏭 Nhà cung cấp</label><select id="purchase-supplier">${optsSup}</select></div>
                <div class="form-group"><label class="form-label">📦 Vật tư</label><select id="purchase-mid">${optsMat}</select></div>
                <div class="form-group"><label class="form-label">🔢 Số lượng</label><input type="text" id="purchase-qty" value="1" style="text-align: right;"></div>
                <div class="form-group"><label class="form-label">💰 Đơn giá nhập (VNĐ)</label><input type="text" id="purchase-price" placeholder="Nhập giá thực tế" style="text-align: right;"></div>
                <div class="form-group"><label class="form-label">🧾 Thuế VAT (%)</label><input type="number" id="purchase-vat" value="10" step="0.1" style="text-align: right;"></div>
            </div>
            <div class="metric-card" style="margin-bottom:12px">
                <div class="metric-sub">💰 Thành tiền trước VAT: <strong id="preview-subtotal">0 ₫</strong></div>
                <div class="metric-sub">🧾 Tiền VAT: <strong id="preview-vat">0 ₫</strong></div>
                <div class="metric-val" style="font-size:18px">💵 Tổng thanh toán: <strong id="preview-total">0 ₫</strong></div>
            </div>
            <div class="form-group"><label class="form-label">📎 Ảnh hóa đơn (tùy chọn)</label><input type="file" id="purchase-invoice" accept="image/*"></div>
            <div id="invoice-preview"></div>
            <div class="form-group"><label class="form-label">📝 Ghi chú</label><input id="purchase-note" placeholder="Mã hóa đơn, số chứng từ..."></div>
        </div>
        <div class="modal-ft"><button onclick="closeModal()">Hủy</button><button class="primary" onclick="window.savePurchase()">Xác nhận nhập kho</button></div>`);
    
    setTimeout(() => {
        const qtyInput = document.getElementById('purchase-qty');
        const priceInput = document.getElementById('purchase-price');
        const vatInput = document.getElementById('purchase-vat');
        const midSelect = document.getElementById('purchase-mid');
        const fileInput = document.getElementById('purchase-invoice');
        
        if (qtyInput) {
            setupNumberInput(qtyInput, { isInteger: false, decimals: null });
            qtyInput.addEventListener('change', () => window.calculatePurchaseTotal());
        }
        if (priceInput) {
            setupNumberInput(priceInput, { isInteger: true, decimals: 0 });
            priceInput.addEventListener('change', () => window.calculatePurchaseTotal());
        }
        if (vatInput) {
            setupNumberInput(vatInput, { isInteger: false, decimals: 1 });
            vatInput.addEventListener('input', () => window.calculatePurchaseTotal());
        }
        
        if (fileInput) {
            fileInput.addEventListener('change', function() {
                const file = this.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = function(e) {
                    currentInvoiceBase64 = e.target.result;
                    const previewDiv = document.getElementById('invoice-preview');
                    if (previewDiv) previewDiv.innerHTML = `<img src="${currentInvoiceBase64}" class="invoice-img" onclick="window.open(this.src)"><br><button class="sm" onclick="window.clearInvoiceImage()">🗑️ Xóa ảnh</button>`;
                };
                reader.readAsDataURL(file);
            });
        }
        
        const updateDefaultPrice = () => {
            const mid = midSelect?.value;
            const mat = matById(mid);
            if (mat && priceInput && (!priceInput.value || priceInput.value === '0')) priceInput.value = mat.cost.toLocaleString('vi-VN');
            window.calculatePurchaseTotal();
        };
        if (midSelect) { midSelect.addEventListener('change', updateDefaultPrice); updateDefaultPrice(); }
        window.calculatePurchaseTotal();
    }, 100);
}

export function openPurchaseModalWithSupplier(supplierId) {
    if (!hasPermission('canImport')) { alert('Bạn không có quyền nhập kho'); return; }
    if (state.data.materials.length === 0) return alert('Chưa có vật tư trong kho');
    const supplier = supplierById(supplierId);
    if (!supplier) return alert('Không tìm thấy nhà cung cấp');
    
    const optsMat = state.data.materials.map(m => `<option value="${m.id}">${m.name} (Tồn: ${m.qty.toLocaleString('vi-VN')} ${m.unit})</option>`).join('');
    const currentDateTime = getCurrentDateTime();
    
    showModal(`<div class="modal-hd"><span class="modal-title">📥 Nhập kho từ ${escapeHtml(supplier.name)}</span><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-bd">
            <div class="form-grid2">
                <div class="form-group"><label class="form-label">📅 Thời gian nhập</label><input type="datetime-local" id="purchase-datetime" value="${currentDateTime}" style="width: 100%;"></div>
                <div class="form-group"><label class="form-label">🏭 Nhà cung cấp</label><input type="text" value="${escapeHtml(supplier.name)}" disabled style="background: var(--surface3);"></div>
                <div class="form-group"><label class="form-label">📦 Vật tư</label><select id="purchase-mid">${optsMat}</select></div>
                <div class="form-group"><label class="form-label">🔢 Số lượng</label><input type="text" id="purchase-qty" value="1" style="text-align: right;"></div>
                <div class="form-group"><label class="form-label">💰 Đơn giá nhập (VNĐ)</label><input type="text" id="purchase-price" placeholder="Nhập giá thực tế" style="text-align: right;"></div>
                <div class="form-group"><label class="form-label">🧾 Thuế VAT (%)</label><input type="number" id="purchase-vat" value="10" step="0.1" style="text-align: right;"></div>
            </div>
            <div class="metric-card" style="margin-bottom:12px">
                <div class="metric-sub">💰 Thành tiền trước VAT: <strong id="preview-subtotal">0 ₫</strong></div>
                <div class="metric-sub">🧾 Tiền VAT: <strong id="preview-vat">0 ₫</strong></div>
                <div class="metric-val" style="font-size:18px">💵 Tổng thanh toán: <strong id="preview-total">0 ₫</strong></div>
            </div>
            <div class="form-group"><label class="form-label">📎 Ảnh hóa đơn (tùy chọn)</label><input type="file" id="purchase-invoice" accept="image/*"></div>
            <div id="invoice-preview"></div>
            <div class="form-group"><label class="form-label">📝 Ghi chú</label><input id="purchase-note" placeholder="Mã hóa đơn, số chứng từ..."></div>
        </div>
        <div class="modal-ft"><button onclick="closeModal()">Hủy</button><button class="primary" onclick="window.savePurchaseWithSupplier('${supplierId}')">Xác nhận nhập kho</button></div>`);
    
    setTimeout(() => {
        const qtyInput = document.getElementById('purchase-qty');
        const priceInput = document.getElementById('purchase-price');
        const vatInput = document.getElementById('purchase-vat');
        const midSelect = document.getElementById('purchase-mid');
        const fileInput = document.getElementById('purchase-invoice');
        
        if (qtyInput) {
            setupNumberInput(qtyInput, { isInteger: false, decimals: null });
            qtyInput.addEventListener('change', () => window.calculatePurchaseTotal());
        }
        if (priceInput) {
            setupNumberInput(priceInput, { isInteger: true, decimals: 0 });
            priceInput.addEventListener('change', () => window.calculatePurchaseTotal());
        }
        if (vatInput) {
            setupNumberInput(vatInput, { isInteger: false, decimals: 1 });
            vatInput.addEventListener('input', () => window.calculatePurchaseTotal());
        }
        
        if (fileInput) {
            fileInput.addEventListener('change', function() {
                const file = this.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = function(e) {
                    currentInvoiceBase64 = e.target.result;
                    const previewDiv = document.getElementById('invoice-preview');
                    if (previewDiv) previewDiv.innerHTML = `<img src="${currentInvoiceBase64}" class="invoice-img" onclick="window.open(this.src)"><br><button class="sm" onclick="window.clearInvoiceImage()">🗑️ Xóa ảnh</button>`;
                };
                reader.readAsDataURL(file);
            });
        }
        
        const updateDefaultPrice = () => {
            const mid = midSelect?.value;
            const mat = matById(mid);
            if (mat && priceInput && (!priceInput.value || priceInput.value === '0')) priceInput.value = mat.cost.toLocaleString('vi-VN');
            window.calculatePurchaseTotal();
        };
        if (midSelect) { midSelect.addEventListener('change', updateDefaultPrice); updateDefaultPrice(); }
        window.calculatePurchaseTotal();
    }, 100);
}

export function calculatePurchaseTotal() {
    const qty = getNumberFromInput(document.getElementById('purchase-qty'));
    const price = getNumberFromInput(document.getElementById('purchase-price'));
    const vatRate = parseFloat(document.getElementById('purchase-vat')?.value) || 0;
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

export function savePurchase() {
    const supplierId = document.getElementById('purchase-supplier')?.value;
    const mid = document.getElementById('purchase-mid')?.value;
    const datetimeInput = document.getElementById('purchase-datetime');
    const transactionDateTime = datetimeInput ? datetimeInput.value : getCurrentDateTime();
    
    const qty = getNumberFromInput(document.getElementById('purchase-qty'));
    const unitPrice = getNumberFromInput(document.getElementById('purchase-price'));
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
    
    const oldQty = mat.qty;
    const oldValue = oldQty * mat.cost;
    mat.qty += qty;
    mat.cost = Math.round((oldValue + totalAmount) / mat.qty);
    
    const transaction = { 
        id: genTid(), 
        mid: mid, 
        supplierId: supplierId, 
        date: transactionDateTime.split('T')[0],
        datetime: transactionDateTime,
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
    addLog('Nhập kho', `${mat.name} - SL: ${qty.toLocaleString('vi-VN')} ${mat.unit} - Giá: ${formatMoneyVND(unitPrice)} - VAT: ${vatRate}% - Tổng: ${formatMoneyVND(totalAmount)} - NCC: ${supplier?.name} - Thời gian: ${formatDateTime(transactionDateTime)}`);
    saveState();
    closeModal();
    currentInvoiceBase64 = null;
    if (window.render) window.render();
    alert('✅ Nhập kho thành công!');
}

export function savePurchaseWithSupplier(supplierId) {
    const mid = document.getElementById('purchase-mid')?.value;
    const datetimeInput = document.getElementById('purchase-datetime');
    const transactionDateTime = datetimeInput ? datetimeInput.value : getCurrentDateTime();
    
    const qty = getNumberFromInput(document.getElementById('purchase-qty'));
    const unitPrice = getNumberFromInput(document.getElementById('purchase-price'));
    const vatRate = parseFloat(document.getElementById('purchase-vat')?.value) || 0;
    const note = document.getElementById('purchase-note')?.value || '';
    
    if (!mid) return alert('Chọn vật tư');
    if (!qty || qty <= 0) return alert('Số lượng không hợp lệ');
    if (!unitPrice || unitPrice <= 0) return alert('Đơn giá nhập không hợp lệ');
    
    const mat = matById(mid);
    if (!mat) return alert('Không tìm thấy vật tư');
    
    const subtotal = qty * unitPrice;
    const vatAmount = subtotal * vatRate / 100;
    const totalAmount = subtotal + vatAmount;
    
    const oldQty = mat.qty;
    const oldValue = oldQty * mat.cost;
    mat.qty += qty;
    mat.cost = Math.round((oldValue + totalAmount) / mat.qty);
    
    const transaction = { 
        id: genTid(), 
        mid: mid, 
        supplierId: supplierId, 
        date: transactionDateTime.split('T')[0],
        datetime: transactionDateTime,
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
    addLog('Nhập kho', `${mat.name} - SL: ${qty.toLocaleString('vi-VN')} ${mat.unit} - Tổng: ${formatMoneyVND(totalAmount)} - NCC: ${supplier?.name} - Thời gian: ${formatDateTime(transactionDateTime)}`);
    saveState();
    closeModal();
    currentInvoiceBase64 = null;
    if (window.render) window.render();
    alert('✅ Nhập kho thành công!');
}

// ========== XUẤT KHO ==========
export function openTxnModal(type, preselectedProjectId = null) {
    if (type === 'usage' && !hasPermission('canExport')) { alert('Bạn không có quyền xuất kho'); return; }
    if (state.data.materials.length === 0) return alert('Chưa có vật tư trong kho');
    if (type === 'usage' && state.data.projects.length === 0) return alert('Chưa có công trình nào');
    
    const optsMat = state.data.materials.map(m => `<option value="${m.id}">${m.name} (Tồn: ${m.qty.toLocaleString('vi-VN')} ${m.unit})</option>`).join('');
    const optsProj = state.data.projects.map(p => `<option value="${p.id}" ${preselectedProjectId === p.id ? 'selected' : ''}>${p.name} (Ngân sách: ${formatMoneyVND(p.budget)})</option>`).join('');
    const currentDateTime = getCurrentDateTime();
    
    showModal(`<div class="modal-hd"><span class="modal-title">📤 Xuất kho cho công trình</span><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-bd">
            <div class="form-grid2">
                <div class="form-group"><label class="form-label">📅 Thời gian xuất</label><input type="datetime-local" id="export-datetime" value="${currentDateTime}" style="width: 100%;"></div>
                <div class="form-group"><label class="form-label">🏗️ Công trình thi công</label><select id="txn-project">${optsProj}</select></div>
                <div class="form-group"><label class="form-label">📦 Vật tư</label><select id="txn-mid">${optsMat}</select></div>
                <div class="form-group"><label class="form-label">🔢 Số lượng</label><input type="text" id="txn-qty" value="1" style="text-align: right;"></div>
            </div>
            <div class="metric-card" style="margin-top:8px"><div class="metric-sub">💰 Thành tiền dự kiến: <strong id="preview-export-total">0 ₫</strong></div></div>
            <div class="form-group"><label class="form-label">📎 Tệp đính kèm (hợp đồng, biên bản, hóa đơn...)</label><input type="file" id="export-attachment" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"></div>
            <div id="export-attachment-preview"></div>
            <div class="form-group"><label class="form-label">📝 Ghi chú</label><input id="txn-note" placeholder="Mô tả thêm về việc xuất kho..."></div>
        </div>
        <div class="modal-ft"><button onclick="closeModal()">Hủy</button><button class="primary" onclick="window.saveExport()">Xác nhận xuất kho</button></div>`);
    
    setTimeout(() => {
        const qtyInput = document.getElementById('txn-qty');
        const midSelect = document.getElementById('txn-mid');
        const attachmentInput = document.getElementById('export-attachment');
        
        if (attachmentInput) {
            attachmentInput.addEventListener('change', function() {
                const file = this.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = function(e) {
                    currentExportAttachmentBase64 = e.target.result;
                    const previewDiv = document.getElementById('export-attachment-preview');
                    const fileSize = (file.size / 1024).toFixed(2);
                    const fileType = file.type.split('/')[1]?.toUpperCase() || file.name.split('.').pop().toUpperCase();
                    if (previewDiv) {
                        if (file.type.startsWith('image/')) {
                            previewDiv.innerHTML = `<div class="metric-card" style="margin-top: 8px;">
                                <img src="${currentExportAttachmentBase64}" class="invoice-img" style="max-height: 150px;" onclick="window.open(this.src)">
                                <div class="metric-sub">📄 ${file.name} (${fileSize} KB) - ${fileType}</div>
                                <button class="sm" onclick="window.clearExportAttachment()">🗑️ Xóa tệp</button>
                            </div>`;
                        } else {
                            previewDiv.innerHTML = `<div class="metric-card" style="margin-top: 8px;">
                                <div style="font-size: 32px; text-align: center;">📎</div>
                                <div class="metric-sub">📄 ${file.name} (${fileSize} KB) - ${fileType}</div>
                                <button class="sm" onclick="window.clearExportAttachment()">🗑️ Xóa tệp</button>
                            </div>`;
                        }
                    }
                };
                reader.readAsDataURL(file);
            });
        }
        
        const updatePreview = () => {
            const mid = midSelect?.value;
            const mat = matById(mid);
            const qty = getNumberFromInput(qtyInput);
            const total = (mat?.cost || 0) * qty;
            const previewEl = document.getElementById('preview-export-total');
            if (previewEl) previewEl.innerText = formatMoneyVND(total);
        };
        
        if (qtyInput) {
            setupNumberInput(qtyInput, { isInteger: false, decimals: null });
            qtyInput.addEventListener('change', updatePreview);
        }
        if (midSelect) midSelect.addEventListener('change', updatePreview);
        updatePreview();
    }, 100);
}

export function calculateExportTotal() {
    const mid = document.getElementById('txn-mid')?.value;
    const mat = matById(mid);
    const qty = getNumberFromInput(document.getElementById('txn-qty'));
    const total = (mat?.cost || 0) * qty;
    const previewEl = document.getElementById('preview-export-total');
    if (previewEl) previewEl.innerText = formatMoneyVND(total);
}

export function saveExport() {
    const projectId = document.getElementById('txn-project')?.value;
    const mid = document.getElementById('txn-mid')?.value;
    const datetimeInput = document.getElementById('export-datetime');
    const transactionDateTime = datetimeInput ? datetimeInput.value : getCurrentDateTime();
    
    const qty = getNumberFromInput(document.getElementById('txn-qty'));
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
        date: transactionDateTime.split('T')[0],
        datetime: transactionDateTime,
        type: 'usage', 
        qty: qty, 
        unitPrice: mat.cost, 
        totalAmount: totalAmount, 
        note: note,
        attachment: currentExportAttachmentBase64 || null,
        attachmentName: document.getElementById('export-attachment')?.files[0]?.name || null
    };
    state.data.transactions.unshift(transaction);
    addLog('Xuất kho', `${mat.name} - SL: ${qty.toLocaleString('vi-VN')} ${mat.unit} - Công trình: ${project?.name} - Thành tiền: ${formatMoneyVND(totalAmount)} - Thời gian: ${formatDateTime(transactionDateTime)}`);
    
    saveState();
    closeModal();
    currentExportAttachmentBase64 = null;
    if (window.render) window.render();
    alert('✅ Xuất kho thành công!');
}

// ========== TRẢ HÀNG TỪ CÔNG TRÌNH VỀ KHO ==========
export function openReturnModal(preselectedProjectId = null) {
    if (!hasPermission('canImport')) { alert('Bạn không có quyền nhập kho'); return; }
    if (state.data.projects.length === 0) return alert('Chưa có công trình nào');
    
    const projectsWithUsage = state.data.projects.filter(p => {
        const usage = state.data.transactions.some(t => t.projectId === p.id && t.type === 'usage');
        return usage;
    });
    
    if (projectsWithUsage.length === 0) {
        alert('Chưa có công trình nào được xuất kho để trả hàng');
        return;
    }
    
    const optsProj = projectsWithUsage.map(p => {
        const totalUsed = state.data.transactions
            .filter(t => t.projectId === p.id && t.type === 'usage')
            .reduce((s, t) => s + (t.totalAmount || 0), 0);
        const totalReturn = state.data.transactions
            .filter(t => t.projectId === p.id && t.type === 'return')
            .reduce((s, t) => s + (t.totalAmount || 0), 0);
        const netUsed = totalUsed - totalReturn;
        return `<option value="${p.id}" ${preselectedProjectId === p.id ? 'selected' : ''}>${escapeHtml(p.name)} (Đã xuất: ${formatMoneyVND(totalUsed)} - Đã trả: ${formatMoneyVND(totalReturn)} - Thực tế: ${formatMoneyVND(netUsed)})</option>`;
    }).join('');
    
    const currentDateTime = getCurrentDateTime();
    
    showModal(`<div class="modal-hd" style="background: var(--success-bg);"><span class="modal-title">🔄 Trả hàng từ công trình về kho</span><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-bd">
            <div class="metric-card" style="margin-bottom: 16px; background: var(--success-bg);">
                <div class="metric-sub">📋 Chọn công trình đã xuất kho để nhập lại vật tư thừa</div>
                <div class="metric-sub" style="margin-top: 8px; color: var(--warn-text);">⚠️ Chỉ hiển thị vật tư đã từng xuất cho công trình này</div>
            </div>
            <div class="form-grid2">
                <div class="form-group"><label class="form-label">📅 Thời gian trả</label><input type="datetime-local" id="return-datetime" value="${currentDateTime}" style="width: 100%;"></div>
                <div class="form-group"><label class="form-label">🏗️ Công trình trả hàng</label><select id="return-project">${optsProj}</select></div>
                <div class="form-group"><label class="form-label">📦 Vật tư trả lại</label><select id="return-mid"></select></div>
                <div class="form-group"><label class="form-label">🔢 Số lượng trả</label><input type="text" id="return-qty" value="1" style="text-align: right;"></div>
                <div class="form-group"><label class="form-label">💰 Đơn giá trả (VNĐ)</label><input type="text" id="return-price" readonly style="background: var(--surface3);" placeholder="Tự động lấy giá lúc xuất"></div>
            </div>
            <div class="metric-card" style="margin-top:8px">
                <div class="metric-sub">💰 Thành tiền dự kiến: <strong id="preview-return-total">0 ₫</strong></div>
                <div class="metric-sub" style="margin-top:4px">📌 Lưu ý: Hàng trả lại sẽ được cộng vào tồn kho và trừ chi phí công trình</div>
            </div>
            <div class="form-group"><label class="form-label">📎 Tệp đính kèm (biên bản trả hàng)</label><input type="file" id="return-attachment" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"></div>
            <div id="return-attachment-preview"></div>
            <div class="form-group"><label class="form-label">📝 Ghi chú lý do trả</label><input id="return-note" placeholder="VD: Vật tư thừa sau khi hoàn thành công trình, hư hỏng,..."></div>
        </div>
        <div class="modal-ft"><button onclick="closeModal()">Hủy</button><button class="primary" style="background: var(--success);" onclick="window.saveReturn()">Xác nhận trả hàng</button></div>`);
    
    setTimeout(() => {
        const projectSelect = document.getElementById('return-project');
        const midSelect = document.getElementById('return-mid');
        const qtyInput = document.getElementById('return-qty');
        const priceInput = document.getElementById('return-price');
        const attachmentInput = document.getElementById('return-attachment');
        
        function updateMaterialListByProject() {
            const projectId = projectSelect?.value;
            if (!projectId) return;
            
            const projectTransactions = state.data.transactions.filter(t => 
                t.projectId === projectId && t.type === 'usage'
            );
            
            const returnTransactions = state.data.transactions.filter(t => 
                t.projectId === projectId && t.type === 'return'
            );
            
            const materialMap = new Map();
            projectTransactions.forEach(t => {
                const mat = state.data.materials.find(m => m.id === t.mid);
                if (mat) {
                    if (!materialMap.has(t.mid)) {
                        materialMap.set(t.mid, {
                            id: t.mid,
                            name: mat.name,
                            unit: mat.unit,
                            totalExported: 0,
                            totalReturned: 0,
                            lastUnitPrice: t.unitPrice,
                            lastTransactionDate: t.datetime || t.date
                        });
                    }
                    const item = materialMap.get(t.mid);
                    item.totalExported += t.qty;
                    if (new Date(t.datetime || t.date) > new Date(item.lastTransactionDate)) {
                        item.lastUnitPrice = t.unitPrice;
                        item.lastTransactionDate = t.datetime || t.date;
                    }
                }
            });
            
            returnTransactions.forEach(t => {
                if (materialMap.has(t.mid)) {
                    materialMap.get(t.mid).totalReturned += t.qty;
                }
            });
            
            const materials = Array.from(materialMap.values())
                .filter(m => m.totalExported - m.totalReturned > 0);
            
            if (materials.length === 0) {
                midSelect.innerHTML = '<option value="">⚠️ Chưa có vật tư nào có thể trả cho công trình này</option>';
                return;
            }
            
            midSelect.innerHTML = materials.map(m => 
                `<option value="${m.id}" data-unit-price="${m.lastUnitPrice}" data-max-qty="${m.totalExported - m.totalReturned}">
                    ${escapeHtml(m.name)} (Đã xuất: ${m.totalExported.toLocaleString('vi-VN')} ${m.unit} - Đã trả: ${m.totalReturned.toLocaleString('vi-VN')} - Có thể trả: ${(m.totalExported - m.totalReturned).toLocaleString('vi-VN')} - Giá xuất: ${formatMoneyVND(m.lastUnitPrice)})
                </option>`
            ).join('');
            
            if (midSelect.onchange) midSelect.onchange();
            else updateReturnPreview();
        }
        
        function updateReturnPreview() {
            const selectedOption = midSelect?.options[midSelect.selectedIndex];
            const qty = getNumberFromInput(qtyInput);
            let unitPrice = 0;
            let maxQty = 0;
            
            if (selectedOption && selectedOption.value) {
                unitPrice = parseFloat(selectedOption.dataset.unitPrice) || 0;
                maxQty = parseFloat(selectedOption.dataset.maxQty) || 0;
                if (priceInput) priceInput.value = unitPrice.toLocaleString('vi-VN');
            }
            
            const total = unitPrice * qty;
            const previewEl = document.getElementById('preview-return-total');
            if (previewEl) previewEl.innerText = formatMoneyVND(total);
            
            if (qty > maxQty && maxQty > 0) {
                if (qtyInput) {
                    qtyInput.style.borderColor = 'var(--danger)';
                    let warningMsg = document.getElementById('return-qty-warning');
                    if (!warningMsg) {
                        warningMsg = document.createElement('div');
                        warningMsg.id = 'return-qty-warning';
                        warningMsg.className = 'metric-sub';
                        warningMsg.style.color = 'var(--danger-text)';
                        qtyInput.parentNode.appendChild(warningMsg);
                    }
                    warningMsg.innerText = `⚠️ Số lượng trả (${qty.toLocaleString('vi-VN')}) vượt quá số có thể trả (${maxQty.toLocaleString('vi-VN')})`;
                }
            } else {
                if (qtyInput) qtyInput.style.borderColor = '';
                const warningMsg = document.getElementById('return-qty-warning');
                if (warningMsg) warningMsg.remove();
            }
        }
        
        if (projectSelect) {
            projectSelect.addEventListener('change', () => {
                updateMaterialListByProject();
                if (qtyInput) qtyInput.value = '1';
                updateReturnPreview();
            });
        }
        
        if (midSelect) {
            midSelect.addEventListener('change', updateReturnPreview);
        }
        
        if (qtyInput) {
            setupNumberInput(qtyInput, { isInteger: false, decimals: null });
            qtyInput.addEventListener('input', updateReturnPreview);
            qtyInput.addEventListener('change', updateReturnPreview);
        }
        
        if (attachmentInput) {
            attachmentInput.addEventListener('change', function() {
                const file = this.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = function(e) {
                    currentReturnAttachmentBase64 = e.target.result;
                    const previewDiv = document.getElementById('return-attachment-preview');
                    const fileSize = (file.size / 1024).toFixed(2);
                    if (previewDiv) {
                        if (file.type.startsWith('image/')) {
                            previewDiv.innerHTML = `<div class="metric-card" style="margin-top: 8px;">
                                <img src="${currentReturnAttachmentBase64}" class="invoice-img" style="max-height: 150px;" onclick="window.open(this.src)">
                                <div class="metric-sub">📄 ${file.name} (${fileSize} KB)</div>
                                <button class="sm" onclick="window.clearReturnAttachment()">🗑️ Xóa tệp</button>
                            </div>`;
                        } else {
                            previewDiv.innerHTML = `<div class="metric-card" style="margin-top: 8px;">
                                <div style="font-size: 32px; text-align: center;">📎</div>
                                <div class="metric-sub">📄 ${file.name} (${fileSize} KB)</div>
                                <button class="sm" onclick="window.clearReturnAttachment()">🗑️ Xóa tệp</button>
                            </div>`;
                        }
                    }
                };
                reader.readAsDataURL(file);
            });
        }
        
        updateMaterialListByProject();
        updateReturnPreview();
        
    }, 100);
}

export function saveReturn() {
    const projectId = document.getElementById('return-project')?.value;
    const mid = document.getElementById('return-mid')?.value;
    const datetimeInput = document.getElementById('return-datetime');
    const transactionDateTime = datetimeInput ? datetimeInput.value : getCurrentDateTime();
    
    const qty = getNumberFromInput(document.getElementById('return-qty'));
    const unitPrice = getNumberFromInput(document.getElementById('return-price'));
    const note = document.getElementById('return-note')?.value || '';
    
    if (!projectId) return alert('Chọn công trình trả hàng');
    if (!mid) return alert('Chọn vật tư trả lại');
    if (!qty || qty <= 0) return alert('Số lượng trả không hợp lệ');
    
    const mat = matById(mid);
    if (!mat) return alert('Không tìm thấy vật tư');
    
    const projectTransactions = state.data.transactions.filter(t => 
        t.projectId === projectId && t.type === 'usage' && t.mid === mid
    );
    
    const returnTransactions = state.data.transactions.filter(t => 
        t.projectId === projectId && t.type === 'return' && t.mid === mid
    );
    
    const totalExported = projectTransactions.reduce((sum, t) => sum + t.qty, 0);
    const totalReturned = returnTransactions.reduce((sum, t) => sum + t.qty, 0);
    const availableToReturn = totalExported - totalReturned;
    
    if (totalExported === 0) {
        return alert(`Vật tư "${mat.name}" chưa từng được xuất cho công trình này!`);
    }
    
    if (qty > availableToReturn) {
        return alert(`Số lượng trả (${qty.toLocaleString('vi-VN')} ${mat.unit}) vượt quá số có thể trả (${availableToReturn.toLocaleString('vi-VN')} ${mat.unit})`);
    }
    
    if (!unitPrice || unitPrice <= 0) {
        return alert('Không thể xác định đơn giá. Vui lòng chọn lại vật tư.');
    }
    
    const totalAmount = qty * unitPrice;
    
    // 1. Cộng lại số lượng vào kho
    mat.qty += qty;
    
    // 2. Cập nhật lại chi phí công trình (trừ đi giá trị hàng trả)
    const project = projectById(projectId);
    if (project) {
        const oldSpent = project.spent || 0;
        const newSpent = Math.max(0, oldSpent - totalAmount);
        project.spent = newSpent;
    }
    
    // 3. Tạo giao dịch trả hàng
    const transaction = { 
        id: genTid(), 
        mid: mid, 
        projectId: projectId, 
        date: transactionDateTime.split('T')[0],
        datetime: transactionDateTime,
        type: 'return',
        qty: qty, 
        unitPrice: unitPrice, 
        totalAmount: totalAmount, 
        note: note || 'Trả hàng từ công trình',
        attachment: currentReturnAttachmentBase64 || null,
        attachmentName: document.getElementById('return-attachment')?.files[0]?.name || null
    };
    state.data.transactions.unshift(transaction);
    
    addLog('Trả hàng về kho', `${mat.name} - SL: ${qty.toLocaleString('vi-VN')} ${mat.unit} - Công trình: ${project?.name} - Giá trị trừ: ${formatMoneyVND(totalAmount)} - Thời gian: ${formatDateTime(transactionDateTime)} - Lý do: ${note || 'Hàng thừa'}`);
    
    saveState();
    closeModal();
    currentReturnAttachmentBase64 = null;
    
    if (window.render) window.render();
    
    alert(`✅ Đã nhập lại kho từ công trình thành công!\n📦 Vật tư: ${mat.name}\n📊 Số lượng: ${qty.toLocaleString('vi-VN')} ${mat.unit}\n💰 Giá trị trừ khỏi công trình: ${formatMoneyVND(totalAmount)}`);
}

// ========== CÁC HÀM CLEAR ATTACHMENT ==========
export function clearExportAttachment() {
    currentExportAttachmentBase64 = null;
    const previewDiv = document.getElementById('export-attachment-preview');
    if (previewDiv) previewDiv.innerHTML = '';
    const fileInput = document.getElementById('export-attachment');
    if (fileInput) fileInput.value = '';
}

export function clearReturnAttachment() {
    currentReturnAttachmentBase64 = null;
    const previewDiv = document.getElementById('return-attachment-preview');
    if (previewDiv) previewDiv.innerHTML = '';
    const fileInput = document.getElementById('return-attachment');
    if (fileInput) fileInput.value = '';
}

export function clearInvoiceImage() {
    currentInvoiceBase64 = null;
    const previewDiv = document.getElementById('invoice-preview');
    if (previewDiv) previewDiv.innerHTML = '';
    const fileInput = document.getElementById('purchase-invoice');
    if (fileInput) fileInput.value = '';
}

export const importMaterial = savePurchase;
export const exportMaterial = saveExport;
export const getTransactions = () => state.data.transactions;