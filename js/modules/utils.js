import { state, addLog, escapeHtml } from './state.js';

// ========== CÁC HÀM XỬ LÝ SỐ - THEO CHUẨN VIỆT NAM ==========

export function parseNumber(str) {
    if (!str || str === '') return 0;
    let cleaned = str.toString().trim();
    if (cleaned.includes('.') && cleaned.includes(',')) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes(',')) {
        cleaned = cleaned.replace(/,/g, '.');
    }
    let num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

export function getNumberFromInput(inputElement) {
    if (!inputElement) return 0;
    return parseNumber(inputElement.value);
}

export function getIntegerFromInput(inputElement) {
    if (!inputElement) return 0;
    return Math.floor(parseNumber(inputElement.value));
}

export function formatMoneyVND(value) {
    let num = typeof value === 'string' ? parseNumber(value) : value;
    if (isNaN(num)) num = 0;
    return num.toLocaleString('vi-VN') + ' ₫';
}

// ========== HÀM FORMAT SỐ HIỂN THỊ ==========

/**
 * Format số raw thành chuỗi hiển thị có dấu chấm phân cách hàng nghìn
 * Nguyên tắc: Dấu phẩy (,) là dấu thập phân. Dấu chấm (.) là phân cách hàng nghìn.
 * Khi gõ: 9999 -> 9.999 (chưa có thập phân)
 * Khi gõ: 9999,5 -> 9.999,5 (có thập phân)
 */
export function formatRawToDisplay(rawValue) {
    if (!rawValue || rawValue === '') return '';
    
    // Lưu dấu âm
    let isNegative = false;
    if (rawValue.startsWith('-')) {
        isNegative = true;
        rawValue = rawValue.substring(1);
    }
    
    // Xóa tất cả ký tự không hợp lệ, chỉ giữ số và dấu phẩy
    // LƯU Ý: KHÔNG cho phép dấu chấm từ bàn phím, chỉ dùng dấu phẩy cho thập phân
    rawValue = rawValue.replace(/[^\d,]/g, '');
    
    if (rawValue === '') return isNegative ? '-' : '';
    
    // Tách phần nguyên và phần thập phân tại dấu phẩy ĐẦU TIÊN
    let integerPart = '';
    let decimalPart = '';
    
    const firstCommaIdx = rawValue.indexOf(',');
    if (firstCommaIdx >= 0) {
        integerPart = rawValue.substring(0, firstCommaIdx);
        // Phần thập phân: lấy tất cả sau dấu phẩy đầu tiên, bỏ dấu phẩy dư
        decimalPart = rawValue.substring(firstCommaIdx + 1).replace(/,/g, '');
    } else {
        integerPart = rawValue;
        decimalPart = '';
    }
    
    // Xóa số 0 ở đầu phần nguyên (nhưng giữ lại ít nhất 1 chữ số)
    integerPart = integerPart.replace(/^0+/, '') || '0';
    
    // Format phần nguyên: thêm dấu CHẤM mỗi 3 chữ số từ phải sang trái
    let formattedInteger = '';
    let count = 0;
    for (let i = integerPart.length - 1; i >= 0; i--) {
        formattedInteger = integerPart[i] + formattedInteger;
        count++;
        if (count % 3 === 0 && i > 0) {
            formattedInteger = '.' + formattedInteger;
        }
    }
    
    // Ghép kết quả
    let result = formattedInteger;
    if (decimalPart.length > 0) {
        result += ',' + decimalPart;
    }
    
    if (isNegative) {
        result = '-' + result;
    }
    
    return result;
}

// ========== HÀM SETUP INPUT ==========

export function setupNumberInput(inputElement, options = {}) {
    if (!inputElement) return;
    
    const { isInteger = false, decimals = null } = options;
    
    // Xóa bỏ mọi giới hạn
    inputElement.removeAttribute('maxlength');
    inputElement.removeAttribute('size');
    
    function formatWithOptions(rawValue) {
        let formatted = formatRawToDisplay(rawValue);
        
        if (formatted === '' || formatted === '-') return formatted;
        
        // Nếu là số nguyên, cắt bỏ phần thập phân
        if (isInteger) {
            const commaIdx = formatted.indexOf(',');
            if (commaIdx >= 0) {
                formatted = formatted.substring(0, commaIdx);
            }
            return formatted;
        }
        
        // Nếu có giới hạn decimals
        if (decimals !== null) {
            const commaIdx = formatted.indexOf(',');
            if (commaIdx >= 0) {
                const decimalLen = formatted.length - commaIdx - 1;
                if (decimalLen > decimals) {
                    formatted = formatted.substring(0, commaIdx + decimals + 1);
                }
            }
        }
        
        return formatted;
    }
    
    // ===== INPUT EVENT =====
    inputElement.addEventListener('input', function() {
        const oldValue = this.value;
        const oldCursorPos = this.selectionStart;
        
        // Thay dấu chấm thành dấu phẩy (vì người dùng có thể gõ dấu chấm thay vì dấu phẩy)
        // Nhưng chỉ thay dấu chấm ĐẦU TIÊN thành dấu phẩy
        let rawValue = this.value;
        
        // Đếm số dấu chấm và dấu phẩy
        const dotCount = (rawValue.match(/\./g) || []).length;
        const commaCount = (rawValue.match(/,/g) || []).length;
        
        // Nếu chưa có dấu phẩy nào và có dấu chấm -> dấu chấm đầu tiên = dấu thập phân
        if (commaCount === 0 && dotCount > 0) {
            const firstDotIdx = rawValue.indexOf('.');
            rawValue = rawValue.substring(0, firstDotIdx) + ',' + rawValue.substring(firstDotIdx + 1);
        }
        
        // Format
        const newValue = formatWithOptions(rawValue);
        
        // ===== TÍNH VỊ TRÍ CON TRỎ =====
        let newCursorPos = oldCursorPos;
        
        if (oldValue !== newValue) {
            // Đếm dấu chấm trong giá trị cũ và mới trước vị trí con trỏ
            let oldDots = 0, newDots = 0;
            for (let i = 0; i < Math.min(oldCursorPos, oldValue.length); i++) {
                if (oldValue[i] === '.') oldDots++;
            }
            for (let i = 0; i < Math.min(oldCursorPos, newValue.length); i++) {
                if (newValue[i] === '.') newDots++;
            }
            
            newCursorPos = oldCursorPos + (newDots - oldDots);
            newCursorPos = Math.max(0, Math.min(newCursorPos, newValue.length));
            
            // Nhảy qua dấu chấm nếu đang đứng tại đó
            if (newCursorPos < newValue.length && newValue[newCursorPos] === '.') {
                newCursorPos++;
            }
        }
        
        this.value = newValue;
        this.setSelectionRange(newCursorPos, newCursorPos);
        
        // Dispatch change event
        this.dispatchEvent(new Event('change', { bubbles: true }));
    });
    
    // ===== BLUR =====
    inputElement.addEventListener('blur', function() {
        let rawValue = this.value;
        // Chuẩn hóa lần cuối
        if (!rawValue.includes(',') && rawValue.includes('.')) {
            const firstDot = rawValue.indexOf('.');
            rawValue = rawValue.substring(0, firstDot) + ',' + rawValue.substring(firstDot + 1);
        }
        this.value = formatWithOptions(rawValue);
        this.dispatchEvent(new Event('change', { bubbles: true }));
    });
    
    // ===== FOCUS =====
    inputElement.addEventListener('focus', function() {
        this.select();
    });
    
    // ===== PASTE =====
    inputElement.addEventListener('paste', function(e) {
        e.preventDefault();
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        const start = this.selectionStart;
        const end = this.selectionEnd;
        const oldValue = this.value;
        
        const newRawValue = oldValue.substring(0, start) + pastedText + oldValue.substring(end);
        this.value = formatWithOptions(newRawValue);
        
        const newPos = Math.min(this.value.length, start + pastedText.length);
        this.setSelectionRange(newPos, newPos);
        this.dispatchEvent(new Event('change', { bubbles: true }));
    });
    
    // ===== KEYDOWN - Chỉ chặn ký tự không hợp lệ =====
    inputElement.addEventListener('keydown', function(e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        
        // Cho phép phím điều khiển
        const controlKeys = ['Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown',
                            'Home','End','Tab','Enter','Escape'];
        if (controlKeys.includes(e.key)) return;
        
        // Cho phép số, dấu phẩy, dấu chấm (sẽ convert thành dấu phẩy), dấu trừ
        if (/^[\d,.\-]$/.test(e.key)) return;
        
        // Cho phép numpad
        if (e.key.startsWith('Numpad')) return;
        
        e.preventDefault();
    });
}

// ========== ALIAS ==========
export const getRawInteger = getIntegerFromInput;
export const getRawMoney = getIntegerFromInput;
export const getRawQuantity = getNumberFromInput;
export const handleMoneyInput = handleIntegerInput;

export function handleIntegerInput(event) {
    const input = event.target;
    input.value = formatRawToDisplay(input.value);
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

export function handleQuantityInput(event) {
    handleIntegerInput(event);
}

export function setInputValue(inputElement, value) {
    if (!inputElement) return;
    let num = typeof value === 'string' ? parseNumber(value) : value;
    if (isNaN(num)) num = 0;
    // Chuyển sang chuỗi có dấu phẩy thập phân rồi format
    const str = num.toString().replace('.', ',');
    inputElement.value = formatRawToDisplay(str);
}

export function formatNumberVN(value, decimalPlaces = 0) {
    let num = typeof value === 'string' ? parseNumber(value) : value;
    if (isNaN(num)) num = 0;
    return num.toLocaleString('vi-VN', decimalPlaces > 0 ? 
        { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces } : undefined);
}

// ========== COLUMN CONFIGURATION ==========
const COLUMN_CONFIG_KEY = 'steeltrack_column_config';

export const DEFAULT_COLUMNS = [
    { key: 'id', label: 'Mã', visible: true, width: 80, sortable: true },
    { key: 'name', label: 'Tên vật tư', visible: true, width: 200, sortable: true },
    { key: 'cat', label: 'Loại', visible: true, width: 120, sortable: true },
    { key: 'unit', label: 'ĐVT', visible: true, width: 80, sortable: true },
    { key: 'qty', label: 'Tồn kho', visible: true, width: 120, sortable: true },
    { key: 'cost', label: 'Đơn giá gốc', visible: true, width: 130, sortable: true },
    { key: 'totalValue', label: 'Tổng giá trị', visible: true, width: 130, sortable: true },
    { key: 'status', label: 'TT', visible: true, width: 60, sortable: true },
    { key: 'note', label: 'Ghi chú', visible: true, width: 150, sortable: false },
    { key: 'actions', label: 'Thao tác', visible: true, width: 100, sortable: false }
];

export function getColumnConfig() {
    try {
        const saved = localStorage.getItem(COLUMN_CONFIG_KEY);
        if (saved) return JSON.parse(saved);
    } catch(e) {}
    return { columns: [...DEFAULT_COLUMNS], sortColumn: 'name', sortDirection: 'asc' };
}

export function saveColumnConfig(config) {
    try { localStorage.setItem(COLUMN_CONFIG_KEY, JSON.stringify(config)); } catch(e) {}
}

export function updateColumnWidth(columnKey, width) {
    const config = getColumnConfig();
    const col = config.columns.find(c => c.key === columnKey);
    if (col) { col.width = Math.max(50, Math.min(400, width)); saveColumnConfig(config); }
}

export function toggleColumnVisibility(columnKey) {
    const config = getColumnConfig();
    const col = config.columns.find(c => c.key === columnKey);
    if (col) { col.visible = !col.visible; saveColumnConfig(config); }
}

export function setSortConfig(columnKey) {
    const config = getColumnConfig();
    if (config.sortColumn === columnKey) {
        config.sortDirection = config.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        config.sortColumn = columnKey;
        config.sortDirection = 'asc';
    }
    saveColumnConfig(config);
}

export function getSortedData(data, sortColumn, sortDirection) {
    if (!sortColumn) return data;
    const col = DEFAULT_COLUMNS.find(c => c.key === sortColumn);
    if (!col || !col.sortable) return data;
    
    return [...data].sort((a, b) => {
        let valA = a[sortColumn], valB = b[sortColumn];
        if (sortColumn === 'qty' || sortColumn === 'cost' || sortColumn === 'totalValue') {
            if (sortColumn === 'totalValue') {
                valA = (a.qty || 0) * (a.cost || 0);
                valB = (b.qty || 0) * (b.cost || 0);
            } else {
                valA = parseFloat(valA) || 0;
                valB = parseFloat(valB) || 0;
            }
        } else {
            valA = (valA || '').toString().toLowerCase();
            valB = (valB || '').toString().toLowerCase();
        }
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
}

// ========== FAVORITES ==========
const FAVORITES_KEY = 'steeltrack_favorites';

export function getFavorites() {
    try { const saved = localStorage.getItem(FAVORITES_KEY); return saved ? JSON.parse(saved) : []; } catch(e) { return []; }
}

export function toggleFavorite(itemId) {
    let favorites = getFavorites();
    if (favorites.includes(itemId)) {
        favorites = favorites.filter(id => id !== itemId);
    } else {
        favorites.push(itemId);
    }
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    return favorites;
}

export function isFavorite(itemId) {
    return getFavorites().includes(itemId);
}

// ========== DEBOUNCE ==========
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}