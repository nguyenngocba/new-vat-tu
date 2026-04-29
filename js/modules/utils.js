import { state, addLog, escapeHtml } from './state.js';

// ========== CÁC HÀM XỬ LÝ SỐ - THEO CHUẨN VIỆT NAM ==========

export function parseNumber(str) {
    if (!str || str === '') return 0;
    
    let cleaned = str.toString().trim();
    
    // Xóa dấu chấm (phân cách hàng nghìn)
    // Thay dấu phẩy bằng dấu chấm (thập phân)
    cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.');
    
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
    inputElement.value = num.toLocaleString('vi-VN');
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

export function handleIntegerInput(event) {
    const input = event.target;
    let num = parseNumber(input.value);
    if (isNaN(num)) num = 0;
    input.value = num.toLocaleString('vi-VN');
    const changeEvent = new Event('change', { bubbles: true });
    input.dispatchEvent(changeEvent);
}

export function handleQuantityInput(event) {
    const input = event.target;
    let num = parseNumber(input.value);
    if (isNaN(num)) num = 0;
    input.value = num.toLocaleString('vi-VN');
    const changeEvent = new Event('change', { bubbles: true });
    input.dispatchEvent(changeEvent);
}

// ========== HÀM SETUP INPUT SỐ - FORMAT REAL-TIME ==========

export function setupNumberInput(inputElement, options = {}) {
    if (!inputElement) return;
    
    const { isInteger = false, decimals = 2 } = options;
    
    // Hàm format số real-time (có dấu chấm phân cách hàng nghìn)
    function formatNumberRealTime(rawValue) {
        if (!rawValue || rawValue === '') return '';
        
        // Lưu dấu âm nếu có
        let isNegative = false;
        if (rawValue.startsWith('-')) {
            isNegative = true;
            rawValue = rawValue.substring(1);
        }
        
        // Tách phần nguyên và phần thập phân
        // Tìm vị trí dấu phẩy hoặc dấu chấm CUỐI CÙNG làm dấu thập phân
        let decimalSeparatorIndex = -1;
        let lastComma = rawValue.lastIndexOf(',');
        let lastDot = rawValue.lastIndexOf('.');
        
        if (lastComma > lastDot) {
            decimalSeparatorIndex = lastComma;
        } else if (lastDot > lastComma) {
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
        
        // Xóa tất cả dấu chấm và dấu phẩy còn lại trong phần nguyên
        integerPart = integerPart.replace(/[.,]/g, '');
        
        // Nếu là số nguyên, bỏ phần thập phân
        if (isInteger) {
            decimalPart = '';
        } else if (decimals !== null && decimalPart.length > decimals) {
            // Giới hạn số chữ số thập phân
            decimalPart = decimalPart.substring(0, decimals);
        }
        
        // Format phần nguyên: thêm dấu chấm mỗi 3 chữ số
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
        
        // Ghép lại
        let result = formattedInteger;
        if (decimalPart.length > 0 && !isInteger) {
            result += ',' + decimalPart;
        }
        
        if (isNegative) {
            result = '-' + result;
        }
        
        return result;
    }
    
    // Hàm tính vị trí con trỏ mới sau khi format
    function calculateNewCursorPosition(oldValue, newValue, oldCursorPos) {
        if (oldValue === newValue) return oldCursorPos;
        
        // Đếm số dấu chấm trong giá trị cũ trước vị trí con trỏ
        let oldDotsBefore = 0;
        for (let i = 0; i < Math.min(oldCursorPos, oldValue.length); i++) {
            if (oldValue[i] === '.') oldDotsBefore++;
        }
        
        // Đếm số dấu chấm trong giá trị mới trước vị trí con trỏ
        let newDotsBefore = 0;
        for (let i = 0; i < Math.min(oldCursorPos, newValue.length); i++) {
            if (newValue[i] === '.') newDotsBefore++;
        }
        
        let newPos = oldCursorPos + (newDotsBefore - oldDotsBefore);
        
        // Đảm bảo con trỏ không vượt quá độ dài chuỗi
        newPos = Math.min(newPos, newValue.length);
        newPos = Math.max(0, newPos);
        
        return newPos;
    }
    
    // Xử lý khi người dùng gõ (input event) - Format real-time
    inputElement.addEventListener('input', function(e) {
        const oldValue = this.value;
        const oldCursorPos = this.selectionStart;
        
        // Lấy giá trị raw (chỉ giữ số, dấu trừ, dấu phẩy, dấu chấm)
        let rawValue = this.value.replace(/[^\d\-,.]/g, '');
        
        // Đảm bảo chỉ có MỘT dấu thập phân (dấu phẩy hoặc dấu chấm)
        let commaCount = (rawValue.match(/,/g) || []).length;
        let dotCount = (rawValue.match(/\./g) || []).length;
        
        // Nếu có nhiều hơn 1 dấu phẩy hoặc dấu chấm, giữ lại dấu cuối cùng làm thập phân
        if (commaCount + dotCount > 1) {
            let lastComma = rawValue.lastIndexOf(',');
            let lastDot = rawValue.lastIndexOf('.');
            let lastSeparator = Math.max(lastComma, lastDot);
            
            if (lastSeparator >= 0) {
                let before = rawValue.substring(0, lastSeparator).replace(/[,.]/g, '');
                let separator = rawValue[lastSeparator];
                let after = rawValue.substring(lastSeparator + 1).replace(/[,.]/g, '');
                rawValue = before + separator + after;
            }
        }
        
        // Format lại
        const formattedValue = formatNumberRealTime(rawValue);
        
        // Tính toán vị trí con trỏ mới
        const newCursorPos = calculateNewCursorPosition(oldValue, formattedValue, oldCursorPos);
        
        // Cập nhật giá trị
        this.value = formattedValue;
        
        // Đặt lại vị trí con trỏ
        this.setSelectionRange(newCursorPos, newCursorPos);
        
        // Kích hoạt sự kiện change để cập nhật preview
        const changeEvent = new Event('change', { bubbles: true });
        this.dispatchEvent(changeEvent);
    });
    
    // Xử lý khi blur - Đảm bảo format đúng
    inputElement.addEventListener('blur', function() {
        let rawValue = this.value.replace(/[^\d\-,.]/g, '');
        const formattedValue = formatNumberRealTime(rawValue);
        this.value = formattedValue;
        
        const changeEvent = new Event('change', { bubbles: true });
        this.dispatchEvent(changeEvent);
    });
    
    // Xử lý khi focus - Select all để dễ nhập lại
    inputElement.addEventListener('focus', function() {
        this.select();
    });
    
    // Ngăn người dùng nhập ký tự không hợp lệ
    inputElement.addEventListener('keydown', function(e) {
        // Cho phép: số, backspace, delete, mũi tên, tab, home, end, dấu trừ, dấu chấm, dấu phẩy
        const allowedKeys = [
            'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
            'Tab', 'Home', 'End', 'Enter', 'Escape',
            '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
            '.', ',', '-', 'Minus', 'NumpadDecimal', 'NumpadSubtract',
            'Numpad0', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4',
            'Numpad5', 'Numpad6', 'Numpad7', 'Numpad8', 'Numpad9'
        ];
        
        // Cho phép Ctrl+C, Ctrl+V, Ctrl+A, Ctrl+X
        if (e.ctrlKey || e.metaKey) {
            return;
        }
        
        if (!allowedKeys.includes(e.key)) {
            e.preventDefault();
        }
    });
    
    // Xử lý paste - Format sau khi paste
    inputElement.addEventListener('paste', function(e) {
        e.preventDefault();
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        let rawValue = pastedText.replace(/[^\d\-,.]/g, '');
        
        // Lấy vị trí con trỏ hiện tại
        const start = this.selectionStart;
        const end = this.selectionEnd;
        const currentValue = this.value;
        
        // Tạo giá trị mới sau khi paste
        const newRawValue = currentValue.substring(0, start) + rawValue + currentValue.substring(end);
        const formattedValue = formatNumberRealTime(newRawValue);
        
        this.value = formattedValue;
        
        // Đặt con trỏ ở cuối phần được paste
        const newCursorPos = Math.min(start + formattedValue.length, formattedValue.length);
        this.setSelectionRange(newCursorPos, newCursorPos);
        
        const changeEvent = new Event('change', { bubbles: true });
        this.dispatchEvent(changeEvent);
    });
}

// ========== ALIAS ==========
export const getRawInteger = getIntegerFromInput;
export const getRawMoney = getIntegerFromInput;
export const getRawQuantity = getNumberFromInput;
export const setFormattedValue = setInputValue;
export const setMoneyValue = setInputValue;
export const setQuantityValue = setInputValue;
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