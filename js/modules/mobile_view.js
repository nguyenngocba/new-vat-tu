import { state, saveState, addLog, formatMoney, escapeHtml } from './state.js';
import { formatMoneyVND } from './utils.js';

// ========== DETECT MOBILE ==========
export function isMobileDevice() {
    return /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) || window.innerWidth < 768;
}

let sidebarOpen = false;
let txnPage = 1;
let txnLimit = 10;
// ========== RENDER ==========
function renderRecentTxns(transactions, page, limit) {
    const materials = state.data.materials || [];
    const txns = [...transactions].sort((a, b) => new Date(b.datetime || b.date) - new Date(a.datetime || a.date));
    const totalItems = txns.length;
    const totalPages = Math.ceil(totalItems / limit) || 1;
    if (page > totalPages) page = totalPages;
    if (page < 1) page = 1;
    
    const start = (page - 1) * limit;
    const paginated = txns.slice(start, start + limit);
    
    if (paginated.length === 0) return '<div class="m-empty">Chưa có giao dịch</div>';
    
    let html = '';
    paginated.forEach(t => {
        const mat = materials.find(m => m.id === t.mid);
        const isImport = t.type === 'purchase';
        const time = new Date(t.datetime || t.date).toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit'});
        html += `
            <div class="m-txn-item">
                <div class="m-txn-icon">${isImport ? '📥' : t.type === 'return' ? '🔄' : '📤'}</div>
                <div class="m-txn-info">
                    <div class="m-txn-name">${escapeHtml(mat?.name || 'N/A')}</div>
                    <div class="m-txn-meta">${time} · ${isImport ? 'Nhập' : t.type === 'return' ? 'Trả' : 'Xuất'} · ${Number(t.qty||0).toLocaleString('vi-VN')} ${mat?.unit||''}</div>
                </div>
                <div class="m-txn-amount" style="color:${isImport ? '#16a34a' : '#dc2626'}">${isImport ? '+' : '-'}${formatMoneyVND(t.totalAmount)}</div>
            </div>
        `;
    });
    
    // Phân trang
    html += '<div class="m-pagination">';
    html += `<select class="m-page-limit" onchange="changeTxnLimit(this.value)">`;
    html += `<option value="10" ${limit===10?'selected':''}>10</option>`;
    html += `<option value="20" ${limit===20?'selected':''}>20</option>`;
    html += `<option value="50" ${limit===50?'selected':''}>50</option>`;
    html += `</select>`;
    html += '<div class="m-page-btns">';
    html += `<button class="m-page-btn" onclick="changeTxnPage(${page-1})" ${page<=1?'disabled':''}>◀</button>`;
    html += `<span class="m-page-info">${page}/${totalPages} (${totalItems})</span>`;
    html += `<button class="m-page-btn" onclick="changeTxnPage(${page+1})" ${page>=totalPages?'disabled':''}>▶</button>`;
    html += '</div></div>';
    
    return html;
}
// ========== RENDER CHÍNH ==========
export function renderMobileView() {
    const materials = state.data.materials || [];
    const suppliers = state.data.suppliers || [];
    const projects = state.data.projects || [];
    const transactions = state.data.transactions || [];
    const lowStockCount = materials.filter(m => m.qty <= m.low).length;
    const currentUser = state.currentUser || {};
    
    // 5 giao dịch gần nhất
    const recentTxns = [...transactions]
        .sort((a, b) => new Date(b.datetime || b.date) - new Date(a.datetime || a.date))
        .slice(0, 5);
    
    return `
 <div class="mobile-app dark" id="mobile-app-container">        
            <!-- SIDEBAR TRƯỢT TRÁI -->
            <div class="m-sidebar-overlay ${sidebarOpen ? 'show' : ''}" onclick="toggleMSidebar()"></div>
            <div class="m-sidebar ${sidebarOpen ? 'open' : ''}">
                <div class="m-sidebar-header">
                    <img src="/images/logo-tv.png" style="height:24px;">
                    <span>TRÍ VIỆT STEEL</span>
                </div>
                <div class="m-sidebar-user">
                    <div class="m-avatar">${escapeHtml(currentUser.name?.charAt(0) || 'U')}</div>
                    <div>
                        <div class="m-uname">${escapeHtml(currentUser.name || 'User')}</div>
                        <div class="m-urole">${currentUser.role === 'admin' ? 'Admin' : 'Nhân viên'}</div>
                    </div>
                </div>
                <div class="m-sidebar-nav">
                    <div class="m-nav-item active" onclick="toggleMSidebar()">
                        <span>🏠</span><span>Trang chủ</span>
                    </div>
		    <div class="m-nav-item" onclick="toggleMSidebar();showMobileDashboard()">
                        <span>📊</span><span>Thống kê</span>
                    </div>
                    <div class="m-nav-item" onclick="toggleMSidebar();showMobileStock()">
                        <span>📦</span><span>Quản lý kho</span>
                    </div>
                    <div class="m-nav-item" onclick="toggleMSidebar();showMobileProjects()">
                        <span>🏗️</span><span>Công trình</span>
                    </div>
                    <div class="m-nav-item" onclick="toggleMSidebar();showMobileLowStock()">
                        <span>⚠️</span><span>Sắp hết hàng</span>
                    </div>
                </div>
                <div class="m-sidebar-footer">
                    <div class="m-nav-item" onclick="logout()">
                        <span>🚪</span><span>Đăng xuất</span>
                    </div>
                </div>
            </div>
            
            <!-- HEADER -->
            <div class="m-header">
                <div class="m-header-left">
                    <button class="m-hamburger" onclick="toggleMSidebar()">☰</button>
                    <img src="/images/logo-tv.png" style="height:24px;">
                    <span>TRÍ VIỆT STEEL</span>
                </div>
                <div class="m-header-right" onclick="showMobileMenu()">
                    <span>${escapeHtml(currentUser.name?.charAt(0) || 'U')}</span>
                </div>
            </div>
            
            <!-- 6 NÚT CHÍNH -->
            <div class="m-grid">
                <div class="m-btn m-btn-blue" onclick="showMobileImport()">
                    <span class="m-btn-icon">📥</span>
                    <span class="m-btn-label">NHẬP KHO</span>
                </div>
                <div class="m-btn m-btn-red" onclick="showMobileExport()">
                    <span class="m-btn-icon">📤</span>
                    <span class="m-btn-label">XUẤT KHO</span>
                </div>
                <div class="m-btn m-btn-green" onclick="showMobileStock()">
                    <span class="m-btn-icon">📦</span>
                    <span class="m-btn-label">TỒN KHO</span>
                    <span class="m-btn-sub">${materials.length} món</span>
                </div>
                <div class="m-btn m-btn-purple" onclick="showMobileProjects()">
                    <span class="m-btn-icon">🏗️</span>
                    <span class="m-btn-label">CÔNG TRÌNH</span>
                    <span class="m-btn-sub">${projects.length} CT</span>
                </div>
                <div class="m-btn m-btn-orange" onclick="showMobileLowStock()">
                    <span class="m-btn-icon">⚠️</span>
                    <span class="m-btn-label">SẮP HẾT</span>
                    ${lowStockCount > 0 ? `<span class="m-badge">${lowStockCount}</span>` : '<span class="m-btn-sub">0 món</span>'}
                </div>
                <div class="m-btn m-btn-teal" onclick="showMobileReturn()">
                    <span class="m-btn-icon">🔄</span>
                    <span class="m-btn-label">TRẢ HÀNG</span>
                </div>
		<div class="m-btn m-btn-cyan" onclick="showMobileDashboard()">
                    <span class="m-btn-icon">📊</span>
                    <span class="m-btn-label">THỐNG KÊ</span>
                </div>
            </div>
            
            <!-- GIAO DỊCH GẦN ĐÂY -->
            <div class="m-section">
                <div class="m-section-title">📋 GIAO DỊCH GẦN ĐÂY</div>
				<div id="m-txn-list">
				${renderRecentTxns(transactions, txnPage, txnLimit)}
				 </div>
				</div>
            </div>
            <!-- MENU POPUP -->
            <div id="m-menu" class="m-menu" style="display:none;" onclick="event.stopPropagation()">
                <div class="m-menu-item" onclick="logout()">🚪 Đăng xuất</div>
            </div>            
        </div>
    `;
}

// ========== SIDEBAR TOGGLE ==========
window.toggleMSidebar = function() {
    sidebarOpen = !sidebarOpen;
    const overlay = document.querySelector('.m-sidebar-overlay');
    const sidebar = document.querySelector('.m-sidebar');
    if (overlay) overlay.classList.toggle('show', sidebarOpen);
    if (sidebar) sidebar.classList.toggle('open', sidebarOpen);
};

// ========== MODAL NHẬP KHO ==========
// ========== MODAL NHẬP KHO ==========
window.showMobileImport = function() {
    const materials = state.data.materials || [];
    const suppliers = state.data.suppliers || [];
    
    if (materials.length === 0) { alert('Chưa có vật tư!'); return; }
    if (suppliers.length === 0) { alert('Chưa có nhà cung cấp!'); return; }
    
    const now = new Date();
    const dt = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    
    const html = `
        <div class="m-modal" id="m-import-modal">
            <div class="m-modal-hd">
                <button class="m-back" onclick="renderMobileViewOnly()">←</button>
                <span>📥 NHẬP KHO</span>
                <div></div>
            </div>
            <div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px;">
                <div class="m-field">
                    <label>📅 Thời gian</label>
                    <input type="datetime-local" id="mi-datetime" value="${dt}">
                </div>
                <div class="m-field">
                    <label>🏭 Nhà cung cấp</label>
                    <select id="mi-supplier">${suppliers.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}</select>
                </div>
                <div class="m-field">
                    <label>📦 Vật tư</label>
                    <select id="mi-material" onchange="updateMPrice()">${materials.map(m => `<option value="${m.id}" data-cost="${m.cost}" data-unit="${m.unit}">${escapeHtml(m.name)} (${Number(m.qty).toLocaleString('vi-VN')} ${m.unit})</option>`).join('')}</select>
                </div>
                <div class="m-field">
                    <label>🔢 Số lượng</label>
                    <div class="m-qty-box">
                        <button class="m-qty-btn" onclick="changeMQty(-1)">−</button>
                        <input type="text" id="mi-qty" value="1" dir="ltr" class="m-qty-input" oninput="updateMobileTotal()">
                        <button class="m-qty-btn" onclick="changeMQty(1)">+</button>
                    </div>
                    <div class="m-qty-presets">
                        <span onclick="setMQty(1)">1</span>
                        <span onclick="setMQty(5)">5</span>
                        <span onclick="setMQty(10)">10</span>
                        <span onclick="setMQty(100)">100</span>
                    </div>
                </div>
                <div class="m-field">
                    <label>💰 Đơn giá (VNĐ)</label>
                    <input type="text" id="mi-price" value="0" dir="ltr" oninput="updateMobileTotal()">
                </div>
                <div class="m-field">
                    <label>🧾 VAT (%)</label>
                    <input type="text" id="mi-vat" value="10" dir="ltr" oninput="updateMobileTotal()">
                </div>
                <div class="m-field">
                    <label>📝 Ghi chú</label>
                    <input type="text" id="mi-note" placeholder="Mã hóa đơn, số chứng từ...">
                </div>
                <div class="m-field">
                    <label>📎 File đính kèm</label>
                    <input type="file" id="mi-files" multiple accept="image/*,.pdf,.xlsx,.csv,.doc,.docx" onchange="handleMobileFiles(this,'purchase')" style="padding:10px;">
                    <div id="mi-file-list" style="margin-top:6px;font-size:11px;color:#7a8099;"></div>
                </div>
                <div class="m-summary">
                    <div>💰 Tiền hàng: <strong id="mi-subtotal">0 ₫</strong></div>
                    <div>🧾 VAT (<span id="mi-vat-rate">10</span>%): <strong id="mi-vat-amount">0 ₫</strong></div>
                    <div style="font-size:16px;margin-top:4px;">💵 TỔNG: <strong id="mi-total" style="color:#16a34a;">0 ₫</strong></div>
                </div>
                <button class="m-submit" onclick="doMobileImport()">✅ XÁC NHẬN NHẬP KHO</button>
            </div>
        </div>
    `;
    document.getElementById('root').innerHTML = html;
    fixAllModalHeight();
    setTimeout(() => {
        const sel = document.getElementById('mi-material');
        if (sel) { const opt = sel.options[sel.selectedIndex]; document.getElementById('mi-price').value = Number(opt?.dataset?.cost || 0).toLocaleString('vi-VN'); }
        updateMobileTotal();
    }, 100);
};
// ========== MODAL XUẤT KHO ==========
// ========== MODAL XUẤT KHO ==========
window.showMobileExport = function() {
    const materials = state.data.materials || [];
    const projects = state.data.projects || [];
    
    if (materials.length === 0) { alert('Chưa có vật tư!'); return; }
    if (projects.length === 0) { alert('Chưa có công trình!'); return; }
    
    const now = new Date();
    const dt = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    
    const html = `
        <div class="m-modal" id="m-export-modal">
            <div class="m-modal-hd">
                <button class="m-back" onclick="renderMobileViewOnly()">←</button>
                <span>📤 XUẤT KHO</span>
                <div></div>
            </div>
            <div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px;">
                <div class="m-field">
                    <label>📅 Thời gian</label>
                    <input type="datetime-local" id="me-datetime" value="${dt}">
                </div>
                <div class="m-field">
                    <label>🏗️ Công trình</label>
                    <select id="me-project">${projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}</select>
                </div>
                <div class="m-field">
                    <label>📦 Vật tư</label>
                    <select id="me-material">${materials.map(m => `<option value="${m.id}" data-cost="${m.cost}" data-unit="${m.unit}" data-qty="${m.qty}">${escapeHtml(m.name)} (Còn: ${Number(m.qty).toLocaleString('vi-VN')} ${m.unit})</option>`).join('')}</select>
                </div>
                <div class="m-field">
                    <label>🔢 Số lượng</label>
                    <div class="m-qty-box">
                        <button class="m-qty-btn" onclick="changeMQty(-1)">−</button>
                        <input type="text" id="me-qty" value="1" dir="ltr" class="m-qty-input">
                        <button class="m-qty-btn" onclick="changeMQty(1)">+</button>
                    </div>
                </div>
                <div class="m-field">
                    <label>📝 Ghi chú</label>
                    <input type="text" id="me-note" placeholder="Vị trí sử dụng...">
                </div>
                <div class="m-field">
                    <label>📎 File đính kèm</label>
                    <input type="file" id="me-files" multiple accept="image/*,.pdf,.xlsx,.csv,.doc,.docx" onchange="handleMobileFiles(this,'usage')" style="padding:10px;">
                    <div id="me-file-list" style="margin-top:6px;font-size:11px;color:#7a8099;"></div>
                </div>
                <button class="m-submit" style="background:#dc2626;" onclick="doMobileExport()">✅ XÁC NHẬN XUẤT KHO</button>
            </div>
        </div>
    `;
    document.getElementById('root').innerHTML = html;
    fixAllModalHeight();
};
// ========== MODAL TỒN KHO ==========
window.showMobileStock = function() {
    const materials = state.data.materials || [];
    
    let html = `
        <div class="m-modal" id="m-stock-modal">
            <div class="m-modal-hd">
                <button class="m-back" onclick="renderMobileViewOnly()">←</button>
                <span>📦 TỒN KHO (${materials.length})</span>
                <div></div>
            </div>
            <div class="m-modal-bd" style="padding:12px;">
                <input type="text" id="ms-search" class="m-search" placeholder="🔍 Tìm vật tư..." oninput="filterMStock()">
            </div>
            <div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;" id="ms-list">
    `;
    
    materials.forEach(m => {
        const low = m.qty <= m.low;
        html += `
            <div class="m-stock-item" data-name="${escapeHtml(m.name).toLowerCase()}" onclick="window.showMaterialDetail('${m.id}')">
                <div class="m-stock-info">
                    <div class="m-stock-name">${low ? '⚠️ ' : ''}${escapeHtml(m.name)}</div>
                    <div class="m-stock-meta">${m.cat || ''} · ${formatMoneyVND(m.cost)}/${m.unit}</div>
                </div>
                <div class="m-stock-qty ${low ? 'm-text-red' : ''}">
                    <div class="m-stock-qty-val">${Number(m.qty).toLocaleString('vi-VN')}</div>
                    <div class="m-stock-qty-unit">${m.unit}</div>
                </div>
            </div>
        `;
    });
    
    html += `</div></div>`;
    document.getElementById('root').innerHTML = html;
    fixAllModalHeight();
};

// ========== MODAL SẮP HẾT ==========
window.showMobileLowStock = function() {
    const materials = state.data.materials.filter(m => m.qty <= m.low);
    
    let html = `
        <div class="m-modal" id="m-low-modal">
            <div class="m-modal-hd">
                <button class="m-back" onclick="renderMobileViewOnly()">←</button>
                <span>⚠️ SẮP HẾT HÀNG (${materials.length})</span>
                <div></div>
            </div>
            <div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;">
    `;
    
    if (materials.length === 0) {
        html += '<div class="m-empty">✅ Tất cả đều ổn, không có hàng sắp hết!</div>';
    } else {
        materials.forEach(m => {
            html += `
                <div class="m-stock-item" onclick="window.showMaterialDetail('${m.id}')">
                    <div class="m-stock-info">
                        <div class="m-stock-name">⚠️ ${escapeHtml(m.name)}</div>
                        <div class="m-stock-meta">Cần nhập thêm ${Number(m.low - m.qty).toLocaleString('vi-VN')} ${m.unit}</div>
                    </div>
                    <div class="m-stock-qty m-text-red">
                        <div class="m-stock-qty-val">${Number(m.qty).toLocaleString('vi-VN')}</div>
                        <div class="m-stock-qty-unit">${m.unit}</div>
                    </div>
                </div>
            `;
        });
    }
    
    html += `</div></div>`;
    document.getElementById('root').innerHTML = html;
    fixAllModalHeight();
};
// ========== MODAL CÔNG TRÌNH ==========
window.showMobileProjects = function() {
    const projects = state.data.projects || [];
    
    let html = `
        <div class="m-modal" id="m-project-modal">
            <div class="m-modal-hd">
                <button class="m-back" onclick="renderMobileViewOnly()">←</button>
                <span>🏗️ CÔNG TRÌNH (${projects.length})</span>
                <div></div>
            </div>
            <div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;">
    `;
    
    if (projects.length === 0) {
        html += '<div class="m-empty">📭 Chưa có công trình</div>';
    } else {
        projects.forEach(p => {
            const spent = state.data.transactions.filter(t => t.projectId === p.id && t.type === 'usage').reduce((s,t) => s + (Number(t.totalAmount)||0), 0);
            const ret = state.data.transactions.filter(t => t.projectId === p.id && t.type === 'return').reduce((s,t) => s + (Number(t.totalAmount)||0), 0);
            const net = spent - ret;
            const pct = p.budget > 0 ? Math.min(100, (net / p.budget) * 100) : 0;
            
            html += `
                <div class="m-project-item" onclick="window.showProjectDetail('${p.id}')">
                    <div class="m-project-info">
                        <div class="m-project-name">${escapeHtml(p.name)}</div>
                        <div class="m-project-meta">💰 Đã chi: ${formatMoneyVND(net)} / ${formatMoneyVND(p.budget)}</div>
                        <div class="m-project-bar"><div class="m-project-fill" style="width:${pct}%;background:${pct>90?'var(--red)':pct>70?'var(--orange)':'var(--blue)'};"></div></div>
                    </div>
                    <div class="m-project-pct">${pct.toFixed(0)}%</div>
                </div>
            `;
        });
    }
    
    html += `</div></div>`;
    document.getElementById('root').innerHTML = html;
    fixAllModalHeight();
};
// ========== MODAL TRẢ HÀNG ==========
window.showMobileReturn = function() {
    const projects = state.data.projects.filter(p => state.data.transactions.some(t => t.projectId === p.id && t.type === 'usage'));
    
    if (projects.length === 0) { alert('Chưa có công trình nào được xuất kho!'); return; }
    
    const now = new Date();
    const dt = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    
    const html = `
        <div class="m-modal" id="m-return-modal">
            <div class="m-modal-hd">
                <button class="m-back" onclick="renderMobileViewOnly()">←</button>
                <span>🔄 TRẢ HÀNG</span>
                <div></div>
            </div>
            <div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px;">
                <div class="m-field">
                    <label>📅 Thời gian</label>
                    <input type="datetime-local" id="mr-datetime" value="${dt}">
                </div>
                <div class="m-field">
                    <label>🏗️ Công trình</label>
                    <select id="mr-project" onchange="loadReturnMaterials()">${projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}</select>
                </div>
                <div class="m-field">
                    <label>📦 Vật tư</label>
                    <select id="mr-material" onchange="updateRPrice()"></select>
                </div>
                <div class="m-field">
                    <label>🔢 Số lượng</label>
                    <div class="m-qty-box">
                        <button class="m-qty-btn" onclick="changeMQty(-1)">−</button>
                        <input type="text" id="mr-qty" value="1" dir="ltr" class="m-qty-input">
                        <button class="m-qty-btn" onclick="changeMQty(1)">+</button>
                    </div>
                </div>
                <div class="m-field">
                    <label>💰 Đơn giá hoàn</label>
                    <input type="text" id="mr-price" value="0" dir="ltr" readonly>
                </div>
                <div class="m-field">
                    <label>📝 Ghi chú</label>
                    <input type="text" id="mr-note" placeholder="Lý do trả hàng...">
                </div>
                <div class="m-field">
                    <label>📎 File đính kèm</label>
                    <input type="file" id="mr-files" multiple accept="image/*,.pdf,.xlsx,.csv,.doc,.docx" onchange="handleMobileFiles(this,'return')" style="padding:10px;">
                    <div id="mr-file-list" style="margin-top:6px;font-size:11px;color:#7a8099;"></div>
                </div>
                <button class="m-submit" style="background:#0d9488;" onclick="doMobileReturn()">✅ XÁC NHẬN TRẢ HÀNG</button>
            </div>
        </div>
    `;
    document.getElementById('root').innerHTML = html;
    fixAllModalHeight();
    setTimeout(() => loadReturnMaterials(), 100);
};
// ========== CÁC HÀM XỬ LÝ ==========
window.changeMQty = function(delta) {
    const input = document.getElementById('mi-qty') || document.getElementById('me-qty') || document.getElementById('mr-qty');
    if (input) {
        let val = parseFloat(input.value.replace(',', '.')) || 0;
        val = Math.max(0, val + delta);
        input.value = val;
        updateMobileTotal();
    }
};

window.setMQty = function(val) {
    const input = document.getElementById('mi-qty') || document.getElementById('me-qty') || document.getElementById('mr-qty');
    if (input) { input.value = val; updateMobileTotal(); }
};

window.updateMPrice = function() { const sel = document.getElementById('mi-material'); const priceInput = document.getElementById('mi-price'); if (sel && priceInput) { priceInput.value = Number(sel.options[sel.selectedIndex]?.dataset?.cost || 0).toLocaleString('vi-VN'); } updateMobileTotal(); };

function updateMobileTotal() {
    const qtyInput = document.getElementById('mi-qty') || document.getElementById('me-qty') || document.getElementById('mr-qty');
    const priceInput = document.getElementById('mi-price') || document.getElementById('mr-price');
    const vatInput = document.getElementById('mi-vat');
    const subtotalEl = document.getElementById('mi-subtotal');
    const vatRateEl = document.getElementById('mi-vat-rate');
    const vatAmountEl = document.getElementById('mi-vat-amount');
    const totalEl = document.getElementById('mi-total');
    
    if (qtyInput && priceInput) {
        const qty = parseFloat(qtyInput.value.replace(',', '.')) || 0;
        const price = parseFloat(priceInput.value.replace(/\./g, '').replace(',', '.')) || 0;
        const vat = vatInput ? (parseFloat(vatInput.value.replace(',', '.')) || 0) : 0;
        const subtotal = qty * price;
        const vatAmount = subtotal * vat / 100;
        const total = subtotal + vatAmount;
        
        if (subtotalEl) subtotalEl.textContent = formatMoneyVND(subtotal);
        if (vatRateEl) vatRateEl.textContent = vat;
        if (vatAmountEl) vatAmountEl.textContent = formatMoneyVND(vatAmount);
        if (totalEl) totalEl.textContent = formatMoneyVND(total);
    }
}
window.doMobileImport = async function() {
    const supplierId = document.getElementById('mi-supplier')?.value;
    const mid = document.getElementById('mi-material')?.value;
    const dt = document.getElementById('mi-datetime')?.value || new Date().toISOString();
    const qty = parseFloat(document.getElementById('mi-qty')?.value?.replace(',', '.')) || 0;
    const price = parseFloat(document.getElementById('mi-price')?.value?.replace(/\./g, '').replace(',', '.')) || 0;
    const vat = parseFloat(document.getElementById('mi-vat')?.value?.replace(',', '.')) || 0;
    const note = document.getElementById('mi-note')?.value || '';
    
    if (!supplierId || !mid || !qty || !price) { alert('Vui lòng nhập đầy đủ!'); return; }
    
    const subtotal = qty * price;
    const vatAmount = subtotal * vat / 100;
    const total = subtotal + vatAmount;
    const attachment = JSON.stringify((window._upPaths && window._upPaths.purchase) || []);
    
    const res = await fetch('/api/transactions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: 'm_' + Date.now(), mid, supplierId, type: 'purchase',
            qty, unitPrice: price, vatRate: vat,
            subtotal, vatAmount, totalAmount: total,
            note: note || 'Nhập từ mobile',
            date: dt.split('T')[0], datetime: dt,
            attachment: attachment
        })
    });
    const data = await res.json();
    if (data.success) {
        if (navigator.vibrate) navigator.vibrate(50);
        window._upPaths = {};
        window.loadState().then(() => renderMobileViewOnly());
    } else {
        alert('❌ ' + (data.error || 'Lỗi'));
    }
};
window.doMobileExport = async function() {
    const projectId = document.getElementById('me-project')?.value;
    const mid = document.getElementById('me-material')?.value;
    const dt = document.getElementById('me-datetime')?.value || new Date().toISOString();
    const qty = parseFloat(document.getElementById('me-qty')?.value?.replace(',', '.')) || 0;
    const note = document.getElementById('me-note')?.value;
    
    if (!projectId || !mid || !qty) { alert('Vui lòng nhập đầy đủ!'); return; }
    
    const mat = state.data.materials.find(m => m.id === mid);
    if (mat && mat.qty < qty) { alert(`Không đủ tồn! Còn ${mat.qty} ${mat.unit}`); return; }
    
    const total = qty * (mat?.cost || 0);
    const attachment = JSON.stringify((window._upPaths && window._upPaths.usage) || []);
    
    const res = await fetch('/api/transactions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: 'm_' + Date.now(), mid, projectId, type: 'usage',
            qty, unitPrice: mat?.cost || 0, totalAmount: total,
            note: note || 'Xuất từ mobile',
            date: dt.split('T')[0], datetime: dt,
            attachment: attachment
        })
    });
    const data = await res.json();
    if (data.success) {
        if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
        window._upPaths = {};
        window.loadState().then(() => renderMobileViewOnly());
    } else {
        alert('❌ ' + (data.error || 'Lỗi'));
    }
};
window.loadReturnMaterials = function() {
    const pid = document.getElementById('mr-project')?.value;
    const sel = document.getElementById('mr-material');
    if (!pid || !sel) return;
    const uT = state.data.transactions.filter(t => t.projectId === pid && t.type === 'usage');
    const rT = state.data.transactions.filter(t => t.projectId === pid && t.type === 'return');
    const map = new Map();
    uT.forEach(t => { const m = state.data.materials.find(x => x.id === t.mid); if (m) { if (!map.has(t.mid)) map.set(t.mid, { id: t.mid, name: m.name, unit: m.unit, rec: 0, ret: 0, price: t.unitPrice }); map.get(t.mid).rec += t.qty; } });
    rT.forEach(t => { if (map.has(t.mid)) map.get(t.mid).ret += t.qty; });
    const list = Array.from(map.values()).map(i => ({ ...i, avail: i.rec - i.ret })).filter(i => i.avail > 0);
    if (list.length === 0) { sel.innerHTML = '<option value="">✅ Đã trả hết</option>'; return; }
    sel.innerHTML = list.map(m => `<option value="${m.id}" data-price="${m.price}">${escapeHtml(m.name)} (Có thể trả: ${m.avail} ${m.unit})</option>`).join('');
    updateRPrice();
};

window.updateRPrice = function() { const sel = document.getElementById('mr-material'); const p = document.getElementById('mr-price'); if (sel && p) { p.value = Number(sel.options[sel.selectedIndex]?.dataset?.price || 0).toLocaleString('vi-VN'); } };

window.doMobileReturn = async function() {
    var pid = document.getElementById('mr-project')?.value;
    var mid = document.getElementById('mr-material')?.value;
    var dt = document.getElementById('mr-datetime')?.value || new Date().toISOString();
    var qty = parseFloat(document.getElementById('mr-qty')?.value?.replace(',', '.')) || 0;
    var price = parseFloat(document.getElementById('mr-price')?.value?.replace(/\./g, '').replace(',', '.')) || 0;
    var note = document.getElementById('mr-note')?.value || '';
    
    if (!pid || !mid || !qty) { alert('Vui lòng nhập đầy đủ!'); return; }
    
    // Kiểm tra số lượng có thể trả
    var uT = state.data.transactions.filter(function(t) { return t.projectId === pid && t.mid === mid && t.type === 'usage'; });
    var rT = state.data.transactions.filter(function(t) { return t.projectId === pid && t.mid === mid && t.type === 'return'; });
    var totalReceived = uT.reduce(function(s, t) { return s + Number(t.qty||0); }, 0);
    var totalReturned = rT.reduce(function(s, t) { return s + Number(t.qty||0); }, 0);
    var avail = totalReceived - totalReturned;
    
    if (qty > avail) {
        alert('Không thể trả quá số lượng đã nhận!\nĐã nhận: ' + Number(totalReceived).toLocaleString('vi-VN') + '\nĐã trả: ' + Number(totalReturned).toLocaleString('vi-VN') + '\nCó thể trả tối đa: ' + Number(avail).toLocaleString('vi-VN'));
        return;
    }
    
    var total = qty * price;
    var attachment = JSON.stringify((window._upPaths && window._upPaths.return) || []);
    
    var res = await fetch('/api/transactions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: 'm_' + Date.now(), mid: mid, projectId: pid, type: 'return',
            qty: qty, unitPrice: price, totalAmount: total,
            note: note || 'Trả từ mobile',
            date: dt.split('T')[0], datetime: dt,
            attachment: attachment
        })
    });
    var data = await res.json();
    if (data.success) {
        window._upPaths = {};
        window.loadState().then(function() { renderMobileViewOnly(); });
    } else {
        alert('❌ ' + (data.error || 'Lỗi'));
    }
};
window.filterMStock = function() { const kw = document.getElementById('ms-search')?.value?.toLowerCase() || ''; document.querySelectorAll('#ms-list .m-stock-item').forEach(el => { el.style.display = (el.dataset.name || '').includes(kw) ? '' : 'none'; }); };

window.showMobileMenu = function() { const menu = document.getElementById('m-menu'); if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none'; };

window.renderMobileViewOnly = function() { window.loadState().then(() => { document.getElementById('root').innerHTML = renderMobileView(); sidebarOpen = false; }); };

window.switchMobileMode = function(mode) { if (mode === 'desktop') { localStorage.setItem('steeltrack_ui_mode', 'desktop'); window.location.reload(); } };

// Export global cho app.js
window.renderMobileView = renderMobileView;
window.renderMobileViewOnly = renderMobileViewOnly;
// Chuyen trang
window.changeTxnPage = function(page) {
    txnPage = page;
    const listEl = document.getElementById('m-txn-list');
    if (listEl) {
        listEl.innerHTML = renderRecentTxns(state.data.transactions || [], txnPage, txnLimit);
    }
};

window.changeTxnLimit = function(limit) {
    txnLimit = parseInt(limit);
    txnPage = 1;
    const listEl = document.getElementById('m-txn-list');
    if (listEl) {
        listEl.innerHTML = renderRecentTxns(state.data.transactions || [], txnPage, txnLimit);
    }
};
function fixAllModalHeight() {
    setTimeout(function() {
        var modals = document.querySelectorAll('.m-modal');
        modals.forEach(function(modal) {
            modal.style.height = window.innerHeight + 'px';
            modal.style.display = 'flex';
            modal.style.flexDirection = 'column';
        });
    }, 50);
}
// ========== XỬ LÝ FILE UPLOAD TỪ MOBILE ==========
window.handleMobileFiles = function(input, type) {
    if (!window._upPaths) window._upPaths = {};
    if (!window._upPaths[type]) window._upPaths[type] = [];
    
    const listId = (type === 'purchase' ? 'mi' : type === 'usage' ? 'me' : 'mr') + '-file-list';
    const list = document.getElementById(listId);
    
    for (let i = 0; i < input.files.length; i++) {
        const f = input.files[i];
        const fd = new FormData();
        fd.append('file', f);
        const id = type + '_' + Date.now() + '_' + Math.random().toString(36).substr(2,4);
        
        fetch('/api/upload/' + type + '/' + id, { method: 'POST', body: fd })
            .then(r => r.json())
            .then(d => {
                if (d.success) {
                    window._upPaths[type].push(d.path);
                    if (list) list.innerHTML += '<a href="' + d.path + '" target="_blank" style="color:#378ADD;margin-right:6px;display:inline-block;">📎 ' + d.filename + '</a> ';
                }
            });
    }
};

// ========== MODAL THỐNG KÊ (CEO DASHBOARD) ==========
window.showMobileDashboard = function() {
    const materials = state.data.materials || [];
    const transactions = state.data.transactions || [];
    const projects = state.data.projects || [];
    const suppliers = state.data.suppliers || [];
    
    const html = `
        <div class="m-modal" id="m-dashboard-modal">
            <div class="m-modal-hd">
                <button class="m-back" onclick="renderMobileViewOnly()">←</button>
                <span>📊 THỐNG KÊ</span>
                <div></div>
            </div>
            
            <!-- Tab bar -->
            <div class="m-tab-bar">
                <div class="m-tab active" onclick="switchMDashTab('overview')" id="mtab-overview">📊 Tổng quan</div>
                <div class="m-tab" onclick="switchMDashTab('projects')" id="mtab-projects">🏗️ Công trình</div>
                <div class="m-tab" onclick="switchMDashTab('forecast')" id="mtab-forecast">🔮 Dự báo</div>
                <div class="m-tab" onclick="switchMDashTab('structures')" id="mtab-structures">🏗️ Cấu kiện</div>
            </div>
            
            <div id="m-dash-content" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px;">
                ${renderMDashOverview()}
            </div>
        </div>
    `;
    document.getElementById('root').innerHTML = html;
    fixAllModalHeight();
};
// ========== SWITCH TAB THỐNG KÊ ==========
window.switchMDashTab = function(tab) {
    document.querySelectorAll('.m-tab').forEach(function(t) { t.classList.remove('active'); });
    document.getElementById('mtab-' + tab).classList.add('active');
    var content = document.getElementById('m-dash-content');
    if (tab === 'overview') content.innerHTML = renderMDashOverview();
    if (tab === 'projects') { content.innerHTML = renderMDashProjects(); setTimeout(drawDonutChart, 200); }
    if (tab === 'forecast') { content.innerHTML = '<div class="m-empty">Đang tải...</div>'; renderMDashForecast().then(function(h) { content.innerHTML = h; }); }
    if (tab === 'structures') content.innerHTML = renderMDashStructures();
};
// ========== TAB TỔNG QUAN ==========
function renderMDashOverview() {
    var materials = state.data.materials || [];
    var transactions = state.data.transactions || [];
    var projects = state.data.projects || [];
    var suppliers = state.data.suppliers || [];
    var totalImport = transactions.filter(function(t) { return t.type === 'purchase'; }).reduce(function(s, t) { return s + (Number(t.totalAmount)||0); }, 0);
    var totalExport = transactions.filter(function(t) { return t.type === 'usage'; }).reduce(function(s, t) { return s + (Number(t.totalAmount)||0); }, 0);
    var totalInventory = materials.reduce(function(s, m) { return s + (m.qty * m.cost); }, 0);
    var lowStockCount = materials.filter(function(m) { return m.qty <= m.low; }).length;
    var maxFlow = Math.max(totalImport, totalExport, 1);
    var importPct = (totalImport / maxFlow * 100).toFixed(0);
    var exportPct = (totalExport / maxFlow * 100).toFixed(0);
    
    var projectStats = projects.map(function(p) {
        var spent = transactions.filter(function(t) { return t.projectId === p.id && t.type === 'usage'; }).reduce(function(s,t) { return s + (Number(t.totalAmount)||0); }, 0);
        var ret = transactions.filter(function(t) { return t.projectId === p.id && t.type === 'return'; }).reduce(function(s,t) { return s + (Number(t.totalAmount)||0); }, 0);
        return { name: p.name, spent: spent - ret, budget: p.budget };
    }).sort(function(a,b) { return b.spent - a.spent; }).slice(0, 5);
    var maxProjectSpent = Math.max.apply(null, projectStats.map(function(p) { return p.spent; }).concat([1]));
    
    var supplierStats = suppliers.map(function(s) {
        var total = transactions.filter(function(t) { return t.type === 'purchase' && t.supplierId === s.id; }).reduce(function(sum, t) { return sum + (Number(t.totalAmount)||0); }, 0);
        return { name: s.name, total: total };
    }).sort(function(a,b) { return b.total - a.total; }).slice(0, 5);
    var maxSupplierTotal = Math.max.apply(null, supplierStats.map(function(s) { return s.total; }).concat([1]));
    
    var html = '<div class="m-kpi-grid">' +
        '<div class="m-kpi-card" style="border-left:3px solid #378ADD;"><div class="m-kpi-label">📥 TỔNG NHẬP</div><div class="m-kpi-value">' + formatMoneyVND(totalImport) + '</div></div>' +
        '<div class="m-kpi-card" style="border-left:3px solid #dc2626;"><div class="m-kpi-label">📤 TỔNG XUẤT</div><div class="m-kpi-value">' + formatMoneyVND(totalExport) + '</div></div>' +
        '<div class="m-kpi-card" style="border-left:3px solid #16a34a;"><div class="m-kpi-label">📦 TỒN KHO</div><div class="m-kpi-value">' + formatMoneyVND(totalInventory) + '</div></div>' +
        '<div class="m-kpi-card" style="border-left:3px solid ' + (lowStockCount > 0 ? '#ea580c' : '#16a34a') + ';"><div class="m-kpi-label">⚠️ SẮP HẾT</div><div class="m-kpi-value" style="color:' + (lowStockCount > 0 ? '#dc2626' : '#16a34a') + ';">' + lowStockCount + '</div></div>' +
        '</div>';
    
    // Biểu đồ cột so sánh
    html += '<div class="m-section"><div class="m-section-title">📊 SO SÁNH NHẬP - XUẤT</div><div class="m-chart-card">' +
        '<div style="margin-bottom:14px;"><div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>📥 Nhập</span><span style="font-weight:700;">' + formatMoneyVND(totalImport) + '</span></div><div class="m-bar-wrap"><div class="m-bar-fill" style="width:' + importPct + '%;background:linear-gradient(90deg,#378ADD,#85B7EB);box-shadow:0 0 8px rgba(55,138,221,0.3);"></div></div></div>' +
        '<div><div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>📤 Xuất</span><span style="font-weight:700;">' + formatMoneyVND(totalExport) + '</span></div><div class="m-bar-wrap"><div class="m-bar-fill" style="width:' + exportPct + '%;background:linear-gradient(90deg,#dc2626,#F09595);box-shadow:0 0 8px rgba(220,38,38,0.3);"></div></div></div>' +
        '</div></div>';
    
    if (projectStats.length > 0) {
        html += '<div class="m-section"><div class="m-section-title">🏗️ TOP CÔNG TRÌNH</div><div class="m-chart-card">';
        projectStats.forEach(function(p, i) {
            var pct = (p.spent / maxProjectSpent * 100).toFixed(0);
            html += '<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;margin-bottom:2px;"><span style="font-weight:600;">' + (i+1) + '. ' + escapeHtml(p.name) + '</span><span style="font-weight:700;">' + formatMoneyVND(p.spent) + '</span></div><div class="m-bar-wrap"><div class="m-bar-fill" style="width:' + pct + '%;background:#378ADD;"></div></div></div>';
        });
        html += '</div></div>';
    }
    
    if (supplierStats.length > 0) {
        html += '<div class="m-section"><div class="m-section-title">🏭 TOP NHÀ CUNG CẤP</div><div class="m-chart-card">';
        supplierStats.forEach(function(s, i) {
            var pct = (s.total / maxSupplierTotal * 100).toFixed(0);
            html += '<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;margin-bottom:2px;"><span style="font-weight:600;">' + (i+1) + '. ' + escapeHtml(s.name) + '</span><span style="font-weight:700;">' + formatMoneyVND(s.total) + '</span></div><div class="m-bar-wrap"><div class="m-bar-fill" style="width:' + pct + '%;background:#16a34a;"></div></div></div>';
        });
        html += '</div></div>';
    }
    
    return html;
}
// ========== TAB CÔNG TRÌNH ==========
function renderMDashProjects() {
    var projects = state.data.projects || [];
    var transactions = state.data.transactions || [];
    var totalBudget = projects.reduce(function(s, p) { return s + Number(p.budget||0); }, 0);
    var totalSpent = transactions.filter(function(t) { return t.type === 'usage'; }).reduce(function(s,t) { return s + (Number(t.totalAmount)||0); }, 0);
    var totalReturn = transactions.filter(function(t) { return t.type === 'return'; }).reduce(function(s,t) { return s + (Number(t.totalAmount)||0); }, 0);
    var net = totalSpent - totalReturn;
    var remainPct = totalBudget > 0 ? ((totalBudget - net) / totalBudget * 100).toFixed(1) : 0;
    var spentPct = totalBudget > 0 ? (net / totalBudget * 100).toFixed(1) : 0;
    
    var projectStats = projects.map(function(p) {
        var spent = transactions.filter(function(t) { return t.projectId === p.id && t.type === 'usage'; }).reduce(function(s,t) { return s + (Number(t.totalAmount)||0); }, 0);
        var ret = transactions.filter(function(t) { return t.projectId === p.id && t.type === 'return'; }).reduce(function(s,t) { return s + (Number(t.totalAmount)||0); }, 0);
        var netSpent = spent - ret;
        var pct = p.budget > 0 ? (netSpent / p.budget * 100) : 0;
        return { name: p.name, spent: netSpent, budget: p.budget, pct: pct };
    }).sort(function(a,b) { return b.spent - a.spent; });
    
    var maxSpent = Math.max.apply(null, projectStats.map(function(p) { return p.spent; }).concat([1]));
    
    var html = '<div class="m-kpi-grid">' +
        '<div class="m-kpi-card" style="border-left:3px solid #378ADD;"><div class="m-kpi-label">🏗️ TỔNG CT</div><div class="m-kpi-value">' + projects.length + '</div></div>' +
        '<div class="m-kpi-card" style="border-left:3px solid #16a34a;"><div class="m-kpi-label">💰 NGÂN SÁCH</div><div class="m-kpi-value">' + formatMoneyVND(totalBudget) + '</div></div>' +
        '<div class="m-kpi-card" style="border-left:3px solid #dc2626;"><div class="m-kpi-label">💸 ĐÃ CHI</div><div class="m-kpi-value">' + formatMoneyVND(net) + '</div></div>' +
        '<div class="m-kpi-card" style="border-left:3px solid #0891b2;"><div class="m-kpi-label">📊 CÒN LẠI</div><div class="m-kpi-value">' + formatMoneyVND(totalBudget - net) + '</div></div>' +
        '</div>';
    
    // Biểu đồ tròn ngân sách (vẽ bằng Canvas nhỏ)
    html += '<div class="m-section"><div class="m-section-title">🎯 TỔNG QUAN NGÂN SÁCH</div><div class="m-chart-card" style="text-align:center;">' +
        '<canvas id="m-donut-canvas" width="150" height="150" style="display:block;margin:0 auto;"></canvas>' +
        '<div style="display:flex;justify-content:center;gap:20px;margin-top:8px;">' +
            '<div style="font-size:12px;"><span style="display:inline-block;width:12px;height:12px;background:#dc2626;border-radius:50%;margin-right:6px;"></span>Đã chi: ' + formatMoneyVND(net) + '</div>' +
            '<div style="font-size:12px;"><span style="display:inline-block;width:12px;height:12px;background:#16a34a;border-radius:50%;margin-right:6px;"></span>Còn lại: ' + formatMoneyVND(totalBudget - net) + '</div>' +
        '</div></div></div>';    
    // Chi tiết từng công trình
    html += '<div class="m-section"><div class="m-section-title">🏗️ CHI TIẾT CÔNG TRÌNH</div><div class="m-chart-card">';
    projectStats.forEach(function(p, i) {
        var barPct = (p.spent / maxSpent * 100).toFixed(0);
        var isLast = i === projectStats.length - 1;
        var color = p.pct > 90 ? '#dc2626' : p.pct > 70 ? '#ea580c' : '#378ADD';
        var bgColor = p.pct > 90 ? 'rgba(220,38,38,0.15)' : p.pct > 70 ? 'rgba(234,88,12,0.15)' : 'rgba(55,138,221,0.15)';
        html += '<div style="margin-bottom:12px;' + (isLast ? '' : 'border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:10px;') + '">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
                '<span style="font-weight:600;">' + (i+1) + '. ' + escapeHtml(p.name) + '</span>' +
                '<span style="background:' + bgColor + ';color:' + color + ';padding:2px 10px;border-radius:10px;font-size:11px;font-weight:700;">' + p.pct.toFixed(1) + '%</span>' +
            '</div>' +
            '<div class="m-bar-wrap"><div class="m-bar-fill" style="width:' + barPct + '%;background:' + color + ';"></div></div>' +
            '<div style="display:flex;justify-content:space-between;font-size:11px;color:#7a8099;margin-top:4px;"><span>💰 ' + formatMoneyVND(p.spent) + ' / ' + formatMoneyVND(p.budget) + '</span><span>Còn ' + formatMoneyVND(p.budget - p.spent) + '</span></div>' +
            '</div>';
    });
    html += '</div></div>';
    return html;
}
// ========== TAB DỰ BÁO ==========
async function renderMDashForecast() {
    try {
        const res = await fetch('/api/forecast');
        const data = await res.json();
        if (!data.success || !data.data) return '<div class="m-empty">Chưa có dữ liệu</div>';
        
        const urgent = data.data.filter(i => i.warning_level === 'danger').length;
        const warning = data.data.filter(i => i.warning_level === 'warning').length;
        const good = data.data.filter(i => i.warning_level === 'good' || i.warning_level === 'info').length;
        
        return `
            <div class="m-kpi-grid">
                <div class="m-kpi-card" style="border-left:3px solid #dc2626;"><div class="m-kpi-label">⚠️ CẦN NHẬP GẤP</div><div class="m-kpi-value" style="color:#dc2626;">${urgent}</div></div>
                <div class="m-kpi-card" style="border-left:3px solid #ea580c;"><div class="m-kpi-label">📦 SẮP HẾT</div><div class="m-kpi-value" style="color:#ea580c;">${warning}</div></div>
                <div class="m-kpi-card" style="border-left:3px solid #16a34a;"><div class="m-kpi-label">✅ ĐỦ HÀNG</div><div class="m-kpi-value" style="color:#16a34a;">${good}</div></div>
                <div class="m-kpi-card" style="border-left:3px solid #378ADD;"><div class="m-kpi-label">📊 TỔNG</div><div class="m-kpi-value">${data.data.length}</div></div>
            </div>
            <div class="m-section"><div class="m-section-title">📦 DỰ BÁO NHU CẦU</div><div class="m-chart-card">${data.data.map(item => { const cls = item.warning_level === 'danger' ? 'm-text-red' : item.warning_level === 'warning' ? '' : ''; return `<div style="margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.05);"><div style="display:flex;justify-content:space-between;margin-bottom:2px;"><span class="${cls}" style="font-weight:600;">${escapeHtml(item.name)}</span><span>${item.status}</span></div><div style="display:flex;justify-content:space-between;font-size:11px;color:#7a8099;"><span>Tồn: ${Number(item.current_stock).toLocaleString('vi-VN')} | TB: ${Number(item.avg_monthly_usage).toLocaleString('vi-VN')}</span><span style="color:#378ADD;">Nhập: ${Number(item.suggested_order).toLocaleString('vi-VN')} ${item.unit}</span></div></div>`}).join('')}</div></div>
        `;
    } catch(e) {
        return '<div class="m-empty">❌ Lỗi tải dữ liệu</div>';
    }
}

// ========== TAB CẤU KIỆN ==========
function renderMDashStructures() {
    const structures = state.data.structures || [];
    const transactions = state.data.transactions || [];
    
    const produceTxns = transactions.filter(t => t.type === 'produce');
    const exportTxns = transactions.filter(t => t.type === 'structure_export');
    const totalProduced = produceTxns.reduce((s,t) => s + Number(t.qty||0), 0);
    const totalExported = exportTxns.reduce((s,t) => s + Number(t.qty||0), 0);
    const stockValue = structures.reduce((s, st) => s + (Number(st.qty||0) * Number(st.cost||0)), 0);
    
    const maxQty = Math.max(...structures.map(s => Number(s.qty||0)), 1);
    
    return `
        <div class="m-kpi-grid">
            <div class="m-kpi-card" style="border-left:3px solid #378ADD;"><div class="m-kpi-label">🏗️ TỔNG CK</div><div class="m-kpi-value">${structures.length}</div></div>
            <div class="m-kpi-card" style="border-left:3px solid #16a34a;"><div class="m-kpi-label">🏭 ĐÃ SX</div><div class="m-kpi-value">${Number(totalProduced).toLocaleString('vi-VN')}</div></div>
            <div class="m-kpi-card" style="border-left:3px solid #dc2626;"><div class="m-kpi-label">📤 ĐÃ XUẤT</div><div class="m-kpi-value">${Number(totalExported).toLocaleString('vi-VN')}</div></div>
            <div class="m-kpi-card" style="border-left:3px solid #0891b2;"><div class="m-kpi-label">💰 GIÁ TRỊ</div><div class="m-kpi-value">${formatMoneyVND(stockValue)}</div></div>
        </div>
        <div class="m-section"><div class="m-section-title">🏗️ TỒN KHO CẤU KIỆN</div><div class="m-chart-card">${structures.map(s => `<div style="margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.05);"><div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="font-weight:600;">${escapeHtml(s.name)}</span><span>${Number(s.qty||0).toLocaleString('vi-VN')} ${s.unit}</span></div><div class="m-bar-wrap"><div class="m-bar-fill" style="width:${(Number(s.qty||0)/maxQty*100).toFixed(0)}%;background:#378ADD;"></div></div><div style="font-size:10px;color:#7a8099;margin-top:2px;">${formatMoneyVND(s.cost)}/${s.unit} · Tổng: ${formatMoneyVND(Number(s.qty||0)*Number(s.cost||0))}</div></div>`).join('')}</div></div>
    `;
}

function drawDonutChart() {
    var canvas = document.getElementById('m-donut-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var projects = state.data.projects || [];
    var transactions = state.data.transactions || [];
    var totalBudget = projects.reduce(function(s, p) { return s + Number(p.budget||0); }, 0);
    var totalSpent = transactions.filter(function(t) { return t.type === 'usage'; }).reduce(function(s,t) { return s + (Number(t.totalAmount)||0); }, 0);
    var totalReturn = transactions.filter(function(t) { return t.type === 'return'; }).reduce(function(s,t) { return s + (Number(t.totalAmount)||0); }, 0);
    var net = totalSpent - totalReturn;
    var spentPct = totalBudget > 0 ? Math.min(100, (net / totalBudget * 100)) : 0;
    var remainPct = 100 - spentPct;
    
    var cx = 75, cy = 75, r = 55, w = 20;
    
    // Xóa canvas
    ctx.clearRect(0, 0, 150, 150);
    
    // Vẽ phần đã chi (màu đỏ)
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI/2, -Math.PI/2 + (spentPct/100) * Math.PI*2);
    ctx.lineWidth = w;
    ctx.strokeStyle = '#dc2626';
    ctx.stroke();
    
    // Vẽ phần còn lại (màu xanh)
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI/2 + (spentPct/100) * Math.PI*2, -Math.PI/2 + Math.PI*2);
    ctx.lineWidth = w;
    ctx.strokeStyle = '#16a34a';
    ctx.stroke();
    
    // Text ở giữa
    ctx.fillStyle = '#e8eaf0';
    ctx.font = 'bold 18px IBM Plex Sans';
    ctx.textAlign = 'center';
    ctx.fillText(spentPct.toFixed(1) + '%', cx, cy - 2);
    ctx.fillStyle = '#7a8099';
    ctx.font = '10px IBM Plex Sans';
    ctx.fillText('đã sử dụng', cx, cy + 14);
}
window.updateMobileTotal = updateMobileTotal;

// ========== INIT ==========
export function initMobileEvents() {
// Fix chiều cao trên điện thoại thật
    function fixMobileHeight() {
        const app = document.getElementById('mobile-app-container');
        if (app) {
            app.style.height = window.innerHeight + 'px';
        }
    }
    fixMobileHeight();
    window.addEventListener('resize', fixMobileHeight);
    window.addEventListener('orientationchange', function() {
        setTimeout(fixMobileHeight, 300);
    });
    
    // Click outside menu    
document.addEventListener('click', function(e) {
        const menu = document.getElementById('m-menu');
        if (menu && !e.target.closest('.m-header-right')) { menu.style.display = 'none'; }
    });
}
