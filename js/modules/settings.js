import { state, saveState, addLog, escapeHtml, applyTheme, hasPermission, isAdmin } from './state.js';

// Profiles mặc định
export let profiles = [
    { id: 'profile_admin', name: '👑 Admin Toàn Quyền', perms: { canCreateMaterial: true, canDeleteMaterial: true, canEditMaterial: true, canImport: true, canExport: true, canDeleteProject: true, canAccessSettings: true, canManageSupplier: true } },
    { id: 'profile_kho', name: '📦 Thủ Kho', perms: { canImport: true, canExport: true, canCreateMaterial: true, canEditMaterial: true } },
    { id: 'profile_nv', name: '👷 Nhân Viên Kho', perms: { canImport: true, canExport: true } },
    { id: 'profile_xem', name: '👁️ Chỉ Xem', perms: {} }
];

export function renderSettings() {
  console.log("renderSettings called, users:", state.data.users.length);
    if (!hasPermission('canAccessSettings')) return '<div class="card">🔒 Không có quyền.</div>';
    
    // User list
    let userHtml = '';
    for (let i = 0; i < state.data.users.length; i++) {
        let u = state.data.users[i];
        let avatar = u.name.charAt(0).toUpperCase();
        let permHtml = u.role === 'admin' ? '🔓 Toàn quyền' : (u.permissions?.canImport ? '📥 ' : '') + (u.permissions?.canExport ? '📤 ' : '') + (u.permissions?.canCreateMaterial ? '➕ ' : '');
        userHtml += '<div style="display:flex;align-items:center;gap:12px;padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;">' +
            '<div style="width:40px;height:40px;border-radius:50%;background:var(--accent-bg);display:flex;align-items:center;justify-content:center;font-weight:bold;color:var(--accent);">' + avatar + '</div>' +
            '<div style="flex:1;"><strong>' + escapeHtml(u.name) + '</strong> <span style="font-size:11px;color:var(--muted);">@' + u.username + '</span><br><span style="font-size:11px;">' + permHtml + '</span></div>' +
            '<select onchange="window.applyProfile(\'' + u.id + '\', this.value)" style="width:auto;font-size:11px;"><option value="">📋 Gán Profile...</option>' +
            profiles.map(function(p) { return '<option value="' + p.id + '">' + p.name + '</option>'; }).join('') +
            '</select>' +
            '<button class="sm" onclick="window.changePassword(\'' + u.id + '\')">🔑 MK</button>' +
            (u.id !== state.currentUser.id ? '<button class="sm danger-btn" onclick="window.deleteUser(\'' + u.id + '\')">🗑️</button>' : '') +
            '</div>';
    }
    
    // Profile list
    let profileHtml = '';
    for (let i = 0; i < profiles.length; i++) {
        let p = profiles[i];
        let permNames = [];
        if (p.perms.canImport) permNames.push('📥 Nhập');
        if (p.perms.canExport) permNames.push('📤 Xuất');
        if (p.perms.canCreateMaterial) permNames.push('➕ Thêm VT');
        if (p.perms.canEditMaterial) permNames.push('✏️ Sửa VT');
        if (p.perms.canDeleteMaterial) permNames.push('🗑️ Xóa VT');
        if (p.perms.canManageSupplier) permNames.push('🏭 NCC');
        if (p.perms.canDeleteProject) permNames.push('🏗️ Xóa CT');
        if (p.perms.canAccessSettings) permNames.push('⚙️ Cài đặt');
        profileHtml += '<div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;">' +
            '<strong>' + p.name + '</strong>' +
            '<span style="font-size:11px;color:var(--muted);">' + (permNames.length > 0 ? permNames.join(' | ') : '🔒 Không quyền') + '</span>' +
            '</div>';
    }
    
    return '<div class="card">' +
        '<div class="sec-title">👥 NGƯỜI DÙNG</div>' +
        '<button class="sm primary" style="margin-bottom:16px" onclick="window.addUser()">+ Thêm người dùng</button>' +
        userHtml +
        '<div style="margin-top:24px"><div class="sec-title">📋 PROFILES</div>' + profileHtml + '</div>' +
        '<div style="margin-top:24px"><div class="sec-title">📂 DANH MỤC</div>' +
        state.data.categories.map(function(c, i) { return '<div class="setting-item"><span>📌 ' + escapeHtml(c) + '</span><button class="sm danger-btn" onclick="if(confirm(\'Xóa?\')){state.data.categories.splice(' + i + ',1);saveState();window.render();}">Xóa</button></div>'; }).join('') +
        '<div style="display:flex;gap:8px;margin-top:12px"><input id="newCat" style="flex:1"><button class="sm primary" onclick="addCategory()">+ Thêm</button></div></div>' +
        '<div style="margin-top:24px"><div class="sec-title">📏 ĐƠN VỊ</div>' +
        state.data.units.map(function(u, i) { return '<div class="setting-item"><span>📏 ' + escapeHtml(u) + '</span><button class="sm danger-btn" onclick="if(confirm(\'Xóa?\')){state.data.units.splice(' + i + ',1);saveState();window.render();}">Xóa</button></div>'; }).join('') +
        '<div style="display:flex;gap:8px;margin-top:12px"><input id="newUnit" style="flex:1"><button class="sm primary" onclick="addUnit()">+ Thêm</button></div></div>' +
        '<div style="margin-top:24px"><button class="sm" onclick="toggleTheme()">' + (state.theme === 'dark' ? '☀️ Sáng' : '🌙 Tối') + '</button></div>' +
    '</div>';
}

// Áp profile cho user
window.applyProfile = function(uid, profileId) {
    var p = profiles.find(function(x) { return x.id === profileId; });
    if (!p) return;
    var u = state.data.users.find(function(x) { return x.id === uid; });
    if (!u || u.role === 'admin') { alert('Không thể đổi quyền Admin!'); return; }
    u.permissions = JSON.parse(JSON.stringify(p.perms));
    fetch('/api/users-table', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, name: u.name, username: u.username, password: u.password, role: u.role, permissions: u.permissions || {} }) });
    saveState(); window.render();
    alert('✅ Đã áp profile: ' + p.name);
};

export function addCategory() { var i = document.getElementById('newCat'); if (i && i.value.trim()) { state.data.categories.push(i.value.trim()); saveState(); i.value = ''; window.render(); } }
export function addUnit() { var i = document.getElementById('newUnit'); if (i && i.value.trim()) { state.data.units.push(i.value.trim()); saveState(); i.value = ''; window.render(); } }
export function toggleTheme() { applyTheme(state.theme === 'dark' ? 'light' : 'dark'); window.render(); }

export function addUser() {
    if (!isAdmin()) return;
    var n = prompt('Tên:'); if (!n) return;
    var u = prompt('Username:'); if (!u) return;
    var p = prompt('Password:'); if (!p) return;
    var r = confirm('Admin?') ? 'admin' : 'user';
    var perm = r === 'admin' ? { canCreateMaterial: true, canDeleteMaterial: true, canEditMaterial: true, canImport: true, canExport: true, canDeleteProject: true, canAccessSettings: true, canManageSupplier: true } : { canImport: true, canExport: true };
    var userObj = { id: 'u' + Date.now(), name: n, username: u, password: p, role: r, permissions: perm };
    state.data.users.push(userObj);
    fetch('/api/users-table', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(userObj) });
    saveState(); window.render(); alert('✅ OK');
}

export function deleteUser(uid) {
    if (!isAdmin()) return;
    var u = state.data.users.find(function(x) { return x.id === uid; });
    if (!u || u.id === state.currentUser.id) return;
    if (confirm('Xóa ' + u.name + '?')) {
        state.data.users = state.data.users.filter(function(x) { return x.id !== uid; });
        fetch('/api/users-table/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: uid }) });
        saveState(); window.render();
    }
}

export function changePassword(uid) {
    if (!isAdmin()) return;
    var u = state.data.users.find(function(x) { return x.id === uid; });
    if (!u) return;
    var p = prompt('Mật khẩu mới:');
    if (p) {
        u.password = p;
  console.log("Changing password for:", u.username, "new pass:", p);
  fetch("/api/users-table", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: u.id, name: u.name, username: u.username, password: u.password, role: u.role, permissions: u.permissions || {} }) }).then(function(r) { return r.json(); }).then(function(d) { console.log("API changePassword response:", d); });
        fetch('/api/users-table', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, name: u.name, username: u.username, password: u.password, role: u.role, permissions: u.permissions || {} }) });
        saveState(); window.render(); alert('✅ OK');
    }
}

export function toggleUserPermission(uid, perm) {}
