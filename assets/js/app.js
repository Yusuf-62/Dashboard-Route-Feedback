const state = {
  allRows: [], filteredRows: [], days: [],
  selected: { day: new Set(), depo: new Set(), sales: new Set(), tipe: new Set() },
  page: 1, pageSize: 12
};
const $ = id => document.getElementById(id);
const fmtNumber = value => Number.isFinite(value) ? new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(value)) : "—";
const safe = value => value == null ? "" : String(value);
const unique = values => [...new Set(values.filter(v => v !== null && v !== undefined && String(v).trim() !== ""))];
const avg = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const number = value => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value == null || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};
function timeToSeconds(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Math.round(value * 86400);
  const parts = String(value).trim().split(":").map(Number);
  if (parts.length < 2 || parts.some(v => !Number.isFinite(v))) return null;
  return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
}
function secondsToTime(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const total = Math.round(seconds), h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  return [h, m, s].map(v => String(v).padStart(2, "0")).join(":");
}
function norm(value) { return safe(value).trim().toLowerCase(); }

function buildFilterMenus() {
  const defs = [
    ["day", "Day", [...state.days].sort((a,b)=>a-b)],
    ["depo", "Depo", unique(state.allRows.map(r=>r.Depo)).sort()],
    ["sales", "Sales", unique(state.allRows.map(r=>r.Sales)).sort()],
    ["tipe", "Tipe Sales", unique(state.allRows.map(r=>r["Tipe Sales"])).sort()]
  ];
  defs.forEach(([key, label, values]) => {
    const root = document.querySelector(`.multi-select[data-filter="${key}"]`);
    const menu = root.querySelector(".multi-menu");
    menu.innerHTML = `<label class="multi-option"><input type="checkbox" data-select-all="${key}"> <b>Pilih semua</b></label>` +
      values.map(value => `<label class="multi-option"><input type="checkbox" value="${String(value).replace(/"/g, "&quot;")}" data-filter-value="${key}"> ${String(value)}</label>`).join("");
    menu.querySelectorAll(`[data-filter-value="${key}"]`).forEach(input => {
      input.addEventListener("change", () => {
        if (input.checked) state.selected[key].add(input.value); else state.selected[key].delete(input.value);
        updateTrigger(key, label); applyFilters();
      });
    });
    menu.querySelector(`[data-select-all="${key}"]`).addEventListener("change", event => {
      const checked = event.target.checked;
      menu.querySelectorAll(`[data-filter-value="${key}"]`).forEach(input => { input.checked = checked; if (checked) state.selected[key].add(input.value); else state.selected[key].delete(input.value); });
      updateTrigger(key, label); applyFilters();
    });
    root.querySelector(".multi-trigger").addEventListener("click", event => {
      event.stopPropagation();
      document.querySelectorAll(".multi-select").forEach(other => { if (other !== root) other.classList.remove("open"); });
      root.classList.toggle("open");
    });
    updateTrigger(key, label);
  });
  document.addEventListener("click", () => document.querySelectorAll(".multi-select").forEach(x => x.classList.remove("open")));
}
function updateTrigger(key, label) {
  const root = document.querySelector(`.multi-select[data-filter="${key}"]`);
  const values = state.selected[key];
  root.querySelector(".trigger-text").textContent = values.size ? `${values.size} dipilih` : `Semua ${label.toLowerCase()}`;
}
function applyFilters() {
  state.filteredRows = state.allRows.filter(row =>
    (!state.selected.day.size || state.selected.day.has(String(Number(row.Day)))) &&
    (!state.selected.depo.size || state.selected.depo.has(safe(row.Depo))) &&
    (!state.selected.sales.size || state.selected.sales.has(safe(row.Sales))) &&
    (!state.selected.tipe.size || state.selected.tipe.has(safe(row["Tipe Sales"])))
  );
  state.page = 1;
  renderAll();
}
function groupCount(rows, key, predicate = () => true) {
  const map = new Map();
  rows.filter(predicate).forEach(row => { const name = safe(row[key]) || "(Kosong)"; map.set(name, (map.get(name) || 0) + 1); });
  return [...map].map(([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value);
}
function groupAverage(rows, groupKey, valueKey, predicate = () => true) {
  const map = new Map();
  rows.filter(predicate).forEach(row => {
    const value = number(row[valueKey]); if (value == null) return;
    const name = safe(row[groupKey]) || "(Kosong)";
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(value);
  });
  return [...map].map(([name, values]) => ({ name, value: avg(values) })).sort((a,b)=>b.value-a.value);
}
function aggregate(rows) {
  const success = rows.filter(r => norm(r["Alasan 2"]) === "sukses");
  const failed = rows.filter(r => norm(r["Alasan 2"]) === "gagal");

  // Ambil Waktu Mulai paling awal per Sales + Tanggal.
  // Status 1st Outlet bisa berulang di setiap kunjungan, jadi hitung satu kali per hari.
  const dailySales = new Map();
  rows.forEach(r => {
    const sales = safe(r.Sales) || "(Kosong)";
    const dayKey = `${safe(r.Tanggal)}|${safe(r.Day)}`;
    const key = `${sales}|||${dayKey}`;
    if (!dailySales.has(key)) dailySales.set(key, { name: sales, rows: [] });
    dailySales.get(key).rows.push(r);
  });
  const dailyFirstOutlets = [...dailySales.values()].map(group => {
    const first = group.rows
      .map(r => ({ seconds: timeToSeconds(r["Waktu Mulai"]) }))
      .filter(x => x.seconds != null)
      .sort((a,b) => a.seconds - b.seconds)[0];
    return {
      name: group.name,
      firstTime: first ? first.seconds : null,
      isLate: group.rows.some(r => norm(r["Status 1st Outlet"]) === "terlambat")
    };
  });
  const firstOutletSeconds = dailyFirstOutlets.map(x => x.firstTime).filter(v => v != null);
  const bySalesLate = new Map();
  dailyFirstOutlets.forEach(item => {
    if (!bySalesLate.has(item.name)) bySalesLate.set(item.name, { name: item.name, times: [], lateCount: 0 });
    const current = bySalesLate.get(item.name);
    if (item.firstTime != null) current.times.push(item.firstTime);
    if (item.isLate) current.lateCount += 1;
  });
  const lateSales = [...bySalesLate.values()].map(item => ({
    name: item.name, avgTime: avg(item.times), lateCount: item.lateCount
  })).filter(x => x.lateCount > 0)
    .sort((a,b) => b.lateCount - a.lateCount || (b.avgTime || 0) - (a.avgTime || 0));

  const successfulDurations = success.map(r => timeToSeconds(r.Durasi)).filter(v => v != null);
  const successfulEC = success.map(r => number(r.EC)).filter(v => v != null);
  const sku = rows.map(r => number(r["SKU/faktur"])).filter(v => v != null);
  const averageECAll = avg(rows.map(r => number(r.EC)).filter(v => v != null));
  const countCustId = rows.filter(r => safe(r.szCustId).trim() !== "").length;
  const outOfRoute = Math.max(0, (averageECAll ?? 0) - countCustId);

  const failedSales = groupCount(rows, "Sales", r => norm(r["Alasan 2"]) === "gagal");
  const underTwo = groupCount(rows, "Sales", r => number(r["Kurang 2 Menit"]) > 0)
    .map(item => ({ name: item.name, value: rows.filter(r => safe(r.Sales) === item.name).reduce((sum, r) => sum + (number(r["Kurang 2 Menit"]) || 0), 0) }))
    .sort((a,b)=>b.value-a.value);
  const reasons = groupCount(failed, "Alasan");
  const effective = groupAverage(success, "Sales", "EC").map(x => ({ ...x, value: Math.round(x.value) }));
  const pc = groupAverage(rows, "Tipe Sales", "%PC").map(x => ({ ...x, value: Math.round(x.value * 100) }));

  return {
    jks: countCustId,
    success: success.length,
    failed: failed.length,
    firstOutlet: avg(firstOutletSeconds),
    duration: avg(successfulDurations),
    effectiveCall: avg(successfulEC),
    sku: avg(sku),
    outOfRoute,
    lateSales, failedSales, underTwo, reasons, effective, pc
  };
}
function renderKPIs(rows) {
  const a = aggregate(rows);
  $("kpiFirstOutlet").textContent = secondsToTime(a.firstOutlet);
  $("kpiJks").textContent = fmtNumber(a.jks);
  $("kpiOutRoute").textContent = fmtNumber(a.outOfRoute);
  $("kpiDuration").textContent = secondsToTime(a.duration);
  $("kpiSuccess").textContent = fmtNumber(a.success);
  $("kpiFailed").textContent = fmtNumber(a.failed);
  $("kpiEffective").textContent = fmtNumber(a.effectiveCall);
  $("kpiSku").textContent = fmtNumber(a.sku);
  const selectedDayCount = state.selected.day.size;
  const useList = selectedDayCount > 1 || selectedDayCount === 0;
  if (useList) {
    $("lateChart").hidden = true;
    $("lateList").hidden = false;
    renderLateList(a.lateSales);
  } else {
    $("lateList").hidden = true;
    $("lateChart").hidden = false;
    requestAnimationFrame(() => window.RouteCharts.renderLateChart(a.lateSales));
  }
  window.RouteCharts.renderDashboardCharts(a);
}
function renderLateList(items) {
  const host = $("lateList");
  if (!items.length) {
    host.innerHTML = `<div class="late-empty">Tidak ada salesman terlambat pada filter ini.</div>`;
    return;
  }
  host.innerHTML = `<div class="late-list-head"><span>Nama Salesman</span><span>Avg 1st Outlet</span><span>Terlambat</span></div>` +
    items.map(item => `<div class="late-list-row"><span class="late-sales-name" title="${item.name}">${item.name}</span><strong>${secondsToTime(item.avgTime)}</strong><b>${item.lateCount}×</b></div>`).join("");
}
function renderTableRows() {
  const query = norm($("tableSearch").value);
  const rows = state.filteredRows.filter(r => [r.Sales,r.Depo,r.Customer,r.Alasan,r["Alasan 2"]].some(v => norm(v).includes(query)));
  const total = rows.length, pages = Math.max(1, Math.ceil(total / state.pageSize));
  state.page = Math.min(state.page, pages);
  const start = (state.page - 1) * state.pageSize;
  const pageRows = rows.slice(start, start + state.pageSize);
  $("dataTableBody").innerHTML = pageRows.length ? pageRows.map(r => `<tr>
    <td>${safe(r.Day)}</td><td>${safe(r.Depo)}</td><td>${safe(r.Sales)}</td><td>${safe(r.Customer)}</td>
    <td>${safe(r["Waktu Mulai"])}</td><td>${safe(r.Durasi)}</td><td>${safe(r.Alasan)}</td>
    <td><span class="status-pill ${norm(r["Alasan 2"]) === "gagal" ? "failed" : ""}">${safe(r["Alasan 2"])}</span></td>
    <td>${fmtNumber(number(r.EC))}</td><td>${number(r["%PC"]) == null ? "—" : Math.round(number(r["%PC"]) * 100) + "%"}</td>
  </tr>`).join("") : `<tr><td colspan="10" class="empty-cell">Tidak ada data yang cocok.</td></tr>`;
  $("rowCount").textContent = `${fmtNumber(total)} baris`;
  $("tablePageInfo").textContent = total ? `Menampilkan ${start + 1}–${Math.min(start + state.pageSize, total)} dari ${fmtNumber(total)} baris` : "Tidak ada data";
  $("prevPage").disabled = state.page <= 1;
  $("nextPage").disabled = state.page >= pages;
}
function renderAll() {
  renderKPIs(state.filteredRows);
  renderTableRows();
  $("detailSummary").textContent = `${fmtNumber(state.filteredRows.length)} baris`;
  const selectedCount = Object.values(state.selected).reduce((sum, set) => sum + set.size, 0);
  $("activeFilterNote").textContent = selectedCount ? `${selectedCount} filter aktif · ${fmtNumber(state.filteredRows.length)} baris` : "Semua data";
}
function setView(view) {
  const dashboard = view === "dashboard";
  $("dashboardView").classList.toggle("active", dashboard);
  $("detailsView").classList.toggle("active", !dashboard);
  document.querySelectorAll(".nav-item").forEach(btn => btn.classList.toggle("active", btn.dataset.view === view));
  if (!dashboard) renderTableRows();
  setTimeout(() => window.dispatchEvent(new Event("resize")), 60);
}
function bindUI() {
  const on = (id, event, handler) => {
    const element = $(id);
    if (element) element.addEventListener(event, handler);
  };

  on("resetFilters", "click", () => {
    Object.values(state.selected).forEach(set => set.clear());
    document.querySelectorAll(".multi-menu input").forEach(input => input.checked = false);
    ["day","depo","sales","tipe"].forEach((key,i)=>updateTrigger(key,["Day","Depo","Sales","Tipe Sales"][i]));
    applyFilters();
  });

  on("tableSearch", "input", renderTableRows);
  on("prevPage", "click", () => { state.page--; renderTableRows(); });
  on("nextPage", "click", () => { state.page++; renderTableRows(); });

  on("sidebarToggle", "click", () => {
    if (window.matchMedia("(max-width: 850px)").matches) {
      $("sidebar")?.classList.toggle("open");
    } else {
      document.body.classList.toggle("sidebar-hidden");
    }
  });

  on("sidebarClose", "click", () => {
    if (window.matchMedia("(max-width: 850px)").matches) {
      $("sidebar")?.classList.remove("open");
    } else {
      document.body.classList.add("sidebar-hidden");
    }
  });

  document.querySelectorAll(".nav-item").forEach(btn => btn.addEventListener("click", () => {
    setView(btn.dataset.view);
    if (window.matchMedia("(max-width: 850px)").matches) $("sidebar")?.classList.remove("open");
  }));
}
async function initDashboard() {
  $("loadingScreen").classList.remove("hidden");
  $("connectionStatus").textContent = "Menghubungkan data";
  $("statusBanner").hidden = true;
  try {
    const result = await window.RouteData.loadAllDayData();
    state.allRows = result.rows;
    state.filteredRows = result.rows;
    state.days = [...new Set(result.rows.map(r => Number(r.Day)).filter(Number.isFinite))].sort((a,b)=>a-b);
    buildFilterMenus();
    renderAll();
    $("connectionStatus").textContent = `${fmtNumber(state.allRows.length)} baris dimuat`;
    if (result.failed.length) {
      $("statusBanner").hidden = false;
      $("statusBanner").textContent = `Sebagian file tidak berhasil dimuat: ${result.failed.join(" · ")}`;
    }
  } catch (error) {
    $("connectionStatus").textContent = "Gagal memuat data";
    $("statusBanner").hidden = false;
    $("statusBanner").textContent = error.message;
    $("dataTableBody").innerHTML = `<tr><td colspan="10" class="empty-cell">Data tidak dapat dimuat. Periksa repository dan koneksi internet.</td></tr>`;
  } finally {
    $("loadingScreen").classList.add("hidden");
    if (window.lucide) lucide.createIcons();
  }
}
document.addEventListener("DOMContentLoaded", () => {
  try { bindUI(); } catch (error) { console.error("UI initialization error:", error); }
  initDashboard();
  if (window.lucide) {
    try { lucide.createIcons(); } catch (error) { console.warn("Icon rendering skipped:", error); }
  }
});
