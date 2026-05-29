(function () {

    var _svg      = null;
    var _dims     = null;
    var CONTAINER = "chart-meals";

    var MEALS = [
        { key: "breakfastKcal", color: "var(--color-breakfast)", label: "breakfast" },
        { key: "lunchKcal",     color: "var(--color-lunch)",     label: "lunch"     },
        { key: "dinnerKcal",    color: "var(--color-dinner)",    label: "dinner"    },
    ];

    /* ── init ─────────────────────────────────────────────────────── */
    function initMealsChart() {
        var wrap = document.getElementById(CONTAINER);
        if (!wrap) return;
        wrap.innerHTML = "";

        var section   = document.getElementById("section-meals");
        var wasHidden = !section.classList.contains("active");
        if (wasHidden) section.classList.add("active");
        var W = wrap.clientWidth || 900;
        if (wasHidden) section.classList.remove("active");

        var H      = 420;
        var margin = { top: 24, right: 24, bottom: 48, left: 68 };

        _dims = {
            W: W, H: H,
            iW: W - margin.left - margin.right,
            iH: H - margin.top  - margin.bottom,
            margin: margin
        };

        _svg = d3.select("#" + CONTAINER)
            .append("svg")
            .attr("width",  W)
            .attr("height", H)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        // clip path
        _svg.append("defs").append("clipPath")
            .attr("id", "clip-meals")
            .append("rect")
            .attr("width",  _dims.iW)
            .attr("height", _dims.iH);

        // static axis groups
        _svg.append("g").attr("class", "axis axis-x")
            .attr("transform", "translate(0," + _dims.iH + ")");
        _svg.append("g").attr("class", "axis axis-y-left");

        // axis label
        _svg.append("text")
            .attr("class", "axis-label")
            .attr("transform", "rotate(-90)")
            .attr("x", -_dims.iH / 2).attr("y", -55)
            .attr("text-anchor", "middle")
            .text("intake (kcal)");

        // legend
        var legend = _svg.append("g")
            .attr("class", "chart-legend")
            .attr("transform", "translate(" + (_dims.iW - 220) + ",-4)");

        MEALS.forEach(function (m, i) {
            var legendX = [0, 76, 130];
            var g = legend.append("g").attr("transform", "translate(" + legendX[i] + ",0)");
            g.append("rect")
                .attr("width", 10).attr("height", 10)
                .attr("rx", 2).attr("y", -9)
                .attr("fill", m.color);
            g.append("text")
                .attr("x", 14).attr("y", 0)
                .attr("class", "legend-label")
                .text(m.label);
        });

        // tooltip
        if (!document.getElementById("meals-tooltip")) {
            var tip = document.createElement("div");
            tip.id        = "meals-tooltip";
            tip.className = "dw-tooltip";
            document.body.appendChild(tip);
        }

        updateMealsChart();
    }

    /* ── update ───────────────────────────────────────────────────── */
    function updateMealsChart() {
        if (!_svg) { initMealsChart(); return; }

        var data = getFilteredData();
        var iW   = _dims.iW;
        var iH   = _dims.iH;

        /* stack the three meal layers */
        var stack = d3.stack()
            .keys(["breakfastKcal", "lunchKcal", "dinnerKcal"]);

        var series = stack(data);

        /* scales */
        var xExt = d3.extent(data, function (d) { return d.date; });
        var xPad = data.length > 1
            ? (xExt[1] - xExt[0]) * 0.01
            : 86400000;
        var xScale = d3.scaleTime()
            .domain([new Date(xExt[0] - xPad), new Date(xExt[1] + xPad)])
            .range([0, iW]);

        var yMax = d3.max(data, function (d) {
            return d.breakfastKcal + d.lunchKcal + d.dinnerKcal;
        }) || 3000;
        yMax = Math.ceil(yMax / 500) * 500;

        var yScale = d3.scaleLinear()
            .domain([0, yMax])
            .range([iH, 0]);

        /* bar width */
        var barW = data.length > 1
            ? Math.max(1, (iW / data.length) - 1)
            : 4;

        /* draw stacked bars — one layer group per meal, animated in sequence */
        _svg.selectAll(".meal-layer").remove();

        var MEAL_DELAY = 500;

        series.forEach(function (layer, i) {
            var meal = MEALS[i];

            _svg.append("g")
                .attr("class", "meal-layer")
                .attr("clip-path", "url(#clip-meals)")
                .selectAll("rect")
                .data(layer)
                .enter()
                .append("rect")
                .attr("x",      function (d) { return xScale(d.data.date) - barW / 2; })
                .attr("width",  barW)
                .attr("fill",   meal.color)
                .attr("opacity", 0.85)
                // start collapsed at the bottom of the previous layer
                .attr("y",      function (d) { return yScale(d[0]); })
                .attr("height", 0)
                .transition()
                .delay(i * MEAL_DELAY)
                .duration(600)
                .ease(d3.easeCubicOut)
                .attr("y",      function (d) { return yScale(d[1]); })
                .attr("height", function (d) { return yScale(d[0]) - yScale(d[1]); });
        });

        /* axes */
        var tickCount = Math.max(3, Math.min(10, Math.floor(iW / 100)));

        _svg.select(".axis-x")
            .call(d3.axisBottom(xScale).ticks(tickCount).tickSizeOuter(0));

        _svg.select(".axis-y-left")
            .call(
                d3.axisLeft(yScale)
                    .ticks(6)
                    .tickSizeOuter(0)
                    .tickFormat(function (v) { return d3.format(".0f")(v); })
            );

        _svg.selectAll(".axis text")
            .style("font-family", "'DM Mono', monospace")
            .style("font-size",   "11px")
            .style("fill",        "var(--text-secondary)");
        _svg.selectAll(".axis path, .axis line")
            .style("stroke", "var(--border)");

        /* tooltip overlay */
        _svg.selectAll(".overlay-meals").remove();

        var tip = document.getElementById("meals-tooltip");

        _svg.append("rect")
            .attr("class",  "overlay-meals")
            .attr("width",  iW)
            .attr("height", iH)
            .attr("fill",   "transparent")
            .on("mousemove", function (event) {
                var mx     = d3.pointer(event)[0];
                var date   = xScale.invert(mx);
                var bisect = d3.bisector(function (d) { return d.date; }).left;
                var idx    = bisect(data, date, 1);
                var d0     = data[idx - 1];
                var d1     = data[idx];
                var d      = !d1 ? d0 : !d0 ? d1
                    : (date - d0.date) < (d1.date - date) ? d0 : d1;
                if (!d) return;

                var fmt   = d3.timeFormat("%d %b %Y");
                var total = d.breakfastKcal + d.lunchKcal + d.dinnerKcal;

                tip.innerHTML =
                    "<span class='tip-date'>" + fmt(d.date) + "</span>" +
                    "<span class='tip-row'>" +
                        "<span class='tip-dot' style='background:var(--color-breakfast)'></span>" +
                        "breakfast: <strong>" + Math.round(d.breakfastKcal) + " kcal</strong>" +
                    "</span>" +
                    "<span class='tip-row'>" +
                        "<span class='tip-dot' style='background:var(--color-lunch)'></span>" +
                        "lunch: <strong>" + Math.round(d.lunchKcal) + " kcal</strong>" +
                    "</span>" +
                    "<span class='tip-row'>" +
                        "<span class='tip-dot' style='background:var(--color-dinner)'></span>" +
                        "dinner: <strong>" + Math.round(d.dinnerKcal) + " kcal</strong>" +
                    "</span>" +
                    "<span class='tip-row' style='border-top:1px solid var(--border);margin-top:3px;padding-top:3px'>" +
                        "total: <strong>" + Math.round(total) + " kcal</strong>" +
                    "</span>";

                tip.style.display = "block";
                tip.style.left    = (event.pageX + 14) + "px";
                tip.style.top     = (event.pageY - tip.offsetHeight - 10) + "px";

                // crosshair
                _svg.selectAll(".crosshair-meals").remove();
                _svg.append("line")
                    .attr("class",           "crosshair-meals")
                    .attr("x1", xScale(d.date)).attr("x2", xScale(d.date))
                    .attr("y1", 0).attr("y2", iH)
                    .attr("stroke",           "var(--text-secondary)")
                    .attr("stroke-width",     1)
                    .attr("stroke-dasharray", "3 3")
                    .attr("pointer-events",   "none");
            })
            .on("mouseleave", function () {
                tip.style.display = "none";
                _svg.selectAll(".crosshair-meals").remove();
            });
    }

    window.initMealsChart   = initMealsChart;
    window.updateMealsChart = updateMealsChart;

}());