import { state, addLog, escapeHtml } from './state.js';

// ========== CÁC HÀM XỬ LÝ SỐ - THEO CHUẨN VIỆT NAM ==========

export function parseNumber(str) {
    if (!str || str === '') return 0;
    
    let cleaned = str.toString().trim();
    
    // Nếu chuỗi chứa cả dấu chấm và dấu phẩy
    if (cleaned.includes('.') && cleaned.includes(',')) {
        // Dấu nào đứng sau cùng là dấu thập phân
        const lastDot = cleaned.lastIndexOf('.');
        const lastComma = cleaned.lastIndexOf(',');
        
        if (lastComma > lastDot) {
            // Dấu phẩy cuối cùng là thập phân -> xóa dấu chấm, đổi dấu phẩy cuối thành dấu chấm
            cleaned = cleaned.replace(/\./g, '');
            // Chỉ đổi dấu phẩy CUỐI CÙNG thành dấu chấm
            const before = cleaned.substring(0, lastComma);
            const after = cleaned.substring(lastComma + 1);
            cleaned = before.replace(/,/g, '') + '.' + after;
        } else {
            // Dấu chấm cuối cùng là thập phân -> xóa dấu phẩy
            cleaned = cleaned.replace(/,/g, '');
        }
    } else if (cleaned.includes(',')) {
        // Chỉ có dấu phẩy -> đổi thành dấu chấm (thập phân)
        // Nhưng phải đảm bảo chỉ có 1 dấu phẩy
        const parts = cleaned.split(',');
        if (parts.length > 2) {
            // Nhiều dấu phẩy -> dấu phẩy cuối là thập phân, còn lại bỏ
            const lastIdx = cleaned.lastIndexOf(',');
            cleaned = cleaned.substring(0, lastIdx).replace(/,/g, '') + '.' + cleaned.substring(lastIdx + 1);
        } else {
            cleaned = cleaned.replace(',', '.');
        }
    }
    // Nếu chỉ có dấu chấm -> giữ nguyên
    
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
    inputElement.value = formatNumberRealTime(num.toString().replace('.', ','));
}

export function formatMoneyVND(value) {
    let num = typeof value === 'string' ? parseNumber(value) : value;
    if (isNaN(num)) num = 0;
    return num.toLocaleString('vi-VN') + ' ₫';
}

export function formatNumberVN(value, decimalPlaces = 0) {
    let num = typeof value === 'string' ? parseNumber(value) : value;
    if (isNaN(num)) num = 0;
    if (decimalPlaces > 0) {
        return num.toLocaleString('vi-VN', { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces });
    }
    if (num % 1 !== 0) {
        let decimalCount = (num.toString().split('.')[1] || '').length;
        return num.toLocaleString('vi-VN', { minimumFractionDigits: decimalCount, maximumFractionDigits: decimalCount });
    }
    return num.toLocaleString('vi-VN');
}

// ========== HÀM FORMAT SỐ REAL-TIME (GỌI TỪ BÊN NGOÀI) ==========

export function formatNumberRealTime(rawValue) {
    if (!rawValue || rawValue === '') return '';
    
    // Lưu dấu âm nếu có
    let isNegative = false;
    if (rawValue.startsWith('-')) {
        isNegative = true;
        rawValue = rawValue.substring(1);
    }
    
    // Xóa tất cả ký tự không hợp lệ, chỉ giữ số, dấu chấm, dấu phẩy
    rawValue = rawValue.replace(/[^\d.,]/g, '');
    
    // Xác định vị trí dấu thập phân (dấu phẩy hoặc dấu chấm CUỐI CÙNG)
    let lastComma = rawValue.lastIndexOf(',');
    let lastDot = rawValue.lastIndexOf('.');
    let decimalSeparatorIndex = -1;
    
    if (lastComma >= 0 && lastDot >= 0) {
        // Có cả 2 dấu -> dấu nào sau cùng là thập phân
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
    
    // Format phần nguyên: thêm dấu chấm mỗi 3 chữ số từ phải sang trái
    let formattedInteger = '';
    let count = 0;
    for (let i = integerPart.length - 1; i >= 0; i--) {
        formattedInteger = integerPart[i] + formattedInteger;
        count++;
        if (count % 3 === 0 && i > 0) {
            formattedInteger = '.' + formattedInteger;
        }
    }
    
    if (formattedInteger === '') formattedInteger = '0';
    
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

// ========== HÀM SETUP INPUT SỐ - FORMAT REAL-TIME ==========

export function setupNumberInput(inputElement, options = {}) {
    if (!inputElement) return;
    
    const { isInteger = false, decimals = null } = options;
    
    // Xóa bỏ giới hạn maxlength nếu có
    inputElement.removeAttribute('maxlength');
    inputElement.removeAttribute('size');
    
    // Hàm format với giới hạn decimals
    function formatWithOptions(rawValue) {
        let formatted = formatNumberRealTime(rawValue);
        
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
            if (commaIdx >= 0 && formatted.length - commaIdx - 1 > decimals) {
                formatted = formatted.substring(0, commaIdx + decimals + 1);
            }
        }
        
        return formatted;
    }
    
    // Tính vị trí con trỏ mới
    function calculateNewCursorPosition(oldValue, newValue, oldCursorPos) {
        if (oldValue === newValue) return oldCursorPos;
        
        let oldDotsBefore = 0;
        for (let i = 0; i < Math.min(oldCursorPos, oldValue.length); i++) {
            if (oldValue[i] === '.') oldDotsBefore++;
        }
        
        let newDotsBefore = 0;
        for (let i = 0; i < Math.min(oldCursorPos, newValue.length); i++) {
            if (newValue[i] === '.') newDotsBefore++;
        }
        
        let newPos = oldCursorPos + (newDotsBefore - oldDotsBefore);
        newPos = Math.min(newPos, newValue.length);
        newPos = Math.max(0, newPos);
        
        return newPos;
    }
    
    // XỬ LÝ INPUT EVENT - Format real-time khi gõ
    inputElement.addEventListener('input', function(e) {
        const oldValue = this.value;
        const oldCursorPos = this.selectionStart;
        
        // Lấy raw value (chỉ giữ số, dấu trừ, dấu phẩy, dấu chấm)
        let rawValue = this.value.replace(/[^\d\-.,]/g, '');
        
        // Format lại
        const formattedValue = formatWithOptions(rawValue);
        
        // Tính vị trí con trỏ mới
        const newCursorPos = calculateNewCursorPosition(oldValue, formattedValue, oldCursorPos);
        
        // Cập nhật giá trị
        this.value = formattedValue;
        
        // Đặt lại vị trí con trỏ
        this.setSelectionRange(newCursorPos, newCursorPos);
        
        // Kích hoạt sự kiện change
        const changeEvent = new Event('change', { bubbles: true });
        this.dispatchEvent(changeEvent);
    });
    
    // XỬ LÝ BLUR - Format lại khi mất focus
    inputElement.addEventListener('blur', function() {
        let rawValue = this.value.replace(/[^\d\-.,]/g, '');
        this.value = formatWithOptions(rawValue);
        
        const changeEvent = new Event('change', { bubbles: true });
        this.dispatchEvent(changeEvent);
    });
    
    // XỬ LÝ FOCUS - Select all
    inputElement.addEventListener('focus', function() {
        this.select();
    });
    
    // XỬ LÝ PASTE
    inputElement.addEventListener('paste', function(e) {
        e.preventDefault();
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        let rawValue = pastedText.replace(/[^\d\-.,]/g, '');
        
        const start = this.selectionStart;
        const end = this.selectionEnd;
        const currentValue = this.value;
        
        const newRawValue = currentValue.substring(0, start) + rawValue + currentValue.substring(end);
        const formattedValue = formatWithOptions(newRawValue);
        
        this.value = formattedValue;
        
        const newCursorPos = Math.min(formattedValue.length, formattedValue.length);
        this.setSelectionRange(newCursorPos, newCursorPos);
        
        const changeEvent = new Event('change', { bubbles: true });
        this.dispatchEvent(changeEvent);
    });
    
    // CHO PHÉP TẤT CẢ CÁC PHÍM (không chặn nữa - vì input event đã lọc)
    // Chỉ chặn các ký tự thực sự không mong muốn
    inputElement.addEventListener('keypress', function(e) {
        // Cho phép tất cả phím điều khiển
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        // Cho phép tất cả các phím không phải ký tự in được
        if (e.key.length > 1) return;
        // Cho phép số, dấu chấm, dấu phẩy, dấu trừ
        if (/[\d.,\-]/.test(e.key)) return;
        // Chặn các ký tự khác
        e.preventDefault();
    });
}

// Aliases
export const getRawInteger = getIntegerFromInput;
export const getRawMoney = getIntegerFromInput;
export const getRawQuantity = getNumberFromInput;
export const setFormattedValue = setInputValue;
export const setMoneyValue = setInputValue;
export const setQuantityValue = setInputValue;
export const handleMoneyInput = handleIntegerInput;

export function handleIntegerInput(event) {
    const input = event.target;
    let rawValue = input.value.replace(/[^\d\-.,]/g, '');
    input.value = formatNumberRealTime(rawValue);
    const changeEvent = new Event('change', { bubbles: true });
    input.dispatchEvent(changeEvent);
}

export function handleQuantityInput(event) {
    handleIntegerInput(event);
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