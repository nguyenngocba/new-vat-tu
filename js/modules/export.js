import { state, addLog, formatMoney } from './state.js';

export function exportToExcel(type) {
    try {
        // Kiểm tra thư viện XLSX đã được tải chưa
        if (typeof XLSX === 'undefined') {
            console.error('Thư viện XLSX chưa được tải!');
            alert('Đang tải thư viện Excel, vui lòng thử lại sau 2 giây.');
            // Thử tải lại thư viện
            const script = document.createElement('script');
            script.src = 'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js';
            document.head.appendChild(script);
            script.onload = () => {
                alert('Đã tải xong thư viện, hãy thử lại!');
                exportToExcel(type);
            };
            return;
        }

        let data = [];
        let filename = '';
        let sheetName = '';

        if (type === 'materials') {
            data = state.data.materials.map(m => ({
                'Mã': m.id,
                'Tên vật tư': m.name,
                'Loại': m.cat,
                'Đơn vị': m.unit,
                'Tồn kho': m.qty,
                'Đơn giá (VNĐ)': m.cost,
                'Giá trị tồn (VNĐ)': m.qty * m.cost,
                'Trạng thái': m.qty <= m.low ? 'Sắp hết' : 'Bình thường',
                'Ngưỡng cảnh báo': m.low,
                'Ghi chú': m.note || ''
            }));
            filename = `danh_sach_vat_tu_${new Date().toISOString().split('T')[0]}.xlsx`;
            sheetName = 'Danh sách vật tư';
            addLog('Export Excel', `Xuất danh sách vật tư ra Excel - ${data.length} mặt hàng`);
        } 
        else if (type === 'projects') {
            data = state.data.projects.map(p => {
                const txns = state.data.transactions.filter(t => t.projectId === p.id && t.type === 'usage');
                const totalCost = txns.reduce((s, t) => s + (t.totalAmount || 0), 0);
                const materialList = txns.map(t => {
                    const mat = state.data.materials.find(m => m.id === t.mid);
                    return `${mat?.name || 'N/A'}: ${t.qty}`;
                }).join('; ');
                return {
                    'Mã': p.id,
                    'Tên công trình': p.name,
                    'Ngân sách (VNĐ)': p.budget,
                    'Đã chi (VNĐ)': totalCost,
                    'Còn lại (VNĐ)': p.budget - totalCost,
                    '% sử dụng': p.budget > 0 ? ((totalCost / p.budget) * 100).toFixed(1) : 0,
                    'Số lần xuất': txns.length,
                    'Vật tư đã dùng': materialList || 'Chưa có'
                };
            });
            filename = `danh_sach_cong_trinh_${new Date().toISOString().split('T')[0]}.xlsx`;
            sheetName = 'Danh sách công trình';
            addLog('Export Excel', `Xuất danh sách công trình ra Excel - ${data.length} công trình`);
        } 
        else if (type === 'suppliers') {
            data = state.data.suppliers.map(s => {
                const purchases = state.data.transactions.filter(t => t.type === 'purchase' && t.supplierId === s.id);
                const totalSpent = purchases.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
                const purchaseList = purchases.map(t => {
                    const mat = state.data.materials.find(m => m.id === t.mid);
                    return `${t.date}: ${mat?.name || 'N/A'} - ${t.qty} - ${formatMoney(t.totalAmount)}`;
                }).join('; ');
                return {
                    'Mã': s.id,
                    'Tên nhà cung cấp': s.name,
                    'SĐT': s.phone || '',
                    'Email': s.email || '',
                    'Địa chỉ': s.address || '',
                    'Tổng chi (VNĐ)': totalSpent,
                    'Số lần nhập': purchases.length,
                    'Chi tiết nhập hàng': purchaseList || 'Chưa có'
                };
            });
            filename = `danh_sach_nha_cung_cap_${new Date().toISOString().split('T')[0]}.xlsx`;
            sheetName = 'Danh sách nhà cung cấp';
            addLog('Export Excel', `Xuất danh sách nhà cung cấp ra Excel - ${data.length} nhà cung cấp`);
        }

        if (data.length === 0) {
            alert('Không có dữ liệu để xuất!');
            return;
        }

        // Tạo workbook và worksheet
        const ws = XLSX.utils.json_to_sheet(data);
        
        // Tùy chỉnh độ rộng cột
        const colWidths = [];
        for (let key in data[0]) {
            let maxLen = key.length;
            data.forEach(row => {
                const val = row[key]?.toString() || '';
                maxLen = Math.max(maxLen, val.length);
            });
            colWidths.push({ wch: Math.min(maxLen + 2, 50) });
        }
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        
        // Xuất file
        XLSX.writeFile(wb, filename);
        alert(`✅ Xuất file thành công!\n📁 Tên file: ${filename}\n📊 Số dòng: ${data.length}`);
        
    } catch (error) {
        console.error('Lỗi xuất Excel:', error);
        alert('❌ Có lỗi xảy ra khi xuất Excel: ' + error.message);
    }
}