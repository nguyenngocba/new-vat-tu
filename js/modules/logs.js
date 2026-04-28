import { state, escapeHtml } from './state.js';

export function renderLogs() {
  return `<div class="card"><div class="sec-title">📋 NHẬT KÝ HỆ THỐNG</div>
    <div class="tbl-wrap" style="max-height:70vh;overflow-y:auto">
      ${state.data.logs.slice(0, 200).map(log => `<div class="log-entry">
        <span class="log-time">[${log.timeStr}]</span> 
        <span class="log-user">👤 ${escapeHtml(log.userName)}</span> 
        <span class="log-action">${escapeHtml(log.action)}</span> 
        ${log.details ? `<span class="metric-sub">📝 ${escapeHtml(log.details)}</span>` : ''}
      </div>`).join('')}
      ${state.data.logs.length === 0 ? '<div class="log-entry">Chưa có hoạt động nào được ghi nhận</div>' : ''}
    </div>
  </div>`;
}