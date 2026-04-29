import { state, saveState, addLog, formatMoney, escapeHtml, showModal, closeModal, genPid, projectById, hasPermission } from './state.js';
import { handleIntegerInput, formatMoneyVND, setupNumberInput, parseNumber } from './utils.js';
import { getProjectSchedule, renderScheduleView, updateScheduleInfo, saveScheduleInfo, addTask, updateTask, deleteTask, assignMaterialToTask, removeMaterialFromTask, openTaskDetailModal } from './schedule.js';

let projectFilters = { keyword: '', budgetMin: '', budgetMax: '', status: '' };
let projectListContainer = null;
let currentScheduleProjectId = null;
let projectViewMode = 'large';

const savedView = localStorage.getItem('steeltrack_project_view');
if (savedView) projectViewMode = savedView;

function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return '';
    return new Date(dateTimeStr).toLocaleString('vi-VN');
}

function getCurrentDateTime() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
}

function getFilteredProjects() {
    let result = [...state.data.projects];
    const f = projectFilters;
    if (f.keyword) { const kw = f.keyword.toLowerCase(); result = result.filter(p => p.name.toLowerCase().includes(kw) || p.id.toLowerCase().includes(kw)); }
    if (f.budgetMin) { const min = Number(f.budgetMin); if (!isNaN(min)) result = result.filter(p => p.budget >= min); }
    if (f.budgetMax) { const max = Number(f.budgetMax); if (!isNaN(max)) result = result.filter(p => p.budget <= max); }
    if (f.status && f.status !== 'all') {
        result = result.filter(p => {
            const total = getProjectTotalReceived(p.id);
            const rem = p.budget - total;
            if (f.status === 'has_budget') return rem > 0;
            if (f.status === 'out_of_budget') return rem <= 0;
            if (f.status === 'over_budget') return total > p.budget;
            return true;
        });
    }
    return result;
}

function getProjectTotalReceived(projectId) {
    const r = state.data.transactions.filter(t => t.projectId === projectId && t.type === 'usage').reduce((s, t) => s + (t.totalAmount || 0), 0);
    const rt = state.data.transactions.filter(t => t.projectId === projectId && t.type === 'return').reduce((s, t) => s + (t.totalAmount || 0), 0);
    return r - rt;
}

function getMaterialUsageDetails(projectId) {
    const receiveTxns = state.data.transactions.filter(t => t.projectId === projectId && t.type === 'usage');
    const returnTxns = state.data.transactions.filter(t => t.projectId === projectId && t.type === 'return');
    const usageRecords = state.data.projectMaterialUsage?.filter(u => u.projectId === projectId) || [];
    const schedule = state.data.projectSchedules?.find(s => s.projectId === projectId);
    const scheduleMaterialUsage = {};
    
    if (schedule?.tasks?.length > 0) {
        function getAllTasksFlat(tasks) { let r = []; for (const t of tasks) { r.push(t); if (t.subTasks?.length > 0) r = r.concat(getAllTasksFlat(t.subTasks)); } return r; }
        for (const task of getAllTasksFlat(schedule.tasks)) {
            if (task.materials?.length > 0) {
                for (const mat of task.materials) {
                    if (!scheduleMaterialUsage[mat.materialId]) scheduleMaterialUsage[mat.materialId] = { quantity: 0 };
                    scheduleMaterialUsage[mat.materialId].quantity += mat.quantity || 0;
                }
            }
        }
    }
    
    const materialMap = new Map();
    receiveTxns.forEach(t => {
        const mat = state.data.materials.find(m => m.id === t.mid);
        if (mat) {
            if (!materialMap.has(t.mid)) materialMap.set(t.mid, { id: t.mid, name: mat.name, unit: mat.unit, totalReceived: 0, totalUsed: 0, totalReturned: 0, fromSchedule: 0, fromManualUpdate: 0, lastUnitPrice: t.unitPrice });
            materialMap.get(t.mid).totalReceived += t.qty;
        }
    });
    returnTxns.forEach(t => { if (materialMap.has(t.mid)) materialMap.get(t.mid).totalReturned += t.qty; });
    usageRecords.forEach(r => { if (materialMap.has(r.materialId)) materialMap.get(r.materialId).fromManualUpdate = Math.max(materialMap.get(r.materialId).fromManualUpdate, r.usedQty || 0); });
    for (const [matId, data] of Object.entries(scheduleMaterialUsage)) {
        if (materialMap.has(matId)) materialMap.get(matId).fromSchedule = data.quantity;
    }
    materialMap.forEach(item => {
        item.totalUsed = Math.max(item.fromSchedule, item.fromManualUpdate);
        item.remainingAtSite = Math.max(0, item.totalReceived - item.totalUsed - item.totalReturned);
        item.usagePercentage = item.totalReceived > 0 ? (item.totalUsed / item.totalReceived) * 100 : 0;
    });
    return Array.from(materialMap.values());
}

function renderProjectHistory() {
    const transactions = state.data.transactions
        .filter(t => (t.type === 'usage' || t.type === 'return') && t.projectId)
        .sort((a, b) => new Date(b.datetime || b.date) - new Date(a.datetime || a.date))
        .slice(0, 50);
    
    if (transactions.length === 0) return '<tr><td colspan="7" style="text-align:center;">📭 Chưa có dữ liệu</td></tr>';
    
    return transactions.map(t => {
        const mat = state.data.materials.find(m => m.id === t.mid);
        const proj = projectById(t.projectId);
        const isReturn = t.type === 'return';
        return `<tr>
            <td style="white-space:nowrap;">${formatDateTime(t.datetime || t.date)}</td>
            <td><strong>${escapeHtml(proj?.name || 'N/A')}</strong></td>
            <td>${escapeHtml(mat?.name || 'N/A')}</td>
            <td style="text-align:right;">${(t.qty||0).toLocaleString('vi-VN')} ${mat?.unit||''}</td>
            <td style="text-align:right;">${formatMoneyVND(t.unitPrice)}</td>
            <td class="amount ${isReturn?'text-success':'text-warning'}">${isReturn?'- ':''}${formatMoneyVND(t.totalAmount)}</td>
            <td style="text-align:center;color:${isReturn?'var(--success-text)':'var(--accent)'}">${isReturn?'🔄 Trả kho':'📥 Nhận từ kho'}</td>
        </tr>`;
    }).join('');
}

function updateProjectListDisplay() {
    if (!projectListContainer) return;
    const filtered = getFilteredProjects();
    
    if (filtered.length === 0) {
        projectListContainer.innerHTML = '<div class="metric-sub">📭 Không tìm thấy công trình</div>';
        return;
    }
    
    const projectsData = filtered.map(p => {
        const r = state.data.transactions.filter(t => t.projectId === p.id && t.type === 'usage').reduce((s,t) => s+(t.totalAmount||0),0);
        const rt = state.data.transactions.filter(t => t.projectId === p.id && t.type === 'return').reduce((s,t) => s+(t.totalAmount||0),0);
        const net = r - rt; p.spent = net;
        const pct = p.budget > 0 ? (net/p.budget)*100 : 0;
        const rem = p.budget - net;
        return { ...p, net, pct, rem };
    });
    
    if (projectViewMode === 'small') {
        projectListContainer.innerHTML = `<div class="project-grid-small">${projectsData.map(p => `
            <div class="metric-card" onclick="window.showProjectDetail('${p.id}')" style="cursor:pointer;">
                <div style="display:flex;justify-content:space-between;"><strong>${escapeHtml(p.name)}</strong><span class="tag">${p.id}</span></div>
                <div style="font-size:18px;margin-top:6px;color:var(--accent);">${formatMoneyVND(p.net)}</div>
                <div class="progress-bar" style="margin-top:6px;"><div class="progress-fill" style="width:${Math.min(100,p.pct)}%;background:${p.pct>90?'#A32D2D':'#378ADD'}"></div></div>
                <div class="metric-sub">${p.pct.toFixed(1)}% | NS: ${formatMoneyVND(p.budget)}</div>
                <div style="margin-top:6px;display:flex;gap:4px;">
                    ${hasPermission('canCreateMaterial')?`<button class="sm" onclick="event.stopPropagation();window.editProject('${p.id}')">✏️</button>`:''}
                    ${hasPermission('canDeleteProject')?`<button class="sm danger-btn" onclick="event.stopPropagation();window.deleteProjectHandler('${p.id}')">🗑️</button>`:''}
                </div>
            </div>`).join('')}</div>`;
    } else if (projectViewMode === 'list') {
        projectListContainer.innerHTML = `<div class="project-list">${projectsData.map(p => `
            <div class="project-list-item" onclick="window.showProjectDetail('${p.id}')">
                <span class="tag">${p.id}</span>
                <strong style="flex:1;">${escapeHtml(p.name)}</strong>
                <span style="color:var(--accent);font-weight:bold;">${formatMoneyVND(p.net)}</span>
                <div class="progress-bar" style="width:100px;"><div class="progress-fill" style="width:${Math.min(100,p.pct)}%;background:${p.pct>90?'#A32D2D':'#378ADD'}"></div></div>
                <span class="metric-sub">${p.pct.toFixed(1)}%</span>
                <span class="metric-sub">NS: ${formatMoneyVND(p.budget)}</span>
                ${hasPermission('canCreateMaterial')?`<button class="sm" onclick="event.stopPropagation();window.editProject('${p.id}')">✏️</button>`:''}
                ${hasPermission('canDeleteProject')?`<button class="sm danger-btn" onclick="event.stopPropagation();window.deleteProjectHandler('${p.id}')">🗑️</button>`:''}
            </div>`).join('')}</div>`;
    } else {
        projectListContainer.innerHTML = `<div class="project-grid-large">${projectsData.map(p => `
            <div class="metric-card" onclick="window.showProjectDetail('${p.id}')" style="cursor:pointer;">
                <div style="display:flex;justify-content:space-between;"><div class="metric-label">🏗️ ${escapeHtml(p.name)}</div><div class="tag">${p.id}</div></div>
                <div class="metric-val" style="font-size:28px;color:var(--accent)">${formatMoneyVND(p.net)}</div>
                <div class="metric-sub">💰 NS: ${formatMoneyVND(p.budget)} | Còn: ${formatMoneyVND(p.rem)}</div>
                <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(100,p.pct)}%;background:${p.pct>90?'#A32D2D':'#378ADD'}"></div></div>
                <div class="metric-sub">${p.pct.toFixed(1)}%</div>
                <div style="margin-top:8px;display:flex;gap:6px;">
                    ${hasPermission('canCreateMaterial')?`<button class="sm" onclick="event.stopPropagation();window.editProject('${p.id}')">✏️ Sửa</button>`:''}
                    ${hasPermission('canDeleteProject')?`<button class="sm danger-btn" onclick="event.stopPropagation();window.deleteProjectHandler('${p.id}')">🗑️ Xóa</button>`:''}
                </div>
            </div>`).join('')}</div>`;
    }
}

function updateProjectHistoryDisplay() {
    const hc = document.getElementById('project-history-tbody');
    if (hc) hc.innerHTML = renderProjectHistory();
}

function renderProjectSearchBar() {
    const statusOpts = [{v:'',l:'📂 Tất cả'},{v:'has_budget',l:'💰 Còn NS'},{v:'out_of_budget',l:'⚠️ Hết NS'},{v:'over_budget',l:'🔥 Quá NS'}];
    return `<div class="card" style="margin-bottom:16px;">
        <div class="sec-title">🔍 TÌM KIẾM CÔNG TRÌNH</div>
        <div style="display:flex;flex-wrap:wrap;gap:10px;">
            <input type="text" id="proj-search-keyword" placeholder="Tên hoặc mã..." value="${escapeHtml(projectFilters.keyword)}" style="flex:2;min-width:180px;">
            <input type="text" id="proj-search-budget-min" placeholder="NS ≥" value="${projectFilters.budgetMin||''}" style="width:120px;" dir="ltr">
            <input type="text" id="proj-search-budget-max" placeholder="NS ≤" value="${projectFilters.budgetMax||''}" style="width:120px;" dir="ltr">
            <select id="proj-search-status" style="width:140px;">${statusOpts.map(o=>`<option value="${o.v}" ${projectFilters.status===o.v?'selected':''}>${o.l}</option>`).join('')}</select>
            <button id="proj-clear-filters" class="sm">🗑️ Xóa</button>
        </div>
    </div>`;
}

function bindProjectSearchEvents() {
    const kw = document.getElementById('proj-search-keyword');
    const bmin = document.getElementById('proj-search-budget-min');
    const bmax = document.getElementById('proj-search-budget-max');
    const st = document.getElementById('proj-search-status');
    const clr = document.getElementById('proj-clear-filters');
    const update = () => {
        projectFilters.keyword = kw?.value || '';
        projectFilters.budgetMin = bmin?.value.replace(/[^0-9]/g,'') || '';
        projectFilters.budgetMax = bmax?.value.replace(/[^0-9]/g,'') || '';
        projectFilters.status = st?.value || '';
        updateProjectListDisplay(); updateProjectHistoryDisplay();
    };
    if (kw) kw.oninput = update;
    if (bmin) bmin.addEventListener('input', update);
    if (bmax) bmax.addEventListener('input', update);
    if (st) st.onchange = update;
    if (clr) clr.onclick = () => {
        projectFilters = { keyword: '', budgetMin: '', budgetMax: '', status: '' };
        if (kw) kw.value = ''; if (bmin) bmin.value = ''; if (bmax) bmax.value = ''; if (st) st.value = '';
        updateProjectListDisplay(); updateProjectHistoryDisplay();
    };
}

window.setProjectView = function(mode) {
    projectViewMode = mode;
    localStorage.setItem('steeltrack_project_view', mode);
    updateProjectListDisplay();
};

function initResizablePanels() {
    const container = document.getElementById('projects-resizable-container');
    if (!container) return;
    container.querySelectorAll('.panel-resize-handle').forEach(handle => {
        const nh = handle.cloneNode(true); handle.parentNode.replaceChild(nh, handle);
        const panel = document.getElementById(nh.dataset.target);
        if (!panel) return;
        const content = panel.querySelector('.panel-content');
        let sy = 0, sh = 0, resizing = false;
        nh.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); resizing = true; sy = e.clientY; sh = content.offsetHeight; document.body.style.cursor = 'ns-resize'; });
        const mm = e => { if (!resizing) return; const h = Math.max(150, Math.min(500, sh + e.clientY - sy)); content.style.height = h + 'px'; content.style.maxHeight = h + 'px'; };
        const mu = () => { if (resizing) { resizing = false; document.body.style.cursor = ''; document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); } };
        document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu);
    });
}

export function showProjectDetail(projectId) {
    const project = projectById(projectId);
    if (!project) return;
    currentScheduleProjectId = projectId;
    window.currentScheduleProjectId = projectId;
    
    const rTxns = state.data.transactions.filter(t => t.projectId === projectId && t.type === 'usage');
    const retTxns = state.data.transactions.filter(t => t.projectId === projectId && t.type === 'return');
    const totalR = rTxns.reduce((s,t) => s + (t.totalAmount||0), 0);
    const totalRet = retTxns.reduce((s,t) => s + (t.totalAmount||0), 0);
    const spent = totalR - totalRet;
    const rem = project.budget - spent;
    const pct = project.budget > 0 ? (spent/project.budget)*100 : 0;
    const allTxns = [...rTxns, ...retTxns].sort((a,b) => new Date(b.datetime||b.date) - new Date(a.datetime||a.date));
    const matUsage = getMaterialUsageDetails(projectId);
    const schedule = getProjectSchedule(projectId);
    
    const html = `
        <div class="modal-hd" style="background:var(--accent-bg);"><span class="modal-title" style="font-size:20px;">🏗️ ${escapeHtml(project.name)}</span><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-bd" style="max-height:70vh;overflow-y:auto;">
            <div style="display:flex;gap:4px;border-bottom:0.5px solid var(--border);margin-bottom:20px;">
                <button class="sm tab-btn active" data-tab="overview">📊 Tổng quan</button>
                <button class="sm tab-btn" data-tab="materials">📦 Vật tư</button>
                <button class="sm tab-btn" data-tab="schedule">📅 Tiến độ</button>
                <button class="sm tab-btn" data-tab="history">📜 Lịch sử</button>
            </div>
            <div id="tab-overview" class="tab-content active">
                <div class="grid2" style="margin-bottom:20px;">
                    <div class="metric-card"><div class="metric-label">📋 MÃ</div><div class="metric-val" style="font-size:18px;">${project.id}</div></div>
                    <div class="metric-card"><div class="metric-label">💰 NGÂN SÁCH</div><div class="metric-val" style="font-size:18px;color:var(--accent);">${formatMoneyVND(project.budget)}</div></div>
                    <div class="metric-card"><div class="metric-label">📥 ĐÃ NHẬN</div><div class="metric-val" style="font-size:18px;color:var(--warn-text);">${formatMoneyVND(totalR)}</div></div>
                    <div class="metric-card"><div class="metric-label">🔄 ĐÃ TRẢ</div><div class="metric-val" style="font-size:18px;color:var(--success-text);">${formatMoneyVND(totalRet)}</div></div>
                    <div class="metric-card"><div class="metric-label">💸 ĐÃ SỬ DỤNG</div><div class="metric-val" style="font-size:18px;">${formatMoneyVND(spent)}</div></div>
                    <div class="metric-card"><div class="metric-label">📊 CÒN LẠI</div><div class="metric-val" style="font-size:18px;color:var(--success-text);">${formatMoneyVND(rem)}</div></div>
                </div>
                <div class="progress-bar" style="height:12px;"><div class="progress-fill" style="width:${Math.min(100,pct)}%;background:${pct>90?'#A32D2D':pct>70?'#BA7517':'#378ADD'};"></div></div>
                <div class="metric-sub" style="text-align:center;margin-top:8px;">${pct.toFixed(1)}% (${rTxns.length} nhận, ${retTxns.length} trả)</div>
            </div>
            <div id="tab-materials" class="tab-content" style="display:none;">
                <div class="tbl-wrap"><table style="min-width:800px;"><thead><tr><th>Vật tư</th><th>Đã nhận</th><th>Đã sử dụng</th><th>Đã trả</th><th>Tồn CT</th><th>%</th><th>Nguồn</th><th>Thao tác</th></tr></thead>
                <tbody>${matUsage.map(m => {
                    const cls = m.usagePercentage > 90 ? 'text-danger' : m.usagePercentage > 70 ? 'text-warning' : 'text-success';
                    let src = m.fromSchedule > 0 && m.fromManualUpdate > 0 ? '📅+✏️' : m.fromSchedule > 0 ? '📅 KH' : m.fromManualUpdate > 0 ? '✏️ TT' : '—';
                    return `<tr><td><strong>${escapeHtml(m.name)}</strong></td><td style="text-align:right;">${m.totalReceived.toLocaleString('vi-VN')} ${m.unit}</td><td style="text-align:right;font-weight:bold;">${m.totalUsed.toLocaleString('vi-VN')} ${m.unit}</td><td style="text-align:right;color:var(--success-text);">${m.totalReturned.toLocaleString('vi-VN')} ${m.unit}</td><td style="text-align:right;color:var(--accent);">${m.remainingAtSite.toLocaleString('vi-VN')} ${m.unit}</td><td><span class="badge ${cls}">${m.usagePercentage.toFixed(1)}%</span></td><td style="font-size:11px;">${src}</td><td><button class="sm" onclick="window.openMaterialUsageModal('${projectId}','${m.id}')">✏️</button></td></tr>`;
                }).join('') || '<tr><td colspan="8">📭 Chưa có vật tư</td></tr>'}</tbody></table></div>
            </div>
            <div id="tab-schedule" class="tab-content" style="display:none;"><div id="schedule-view-container"></div></div>
            <div id="tab-history" class="tab-content" style="display:none;">
                <div class="tbl-wrap"><table style="min-width:900px;"><thead><tr><th>Thời gian</th><th>Loại</th><th>Vật tư</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th><th>Ghi chú</th></tr></thead>
                <tbody>${allTxns.map(t => {
                    const mat = state.data.materials.find(m=>m.id===t.mid);
                    const isRet = t.type === 'return';
                    return `<tr><td style="white-space:nowrap;">${formatDateTime(t.datetime||t.date)}</td><td style="color:${isRet?'var(--success-text)':'var(--accent)'};font-weight:bold;">${isRet?'🔄 Trả':'📥 Nhận'}</td><td>${escapeHtml(mat?.name||'N/A')}</td><td style="text-align:right;">${(t.qty||0).toLocaleString('vi-VN')} ${mat?.unit||''}</td><td style="text-align:right;">${formatMoneyVND(t.unitPrice)}</td><td class="amount ${isRet?'text-success':'text-warning'}">${isRet?'- ':''}${formatMoneyVND(t.totalAmount)}</td><td>${escapeHtml(t.note||'—')}</td></tr>`;
                }).join('') || '<tr><td colspan="7">📭 Chưa có giao dịch</td></tr>'}</tbody></table></div>
            </div>
            <div style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end;">
                <button class="sm" onclick="closeModal();window.exportProjectDetail('${projectId}')">📎 Xuất Excel</button>
            </div>
        </div>
        <div class="modal-ft">
            <button onclick="closeModal()">Đóng</button>
            ${hasPermission('canExport')?`<button class="primary" onclick="closeModal();window.openTxnModal('usage','${projectId}')">📥 Nhận hàng</button>`:''}
            ${hasPermission('canImport')?`<button class="primary" style="background:var(--success);" onclick="closeModal();window.openReturnModal('${projectId}')">🔄 Trả hàng</button>`:''}
        </div>`;
    
    showModal(html, null);
    
    setTimeout(() => {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                const tab = document.getElementById(`tab-${btn.dataset.tab}`);
                if (tab) tab.style.display = 'block';
                btn.classList.add('active');
                if (btn.dataset.tab === 'schedule') renderScheduleView(projectId);
            };
        });
        renderScheduleView(projectId);
    }, 100);
}

export function exportProjectDetail(projectId) {
    const project = projectById(projectId);
    if (!project) return;
    const data = getMaterialUsageDetails(projectId).map(m => ({
        'Vật tư': m.name, 'ĐVT': m.unit, 'Đã nhận': m.totalReceived, 'Đã sử dụng': m.totalUsed, 'Đã trả': m.totalReturned, 'Tồn CT': m.remainingAtSite, '% SD': m.usagePercentage.toFixed(1)+'%'
    }));
    if (typeof XLSX !== 'undefined') {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Sử dụng vật tư');
        XLSX.writeFile(wb, `baocao_${project.id}.xlsx`);
        alert('✅ Đã xuất!');
    } else alert('Đang tải...');
}

export function exportAllProjectsReport() {
    const data = state.data.projects.map(p => {
        const r = state.data.transactions.filter(t=>t.projectId===p.id&&t.type==='usage').reduce((s,t)=>s+(t.totalAmount||0),0);
        const rt = state.data.transactions.filter(t=>t.projectId===p.id&&t.type==='return').reduce((s,t)=>s+(t.totalAmount||0),0);
        return {'Mã':p.id,'Tên':p.name,'NS':p.budget,'Đã nhận':r,'Đã trả':rt,'Đã SD':r-rt,'Còn':p.budget-(r-rt),'%':p.budget>0?((r-rt)/p.budget*100).toFixed(1):0};
    });
    if (typeof XLSX !== 'undefined') {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Công trình');
        XLSX.writeFile(wb, `congtrinh_${new Date().toISOString().split('T')[0]}.xlsx`);
        alert('✅ Đã xuất!');
    }
}

export function renderProjects() {
    const html = renderProjectSearchBar() + `<div class="card">
        <div class="resizable-container" id="projects-resizable-container">
            <div class="resizable-panel" id="projects-list-panel">
                <div class="panel-header">
                    <div style="display:flex;align-items:center;gap:12px;">
                        <div class="sec-title" style="margin-bottom:0;">🏗️ DANH SÁCH CÔNG TRÌNH</div>
                        <div class="view-toggle">
                            <button class="view-toggle-btn ${projectViewMode==='list'?'active':''}" onclick="window.setProjectView('list')" title="Danh sách ngang">☰</button>
                            <button class="view-toggle-btn ${projectViewMode==='small'?'active':''}" onclick="window.setProjectView('small')" title="Ô vuông nhỏ">⊞</button>
                            <button class="view-toggle-btn ${projectViewMode==='large'?'active':''}" onclick="window.setProjectView('large')" title="Ô vuông lớn">⊟</button>
                        </div>
                    </div>
                    <span class="resize-icon">⤥ Kéo</span>
                </div>
                <div class="panel-content" id="project-list-container" style="max-height:400px;overflow-y:auto;"></div>
                <div class="panel-resize-handle" data-target="projects-list-panel"></div>
            </div>
            <div class="resizable-panel" id="projects-history-panel">
                <div class="panel-header">
                    <div class="sec-title">📜 LỊCH SỬ NHẬN/TRẢ</div>
                    <span class="resize-icon">⤥ Kéo</span>
                </div>
                <div class="panel-content" style="max-height:300px;overflow-y:auto;">
                    <div class="tbl-wrap">
                        <table class="history-table" style="min-width:900px;width:100%;">
                            <thead>
                                <tr>
                                    <th>Thời gian</th>
                                    <th>Công trình</th>
                                    <th>Vật tư</th>
                                    <th style="text-align:right;">SL</th>
                                    <th style="text-align:right;">Đơn giá</th>
                                    <th style="text-align:right;">Thành tiền</th>
                                    <th style="text-align:center;">Loại</th>
                                </tr>
                            </thead>
                            <tbody id="project-history-tbody">${renderProjectHistory()}</tbody>
                        </table>
                    </div>
                </div>
                <div class="panel-resize-handle" data-target="projects-history-panel"></div>
            </div>
        </div>
    </div>`;
    
    setTimeout(() => { bindProjectSearchEvents(); projectListContainer = document.getElementById('project-list-container'); if (projectListContainer) updateProjectListDisplay(); initResizablePanels(); }, 50);
    return html;
}

export function openProjectModal() {
    if (!hasPermission('canCreateMaterial')) { alert('Bạn không có quyền'); return; }
    showModal(`<div class="modal-hd"><span class="modal-title">🏗️ Thêm công trình</span><button class="xbtn" onclick="closeModal()">✕</button></div>
    <div class="modal-bd"><div class="form-group"><label class="form-label">Tên</label><input id="proj-name"></div>
    <div class="form-group"><label class="form-label">Ngân sách (VNĐ)</label><input type="text" id="proj-budget" value="0" dir="ltr"></div></div>
    <div class="modal-ft"><button onclick="closeModal()">Hủy</button><button class="primary" onclick="saveProject()">Tạo</button></div>`);
    setTimeout(() => { const inp = document.getElementById('proj-budget'); if (inp) setupNumberInput(inp, { isInteger: false, decimals: 2 }); }, 100);
}

export function saveProject() {
    const name = document.getElementById('proj-name')?.value.trim();
    if(!name) return alert('Nhập tên');
    const budget = parseInt(document.getElementById('proj-budget')?.value.replace(/[^0-9]/g,'')) || 0;
    const p = { id: genPid(), name, budget, spent: 0 };
    state.data.projects.push(p);
    addLog('Thêm công trình', `${name} (${p.id})`);
    saveState(); closeModal(); if(window.render) window.render();
}

// ========== SỬA CÔNG TRÌNH ==========
window.editProject = function(pid) {
    const project = projectById(pid);
    if (!project) return;
    if (!hasPermission('canCreateMaterial')) { alert('Bạn không có quyền sửa'); return; }
    
    showModal(`<div class="modal-hd"><span class="modal-title">✏️ Sửa công trình</span><button class="xbtn" onclick="closeModal()">✕</button></div>
    <div class="modal-bd">
        <div class="form-group"><label class="form-label">Tên công trình</label><input id="edit-proj-name" value="${escapeHtml(project.name)}"></div>
        <div class="form-group"><label class="form-label">Ngân sách (VNĐ)</label><input type="text" id="edit-proj-budget" value="${project.budget.toLocaleString('vi-VN')}" dir="ltr"></div>
    </div>
    <div class="modal-ft"><button onclick="closeModal()">Hủy</button><button class="primary" onclick="window.saveEditProject('${pid}')">Cập nhật</button></div>`);
    
    setTimeout(() => {
        const inp = document.getElementById('edit-proj-budget');
        if (inp) setupNumberInput(inp, { isInteger: false, decimals: 2 });
    }, 100);
};

window.saveEditProject = function(pid) {
    const project = projectById(pid);
    if (!project) return;
    const name = document.getElementById('edit-proj-name')?.value.trim();
    if (!name) return alert('Nhập tên');
    project.name = name;
    project.budget = parseInt(document.getElementById('edit-proj-budget')?.value.replace(/[^0-9]/g, '')) || 0;
    addLog('Sửa công trình', `Đã cập nhật: ${name} (${pid})`);
    saveState(); closeModal(); if(window.render) window.render();
};

export function deleteProject(pid) {
    const p = projectById(pid);
    if (!p) return;
    if (!confirm(`Xóa "${p.name}"?`)) return;
    state.data.projects = state.data.projects.filter(x => x.id !== pid);
    state.data.transactions = state.data.transactions.filter(x => x.projectId !== pid);
    if (state.data.projectSchedules) state.data.projectSchedules = state.data.projectSchedules.filter(x => x.projectId !== pid);
    if (state.data.projectMaterialUsage) state.data.projectMaterialUsage = state.data.projectMaterialUsage.filter(x => x.projectId !== pid);
    addLog('Xóa công trình', p.name);
    saveState(); if(window.render) window.render();
}

window.deleteProjectHandler = deleteProject;
window.openMaterialUsageModal = (pid, mid) => import('./projects.js').then(m => m.openMaterialUsageModal?.(pid, mid));
window.saveMaterialUsage = (pid, mid, tr) => import('./projects.js').then(m => m.saveMaterialUsage?.(pid, mid, tr));

export const addProject = (d) => { const p = { id: genPid(), name: d.name, budget: Number(d.budget)||0, spent: 0 }; state.data.projects.push(p); addLog('Thêm CT', p.name); saveState(); if(window.render) window.render(); return p; };
export const getProjects = () => state.data.projects;
export function filterProjects() {}
export function clearProjectSearch() {}