import { state, escapeHtml } from './state.js';

export function renderLogs() {
    const logs = state.data.logs.slice(0, 200);
    return `<div class="card"><div class="sec-title">📋 NHẬT KÝ HỆ THỐNG (${logs.length})</div>
        <div class="tbl-wrap" style="max-height:70vh;overflow-y:auto">
            ${logs.length > 0 ? logs.map(log => {
                const time = log.timeStr || new Date(log.timestamp).toLocaleString('vi-VN');
                return `<div class="log-entry">
                    <span class="log-time">[${time}]</span> 
                    <span class="log-user">👤 ${escapeHtml(log.userName || 'System')}</span> 
                    <span class="log-action">${escapeHtml(log.action || '')}</span> 
                    ${log.details ? `<span class="metric-sub">📝 ${escapeHtml(log.details)}</span>` : ''}
                </div>`;
            }).join('') : '<div class="log-entry">Chưa có hoạt động nào</div>'}
        </div>
    </div>`;
}
