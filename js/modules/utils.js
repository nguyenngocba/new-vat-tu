import { state, addLog, escapeHtml } from './state.js';

// ========== CÁC HÀM XỬ LÝ SỐ ==========

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
    // Bỏ dấu chấm (phân cách hàng nghìn), đổi dấu phẩy thành dấu chấm (thập phân)
    let val = inputElement.value || '0';
    console.log('getNumberFromInput raw:', val);
    let cleaned = val.replace(/\./g, '').replace(/,/g, '.');
    console.log('getNumberFromInput cleaned:', cleaned);
    let num = parseFloat(cleaned);
    console.log('getNumberFromInput result:', num);
    return isNaN(num) ? 0 : num;
}

export function getIntegerFromInput(inputElement) {
    if (!inputElement) return 0;
    return Math.floor(parseNumber(inputElement.value));
}

export function formatMoneyVND(value) {
    let num = typeof value === 'string' ? parseNumber(value) : value;
    if (isNaN(num)) num = 0;
    
    // Format thủ công: thêm dấu chấm mỗi 3 số
    let integerPart = Math.round(num).toString();
    let formatted = '';
    let count = 0;
    for (let i = integerPart.length - 1; i >= 0; i--) {
        formatted = integerPart[i] + formatted;
        count++;
        if (count % 3 === 0 && i > 0) formatted = '.' + formatted;
    }
    
    return formatted + ' ₫';
}

// ========== HÀM FORMAT SỐ HIỂN THỊ ==========

export function formatRawToDisplay(rawValue) {
    if (!rawValue || rawValue === '') return '';
    let isNegative = false;
    if (rawValue.startsWith('-')) { isNegative = true; rawValue = rawValue.substring(1); }
    rawValue = rawValue.replace(/[^\d,]/g, '');
    if (rawValue === '') return isNegative ? '-' : '';
    let integerPart = '', decimalPart = '';
    const firstCommaIdx = rawValue.indexOf(',');
    if (firstCommaIdx >= 0) {
        integerPart = rawValue.substring(0, firstCommaIdx);
        decimalPart = rawValue.substring(firstCommaIdx + 1).replace(/,/g, '');
    } else { integerPart = rawValue; decimalPart = ''; }
    integerPart = integerPart.replace(/^0+/, '') || '0';
    let formattedInteger = '', count = 0;
    for (let i = integerPart.length - 1; i >= 0; i--) {
        formattedInteger = integerPart[i] + formattedInteger;
        count++;
        if (count % 3 === 0 && i > 0) formattedInteger = '.' + formattedInteger;
    }
    let result = formattedInteger;
    if (firstCommaIdx >= 0) result += ',' + decimalPart;
    if (isNegative) result = '-' + result;
    return result;
}

// ========== HÀM SETUP INPUT ==========

export function setupNumberInput(inputElement, options = {}) {
    if (!inputElement) return;
    
    const { isInteger = false, decimals = null } = options;
    
    inputElement.removeAttribute('maxlength');
    inputElement.removeAttribute('size');
    
    function formatWithOptions(rawValue) {
        let formatted = formatRawToDisplay(rawValue);
        if (formatted === '' || formatted === '-') return formatted;
        if (isInteger) {
            const commaIdx = formatted.indexOf(',');
            if (commaIdx >= 0) formatted = formatted.substring(0, commaIdx);
            return formatted;
        }
        if (decimals !== null) {
            const commaIdx = formatted.indexOf(',');
            if (commaIdx >= 0) {
                const decimalLen = formatted.length - commaIdx - 1;
                if (decimalLen > decimals) formatted = formatted.substring(0, commaIdx + decimals + 1);
            }
        }
        return formatted;
    }
    
    inputElement.addEventListener('input', function() {
        let raw = this.value.replace(/[^\d,]/g, '');
        const oldCursor = this.selectionStart;
        const formatted = formatWithOptions(raw);
        const oldLen = this.value.length;
        const newLen = formatted.length;
        this.value = formatted;
        let newCursor = oldCursor + (newLen - oldLen);
        if (newCursor > newLen) newCursor = newLen;
        if (newCursor < 0) newCursor = 0;
        this.setSelectionRange(newCursor, newCursor);
        this.dispatchEvent(new Event('change', { bubbles: true }));
    });
    
    inputElement.addEventListener('blur', function() {
        let raw = this.value.replace(/[^\d,]/g, '');
        this.value = formatWithOptions(raw);
        this.dispatchEvent(new Event('change', { bubbles: true }));
    });
    
    inputElement.addEventListener('focus', function() {
        this.select();
    });
    
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
    
    inputElement.addEventListener('keydown', function(e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const controlKeys = ['Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Tab','Enter','Escape'];
        if (controlKeys.includes(e.key)) return;
        if (/^[\d,.\-]$/.test(e.key)) return;
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
    const str = num.toString().replace('.', ',');
    inputElement.value = formatRawToDisplay(str);
}

export function formatNumberVN(value, decimalPlaces = 0) {
    let num = typeof value === 'string' ? parseNumber(value) : value;
    if (isNaN(num)) num = 0;
    let intPart = Math.round(num).toString();
    let formatted = '', count = 0;
    for (let i = intPart.length - 1; i >= 0; i--) {
        formatted = intPart[i] + formatted;
        count++;
        if (count % 3 === 0 && i > 0) formatted = '.' + formatted;
    }
    return formatted;
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
    try { const saved = localStorage.getItem(COLUMN_CONFIG_KEY); if (saved) return JSON.parse(saved); } catch(e) {}
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
    } else { config.sortColumn = columnKey; config.sortDirection = 'asc'; }
    saveColumnConfig(config);
}

export function getSortedData(data, sortColumn, sortDirection) {
    if (!sortColumn) return data;
    const col = DEFAULT_COLUMNS.find(c => c.key === sortColumn);
    if (!col || !col.sortable) return data;
    return [...data].sort((a, b) => {
        let valA = a[sortColumn], valB = b[sortColumn];
        if (sortColumn === 'qty' || sortColumn === 'cost' || sortColumn === 'totalValue') {
            if (sortColumn === 'totalValue') { valA = (a.qty || 0) * (a.cost || 0); valB = (b.qty || 0) * (b.cost || 0); }
            else { valA = parseFloat(valA) || 0; valB = parseFloat(valB) || 0; }
        } else { valA = (valA || '').toString().toLowerCase(); valB = (valB || '').toString().toLowerCase(); }
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
    if (favorites.includes(itemId)) favorites = favorites.filter(id => id !== itemId);
    else favorites.push(itemId);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    return favorites;
}

export function isFavorite(itemId) { return getFavorites().includes(itemId); }

// ========== DEBOUNCE ==========
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}