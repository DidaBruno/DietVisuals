// filters.js
// manages filter state and exposes getFilteredData().
// all chart files call getFilteredData() instead of getAllData() directly.

var _filters = {
    year:      null,   // number or null (null = all years)
    quarter:   null,   // 1-4 or null (null = all quarters)
    month:     null,   // number 1-12 or null (null = all months)
    dateFrom:  null,   // Date or null
    dateTo:    null,   // Date or null
};

// called by index.html after filters change, redraws all visible charts
var _onFilterChange = null;

function registerFilterCallback(fn) {
    _onFilterChange = fn;
}

function _notifyCharts() {
    if (typeof _onFilterChange === "function") _onFilterChange();
}

// setters
function setYear(val) {
    _filters.year    = val ? +val : null;
    _filters.month   = null; // reset month when year changes
    _filters.quarter = null; // reset quarter when year changes
    _notifyCharts();
}

function setQuarter(val) {
    _filters.quarter = val ? +val : null;
    _filters.month   = null; // quarter and month are mutually exclusive
    _notifyCharts();
}

function setMonth(val) {
    _filters.month = val ? +val : null;
    _notifyCharts();
}

function setDateFrom(val) {
    // val is a string "YYYY-MM-DD" from <input type="date">
    _filters.dateFrom = val ? new Date(val) : null;
    _notifyCharts();
}

function setDateTo(val) {
    _filters.dateTo = val ? new Date(val) : null;
    _notifyCharts();
}

function resetFilters() {
    _filters = { year: null, quarter: null, month: null, dateFrom: null, dateTo: null };
    _notifyCharts();
}

// getter
function getFilteredData() {
    return getAllData().filter(function(r) {
        // year filter
        if (_filters.year !== null && r.year !== _filters.year) return false;

        // quarter filter (Q1=months 1-3, Q2=4-6, Q3=7-9, Q4=10-12)
        if (_filters.quarter !== null) {
            var qStart = (_filters.quarter - 1) * 3 + 1;
            var qEnd   = qStart + 2;
            if (r.month < qStart || r.month > qEnd) return false;
        }

        // month filter
        if (_filters.month !== null && r.month !== _filters.month) return false;

        // date-from filter (inclusive)
        if (_filters.dateFrom !== null && r.date < _filters.dateFrom) return false;

        // date-to filter (inclusive — compare up to end of that day)
        if (_filters.dateTo !== null) {
            var endOfDay = new Date(_filters.dateTo);
            endOfDay.setHours(23, 59, 59, 999);
            if (r.date > endOfDay) return false;
        }

        return true;
    });
}

// state read - used by UI to keep controls in sync
function getFilters() {
    return Object.assign({}, _filters);
}