import { state, saveState, addLog, escapeHtml, showModal, closeModal } from './state.js';
import { formatMoneyVND, setupNumberInput } from './utils.js';

let structureListContainer = null;

export function renderStructures() {
    const structures = state.data.structures || [];
    
    let html = `<div class="card">
        <div class="sec-title" style="display:flex;justify-content:space-between;">
            <span>🏗️ DANH SÁCH CẤU KIỆN</span>
            <button class="sm primary" onclick="window.openStructureModal()">+ Thêm cấu kiện</button>
        </div>
        <div class="tbl-wrap">
            <table style="min-width:600px;">
                <thead><tr><th>Tên cấu kiện</th><th style="text-align:right;">Tồn kho</th><th>ĐVT</th><th style="text-align:right;">Đơn giá</th><th>Thao tác</th></tr></thead>
                <tbody>`;
    
    if (structures.length === 0) {
        html += '<tr><td colspan="5" style="text-align:center;">📭 Chưa có cấu kiện nào</td></tr>';
    } else {
        structures.forEach(s => {
            html += `<tr>
                <td><strong style="cursor:pointer;color:var(--accent);" onclick="window.showStructureDetail('${s.id}')">${escapeHtml(s.name)}</strong></td>
                <td style="text-align:right;">${Number(s.qty||0).toLocaleString('vi-VN')} ${s.unit}</td>
                <td>${s.unit}</td>
                <td style="text-align:right;">${formatMoneyVND(s.cost)}</td>
                <td>
                    <button class="sm" onclick="window.openStructureModal('${s.id}')">✏️</button>
                    <button class="sm primary" onclick="window.produceStructure('${s.id}')">🏭 Sản xuất</button>
                    <button class="sm" onclick="window.exportStructure('${s.id}')">📤 Xuất CT</button>
                    <button class="sm danger-btn" onclick="window.deleteStructure('${s.id}')">🗑️</button>
                </td>
            </tr>`;
        });
    }
    
    html += `</tbody></table></div></div>`;
    return html;
}

window.openStructureModal = function(sid = null) {
    const s = sid ? (state.data.structures||[]).find(x => x.id === sid) : null;
    const materialOpts = state.data.materials.map(m => 
        `<option value="${m.id}" data-unit="${m.unit}">${escapeHtml(m.name)} (Tồn: ${Number(m.qty).toLocaleString('vi-VN')} ${m.unit})</option>`
    ).join('');
    const existingMats = s?.materials || [];
    
    showModal(`
        <div class="modal-hd"><span class="modal-title">${s ? '✏️ Sửa' : '➕ Thêm'} cấu kiện</span><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-bd">
            <div class="form-grid2">
                <div class="form-group form-full"><label class="form-label">Tên cấu kiện</label><input id="s-name" value="${escapeHtml(s?.name||'')}"></div>
                <div class="form-group"><label class="form-label">Đơn vị tính</label><input id="s-unit" value="${s?.unit||'cái'}"></div>
                <div class="form-group"><label class="form-label">Đơn giá (tự động từ BOM)</label><input type="text" id="s-cost" value="${s?.cost||0}" dir="ltr" readonly style="background:var(--surface3);"></div>
            </div>
            <div class="sec-title" style="margin-top:16px;">📦 THÀNH PHẦN CẤU KIỆN (BOM)</div>
            <div id="bom-list">
                ${existingMats.length > 0 ? existingMats.map(m => {
                    const mat = state.data.materials.find(x => x.id === m.materialId);
                    return `<div class="bom-row" style="display:flex;gap:8px;margin-bottom:8px;">
                        <select class="bom-mat" style="flex:2;" onchange="window.updateBomCost()">
                            ${materialOpts.replace(`value="${m.materialId}"`, `value="${m.materialId}" selected`)}
                        </select>
                        <input type="text" class="bom-qty" value="${m.quantity}" style="width:80px;" dir="ltr" oninput="window.updateBomCost()">
                        <button class="sm danger-btn" onclick="this.parentElement.remove();window.updateBomCost()">✕</button>
                    </div>`;
                }).join('') : ''}
            </div>
            <button class="sm" onclick="window.addBomRow()">+ Thêm vật tư</button>
            <div class="metric-sub" style="margin-top:8px;" id="bom-total">Tổng giá: 0 ₫</div>
        </div>
        <div class="modal-ft">
            <button onclick="closeModal()">Hủy</button>
            <button class="primary" onclick="window.saveStructure('${s?.id||''}')">Lưu</button>
        </div>
    `);
    
    setTimeout(() => { window.updateBomCost(); }, 100);
};

window.addBomRow = function() {
    const materialOpts = state.data.materials.map(m => 
        `<option value="${m.id}" data-unit="${m.unit}">${escapeHtml(m.name)} (Tồn: ${Number(m.qty).toLocaleString('vi-VN')} ${m.unit})</option>`
    ).join('');
    const div = document.createElement('div');
    div.className = 'bom-row';
    div.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;';
    div.innerHTML = `<select class="bom-mat" style="flex:2;" onchange="window.updateBomCost()">${materialOpts}</select><input type="text" class="bom-qty" value="1" style="width:80px;" dir="ltr" oninput="window.updateBomCost()"><button class="sm danger-btn" onclick="this.parentElement.remove();window.updateBomCost()">✕</button>`;
    document.getElementById('bom-list').appendChild(div);
    window.updateBomCost();
};

window.updateBomCost = function() {
    let total = 0;
    document.querySelectorAll('.bom-row').forEach(row => {
        const matId = row.querySelector('.bom-mat')?.value;
        const qty = parseFloat(row.querySelector('.bom-qty')?.value?.replace(/\./g,'').replace(',','.')) || 0;
        if (matId) {
            const mat = state.data.materials.find(m => m.id === matId);
            if (mat) total += qty * (mat.cost||0);
        }
    });
    document.getElementById('bom-total').innerText = 'Tổng giá: ' + formatMoneyVND(total);
    const costInput = document.getElementById('s-cost');
    if (costInput) costInput.value = Math.round(total).toLocaleString('vi-VN');
};

window.saveStructure = function(sid) {
    const name = document.getElementById('s-name')?.value.trim();
    if (!name) return alert('Nhập tên cấu kiện');
    const unit = document.getElementById('s-unit')?.value || 'cái';
    const cost = parseInt(document.getElementById('s-cost')?.value.replace(/[^0-9]/g,'')) || 0;
    
    const materials = [];
    document.querySelectorAll('.bom-row').forEach(row => {
        const matId = row.querySelector('.bom-mat')?.value;
        const qty = parseFloat(row.querySelector('.bom-qty')?.value?.replace(/\./g,'').replace(',','.')) || 0;
        if (matId && qty > 0) {
            const mat = state.data.materials.find(m => m.id === matId);
            materials.push({ materialId: matId, materialName: mat?.name||'', unit: mat?.unit||'', quantity: qty });
        }
    });
    
    const id = sid || 'tvsck' + Date.now().toString(36).slice(-8);
    const struct = { id, name, unit, qty: (state.data.structures||[]).find(x=>x.id===sid)?.qty||0, cost, materials };
    
    if (!state.data.structures) state.data.structures = [];
    const idx = state.data.structures.findIndex(x => x.id === sid);
    if (idx >= 0) state.data.structures[idx] = struct; else state.data.structures.push(struct);
    
    fetch('/api/structures', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(struct) });
    saveState();
    addLog(sid ? 'Sửa cấu kiện' : 'Thêm cấu kiện', name);
    closeModal();
    if (window.render) window.render();
};

window.produceStructure = function(sid) {
    const qty = prompt('Số lượng sản xuất:');
    if (!qty || isNaN(qty) || parseFloat(qty) <= 0) return;
    fetch('/api/produce-structure', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ structureId: sid, quantity: parseFloat(qty) }) })
        .then(r => r.json())
        .then(d => {
            if (d.success) { alert('✅ Sản xuất thành công!'); window.loadState().then(function(){ window.render(); }); }
            else alert('❌ Lỗi: ' + d.error);
        });
};

window.deleteStructure = function(sid) {
    const s = (state.data.structures||[]).find(x => x.id === sid);
    if (!confirm(`Xóa cấu kiện "${s?.name}"?`)) return;
    state.data.structures = (state.data.structures||[]).filter(x => x.id !== sid);
    fetch('/api/structures/' + sid, { method: 'DELETE' });
    saveState();
    if (window.render) window.render();
};

window.exportStructure = function(sid) {
    const s = (state.data.structures||[]).find(x => x.id === sid);
    if (!s || parseFloat(s.qty) <= 0) return alert('Không có cấu kiện trong kho!');
    if (state.data.projects.length === 0) return alert('Chưa có công trình!');
    
    var projOpts = state.data.projects.map(p => '<option value="' + p.id + '">' + escapeHtml(p.name) + '</option>').join('');
    showModal(`
        <div class="modal-hd"><span class="modal-title">📤 Xuất cấu kiện ra công trình</span><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-bd">
            <div class="form-group"><label class="form-label">Cấu kiện</label><input value="${escapeHtml(s.name)} (Tồn: ${Number(s.qty).toLocaleString('vi-VN')} ${s.unit})" disabled></div>
            <div class="form-group"><label class="form-label">Công trình</label><select id="exp-proj">${projOpts}</select></div>
            <div class="form-group"><label class="form-label">Số lượng</label><input type="text" id="exp-qty" value="1" dir="ltr"></div>
            <div class="form-group"><label class="form-label">Ghi chú</label><input id="exp-note" placeholder="Ghi chú..."></div>
        </div>
        <div class="modal-ft"><button onclick="closeModal()">Hủy</button><button class="primary" onclick="window.confirmExportStructure('${sid}')">Xác nhận xuất</button></div>
    `);
    setTimeout(function(){
        var qtyInput = document.getElementById('exp-qty');
        if (qtyInput) {
            qtyInput.addEventListener('input', function(){
                var v = this.value.replace(/[^\d,]/g, '');
                this.value = v;
            });
        }
    }, 100);
};

window.confirmExportStructure = function(sid) {
    var pid = document.getElementById('exp-proj')?.value;
    var qty = parseFloat(document.getElementById('exp-qty')?.value?.replace(/\./g,'').replace(',','.')) || 0;
    var note = document.getElementById('exp-note')?.value || '';
    if (!pid || qty <= 0) return alert('Thiếu thông tin!');
    
    var s = (state.data.structures||[]).find(x => x.id === sid);
    if (!s || parseFloat(s.qty) < qty) return alert('Không đủ cấu kiện trong kho!');
    
    // Gọi API xuất cấu kiện
    fetch('/api/export-structure', { method: 'POST', headers: {'Content-Type':'application/json'}, 
        body: JSON.stringify({ structureId: sid, projectId: pid, quantity: qty, note: note }) })
        .then(r => r.json())
        .then(d => {
            if (d.success) {
                alert('✅ Đã xuất cấu kiện ra công trình!');
                closeModal();
                window.loadState().then(function(){ window.render(); });
            } else alert('❌ Lỗi: ' + d.error);
        });
};

export const getStructures = () => state.data.structures || [];

window.showStructureDetail = function(sid) {
    const s = (state.data.structures||[]).find(x => x.id === sid);
    if (!s) return;
    
    const produceTxns = state.data.transactions
        .filter(t => t.mid === sid && t.type === 'produce')
        .sort((a,b) => new Date(b.datetime||b.date) - new Date(a.datetime||a.date));
    
    const totalProduced = produceTxns.reduce((sum, t) => sum + Number(t.qty||0), 0);
    
    let html = `<div class="modal-hd" style="background:var(--accent-bg);">
        <span class="modal-title" style="font-size:20px;">🏗️ Cấu kiện: ${escapeHtml(s.name)} (${s.id})</span>
        <button class="xbtn" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-bd" style="max-height:70vh;overflow-y:auto;">
        <div class="grid4" style="margin-bottom:20px;">
            <div class="metric-card"><div class="metric-label">📦 TỒN KHO</div><div class="metric-val" style="font-size:18px;">${Number(s.qty||0).toLocaleString('vi-VN')} ${s.unit}</div></div>
            <div class="metric-card"><div class="metric-label">💰 ĐƠN GIÁ</div><div class="metric-val" style="font-size:18px;">${formatMoneyVND(s.cost)}</div></div>
            <div class="metric-card"><div class="metric-label">🏭 ĐÃ SẢN XUẤT</div><div class="metric-val" style="font-size:18px;color:var(--accent);">${totalProduced} ${s.unit}</div></div>
            <div class="metric-card"><div class="metric-label">📋 SỐ LẦN</div><div class="metric-val" style="font-size:18px;">${produceTxns.length}</div></div>
        </div>
        
        <div class="sec-title">📦 THÀNH PHẦN (BOM)</div>
        <div class="tbl-wrap" style="margin-bottom:20px;">
            <table style="min-width:400px;"><thead><tr><th>Vật tư</th><th style="text-align:right;">SL / 1 cấu kiện</th><th>ĐVT</th></tr></thead>
                <tbody>${(s.materials||[]).map(m => `<tr><td>${escapeHtml(m.materialName)}</td><td style="text-align:right;">${Number(m.quantity).toLocaleString('vi-VN')}</td><td>${m.unit}</td></tr>`).join('')}</tbody>
            </table>
        </div>
        
        <div class="sec-title">🏭 LỊCH SỬ SẢN XUẤT (${produceTxns.length} lần)</div>
        <div class="tbl-wrap">
            <table style="min-width:600px;">
                <thead><tr><th style="text-align:left;">Thời gian</th><th style="text-align:right;">SL</th><th style="text-align:left;">Ghi chú</th></tr></thead>
                <tbody>${produceTxns.length > 0 ? produceTxns.map(t => {
                    const dt = t.datetime ? new Date(t.datetime).toLocaleString('vi-VN', {hour:'2-digit',minute:'2-digit',second:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'}) : t.date;
                    return `<tr><td style="white-space:nowrap;">${dt}</td><td style="text-align:right;font-weight:bold;color:var(--accent);">${Number(t.qty||0).toLocaleString('vi-VN')} ${s.unit}</td><td>${escapeHtml(t.note||'—')}</td></tr>`;
                }).join('') : '<tr><td colspan="3" style="text-align:center;">📭 Chưa có lịch sử sản xuất</td></tr>'}</tbody>
            </table>
        </div>
    </div>
    <div class="modal-ft"><button onclick="closeModal()">Đóng</button><button class="primary" onclick="closeModal();window.produceStructure('${sid}')">🏭 Sản xuất</button></div>`;
    
    showModal(html, null);
};

window.showStructureDetail = function(sid) {
    const s = (state.data.structures||[]).find(x => x.id === sid);
    if (!s) return;
    
    const produceTxns = state.data.transactions
        .filter(t => t.mid === sid && t.type === 'produce')
        .sort((a,b) => new Date(b.datetime||b.date) - new Date(a.datetime||a.date));
    
    const totalProduced = produceTxns.reduce((sum, t) => sum + Number(t.qty||0), 0);
    
    let html = `<div class="modal-hd" style="background:var(--accent-bg);">
        <span class="modal-title" style="font-size:20px;">🏗️ Cấu kiện: ${escapeHtml(s.name)} (${s.id})</span>
        <button class="xbtn" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-bd" style="max-height:70vh;overflow-y:auto;">
        <div class="grid4" style="margin-bottom:20px;">
            <div class="metric-card"><div class="metric-label">📦 TỒN KHO</div><div class="metric-val" style="font-size:18px;">${Number(s.qty||0).toLocaleString('vi-VN')} ${s.unit}</div></div>
            <div class="metric-card"><div class="metric-label">💰 ĐƠN GIÁ</div><div class="metric-val" style="font-size:18px;">${formatMoneyVND(s.cost)}</div></div>
            <div class="metric-card"><div class="metric-label">🏭 ĐÃ SẢN XUẤT</div><div class="metric-val" style="font-size:18px;color:var(--accent);">${totalProduced} ${s.unit}</div></div>
            <div class="metric-card"><div class="metric-label">📋 SỐ LẦN</div><div class="metric-val" style="font-size:18px;">${produceTxns.length}</div></div>
        </div>
        
        <div class="sec-title">📦 THÀNH PHẦN (BOM)</div>
        <div class="tbl-wrap" style="margin-bottom:20px;">
            <table style="min-width:400px;"><thead><tr><th>Vật tư</th><th style="text-align:right;">SL / 1 cấu kiện</th><th>ĐVT</th></tr></thead>
                <tbody>${(s.materials||[]).map(m => `<tr><td>${escapeHtml(m.materialName)}</td><td style="text-align:right;">${Number(m.quantity).toLocaleString('vi-VN')}</td><td>${m.unit}</td></tr>`).join('')}</tbody>
            </table>
        </div>
        
        <div class="sec-title">🏭 LỊCH SỬ SẢN XUẤT (${produceTxns.length} lần)</div>
        <div class="tbl-wrap">
            <table style="min-width:600px;">
                <thead><tr><th style="text-align:left;">Thời gian</th><th style="text-align:right;">SL</th><th style="text-align:left;">Ghi chú</th></tr></thead>
                <tbody>${produceTxns.length > 0 ? produceTxns.map(t => {
                    const dt = t.datetime ? new Date(t.datetime).toLocaleString('vi-VN', {hour:'2-digit',minute:'2-digit',second:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'}) : t.date;
                    return `<tr><td style="white-space:nowrap;">${dt}</td><td style="text-align:right;font-weight:bold;color:var(--accent);">${Number(t.qty||0).toLocaleString('vi-VN')} ${s.unit}</td><td>${escapeHtml(t.note||'—')}</td></tr>`;
                }).join('') : '<tr><td colspan="3" style="text-align:center;">📭 Chưa có lịch sử sản xuất</td></tr>'}</tbody>
            </table>
        </div>
    </div>
    <div class="modal-ft"><button onclick="closeModal()">Đóng</button><button class="primary" onclick="closeModal();window.produceStructure('${sid}')">🏭 Sản xuất</button></div>`;
    
    showModal(html, null);
};

window.showStructureDetail = function(sid) {
    const s = (state.data.structures||[]).find(x => x.id === sid);
    if (!s) return;
    
    const produceTxns = state.data.transactions
        .filter(t => t.mid === sid && t.type === 'produce')
        .sort((a,b) => new Date(b.datetime||b.date) - new Date(a.datetime||a.date));
    
    const totalProduced = produceTxns.reduce((sum, t) => sum + Number(t.qty||0), 0);
    
    let html = `<div class="modal-hd" style="background:var(--accent-bg);">
        <span class="modal-title" style="font-size:20px;">🏗️ Cấu kiện: ${escapeHtml(s.name)} (${s.id})</span>
        <button class="xbtn" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-bd" style="max-height:70vh;overflow-y:auto;">
        <div class="grid4" style="margin-bottom:20px;">
            <div class="metric-card"><div class="metric-label">📦 TỒN KHO</div><div class="metric-val" style="font-size:18px;">${Number(s.qty||0).toLocaleString('vi-VN')} ${s.unit}</div></div>
            <div class="metric-card"><div class="metric-label">💰 ĐƠN GIÁ</div><div class="metric-val" style="font-size:18px;">${formatMoneyVND(s.cost)}</div></div>
            <div class="metric-card"><div class="metric-label">🏭 ĐÃ SẢN XUẤT</div><div class="metric-val" style="font-size:18px;color:var(--accent);">${totalProduced} ${s.unit}</div></div>
            <div class="metric-card"><div class="metric-label">📋 SỐ LẦN</div><div class="metric-val" style="font-size:18px;">${produceTxns.length}</div></div>
        </div>
        
        <div class="sec-title">📦 THÀNH PHẦN (BOM)</div>
        <div class="tbl-wrap" style="margin-bottom:20px;">
            <table style="min-width:400px;"><thead><tr><th>Vật tư</th><th style="text-align:right;">SL / 1 cấu kiện</th><th>ĐVT</th></tr></thead>
                <tbody>${(s.materials||[]).map(m => `<tr><td>${escapeHtml(m.materialName)}</td><td style="text-align:right;">${Number(m.quantity).toLocaleString('vi-VN')}</td><td>${m.unit}</td></tr>`).join('')}</tbody>
            </table>
        </div>
        
        <div class="sec-title">🏭 LỊCH SỬ SẢN XUẤT (${produceTxns.length} lần)</div>
        <div class="tbl-wrap">
            <table style="min-width:600px;">
                <thead><tr><th style="text-align:left;">Thời gian</th><th style="text-align:right;">SL</th><th style="text-align:left;">Ghi chú</th></tr></thead>
                <tbody>${produceTxns.length > 0 ? produceTxns.map(t => {
                    const dt = t.datetime ? new Date(t.datetime).toLocaleString('vi-VN', {hour:'2-digit',minute:'2-digit',second:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'}) : t.date;
                    return `<tr><td style="white-space:nowrap;">${dt}</td><td style="text-align:right;font-weight:bold;color:var(--accent);">${Number(t.qty||0).toLocaleString('vi-VN')} ${s.unit}</td><td>${escapeHtml(t.note||'—')}</td></tr>`;
                }).join('') : '<tr><td colspan="3" style="text-align:center;">📭 Chưa có lịch sử sản xuất</td></tr>'}</tbody>
            </table>
        </div>
    </div>
    <div class="modal-ft"><button onclick="closeModal()">Đóng</button><button class="primary" onclick="closeModal();window.produceStructure('${sid}')">🏭 Sản xuất</button></div>`;
    
    showModal(html, null);
};
