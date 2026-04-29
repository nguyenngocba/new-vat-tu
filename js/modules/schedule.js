import { state, saveState, addLog, escapeHtml, showModal, closeModal, formatMoneyVND } from './state.js';
import { setupNumberInput } from './utils.js';

// Lấy tiến độ của công trình
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

// Cập nhật tiến độ tổng thể
function updateScheduleProgress(projectId) {
    const schedule = getProjectSchedule(projectId);
    if (!schedule) return;
    
    function calculateTaskProgress(tasks) {
        let totalWeight = 0;
        let completedWeight = 0;
        
        for (const task of tasks) {
            if (task.subTasks && task.subTasks.length > 0) {
                const subResult = calculateTaskProgress(task.subTasks);
                task.completed = subResult.completed;
                task.progress = subResult.progress;
                totalWeight += task.weight || 1;
                completedWeight += (task.weight || 1) * (task.progress / 100);
            } else {
                totalWeight += task.weight || 1;
                completedWeight += (task.weight || 1) * ((task.completed ? 100 : task.progress || 0) / 100);
            }
        }
        
        return {
            progress: totalWeight > 0 ? (completedWeight / totalWeight) * 100 : 0,
            completed: totalWeight > 0 ? completedWeight / totalWeight * 100 === 100 : false
        };
    }
    
    const result = calculateTaskProgress(schedule.tasks);
    schedule.progress = result.progress;
    schedule.completedDays = Math.floor((schedule.progress / 100) * schedule.totalDays);
    
    saveState();
    return schedule;
}

// Thêm công việc mới
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
        materials: [], // [{ materialId, quantity, unit, totalAmount, assignedFromStock }]
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
    
    saveState();
    addLog('Thêm công việc', `Đã thêm công việc mới vào tiến độ công trình`);
    return newTask;
}

// Cập nhật công việc
export function updateTask(projectId, taskId, updates) {
    const schedule = getProjectSchedule(projectId);
    
    const findAndUpdate = (tasks) => {
        for (const task of tasks) {
            if (task.id === taskId) {
                Object.assign(task, updates);
                // Cập nhật progress nếu có thay đổi
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

// Xóa công việc
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

// Gán vật tư cho công việc
export function assignMaterialToTask(projectId, taskId, materialId, quantity) {
    const schedule = getProjectSchedule(projectId);
    const material = state.data.materials.find(m => m.id === materialId);
    if (!material) return null;
    
    const findTask = (tasks) => {
        for (const task of tasks) {
            if (task.id === taskId) {
                const existing = task.materials.find(m => m.materialId === materialId);
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
                        assignedFromStock: false
                    });
                }
                saveState();
                addLog('Gán vật tư', `Đã gán ${quantity} ${material.unit} ${material.name} cho công việc ${task.name}`);
                return task;
            }
            if (task.subTasks && findTask(task.subTasks)) return true;
        }
        return null;
    };
    
    return findTask(schedule.tasks);
}

// Xóa vật tư khỏi công việc
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

// Render tree view cho công việc
export function renderTaskTree(tasks, projectId, level = 0) {
    if (!tasks || tasks.length === 0) return '';
    
    return tasks.map(task => {
        const indent = level * 24;
        const materialValue = task.materials.reduce((sum, m) => sum + m.totalAmount, 0);
        const progressClass = task.completed ? 'b-ok' : (task.progress > 0 ? 'b-low' : '');
        
        return `
            <div class="task-item" style="margin-left: ${indent}px; border-left: 2px solid var(--border); margin-bottom: 8px;">
                <div class="task-header" style="display: flex; align-items: center; gap: 8px; padding: 8px; background: var(--surface2); border-radius: var(--r);">
                    <button class="sm" onclick="window.toggleTaskExpand('${task.id}')" style="padding: 2px 6px;">
                        ${task.expanded ? '📂' : '📁'}
                    </button>
                    <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="window.toggleTaskComplete('${projectId}', '${task.id}', this.checked)">
                    <strong style="flex: 1;">${escapeHtml(task.name)}</strong>
                    <span class="badge ${progressClass}" style="min-width: 60px;">${task.progress}%</span>
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

// Modal chi tiết công việc
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
            
            <div class="sec-title" style="margin-top: 16px;">📦 Vật tư đã gán</div>
            <div id="task-materials-list" style="max-height: 200px; overflow-y: auto; border: 0.5px solid var(--border); border-radius: var(--r); margin-bottom: 12px;">
                ${materialList || '<div class="metric-sub" style="padding: 12px; text-align: center;">Chưa có vật tư nào được gán</div>'}
            </div>
            
            <div class="sec-title">➕ Gán thêm vật tư</div>
            <div class="form-grid2">
                <div class="form-group">
                    <label class="form-label">Chọn vật tư</label>
                    <select id="assign-material-id">
                        ${state.data.materials.map(m => `<option value="${m.id}">${escapeHtml(m.name)} (${m.unit}) - ${formatMoneyVND(m.cost)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Số lượng</label>
                    <input type="text" id="assign-material-qty" value="1">
                </div>
            </div>
            <button class="sm primary" onclick="window.assignMaterialToTaskFromModal('${projectId}', '${taskId}')" style="width: 100%;">📦 Gán vật tư</button>
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

// Lưu chi tiết công việc
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

// Modal gán vật tư
export function openAssignMaterialModal(projectId, taskId) {
    const modalContent = `
        <div class="modal-hd" style="background: var(--accent-bg);">
            <span class="modal-title">📦 Gán vật tư cho công việc</span>
            <button class="xbtn" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-bd">
            <div class="form-group">
                <label class="form-label">Chọn vật tư</label>
                <select id="assign-material-id">
                    ${state.data.materials.map(m => `<option value="${m.id}">${escapeHtml(m.name)} (${m.unit}) - ${formatMoneyVND(m.cost)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Số lượng</label>
                <input type="text" id="assign-material-qty" value="1">
            </div>
            <div class="metric-card" style="margin-top: 12px; background: var(--warn-bg);">
                <div class="metric-sub">⚠️ Lưu ý: Vật tư được gán ở đây chỉ để theo dõi kế hoạch. Để xuất kho thực tế, bạn cần vào mục "Nhận hàng từ kho".</div>
            </div>
        </div>
        <div class="modal-ft">
            <button onclick="closeModal()">Hủy</button>
            <button class="primary" onclick="window.assignMaterialToTaskFromModal('${projectId}', '${taskId}')">📦 Gán vật tư</button>
        </div>
    `;
    
    showModal(modalContent, null);
    
    setTimeout(() => {
        const qtyInput = document.getElementById('assign-material-qty');
        if (qtyInput) setupNumberInput(qtyInput, { isInteger: false, decimals: null });
    }, 100);
}

// Gán vật tư từ modal
export function assignMaterialToTaskFromModal(projectId, taskId) {
    const materialId = document.getElementById('assign-material-id')?.value;
    const qty = parseFloat(document.getElementById('assign-material-qty')?.value.replace(/\./g, '').replace(/,/g, '.')) || 1;
    
    if (!materialId || qty <= 0) {
        alert('Vui lòng chọn vật tư và nhập số lượng hợp lệ');
        return;
    }
    
    assignMaterialToTask(projectId, taskId, materialId, qty);
    closeModal();
    if (window.openTaskDetailModal) window.openTaskDetailModal(projectId, taskId);
    alert('✅ Đã gán vật tư!');
}

// Render toàn bộ view tiến độ
export function renderScheduleView(projectId) {
    const schedule = getProjectSchedule(projectId);
    const container = document.getElementById('schedule-view-container');
    if (!container) return;
    
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
                    <div class="metric-label">⏱️ Tổng thời gian (ngày)</div>
                    <div class="metric-val" style="font-size: 20px;">${schedule.totalDays || 0}</div>
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

// Cập nhật thông tin tiến độ tổng thể
export function updateScheduleInfo(projectId) {
    const schedule = getProjectSchedule(projectId);
    
    const modalContent = `
        <div class="modal-hd"><span class="modal-title">📝 Cập nhật thông tin tiến độ</span><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-bd">
            <div class="form-group">
                <label class="form-label">Ngày bắt đầu</label>
                <input type="date" id="schedule-start-date" value="${schedule.startDate || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">Ngày kết thúc dự kiến</label>
                <input type="date" id="schedule-end-date" value="${schedule.endDate || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">Tổng thời gian (ngày)</label>
                <input type="number" id="schedule-total-days" value="${schedule.totalDays || 0}" step="0.5">
            </div>
        </div>
        <div class="modal-ft"><button onclick="closeModal()">Hủy</button><button class="primary" onclick="window.saveScheduleInfo('${projectId}')">Lưu</button></div>
    `;
    
    showModal(modalContent, null);
}

export function saveScheduleInfo(projectId) {
    const startDate = document.getElementById('schedule-start-date')?.value;
    const endDate = document.getElementById('schedule-end-date')?.value;
    const totalDays = parseFloat(document.getElementById('schedule-total-days')?.value) || 0;
    
    const schedule = getProjectSchedule(projectId);
    schedule.startDate = startDate;
    schedule.endDate = endDate;
    schedule.totalDays = totalDays;
    
    saveState();
    closeModal();
    renderScheduleView(projectId);
    alert('✅ Đã cập nhật thông tin tiến độ!');
}

// Các hàm global
window.addRootTask = (projectId) => {
    addTask(projectId);
    renderScheduleView(projectId);
};

window.addSubTask = (projectId, parentTaskId) => {
    addTask(projectId, parentTaskId);
    renderScheduleView(projectId);
};

window.toggleTaskExpand = (taskId) => {
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
    const schedule = getProjectSchedule(window.currentScheduleProjectId);
    if (schedule) findAndToggle(schedule.tasks);
    if (window.renderScheduleView) window.renderScheduleView(window.currentScheduleProjectId);
};

window.toggleTaskComplete = (projectId, taskId, isComplete) => {
    updateTask(projectId, taskId, { completed: isComplete, progress: isComplete ? 100 : 0 });
    if (window.renderScheduleView) window.renderScheduleView(projectId);
};

window.deleteTaskHandler = (projectId, taskId) => {
    if (confirm('Bạn có chắc chắn muốn xóa công việc này và tất cả công việc con?')) {
        deleteTask(projectId, taskId);
        if (window.renderScheduleView) window.renderScheduleView(projectId);
    }
};

window.openTaskDetailModal = openTaskDetailModal;
window.saveTaskDetail = saveTaskDetail;
window.openAssignMaterialModal = openAssignMaterialModal;
window.assignMaterialToTaskFromModal = assignMaterialToTaskFromModal;
window.removeMaterialFromTask = (projectId, taskId, materialId) => {
    if (confirm('Xóa vật tư này khỏi công việc?')) {
        removeMaterialFromTask(projectId, taskId, materialId);
        if (window.openTaskDetailModal) window.openTaskDetailModal(projectId, taskId);
    }
};
window.updateScheduleInfo = updateScheduleInfo;
window.saveScheduleInfo = saveScheduleInfo;
window.renderScheduleView = renderScheduleView;