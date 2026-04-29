import { state, saveState, addLog, showModal, closeModal, genTid, matById, projectById, supplierById, hasPermission, escapeHtml } from './state.js';
import { getNumberFromInput, formatMoneyVND, setupNumberInput } from './utils.js';

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

function calculatePurchaseTotal() {
    const qty = getNumberFromInput(document.getElementById('purchase-qty'));
    const price = getNumberFromInput(document.getElementById('purchase-price'));
    const vatRate = getNumberFromInput(document.getElementById('purchase-vat'));
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

function calculateExportTotal() {
    const mid = document.getElementById('txn-mid')?.value;
    const mat = matById(mid);
    const qty = getNumberFromInput(document.getElementById('txn-qty'));
    const total = (mat?.cost || 0) * qty;
    const previewEl = document.getElementById('preview-export-total');
    if (previewEl) previewEl.innerText = formatMoneyVND(total);
}

// ========== NHẬP KHO ==========
export function openPurchaseModal() {
    if (!hasPermission('canImport')) { alert('Bạn không có quyền nhập kho'); return; }
    if (state.data.materials.length === 0) return alert('Chưa có vật tư trong kho');
    if (state.data.suppliers.length === 0) return alert('Chưa có nhà cung cấp');

    const optsMat = state.data.materials.map(m => `<option value="${m.id}">${escapeHtml(m.name)} (Tồn: ${m.qty.toLocaleString('vi-VN')} ${m.unit})</option>`).join('');
    const optsSup = state.data.suppliers.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
    const currentDateTime = getCurrentDateTime();

    const html = `
        <div class="modal-hd"><span class="modal-title">📥 Nhập kho (Có VAT & Hóa đơn)</span><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-bd">
            <div class="form-grid2">
                <div class="form-group"><label class="form-label">📅 Thời gian nhập</label><input type="datetime-local" id="purchase-datetime" value="${currentDateTime}" style="width: 100%;"></div>
                <div class="form-group"><label class="form-label">🏭 Nhà cung cấp</label><select id="purchase-supplier">${optsSup}</select></div>
                <div class="form-group"><label class="form-label">📦 Vật tư</label><select id="purchase-mid">${optsMat}</select></div>
                <div class="form-group"><label class="form-label">🔢 Số lượng</label><input type="text" id="purchase-qty" value="1" class="num-input" dir="ltr"></div>
                <div class="form-group"><label class="form-label">💰 Đơn giá nhập (VNĐ)</label><input type="text" id="purchase-price" placeholder="Nhập giá thực tế" class="num-input" dir="ltr"></div>
                <div class="form-group"><label class="form-label">🧾 Thuế VAT (%)</label><input type="text" id="purchase-vat" value="10" class="num-input" dir="ltr"></div>
            </div>
            <div class="metric-card" style="margin-bottom:12px">
                <div class="metric-sub">💰 Thành tiền trước VAT: <strong id="preview-subtotal">0 ₫</strong></div>
                <div class="metric-sub">🧾 Tiền VAT: <strong id="preview-vat">0 ₫</strong></div>
                <div class="metric-val" style="font-size:18px">💵 Tổng thanh toán: <strong id="preview-total">0 ₫</strong></div>
            </div>
            <div class="form-group"><label class="form-label">📎 Ảnh hóa đơn (tùy chọn)</label><input type="file" id="purchase-invoice" accept="image/*"></div>
            <div id="invoice-preview"></div>
            <div class="form-group"><label class="form-label">📝 Ghi chú</label><input type="text" id="purchase-note" placeholder="Mã hóa đơn, số chứng từ..."></div>
        </div>
        <div class="modal-ft"><button onclick="closeModal()">Hủy</button><button class="primary" onclick="window.savePurchase()">Xác nhận nhập kho</button></div>`;

    showModal(html, null);

    setTimeout(() => {
        const qtyInput = document.getElementById('purchase-qty');
        const priceInput = document.getElementById('purchase-price');
        const vatInput = document.getElementById('purchase-vat');
        const midSelect = document.getElementById('purchase-mid');
        const fileInput = document.getElementById('purchase-invoice');

        if (qtyInput) {
            setupNumberInput(qtyInput, { isInteger: false, decimals: 3 });
            qtyInput.addEventListener('change', calculatePurchaseTotal);
        }
        if (priceInput) {
            setupNumberInput(priceInput, { isInteger: false, decimals: 2 });
            priceInput.addEventListener('change', calculatePurchaseTotal);
        }
        if (vatInput) {
            setupNumberInput(vatInput, { isInteger: false, decimals: 1 });
            vatInput.addEventListener('change', calculatePurchaseTotal);
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
            if (mat && priceInput && (!priceInput.value || priceInput.value === '0')) {
                priceInput.value = mat.cost.toLocaleString('vi-VN');
            }
            calculatePurchaseTotal();
        };
        if (midSelect) { midSelect.addEventListener('change', updateDefaultPrice); updateDefaultPrice(); }
        calculatePurchaseTotal();
    }, 150);
}

export function openPurchaseModalWithSupplier(supplierId) {
    if (!hasPermission('canImport')) { alert('Bạn không có quyền nhập kho'); return; }
    if (state.data.materials.length === 0) return alert('Chưa có vật tư trong kho');
    const supplier = supplierById(supplierId);
    if (!supplier) return alert('Không tìm thấy nhà cung cấp');

    const optsMat = state.data.materials.map(m => `<option value="${m.id}">${escapeHtml(m.name)} (Tồn: ${m.qty.toLocaleString('vi-VN')} ${m.unit})</option>`).join('');
    const currentDateTime = getCurrentDateTime();

    const html = `
        <div class="modal-hd"><span class="modal-title">📥 Nhập kho từ ${escapeHtml(supplier.name)}</span><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-bd">
            <div class="form-grid2">
                <div class="form-group"><label class="form-label">📅 Thời gian nhập</label><input type="datetime-local" id="purchase-datetime" value="${currentDateTime}" style="width: 100%;"></div>
                <div class="form-group"><label class="form-label">🏭 Nhà cung cấp</label><input type="text" value="${escapeHtml(supplier.name)}" disabled style="background: var(--surface3);"></div>
                <div class="form-group"><label class="form-label">📦 Vật tư</label><select id="purchase-mid">${optsMat}</select></div>
                <div class="form-group"><label class="form-label">🔢 Số lượng</label><input type="text" id="purchase-qty" value="1" class="num-input" dir="ltr"></div>
                <div class="form-group"><label class="form-label">💰 Đơn giá nhập (VNĐ)</label><input type="text" id="purchase-price" placeholder="Nhập giá thực tế" class="num-input" dir="ltr"></div>
                <div class="form-group"><label class="form-label">🧾 Thuế VAT (%)</label><input type="text" id="purchase-vat" value="10" class="num-input" dir="ltr"></div>
            </div>
            <div class="metric-card" style="margin-bottom:12px">
                <div class="metric-sub">💰 Thành tiền trước VAT: <strong id="preview-subtotal">0 ₫</strong></div>
                <div class="metric-sub">🧾 Tiền VAT: <strong id="preview-vat">0 ₫</strong></div>
                <div class="metric-val" style="font-size:18px">💵 Tổng thanh toán: <strong id="preview-total">0 ₫</strong></div>
            </div>
            <div class="form-group"><label class="form-label">📎 Ảnh hóa đơn (tùy chọn)</label><input type="file" id="purchase-invoice" accept="image/*"></div>
            <div id="invoice-preview"></div>
            <div class="form-group"><label class="form-label">📝 Ghi chú</label><input type="text" id="purchase-note" placeholder="Mã hóa đơn, số chứng từ..."></div>
        </div>
        <div class="modal-ft"><button onclick="closeModal()">Hủy</button><button class="primary" onclick="window.savePurchaseWithSupplier('${supplierId}')">Xác nhận nhập kho</button></div>`;

    showModal(html, null);

    setTimeout(() => {
        const qtyInput = document.getElementById('purchase-qty');
        const priceInput = document.getElementById('purchase-price');
        const vatInput = document.getElementById('purchase-vat');
        const midSelect = document.getElementById('purchase-mid');
        const fileInput = document.getElementById('purchase-invoice');

        if (qtyInput) {
            setupNumberInput(qtyInput, { isInteger: false, decimals: 3 });
            qtyInput.addEventListener('change', calculatePurchaseTotal);
        }
        if (priceInput) {
            setupNumberInput(priceInput, { isInteger: false, decimals: 2 });
            priceInput.addEventListener('change', calculatePurchaseTotal);
        }
        if (vatInput) {
            setupNumberInput(vatInput, { isInteger: false, decimals: 1 });
            vatInput.addEventListener('change', calculatePurchaseTotal);
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
            if (mat && priceInput && (!priceInput.value || priceInput.value === '0')) {
                priceInput.value = mat.cost.toLocaleString('vi-VN');
            }
            calculatePurchaseTotal();
        };
        if (midSelect) { midSelect.addEventListener('change', updateDefaultPrice); updateDefaultPrice(); }
        calculatePurchaseTotal();
    }, 150);
}

export function savePurchase() {
    const supplierId = document.getElementById('purchase-supplier')?.value;
    const mid = document.getElementById('purchase-mid')?.value;
    const datetimeInput = document.getElementById('purchase-datetime');
    const transactionDateTime = datetimeInput ? datetimeInput.value : getCurrentDateTime();

    const qty = getNumberFromInput(document.getElementById('purchase-qty'));
    const unitPrice = getNumberFromInput(document.getElementById('purchase-price'));
    const vatRate = getNumberFromInput(document.getElementById('purchase-vat'));
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
    if (mat.qty > 0) mat.cost = Math.round((oldValue + totalAmount) / mat.qty);

    const transaction = {
        id: genTid(), mid: mid, supplierId: supplierId,
        date: transactionDateTime.split('T')[0], datetime: transactionDateTime,
        type: 'purchase', qty: qty, unitPrice: unitPrice, vatRate: vatRate,
        subtotal: subtotal, vatAmount: vatAmount, totalAmount: totalAmount,
        note: note, invoiceImage: currentInvoiceBase64 || null
    };
    state.data.transactions.unshift(transaction);

    const supplier = supplierById(supplierId);
    addLog('Nhập kho', `${mat.name} - SL: ${qty.toLocaleString('vi-VN')} ${mat.unit} - Giá: ${formatMoneyVND(unitPrice)} - VAT: ${vatRate}% - Tổng: ${formatMoneyVND(totalAmount)} - NCC: ${supplier?.name}`);
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
    const vatRate = getNumberFromInput(document.getElementById('purchase-vat'));
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
    if (mat.qty > 0) mat.cost = Math.round((oldValue + totalAmount) / mat.qty);

    const transaction = {
        id: genTid(), mid: mid, supplierId: supplierId,
        date: transactionDateTime.split('T')[0], datetime: transactionDateTime,
        type: 'purchase', qty: qty, unitPrice: unitPrice, vatRate: vatRate,
        subtotal: subtotal, vatAmount: vatAmount, totalAmount: totalAmount,
        note: note, invoiceImage: currentInvoiceBase64 || null
    };
    state.data.transactions.unshift(transaction);

    const supplier = supplierById(supplierId);
    addLog('Nhập kho', `${mat.name} - SL: ${qty.toLocaleString('vi-VN')} ${mat.unit} - Tổng: ${formatMoneyVND(totalAmount)} - NCC: ${supplier?.name}`);
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

    const optsMat = state.data.materials.map(m => `<option value="${m.id}">${escapeHtml(m.name)} (Tồn: ${m.qty.toLocaleString('vi-VN')} ${m.unit})</option>`).join('');
    const optsProj = state.data.projects.map(p => `<option value="${p.id}" ${preselectedProjectId === p.id ? 'selected' : ''}>${escapeHtml(p.name)} (Ngân sách: ${formatMoneyVND(p.budget)})</option>`).join('');
    const currentDateTime = getCurrentDateTime();

    const html = `
        <div class="modal-hd"><span class="modal-title">📤 Xuất kho cho công trình</span><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-bd">
            <div class="form-grid2">
                <div class="form-group"><label class="form-label">📅 Thời gian xuất</label><input type="datetime-local" id="export-datetime" value="${currentDateTime}" style="width: 100%;"></div>
                <div class="form-group"><label class="form-label">🏗️ Công trình thi công</label><select id="txn-project">${optsProj}</select></div>
                <div class="form-group"><label class="form-label">📦 Vật tư</label><select id="txn-mid">${optsMat}</select></div>
                <div class="form-group"><label class="form-label">🔢 Số lượng</label><input type="text" id="txn-qty" value="1" class="num-input" dir="ltr"></div>
            </div>
            <div class="metric-card" style="margin-top:8px"><div class="metric-sub">💰 Thành tiền dự kiến: <strong id="preview-export-total">0 ₫</strong></div></div>
            <div class="form-group"><label class="form-label">📎 Tệp đính kèm</label><input type="file" id="export-attachment" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"></div>
            <div id="export-attachment-preview"></div>
            <div class="form-group"><label class="form-label">📝 Ghi chú</label><input type="text" id="txn-note" placeholder="Mô tả thêm..."></div>
        </div>
        <div class="modal-ft"><button onclick="closeModal()">Hủy</button><button class="primary" onclick="window.saveExport()">Xác nhận xuất kho</button></div>`;

    showModal(html, null);

    setTimeout(() => {
        const qtyInput = document.getElementById('txn-qty');
        const midSelect = document.getElementById('txn-mid');
        const attachmentInput = document.getElementById('export-attachment');

        if (qtyInput) {
            setupNumberInput(qtyInput, { isInteger: false, decimals: 3 });
            qtyInput.addEventListener('change', calculateExportTotal);
        }
        if (attachmentInput) {
            attachmentInput.addEventListener('change', function() {
                const file = this.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = function(e) {
                    currentExportAttachmentBase64 = e.target.result;
                    const previewDiv = document.getElementById('export-attachment-preview');
                    if (previewDiv) {
                        if (file.type.startsWith('image/')) {
                            previewDiv.innerHTML = `<div class="metric-card" style="margin-top:8px;"><img src="${currentExportAttachmentBase64}" class="invoice-img" style="max-height:150px;"><div class="metric-sub">📄 ${file.name}</div><button class="sm" onclick="window.clearExportAttachment()">🗑️</button></div>`;
                        } else {
                            previewDiv.innerHTML = `<div class="metric-card" style="margin-top:8px;"><div style="font-size:32px;text-align:center;">📎</div><div class="metric-sub">📄 ${file.name}</div><button class="sm" onclick="window.clearExportAttachment()">🗑️</button></div>`;
                        }
                    }
                };
                reader.readAsDataURL(file);
            });
        }
        if (midSelect) midSelect.addEventListener('change', calculateExportTotal);
        calculateExportTotal();
    }, 150);
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
    if (mat.qty < qty) return alert(`Không đủ tồn kho! Còn ${mat.qty.toLocaleString('vi-VN')} ${mat.unit}`);

    const totalAmount = qty * mat.cost;
    mat.qty -= qty;

    const project = projectById(projectId);
    if (project) project.spent = (project.spent || 0) + totalAmount;

    const transaction = {
        id: genTid(), mid: mid, projectId: projectId,
        date: transactionDateTime.split('T')[0], datetime: transactionDateTime,
        type: 'usage', qty: qty, unitPrice: mat.cost, totalAmount: totalAmount,
        note: note, attachment: currentExportAttachmentBase64 || null
    };
    state.data.transactions.unshift(transaction);
    addLog('Xuất kho', `${mat.name} - SL: ${qty.toLocaleString('vi-VN')} ${mat.unit} - Công trình: ${project?.name} - ${formatMoneyVND(totalAmount)}`);

    saveState(); closeModal();
    currentExportAttachmentBase64 = null;
    if (window.render) window.render();
    alert('✅ Xuất kho thành công!');
}

// ========== TRẢ HÀNG ==========
export function openReturnModal(preselectedProjectId = null) {
    if (!hasPermission('canImport')) { alert('Bạn không có quyền'); return; }
    if (state.data.projects.length === 0) return alert('Chưa có công trình nào');

    const projectsWithUsage = state.data.projects.filter(p =>
        state.data.transactions.some(t => t.projectId === p.id && t.type === 'usage')
    );
    if (projectsWithUsage.length === 0) return alert('Chưa có công trình nào được xuất kho');

    const optsProj = projectsWithUsage.map(p => {
        const uTotal = state.data.transactions.filter(t => t.projectId === p.id && t.type === 'usage').reduce((s, t) => s + (t.totalAmount || 0), 0);
        const rTotal = state.data.transactions.filter(t => t.projectId === p.id && t.type === 'return').reduce((s, t) => s + (t.totalAmount || 0), 0);
        return `<option value="${p.id}" ${preselectedProjectId === p.id ? 'selected' : ''}>${escapeHtml(p.name)} (Thực tế: ${formatMoneyVND(uTotal - rTotal)})</option>`;
    }).join('');

    const html = `
        <div class="modal-hd" style="background:var(--success-bg);"><span class="modal-title">🔄 Trả hàng từ công trình</span><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-bd">
            <div class="form-grid2">
                <div class="form-group"><label class="form-label">📅 Thời gian</label><input type="datetime-local" id="return-datetime" value="${getCurrentDateTime()}"></div>
                <div class="form-group"><label class="form-label">🏗️ Công trình</label><select id="return-project">${optsProj}</select></div>
                <div class="form-group"><label class="form-label">📦 Vật tư</label><select id="return-mid"></select></div>
                <div class="form-group"><label class="form-label">🔢 Số lượng</label><input type="text" id="return-qty" value="1" class="num-input" dir="ltr"></div>
                <div class="form-group"><label class="form-label">💰 Đơn giá (VNĐ)</label><input type="text" id="return-price" readonly style="background:var(--surface3);" class="num-input" dir="ltr"></div>
            </div>
            <div class="metric-card"><div class="metric-sub">💰 Thành tiền: <strong id="preview-return-total">0 ₫</strong></div></div>
            <div class="form-group"><label class="form-label">📎 Tệp đính kèm</label><input type="file" id="return-attachment"></div>
            <div id="return-attachment-preview"></div>
            <div class="form-group"><label class="form-label">📝 Ghi chú</label><input type="text" id="return-note"></div>
        </div>
        <div class="modal-ft"><button onclick="closeModal()">Hủy</button><button class="primary" style="background:var(--success);" onclick="window.saveReturn()">Xác nhận</button></div>`;

    showModal(html, null);

    setTimeout(() => {
        const projectSelect = document.getElementById('return-project');
        const midSelect = document.getElementById('return-mid');
        const qtyInput = document.getElementById('return-qty');
        const priceInput = document.getElementById('return-price');
        const attachmentInput = document.getElementById('return-attachment');

        if (qtyInput) {
            setupNumberInput(qtyInput, { isInteger: false, decimals: 3 });
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
                    if (previewDiv) previewDiv.innerHTML = `<div class="metric-card" style="margin-top:8px;">📄 ${file.name} <button class="sm" onclick="window.clearReturnAttachment()">🗑️</button></div>`;
                };
                reader.readAsDataURL(file);
            });
        }

        function updateMaterialListByProject() {
            const pid = projectSelect?.value;
            if (!pid || !midSelect) return;
            const uTxns = state.data.transactions.filter(t => t.projectId === pid && t.type === 'usage');
            const rTxns = state.data.transactions.filter(t => t.projectId === pid && t.type === 'return');
            const map = new Map();
            uTxns.forEach(t => {
                const mat = state.data.materials.find(m => m.id === t.mid);
                if (mat) {
                    if (!map.has(t.mid)) map.set(t.mid, { id: t.mid, name: mat.name, unit: mat.unit, totalReceived: 0, totalReturned: 0, lastUnitPrice: t.unitPrice });
                    map.get(t.mid).totalReceived += t.qty;
                }
            });
            rTxns.forEach(t => { if (map.has(t.mid)) map.get(t.mid).totalReturned += t.qty; });
            const list = Array.from(map.values()).map(i => ({ ...i, avail: i.totalReceived - i.totalReturned })).filter(i => i.avail > 0);
            if (list.length === 0) { midSelect.innerHTML = '<option value="">✅ Hết</option>'; return; }
            midSelect.innerHTML = list.map(m => `<option value="${m.id}" data-up="${m.lastUnitPrice}">${escapeHtml(m.name)} (Có thể trả: ${m.avail.toLocaleString('vi-VN')} ${m.unit})</option>`).join('');
            updateReturnPreview();
        }

        function updateReturnPreview() {
            const opt = midSelect?.options[midSelect.selectedIndex];
            const qty = getNumberFromInput(qtyInput);
            let up = 0;
            if (opt?.value) { up = parseFloat(opt.dataset.up) || 0; if (priceInput) priceInput.value = up.toLocaleString('vi-VN'); }
            document.getElementById('preview-return-total').innerText = formatMoneyVND(up * qty);
        }

        if (projectSelect) projectSelect.addEventListener('change', () => { updateMaterialListByProject(); if (qtyInput) qtyInput.value = '1'; });
        if (midSelect) midSelect.addEventListener('change', updateReturnPreview);
        updateMaterialListByProject();
    }, 150);
}

export function saveReturn() {
    const projectId = document.getElementById('return-project')?.value;
    const mid = document.getElementById('return-mid')?.value;
    const dt = document.getElementById('return-datetime')?.value || getCurrentDateTime();
    const qty = getNumberFromInput(document.getElementById('return-qty'));
    const unitPrice = getNumberFromInput(document.getElementById('return-price'));
    const note = document.getElementById('return-note')?.value || '';

    if (!projectId || !mid || !qty || qty <= 0 || !unitPrice) return alert('Thiếu thông tin');

    const mat = matById(mid);
    if (!mat) return alert('Không tìm thấy vật tư');

    const totalAmount = qty * unitPrice;
    mat.qty += qty;
    const project = projectById(projectId);
    if (project) project.spent = Math.max(0, (project.spent || 0) - totalAmount);

    state.data.transactions.unshift({
        id: genTid(), mid, projectId, date: dt.split('T')[0], datetime: dt,
        type: 'return', qty, unitPrice, totalAmount, note: note || 'Trả hàng',
        attachment: currentReturnAttachmentBase64 || null
    });
    addLog('Trả hàng', `${mat.name} - SL: ${qty.toLocaleString('vi-VN')} ${mat.unit} - ${formatMoneyVND(totalAmount)}`);
    saveState(); closeModal(); currentReturnAttachmentBase64 = null;
    if (window.render) window.render();
    alert('✅ Đã nhập lại kho!');
}

export function clearExportAttachment() {
    currentExportAttachmentBase64 = null;
    const el = document.getElementById('export-attachment-preview'); if (el) el.innerHTML = '';
    const fi = document.getElementById('export-attachment'); if (fi) fi.value = '';
}
export function clearReturnAttachment() {
    currentReturnAttachmentBase64 = null;
    const el = document.getElementById('return-attachment-preview'); if (el) el.innerHTML = '';
    const fi = document.getElementById('return-attachment'); if (fi) fi.value = '';
}
export function clearInvoiceImage() {
    currentInvoiceBase64 = null;
    const el = document.getElementById('invoice-preview'); if (el) el.innerHTML = '';
    const fi = document.getElementById('purchase-invoice'); if (fi) fi.value = '';
}

export { calculatePurchaseTotal, calculateExportTotal };
export const importMaterial = savePurchase;
export const exportMaterial = saveExport;
export const getTransactions = () => state.data.transactions;