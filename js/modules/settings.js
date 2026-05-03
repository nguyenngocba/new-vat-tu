import { state, saveState, addLog, escapeHtml, applyTheme, hasPermission, isAdmin } from './state.js';

function saveUserToDB(user) {
    fetch('/api/users-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: user.id,
            name: user.name,
            username: user.username,
            password: user.password,
            role: user.role,
            permissions: JSON.stringify(user.permissions || {})
        })
    }).catch(function(){});
}

export function renderSettings() {
    if (!hasPermission('canAccessSettings')) return '<div class="card">🔒 Không có quyền.</div>';
    
    let userHtml = state.data.users.map(u => {
        let permHtml = '';
        if (u.role !== 'admin') {
            var perms = ['canImport','canExport','canCreateMaterial','canEditMaterial','canDeleteMaterial','canDeleteProject','canManageSupplier','canAccessSettings'];
            permHtml = perms.map(p => '<div style="margin-bottom:3px"><input type="checkbox" ' + (u.permissions?.[p] ? 'checked' : '') + ' onchange="toggleUserPermission(\'' + u.id + '\',\'' + p + '\')"> ' + p + '</div>').join('');
        } else {
            permHtml = '🔓 Toàn quyền';
        }
        return '<tr><td><strong>' + escapeHtml(u.name) + '</strong>' + (u.id === state.currentUser.id ? ' <span class="tag">Bạn</span>' : '') + '</td><td>' + u.username + '</td><td><span class="tag">' + (u.role === 'admin' ? 'Admin' : 'Nhân viên') + '</span></td><td style="font-size:11px">' + permHtml + '</td><td><button class="sm" onclick="changePassword(\'' + u.id + '\')">🔑 Đổi MK</button> ' + (u.id !== state.currentUser.id ? '<button class="sm danger-btn" onclick="deleteUser(\'' + u.id + '\')">🗑️</button>' : '') + '</td></tr>';
    }).join('');
    
    var catHtml = state.data.categories.map(c => '<div class="setting-item"><span>📌 ' + escapeHtml(c) + '</span><button class="sm danger-btn" onclick="window.delCat(\'' + c + '\')">Xóa</button></div>').join('');
    var unitHtml = state.data.units.map(u => '<div class="setting-item"><span>📏 ' + escapeHtml(u) + '</span><button class="sm danger-btn" onclick="window.delUnit(\'' + u + '\')">Xóa</button></div>').join('');
    
    return '<div class="card">' +
        '<div class="sec-title">👥 QUẢN LÝ NGƯỜI DÙNG</div>' +
        '<button class="sm primary" style="margin-bottom:16px" onclick="addUser()">+ Thêm người dùng mới</button>' +
        '<div class="tbl-wrap"><table style="min-width:800px"><thead><tr><th>Tên</th><th>Tên đăng nhập</th><th>Vai trò</th><th>Quyền hạn</th><th>Thao tác</th></tr></thead><tbody>' + userHtml + '</tbody></table></div>' +
        '<div style="margin-top:24px"><div class="sec-title">📂 DANH MỤC VẬT TƯ</div>' + catHtml +
        '<div style="display:flex;gap:8px;margin-top:12px"><input id="newCat" style="flex:1"><button class="sm primary" onclick="addCategory()">+ Thêm</button></div></div>' +
        '<div style="margin-top:24px"><div class="sec-title">📏 ĐƠN VỊ TÍNH</div>' + unitHtml +
        '<div style="display:flex;gap:8px;margin-top:12px"><input id="newUnit" style="flex:1"><button class="sm primary" onclick="addUnit()">+ Thêm</button></div></div>' +
        '<div style="margin-top:24px"><button class="sm" onclick="toggleTheme()">' + (state.theme === 'dark' ? '☀️ Chế độ sáng' : '🌙 Chế độ tối') + '</button></div>' +
    '</div>';
}

window.delCat = function(c) { if (confirm('Xóa danh mục "' + c + '"?')) { state.data.categories = state.data.categories.filter(function(x) { return x !== c; }); addLog('Xóa danh mục', c); saveState(); window.render(); } };
window.delUnit = function(u) { if (confirm('Xóa đơn vị "' + u + '"?')) { state.data.units = state.data.units.filter(function(x) { return x !== u; }); addLog('Xóa đơn vị', u); saveState(); window.render(); } };

export function addCategory() { var i = document.getElementById('newCat'); if (i && i.value.trim()) { state.data.categories.push(i.value.trim()); addLog('Thêm danh mục', i.value.trim()); saveState(); i.value = ''; window.render(); } }
export function addUnit() { var i = document.getElementById('newUnit'); if (i && i.value.trim()) { state.data.units.push(i.value.trim()); addLog('Thêm đơn vị', i.value.trim()); saveState(); i.value = ''; window.render(); } }
export function toggleTheme() { applyTheme(state.theme === 'dark' ? 'light' : 'dark'); saveState(); window.render(); }

export function addUser() {
    if (!isAdmin()) return;
    var n = prompt('Nhập tên người dùng:'); if (!n) return;
    var u = prompt('Nhập tên đăng nhập:'); if (!u) return;
    var p = prompt('Nhập mật khẩu:'); if (!p) return;
    var r = confirm('Phân quyền Admin?\n(OK = Admin, Cancel = Nhân viên)') ? 'admin' : 'user';
    var perm = {};
    if (r !== 'admin') {
        perm.canImport = confirm('Cho phép NHẬP KHO?');
        perm.canExport = confirm('Cho phép XUẤT KHO?');
        perm.canCreateMaterial = confirm('Cho phép THÊM vật tư?');
        perm.canEditMaterial = confirm('Cho phép SỬA vật tư?');
        perm.canDeleteMaterial = confirm('Cho phép XÓA vật tư?');
        perm.canDeleteProject = confirm('Cho phép XÓA công trình?');
        perm.canManageSupplier = confirm('Cho phép QUẢN LÝ nhà cung cấp?');
        perm.canAccessSettings = confirm('Cho phép TRUY CẬP cài đặt?');
    } else {
        perm = { canCreateMaterial: true, canDeleteMaterial: true, canEditMaterial: true, canImport: true, canExport: true, canDeleteProject: true, canAccessSettings: true, canManageSupplier: true };
    }
    var newUser = { id: 'u' + Date.now(), name: n, username: u, password: p, role: r, permissions: perm };
    state.data.users.push(newUser);
    saveUserToDB(newUser);
    addLog('Thêm người dùng', n + ' (' + u + ')');
    saveState();
    window.render();
    alert('✅ Đã thêm: ' + n);
}

export function deleteUser(uid) {
    if (!isAdmin()) return;
    var u = state.data.users.find(function(x) { return x.id === uid; });
    if (!u || u.id === state.currentUser.id) return;
    if (confirm('Xóa người dùng "' + u.name + '"?')) {
        state.data.users = state.data.users.filter(function(x) { return x.id !== uid; });
        fetch('/api/users-table/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({id: uid}) });
        addLog('Xóa người dùng', u.name);
        saveState();
        window.render();
    }
}

export function changePassword(uid) {
    if (!isAdmin()) return;
    var u = state.data.users.find(function(x) { return x.id === uid; });
    if (!u) return;
    var p = prompt('Nhập mật khẩu mới cho ' + u.name + ':');
    if (p && p.trim()) {
        u.password = p.trim();
        saveUserToDB(u);
        addLog('Đổi mật khẩu', u.name);
        saveState();
        window.render();
        alert('✅ Đã đổi mật khẩu!');
    }
}

export function toggleUserPermission(uid, perm) {
    if (!isAdmin()) return;
    var u = state.data.users.find(function(x) { return x.id === uid; });
    if (!u || u.role === 'admin') return;
    if (!u.permissions) u.permissions = {};
    u.permissions[perm] = !u.permissions[perm];
    saveUserToDB(u);
    addLog('Phân quyền', u.name + ' - ' + perm + ': ' + (u.permissions[perm] ? 'BẬT' : 'TẮT'));
    saveState();
    window.render();
}
