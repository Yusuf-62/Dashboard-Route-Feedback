const chartInstances = {};
const chartColors = ["#d49a67", "#79a9d8", "#62c59b", "#b09be7", "#e58d83", "#79c6cd", "#e6bd73"];

function getChart(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  if (!chartInstances[id]) chartInstances[id] = echarts.init(el);
  return chartInstances[id];
}
function baseOption() {
  return {
    animationDuration: 650,
    textStyle: { fontFamily: "DM Sans, sans-serif", color: "#a9b7c3" },
    grid: { left: 42, right: 18, top: 22, bottom: 58, containLabel: true },
    tooltip: { trigger: "axis", backgroundColor: "#1b2a36", borderColor: "#3c5263", textStyle: { color: "#edf2f6", fontSize: 11 } },
    xAxis: { type: "category", axisLabel: { color: "#91a2b1", fontSize: 9, interval: 0, rotate: 0 }, axisLine: { lineStyle: { color: "#354653" } }, axisTick: { show: false } },
    yAxis: { type: "value", minInterval: 1, axisLabel: { color: "#8193a2", fontSize: 9 }, splitLine: { lineStyle: { color: "rgba(145,162,177,.12)", type: "dashed" } } },
    series: []
  };
}
function shortLabel(value, max = 16) { return value && value.length > max ? value.slice(0, max - 1) + "…" : value; }
function renderBar(id, rows, color = chartColors[0], horizontal = false, suffix = "") {
  const chart = getChart(id); if (!chart) return;
  const option = baseOption();
  option.grid = horizontal ? { left: 115, right: 30, top: 15, bottom: 20, containLabel: true } : { left: 38, right: 15, top: 20, bottom: 68, containLabel: true };
  if (horizontal) {
    option.xAxis = { type: "value", minInterval: 1, axisLabel: { color: "#91a2b1", fontSize: 9 }, splitLine: { lineStyle: { color: "rgba(145,162,177,.12)", type: "dashed" } } };
    option.yAxis = { type: "category", inverse: true, data: rows.map(x => x.name), axisLabel: { color: "#b7c3cc", fontSize: 9, width: 105, overflow: "truncate" }, axisLine: { show: false }, axisTick: { show: false } };
  } else {
    option.xAxis.data = rows.map(x => shortLabel(x.name, 13));
    option.xAxis.axisLabel.rotate = rows.length > 6 ? 22 : 0;
  }
  option.tooltip.formatter = params => `${params[0].name}<br/><b>${params[0].value}${suffix}</b>`;
  option.series = [{ type: "bar", data: rows.map(x => x.value), barMaxWidth: 28, itemStyle: { color, borderRadius: horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0] }, label: { show: true, position: horizontal ? "right" : "top", color: "#e6edf2", fontSize: 10, fontWeight: 700 } }];
  chart.setOption(option, true);
}
function renderReason(id, rows) {
  const chart = getChart(id); if (!chart) return;
  chart.setOption({
    animationDuration: 650,
    tooltip: { trigger: "item", backgroundColor: "#1b2a36", borderColor: "#3c5263", textStyle: { color: "#edf2f6" }, formatter: p => `${p.name}<br/><b>${p.value}</b> (${p.percent}%)` },
    legend: { bottom: 0, type: "scroll", textStyle: { color: "#91a2b1", fontSize: 9 }, pageTextStyle: { color: "#91a2b1" } },
    series: [{ type: "pie", radius: ["42%", "72%"], center: ["50%", "44%"], avoidLabelOverlap: true, itemStyle: { borderColor: "#131f2a", borderWidth: 3 }, label: { color: "#dce5eb", fontSize: 9, formatter: p => p.percent > 7 ? `${p.percent}%` : "" }, data: rows.map((r, i) => ({ name: r.name, value: r.value, itemStyle: { color: chartColors[i % chartColors.length] } })) }]
  }, true);
}
function renderDashboardCharts(data) {
  renderBar("lateChart", data.late.slice(0, 8), "#d49a67", true);
  renderBar("failedSalesChart", data.failedSales.slice(0, 8), "#d49a67", false);
  renderBar("underTwoChart", data.underTwo.slice(0, 8), "#79a9d8", true);
  renderReason("reasonChart", data.reasons.slice(0, 8));
  renderBar("effectiveChart", data.effective.slice(0, 8), "#62c59b", false);
  renderBar("pcChart", data.pc.slice(0, 10), "#b09be7", false, "%");
}
window.addEventListener("resize", () => Object.values(chartInstances).forEach(chart => chart.resize()));
window.RouteCharts = { renderDashboardCharts };
