(function () {

    var _svg      = null;
    var _dims     = null;
    var CONTAINER = "chart-activity-weight";
    var ROLL_WIN  = 7; // rolling-average window size

    /* init */
    function initActivityWeightChart() {
        var wrap = document.getElementById(CONTAINER);
        if (!wrap) return;
        wrap.innerHTML = "";

        var section   = document.getElementById("section-activity-weight");
        var wasHidden = !section.classList.contains("active");
        if (wasHidden) section.classList.add("active");
        var W = wrap.clientWidth || 900;
        if (wasHidden) section.classList.remove("active");

        var H      = 420;
        var margin = { top: 24, right: 68, bottom: 48, left: 68 };

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
            .attr("id", "clip-aw")
            .append("rect")
            .attr("width",  _dims.iW)
            .attr("height", _dims.iH);

        // static axis groups
        _svg.append("g").attr("class", "axis axis-x")
            .attr("transform", "translate(0," + _dims.iH + ")");
        _svg.append("g").attr("class", "axis axis-y-left");
        _svg.append("g").attr("class", "axis axis-y-right")
            .attr("transform", "translate(" + _dims.iW + ",0)");

        // axis labels
        _svg.append("text")
            .attr("class", "axis-label")
            .attr("transform", "rotate(-90)")
            .attr("x", -_dims.iH / 2).attr("y", -55)
            .attr("text-anchor", "middle")
            .text("activity (kcal burned)");

        _svg.append("text")
            .attr("class", "axis-label")
            .attr("transform", "rotate(90)")
            .attr("x", _dims.iH / 2).attr("y", -_dims.iW - 55)
            .attr("text-anchor", "middle")
            .text("weight (kg)");

        // legend
        var legend = _svg.append("g")
            .attr("class", "chart-legend")
            .attr("transform", "translate(" + (_dims.iW - 140) + ",-4)");

        var items = [
            { color: "var(--color-activity)", label: "activity" },
            { color: "var(--color-weight)",   label: "weight"   },
        ];

        items.forEach(function (d, i) {
            var g = legend.append("g").attr("transform", "translate(" + (i * 76) + ",0)");
            g.append("rect")
                .attr("width", 10).attr("height", 10)
                .attr("rx", 2).attr("y", -9)
                .attr("fill", d.color);
            g.append("text")
                .attr("x", 14).attr("y", 0)
                .attr("class", "legend-label")
                .text(d.label);
        });

        // tooltip (singleton)
        if (!document.getElementById("aw-tooltip")) {
            var tip = document.createElement("div");
            tip.id        = "aw-tooltip";
            tip.className = "dw-tooltip"; // reuse same tooltip styles
            document.body.appendChild(tip);
        }

        updateActivityWeightChart();
    }

    /* update */
    function updateActivityWeightChart() {
        if (!_svg) { initActivityWeightChart(); return; }

        var data = getFilteredData();
        var iW   = _dims.iW;
        var iH   = _dims.iH;

        /* rolling average of activityKcal */
        var rolled = data.map(function (d, i) {
            var start  = Math.max(0, i - ROLL_WIN + 1);
            var slice  = data.slice(start, i + 1);
            return {
                date:  d.date,
                value: d3.mean(slice, function (w) { return w.activityKcal; })
            };
        });

        /* weight points (only non-null) */
        var weightPts = data.filter(function (d) { return d.weight !== null; });

        /* scales */
        var xExt = d3.extent(data, function (d) { return d.date; });
        var xPad = data.length > 1
            ? (xExt[1] - xExt[0]) * 0.01
            : 86400000;
        var xScale = d3.scaleTime()
            .domain([new Date(xExt[0] - xPad), new Date(xExt[1] + xPad)])
            .range([0, iW]);

        // left axis — activity (0-based, always positive)
        var actMax = d3.max(data, function (d) { return d.activityKcal; }) || 500;
        actMax = Math.ceil(actMax / 100) * 100;
        var yAct = d3.scaleLinear()
            .domain([0, actMax])
            .range([iH, 0]);

        // right axis — weight
        var wExt = d3.extent(weightPts, function (d) { return d.weight; });
        var wPad = (wExt[1] - wExt[0]) * 0.15 || 2;
        var yW = weightPts.length
            ? d3.scaleLinear()
                .domain([wExt[0] - wPad, wExt[1] + wPad])
                .range([iH, 0])
            : null;

        /* zero line (baseline) */
        _svg.selectAll(".zero-line").remove();
        _svg.append("line")
            .attr("class", "zero-line")
            .attr("x1", 0).attr("x2", iW)
            .attr("y1", yAct(0)).attr("y2", yAct(0))
            .attr("stroke", "var(--border)")
            .attr("stroke-dasharray", "5 5");

        /* rolling average line */
        var lineAvg = d3.line()
            .x(function (d) { return xScale(d.date); })
            .y(function (d) { return yAct(d.value); })
            .curve(d3.curveCatmullRom.alpha(0.5));

        var avgPath = _svg.selectAll(".line-act-avg").data([rolled]);
        avgPath.enter().append("path")
            .attr("class", "line-act-avg")
            .attr("clip-path", "url(#clip-aw)")
            .attr("fill",   "none")
            .attr("stroke", "var(--color-activity)")
            .attr("stroke-width", 2)
            .attr("stroke-linejoin", "round")
            .merge(avgPath)
            .attr("d", lineAvg);

        _svg.selectAll(".line-act-avg").each(function () {
            var len = this.getTotalLength();
            d3.select(this)
                .attr("stroke-dasharray", len)
                .attr("stroke-dashoffset", len)
                .transition()
                .duration(1500)
                .ease(d3.easeQuadOut)
                .attr("stroke-dashoffset", 0);
        });

        avgPath.exit().remove();

        /* weight line */
        _svg.selectAll(".line-weight-aw").remove();

        if (yW && weightPts.length > 1) {
            var lineW = d3.line()
                .x(function (d) { return xScale(d.date); })
                .y(function (d) { return yW(d.weight); })
                .curve(d3.curveCatmullRom.alpha(0.5));

            _svg.append("path")
                .datum(weightPts)
                .attr("class", "line-weight-aw")
                .attr("clip-path", "url(#clip-aw)")
                .attr("fill",   "none")
                .attr("stroke", "var(--color-weight)")
                .attr("stroke-width", 2.5)
                .attr("d", lineW);

            var wNode = _svg.select(".line-weight-aw").node();
            if (wNode) {
                var wLen = wNode.getTotalLength();
                d3.select(wNode)
                    .attr("stroke-dasharray", wLen)
                    .attr("stroke-dashoffset", wLen)
                    .transition()
                    .duration(1500)
                    .ease(d3.easeQuadOut)
                    .attr("stroke-dashoffset", 0);
            }
        }

        /* axes */
        var tickCount = Math.max(3, Math.min(10, Math.floor(iW / 100)));

        _svg.select(".axis-x")
            .call(d3.axisBottom(xScale).ticks(tickCount).tickSizeOuter(0));

        _svg.select(".axis-y-left")
            .call(
                d3.axisLeft(yAct)
                    .ticks(6)
                    .tickSizeOuter(0)
                    .tickFormat(function (v) { return d3.format(".0f")(v); })
            );

        if (yW) {
            _svg.select(".axis-y-right")
                .call(
                    d3.axisRight(yW)
                        .ticks(5)
                        .tickSizeOuter(0)
                        .tickFormat(function (v) { return v + " kg"; })
                );
        } else {
            _svg.select(".axis-y-right").selectAll("*").remove();
        }

        _svg.selectAll(".axis text")
            .style("font-family", "'DM Mono', monospace")
            .style("font-size",   "11px")
            .style("fill",        "var(--text-secondary)");
        _svg.selectAll(".axis path, .axis line")
            .style("stroke", "var(--border)");

        /* tooltip overlay */
        _svg.selectAll(".overlay-aw").remove();

        var tip = document.getElementById("aw-tooltip");

        _svg.append("rect")
            .attr("class",  "overlay-aw")
            .attr("width",  iW)
            .attr("height", iH)
            .attr("fill",   "transparent")
            .on("mousemove", function (event) {
                var mx      = d3.pointer(event)[0];
                var date    = xScale.invert(mx);
                var bisect  = d3.bisector(function (d) { return d.date; }).left;
                var idx     = bisect(data, date, 1);
                var d0      = data[idx - 1];
                var d1      = data[idx];
                var d       = !d1 ? d0 : !d0 ? d1
                    : (date - d0.date) < (d1.date - date) ? d0 : d1;
                if (!d) return;

                var fmt = d3.timeFormat("%d %b %Y");

                var lastWeight = null;
                for (var i = 0; i < weightPts.length; i++) {
                    if (weightPts[i].date <= d.date) lastWeight = weightPts[i].weight;
                    else break;
                }
                var wVal = lastWeight !== null ? lastWeight + " kg" : "—";

                tip.innerHTML =
                    "<span class='tip-date'>" + fmt(d.date) + "</span>" +
                    "<span class='tip-row'>" +
                        "<span class='tip-dot' style='background:var(--color-activity)'></span>" +
                        "activity: <strong>" + Math.round(d.activityKcal) + " kcal</strong>" +
                    "</span>" +
                    "<span class='tip-row'>" +
                        "<span class='tip-dot' style='background:var(--color-weight)'></span>" +
                        "weight: <strong>" + wVal + "</strong>" +
                    "</span>";

                tip.style.display = "block";
                tip.style.left    = (event.pageX + 14) + "px";
                tip.style.top     = (event.pageY - tip.offsetHeight - 10) + "px";

                // crosshair
                _svg.selectAll(".crosshair-aw").remove();
                _svg.append("line")
                    .attr("class",           "crosshair-aw")
                    .attr("x1", xScale(d.date)).attr("x2", xScale(d.date))
                    .attr("y1", 0).attr("y2", iH)
                    .attr("stroke",           "var(--text-secondary)")
                    .attr("stroke-width",     1)
                    .attr("stroke-dasharray", "3 3")
                    .attr("pointer-events",   "none");
            })
            .on("mouseleave", function () {
                tip.style.display = "none";
                _svg.selectAll(".crosshair-aw").remove();
            });
    }

    // expose
    window.initActivityWeightChart   = initActivityWeightChart;
    window.updateActivityWeightChart = updateActivityWeightChart;

}());