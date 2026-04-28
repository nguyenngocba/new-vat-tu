import { state, addLog, escapeHtml } from './state.js';

// ========== CÁC HÀM XỬ LÝ SỐ - THEO CHUẨN VIỆT NAM ==========

export function parseNumber(str) {
    if (!str || str === '') return 0;
    let cleaned = str.toString().replace(/\./g, '').replace(/,/g, '.');
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

// Hàm setupNumberInput - cho phép nhập số và format khi blur
export function setupNumberInput(inputElement, options = {}) {
    if (!inputElement) return;
    
    const { isInteger = false, decimals = null } = options;
    
    // Xử lý khi blur (mất focus)
    inputElement.addEventListener('blur', function() {
        let num = parseNumber(this.value);
        if (isNaN(num)) num = 0;
        if (isInteger) num = Math.floor(num);
        
        let formattedValue;
        if (decimals !== null) {
            formattedValue = num.toLocaleString('vi-VN', {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            });
        } else if (num % 1 !== 0) {
            let decimalPlaces = 0;
            const val = this.value;
            if (val.includes(',')) {
                decimalPlaces = val.split(',')[1].length;
            } else if (val.includes('.')) {
                decimalPlaces = val.split('.')[1].length;
            }
            decimalPlaces = Math.min(decimalPlaces, 2);
            formattedValue = num.toLocaleString('vi-VN', {
                minimumFractionDigits: decimalPlaces,
                maximumFractionDigits: decimalPlaces
            });
        } else {
            formattedValue = num.toLocaleString('vi-VN');
        }
        
        this.value = formattedValue;
        const changeEvent = new Event('change', { bubbles: true });
        this.dispatchEvent(changeEvent);
    });
    
    // Xử lý khi focus (chọn toàn bộ để dễ nhập)
    inputElement.addEventListener('focus', function() {
        this.select();
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