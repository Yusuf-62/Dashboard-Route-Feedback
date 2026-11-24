const state = {
  allRows: [], filteredRows: [], days: [],
  selected: { day: new Set(), depo: new Set(), sales: new Set(), tipe: new Set() },
  page: 1, pageSize: 12
};
const $ = id => document.getElementById(id);
const fmtNumber = value => Number.isFinite(value) ? new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value) : "—";
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
  // First outlet is identified by Kunjungan = 1; average its actual Waktu Mulai.
  const firstOutlet = rows
    .filter(r => Number(r.Kunjungan) === 1)
    .map(r => timeToSeconds(r["Waktu Mulai"]))
    .filter(v => v != null);
  const successfulDurations = success.map(r => timeToSeconds(r.Durasi)).filter(v => v != null);
  const successfulEC = success.map(r => number(r.EC)).filter(v => v != null);
  const sku = rows.map(r => number(r["SKU/faktur"])).filter(v => v != null);
  const averageECAll = avg(rows.map(r => number(r.EC)).filter(v => v != null));
  const countCustId = rows.filter(r => safe(r.szCustId).trim() !== "").length;

  // Out of Route mengikuti formula Excel: MAX(0, Average EC - Count szCustId).
  const outOfRoute = Math.max(0, (averageECAll ?? 0) - countCustId);

  // Status 1st Outlet repeats on every visit row; count only the first visit per Sales.
  const late = groupCount(
    rows,
    "Sales",
    r => Number(r.Kunjungan) === 1 && norm(r["Status 1st Outlet"]) === "terlambat"
  );
  const failedSales = groupCount(rows, "Sales", r => norm(r["Alasan 2"]) === "gagal");
  const underTwo = groupCount(rows, "Sales", r => number(r["Kurang 2 Menit"]) > 0)
    .map(item => ({ name: item.name, value: rows.filter(r => safe(r.Sales) === item.name).reduce((sum, r) => sum + (number(r["Kurang 2 Menit"]) || 0), 0) }))
    .sort((a,b)=>b.value-a.value);
  const reasons = groupCount(failed, "Alasan");
  const effective = groupAverage(success, "Sales", "EC");
  const pc = groupAverage(rows, "Tipe Sales", "%PC").map(x => ({ ...x, value: x.value * 100 }));

  return {
    jks: countCustId,
    success: success.length,
    failed: failed.length,
    firstOutlet: avg(firstOutlet),
    duration: avg(successfulDurations),
    effectiveCall: avg(successfulEC),
    sku: avg(sku),
    outOfRoute,
    late, failedSales, underTwo, reasons, effective, pc
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
  window.RouteCharts.renderDashboardCharts(a);
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
    <td>${fmtNumber(number(r.EC))}</td><td>${number(r["%PC"]) == null ? "—" : (number(r["%PC"]) * 100).toFixed(1) + "%"}</td>
  </tr>`).join("") : `<tr><td colspan="10" class="empty-cell">Tidak ada data yang cocok.</td></tr>`;
  $("rowCount").textContent = `${fmtNumber(total)} baris`;
  $("tablePageInfo").textContent = total ? `Menampilkan ${start + 1}–${Math.min(start + state.pageSize, total)} dari ${fmtNumber(total)} baris` : "Tidak ada data";
  $("prevPage").disabled = state.page <= 1;
  $("nextPage").disabled = state.page >= pages;
}
function renderAll() {
  renderKPIs(state.filteredRows);
  renderTableRows();
  const selectedCount = Object.values(state.selected).reduce((sum, set) => sum + set.size, 0);
  $("activeFilterNote").textContent = selectedCount ? `${selectedCount} filter aktif · ${fmtNumber(state.filteredRows.length)} baris` : "Semua data";
}
function bindUI() {
  $("resetFilters").addEventListener("click", () => {
    Object.values(state.selected).forEach(set => set.clear());
    document.querySelectorAll(".multi-menu input").forEach(input => input.checked = false);
    ["day","depo","sales","tipe"].forEach((key,i)=>updateTrigger(key,["Day","Depo","Sales","Tipe Sales"][i]));
    applyFilters();
  });
  $("tableSearch").addEventListener("input", renderTableRows);
  $("prevPage").addEventListener("click", () => { state.page--; renderTableRows(); });
  $("nextPage").addEventListener("click", () => { state.page++; renderTableRows(); });
  $("refreshData").addEventListener("click", initDashboard);
  $("mobileMenu").addEventListener("click", () => $("sidebar").classList.toggle("open"));
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
    $("lastUpdated").textContent = `Data diperbarui ${new Date().toLocaleString("id-ID")}`;
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
document.addEventListener("DOMContentLoaded", () => { bindUI(); initDashboard(); if (window.lucide) lucide.createIcons(); });
