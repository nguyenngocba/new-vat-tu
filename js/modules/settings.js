import { state, saveState, addLog, escapeHtml, applyTheme, hasPermission, isAdmin } from './state.js';

export function renderSettings() {
    if (!hasPermission('canAccessSettings')) return '<div class="card">🔒 Không có quyền.</div>';
    let userHtml = state.data.users.map(u => {
        let permHtml = u.role === 'admin' ? '🔓 Toàn quyền' : '';
        return '<tr><td><strong>' + escapeHtml(u.name) + '</strong>' + (u.id === state.currentUser.id ? ' <span class="tag">Bạn</span>' : '') + '</td><td>' + u.username + '</td><td><span class="tag">' + (u.role === 'admin' ? 'Admin' : 'Nhân viên') + '</span></td><td>' + permHtml + '</td><td><button class="sm" onclick="changePassword(\'' + u.id + '\')">🔑 Đổi MK</button> ' + (u.id !== state.currentUser.id ? '<button class="sm danger-btn" onclick="deleteUser(\'' + u.id + '\')">🗑️</button>' : '') + '</td></tr>';
    }).join('');
    let catHtml = state.data.categories.map(c => '<div class="setting-item"><span>📌 ' + escapeHtml(c) + '</span><button class="sm danger-btn" onclick="window.delCat(\'' + c + '\')">Xóa</button></div>').join('');
    let unitHtml = state.data.units.map(u => '<div class="setting-item"><span>📏 ' + escapeHtml(u) + '</span><button class="sm danger-btn" onclick="window.delUnit(\'' + u + '\')">Xóa</button></div>').join('');
    return '<div class="card"><div class="sec-title">👥 NGƯỜI DÙNG</div><button class="sm primary" style="margin-bottom:16px" onclick="addUser()">+ Thêm</button><table>' + userHtml + '</table><div style="margin-top:24px"><div class="sec-title">📂 DANH MỤC</div>' + catHtml + '<div style="display:flex;gap:8px;margin-top:12px"><input id="newCat" style="flex:1"><button class="sm primary" onclick="addCategory()">+ Thêm</button></div></div><div style="margin-top:24px"><div class="sec-title">📏 ĐƠN VỊ</div>' + unitHtml + '<div style="display:flex;gap:8px;margin-top:12px"><input id="newUnit" style="flex:1"><button class="sm primary" onclick="addUnit()">+ Thêm</button></div></div><div style="margin-top:24px"><button class="sm" onclick="toggleTheme()">' + (state.theme === 'dark' ? '☀️ Sáng' : '🌙 Tối') + '</button></div></div>';
}

window.delCat = function(c) { if (confirm('Xóa danh mục "' + c + '"?')) { state.data.categories = state.data.categories.filter(x => x !== c); saveState(); window.render(); } };
window.delUnit = function(u) { if (confirm('Xóa đơn vị "' + u + '"?')) { state.data.units = state.data.units.filter(x => x !== u); saveState(); window.render(); } };

export function addCategory() { var i = document.getElementById('newCat'); if (i && i.value.trim()) { state.data.categories.push(i.value.trim()); addLog('Thêm danh mục', i.value.trim()); saveState(); i.value = ''; window.render(); } }
export function addUnit() { var i = document.getElementById('newUnit'); if (i && i.value.trim()) { state.data.units.push(i.value.trim()); addLog('Thêm đơn vị', i.value.trim()); saveState(); i.value = ''; window.render(); } }
export function toggleTheme() { applyTheme(state.theme === 'dark' ? 'light' : 'dark'); window.render(); }

export function addUser() {
    if (!isAdmin()) return;
    var n = prompt('Tên:'); if (!n) return;
    var u = prompt('Username:'); if (!u) return;
    var p = prompt('Password:'); if (!p) return;
    var r = confirm('Admin?') ? 'admin' : 'user';
    var perm = r === 'admin' ? { canCreateMaterial: true, canDeleteMaterial: true, canEditMaterial: true, canImport: true, canExport: true, canDeleteProject: true, canAccessSettings: true, canManageSupplier: true } : { canImport: true, canExport: true };
    state.data.users.push({ id: 'u' + Date.now(), name: n, username: u, password: p, role: r, permissions: perm });
    addLog('Thêm user', n); saveState(); window.render(); alert('✅ OK');
}

export function deleteUser(uid) {
    if (!isAdmin()) return;
    var u = state.data.users.find(x => x.id === uid);
    if (!u || u.id === state.currentUser.id) return;
    if (confirm('Xóa ' + u.name + '?')) { state.data.users = state.data.users.filter(x => x.id !== uid); addLog('Xóa user', u.name); saveState(); window.render(); }
}

export function changePassword(uid) {
    if (!isAdmin()) return;
    var u = state.data.users.find(x => x.id === uid);
    if (!u) return;
    var p = prompt('Mật khẩu mới:');
    if (p) { u.password = p; addLog('Đổi MK', u.name); saveState(); window.render(); alert('✅ OK'); }
}

export function toggleUserPermission(uid, perm) {}
