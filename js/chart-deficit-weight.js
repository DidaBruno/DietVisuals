
(function () {

    var _svg        = null;
    var _dims       = null;
    var CONTAINER   = "chart-deficit-weight";
    var ROLL_WIN    = 7; // rolling-average window size

    /* init */
    function initDeficitWeightChart() {
        var wrap = document.getElementById(CONTAINER);
        if (!wrap) return;
        wrap.innerHTML = ""; // clear the container so if init is called again it doesn't render twice

        var section = document.getElementById("section-deficit-weight");
        var wasHidden = section.style.display === "none" || !section.classList.contains("active");
        if (wasHidden) section.classList.add("active");
        var W = wrap.clientWidth || 900;
        if (wasHidden) section.classList.remove("active");
        var H = 420;
        var margin = { top: 24, right: 68, bottom: 48, left: 68 };

        _dims = {
            W: W, H: H,
            iW: W - margin.left - margin.right,
            iH: H - margin.top  - margin.bottom,
            margin: margin
        };

        // svg
        _svg = d3.select("#" + CONTAINER)
            .append("svg")
            .attr("width",  W)
            .attr("height", H)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        // clip path so bars/lines don't bleed outside the plot area
        _svg.append("defs").append("clipPath")
            .attr("id", "clip-dw")
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
            .text("deficit / surplus (kcal)");

        _svg.append("text")
            .attr("class", "axis-label")
            .attr("transform", "rotate(90)")
            .attr("x", _dims.iH / 2).attr("y", -_dims.iW - 55)
            .attr("text-anchor", "middle")
            .text("weight (kg)");

        // legend
        var legend = _svg.append("g")
            .attr("class", "chart-legend")
            .attr("transform", "translate(" + (_dims.iW - 130) + ",-4)");

        var items = [
            { color: "var(--color-deficit)", label: "deficit" },
            { color: "var(--color-weight)", label: "weight" },
        ];

        items.forEach(function (d, i) {
            var g = legend.append("g").attr("transform", "translate(" + (i * 70) + ",0)");
            g.append("rect")
                .attr("width", 10).attr("height", 10)
                .attr("rx", 2).attr("y", -9)
                .attr("fill", d.color);
            g.append("text")
                .attr("x", 14).attr("y", 0)
                .attr("class", "legend-label")
                .text(d.label);
        });

        // tooltip - make sure there is only one tooltip
        // because init could be called multiple times
        if (!document.getElementById("dw-tooltip")) {
            var tip = document.createElement("div");
            tip.id = "dw-tooltip";
            tip.className = "dw-tooltip";
            document.body.appendChild(tip);
        }

        updateDeficitWeightChart();
    }


    /*  update  */
    function updateDeficitWeightChart() {
        if (!_svg) { initDeficitWeightChart(); return; }

        var data   = getFilteredData();
        var m      = _dims.margin;
        var iW     = _dims.iW;
        var iH     = _dims.iH;

        /* rolling average */
        var rolled = data.map(function (d, i) {
            var start  = Math.max(0, i - ROLL_WIN + 1);
            var window = data.slice(start, i + 1);
            return {
                date:  d.date,
                value: d3.mean(window, function (w) { return w.deficit; })
            };
        });

        /* weight points (only non-null) */
        var weightPts = data.filter(function (d) { return d.weight !== null; });

        /* scales */
        var xExt = d3.extent(data, function (d) { return d.date; });

        // pad x slightly so first/last bars aren't clipped
        var xPad = data.length > 1
            ? (xExt[1] - xExt[0]) * 0.01
            : 86400000;
        var xScale = d3.scaleTime()
            .domain([new Date(xExt[0] - xPad), new Date(xExt[1] + xPad)])
            .range([0, iW]);

        // left axis — deficit (symmetric around 0)
        var defMax = d3.max(data, function (d) { return Math.abs(d.deficit); }) || 1000;
        defMax = Math.ceil(defMax / 200) * 200;
        var yDef = d3.scaleLinear()
            .domain([-defMax, defMax])
            .range([iH, 0]);

        // right axis — weight
        var wExt = d3.extent(weightPts, function (d) { return d.weight; });
        var wPad = (wExt[1] - wExt[0]) * 0.15 || 2;
        var yW = weightPts.length
            ? d3.scaleLinear()
                .domain([wExt[0] - wPad, wExt[1] + wPad])
                .range([iH, 0])
            : null;

        /* draw - zero line */
        _svg.selectAll(".zero-line").remove();
        _svg.append("line")
            .attr("class", "zero-line")
            .attr("x1", 0).attr("x2", iW)
            .attr("y1", yDef(0)).attr("y2", yDef(0))
            .attr("stroke", "var(--border)")
            .attr("stroke-dasharray", "5 5");

        /* draw - rolling average line */
        var lineAvg = d3.line()
            .x(function (d) { return xScale(d.date); })
            .y(function (d) { return yDef(d.value); })
            // makes a smooth curve instead of straight point to point
            .curve(d3.curveCatmullRom.alpha(0.5));

        var avgPath = _svg.selectAll(".line-avg").data([rolled]);
        avgPath.enter().append("path")
            .attr("class", "line-avg")
            .attr("clip-path", "url(#clip-dw)")
            .attr("fill", "none")
            .attr("stroke", "var(--dw-avg)")
            .attr("stroke-width", 2)
            .attr("stroke-linejoin", "round")
            .merge(avgPath)
            .attr("d", lineAvg);

        _svg.selectAll(".line-avg").each(function() {
            var len = this.getTotalLength();
            d3.select(this)
                .attr("stroke-dasharray", len)
                .attr("stroke-dashoffset", len)
                .transition()
                .duration(1500)
                .ease(d3.easeQuadOut)
                .attr("stroke-dashoffset", 0);
        })

        avgPath.exit().remove();

        /* draw - weight line */
        _svg.selectAll(".line-weight").remove();

        if (yW && weightPts.length > 1) {
            var lineW = d3.line()
                .x(function (d) { return xScale(d.date); })
                .y(function (d) { return yW(d.weight); })
                .curve(d3.curveCatmullRom.alpha(0.5));

            _svg.append("path")
                .datum(weightPts)
                .attr("class", "line-weight")
                .attr("clip-path", "url(#clip-dw)")
                .attr("fill", "none")
                .attr("stroke", "var(--color-weight)")
                .attr("stroke-width", 2.5)
                .attr("d", lineW);
        }

        var wLen = _svg.select(".line-weight").node().getTotalLength();
        _svg.select(".line-weight")
            .attr("stroke-dasharray", wLen)
            .attr("stroke-dashoffset", wLen)
            .transition()
            .duration(1500)
            .ease(d3.easeQuadOut)
            .attr("stroke-dashoffset", 0);

        /* draw - axes */
        var tickCount = Math.max(3, Math.min(10, Math.floor(iW / 100)));

        _svg.select(".axis-x")
            .call(d3.axisBottom(xScale).ticks(tickCount).tickSizeOuter(0));

        _svg.select(".axis-y-left")
            .call(
                d3.axisLeft(yDef)
                    .ticks(6)
                    .tickSizeOuter(0)
                    .tickFormat(function (v) {
                        return (v >= 0 && v != 0 ? "+" : "") + d3.format(".0f")(v);
                    })
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

        // style all axis text
        _svg.selectAll(".axis text")
            .style("font-family", "'DM Mono', monospace")
            .style("font-size", "11px")
            .style("fill", "var(--text-secondary)");
        _svg.selectAll(".axis path, .axis line")
            .style("stroke", "var(--border)");

        /* tooltip overlay */
        _svg.selectAll(".overlay-dw").remove();

        var tip = document.getElementById("dw-tooltip");

        _svg.append("rect")
            .attr("class", "overlay-dw")
            .attr("width",  iW)
            .attr("height", iH)
            .attr("fill",   "transparent")
            .on("mousemove", (event) => {
                var mx = d3.pointer(event)[0];
                var date = xScale.invert(mx);
                var bisect = d3.bisector(function (d) { return d.date; }).left;
                var idx    = bisect(data, date, 1);
                var d0     = data[idx - 1];
                var d1     = data[idx];
                var d      = !d1 ? d0 : !d0 ? d1
                    : (date - d0.date) < (d1.date - date) ? d0 : d1;
                if (!d) return;

                var fmt     = d3.timeFormat("%d %b %Y");
                var defSign = d.deficit >= 0 ? "+" : "";

                var lastWeight = null;
                for (var i = 0; i < weightPts.length; i++) {
                    if (weightPts[i].date <= d.date) lastWeight = weightPts[i].weight;
                    else break;
                }
                var wVal = lastWeight !== null ? lastWeight + " kg" : "—";

                tip.innerHTML =
                    "<span class='tip-date'>" + fmt(d.date) + "</span>" +
                    "<span class='tip-row'>" +
                        "<span class='tip-dot' style='background:var(--dw-avg)'></span>" +
                        "deficit: <strong>" + defSign + Math.round(d.deficit) + " kcal</strong>" +
                    "</span>" +
                    "<span class='tip-row'>" +
                        "<span class='tip-dot' style='background:var(--color-weight)'></span>" +
                        "weight: <strong>" + wVal + "</strong>" +
                    "</span>";

                tip.style.display = "block";
                tip.style.left = (event.pageX + 14) + "px";
                tip.style.top  = (event.pageY - tip.offsetHeight - 10) + "px";

                // crosshair
                _svg.selectAll(".crosshair-dw").remove();
                _svg.append("line")
                    .attr("class", "crosshair-dw")
                    .attr("x1", xScale(d.date)).attr("x2", xScale(d.date))
                    .attr("y1", 0).attr("y2", iH)
                    .attr("stroke", "var(--text-secondary)")
                    .attr("stroke-width", 1)
                    .attr("stroke-dasharray", "3 3")
                    .attr("pointer-events", "none");
            })
            .on("mouseleave", () => {
                tip.style.display = "none";
                _svg.selectAll(".crosshair-dw").remove();
            });
    }

    // expose
    window.initDeficitWeightChart   = initDeficitWeightChart;
    window.updateDeficitWeightChart = updateDeficitWeightChart;

}());