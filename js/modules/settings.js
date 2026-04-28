import { state, saveState, addLog, escapeHtml, applyTheme, hasPermission, isAdmin } from './state.js';
import { showModal, closeModal } from './auth.js';

const UI_CONFIG_KEY = 'steeltrack_ui_config_simple';
let uiConfig = { appName: 'STEEL/TRACK', logoType: 'text', logoEmoji: '🏭', logoImage: null };

function ensureDefaultData() {
    if (!state.data.categories || state.data.categories.length === 0) {
        state.data.categories = ['Dầm thép', 'Tấm thép', 'Thép hộp', 'Thép góc', 'Vật tư tiêu hao', 'Bu lông - Ốc vít', 'Ống thép', 'Thép hình'];
        saveState();
    }
    if (!state.data.units || state.data.units.length === 0) {
        state.data.units = ['tấn', 'kg', 'cái', 'mét', 'thùng', 'tấm', 'cuộn'];
        saveState();
    }
}

function loadUIConfig() {
    try { const saved = localStorage.getItem(UI_CONFIG_KEY); if (saved) uiConfig = { ...uiConfig, ...JSON.parse(saved) }; } catch(e) {}
    applyUIConfig();
}

function saveUIConfig() { try { localStorage.setItem(UI_CONFIG_KEY, JSON.stringify(uiConfig)); } catch(e) {} }

function applyUIConfig() {
    const sidebarLogo = document.querySelector('.sidebar-logo');
    if (!sidebarLogo) return;
    if (uiConfig.logoType === 'emoji') sidebarLogo.innerHTML = `${uiConfig.logoEmoji} ${uiConfig.appName}`;
    else if (uiConfig.logoType === 'image' && uiConfig.logoImage) sidebarLogo.innerHTML = `<img src="${uiConfig.logoImage}" style="height: 28px; width: auto; display: inline-block; vertical-align: middle; margin-right: 8px;"> ${uiConfig.appName}`;
    else sidebarLogo.innerHTML = `🏭 ${uiConfig.appName}`;
}

function updateSidebarLogo() { applyUIConfig(); }

function showEmojiPicker(callback) {
    const emojis = ['🏭', '🏗️', '🏢', '🏬', '🔧', '⚙️', '📦', '🚚', '🏛️', '🏦', '⭐', '🎯', '💪', '🔥', '🌟'];
    showModal(`<div class="modal-hd"><span class="modal-title">😊 Chọn Emoji Logo</span><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-bd"><div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; text-align: center;">${emojis.map(emoji => `<div onclick="window.selectEmojiCallback && window.selectEmojiCallback('${emoji}')" style="font-size: 32px; cursor: pointer; padding: 10px; border-radius: 8px; background: var(--surface2);">${emoji}</div>`).join('')}</div>
        <div style="margin-top: 15px;"><input type="text" id="custom-emoji" placeholder="Hoặc nhập emoji tùy chỉnh" style="width: 100%;"><button class="sm primary" id="apply-custom-emoji" style="margin-top: 10px; width: 100%;">Áp dụng</button></div></div>
        <div class="modal-ft"><button onclick="closeModal()">Đóng</button></div>`, null);
    setTimeout(() => {
        const applyBtn = document.getElementById('apply-custom-emoji');
        if (applyBtn) applyBtn.onclick = () => { const customEmoji = document.getElementById('custom-emoji')?.value.trim(); if (customEmoji && callback) callback(customEmoji); closeModal(); };
    }, 100);
    window.selectEmojiCallback = (emoji) => { if (callback) callback(emoji); closeModal(); delete window.selectEmojiCallback; };
}

function uploadLogoImage(callback) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => { const file = e.target.files[0]; if (file && callback) { const reader = new FileReader(); reader.onload = (ev) => callback(ev.target.result); reader.readAsDataURL(file); } };
    input.click();
}

export function renderSettings() {
    ensureDefaultData();
    if (!hasPermission('canAccessSettings')) return '<div class="card">🔒 Bạn không có quyền truy cập khu vực này.</div>';
    
    const customSection = `<div class="sec-title">🎨 TÙY CHỈNH GIAO DIỆN</div><div style="margin-bottom: 20px;"><div class="setting-item" style="border-bottom: none; flex-direction: column; align-items: flex-start; gap: 10px;">
        <div style="width: 100%;"><div style="font-weight: 600; margin-bottom: 5px;">🏷️ Tên ứng dụng</div><div style="display: flex; gap: 8px;"><input type="text" id="app-name-input" value="${escapeHtml(uiConfig.appName)}" style="flex: 1;"><button class="sm" id="save-app-name">Lưu</button></div></div>
        <div style="width: 100%;"><div style="font-weight: 600; margin-bottom: 5px;">🎨 Logo</div><div style="display: flex; flex-wrap: wrap; gap: 8px;"><button class="sm" id="select-emoji">😊 Emoji</button><button class="sm" id="upload-image">📷 Ảnh</button><button class="sm danger-btn" id="reset-logo">🗑️ Mặc định</button></div>
        <div id="logo-preview" style="margin-top: 8px; padding: 6px 10px; background: var(--surface2); border-radius: 6px; font-size: 13px;">${uiConfig.logoType === 'emoji' ? `📌 Logo: ${uiConfig.logoEmoji}` : uiConfig.logoType === 'image' ? '📌 Logo: Ảnh đã tải lên' : '📌 Logo: Mặc định (🏭)'}</div></div>
    </div></div>`;
    
    const backupSection = `<div class="sec-title">💾 SAO LƯU & KHÔI PHỤC</div><div style="margin-bottom: 20px;"><div class="setting-item" style="border-bottom: none; gap: 10px; flex-wrap: wrap;"><button class="sm primary" id="export-backup-btn" style="background: var(--success);">📤 Xuất backup (JSON)</button><button class="sm" id="import-backup-btn">📥 Nhập backup (JSON)</button></div><div class="metric-sub" style="margin-top: 8px;">💡 Sao lưu dữ liệu định kỳ để tránh mất mát.</div></div>`;
    
    const userSection = `<div class="sec-title">👥 QUẢN LÝ NGƯỜI DÙNG</div><button class="sm primary" style="margin-bottom:16px" onclick="addUser()">+ Thêm người dùng mới</button>
        <div class="tbl-wrap"><table style="min-width:800px"><thead><tr><th>Tên</th><th>Tên đăng nhập</th><th>Vai trò</th><th>Quyền</th><th>Thao tác</th></tr></thead>
        <tbody>${state.data.users.map(u => `<tr><td><strong>${escapeHtml(u.name)}</strong>${u.id === state.currentUser.id ? ' <span class="tag">Bạn</span>' : ''}</td><td>${u.username}</td><td><span class="tag">${u.role === 'admin' ? 'Admin' : 'Nhân viên'}</span></td>
        <td style="font-size:11px">${u.role !== 'admin' ? `<div><input type="checkbox" ${u.permissions.canImport ? 'checked' : ''} onchange="toggleUserPermission('${u.id}', 'canImport')"> 📥 Nhập kho</div>
            <div><input type="checkbox" ${u.permissions.canExport ? 'checked' : ''} onchange="toggleUserPermission('${u.id}', 'canExport')"> 📤 Xuất kho</div>
            <div><input type="checkbox" ${u.permissions.canCreateMaterial ? 'checked' : ''} onchange="toggleUserPermission('${u.id}', 'canCreateMaterial')"> ➕ Thêm vật tư</div>
            <div><input type="checkbox" ${u.permissions.canEditMaterial ? 'checked' : ''} onchange="toggleUserPermission('${u.id}', 'canEditMaterial')"> ✏️ Sửa vật tư</div>
            <div><input type="checkbox" ${u.permissions.canDeleteMaterial ? 'checked' : ''} onchange="toggleUserPermission('${u.id}', 'canDeleteMaterial')"> 🗑️ Xóa vật tư</div>
            <div><input type="checkbox" ${u.permissions.canDeleteProject ? 'checked' : ''} onchange="toggleUserPermission('${u.id}', 'canDeleteProject')"> 🏗️ Xóa công trình</div>
            <div><input type="checkbox" ${u.permissions.canManageSupplier ? 'checked' : ''} onchange="toggleUserPermission('${u.id}', 'canManageSupplier')"> 🏭 QL Nhà cung cấp</div>` : '🔓 Toàn quyền'}</td>
        <td><button class="sm" onclick="changePassword('${u.id}')">🔑 Đổi MK</button> ${u.id !== state.currentUser.id ? `<button class="sm danger-btn" onclick="deleteUser('${u.id}')">🗑️</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
    
    const categorySection = `<div style="margin-top:24px"><div class="sec-title">📂 QUẢN LÝ DANH MỤC</div>
        <div style="margin-bottom:16px"><div class="sec-title">Loại vật tư</div>${state.data.categories.map(c => `<div class="setting-item"><span>📌 ${escapeHtml(c)}</span><button class="sm danger-btn" onclick="deleteCategory('${c}')">Xóa</button></div>`).join('')}
        <div style="margin-top:12px;display:flex;gap:8px"><input id="newCat" placeholder="Nhập loại mới" style="flex:1"><button class="sm primary" onclick="addCategory()">+ Thêm</button></div></div>
        <div style="margin-bottom:16px"><div class="sec-title">Đơn vị tính</div>${state.data.units.map(u => `<div class="setting-item"><span>📏 ${escapeHtml(u)}</span><button class="sm danger-btn" onclick="deleteUnit('${u}')">Xóa</button></div>`).join('')}
        <div style="margin-top:12px;display:flex;gap:8px"><input id="newUnit" placeholder="Nhập đơn vị mới" style="flex:1"><button class="sm primary" onclick="addUnit()">+ Thêm</button></div></div></div>`;
    
    const themeSection = `<div style="margin-top:24px"><div class="sec-title">🌓 GIAO DIỆN</div><div class="setting-item"><span>Chế độ màu</span><button class="sm" onclick="toggleTheme()">${state.theme === 'dark' ? '☀️ Chuyển sáng' : '🌙 Chuyển tối'}</button></div></div>`;
    
    return `<div class="card">${customSection}${backupSection}${userSection}${categorySection}${themeSection}</div>`;
}

export function bindUISettingsEvents() {
    const saveAppName = document.getElementById('save-app-name');
    const appNameInput = document.getElementById('app-name-input');
    if (saveAppName && appNameInput) saveAppName.onclick = () => { const newName = appNameInput.value.trim(); if (newName) { uiConfig.appName = newName; saveUIConfig(); updateSidebarLogo(); addLog('Cài đặt', `Đã đổi tên ứng dụng thành: ${newName}`); alert('Đã cập nhật tên ứng dụng!'); } };
    
    const selectEmoji = document.getElementById('select-emoji');
    if (selectEmoji) selectEmoji.onclick = () => { showEmojiPicker((emoji) => { uiConfig.logoType = 'emoji'; uiConfig.logoEmoji = emoji; uiConfig.logoImage = null; saveUIConfig(); updateSidebarLogo(); const preview = document.getElementById('logo-preview'); if (preview) preview.innerHTML = `📌 Logo: ${emoji}`; addLog('Cài đặt', `Đã chọn emoji logo: ${emoji}`); }); };
    
    const uploadImage = document.getElementById('upload-image');
    if (uploadImage) uploadImage.onclick = () => { uploadLogoImage((imageData) => { uiConfig.logoType = 'image'; uiConfig.logoImage = imageData; uiConfig.logoEmoji = '🏭'; saveUIConfig(); updateSidebarLogo(); const preview = document.getElementById('logo-preview'); if (preview) preview.innerHTML = '📌 Logo: Ảnh đã tải lên'; addLog('Cài đặt', 'Đã cập nhật logo ảnh'); alert('Đã cập nhật logo!'); }); };
    
    const resetLogo = document.getElementById('reset-logo');
    if (resetLogo) resetLogo.onclick = () => { uiConfig.logoType = 'text'; uiConfig.logoEmoji = '🏭'; uiConfig.logoImage = null; saveUIConfig(); updateSidebarLogo(); const preview = document.getElementById('logo-preview'); if (preview) preview.innerHTML = '📌 Logo: Mặc định (🏭)'; addLog('Cài đặt', 'Đã đặt lại logo mặc định'); };
    
    const exportBtn = document.getElementById('export-backup-btn');
    if (exportBtn) exportBtn.onclick = async () => { const { exportBackup } = await import('./backup.js'); exportBackup(); };
    
    const importBtn = document.getElementById('import-backup-btn');
    if (importBtn) importBtn.onclick = async () => { const { showImportBackupModal } = await import('./backup.js'); showImportBackupModal(); };
}

export function addCategory() { const inp = document.getElementById('newCat'); if(inp.value.trim()){ state.data.categories.push(inp.value.trim()); addLog('Thêm danh mục', `Đã thêm danh mục: ${inp.value.trim()}`); saveState(); if(window.render) window.render(); } }
export function addUnit() { const inp = document.getElementById('newUnit'); if(inp.value.trim()){ state.data.units.push(inp.value.trim()); addLog('Thêm đơn vị', `Đã thêm đơn vị: ${inp.value.trim()}`); saveState(); if(window.render) window.render(); } }
export function toggleTheme() { applyTheme(state.theme === 'dark' ? 'light' : 'dark'); if(window.render) window.render(); }

export function addUser() {
    if (!isAdmin()) return;
    const name = prompt('Nhập tên người dùng:'); if (!name) return;
    const username = prompt('Nhập tên đăng nhập:'); if (!username) return;
    const password = prompt('Nhập mật khẩu:'); if (!password) return;
    const role = confirm('Phân quyền Admin? (OK = Admin, Cancel = Nhân viên)') ? 'admin' : 'user';
    const newUser = { id: `u${Date.now()}`, name, username, password, role, permissions: role === 'admin' ? { canCreateMaterial: true, canDeleteMaterial: true, canEditMaterial: true, canImport: true, canExport: true, canDeleteProject: true, canAccessSettings: true, canManageSupplier: true } : { canCreateMaterial: false, canDeleteMaterial: false, canEditMaterial: false, canImport: true, canExport: true, canDeleteProject: false, canAccessSettings: false, canManageSupplier: false } };
    state.data.users.push(newUser);
    addLog('Thêm người dùng', `Đã thêm người dùng: ${name} (${username}) - Vai trò: ${role === 'admin' ? 'Admin' : 'Nhân viên'}`);
    saveState(); if(window.render) window.render();
}

export function deleteUser(userId) {
    if (!isAdmin()) return;
    const user = state.data.users.find(u => u.id === userId);
    if (!user) return;
    if (user.id === state.currentUser.id) { alert('Bạn không thể tự xóa chính mình!'); return; }
    if (confirm(`Xóa người dùng "${user.name}"?`)) { state.data.users = state.data.users.filter(u => u.id !== userId); addLog('Xóa người dùng', `Đã xóa người dùng: ${user.name} (${user.username})`); saveState(); if(window.render) window.render(); }
}

export function changePassword(userId) {
    if (!isAdmin()) return;
    const user = state.data.users.find(u => u.id === userId);
    if (!user) return;
    const newPass = prompt(`Nhập mật khẩu mới cho ${user.name}:`);
    if (newPass && newPass.trim()) { user.password = newPass.trim(); addLog('Đổi mật khẩu', `Đã đổi mật khẩu cho người dùng: ${user.name}`); saveState(); alert('Đổi mật khẩu thành công!'); if(window.render) window.render(); }
}

export function toggleUserPermission(userId, perm) {
    if (!isAdmin()) return;
    const user = state.data.users.find(u => u.id === userId);
    if (!user || user.role === 'admin') { alert('Không thể thay đổi quyền của Admin'); return; }
    user.permissions[perm] = !user.permissions[perm];
    addLog('Thay đổi quyền', `Đã thay đổi quyền ${perm} cho ${user.name} -> ${user.permissions[perm] ? 'BẬT' : 'TẮT'}`);
    saveState(); if(window.render) window.render();
}

export function deleteCategory(cat) { if(!isAdmin()) return; if(confirm(`Xóa danh mục "${cat}"?`)){ state.data.categories = state.data.categories.filter(c => c !== cat); addLog('Xóa danh mục', `Đã xóa danh mục: ${cat}`); saveState(); if(window.render) window.render(); } }
export function deleteUnit(unit) { if(!isAdmin()) return; if(confirm(`Xóa đơn vị "${unit}"?`)){ state.data.units = state.data.units.filter(u => u !== unit); addLog('Xóa đơn vị', `Đã xóa đơn vị: ${unit}`); saveState(); if(window.render) window.render(); } }

loadUIConfig();