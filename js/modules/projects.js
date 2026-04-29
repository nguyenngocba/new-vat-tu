import { state, saveState, addLog, formatMoney, escapeHtml, showModal, closeModal, genPid, projectById, hasPermission } from './state.js';
import { handleIntegerInput, formatMoneyVND, setupNumberInput } from './utils.js';

let projectFilters = { keyword: '', budgetMin: '', budgetMax: '', status: '' };
let projectListContainer = null;

function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return '';
    const date = new Date(dateTimeStr);
    return date.toLocaleString('vi-VN');
}

function getCurrentDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseNumber(str) {
    if (!str || str === '') return 0;
    let cleaned = str.toString().replace(/\./g, '').replace(/,/g, '.');
    return parseFloat(cleaned) || 0;
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
            const usageTotal = getProjectNetCost(p.id);
            const remaining = p.budget - usageTotal;
            if (f.status === 'has_budget') return remaining > 0;
            if (f.status === 'out_of_budget') return remaining <= 0;
            if (f.status === 'over_budget') return usageTotal > p.budget;
            return true;
        });
    }
    return result;
}

function getProjectNetCost(projectId) {
    const usageTotal = state.data.transactions.filter(t => t.projectId === projectId && t.type === 'usage').reduce((s, t) => s + (t.totalAmount || 0), 0);
    const returnTotal = state.data.transactions.filter(t => t.projectId === projectId && t.type === 'return').reduce((s, t) => s + (t.totalAmount || 0), 0);
    return usageTotal - returnTotal;
}

function getMaterialUsageDetails(projectId) {
    const usageTxns = state.data.transactions.filter(t => t.projectId === projectId && t.type === 'usage');
    const returnTxns = state.data.transactions.filter(t => t.projectId === projectId && t.type === 'return');
    const usageRecords = state.data.projectMaterialUsage?.filter(u => u.projectId === projectId) || [];
    
    const materialMap = new Map();
    
    usageTxns.forEach(t => {
        const mat = state.data.materials.find(m => m.id === t.mid);
        if (mat) {
            if (!materialMap.has(t.mid)) {
                materialMap.set(t.mid, {
                    id: t.mid,
                    name: mat.name,
                    unit: mat.unit,
                    totalReceived: 0,
                    totalUsed: 0,
                    totalReturned: 0,
                    usageRecords: []
                });
            }
            const item = materialMap.get(t.mid);
            item.totalReceived += t.qty;
        }
    });
    
    returnTxns.forEach(t => {
        if (materialMap.has(t.mid)) {
            const item = materialMap.get(t.mid);
            item.totalReturned += t.qty;
        }
    });
    
    usageRecords.forEach(record => {
        if (materialMap.has(record.materialId)) {
            const item = materialMap.get(record.materialId);
            item.totalUsed = record.usedQty || 0;
            item.usageRecords = record.history || [];
        }
    });
    
    materialMap.forEach(item => {
        item.remainingAtSite = item.totalReceived - item.totalUsed - item.totalReturned;
        if (item.remainingAtSite < 0) item.remainingAtSite = 0;
        item.usagePercentage = item.totalReceived > 0 ? (item.totalUsed / item.totalReceived) * 100 : 0;
    });
    
    return Array.from(materialMap.values());
}

export function openMaterialUsageModal(projectId, materialId) {
    const project = projectById(projectId);
    const material = state.data.materials.find(m => m.id === materialId);
    if (!project || !material) return;
    
    const usageTxns = state.data.transactions.filter(t => t.projectId === projectId && t.type === 'usage' && t.mid === materialId);
    const returnTxns = state.data.transactions.filter(t => t.projectId === projectId && t.type === 'return' && t.mid === materialId);
    const usageRecord = state.data.projectMaterialUsage?.find(u => u.projectId === projectId && u.materialId === materialId);
    
    const totalReceived = usageTxns.reduce((s, t) => s + t.qty, 0);
    const totalReturned = returnTxns.reduce((s, t) => s + t.qty, 0);
    const totalUsed = usageRecord?.usedQty || 0;
    const remainingAtSite = totalReceived - totalUsed - totalReturned;
    const usagePercent = totalReceived > 0 ? (totalUsed / totalReceived) * 100 : 0;
    
    const modalContent = `
        <div class="modal-hd" style="background: var(--accent-bg);">
            <span class="modal-title">📦 Quản lý sử dụng: ${escapeHtml(material.name)}</span>
            <button class="xbtn" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-bd">
            <div class="grid2" style="margin-bottom: 20px;">
                <div class="metric-card">
                    <div class="metric-label">🏗️ Công trình</div>
                    <div class="metric-val" style="font-size: 16px;">${escapeHtml(project.name)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">📦 Vật tư</div>
                    <div class="metric-val" style="font-size: 16px;">${escapeHtml(material.name)} (${material.unit})</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">📥 Đã nhận từ kho</div>
                    <div class="metric-val" style="font-size: 20px; color: var(--accent);">${totalReceived.toLocaleString('vi-VN')} ${material.unit}</div>
                    <div class="metric-sub">Số lượng đã xuất sang công trình</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">✅ Đã sử dụng thực tế</div>
                    <div class="metric-val" style="font-size: 20px;">${totalUsed.toLocaleString('vi-VN')} ${material.unit}</div>
                    <div class="progress-bar" style="margin-top: 8px;"><div class="progress-fill" style="width: ${usagePercent}%; background: ${usagePercent > 90 ? '#A32D2D' : usagePercent > 70 ? '#BA7517' : '#378ADD'};"></div></div>
                    <div class="metric-sub">${usagePercent.toFixed(1)}% đã sử dụng</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">🔄 Đã trả kho</div>
                    <div class="metric-val" style="font-size: 20px; color: var(--success-text);">${totalReturned.toLocaleString('vi-VN')} ${material.unit}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">📦 Tồn tại công trình</div>
                    <div class="metric-val" style="font-size: 20px; color: var(--warn-text);">${remainingAtSite.toLocaleString('vi-VN')} ${material.unit}</div>
                    <div class="metric-sub">Chưa sử dụng (có thể trả kho)</div>
                </div>
            </div>
            
            <div class="sec-title">✏️ CẬP NHẬT SỬ DỤNG</div>
            <div class="form-grid2">
                <div class="form-group">
                    <label class="form-label">🔢 Số lượng đã sử dụng</label>
                    <input type="text" id="usage-qty" value="${totalUsed.toLocaleString('vi-VN')}" style="text-align: right;">
                    <div class="metric-sub">Tối đa: ${totalReceived.toLocaleString('vi-VN')} ${material.unit}</div>
                </div>
                <div class="form-group">
                    <label class="form-label">📅 Ngày cập nhật</label>
                    <input type="datetime-local" id="usage-date" value="${getCurrentDateTime()}">
                </div>
                <div class="form-group form-full">
                    <label class="form-label">📝 Ghi chú</label>
                    <input id="usage-note" placeholder="Mô tả chi tiết việc sử dụng...">
                </div>
            </div>
            
            <div class="metric-card" style="margin-top: 16px; background: var(--warn-bg);">
                <div class="metric-sub">⚠️ Lưu ý: 
                    <br>- Số lượng sử dụng không được vượt quá số đã nhận (${totalReceived.toLocaleString('vi-VN')} ${material.unit})
                    <br>- Nếu giảm số lượng sử dụng, hệ thống sẽ đề xuất tạo phiếu trả hàng
                </div>
            </div>
            
            <div class="sec-title" style="margin-top: 20px;">📜 LỊCH SỬ XUẤT/NHẬP/SỬ DỤNG</div>
            <div class="tbl-wrap">
                <table style="min-width: 600px;">
                    <thead>
                        <tr><th>Thời gian</th><th>Loại</th><th>Số lượng</th><th>Ghi chú</th></tr>
                    </thead>
                    <tbody>
                        ${[...usageTxns, ...returnTxns, ...(usageRecord?.history || [])].sort((a, b) => new Date(b.datetime || b.date || b.lastUpdated) - new Date(a.datetime || a.date || a.lastUpdated)).slice(0, 20).map(t => {
                            if (t.type === 'usage') {
                                return `<tr>
                                    <td>${formatDateTime(t.datetime || t.date)}</td>
                                    <td>📤 Xuất kho</td>
                                    <td>${t.qty.toLocaleString('vi-VN')} ${material.unit}</td>
                                    <td>${escapeHtml(t.note || '—')}</td>
                                </table>`;
                            } else if (t.type === 'return') {
                                return `<tr>
                                    <td>${formatDateTime(t.datetime || t.date)}</td>
                                    <td>🔄 Trả kho</td>
                                    <td>${t.qty.toLocaleString('vi-VN')} ${material.unit}</td>
                                    <td>${escapeHtml(t.note || '—')}</td>
                                </tr>`;
                            } else {
                                const changeText = t.change > 0 ? `+${t.change.toLocaleString('vi-VN')}` : t.change.toLocaleString('vi-VN');
                                return `<tr>
                                    <td>${formatDateTime(t.date)}</td>
                                    <td>✏️ Cập nhật sử dụng</td>
                                    <td>${t.oldQty.toLocaleString('vi-VN')} → ${t.newQty.toLocaleString('vi-VN')} (${changeText})</td>
                                    <td>${escapeHtml(t.note || '—')} (NV: ${t.operator})</td>
                                </tr>`;
                            }
                        }).join('')}
                        ${usageTxns.length === 0 && returnTxns.length === 0 && (!usageRecord?.history || usageRecord.history.length === 0) ? '<tr><td colspan="4" style="text-align: center;">Chưa có dữ liệu</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        </div>
        <div class="modal-ft">
            <button onclick="closeModal()">Đóng</button>
            <button class="primary" onclick="saveMaterialUsage('${projectId}', '${materialId}', ${totalReceived})">💾 Lưu cập nhật</button>
        </div>
    `;
    
    showModal(modalContent, null);
    
    setTimeout(() => {
        const qtyInput = document.getElementById('usage-qty');
        if (qtyInput) {
            setupNumberInput(qtyInput, { isInteger: false, decimals: null });
        }
    }, 100);
}

export function saveMaterialUsage(projectId, materialId, totalReceived) {
    const qtyInput = document.getElementById('usage-qty');
    const dateInput = document.getElementById('usage-date');
    const noteInput = document.getElementById('usage-note');
    
    let newUsedQty = parseNumber(qtyInput?.value);
    if (isNaN(newUsedQty)) newUsedQty = 0;
    
    if (newUsedQty < 0) {
        alert('Số lượng sử dụng không thể âm');
        return;
    }
    
    if (newUsedQty > totalReceived) {
        alert(`Số lượng sử dụng (${newUsedQty.toLocaleString('vi-VN')}) vượt quá số đã nhận (${totalReceived.toLocaleString('vi-VN')})`);
        return;
    }
    
    const usageTxns = state.data.transactions.filter(t => t.projectId === projectId && t.type === 'usage' && t.mid === materialId);
    const returnTxns = state.data.transactions.filter(t => t.projectId === projectId && t.type === 'return' && t.mid === materialId);
    const totalReturned = returnTxns.reduce((s, t) => s + t.qty, 0);
    
    const currentUsage = state.data.projectMaterialUsage?.find(u => u.projectId === projectId && u.materialId === materialId);
    const currentUsed = currentUsage?.usedQty || 0;
    
    if (newUsedQty === currentUsed) {
        alert('Số lượng sử dụng không thay đổi');
        return;
    }
    
    const transactionDateTime = dateInput?.value || getCurrentDateTime();
    const note = noteInput?.value || '';
    
    const material = state.data.materials.find(m => m.id === materialId);
    const project = projectById(projectId);
    
    if (!state.data.projectMaterialUsage) state.data.projectMaterialUsage = [];
    
    const existingIndex = state.data.projectMaterialUsage.findIndex(u => u.projectId === projectId && u.materialId === materialId);
    const usageRecord = {
        projectId,
        materialId,
        usedQty: newUsedQty,
        lastUpdated: transactionDateTime,
        history: [
            ...(currentUsage?.history || []),
            {
                date: transactionDateTime,
                oldQty: currentUsed,
                newQty: newUsedQty,
                change: newUsedQty - currentUsed,
                note: note,
                operator: state.currentUser?.name || 'System'
            }
        ]
    };
    
    if (existingIndex >= 0) {
        state.data.projectMaterialUsage[existingIndex] = usageRecord;
    } else {
        state.data.projectMaterialUsage.push(usageRecord);
    }
    
    const change = newUsedQty - currentUsed;
    const changeText = change > 0 ? `tăng +${change.toLocaleString('vi-VN')}` : `giảm ${Math.abs(change).toLocaleString('vi-VN')}`;
    addLog('Cập nhật sử dụng vật tư', `${material?.name} - Công trình ${project?.name} - ${changeText} ${material?.unit} (${currentUsed.toLocaleString('vi-VN')} → ${newUsedQty.toLocaleString('vi-VN')}) - Ghi chú: ${note}`);
    
    if (change < 0) {
        const returnQty = -change;
        if (confirm(`Bạn có muốn tạo phiếu trả hàng ${returnQty.toLocaleString('vi-VN')} ${material?.unit} về kho không?`)) {
            const unitPrice = material?.cost || 0;
            const totalAmount = returnQty * unitPrice;
            
            if (material) material.qty += returnQty;
            if (project) project.spent = Math.max(0, (project.spent || 0) - totalAmount);
            
            const transaction = {
                id: `T${String(state.data.nextTid++).padStart(3, '0')}`,
                mid: materialId,
                projectId: projectId,
                date: transactionDateTime.split('T')[0],
                datetime: transactionDateTime,
                type: 'return',
                qty: returnQty,
                unitPrice: unitPrice,
                totalAmount: totalAmount,
                note: note || `Điều chỉnh sử dụng - Trả ${returnQty} ${material?.unit}`
            };
            state.data.transactions.unshift(transaction);
            addLog('Trả hàng từ điều chỉnh', `${material?.name} - SL: ${returnQty.toLocaleString('vi-VN')} ${material?.unit} - Công trình: ${project?.name} - Giá trị: ${formatMoneyVND(totalAmount)}`);
        }
    }
    
    saveState();
    closeModal();
    if (window.render) window.render();
    
    setTimeout(() => {
        showProjectDetail(projectId);
    }, 500);
}

function renderProjectHistory() {
    const transactions = state.data.transactions
        .filter(t => (t.type === 'usage' || t.type === 'return') && t.projectId)
        .sort((a, b) => new Date(b.datetime || b.date) - new Date(a.datetime || a.date))
        .slice(0, 50);
    
    if (transactions.length === 0) {
        return '<tr><td colspan="7" style="text-align: center;">📭 Chưa có dữ liệu xuất/nhập cho công trình nào</td></tr>';
    }
    
    return transactions.map(t => {
        const mat = state.data.materials.find(m => m.id === t.mid);
        const proj = projectById(t.projectId);
        const displayDateTime = t.datetime ? formatDateTime(t.datetime) : t.date;
        const displayQty = typeof t.qty === 'number' ? t.qty.toLocaleString('vi-VN') : parseFloat(t.qty || 0).toLocaleString('vi-VN');
        const isReturn = t.type === 'return';
        const typeIcon = isReturn ? '🔄 Trả về' : '📤 Xuất đi';
        const typeColor = isReturn ? 'var(--success-text)' : 'var(--warn-text)';
        const amountDisplay = isReturn ? `- ${formatMoneyVND(t.totalAmount)}` : formatMoneyVND(t.totalAmount);
        const amountClass = isReturn ? 'text-success' : 'text-warning';
        
        return `<tr>
            <td style="white-space: nowrap;">${displayDateTime}</td>
            <td style="white-space: nowrap;"><strong>${escapeHtml(proj?.name || 'N/A')}</strong></td>
            <td style="white-space: nowrap;">${escapeHtml(mat?.name || 'N/A')}</td>
            <td style="text-align: right; white-space: nowrap;">${displayQty} ${mat?.unit || ''}</td>
            <td style="text-align: right; white-space: nowrap;">${formatMoneyVND(t.unitPrice)}</td>
            <td style="text-align: right; white-space: nowrap;" class="${amountClass}">${amountDisplay}</td>
            <td style="text-align: center; white-space: nowrap; color: ${typeColor};">${typeIcon}</td>
        </tr>`;
    }).join('');
}

function updateProjectListDisplay() {
    if (!projectListContainer) return;
    const filtered = getFilteredProjects();
    
    const projectStats = filtered.map(p => {
        const usageTxns = state.data.transactions.filter(t => t.projectId === p.id && t.type === 'usage');
        const returnTxns = state.data.transactions.filter(t => t.projectId === p.id && t.type === 'return');
        
        const totalUsage = usageTxns.reduce((s, t) => s + (t.totalAmount || 0), 0);
        const totalReturn = returnTxns.reduce((s, t) => s + (t.totalAmount || 0), 0);
        const netCost = totalUsage - totalReturn;
        
        const items = usageTxns.length;
        const percent = p.budget > 0 ? (netCost / p.budget) * 100 : 0;
        const remaining = p.budget - netCost;
        
        p.spent = netCost;
        
        return { ...p, netCost, totalUsage, totalReturn, items, percent, remaining };
    });
    
    projectListContainer.innerHTML = `
        <div class="grid2" style="grid-template-columns:repeat(auto-fit, minmax(320px,1fr));gap:16px;margin-bottom:24px">
            ${projectStats.map(p => `
                <div class="metric-card project-card" data-project-id="${p.id}" style="cursor: pointer;" onclick="window.showProjectDetail('${p.id}')">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                        <div class="metric-label">🏗️ ${escapeHtml(p.name)}</div>
                        <div class="tag">${p.id}</div>
                    </div>
                    <div class="metric-val" style="font-size:28px;margin:8px 0;color:var(--accent)">${formatMoneyVND(p.netCost)}</div>
                    <div class="metric-sub">💰 Ngân sách: ${formatMoneyVND(p.budget)}</div>
                    <div class="metric-sub">📊 Còn lại: ${formatMoneyVND(p.remaining)}</div>
                    <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(100, p.percent)}%;background:${p.percent > 90 ? '#A32D2D' : '#378ADD'}"></div></div>
                    <div class="metric-sub" style="margin-top:6px">${p.percent.toFixed(1)}% ngân sách đã sử dụng</div>
                    <div class="metric-sub" style="margin-top:4px">📦 Xuất: ${p.items} lượt</div>
                    ${p.totalReturn > 0 ? `<div class="metric-sub" style="color: var(--success-text);">🔄 Đã trả: ${formatMoneyVND(p.totalReturn)}</div>` : ''}
                    ${hasPermission('canDeleteProject') ? `<button class="sm danger-btn" style="margin-top:12px" onclick="event.stopPropagation(); window.deleteProjectHandler('${p.id}')">🗑️ Xóa công trình</button>` : ''}
                </div>
            `).join('')}
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
    
    const usageTransactions = state.data.transactions.filter(t => t.projectId === projectId && t.type === 'usage').sort((a, b) => new Date(b.datetime || b.date) - new Date(a.datetime || a.date));
    const returnTransactions = state.data.transactions.filter(t => t.projectId === projectId && t.type === 'return').sort((a, b) => new Date(b.datetime || b.date) - new Date(a.datetime || a.date));
    
    const totalUsage = usageTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    const totalReturn = returnTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    const totalSpent = totalUsage - totalReturn;
    const remaining = project.budget - totalSpent;
    const percentUsed = project.budget > 0 ? (totalSpent / project.budget) * 100 : 0;
    
    const allTransactions = [...usageTransactions, ...returnTransactions].sort((a, b) => new Date(b.datetime || b.date) - new Date(a.datetime || a.date));
    const materialUsageDetails = getMaterialUsageDetails(projectId);
    
    const modalContent = `
        <div class="modal-hd" style="background: var(--accent-bg);">
            <span class="modal-title" style="font-size: 20px;">🏗️ ${escapeHtml(project.name)}</span>
            <button class="xbtn" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-bd" style="max-height: 70vh; overflow-y: auto;">
            <div class="grid2" style="margin-bottom: 20px;">
                <div class="metric-card"><div class="metric-label">📋 MÃ CÔNG TRÌNH</div><div class="metric-val" style="font-size: 18px;">${project.id}</div></div>
                <div class="metric-card"><div class="metric-label">💰 NGÂN SÁCH</div><div class="metric-val" style="font-size: 18px; color: var(--accent);">${formatMoneyVND(project.budget)}</div></div>
                <div class="metric-card"><div class="metric-label">📤 ĐÃ XUẤT</div><div class="metric-val" style="font-size: 18px; color: var(--warn-text);">${formatMoneyVND(totalUsage)}</div></div>
                <div class="metric-card"><div class="metric-label">🔄 ĐÃ TRẢ</div><div class="metric-val" style="font-size: 18px; color: var(--success-text);">${formatMoneyVND(totalReturn)}</div></div>
                <div class="metric-card"><div class="metric-label">💸 CHI PHÍ THỰC TẾ</div><div class="metric-val" style="font-size: 18px;">${formatMoneyVND(totalSpent)}</div></div>
                <div class="metric-card"><div class="metric-label">📊 CÒN LẠI</div><div class="metric-val" style="font-size: 18px; color: var(--success-text);">${formatMoneyVND(remaining)}</div></div>
            </div>
            <div class="metric-card" style="margin-bottom: 20px;">
                <div class="metric-label">📈 TIẾN ĐỘ SỬ DỤNG NGÂN SÁCH</div>
                <div class="progress-bar" style="height: 12px;"><div class="progress-fill" style="width: ${Math.min(100, percentUsed)}%; background: ${percentUsed > 90 ? '#A32D2D' : percentUsed > 70 ? '#BA7517' : '#378ADD'};"></div></div>
                <div class="metric-sub" style="margin-top: 8px; text-align: center; font-size: 14px; font-weight: bold;">${percentUsed.toFixed(1)}% đã sử dụng (${usageTransactions.length} lượt xuất, ${returnTransactions.length} lượt trả)</div>
            </div>
            
            <div class="sec-title">📦 THỐNG KÊ VẬT TƯ - NHẬN/SỬ DỤNG/TRẢ</div>
            <div class="tbl-wrap">
                <table style="min-width: 800px;">
                    <thead>
                        <tr>
                            <th>Vật tư</th>
                            <th>Đã nhận từ kho</th>
                            <th>Đã sử dụng</th>
                            <th>Đã trả kho</th>
                            <th>Tồn tại CT</th>
                            <th>% sử dụng</th>
                            <th>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${materialUsageDetails.map(item => {
                            const percentClass = item.usagePercentage > 90 ? 'text-danger' : item.usagePercentage > 70 ? 'text-warning' : 'text-success';
                            return `<tr>
                                <td><strong>${escapeHtml(item.name)}</strong></td>
                                <td style="text-align: right;">${item.totalReceived.toLocaleString('vi-VN')} ${item.unit}</td>
                                <td style="text-align: right; font-weight: bold;">${item.totalUsed.toLocaleString('vi-VN')} ${item.unit}</td>
                                <td style="text-align: right; color: var(--success-text);">${item.totalReturned.toLocaleString('vi-VN')} ${item.unit}</td>
                                <td style="text-align: right; color: var(--accent);">${item.remainingAtSite.toLocaleString('vi-VN')} ${item.unit}</td>
                                <td style="text-align: center;"><span class="badge ${percentClass}">${item.usagePercentage.toFixed(1)}%</span></td>
                                <td style="text-align: center;">
                                    <button class="sm" onclick="event.stopPropagation(); window.openMaterialUsageModal('${projectId}', '${item.id}')">✏️ Cập nhật sử dụng</button>
                                </td>
                            </tr>`;
                        }).join('')}
                        ${materialUsageDetails.length === 0 ? '<tr><td colspan="7" style="text-align: center;">📭 Chưa có vật tư nào được xuất cho công trình}' : ''}
                    </tbody>
                </table>
                <div class="metric-sub" style="margin-top: 8px;">📌 Ghi chú: "Đã nhận từ kho" là số lượng đã xuất sang công trình. "Đã sử dụng" là số thực tế đã dùng (cập nhật thủ công). "Tồn tại CT" = Đã nhận - Đã sử dụng - Đã trả.</div>
            </div>
            
            <div class="sec-title" style="margin-top: 20px;">📜 LỊCH SỬ XUẤT/TRẢ CHI TIẾT</div>
            <div class="tbl-wrap">
                <table style="min-width: 900px;">
                    <thead>
                        <tr>
                            <th>Thời gian</th>
                            <th>Loại</th>
                            <th>Vật tư</th>
                            <th>Số lượng</th>
                            <th>Đơn giá</th>
                            <th>Thành tiền</th>
                            <th>Ghi chú</th>
                            <th>Tệp</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${allTransactions.map(t => {
                            const mat = state.data.materials.find(m => m.id === t.mid);
                            const displayDateTime = t.datetime ? formatDateTime(t.datetime) : t.date;
                            const isReturn = t.type === 'return';
                            const typeIcon = isReturn ? '🔄 Trả hàng' : '📤 Xuất kho';
                            const typeColor = isReturn ? 'var(--success-text)' : 'var(--warn-text)';
                            const attachmentHtml = t.attachment ? `<a href="${t.attachment}" target="_blank" style="color: var(--accent);">📎 Xem</a>` : (t.invoiceImage ? `<a href="${t.invoiceImage}" target="_blank" style="color: var(--accent);">📄 Xem</a>` : '—');
                            const displayQty = typeof t.qty === 'number' ? t.qty.toLocaleString('vi-VN') : parseFloat(t.qty || 0).toLocaleString('vi-VN');
                            return `<tr>
                                <td style="white-space: nowrap;">${displayDateTime}</td>
                                <td style="text-align: center; color: ${typeColor}; white-space: nowrap;">${typeIcon}</td>
                                <td style="white-space: nowrap;">${escapeHtml(mat?.name || 'N/A')}</td>
                                <td style="text-align: right; white-space: nowrap;">${displayQty} ${mat?.unit || ''}</td>
                                <td style="text-align: right; white-space: nowrap;">${formatMoneyVND(t.unitPrice)}</td>
                                <td class="text-warning" style="text-align: right; white-space: nowrap;">${formatMoneyVND(t.totalAmount)}</td>
                                <td style="white-space: nowrap;">${escapeHtml(t.note || '—')}</td>
                                <td style="text-align: center; white-space: nowrap;">${attachmentHtml}</td>
                            </tr>`;
                        }).join('')}
                        ${allTransactions.length === 0 ? '<tr><td colspan="8" style="text-align: center;">📭 Chưa có giao dịch nào</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
            
            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                <button class="sm" onclick="closeModal(); window.exportProjectDetail('${projectId}')">📎 Xuất báo cáo Excel</button>
            </div>
        </div>
        <div class="modal-ft">
            <button onclick="closeModal()">Đóng</button>
            ${hasPermission('canExport') ? `<button class="primary" onclick="closeModal(); window.openTxnModal('usage', '${projectId}')">📤 Xuất kho cho công trình này</button>` : ''}
            ${hasPermission('canImport') ? `<button class="primary" style="background: var(--success);" onclick="closeModal(); window.openReturnModal('${projectId}')">🔄 Trả hàng từ công trình này</button>` : ''}
        </div>
    `;
    showModal(modalContent, null);
}

export function exportProjectDetail(projectId) {
    const project = projectById(projectId);
    if (!project) return;
    const usageTransactions = state.data.transactions.filter(t => t.projectId === projectId && t.type === 'usage');
    const returnTransactions = state.data.transactions.filter(t => t.projectId === projectId && t.type === 'return');
    const totalUsage = usageTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    const totalReturn = returnTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    const totalSpent = totalUsage - totalReturn;
    const remaining = project.budget - totalSpent;
    
    const materialUsageDetails = getMaterialUsageDetails(projectId);
    
    const summaryData = [
        { 'Thông tin': 'Tên công trình', 'Giá trị': project.name },
        { 'Thông tin': 'Mã công trình', 'Giá trị': project.id },
        { 'Thông tin': 'Ngân sách', 'Giá trị': formatMoneyVND(project.budget) },
        { 'Thông tin': 'Đã xuất', 'Giá trị': formatMoneyVND(totalUsage) },
        { 'Thông tin': 'Đã trả', 'Giá trị': formatMoneyVND(totalReturn) },
        { 'Thông tin': 'Chi phí thực tế', 'Giá trị': formatMoneyVND(totalSpent) },
        { 'Thông tin': 'Còn lại', 'Giá trị': formatMoneyVND(remaining) }
    ];
    
    const materialUsageData = materialUsageDetails.map(item => ({
        'Vật tư': item.name,
        'Đơn vị': item.unit,
        'Đã nhận từ kho': item.totalReceived,
        'Đã sử dụng': item.totalUsed,
        'Đã trả kho': item.totalReturned,
        'Tồn tại công trình': item.remainingAtSite,
        'Tỷ lệ sử dụng': `${item.usagePercentage.toFixed(1)}%`
    }));
    
    const detailData = [...usageTransactions, ...returnTransactions].map(t => {
        const mat = state.data.materials.find(m => m.id === t.mid);
        const displayDateTime = t.datetime ? new Date(t.datetime).toLocaleString('vi-VN') : t.date;
        return { 
            'Thời gian': displayDateTime,
            'Loại giao dịch': t.type === 'usage' ? 'Xuất kho' : 'Trả hàng',
            'Mã vật tư': t.mid,
            'Tên vật tư': mat?.name || 'N/A',
            'Số lượng': t.qty,
            'Đơn vị': mat?.unit || '',
            'Đơn giá (VNĐ)': t.unitPrice,
            'Thành tiền (VNĐ)': t.totalAmount,
            'Ghi chú': t.note || ''
        };
    });
    
    if (typeof XLSX !== 'undefined') {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'Tổng quan');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(materialUsageData), 'Sử dụng vật tư');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailData), 'Chi tiết');
        XLSX.writeFile(wb, `baocao_congtrinh_${project.id}_${new Date().toISOString().split('T')[0]}.xlsx`);
        addLog('Xuất báo cáo', `Xuất báo cáo chi tiết công trình: ${project.name}`);
        alert('✅ Đã xuất báo cáo Excel!');
    } else alert('Đang tải thư viện Excel, vui lòng thử lại sau.');
}

export function exportAllProjectsReport() {
    const projects = state.data.projects.map(p => {
        const usageTotal = state.data.transactions.filter(t => t.projectId === p.id && t.type === 'usage').reduce((s, t) => s + (t.totalAmount || 0), 0);
        const returnTotal = state.data.transactions.filter(t => t.projectId === p.id && t.type === 'return').reduce((s, t) => s + (t.totalAmount || 0), 0);
        const netSpent = usageTotal - returnTotal;
        const remaining = p.budget - netSpent;
        const percent = p.budget > 0 ? (netSpent / p.budget) * 100 : 0;
        return { 
            'Mã công trình': p.id, 
            'Tên công trình': p.name, 
            'Ngân sách (VNĐ)': p.budget, 
            'Đã xuất (VNĐ)': usageTotal, 
            'Đã trả (VNĐ)': returnTotal,
            'Chi phí thực tế (VNĐ)': netSpent, 
            'Còn lại (VNĐ)': remaining, 
            '% sử dụng': percent.toFixed(1)
        };
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
    const result = renderProjectSearchBar() + `
    <div class="card">
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
                    <div class="sec-title">📜 LỊCH SỬ XUẤT/TRẢ CHI TIẾT</div>
                    <span class="resize-icon">⤥ Kéo để điều chỉnh</span>
                </div>
                <div class="panel-content" style="max-height: 300px; overflow-y: auto;">
                    <div class="tbl-wrap">
                        <table style="min-width: 900px; width: 100%;">
                            <thead>
                                <tr>
                                    <th>Thời gian</th>
                                    <th>Công trình</th>
                                    <th>Vật tư</th>
                                    <th>Số lượng</th>
                                    <th>Đơn giá</th>
                                    <th>Thành tiền</th>
                                    <th>Loại</th>
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
  const relatedTxns = state.data.transactions.filter(t => t.projectId === pid && (t.type === 'usage' || t.type === 'return'));
  if (!confirm(relatedTxns.length > 0 ? `⚠️ Công trình "${project.name}" đã có ${relatedTxns.length} giao dịch.\nXóa sẽ XÓA LUÔN các giao dịch này.\nTiếp tục?` : `Xóa công trình "${project.name}"?`)) return;
  state.data.projects = state.data.projects.filter(p => p.id !== pid);
  state.data.transactions = state.data.transactions.filter(t => t.projectId !== pid);
  addLog('Xóa công trình', `Đã xóa công trình: ${project.name} (${pid})`);
  saveState(); if(window.render) window.render();
}

window.deleteProjectHandler = (pid) => { deleteProject(pid); };
window.openMaterialUsageModal = openMaterialUsageModal;
window.saveMaterialUsage = saveMaterialUsage;

export function filterProjects() {}
export function clearProjectSearch() {}
export const addProject = (data) => { const newId = genPid(); const newProj = { id: newId, name: data.name, budget: Number(data.budget) || 0, spent: 0 }; state.data.projects.push(newProj); addLog('Thêm công trình', `Đã thêm công trình: ${newProj.name} (${newProj.id}) - Ngân sách: ${formatMoneyVND(newProj.budget)}`); saveState(); if(window.render) window.render(); return newProj; };
export const getProjects = () => state.data.projects;