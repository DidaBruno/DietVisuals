// data.js 
//
// Every chart file calls functions from here. No chart ever touches the raw
// CSV directly. This means if the CSV format changes, you fix it in one place.
//
// Responsibilities:
//   1. PARSING     - load the CSV and convert every row to a clean JS object
//   2. FILTERING   - return slices of data based on year / month / date range
//   3. AGGREGATING - computed datasets that specific charts need2

let _data = [];

function loadData() {
    return d3.dsv(";", "../data/diet.csv").then(function(rows) {
        _data = rows.map(parseRow).filter(function(r) { return r !== null; });
        return _data;
    });
}

var parseDate = d3.timeParse("%Y-%m-%d");

// parses each row to clean data used for all charts
function parseRow(raw) {
    // date
    var date = parseDate(raw["Datum"]);
    if (!date) return null;

    // numeric columns
    var breakfastKcal = +raw["Doručak (kcal)"]   || 0;
    var lunchKcal     = +raw["Ručak (kcal)"]     || 0;
    var dinnerKcal    = +raw["Večera (kcal)"]    || 0;
    var totalIntake   = +raw["Ukupno"]           || 0;
    var bmr           = +raw["Potrošio"]         || 0;
    var activityKcal  = +raw["Aktivnost (kcal)"] || 0;

    // derived fields
    var totalBurn = bmr + activityKcal;
    var deficit   = totalBurn - totalIntake;

    // weight
    var weight = null;
    var rawWeight = raw["Tjelesna masa (kg)"];
    if (rawWeight && rawWeight.trim() !== "") {
        var cleaned = rawWeight
        .replace(/\s*kg\s*/i, "")
        .replace(/\s/g, "")
        .replace(",", ".");
        var parsed = parseFloat(cleaned);
        if (!isNaN(parsed)) weight = parsed;
    }

    // return the clean row object
    return {
        date:          date,
        year:          date.getFullYear(),
        month:         date.getMonth() + 1,
        dow:           raw["Dan u tjednu"].trim(),
        breakfast:     raw["Doručak"].trim(),
        breakfastKcal: breakfastKcal,
        lunch:         raw["Ručak"].trim(),
        lunchKcal:     lunchKcal,
        dinner:        raw["Večera"].trim(),
        dinnerKcal:    dinnerKcal,
        totalIntake:   totalIntake,
        bmr:           bmr,
        activityKcal:  activityKcal,
        activity:      raw["Aktivnost"].trim(),
        totalBurn:     totalBurn,
        deficit:       deficit,
        weight:        weight
    };
}

function getAllData() {
    return _data;
}

// year helper functions
function getAvailableYears() {
    var years = d3.set(_data.map(function(d) { return d.year; })).values();
    return years.map(Number).sort(function(a, b) { return b - a; });
}

function getWeightYears() {
    var years = d3.set(
        _data
        .filter(function(d) { return d.weight !== null; })
        .map(function(d) { return d.year; })
    ).values();
    return years.map(Number).sort(function(a, b) { return b - a; });
}

function getActivityYears() {
    var years = d3.set(
        _data
        .filter(function(d) { return d.activityKcal > 0; })
        .map(function(d) { return d.year; })
    ).values();
    return years.map(Number).sort(function(a, b) { return b - a; });
}

// filters
function filterByYear(year) {
    return _data.filter(function(d) {
        return d.year === +year; 
    });
}

function filterByMonth(year, month) {
    return _data.filter(function(d) {
        return d.year === +year && d.month === +month;
    });
}

function filterByRange(from, to) {
    return _data.filter(function(d) {
        return d.date >= from && d.date <= to;
    });
}

function applyFilter(filterState) {
    switch (filterState.mode) {
        case "year":
        return filterByYear(filterState.year);
        case "month":
        return filterByMonth(filterState.year, filterState.month);
        case "custom":
        return filterByRange(filterState.from, filterState.to);
        default:
        return _data;
    }
}

// aggregation
function rollingAverage(data, windowSize, field) {
    return data.map(function(d, i) {
        var start = Math.max(0, i - windowSize + 1);
        var window = data.slice(start, i + 1);
        var avg = d3.mean(window, function(w) { return w[field]; });
        return { date: d.date, value: avg };
    });
}

function groupByWeek(data) {
    // d3.timeMonday.floor() snaps any date back to the Monday of its week
    var weekFormat = d3.timeMonday;
    
    // Group rows by their Monday
    var nested = d3.nest()
        .key(function(d) { return weekFormat.floor(d.date); })
        .entries(data);
    
    var weeks = nested.map(function(group) {
        var rows = group.values;
        // Find Sunday's weight entry in this group
        var sunday = rows.find(function(r) { return r.dow === "NED"; });
        return {
        weekStart:  new Date(group.key),
        year:       new Date(group.key).getFullYear(),
        avgDeficit: d3.mean(rows, function(r) { return r.deficit; }),
        avgIntake:  d3.mean(rows, function(r) { return r.totalIntake; }),
        avgBurn:    d3.mean(rows, function(r) { return r.totalBurn; }),
        weight:     sunday ? sunday.weight : null
        };
    });
    
    // Sort chronologically
    weeks.sort(function(a, b) { return a.weekStart - b.weekStart; });
    

    weeks.forEach(function(week, i) {
        if (i === 0 || week.weight === null) {
        week.weightChange = null;
        return;
        }
        // Find the most recent previous week that has a weight value
        var prev = null;
        for (var j = i - 1; j >= 0; j--) {
        if (weeks[j].weight !== null) { prev = weeks[j]; break; }
        }
        week.weightChange = prev ? week.weight - prev.weight : null;
    });
    
    return weeks;
}

function groupByDow(data) {
    var order = ["PON", "UTO", "SRI", "ČET", "PET", "SUB", "NED"];
    
    var nested = d3.nest()
        .key(function(d) { return d.dow; })
        .entries(data);
    
    // Build a lookup so we can return in the correct order
    var lookup = {};
    nested.forEach(function(group) {
        var rows = group.values;
        lookup[group.key] = {
        dow:          group.key,
        avgBreakfast: d3.mean(rows, function(r) { return r.breakfastKcal; }),
        avgLunch:     d3.mean(rows, function(r) { return r.lunchKcal; }),
        avgDinner:    d3.mean(rows, function(r) { return r.dinnerKcal; }),
        avgTotal:     d3.mean(rows, function(r) { return r.totalIntake; }),
        avgBurn:      d3.mean(rows, function(r) { return r.totalBurn; })
        };
    });
    
    return order
        .filter(function(d) { return lookup[d]; })
        .map(function(d) { return lookup[d]; });
}