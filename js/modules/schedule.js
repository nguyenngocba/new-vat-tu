import { state, saveState, addLog, escapeHtml, showModal, closeModal } from './state.js';
import { formatMoneyVND, setupNumberInput, parseNumber } from './utils.js';

// ========== HELPER: LẤY VẬT TƯ ĐÃ XUẤT CHO CÔNG TRÌNH ==========

function getMaterialsExportedToProject(projectId) {
    // Lấy tất cả giao dịch xuất kho (usage) cho công trình này
    const usageTransactions = state.data.transactions.filter(
        t => t.projectId === projectId && t.type === 'usage'
    );
    
    // Lấy tất cả giao dịch trả hàng (return) cho công trình này
    const returnTransactions = state.data.transactions.filter(
        t => t.projectId === projectId && t.type === 'return'
    );
    
    // Lấy danh sách vật tư duy nhất đã xuất
    const materialIds = [...new Set(usageTransactions.map(t => t.mid))];
    
    // Trả về thông tin vật tư kèm số lượng đã xuất (đã trừ trả hàng)
    return materialIds.map(mid => {
        const mat = state.data.materials.find(m => m.id === mid);
        if (!mat) return null;
        
        const totalExported = usageTransactions
            .filter(t => t.mid === mid)
            .reduce((sum, t) => sum + (t.qty || 0), 0);
        
        const totalReturned = returnTransactions
            .filter(t => t.mid === mid)
            .reduce((sum, t) => sum + (t.qty || 0), 0);
        
        const netAvailable = totalExported - totalReturned;
        
        return {
            id: mat.id,
            name: mat.name,
            unit: mat.unit,
            cost: mat.cost,
            totalExported: totalExported,
            totalReturned: totalReturned,
            netAvailable: netAvailable
        };
    }).filter(item => item !== null && item.netAvailable > 0);
}

// ========== LẤY TIẾN ĐỘ CỦA CÔNG TRÌNH ==========

export function getProjectSchedule(projectId) {
    const schedule = state.data.projectSchedules?.find(s => s.projectId === projectId);
    if (!schedule) {
        // Tạo mới nếu chưa có
        const newSchedule = {
            projectId: projectId,
            startDate: new Date().toISOString().split('T')[0],
            endDate: null,
            totalDays: 0,
            completedDays: 0,
            progress: 0,
            tasks: []
        };
        if (!state.data.projectSchedules) state.data.projectSchedules = [];
        state.data.projectSchedules.push(newSchedule);
        saveState();
        return newSchedule;
    }
    return schedule;
}

// ========== CẬP NHẬT TIẾN ĐỘ TỔNG THỂ ==========

function updateScheduleProgress(projectId) {
    const schedule = getProjectSchedule(projectId);
    if (!schedule) return;
    
    function calculateTaskProgress(tasks) {
        let totalWeight = 0;
        let completedWeight = 0;
        
        for (const task of tasks) {
            if (task.subTasks && task.subTasks.length > 0) {
                const subResult = calculateTaskProgress(task.subTasks);
                task.completed = subResult.progress >= 100;
                task.progress = subResult.progress;
                totalWeight += task.weight || 1;
                completedWeight += (task.weight || 1) * (task.progress / 100);
            } else {
                totalWeight += task.weight || 1;
                completedWeight += (task.weight || 1) * ((task.completed ? 100 : task.progress || 0) / 100);
            }
        }
        
        const progress = totalWeight > 0 ? (completedWeight / totalWeight) * 100 : 0;
        
        return {
            progress: progress,
            completed: progress >= 100
        };
    }
    
    const result = calculateTaskProgress(schedule.tasks);
    schedule.progress = result.progress;
    
    // Tự động tính completedDays dựa trên progress và totalDays
    if (schedule.totalDays > 0) {
        schedule.completedDays = Math.floor((schedule.progress / 100) * schedule.totalDays);
    }
    
    // Tự động tính totalDays từ startDate và endDate nếu có
    if (schedule.startDate && schedule.endDate) {
        const start = new Date(schedule.startDate);
        const end = new Date(schedule.endDate);
        const diffTime = end.getTime() - start.getTime();
        const calculatedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        if (calculatedDays > 0) {
            schedule.totalDays = calculatedDays;
        }
    }
    
    saveState();
    return schedule;
}

// ========== THÊM CÔNG VIỆC MỚI ==========

export function addTask(projectId, parentTaskId = null) {
    const schedule = getProjectSchedule(projectId);
    
    const newTask = {
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        name: 'Công việc mới',
        description: '',
        startDate: schedule.startDate,
        endDate: null,
        duration: 1,
        weight: 1,
        progress: 0,
        completed: false,
        materials: [],
        subTasks: [],
        expanded: true
    };
    
    if (parentTaskId) {
        const addToParent = (tasks) => {
            for (const task of tasks) {
                if (task.id === parentTaskId) {
                    task.subTasks.push(newTask);
                    return true;
                }
                if (task.subTasks && addToParent(task.subTasks)) return true;
            }
            return false;
        };
        addToParent(schedule.tasks);
    } else {
        schedule.tasks.push(newTask);
    }
    
    updateScheduleProgress(projectId);
    saveState();
    addLog('Thêm công việc', `Đã thêm công việc mới vào tiến độ công trình`);
    return newTask;
}

// ========== CẬP NHẬT CÔNG VIỆC ==========

export function updateTask(projectId, taskId, updates) {
    const schedule = getProjectSchedule(projectId);
    
    const findAndUpdate = (tasks) => {
        for (const task of tasks) {
            if (task.id === taskId) {
                Object.assign(task, updates);
                if (updates.completed !== undefined || updates.progress !== undefined) {
                    task.completed = updates.completed || task.progress >= 100;
                    if (task.completed) task.progress = 100;
                }
                updateScheduleProgress(projectId);
                saveState();
                addLog('Cập nhật công việc', `Đã cập nhật công việc: ${task.name}`);
                return true;
            }
            if (task.subTasks && findAndUpdate(task.subTasks)) return true;
        }
        return false;
    };
    
    findAndUpdate(schedule.tasks);
    return schedule;
}

// ========== XÓA CÔNG VIỆC ==========

export function deleteTask(projectId, taskId) {
    const schedule = getProjectSchedule(projectId);
    
    const findAndDelete = (tasks) => {
        for (let i = 0; i < tasks.length; i++) {
            if (tasks[i].id === taskId) {
                tasks.splice(i, 1);
                updateScheduleProgress(projectId);
                saveState();
                addLog('Xóa công việc', `Đã xóa công việc khỏi tiến độ`);
                return true;
            }
            if (tasks[i].subTasks && findAndDelete(tasks[i].subTasks)) return true;
        }
        return false;
    };
    
    findAndDelete(schedule.tasks);
    return schedule;
}

// ========== GÁN VẬT TƯ CHO CÔNG VIỆC ==========

export function assignMaterialToTask(projectId, taskId, materialId, quantity) {
    const schedule = getProjectSchedule(projectId);
    
    // Lấy vật tư từ danh sách đã xuất cho công trình
    const exportedMaterials = getMaterialsExportedToProject(projectId);
    const exportedMat = exportedMaterials.find(m => m.id === materialId);
    
    if (!exportedMat) {
        alert('Vật tư này chưa được xuất cho công trình. Vui lòng xuất kho trước!');
        return null;
    }
    
    const material = state.data.materials.find(m => m.id === materialId);
    if (!material) return null;
    
    // Kiểm tra tổng số lượng đã gán cho tất cả công việc
    const allTasks = getAllTasksFlat(schedule.tasks);
    let totalAssigned = 0;
    for (const t of allTasks) {
        if (t.id !== taskId) {
            const matAssignment = t.materials.find(m => m.materialId === materialId);
            if (matAssignment) {
                totalAssigned += matAssignment.quantity;
            }
        }
    }
    
    const findTask = (tasks) => {
        for (const task of tasks) {
            if (task.id === taskId) {
                const existing = task.materials.find(m => m.materialId === materialId);
                const currentTaskQty = existing ? existing.quantity : 0;
                const newTotalAssigned = totalAssigned + quantity;
                
                // Kiểm tra không vượt quá số lượng đã xuất
                if (newTotalAssigned > exportedMat.netAvailable) {
                    alert(`Không thể gán ${quantity} ${material.unit} ${material.name}.\n` +
                          `Đã gán cho các công việc khác: ${totalAssigned.toLocaleString('vi-VN')} ${material.unit}\n` +
                          `Có sẵn từ xuất kho: ${exportedMat.netAvailable.toLocaleString('vi-VN')} ${material.unit}\n` +
                          `Còn có thể gán: ${(exportedMat.netAvailable - totalAssigned).toLocaleString('vi-VN')} ${material.unit}`);
                    return null;
                }
                
                if (existing) {
                    existing.quantity += quantity;
                    existing.totalAmount = existing.quantity * existing.unitPrice;
                } else {
                    task.materials.push({
                        materialId: materialId,
                        materialName: material.name,
                        unit: material.unit,
                        quantity: quantity,
                        unitPrice: material.cost,
                        totalAmount: quantity * material.cost,
                        assignedFromStock: true
                    });
                }
                saveState();
                addLog('Gán vật tư', `Đã gán ${quantity} ${material.unit} ${material.name} cho công việc ${task.name}`);
                return task;
            }
            if (task.subTasks) {
                const result = findTask(task.subTasks);
                if (result) return result;
            }
        }
        return null;
    };
    
    return findTask(schedule.tasks);
}

// Hàm helper lấy tất cả công việc (làm phẳng cây)
function getAllTasksFlat(tasks) {
    let result = [];
    for (const task of tasks) {
        result.push(task);
        if (task.subTasks && task.subTasks.length > 0) {
            result = result.concat(getAllTasksFlat(task.subTasks));
        }
    }
    return result;
}

// ========== XÓA VẬT TƯ KHỎI CÔNG VIỆC ==========

export function removeMaterialFromTask(projectId, taskId, materialId) {
    const schedule = getProjectSchedule(projectId);
    
    const findAndRemove = (tasks) => {
        for (const task of tasks) {
            if (task.id === taskId) {
                const index = task.materials.findIndex(m => m.materialId === materialId);
                if (index !== -1) {
                    task.materials.splice(index, 1);
                    saveState();
                    addLog('Xóa vật tư', `Đã xóa vật tư khỏi công việc ${task.name}`);
                }
                return true;
            }
            if (task.subTasks && findAndRemove(task.subTasks)) return true;
        }
        return false;
    };
    
    findAndRemove(schedule.tasks);
    return schedule;
}

// ========== RENDER TREE VIEW CHO CÔNG VIỆC ==========

export function renderTaskTree(tasks, projectId, level = 0) {
    if (!tasks || tasks.length === 0) return '';
    
    return tasks.map(task => {
        const indent = level * 24;
        const materialValue = task.materials.reduce((sum, m) => sum + m.totalAmount, 0);
        const progressClass = task.completed ? 'b-ok' : (task.progress > 0 ? 'b-low' : '');
        
        return `
            <div class="task-item" style="margin-left: ${indent}px; border-left: 2px solid var(--border); margin-bottom: 8px;">
                <div class="task-header" style="display: flex; align-items: center; gap: 8px; padding: 8px; background: var(--surface2); border-radius: var(--r);">
                    ${task.subTasks && task.subTasks.length > 0 ? `
                        <button class="sm" onclick="window.toggleTaskExpand('${task.id}')" style="padding: 2px 6px;">
                            ${task.expanded ? '📂' : '📁'}
                        </button>
                    ` : '<span style="width: 28px; display: inline-block;"></span>'}
                    <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="window.toggleTaskComplete('${projectId}', '${task.id}', this.checked)">
                    <strong style="flex: 1;">${escapeHtml(task.name)}</strong>
                    <span class="badge ${progressClass}" style="min-width: 60px;">${task.progress.toFixed(0)}%</span>
                    <span class="metric-sub">📅 ${task.duration} ngày</span>
                    <span class="metric-sub">💰 ${formatMoneyVND(materialValue)}</span>
                    <button class="sm" onclick="window.openTaskDetailModal('${projectId}', '${task.id}')">✏️ Chi tiết</button>
                    <button class="sm danger-btn" onclick="window.deleteTaskHandler('${projectId}', '${task.id}')">🗑️</button>
                </div>
                <div class="task-children" style="margin-left: 20px; ${task.expanded ? '' : 'display: none;'}">
                    <div class="task-actions" style="padding: 8px 0 0 20px;">
                        <button class="sm" onclick="window.addSubTask('${projectId}', '${task.id}')">+ Thêm công việc con</button>
                        <button class="sm" onclick="window.openAssignMaterialModal('${projectId}', '${task.id}')">📦 Gán vật tư</button>
                    </div>
                    ${renderTaskTree(task.subTasks, projectId, level + 1)}
                </div>
            </div>
        `;
    }).join('');
}

// ========== MODAL CHI TIẾT CÔNG VIỆC ==========

export function openTaskDetailModal(projectId, taskId) {
    const schedule = getProjectSchedule(projectId);
    
    const findTask = (tasks) => {
        for (const task of tasks) {
            if (task.id === taskId) return task;
            if (task.subTasks) {
                const found = findTask(task.subTasks);
                if (found) return found;
            }
        }
        return null;
    };
    
    const task = findTask(schedule.tasks);
    if (!task) return;
    
    // Lấy vật tư đã xuất cho công trình
    const exportedMaterials = getMaterialsExportedToProject(projectId);
    
    const materialList = task.materials.map(m => `
        <div class="material-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 0.5px solid var(--border);">
            <div>
                <strong>${escapeHtml(m.materialName)}</strong>
                <span class="metric-sub">${m.quantity.toLocaleString('vi-VN')} ${m.unit} x ${formatMoneyVND(m.unitPrice)}</span>
            </div>
            <div>
                <span class="text-warning">${formatMoneyVND(m.totalAmount)}</span>
                <button class="sm danger-btn" onclick="window.removeMaterialFromTask('${projectId}', '${taskId}', '${m.materialId}')">🗑️</button>
            </div>
        </div>
    `).join('');
    
    // Tạo dropdown từ vật tư đã xuất
    const materialOptions = exportedMaterials.length > 0 
        ? exportedMaterials.map(m => 
            `<option value="${m.id}">${escapeHtml(m.name)} (Đã xuất: ${m.netAvailable.toLocaleString('vi-VN')} ${m.unit} | Giá: ${formatMoneyVND(m.cost)})</option>`
          ).join('')
        : '<option value="">⚠️ Chưa có vật tư nào được xuất cho công trình này</option>';
    
    const modalContent = `
        <div class="modal-hd" style="background: var(--accent-bg);">
            <span class="modal-title">✏️ Chi tiết công việc: ${escapeHtml(task.name)}</span>
            <button class="xbtn" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-bd">
            <div class="form-grid2">
                <div class="form-group form-full">
                    <label class="form-label">Tên công việc</label>
                    <input type="text" id="task-name" value="${escapeHtml(task.name)}">
                </div>
                <div class="form-group form-full">
                    <label class="form-label">Mô tả</label>
                    <textarea id="task-desc" rows="3">${escapeHtml(task.description || '')}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Thời gian dự kiến (ngày)</label>
                    <input type="number" id="task-duration" value="${task.duration || 1}" min="0.5" step="0.5">
                </div>
                <div class="form-group">
                    <label class="form-label">Trọng số (độ ưu tiên)</label>
                    <input type="number" id="task-weight" value="${task.weight || 1}" min="0.5" step="0.5">
                </div>
                <div class="form-group">
                    <label class="form-label">Tiến độ (%)</label>
                    <input type="number" id="task-progress" value="${task.progress || 0}" min="0" max="100" step="5">
                </div>
                <div class="form-group">
                    <label class="form-label">Hoàn thành</label>
                    <input type="checkbox" id="task-completed" ${task.completed ? 'checked' : ''}>
                </div>
                <div class="form-group form-full">
                    <label class="form-label">Ngày bắt đầu</label>
                    <input type="date" id="task-start-date" value="${task.startDate || schedule.startDate}">
                </div>
                <div class="form-group form-full">
                    <label class="form-label">Ngày kết thúc dự kiến</label>
                    <input type="date" id="task-end-date" value="${task.endDate || ''}">
                </div>
            </div>
            
            <div class="sec-title" style="margin-top: 16px;">📦 Vật tư đã gán (từ vật tư đã xuất cho công trình)</div>
            <div id="task-materials-list" style="max-height: 200px; overflow-y: auto; border: 0.5px solid var(--border); border-radius: var(--r); margin-bottom: 12px;">
                ${materialList || '<div class="metric-sub" style="padding: 12px; text-align: center;">Chưa có vật tư nào được gán</div>'}
            </div>
            
            ${exportedMaterials.length > 0 ? `
            <div class="sec-title">➕ Gán thêm vật tư (từ vật tư đã xuất cho công trình)</div>
            <div class="form-grid2">
                <div class="form-group">
                    <label class="form-label">Chọn vật tư</label>
                    <select id="assign-material-id">
                        ${materialOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Số lượng</label>
                    <input type="text" id="assign-material-qty" value="1">
                </div>
            </div>
            <button class="sm primary" onclick="window.assignMaterialToTaskFromModal('${projectId}', '${taskId}')" style="width: 100%;">📦 Gán vật tư</button>
            ` : '<div class="metric-card" style="background: var(--warn-bg); margin-top: 12px;"><div class="metric-sub">⚠️ Vui lòng xuất kho vật tư cho công trình này trước khi gán vào công việc!</div></div>'}
            
            <div class="metric-card" style="margin-top: 12px; background: var(--accent-bg);">
                <div class="metric-sub">📌 Lưu ý: Chỉ có thể gán vật tư đã được xuất kho cho công trình này.</div>
            </div>
        </div>
        <div class="modal-ft">
            <button onclick="closeModal()">Đóng</button>
            <button class="primary" onclick="window.saveTaskDetail('${projectId}', '${taskId}')">💾 Lưu thay đổi</button>
        </div>
    `;
    
    showModal(modalContent, null);
    
    setTimeout(() => {
        const qtyInput = document.getElementById('assign-material-qty');
        if (qtyInput) setupNumberInput(qtyInput, { isInteger: false, decimals: null });
    }, 100);
}

// ========== LƯU CHI TIẾT CÔNG VIỆC ==========

export function saveTaskDetail(projectId, taskId) {
    const name = document.getElementById('task-name')?.value;
    const description = document.getElementById('task-desc')?.value;
    const duration = parseFloat(document.getElementById('task-duration')?.value) || 1;
    const weight = parseFloat(document.getElementById('task-weight')?.value) || 1;
    let progress = parseFloat(document.getElementById('task-progress')?.value) || 0;
    const completed = document.getElementById('task-completed')?.checked || false;
    const startDate = document.getElementById('task-start-date')?.value;
    const endDate = document.getElementById('task-end-date')?.value;
    
    if (completed) progress = 100;
    
    updateTask(projectId, taskId, {
        name,
        description,
        duration,
        weight,
        progress,
        completed,
        startDate,
        endDate
    });
    
    closeModal();
    if (window.renderScheduleView) window.renderScheduleView(projectId);
    alert('✅ Đã cập nhật công việc!');
}

// ========== MODAL GÁN VẬT TƯ ==========

export function openAssignMaterialModal(projectId, taskId) {
    // Lấy vật tư đã xuất cho công trình
    const exportedMaterials = getMaterialsExportedToProject(projectId);
    
    const materialOptions = exportedMaterials.length > 0 
        ? exportedMaterials.map(m => 
            `<option value="${m.id}">${escapeHtml(m.name)} (Đã xuất: ${m.netAvailable.toLocaleString('vi-VN')} ${m.unit} | Giá: ${formatMoneyVND(m.cost)})</option>`
          ).join('')
        : '<option value="">⚠️ Chưa có vật tư nào được xuất cho công trình này</option>';
    
    const modalContent = `
        <div class="modal-hd" style="background: var(--accent-bg);">
            <span class="modal-title">📦 Gán vật tư cho công việc</span>
            <button class="xbtn" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-bd">
            ${exportedMaterials.length > 0 ? `
            <div class="form-group">
                <label class="form-label">Chọn vật tư (đã xuất cho công trình)</label>
                <select id="assign-material-id">
                    ${materialOptions}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Số lượng</label>
                <input type="text" id="assign-material-qty" value="1">
            </div>
            ` : '<div class="metric-card" style="background: var(--warn-bg);"><div class="metric-sub">⚠️ Chưa có vật tư nào được xuất cho công trình này. Vui lòng xuất kho trước!</div></div>'}
            
            <div class="metric-card" style="margin-top: 12px; background: var(--accent-bg);">
                <div class="metric-sub">📌 Lưu ý: Chỉ có thể gán vật tư đã được xuất kho cho công trình này.</div>
            </div>
        </div>
        <div class="modal-ft">
            <button onclick="closeModal()">Hủy</button>
            ${exportedMaterials.length > 0 ? `<button class="primary" onclick="window.assignMaterialToTaskFromModal('${projectId}', '${taskId}')">📦 Gán vật tư</button>` : ''}
        </div>
    `;
    
    showModal(modalContent, null);
    
    setTimeout(() => {
        const qtyInput = document.getElementById('assign-material-qty');
        if (qtyInput) setupNumberInput(qtyInput, { isInteger: false, decimals: null });
    }, 100);
}

// ========== GÁN VẬT TƯ TỪ MODAL ==========

export function assignMaterialToTaskFromModal(projectId, taskId) {
    const materialId = document.getElementById('assign-material-id')?.value;
    const qtyInput = document.getElementById('assign-material-qty');
    const qty = parseNumber(qtyInput?.value) || 1;
    
    if (!materialId || qty <= 0) {
        alert('Vui lòng chọn vật tư và nhập số lượng hợp lệ');
        return;
    }
    
    assignMaterialToTask(projectId, taskId, materialId, qty);
    closeModal();
    if (window.openTaskDetailModal) window.openTaskDetailModal(projectId, taskId);
    alert('✅ Đã gán vật tư!');
}

// ========== RENDER TOÀN BỘ VIEW TIẾN ĐỘ ==========

export function renderScheduleView(projectId) {
    const schedule = getProjectSchedule(projectId);
    const container = document.getElementById('schedule-view-container');
    if (!container) return;
    
    // Cập nhật tiến độ trước khi render
    updateScheduleProgress(projectId);
    
    const progressPercent = schedule.progress || 0;
    const progressClass = progressPercent >= 100 ? 'b-ok' : (progressPercent > 0 ? 'b-low' : '');
    
    container.innerHTML = `
        <div class="card" style="margin-bottom: 16px;">
            <div class="sec-title">📅 TIẾN ĐỘ CÔNG TRÌNH</div>
            <div class="grid2" style="margin-bottom: 16px;">
                <div class="metric-card">
                    <div class="metric-label">📅 Ngày bắt đầu</div>
                    <div class="metric-val" style="font-size: 16px;">${schedule.startDate || 'Chưa thiết lập'}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">📅 Ngày kết thúc dự kiến</div>
                    <div class="metric-val" style="font-size: 16px;">${schedule.endDate || 'Chưa thiết lập'}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">⏱️ Tổng thời gian (ngày) - Tự động tính</div>
                    <div class="metric-val" style="font-size: 20px;">${schedule.totalDays || 0}</div>
                    <div class="metric-sub">Tự động tính từ ngày bắt đầu đến ngày kết thúc</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">✅ Tiến độ hoàn thành</div>
                    <div class="metric-val" style="font-size: 20px;">${progressPercent.toFixed(1)}%</div>
                    <div class="progress-bar" style="margin-top: 8px;"><div class="progress-fill" style="width: ${progressPercent}%; background: ${progressPercent > 90 ? '#A32D2D' : '#378ADD'};"></div></div>
                </div>
            </div>
            <div style="display: flex; gap: 8px; margin-bottom: 16px;">
                <button class="sm primary" onclick="window.addRootTask('${projectId}')">+ Thêm công việc gốc</button>
                <button class="sm" onclick="window.updateScheduleInfo('${projectId}')">📝 Cập nhật thông tin tiến độ</button>
            </div>
            <div class="sec-title">📋 DANH SÁCH CÔNG VIỆC</div>
            <div id="task-tree-container" class="task-tree" style="max-height: 500px; overflow-y: auto;">
                ${renderTaskTree(schedule.tasks, projectId)}
            </div>
            ${schedule.tasks.length === 0 ? '<div class="metric-sub" style="text-align: center; padding: 20px;">Chưa có công việc nào. Hãy thêm công việc để bắt đầu!</div>' : ''}
        </div>
    `;
}

// ========== CẬP NHẬT THÔNG TIN TIẾN ĐỘ TỔNG THỂ ==========

export function updateScheduleInfo(projectId) {
    const schedule = getProjectSchedule(projectId);
    
    const modalContent = `
        <div class="modal-hd"><span class="modal-title">📝 Cập nhật thông tin tiến độ</span><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-bd">
            <div class="form-group">
                <label class="form-label">Ngày bắt đầu</label>
                <input type="date" id="schedule-start-date" value="${schedule.startDate || ''}" onchange="window.calculateScheduleDays()">
            </div>
            <div class="form-group">
                <label class="form-label">Ngày kết thúc dự kiến</label>
                <input type="date" id="schedule-end-date" value="${schedule.endDate || ''}" onchange="window.calculateScheduleDays()">
            </div>
            <div class="form-group">
                <label class="form-label">⏱️ Tổng thời gian (ngày) - Tự động tính</label>
                <input type="number" id="schedule-total-days" value="${schedule.totalDays || 0}" step="1" readonly style="background: var(--surface3); font-weight: bold; font-size: 16px;">
            </div>
            <div class="metric-sub" style="margin-top: 8px; color: var(--accent-text);">
                ℹ️ Tổng thời gian được tự động tính từ ngày bắt đầu đến ngày kết thúc (bao gồm cả ngày bắt đầu).
            </div>
        </div>
        <div class="modal-ft"><button onclick="closeModal()">Hủy</button><button class="primary" onclick="window.saveScheduleInfo('${projectId}')">Lưu</button></div>
    `;
    
    showModal(modalContent, null);
}

// Hàm tính toán số ngày
window.calculateScheduleDays = function() {
    const startDateInput = document.getElementById('schedule-start-date');
    const endDateInput = document.getElementById('schedule-end-date');
    const totalDaysInput = document.getElementById('schedule-total-days');
    
    if (startDateInput && endDateInput && totalDaysInput) {
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            // Tính số ngày chênh lệch (bao gồm cả ngày bắt đầu và kết thúc)
            const diffTime = end.getTime() - start.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 để bao gồm cả ngày bắt đầu
            
            if (diffDays > 0) {
                totalDaysInput.value = diffDays;
            } else {
                totalDaysInput.value = 0;
            }
        }
    }
};

export function saveScheduleInfo(projectId) {
    const startDate = document.getElementById('schedule-start-date')?.value;
    const endDate = document.getElementById('schedule-end-date')?.value;
    let totalDays = parseFloat(document.getElementById('schedule-total-days')?.value) || 0;
    
    // Nếu chưa có totalDays, tự động tính
    if (totalDays === 0 && startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = end.getTime() - start.getTime();
        totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }
    
    const schedule = getProjectSchedule(projectId);
    schedule.startDate = startDate;
    schedule.endDate = endDate;
    schedule.totalDays = Math.max(0, totalDays);
    
    saveState();
    closeModal();
    renderScheduleView(projectId);
    alert('✅ Đã cập nhật thông tin tiến độ!');
}

// ========== CÁC HÀM GLOBAL ==========

window.addRootTask = (projectId) => {
    addTask(projectId);
    renderScheduleView(projectId);
};

window.addSubTask = (projectId, parentTaskId) => {
    addTask(projectId, parentTaskId);
    renderScheduleView(projectId);
};

window.toggleTaskExpand = (taskId) => {
    // Tìm projectId từ biến global
    const projectId = window.currentScheduleProjectId;
    if (!projectId) return;
    
    const schedule = getProjectSchedule(projectId);
    if (!schedule) return;
    
    const findAndToggle = (tasks) => {
        for (const task of tasks) {
            if (task.id === taskId) {
                task.expanded = !task.expanded;
                saveState();
                return true;
            }
            if (task.subTasks && findAndToggle(task.subTasks)) return true;
        }
        return false;
    };
    
    findAndToggle(schedule.tasks);
    renderScheduleView(projectId);
};

window.toggleTaskComplete = (projectId, taskId, isComplete) => {
    updateTask(projectId, taskId, { completed: isComplete, progress: isComplete ? 100 : 0 });
    renderScheduleView(projectId);
};

window.deleteTaskHandler = (projectId, taskId) => {
    if (confirm('Bạn có chắc chắn muốn xóa công việc này và tất cả công việc con?')) {
        deleteTask(projectId, taskId);
        renderScheduleView(projectId);
    }
};

window.openTaskDetailModal = openTaskDetailModal;
window.saveTaskDetail = saveTaskDetail;
window.openAssignMaterialModal = openAssignMaterialModal;
window.assignMaterialToTaskFromModal = assignMaterialToTaskFromModal;
window.removeMaterialFromTask = (projectId, taskId, materialId) => {
    if (confirm('Xóa vật tư này khỏi công việc?')) {
        removeMaterialFromTask(projectId, taskId, materialId);
        openTaskDetailModal(projectId, taskId);
    }
};
window.updateScheduleInfo = updateScheduleInfo;
window.saveScheduleInfo = saveScheduleInfo;
window.renderScheduleView = renderScheduleView;
window.calculateScheduleDays = window.calculateScheduleDays;