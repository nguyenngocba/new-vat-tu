import { state, saveState, addLog, formatMoney, escapeHtml, showModal, closeModal } from './state.js';
import { formatMoneyVND } from './utils.js';

let currentMobileTab = 'import';

// ========== RENDER GIAO DIỆN MOBILE ==========
export function renderMobileView() {
    return `
        <div class="mobile-app">
            <!-- Header -->
            <div class="mobile-header">
                <div class="mobile-header-title">
                    <img src="/images/logo.png" alt="TRIVIET STEEL" style="height: 32px;">
                    <span>TRIVIET STEEL</span>
                </div>
                <div class="mobile-header-user">
                    <span>👤 ${escapeHtml(state.currentUser?.name || 'User')}</span>
                </div>
            </div>
            
            <!-- Nội dung chính -->
            <div class="mobile-content">
                <div id="mobile-tab-content">
                    ${renderMobileTabContent()}
                </div>
            </div>
            
            <!-- Bottom Navigation -->
            <div class="mobile-bottom-nav">
                <div class="mobile-nav-item ${currentMobileTab === 'import' ? 'active' : ''}" data-tab="import">
                    <span>📥</span>
                    <span>Nhập kho</span>
                </div>
                <div class="mobile-nav-item ${currentMobileTab === 'export' ? 'active' : ''}" data-tab="export">
                    <span>📤</span>
                    <span>Xuất kho</span>
                </div>
                <div class="mobile-nav-item ${currentMobileTab === 'stock' ? 'active' : ''}" data-tab="stock">
                    <span>📦</span>
                    <span>Tồn kho</span>
                </div>
                <div class="mobile-nav-item ${currentMobileTab === 'project' ? 'active' : ''}" data-tab="project">
                    <span>🏗️</span>
                    <span>Công trình</span>
                </div>
            </div>
        </div>
    `;
}

function renderMobileTabContent() {
    if (currentMobileTab === 'import') {
        return renderImportTab();
    }
    if (currentMobileTab === 'export') {
        return renderExportTab();
    }
    if (currentMobileTab === 'stock') {
        return renderStockTab();
    }
    if (currentMobileTab === 'project') {
        return renderProjectTab();
    }
    return '<div class="mobile-card">Đang phát triển...</div>';
}

// ========== TAB NHẬP KHO ==========
function renderImportTab() {
    const suppliers = state.data.suppliers || [];
    const materials = state.data.materials || [];
    
    return `
        <div class="mobile-card">
            <div class="mobile-card-title">📥 NHẬP KHO</div>
            <div class="mobile-form-group">
                <label>Nhà cung cấp</label>
                <select id="mobile-supplier">
                    <option value="">-- Chọn nhà cung cấp --</option>
                    ${suppliers.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
                </select>
            </div>
            <div class="mobile-form-group">
                <label>Vật tư</label>
                <select id="mobile-material">
                    <option value="">-- Chọn vật tư --</option>
                    ${materials.map(m => `<option value="${m.id}" data-unit="${m.unit}">${escapeHtml(m.name)} (Tồn: ${Number(m.qty).toLocaleString('vi-VN')} ${m.unit})</option>`).join('')}
                </select>
            </div>
            <div class="mobile-form-group">
                <label>Số lượng</label>
                <input type="number" id="mobile-qty" placeholder="Nhập số lượng" step="any">
            </div>
            <div class="mobile-form-group">
                <label>Đơn giá (VNĐ)</label>
                <input type="number" id="mobile-price" placeholder="Nhập đơn giá">
            </div>
            <div class="mobile-form-group">
                <label>VAT (%)</label>
                <input type="number" id="mobile-vat" value="10" step="0.1">
            </div>
            <button class="mobile-btn primary" id="mobile-import-btn" style="width:100%;">✅ XÁC NHẬN NHẬP</button>
        </div>
        
        <div class="mobile-card">
            <div class="mobile-card-title">📋 NHẬP GẦN ĐÂY</div>
            <div id="mobile-recent-imports"></div>
        </div>
    `;
}

// ========== TAB XUẤT KHO ==========
function renderExportTab() {
    const materials = state.data.materials || [];
    const projects = state.data.projects || [];
    
    return `
        <div class="mobile-card">
            <div class="mobile-card-title">📤 XUẤT KHO</div>
            <div class="mobile-form-group">
                <label>Công trình</label>
                <select id="mobile-project">
                    <option value="">-- Chọn công trình --</option>
                    ${projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
                </select>
            </div>
            <div class="mobile-form-group">
                <label>Vật tư</label>
                <select id="mobile-export-material">
                    <option value="">-- Chọn vật tư --</option>
                    ${materials.map(m => `<option value="${m.id}" data-unit="${m.unit}" data-price="${m.cost}">${escapeHtml(m.name)} (Tồn: ${Number(m.qty).toLocaleString('vi-VN')} ${m.unit})</option>`).join('')}
                </select>
            </div>
            <div class="mobile-form-group">
                <label>Số lượng</label>
                <input type="number" id="mobile-export-qty" placeholder="Nhập số lượng sử dụng" step="any">
            </div>
            <div class="mobile-form-group">
                <label>Ghi chú</label>
                <input type="text" id="mobile-export-note" placeholder="Vị trí sử dụng...">
            </div>
            <button class="mobile-btn primary" id="mobile-export-btn" style="width:100%;">✅ XÁC NHẬN XUẤT</button>
        </div>
        
        <div class="mobile-card">
            <div class="mobile-card-title">📋 XUẤT GẦN ĐÂY</div>
            <div id="mobile-recent-exports"></div>
        </div>
    `;
}

// ========== TAB TỒN KHO ==========
function renderStockTab() {
    const materials = state.data.materials || [];
    const lowStock = materials.filter(m => m.qty <= m.low);
    
    return `
        <div class="mobile-card">
            <div class="mobile-card-title">⚠️ CẢNH BÁO TỒN THẤP</div>
            <div id="mobile-low-stock">
                ${lowStock.length === 0 ? '<div class="mobile-item">✅ Tất cả đều ổn</div>' : lowStock.map(m => `
                    <div class="mobile-item" onclick="window.showMaterialDetail('${m.id}')">
                        <div><strong>${escapeHtml(m.name)}</strong></div>
                        <div class="mobile-item-value" style="color:var(--danger-text);">Tồn: ${Number(m.qty).toLocaleString('vi-VN')} ${m.unit}</div>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="mobile-card">
            <div class="mobile-card-title">📦 DANH SÁCH VẬT TƯ</div>
            <div id="mobile-material-list">
                ${materials.slice(0, 20).map(m => `
                    <div class="mobile-item" onclick="window.showMaterialDetail('${m.id}')">
                        <div><strong>${escapeHtml(m.name)}</strong></div>
                        <div class="mobile-item-value">${Number(m.qty).toLocaleString('vi-VN')} ${m.unit}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// ========== TAB CÔNG TRÌNH ==========
function renderProjectTab() {
    const projects = state.data.projects || [];
    
    return `
        <div class="mobile-card">
            <div class="mobile-card-title">🏗️ DANH SÁCH CÔNG TRÌNH</div>
            <div id="mobile-project-list">
                ${projects.map(p => {
                    const spent = state.data.transactions.filter(t => t.projectId === p.id && t.type === 'usage').reduce((s,t) => s + (Number(t.totalAmount)||0), 0);
                    const pct = p.budget > 0 ? (spent/p.budget)*100 : 0;
                    return `
                        <div class="mobile-item" onclick="window.showProjectDetail('${p.id}')">
                            <div><strong>${escapeHtml(p.name)}</strong></div>
                            <div class="mobile-item-value">💰 ${formatMoneyVND(spent)}</div>
                            <div class="progress-bar" style="margin-top:4px;"><div class="progress-fill" style="width:${Math.min(100,pct)}%;"></div></div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

// ========== KHỞI TẠO SỰ KIỆN ==========
export function initMobileEvents() {
    // Tab navigation
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
        item.onclick = () => {
            currentMobileTab = item.dataset.tab;
            document.querySelectorAll('.mobile-nav-item').forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            const content = document.getElementById('mobile-tab-content');
            if (content) content.innerHTML = renderMobileTabContent();
            bindMobileEvents();
        };
    });
    
    bindMobileEvents();
}

function bindMobileEvents() {
    // Nút nhập kho
    const importBtn = document.getElementById('mobile-import-btn');
    if (importBtn) {
        importBtn.onclick = async () => {
            const supplierId = document.getElementById('mobile-supplier')?.value;
            const mid = document.getElementById('mobile-material')?.value;
            const qty = parseFloat(document.getElementById('mobile-qty')?.value);
            const price = parseFloat(document.getElementById('mobile-price')?.value);
            const vat = parseFloat(document.getElementById('mobile-vat')?.value) || 10;
            
            if (!supplierId || !mid || !qty) {
                alert('Vui lòng nhập đầy đủ thông tin');
                return;
            }
            
            const total = qty * price;
            const vatAmount = total * vat / 100;
            
            // Gọi API nhập kho
            const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: 'mobile_' + Date.now(),
                    mid, supplierId,
                    type: 'purchase',
                    qty, unitPrice: price, vatRate: vat,
                    subtotal: total, vatAmount, totalAmount: total + vatAmount,
                    note: 'Nhập từ mobile',
                    date: new Date().toISOString().split('T')[0],
                    datetime: new Date().toISOString()
                })
            });
            const data = await res.json();
            if (data.success) {
                alert('✅ Nhập kho thành công!');
                window.loadState().then(() => {
                    const content = document.getElementById('mobile-tab-content');
                    if (content) content.innerHTML = renderMobileTabContent();
                    bindMobileEvents();
                });
            } else {
                alert('❌ Lỗi: ' + data.error);
            }
        };
    }
    
    // Nút xuất kho
    const exportBtn = document.getElementById('mobile-export-btn');
    if (exportBtn) {
        exportBtn.onclick = async () => {
            const projectId = document.getElementById('mobile-project')?.value;
            const mid = document.getElementById('mobile-export-material')?.value;
            const qty = parseFloat(document.getElementById('mobile-export-qty')?.value);
            const note = document.getElementById('mobile-export-note')?.value;
            
            if (!projectId || !mid || !qty) {
                alert('Vui lòng nhập đầy đủ thông tin');
                return;
            }
            
            const material = state.data.materials.find(m => m.id === mid);
            if (material && material.qty < qty) {
                alert(`Không đủ tồn kho! Còn ${material.qty} ${material.unit}`);
                return;
            }
            
            const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: 'mobile_' + Date.now(),
                    mid, projectId,
                    type: 'usage',
                    qty, unitPrice: material?.cost || 0,
                    totalAmount: qty * (material?.cost || 0),
                    note: note || 'Xuất từ mobile',
                    date: new Date().toISOString().split('T')[0],
                    datetime: new Date().toISOString()
                })
            });
            const data = await res.json();
            if (data.success) {
                alert('✅ Xuất kho thành công!');
                window.loadState().then(() => {
                    const content = document.getElementById('mobile-tab-content');
                    if (content) content.innerHTML = renderMobileTabContent();
                    bindMobileEvents();
                });
            } else {
                alert('❌ Lỗi: ' + data.error);
            }
        };
    }
}

export function switchMobileTab(tab) {
    currentMobileTab = tab;
    const content = document.getElementById('mobile-tab-content');
    if (content) content.innerHTML = renderMobileTabContent();
    bindMobileEvents();
}

window.switchMobileTab = switchMobileTab;
