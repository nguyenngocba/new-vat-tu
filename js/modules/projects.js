import { state, saveState, addLog, formatMoney, escapeHtml, showModal, closeModal, genPid, projectById, hasPermission } from './state.js';
import { handleIntegerInput, formatMoneyVND } from './utils.js';

let projectFilters = { keyword: '', budgetMin: '', budgetMax: '', status: '' };
let projectListContainer = null;

function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return '';
    const date = new Date(dateTimeStr);
    return date.toLocaleString('vi-VN');
}

function getFilteredProjects() {
    let result = [...state.data.projects];
    const f = projectFilters;
    
    if (f.keyword) {
        const kw = f.keyword.toLowerCase();
        result = result.filter(p => p.name.toLowerCase().includes(kw) || p.id.toLowerCase().includes(kw));
    }
    if (f.budgetMin !== '' && f.budgetMin !== null && f.budgetMin !== undefined) {
        const min = Number(f.budgetMin);
        if (!isNaN(min)) result = result.filter(p => p.budget >= min);
    }
    if (f.budgetMax !== '' && f.budgetMax !== null && f.budgetMax !== undefined) {
        const max = Number(f.budgetMax);
        if (!isNaN(max)) result = result.filter(p => p.budget <= max);
    }
    if (f.status !== '' && f.status !== 'all') {
        result = result.filter(p => {
            const spent = state.data.transactions.filter(t => t.projectId === p.id && t.type === 'usage').reduce((s, t) => s + (t.totalAmount || 0), 0);
            const remaining = p.budget - spent;
            if (f.status === 'has_budget') return remaining > 0;
            if (f.status === 'out_of_budget') return remaining <= 0;
            if (f.status === 'over_budget') return spent > p.budget;
            return true;
        });
    }
    return result;
}

function renderProjectHistory() {
    const transactions = state.data.transactions
        .filter(t => t.type === 'usage' && t.projectId)
        .sort((a, b) => new Date(b.datetime || b.date) - new Date(a.datetime || a.date))
        .slice(0, 50);
    
    if (transactions.length === 0) {
        return '<tr><td colspan="6" style="text-align: center;">📭 Chưa có dữ liệu xuất kho cho công trình nào</td></tr>';
    }
    
    return transactions.map(t => {
        const mat = state.data.materials.find(m => m.id === t.mid);
        const proj = projectById(t.projectId);
        const displayDateTime = t.datetime ? formatDateTime(t.datetime) : t.date;
        return `<tr>
            <td><strong>${proj?.name || 'N/A'}</strong></td>
            <td>${mat?.name || 'N/A'}</td>
            <td>${t.qty.toLocaleString('vi-VN')} ${mat?.unit || ''}</td>
            <td>${formatMoneyVND(t.unitPrice || mat?.cost || 0)}</td>
            <td class="text-warning">${formatMoneyVND(t.totalAmount || 0)}</td>
            <td>${displayDateTime}</td>
        </tr>`;
    }).join('');
}

function updateProjectListDisplay() {
    if (!projectListContainer) return;
    const filtered = getFilteredProjects();
    const projectStats = filtered.map(p => {
        const txnList = state.data.transactions.filter(t => t.projectId === p.id && t.type === 'usage');
        const totalCost = txnList.reduce((s, t) => s + (t.totalAmount || 0), 0);
        const items = txnList.length;
        const percent = p.budget > 0 ? (totalCost / p.budget) * 100 : 0;
        const remaining = p.budget - totalCost;
        return { ...p, totalCost, items, percent, remaining };
    });
    
    projectListContainer.innerHTML = `
        <div class="grid2" style="grid-template-columns:repeat(auto-fit, minmax(320px,1fr));gap:16px;margin-bottom:24px">
            ${projectStats.map(p => `<div class="metric-card project-card" data-project-id="${p.id}" style="cursor: pointer;" onclick="window.showProjectDetail('${p.id}')">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div class="metric-label">🏗️ ${escapeHtml(p.name)}</div>
                    <div class="tag">${p.id}</div>
                </div>
                <div class="metric-val" style="font-size:28px;margin:8px 0;color:var(--accent)">${formatMoneyVND(p.totalCost)}</div>
                <div class="metric-sub">💰 Ngân sách: ${formatMoneyVND(p.budget)}</div>
                <div class="metric-sub">📊 Còn lại: ${formatMoneyVND(p.remaining)}</div>
                <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(100, p.percent)}%;background:${p.percent > 90 ? '#A32D2D' : '#378ADD'}"></div></div>
                <div class="metric-sub" style="margin-top:6px">${p.percent.toFixed(1)}% ngân sách đã sử dụng</div>
                <div class="metric-sub" style="margin-top:4px">📦 ${p.items} lượt xuất kho</div>
                ${hasPermission('canDeleteProject') ? `<button class="sm danger-btn" style="margin-top:12px" onclick="event.stopPropagation(); window.deleteProjectHandler('${p.id}')">🗑️ Xóa công trình</button>` : ''}
            </div>`).join('')}
        </div>
    `;
}

function updateProjectHistoryDisplay() {
    const historyContainer = document.getElementById('project-history-tbody');
    if (historyContainer) {
        historyContainer.innerHTML = renderProjectHistory();
    }
}

function renderProjectSearchBar() {
    const statusOptions = [
        { value: '', label: '📂 Tất cả' },
        { value: 'has_budget', label: '💰 Còn ngân sách' },
        { value: 'out_of_budget', label: '⚠️ Hết ngân sách' },
        { value: 'over_budget', label: '🔥 Quá ngân sách' }
    ];
    
    return `
        <div class="card" style="margin-bottom: 16px;">
            <div class="sec-title">🔍 TÌM KIẾM NÂNG CAO - CÔNG TRÌNH</div>
            <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center;">
                <input type="text" id="proj-search-keyword" placeholder="Tên hoặc mã công trình..." 
                       value="${escapeHtml(projectFilters.keyword)}" style="flex: 2; min-width: 180px;">
                <input type="text" id="proj-search-budget-min" placeholder="Ngân sách ≥" 
                       value="${projectFilters.budgetMin || ''}" style="width: 120px; text-align: right;">
                <input type="text" id="proj-search-budget-max" placeholder="Ngân sách ≤" 
                       value="${projectFilters.budgetMax || ''}" style="width: 120px; text-align: right;">
                <select id="proj-search-status" style="width: 140px;">
                    ${statusOptions.map(opt => `<option value="${opt.value}" ${projectFilters.status === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('')}
                </select>
                <button id="proj-clear-filters" class="sm">🗑️ Xóa bộ lọc</button>
            </div>
        </div>
    `;
}

function bindProjectSearchEvents() {
    const keywordInput = document.getElementById('proj-search-keyword');
    const budgetMinInput = document.getElementById('proj-search-budget-min');
    const budgetMaxInput = document.getElementById('proj-search-budget-max');
    const statusSelect = document.getElementById('proj-search-status');
    const clearBtn = document.getElementById('proj-clear-filters');
    
    const updateFilters = () => {
        projectFilters.keyword = keywordInput?.value || '';
        projectFilters.budgetMin = budgetMinInput?.value.replace(/[^0-9]/g, '') || '';
        projectFilters.budgetMax = budgetMaxInput?.value.replace(/[^0-9]/g, '') || '';
        projectFilters.status = statusSelect?.value || '';
        updateProjectListDisplay();
        updateProjectHistoryDisplay();
    };
    
    if (keywordInput) keywordInput.oninput = updateFilters;
    if (budgetMinInput) {
        budgetMinInput.addEventListener('input', handleIntegerInput);
        budgetMinInput.addEventListener('input', updateFilters);
    }
    if (budgetMaxInput) {
        budgetMaxInput.addEventListener('input', handleIntegerInput);
        budgetMaxInput.addEventListener('input', updateFilters);
    }
    if (statusSelect) statusSelect.onchange = updateFilters;
    if (clearBtn) clearBtn.onclick = () => {
        projectFilters = { keyword: '', budgetMin: '', budgetMax: '', status: '' };
        if (keywordInput) keywordInput.value = '';
        if (budgetMinInput) budgetMinInput.value = '';
        if (budgetMaxInput) budgetMaxInput.value = '';
        if (statusSelect) statusSelect.value = '';
        updateProjectListDisplay();
        updateProjectHistoryDisplay();
    };
}

function initResizablePanels() {
    const container = document.getElementById('projects-resizable-container');
    if (!container) return;
    
    const handles = container.querySelectorAll('.panel-resize-handle');
    
    handles.forEach(handle => {
        const newHandle = handle.cloneNode(true);
        handle.parentNode.replaceChild(newHandle, handle);
        
        const targetId = newHandle.dataset.target;
        const panel = document.getElementById(targetId);
        if (!panel) return;
        
        const content = panel.querySelector('.panel-content');
        let startY = 0;
        let startHeight = 0;
        let isResizing = false;
        
        newHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            isResizing = true;
            startY = e.clientY;
            startHeight = content.offsetHeight;
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
        });
        
        const onMouseMove = (e) => {
            if (!isResizing) return;
            e.preventDefault();
            const diff = e.clientY - startY;
            let newHeight = startHeight + diff;
            newHeight = Math.max(150, Math.min(500, newHeight));
            content.style.height = newHeight + 'px';
            content.style.maxHeight = newHeight + 'px';
        };
        
        const onMouseUp = () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }
        };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

export function showProjectDetail(projectId) {
    const project = projectById(projectId);
    if (!project) return;
    
    const transactions = state.data.transactions.filter(t => t.projectId === projectId && t.type === 'usage').sort((a, b) => new Date(b.datetime || b.date) - new Date(a.datetime || a.date));
    const totalSpent = transactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    const remaining = project.budget - totalSpent;
    const percentUsed = project.budget > 0 ? (totalSpent / project.budget) * 100 : 0;
    
    const materialStats = {};
    transactions.forEach(t => {
        const mat = state.data.materials.find(m => m.id === t.mid);
        if (mat) {
            if (!materialStats[t.mid]) materialStats[t.mid] = { name: mat.name, unit: mat.unit, qty: 0, totalAmount: 0 };
            materialStats[t.mid].qty += t.qty;
            materialStats[t.mid].totalAmount += t.totalAmount;
        }
    });
    const materialStatsArray = Object.values(materialStats).sort((a, b) => b.totalAmount - a.totalAmount);
    
    const modalContent = `
        <div class="modal-hd" style="background: var(--accent-bg);">
            <span class="modal-title" style="font-size: 20px;">🏗️ ${escapeHtml(project.name)}</span>
            <button class="xbtn" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-bd" style="max-height: 70vh; overflow-y: auto;">
            <div class="grid2" style="margin-bottom: 20px;">
                <div class="metric-card"><div class="metric-label">📋 MÃ CÔNG TRÌNH</div><div class="metric-val" style="font-size: 18px;">${project.id}</div></div>
                <div class="metric-card"><div class="metric-label">💰 NGÂN SÁCH</div><div class="metric-val" style="font-size: 18px; color: var(--accent);">${formatMoneyVND(project.budget)}</div></div>
                <div class="metric-card"><div class="metric-label">💸 ĐÃ CHI</div><div class="metric-val" style="font-size: 18px; color: var(--warn-text);">${formatMoneyVND(totalSpent)}</div></div>
                <div class="metric-card"><div class="metric-label">📊 CÒN LẠI</div><div class="metric-val" style="font-size: 18px; color: var(--success-text);">${formatMoneyVND(remaining)}</div></div>
            </div>
            <div class="metric-card" style="margin-bottom: 20px;">
                <div class="metric-label">📈 TIẾN ĐỘ SỬ DỤNG NGÂN SÁCH</div>
                <div class="progress-bar" style="height: 12px;"><div class="progress-fill" style="width: ${Math.min(100, percentUsed)}%; background: ${percentUsed > 90 ? '#A32D2D' : percentUsed > 70 ? '#BA7517' : '#378ADD'};"></div></div>
                <div class="metric-sub" style="margin-top: 8px; text-align: center; font-size: 14px; font-weight: bold;">${percentUsed.toFixed(1)}% đã sử dụng (${transactions.length} lượt xuất kho)</div>
            </div>
            ${materialStatsArray.length > 0 ? `
                <div class="sec-title">📦 THỐNG KÊ VẬT TƯ ĐÃ SỬ DỤNG</div>
                <div class="tbl-wrap"><table style="min-width: 500px;"><thead><tr><th>Vật tư</th><th>Số lượng</th><th>Đơn vị</th><th>Thành tiền</th><th>Tỷ lệ</th></tr></thead>
                <tbody>${materialStatsArray.map(stat => {
                    const percentOfTotal = totalSpent > 0 ? (stat.totalAmount / totalSpent) * 100 : 0;
                    return `<tr>
                        <td><strong>${escapeHtml(stat.name)}</strong></td>
                        <td>${stat.qty.toLocaleString('vi-VN')}</td>
                        <td>${stat.unit}</td>
                        <td class="text-warning">${formatMoneyVND(stat.totalAmount)}</td>
                        <td><div class="progress-bar" style="width: 100px; display: inline-block;"><div class="progress-fill" style="width: ${percentOfTotal}%; background: var(--accent);"></div></div> ${percentOfTotal.toFixed(1)}%</td>
                    </tr>`;
                }).join('')}</tbody></table></div>
            ` : '<div class="metric-card"><div class="metric-sub">📭 Chưa có vật tư nào được xuất</div></div>'}
            <div class="sec-title" style="margin-top: 20px;">📜 LỊCH SỬ XUẤT KHO CHI TIẾT</div>
            <div class="tbl-wrap"><table style="min-width: 700px;"><thead><tr><th>Ngày giờ</th><th>Vật tư</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th><th>Ghi chú</th><th>Tệp đính kèm</th></tr></thead>
            <tbody>${transactions.map(t => {
                const mat = state.data.materials.find(m => m.id === t.mid);
                const displayDateTime = t.datetime ? formatDateTime(t.datetime) : t.date;
                const attachmentHtml = t.attachment ? `<a href="${t.attachment}" target="_blank" style="color: var(--accent);">📎 Xem tệp</a>` : (t.invoiceImage ? `<a href="${t.invoiceImage}" target="_blank" style="color: var(--accent);">📄 Hóa đơn</a>` : '—');
                return `<tr>
                    <td>${displayDateTime}</td>
                    <td><strong>${mat?.name || 'N/A'}</strong></td>
                    <td>${t.qty.toLocaleString('vi-VN')} ${mat?.unit || ''}</td>
                    <td>${formatMoneyVND(t.unitPrice)}</td>
                    <td class="text-warning">${formatMoneyVND(t.totalAmount)}</td>
                    <td>${escapeHtml(t.note || '—')}</td>
                    <td>${attachmentHtml}</td>
                </tr>`;
            }).join('') || '<tr><td colspan="7" style="text-align: center;">📭 Chưa có giao dịch xuất kho nào</td></tr>'}</tbody></table></div>
            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                <button class="sm" onclick="closeModal(); window.exportProjectDetail('${projectId}')">📎 Xuất báo cáo Excel</button>
            </div>
        </div>
        <div class="modal-ft">
            <button onclick="closeModal()">Đóng</button>
            ${hasPermission('canExport') ? `<button class="primary" onclick="closeModal(); window.openTxnModal('usage', '${projectId}')">📤 Xuất kho cho công trình này</button>` : ''}
        </div>
    `;
    showModal(modalContent, null);
}

export function exportProjectDetail(projectId) {
    const project = projectById(projectId);
    if (!project) return;
    const transactions = state.data.transactions.filter(t => t.projectId === projectId && t.type === 'usage').sort((a, b) => new Date(b.datetime || b.date) - new Date(a.datetime || a.date));
    const totalSpent = transactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    const remaining = project.budget - totalSpent;
    
    const summaryData = [
        { 'Thông tin': 'Tên công trình', 'Giá trị': project.name },
        { 'Thông tin': 'Mã công trình', 'Giá trị': project.id },
        { 'Thông tin': 'Ngân sách', 'Giá trị': formatMoneyVND(project.budget) },
        { 'Thông tin': 'Đã chi', 'Giá trị': formatMoneyVND(totalSpent) },
        { 'Thông tin': 'Còn lại', 'Giá trị': formatMoneyVND(remaining) },
        { 'Thông tin': 'Số lần xuất kho', 'Giá trị': transactions.length }
    ];
    
    const detailData = transactions.map(t => {
        const mat = state.data.materials.find(m => m.id === t.mid);
        const displayDateTime = t.datetime ? formatDateTime(t.datetime) : t.date;
        return { 
            'Ngày giờ xuất': displayDateTime, 
            'Mã vật tư': t.mid, 
            'Tên vật tư': mat?.name || 'N/A', 
            'Số lượng': t.qty, 
            'Đơn vị': mat?.unit || '', 
            'Đơn giá (VNĐ)': t.unitPrice, 
            'Thành tiền (VNĐ)': t.totalAmount, 
            'Ghi chú': t.note || '',
            'Có tệp đính kèm': t.attachment ? 'Có' : (t.invoiceImage ? 'Có hóa đơn' : 'Không')
        };
    });
    
    if (typeof XLSX !== 'undefined') {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'Tổng quan');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailData), 'Chi tiết xuất kho');
        XLSX.writeFile(wb, `baocao_congtrinh_${project.id}_${new Date().toISOString().split('T')[0]}.xlsx`);
        addLog('Xuất báo cáo', `Xuất báo cáo chi tiết công trình: ${project.name}`);
        alert('✅ Đã xuất báo cáo Excel!');
    } else alert('Đang tải thư viện Excel, vui lòng thử lại sau.');
}

export function exportAllProjectsReport() {
    const projects = state.data.projects.map(p => {
        const transactions = state.data.transactions.filter(t => t.projectId === p.id && t.type === 'usage');
        const totalSpent = transactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
        const remaining = p.budget - totalSpent;
        const percent = p.budget > 0 ? (totalSpent / p.budget) * 100 : 0;
        return { 'Mã công trình': p.id, 'Tên công trình': p.name, 'Ngân sách (VNĐ)': p.budget, 'Đã chi (VNĐ)': totalSpent, 'Còn lại (VNĐ)': remaining, '% sử dụng': percent.toFixed(1), 'Số lần xuất': transactions.length };
    });
    if (typeof XLSX !== 'undefined') {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(projects), 'Danh sách công trình');
        XLSX.writeFile(wb, `danh_sach_cong_trinh_${new Date().toISOString().split('T')[0]}.xlsx`);
        addLog('Xuất báo cáo', 'Xuất danh sách tất cả công trình');
        alert('✅ Đã xuất báo cáo!');
    } else alert('Đang tải thư viện Excel, vui lòng thử lại sau.');
}

export function renderProjects() {
    const result = `<div class="card">
        <div class="resizable-container" id="projects-resizable-container">
            <div class="resizable-panel" id="projects-list-panel">
                <div class="panel-header">
                    <div class="sec-title">🏗️ DANH SÁCH CÔNG TRÌNH</div>
                    <span class="resize-icon">⤥ Kéo để điều chỉnh</span>
                </div>
                <div class="panel-content" id="project-list-container" style="max-height: 400px; overflow-y: auto;"></div>
                <div class="panel-resize-handle" data-target="projects-list-panel"></div>
            </div>
            <div class="resizable-panel" id="projects-history-panel">
                <div class="panel-header">
                    <div class="sec-title">📜 LỊCH SỬ XUẤT KHO CHI TIẾT</div>
                    <span class="resize-icon">⤥ Kéo để điều chỉnh</span>
                </div>
                <div class="panel-content" style="max-height: 300px; overflow-y: auto;">
                    <div class="tbl-wrap">
                        <table style="min-width: 800px; width: 100%;">
                            <thead>
                                <tr>
                                    <th>Công trình</th>
                                    <th>Vật tư</th>
                                    <th>Số lượng</th>
                                    <th>Đơn giá</th>
                                    <th>Tổng giá trị</th>
                                    <th>Ngày giờ xuất</th>
                                </tr>
                            </thead>
                            <tbody id="project-history-tbody">
                                ${renderProjectHistory()}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="panel-resize-handle" data-target="projects-history-panel"></div>
            </div>
        </div>
    </div>`;
    
    setTimeout(() => {
        bindProjectSearchEvents();
        projectListContainer = document.getElementById('project-list-container');
        if (projectListContainer) {
            updateProjectListDisplay();
        }
        initResizablePanels();
    }, 50);
    return result;
}

export function openProjectModal() {
  if (!hasPermission('canCreateMaterial')) { alert('Bạn không có quyền thêm công trình'); return; }
  showModal(`<div class="modal-hd"><span class="modal-title">🏗️ Thêm công trình mới</span><button class="xbtn" onclick="closeModal()">✕</button></div>
    <div class="modal-bd"><div class="form-group"><label class="form-label">Tên công trình</label><input id="proj-name" placeholder="VD: Cầu vượt X"></div>
    <div class="form-group"><label class="form-label">Ngân sách dự kiến (VNĐ)</label><input type="text" id="proj-budget" value="0" style="text-align: right;"></div></div>
    <div class="modal-ft"><button onclick="closeModal()">Hủy</button><button class="primary" onclick="saveProject()">Tạo công trình</button></div>`);
  setTimeout(() => { const budgetInput = document.getElementById('proj-budget'); if (budgetInput) budgetInput.addEventListener('input', handleIntegerInput); }, 100);
}

export function saveProject() {
  const name = document.getElementById('proj-name')?.value.trim();
  if(!name) return alert('Nhập tên công trình');
  const budget = parseInt(document.getElementById('proj-budget')?.value.replace(/[^0-9]/g, '')) || 0;
  const newProj = { id: genPid(), name, budget: budget, spent: 0 };
  state.data.projects.push(newProj);
  addLog('Thêm công trình', `Đã thêm công trình: ${name} (${newProj.id}) - Ngân sách: ${formatMoneyVND(newProj.budget)}`);
  saveState(); closeModal(); if(window.render) window.render();
}

export function deleteProject(pid) {
  if (!hasPermission('canDeleteProject')) { alert('Bạn không có quyền xóa công trình'); return; }
  const project = projectById(pid);
  if (!project) return;
  const relatedTxns = state.data.transactions.filter(t => t.projectId === pid && t.type === 'usage');
  if (!confirm(relatedTxns.length > 0 ? `⚠️ Công trình "${project.name}" đã có ${relatedTxns.length} giao dịch xuất vật tư.\nXóa sẽ XÓA LUÔN các giao dịch này.\nTiếp tục?` : `Xóa công trình "${project.name}"?`)) return;
  state.data.projects = state.data.projects.filter(p => p.id !== pid);
  state.data.transactions = state.data.transactions.filter(t => t.projectId !== pid);
  addLog('Xóa công trình', `Đã xóa công trình: ${project.name} (${pid})`);
  saveState(); if(window.render) window.render();
}

window.deleteProjectHandler = (pid) => { deleteProject(pid); };
export function filterProjects() {}
export function clearProjectSearch() {}
export const addProject = (data) => { const newId = genPid(); const newProj = { id: newId, name: data.name, budget: Number(data.budget) || 0, spent: 0 }; state.data.projects.push(newProj); addLog('Thêm công trình', `Đã thêm công trình: ${newProj.name} (${newProj.id}) - Ngân sách: ${formatMoneyVND(newProj.budget)}`); saveState(); if(window.render) window.render(); return newProj; };
export const getProjects = () => state.data.projects;