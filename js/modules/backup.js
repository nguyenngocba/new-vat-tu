import { state, saveState, addLog } from './state.js';
import { showModal, closeModal } from './auth.js';

export function exportBackup() {
    try {
        const backupData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            data: {
                materials: state.data.materials,
                transactions: state.data.transactions,
                projects: state.data.projects,
                suppliers: state.data.suppliers,
                logs: state.data.logs,
                categories: state.data.categories,
                units: state.data.units,
                nextId: {
                    nextMid: state.data.nextMid,
                    nextTid: state.data.nextTid,
                    nextPid: state.data.nextPid,
                    nextSid: state.data.nextSid,
                    nextLogId: state.data.nextLogId
                }
            }
        };
        const jsonStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `steeltrack_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addLog('Sao lưu dữ liệu', 'Đã xuất backup');
        alert('✅ Đã xuất file backup thành công!');
    } catch (error) {
        console.error(error);
        alert('❌ Có lỗi xảy ra khi xuất backup');
    }
}

export function importBackup(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const backupData = JSON.parse(e.target.result);
                if (!backupData.data) throw new Error('File backup không hợp lệ');
                if (!confirm('⚠️ Import sẽ thay thế toàn bộ dữ liệu hiện tại! Tiếp tục?')) {
                    resolve(false);
                    return;
                }
                if (backupData.data.materials) state.data.materials = backupData.data.materials;
                if (backupData.data.transactions) state.data.transactions = backupData.data.transactions;
                if (backupData.data.projects) state.data.projects = backupData.data.projects;
                if (backupData.data.suppliers) state.data.suppliers = backupData.data.suppliers;
                if (backupData.data.logs) state.data.logs = backupData.data.logs;
                if (backupData.data.categories) state.data.categories = backupData.data.categories;
                if (backupData.data.units) state.data.units = backupData.data.units;
                if (backupData.data.nextId) {
                    state.data.nextMid = backupData.data.nextId.nextMid || 1;
                    state.data.nextTid = backupData.data.nextId.nextTid || 1;
                    state.data.nextPid = backupData.data.nextId.nextPid || 1;
                    state.data.nextSid = backupData.data.nextId.nextSid || 1;
                    state.data.nextLogId = backupData.data.nextId.nextLogId || 1;
                }
                saveState();
                addLog('Khôi phục dữ liệu', 'Đã khôi phục từ backup');
                alert('✅ Khôi phục thành công! Trang sẽ tải lại.');
                resolve(true);
            } catch (error) {
                alert('❌ File backup không hợp lệ');
                reject(error);
            }
        };
        reader.onerror = () => reject();
        reader.readAsText(file);
    });
}

export function showImportBackupModal() {
    showModal(`
        <div class="modal-hd"><span class="modal-title">📥 Khôi phục dữ liệu</span><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-bd">
            <div class="form-group">
                <label class="form-label">Chọn file backup (.json)</label>
                <input type="file" id="backup-file-input" accept=".json">
            </div>
            <div class="metric-card" style="margin-top: 12px; background: var(--warn-bg);">
                <div class="metric-sub">⚠️ CẢNH BÁO: Việc khôi phục sẽ THAY THẾ toàn bộ dữ liệu hiện tại!</div>
            </div>
        </div>
        <div class="modal-ft"><button onclick="closeModal()">Hủy</button><button class="primary" id="confirm-import">Khôi phục</button></div>
    `, null);
    
    setTimeout(() => {
        const confirmBtn = document.getElementById('confirm-import');
        if (confirmBtn) {
            confirmBtn.onclick = () => {
                const fileInput = document.getElementById('backup-file-input');
                const file = fileInput?.files[0];
                if (!file) {
                    alert('Vui lòng chọn file backup');
                    return;
                }
                importBackup(file).then(() => {
                    closeModal();
                    setTimeout(() => window.location.reload(), 500);
                });
            };
        }
    }, 100);
}