export function initShortcuts() {
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'f')) {
            e.preventDefault();
            focusSearchInput();
        }
        if (e.altKey && e.key === 'm') { e.preventDefault(); if(window.switchPane) window.switchPane('entry'); }
        if (e.altKey && e.key === 'd') { e.preventDefault(); if(window.switchPane) window.switchPane('dashboard'); }
        if (e.altKey && e.key === 'p') { e.preventDefault(); if(window.switchPane) window.switchPane('projects'); }
        if (e.altKey && e.key === 's') { e.preventDefault(); if(window.switchPane) window.switchPane('suppliers'); }
        if (e.altKey && e.key === 'l') { e.preventDefault(); if(window.switchPane) window.switchPane('logs'); }
        if (e.altKey && e.key === 'c') { e.preventDefault(); if(window.switchPane) window.switchPane('settings'); }
        if (e.key === '?') { e.preventDefault(); showShortcutsHelp(); }
        if (e.key === 'Escape') {
            const modal = document.querySelector('.modal-overlay');
            if (modal) { const btn = modal.querySelector('.xbtn'); if(btn) btn.click(); }
        }
    });
}

function focusSearchInput() {
    const inputs = ['mat-search-keyword', 'proj-search-keyword', 'sup-search-keyword'];
    for (const id of inputs) {
        const input = document.getElementById(id);
        if (input && input.offsetParent !== null) { input.focus(); input.select(); break; }
    }
}

function showShortcutsHelp() {
    const content = `<div class="modal-hd"><span class="modal-title">⌨️ PHÍM TẮT</span><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-bd"><table style="width:100%"><thead><tr><th>Phím</th><th>Chức năng</th></tr></thead>
        <tbody>
            <tr><td><kbd>Ctrl+K</kbd></td><td>🔍 Tìm kiếm</td></tr>
            <tr><td><kbd>Alt+M</kbd></td><td>📦 Quản lý kho</td></tr>
            <tr><td><kbd>Alt+D</kbd></td><td>📊 Dashboard</td></tr>
            <tr><td><kbd>Alt+P</kbd></td><td>🏗️ Công trình</td></tr>
            <tr><td><kbd>Alt+S</kbd></td><td>🏭 Nhà cung cấp</td></tr>
            <tr><td><kbd>Alt+L</kbd></td><td>📋 Nhật ký</td></tr>
            <tr><td><kbd>Alt+C</kbd></td><td>⚙️ Cài đặt</td></tr>
            <tr><td><kbd>?</kbd></td><td>❓ Trợ giúp</td></tr>
            <tr><td><kbd>ESC</kbd></td><td>❌ Đóng modal</td></tr>
        </tbody></table></div>
        <div class="modal-ft"><button onclick="closeModal()">Đóng</button></div>`;
    if(window.showModal) window.showModal(content, null);
}