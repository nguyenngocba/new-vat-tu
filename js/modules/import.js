import { state, saveState, addLog, genMid, genPid, genSid } from './state.js';
import { parseNumber, formatMoneyVND } from './utils.js';

export function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        if (typeof XLSX === 'undefined') { reject(new Error('Thư viện XLSX chưa được tải')); return; }
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                resolve(jsonData);
            } catch (error) { reject(error); }
        };
        reader.onerror = () => reject(new Error('Không thể đọc file'));
        reader.readAsArrayBuffer(file);
    });
}

export async function importMaterialsFromExcel(file) {
    try {
        const data = await readExcelFile(file);
        if (data.length === 0) return { success: false, count: 0, errors: [] };
        
        let successCount = 0, errorCount = 0;
        const errors = [];
        
        for (const row of data) {
            try {
                const name = row['Tên vật tư'] || row['Tên'] || row['name'] || row['Name'];
                const cat = row['Loại'] || row['Danh mục'] || row['category'] || row['cat'] || 'Vật tư khác';
                const unit = row['Đơn vị'] || row['unit'] || 'cái';
                const qty = parseNumber(row['Số lượng'] || row['Tồn kho'] || row['qty'] || 0);
                const cost = parseNumber(row['Đơn giá'] || row['Giá'] || row['cost'] || 0);
                const low = parseNumber(row['Ngưỡng cảnh báo'] || row['low'] || 5);
                const note = row['Ghi chú'] || row['note'] || '';
                
                if (!name) { errorCount++; errors.push(`Dòng ${data.indexOf(row) + 2}: Thiếu tên vật tư`); continue; }
                
                const exists = state.data.materials.some(m => m.name.toLowerCase() === name.toLowerCase());
                if (exists) { errorCount++; errors.push(`Dòng ${data.indexOf(row) + 2}: Vật tư "${name}" đã tồn tại`); continue; }
                
                state.data.materials.push({ id: genMid(), name, cat, unit, qty, cost, low, note });
                successCount++;
            } catch (err) { errorCount++; errors.push(`Dòng ${data.indexOf(row) + 2}: ${err.message}`); }
        }
        
        if (successCount > 0) { saveState(); addLog('Import Excel', `Đã import ${successCount} vật tư từ Excel`); }
        return { success: true, count: successCount, errors, total: data.length };
    } catch (error) { return { success: false, count: 0, errors: [error.message] }; }
}

export async function importProjectsFromExcel(file) {
    try {
        const data = await readExcelFile(file);
        if (data.length === 0) return { success: false, count: 0, errors: [] };
        
        let successCount = 0, errorCount = 0;
        const errors = [];
        
        for (const row of data) {
            try {
                const name = row['Tên công trình'] || row['Tên'] || row['name'] || row['Name'];
                const budget = parseNumber(row['Ngân sách'] || row['budget'] || 0);
                
                if (!name) { errorCount++; errors.push(`Dòng ${data.indexOf(row) + 2}: Thiếu tên công trình`); continue; }
                
                const exists = state.data.projects.some(p => p.name.toLowerCase() === name.toLowerCase());
                if (exists) { errorCount++; errors.push(`Dòng ${data.indexOf(row) + 2}: Công trình "${name}" đã tồn tại`); continue; }
                
                state.data.projects.push({ id: genPid(), name, budget, spent: 0 });
                successCount++;
            } catch (err) { errorCount++; errors.push(`Dòng ${data.indexOf(row) + 2}: ${err.message}`); }
        }
        
        if (successCount > 0) { saveState(); addLog('Import Excel', `Đã import ${successCount} công trình từ Excel`); }
        return { success: true, count: successCount, errors, total: data.length };
    } catch (error) { return { success: false, count: 0, errors: [error.message] }; }
}

export async function importSuppliersFromExcel(file) {
    try {
        const data = await readExcelFile(file);
        if (data.length === 0) return { success: false, count: 0, errors: [] };
        
        let successCount = 0, errorCount = 0;
        const errors = [];
        
        for (const row of data) {
            try {
                const name = row['Tên nhà cung cấp'] || row['Tên'] || row['name'] || row['Name'];
                const phone = row['SĐT'] || row['Điện thoại'] || row['phone'] || '';
                const email = row['Email'] || row['email'] || '';
                const address = row['Địa chỉ'] || row['address'] || '';
                
                if (!name) { errorCount++; errors.push(`Dòng ${data.indexOf(row) + 2}: Thiếu tên nhà cung cấp`); continue; }
                
                const exists = state.data.suppliers.some(s => s.name.toLowerCase() === name.toLowerCase());
                if (exists) { errorCount++; errors.push(`Dòng ${data.indexOf(row) + 2}: Nhà cung cấp "${name}" đã tồn tại`); continue; }
                
                state.data.suppliers.push({ id: genSid(), name, phone, email, address });
                successCount++;
            } catch (err) { errorCount++; errors.push(`Dòng ${data.indexOf(row) + 2}: ${err.message}`); }
        }
        
        if (successCount > 0) { saveState(); addLog('Import Excel', `Đã import ${successCount} nhà cung cấp từ Excel`); }
        return { success: true, count: successCount, errors, total: data.length };
    } catch (error) { return { success: false, count: 0, errors: [error.message] }; }
}

export function showImportModal(type, onSuccess) {
    let title = '', acceptFormat = '';
    switch(type) {
        case 'materials': title = '📥 Import danh sách vật tư từ Excel'; acceptFormat = 'Tên vật tư, Loại, Đơn vị, Số lượng, Đơn giá, Ngưỡng cảnh báo, Ghi chú'; break;
        case 'projects': title = '📥 Import danh sách công trình từ Excel'; acceptFormat = 'Tên công trình, Ngân sách'; break;
        case 'suppliers': title = '📥 Import danh sách nhà cung cấp từ Excel'; acceptFormat = 'Tên nhà cung cấp, SĐT, Email, Địa chỉ'; break;
        default: return;
    }
    
    const modalHtml = `<div class="modal-hd"><span class="modal-title">${title}</span><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-bd"><div class="metric-card" style="margin-bottom: 16px; background: var(--accent-bg);">
            <div class="metric-sub">📋 Định dạng file Excel (.xlsx, .xls)</div><div class="metric-sub">Các cột khuyến nghị: ${acceptFormat}</div>
            <div class="metric-sub" style="margin-top: 8px;"><a href="#" id="download-template-${type}" style="color: var(--accent);">📎 Tải file mẫu</a></div></div>
            <div class="form-group"><label class="form-label">Chọn file Excel</label><input type="file" id="import-file-input" accept=".xlsx,.xls"></div>
            <div id="import-progress" style="display: none; margin-top: 12px;"><div class="progress-bar"><div id="import-progress-bar" class="progress-fill" style="width: 0%;"></div></div><div id="import-status" class="metric-sub" style="margin-top: 8px;"></div></div>
        </div>
        <div class="modal-ft"><button onclick="closeModal()">Hủy</button><button class="primary" id="confirm-import">Import dữ liệu</button></div>`;
    
    window.showModal(modalHtml, null);
    
    setTimeout(() => {
        const downloadLink = document.getElementById(`download-template-${type}`);
        if (downloadLink) downloadLink.onclick = (e) => { e.preventDefault(); downloadTemplate(type); };
        
        const confirmBtn = document.getElementById('confirm-import');
        if (confirmBtn) confirmBtn.onclick = async () => {
            const fileInput = document.getElementById('import-file-input');
            const file = fileInput?.files[0];
            if (!file) { alert('Vui lòng chọn file Excel'); return; }
            
            const progressDiv = document.getElementById('import-progress');
            const progressBar = document.getElementById('import-progress-bar');
            const statusDiv = document.getElementById('import-status');
            progressDiv.style.display = 'block'; progressBar.style.width = '50%'; statusDiv.innerText = 'Đang xử lý...';
            
            let result;
            switch(type) {
                case 'materials': result = await importMaterialsFromExcel(file); break;
                case 'projects': result = await importProjectsFromExcel(file); break;
                case 'suppliers': result = await importSuppliersFromExcel(file); break;
            }
            
            progressBar.style.width = '100%';
            if (result.success) {
                statusDiv.innerText = `✅ Import thành công: ${result.count}/${result.total} bản ghi`;
                if (result.errors.length > 0) console.warn('Import errors:', result.errors);
                setTimeout(() => { window.closeModal(); if (onSuccess) onSuccess(); if (window.render) window.render(); alert(`✅ Import hoàn tất!\nThành công: ${result.count}\nThất bại: ${result.errors.length}`); }, 1500);
            } else {
                statusDiv.innerText = `❌ Import thất bại: ${result.errors[0] || 'Lỗi không xác định'}`;
                setTimeout(() => { progressDiv.style.display = 'none'; }, 2000);
            }
        };
    }, 100);
}

function downloadTemplate(type) {
    let data = [], filename = '';
    switch(type) {
        case 'materials':
            data = [{ 'Tên vật tư': 'Thép tấm 10mm', 'Loại': 'Tấm thép', 'Đơn vị': 'tấn', 'Số lượng': 10, 'Đơn giá': 8500000, 'Ngưỡng cảnh báo': 5, 'Ghi chú': 'Thép chất lượng cao' }];
            filename = 'template_import_vat_tu.xlsx'; break;
        case 'projects':
            data = [{ 'Tên công trình': 'Nhà kho A', 'Ngân sách': 50000000 }];
            filename = 'template_import_cong_trinh.xlsx'; break;
        case 'suppliers':
            data = [{ 'Tên nhà cung cấp': 'Công ty Thép ABC', 'SĐT': '0912345678', 'Email': 'contact@thepabc.com', 'Địa chỉ': 'Hà Nội' }];
            filename = 'template_import_nha_cung_cap.xlsx'; break;
    }
    if (typeof XLSX !== 'undefined' && data.length > 0) {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, filename);
    } else alert('Đang tải thư viện Excel, vui lòng thử lại sau.');
}