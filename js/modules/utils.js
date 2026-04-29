import { state, addLog, escapeHtml } from './state.js';

// ========== CÁC HÀM XỬ LÝ SỐ - THEO CHUẨN VIỆT NAM ==========

export function parseNumber(str) {
    if (!str || str === '') return 0;
    
    let cleaned = str.toString().trim();
    
    // Nếu chuỗi chứa cả dấu chấm và dấu phẩy
    if (cleaned.includes('.') && cleaned.includes(',')) {
        const lastDot = cleaned.lastIndexOf('.');
        const lastComma = cleaned.lastIndexOf(',');
        
        if (lastComma > lastDot) {
            cleaned = cleaned.replace(/\./g, '');
            const before = cleaned.substring(0, lastComma);
            const after = cleaned.substring(lastComma + 1);
            cleaned = before.replace(/,/g, '') + '.' + after;
        } else {
            cleaned = cleaned.replace(/,/g, '');
        }
    } else if (cleaned.includes(',')) {
        const parts = cleaned.split(',');
        if (parts.length > 2) {
            const lastIdx = cleaned.lastIndexOf(',');
            cleaned = cleaned.substring(0, lastIdx).replace(/,/g, '') + '.' + cleaned.substring(lastIdx + 1);
        } else {
            cleaned = cleaned.replace(',', '.');
        }
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

export function setInputValue(inputElement, value) {
    if (!inputElement) return;
    let num = typeof value === 'string' ? parseNumber(value) : value;
    if (isNaN(num)) num = 0;
    inputElement.value = formatRawToDisplay(num.toString().replace('.', ','));
}

export function formatMoneyVND(value) {
    let num = typeof value === 'string' ? parseNumber(value) : value;
    if (isNaN(num)) num = 0;
    return num.toLocaleString('vi-VN') + ' ₫';
}

// ========== HÀM FORMAT SỐ REAL-TIME ==========

/**
 * Format một chuỗi raw thành chuỗi hiển thị có dấu chấm phân cách
 * @param {string} rawValue - Chuỗi raw từ input (chỉ chứa số, dấu chấm, dấu phẩy, dấu trừ)
 * @returns {string} Chuỗi đã format (VD: "1.000.000,5")
 */
export function formatRawToDisplay(rawValue) {
    if (!rawValue || rawValue === '') return '';
    
    // Lưu dấu âm
    let isNegative = false;
    if (rawValue.startsWith('-')) {
        isNegative = true;
        rawValue = rawValue.substring(1);
    }
    
    // Xóa tất cả ký tự không hợp lệ
    rawValue = rawValue.replace(/[^\d.,]/g, '');
    
    if (rawValue === '') return isNegative ? '-' : '';
    
    // Tìm vị trí dấu thập phân (dấu phẩy hoặc dấu chấm CUỐI CÙNG)
    let lastComma = rawValue.lastIndexOf(',');
    let lastDot = rawValue.lastIndexOf('.');
    let decimalSeparatorIndex = -1;
    
    if (lastComma >= 0 && lastDot >= 0) {
        decimalSeparatorIndex = Math.max(lastComma, lastDot);
    } else if (lastComma >= 0) {
        decimalSeparatorIndex = lastComma;
    } else if (lastDot >= 0) {
        decimalSeparatorIndex = lastDot;
    }
    
    let integerPart = '';
    let decimalPart = '';
    
    if (decimalSeparatorIndex >= 0) {
        integerPart = rawValue.substring(0, decimalSeparatorIndex);
        decimalPart = rawValue.substring(decimalSeparatorIndex + 1);
    } else {
        integerPart = rawValue;
        decimalPart = '';
    }
    
    // Xóa TẤT CẢ dấu chấm và dấu phẩy trong phần nguyên
    integerPart = integerPart.replace(/[.,]/g, '');
    
    // Xóa dấu chấm và dấu phẩy trong phần thập phân
    decimalPart = decimalPart.replace(/[.,]/g, '');
    
    // Nếu phần nguyên rỗng -> mặc định là '0'
    if (integerPart === '') integerPart = '0';
    
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

/**
 * Đếm số dấu chấm trong chuỗi TRƯỚC vị trí pos
 */
function countDotsBefore(str, pos) {
    let count = 0;
    const end = Math.min(pos, str.length);
    for (let i = 0; i < end; i++) {
        if (str[i] === '.') count++;
    }
    return count;
}

/**
 * Đếm số dấu phẩy trong chuỗi TRƯỚC vị trí pos
 */
function countCommasBefore(str, pos) {
    let count = 0;
    const end = Math.min(pos, str.length);
    for (let i = 0; i < end; i++) {
        if (str[i] === ',') count++;
    }
    return count;
}

// ========== HÀM SETUP INPUT SỐ - FORMAT REAL-TIME (FIX HOÀN CHỈNH) ==========

export function setupNumberInput(inputElement, options = {}) {
    if (!inputElement) return;
    
    const { isInteger = false, decimals = null } = options;
    
    // Xóa bỏ mọi giới hạn
    inputElement.removeAttribute('maxlength');
    inputElement.removeAttribute('size');
    inputElement.removeAttribute('min');
    inputElement.removeAttribute('max');
    
    // Format với giới hạn decimals
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
    
    // ===== XỬ LÝ INPUT EVENT =====
    inputElement.addEventListener('input', function(e) {
        const oldValue = this.value;
        const oldCursorPos = this.selectionStart;
        
        // Lấy giá trị raw từ input (chỉ giữ ký tự hợp lệ)
        let rawValue = this.value.replace(/[^\d\-.,]/g, '');
        
        // Format thành chuỗi hiển thị
        const newValue = formatWithOptions(rawValue);
        
        // ===== TÍNH TOÁN VỊ TRÍ CON TRỎ MỚI =====
        let newCursorPos = oldCursorPos;
        
        if (oldValue !== newValue) {
            // Đếm số dấu chấm trong giá trị cũ trước vị trí con trỏ
            const oldDotsBefore = countDotsBefore(oldValue, oldCursorPos);
            // Đếm số dấu chấm trong giá trị mới trước vị trí con trỏ
            const newDotsBefore = countDotsBefore(newValue, Math.min(oldCursorPos, newValue.length));
            
            // Điều chỉnh vị trí con trỏ dựa trên sự khác biệt số dấu chấm
            newCursorPos = oldCursorPos + (newDotsBefore - oldDotsBefore);
            
            // Đảm bảo con trỏ không vượt quá độ dài chuỗi mới
            newCursorPos = Math.max(0, Math.min(newCursorPos, newValue.length));
            
            // Nếu con trỏ đang ở vị trí dấu chấm, đẩy qua phải 1 ký tự
            if (newCursorPos < newValue.length && newValue[newCursorPos] === '.') {
                newCursorPos++;
            }
        }
        
        // Cập nhật giá trị input
        this.value = newValue;
        
        // Đặt lại vị trí con trỏ
        try {
            this.setSelectionRange(newCursorPos, newCursorPos);
        } catch (ex) {
            // Fallback: đặt con trỏ ở cuối
            this.setSelectionRange(newValue.length, newValue.length);
        }
        
        // Kích hoạt sự kiện change
        const changeEvent = new Event('change', { bubbles: true });
        this.dispatchEvent(changeEvent);
    });
    
    // ===== XỬ LÝ BLUR =====
    inputElement.addEventListener('blur', function() {
        let rawValue = this.value.replace(/[^\d\-.,]/g, '');
        this.value = formatWithOptions(rawValue);
        
        const changeEvent = new Event('change', { bubbles: true });
        this.dispatchEvent(changeEvent);
    });
    
    // ===== XỬ LÝ FOCUS =====
    inputElement.addEventListener('focus', function() {
        this.select();
    });
    
    // ===== XỬ LÝ PASTE =====
    inputElement.addEventListener('paste', function(e) {
        e.preventDefault();
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        let rawPasted = pastedText.replace(/[^\d\-.,]/g, '');
        
        const start = this.selectionStart;
        const end = this.selectionEnd;
        const oldValue = this.value;
        
        // Tạo giá trị mới sau khi paste
        const beforePaste = oldValue.substring(0, start);
        const afterPaste = oldValue.substring(end);
        const newRawValue = beforePaste + rawPasted + afterPaste;
        
        const newValue = formatWithOptions(newRawValue);
        
        this.value = newValue;
        
        // Đặt con trỏ ở cuối phần được paste
        const newCursorPos = Math.min(start + newValue.length, newValue.length);
        this.setSelectionRange(newCursorPos, newCursorPos);
        
        const changeEvent = new Event('change', { bubbles: true });
        this.dispatchEvent(changeEvent);
    });
    
    // ===== XỬ LÝ KEYDOWN (chỉ chặn ký tự thực sự không hợp lệ) =====
    inputElement.addEventListener('keydown', function(e) {
        // Luôn cho phép các phím điều khiển
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        
        // Cho phép tất cả phím không in ra ký tự
        if (e.key === 'Backspace' || e.key === 'Delete' || 
            e.key === 'ArrowLeft' || e.key === 'ArrowRight' || 
            e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
            e.key === 'Home' || e.key === 'End' ||
            e.key === 'Tab' || e.key === 'Enter' || e.key === 'Escape') {
            return;
        }
        
        // Cho phép các ký tự in được: số, dấu chấm, dấu phẩy, dấu trừ
        if (e.key.length === 1 && /[\d.,\-]/.test(e.key)) {
            return;
        }
        
        // Chặn tất cả ký tự khác
        e.preventDefault();
    });
}

// ========== ALIASES ==========
export const getRawInteger = getIntegerFromInput;
export const getRawMoney = getIntegerFromInput;
export const getRawQuantity = getNumberFromInput;
export const setFormattedValue = setInputValue;
export const setMoneyValue = setInputValue;
export const setQuantityValue = setInputValue;

export function handleIntegerInput(event) {
    const input = event.target;
    let rawValue = input.value.replace(/[^\d\-.,]/g, '');
    input.value = formatRawToDisplay(rawValue);
    const changeEvent = new Event('change', { bubbles: true });
    input.dispatchEvent(changeEvent);
}

export function handleQuantityInput(event) {
    handleIntegerInput(event);
}
export const handleMoneyInput = handleIntegerInput;

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
    try {
        localStorage.setItem(COLUMN_CONFIG_KEY, JSON.stringify(config));
    } catch(e) {}
}

export function updateColumnWidth(columnKey, width) {
    const config = getColumnConfig();
    const col = config.columns.find(c => c.key === columnKey);
    if (col) {
        col.width = Math.max(50, Math.min(400, width));
        saveColumnConfig(config);
    }
}

export function toggleColumnVisibility(columnKey) {
    const config = getColumnConfig();
    const col = config.columns.find(c => c.key === columnKey);
    if (col) {
        col.visible = !col.visible;
        saveColumnConfig(config);
    }
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
        let valA = a[sortColumn];
        let valB = b[sortColumn];
        
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
    try {
        const saved = localStorage.getItem(FAVORITES_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch(e) { return []; }
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
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}