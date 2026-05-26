(function () {

    var CONTAINER = "chart-activity-heatmap";

    /* colour tiers */
    var TIERS = [
        { min: 0,    max: 1,    color: "var(--color-rest)",        label: "rest"         },
        { min: 1,    max: 200,  color: "var(--color-red)",         label: "< 200 kcal"   },
        { min: 200,  max: 300,  color: "var(--color-yellow)",      label: "200–299 kcal" },
        { min: 300,  max: 600,  color: "var(--color-green-light)", label: "300–599 kcal" },
        { min: 600,  max: 1200, color: "var(--color-green)",       label: "600–1199 kcal"},
        { min: 1200, max: Infinity, color: "var(--color-green-dark)", label: "≥ 1200 kcal" },
    ];

    function tierColor(kcal) {
        for (var i = TIERS.length - 1; i >= 0; i--) {
            if (kcal >= TIERS[i].min) return TIERS[i].color;
        }
        return TIERS[0].color;
    }

    /* init */
    function initActivityHeatmap() {
        var wrap = document.getElementById(CONTAINER);
        if (!wrap) return;
        wrap.innerHTML = "";
        updateActivityHeatmap();
    }

    /* update */
    function updateActivityHeatmap() {
        var wrap = document.getElementById(CONTAINER);
        if (!wrap) return;
        wrap.innerHTML = "";

        var data = getFilteredData();
        var byDate = {};
        data.forEach(function (d) {
            byDate[d3.timeFormat("%Y-%m-%d")(d.date)] = d.activityKcal;
        });

        if (data.length === 0) return;

        /* layout constants */
        var CELL = 16;   // cell size px
        var GAP = 4;    // gap between cells
        var STEP = CELL + GAP;
        var WEEK_LABEL_W = 28;  // left gutter for Mon/Wed/Fri labels
        var MONTH_LABEL_H = 20; // top gutter for month names

        /* legend */
        var legendDiv = document.createElement("div");
        legendDiv.className = "hm-legend";

        var legendSvg = d3.select(legendDiv)
            .append("svg")
            .attr("height", 22);

        var legendItems = TIERS.slice();
        var lx = 0;
        var labelText = ["unknown", "<200", "200–299", "300–599", "600–1199", "≥1200"];

        legendItems.forEach(function (t, i) {
            var g = legendSvg.append("g")
                .attr("transform", "translate(" + lx + ",0)");
            g.append("rect")
                .attr("width", 13).attr("height", 13)
                .attr("rx", 2).attr("y", 0)
                .attr("fill", t.color);
            g.append("text")
                .attr("class", "hm-legend-label")
                .attr("x", 17).attr("y", 11)
                .text(labelText[i]);

            lx += 13 + 5 + labelText[i].length * 6.5 + 20;
        });

        legendSvg.attr("width", lx);
        wrap.appendChild(legendDiv);

        /* group data by year */
        var years = d3.groups(data, function (d) { return d.year; })
            .sort(function (a, b) { return a[0] - b[0]; });

        /* render each year */
        years.forEach(function (yearEntry) {
            var year    = yearEntry[0];
            var yearDiv = document.createElement("div");
            yearDiv.className = "hm-year";

            /* year label */
            var yearLabel = document.createElement("div");
            yearLabel.className   = "hm-year-label";
            yearLabel.textContent = year;
            yearDiv.appendChild(yearLabel);

            /* build full calendar: Mon Jan 1 → Sun Dec 31 */
            var jan1  = new Date(year, 0, 1);
            var dec31 = new Date(year, 11, 31);

            /* align to Monday of the week containing Jan 1 */
            var startDate = d3.timeMonday.floor(jan1);
            /* align to Sunday of the week containing Dec 31 */
            var endDate   = d3.timeSunday.ceil(dec31);

            var days  = d3.timeDays(startDate, endDate);
            /* number of Monday-anchored weeks */
            var weeks = Math.ceil(days.length / 7);

            var svgW = WEEK_LABEL_W + weeks * STEP + GAP;
            var svgH = MONTH_LABEL_H + 7 * STEP + GAP;

            var svg = d3.select(yearDiv)
                .append("svg")
                .attr("width",  svgW)
                .attr("height", svgH);

            var g = svg.append("g")
                .attr("transform", "translate(" + WEEK_LABEL_W + "," + MONTH_LABEL_H + ")");

            /* cells */
            var fmt = d3.timeFormat("%Y-%m-%d");
            var fmtTip = d3.timeFormat("%d %b %Y");

            /* day-of-week: Mon=0 … Sun=6 */
            function dow(d) { return (d.getDay() + 6) % 7; }

            /* week index = column */
            function weekIdx(d) {
                return Math.floor(d3.timeMonday.count(startDate, d));
            }

            var cells = g.selectAll(".hm-cell")
                .data(days)
                .enter()
                .append("rect")
                .attr("class", "hm-cell")
                .attr("rx", 2)
                .attr("width",  CELL)
                .attr("height", CELL)
                .attr("x", function (d) { return weekIdx(d) * STEP; })
                .attr("y", function (d) { return dow(d) * STEP; })
                .attr("fill", function (d) {
                    var key  = fmt(d);
                    var kcal = byDate[key] !== undefined ? byDate[key] : 0;
                    return tierColor(kcal);
                })
                .attr("opacity", 0)
                .on("mouseenter", function (event, d) {
                    var key  = fmt(d);
                    var kcal = byDate[key] !== undefined ? Math.round(byDate[key]) : 0;
                    var tip  = document.getElementById("hm-tooltip");
                    tip.innerHTML =
                        "<span class='tip-date'>" + fmtTip(d) + "</span>" +
                        "<span class='tip-row'>" +
                            "<span class='tip-dot' style='background:" + tierColor(kcal) + "'></span>" +
                            "activity: <strong>" + kcal + " kcal</strong>" +
                        "</span>";
                    tip.style.display = "block";
                    tip.style.left = (event.pageX + 14) + "px";
                    tip.style.top  = (event.pageY - tip.offsetHeight - 10) + "px";
                })
                .on("mousemove", function (event) {
                    var tip = document.getElementById("hm-tooltip");
                    tip.style.left = (event.pageX + 14) + "px";
                    tip.style.top  = (event.pageY - tip.offsetHeight - 10) + "px";
                })
                .on("mouseleave", function () {
                    document.getElementById("hm-tooltip").style.display = "none";
                });

            /* stagger-fade cells in */
            cells.transition()
                .delay(function (d) {
                    return weekIdx(d) * 6;
                })
                .duration(300)
                .attr("opacity", 1);

            /* month labels */
            var months = d3.timeMonths(startDate, endDate);
            g.selectAll(".hm-month")
                .data(months)
                .enter()
                .append("text")
                .attr("class", "hm-month")
                .attr("x", function (d) { return weekIdx(d) * STEP + 1; })
                .attr("y", -6)
                .attr("fill", "var(--text-secondary)")
                .text(function (d) { return d3.timeFormat("%b")(d); });

            /* day-of-week labels */
            var dowLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
            dowLabels.forEach(function (lbl, i) {
                if (!lbl) return;
                svg.append("text")
                    .attr("class", "hm-dow")
                    .attr("x", WEEK_LABEL_W - 4)
                    .attr("y", MONTH_LABEL_H + i * STEP + CELL - 2)
                    .attr("text-anchor", "end")
                    .attr("fill", "var(--text-secondary)")
                    .text(lbl);
            });

            wrap.appendChild(yearDiv);
        });

        /* singleton tooltip */
        if (!document.getElementById("hm-tooltip")) {
            var tip = document.createElement("div");
            tip.id        = "hm-tooltip";
            tip.className = "dw-tooltip";
            document.body.appendChild(tip);
        }
    }

    window.initActivityHeatmap   = initActivityHeatmap;
    window.updateActivityHeatmap = updateActivityHeatmap;

}());