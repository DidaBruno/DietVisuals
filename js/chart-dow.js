(function () {

    var _svg      = null;
    var _dims     = null;
    var CONTAINER = "chart-dow";

    var DOW_MAP = {
        "PON": "Mon", "UTO": "Tue", "SRI": "Wed",
        "ČET": "Thu", "PET": "Fri", "SUB": "Sat", "NED": "Sun"
    };

    var MEALS = [
        { key: "avgBreakfast", color: "var(--color-breakfast)", label: "breakfast" },
        { key: "avgLunch",     color: "var(--color-lunch)",     label: "lunch"     },
        { key: "avgDinner",    color: "var(--color-dinner)",    label: "dinner"    },
    ];

    /* ── init ─────────────────────────────────────────────────────── */
    function initDowChart() {
        var wrap = document.getElementById(CONTAINER);
        if (!wrap) return;
        wrap.innerHTML = "";

        var section   = document.getElementById("section-dow");
        var wasHidden = !section.classList.contains("active");
        if (wasHidden) section.classList.add("active");
        var W = Math.min(wrap.clientWidth || 900, 600);
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
            .attr("id", "clip-dow")
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
            .text("avg intake (kcal)");

        // legend
        var legend = _svg.append("g")
            .attr("class", "chart-legend")
            .attr("transform", "translate(" + (_dims.iW - 200) + ",-4)");

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
        if (!document.getElementById("dow-tooltip")) {
            var tip = document.createElement("div");
            tip.id        = "dow-tooltip";
            tip.className = "dw-tooltip";
            document.body.appendChild(tip);
        }

        updateDowChart();
    }

    /* ── update ───────────────────────────────────────────────────── */
    function updateDowChart() {
        if (!_svg) { initDowChart(); return; }

        var filtered = getFilteredData();
        var data     = groupByDow(filtered);
        var iW       = _dims.iW;
        var iH       = _dims.iH;

        /* stack */
        var stack = d3.stack()
            .keys(["avgBreakfast", "avgLunch", "avgDinner"]);

        var series = stack(data);

        /* scales */
        var days = data.map(function (d) { return DOW_MAP[d.dow] || d.dow; });

        var xScale = d3.scaleBand()
            .domain(days)
            .range([0, iW])
            .padding(0.3);

        var yMax = d3.max(data, function (d) {
            return d.avgBreakfast + d.avgLunch + d.avgDinner;
        }) || 3000;
        yMax = Math.ceil(yMax / 200) * 200;

        var yScale = d3.scaleLinear()
            .domain([0, yMax])
            .range([iH, 0]);

        /* bars */
        _svg.selectAll(".dow-layer").remove();

        var MEAL_DELAY = 500;

        series.forEach(function (layer, i) {
            var meal = MEALS[i];

            _svg.append("g")
                .attr("class", "dow-layer")
                .attr("clip-path", "url(#clip-dow)")
                .selectAll("rect")
                .data(layer)
                .enter()
                .append("rect")
                .attr("x",     function (d) { return xScale(DOW_MAP[d.data.dow] || d.data.dow); })
                .attr("width", xScale.bandwidth())
                .attr("fill",  meal.color)
                .attr("opacity", 0.85)
                .attr("rx", 2)
                // start collapsed at bottom of previous layer
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
        _svg.select(".axis-x")
            .call(d3.axisBottom(xScale).tickSizeOuter(0));

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
        _svg.selectAll(".overlay-dow").remove();

        var tip = document.getElementById("dow-tooltip");

        _svg.append("rect")
            .attr("class",  "overlay-dow")
            .attr("width",  iW)
            .attr("height", iH)
            .attr("fill",   "transparent")
            .on("mousemove", function (event) {
                var mx       = d3.pointer(event)[0];
                // find closest bar by bandwidth center
                var closest  = null;
                var minDist  = Infinity;
                data.forEach(function (d) {
                    var label = DOW_MAP[d.dow] || d.dow;
                    var cx    = xScale(label) + xScale.bandwidth() / 2;
                    var dist  = Math.abs(mx - cx);
                    if (dist < minDist) { minDist = dist; closest = d; }
                });
                if (!closest) return;

                var label = DOW_MAP[closest.dow] || closest.dow;
                var total = closest.avgBreakfast + closest.avgLunch + closest.avgDinner;

                tip.innerHTML =
                    "<span class='tip-date'>" + label + "</span>" +
                    "<span class='tip-row'>" +
                        "<span class='tip-dot' style='background:var(--color-breakfast)'></span>" +
                        "breakfast: <strong>" + Math.round(closest.avgBreakfast) + " kcal</strong>" +
                    "</span>" +
                    "<span class='tip-row'>" +
                        "<span class='tip-dot' style='background:var(--color-lunch)'></span>" +
                        "lunch: <strong>" + Math.round(closest.avgLunch) + " kcal</strong>" +
                    "</span>" +
                    "<span class='tip-row'>" +
                        "<span class='tip-dot' style='background:var(--color-dinner)'></span>" +
                        "dinner: <strong>" + Math.round(closest.avgDinner) + " kcal</strong>" +
                    "</span>" +
                    "<span class='tip-row' style='border-top:1px solid var(--border);margin-top:3px;padding-top:3px'>" +
                        "avg total: <strong>" + Math.round(total) + " kcal</strong>" +
                    "</span>";

                tip.style.display = "block";
                tip.style.left    = (event.pageX + 14) + "px";
                tip.style.top     = (event.pageY - tip.offsetHeight - 10) + "px";

                // crosshair
                _svg.selectAll(".crosshair-dow").remove();
                var bx = xScale(label) + xScale.bandwidth() / 2;
                _svg.append("line")
                    .attr("class",           "crosshair-dow")
                    .attr("x1", bx).attr("x2", bx)
                    .attr("y1", 0).attr("y2", iH)
                    .attr("stroke",           "var(--text-secondary)")
                    .attr("stroke-width",     1)
                    .attr("stroke-dasharray", "3 3")
                    .attr("pointer-events",   "none");
            })
            .on("mouseleave", function () {
                tip.style.display = "none";
                _svg.selectAll(".crosshair-dow").remove();
            });
    }

    window.initDowChart   = initDowChart;
    window.updateDowChart = updateDowChart;

}());