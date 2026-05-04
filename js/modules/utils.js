import { state, addLog, escapeHtml } from './state.js';

export function parseNumber(str) {
    if (!str || str === '') return 0;
    let cleaned = str.toString().trim();
    cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.');
    let num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

export function getNumberFromInput(inputElement) {
    if (!inputElement) return 0;
    let val = inputElement.value || '0';
    let cleaned = val.replace(/\./g, '').replace(/,/g, '.');
    let num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

export function getIntegerFromInput(inputElement) {
    if (!inputElement) return 0;
    return Math.floor(parseNumber(inputElement.value));
}

export function formatMoneyVND(value) {
    let num = typeof value === 'string' ? parseNumber(value) : value;
    if (isNaN(num)) num = 0;
    let integerPart = Math.round(num).toString();
    let formatted = '', count = 0;
    for (let i = integerPart.length - 1; i >= 0; i--) {
        formatted = integerPart[i] + formatted;
        count++;
        if (count % 3 === 0 && i > 0) formatted = '.' + formatted;
    }
    return formatted + ' ₫';
}

export function formatRawToDisplay(rawValue) {
    if (!rawValue || rawValue === '') return '';
    let isNegative = rawValue.startsWith('-');
    if (isNegative) rawValue = rawValue.substring(1);
    rawValue = rawValue.replace(/[^\d,]/g, '');
    if (!rawValue) return isNegative ? '-' : '';
    let integerPart = '', decimalPart = '';
    const commaIdx = rawValue.indexOf(',');
    if (commaIdx >= 0) {
        integerPart = rawValue.substring(0, commaIdx);
        decimalPart = rawValue.substring(commaIdx + 1).replace(/,/g, '');
    } else { integerPart = rawValue; decimalPart = ''; }
    integerPart = integerPart.replace(/^0+/, '') || '0';
    let formattedInteger = '', count = 0;
    for (let i = integerPart.length - 1; i >= 0; i--) {
        formattedInteger = integerPart[i] + formattedInteger;
        count++;
        if (count % 3 === 0 && i > 0) formattedInteger = '.' + formattedInteger;
    }
    let result = formattedInteger;
    if (commaIdx >= 0) result += ',' + decimalPart;
    if (isNegative) result = '-' + result;
    return result;
}

export function setupNumberInput(inputElement, options = {}) {
    if (!inputElement) return;
    const { isInteger = false, decimals = null } = options;
    inputElement.removeAttribute('maxlength');
    inputElement.removeAttribute('size');

    function formatWithOptions(rawValue) {
        let formatted = formatRawToDisplay(rawValue);
        if (formatted === '' || formatted === '-') return formatted;
        if (isInteger) { const idx = formatted.indexOf(','); if (idx >= 0) formatted = formatted.substring(0, idx); return formatted; }
        if (decimals !== null) { const idx = formatted.indexOf(','); if (idx >= 0 && formatted.length - idx - 1 > decimals) formatted = formatted.substring(0, idx + decimals + 1); }
        return formatted;
    }

    inputElement.addEventListener('input', function() {
        let raw = this.value.replace(/[^\d,]/g, '');
        const oldCursor = this.selectionStart, formatted = formatWithOptions(raw);
        const oldLen = this.value.length, newLen = formatted.length;
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

    inputElement.addEventListener('focus', function() { this.select(); });

    inputElement.addEventListener('paste', function(e) {
        e.preventDefault();
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        const start = this.selectionStart, end = this.selectionEnd;
        this.value = formatWithOptions(this.value.substring(0, start) + pastedText + this.value.substring(end));
        this.dispatchEvent(new Event('change', { bubbles: true }));
    });

    inputElement.addEventListener('keydown', function(e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (['Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Tab','Enter','Escape'].includes(e.key)) return;
        if (/^[\d,.\-]$/.test(e.key)) return;
        if (e.key.startsWith('Numpad')) return;
        e.preventDefault();
    });
}

export function handleIntegerInput(event) {
    const input = event.target;
    input.value = formatRawToDisplay(input.value);
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

export function handleQuantityInput(event) { handleIntegerInput(event); }

export function setInputValue(inputElement, value) {
    if (!inputElement) return;
    let num = typeof value === 'string' ? parseNumber(value) : value;
    if (isNaN(num)) num = 0;
    inputElement.value = formatRawToDisplay(num.toString().replace('.', ','));
}

export function formatNumberVN(value, decimalPlaces = 0) {
    let num = typeof value === 'string' ? parseNumber(value) : value;
    if (isNaN(num)) num = 0;
    let intPart = Math.round(num).toString();
    let formatted = '', count = 0;
    for (let i = intPart.length - 1; i >= 0; i--) { formatted = intPart[i] + formatted; count++; if (count % 3 === 0 && i > 0) formatted = '.' + formatted; }
    return formatted;
}

export const getRawInteger = getIntegerFromInput;
export const getRawMoney = getIntegerFromInput;
export const getRawQuantity = getNumberFromInput;
export const handleMoneyInput = handleIntegerInput;

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

export function getColumnConfig() { try { const s = localStorage.getItem(COLUMN_CONFIG_KEY); if (s) return JSON.parse(s); } catch(e) {} return { columns: [...DEFAULT_COLUMNS], sortColumn: 'name', sortDirection: 'asc' }; }
export function saveColumnConfig(config) { try { localStorage.setItem(COLUMN_CONFIG_KEY, JSON.stringify(config)); } catch(e) {} }
export function updateColumnWidth(columnKey, width) { const c = getColumnConfig(); const col = c.columns.find(x => x.key === columnKey); if (col) { col.width = Math.max(50, Math.min(400, width)); saveColumnConfig(c); } }
export function toggleColumnVisibility(columnKey) { const c = getColumnConfig(); const col = c.columns.find(x => x.key === columnKey); if (col) { col.visible = !col.visible; saveColumnConfig(c); } }
export function setSortConfig(columnKey) { const c = getColumnConfig(); if (c.sortColumn === columnKey) { c.sortDirection = c.sortDirection === 'asc' ? 'desc' : 'asc'; } else { c.sortColumn = columnKey; c.sortDirection = 'asc'; } saveColumnConfig(c); }
export function getSortedData(data, sortColumn, sortDirection) {
    if (!sortColumn) return data;
    return [...data].sort((a, b) => {
        let va = a[sortColumn], vb = b[sortColumn];
        if (sortColumn === 'qty' || sortColumn === 'cost' || sortColumn === 'totalValue') {
            if (sortColumn === 'totalValue') { va = (a.qty||0)*(a.cost||0); vb = (b.qty||0)*(b.cost||0); }
            else { va = parseFloat(va)||0; vb = parseFloat(vb)||0; }
        } else { va = String(va||'').toLowerCase(); vb = String(vb||'').toLowerCase(); }
        if (va < vb) return sortDirection === 'asc' ? -1 : 1;
        if (va > vb) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
}

const FAVORITES_KEY = 'steeltrack_favorites';
export function getFavorites() { try { return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || []; } catch(e) { return []; } }
export function toggleFavorite(itemId) { let f = getFavorites(); if (f.includes(itemId)) f = f.filter(id => id !== itemId); else f.push(itemId); localStorage.setItem(FAVORITES_KEY, JSON.stringify(f)); return f; }
export function isFavorite(itemId) { return getFavorites().includes(itemId); }
export function debounce(func, wait) { let timeout; return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func(...args), wait); }; }
