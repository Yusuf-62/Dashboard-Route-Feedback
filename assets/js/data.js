// GitHub JSON loader. Public repository listing is read through GitHub Contents API.
const DATA_CONFIG = {
  owner: "Yusuf-62",
  repo: "Dashboard-Route-Feedback",
  branch: "main",
  folder: "data",
  // Optional: set a list here if you prefer not to use GitHub directory listing.
  // Example: [1, 2, 3, 20, 21]
  manualDays: []
};

async function discoverDayFiles() {
  if (DATA_CONFIG.manualDays.length) {
    return DATA_CONFIG.manualDays.map(day => ({
      day,
      url: `https://raw.githubusercontent.com/${DATA_CONFIG.owner}/${DATA_CONFIG.repo}/${DATA_CONFIG.branch}/${DATA_CONFIG.folder}/day${day}.json`
    }));
  }

  const api = `https://api.github.com/repos/${DATA_CONFIG.owner}/${DATA_CONFIG.repo}/contents/${DATA_CONFIG.folder}?ref=${DATA_CONFIG.branch}`;
  const response = await fetch(api, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
  if (!response.ok) throw new Error(`Tidak dapat membaca folder GitHub (${response.status}). Pastikan repository public dan folder data tersedia.`);
  const files = await response.json();

  return files
    .map(file => {
      const match = /^day(\d+)\.json$/i.exec(file.name || "");
      return match ? { day: Number(match[1]), url: file.download_url } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.day - b.day);
}

async function loadAllDayData() {
  const files = await discoverDayFiles();
  if (!files.length) throw new Error("Belum ada file dayN.json di folder data.");

  const results = await Promise.allSettled(files.map(async file => {
    const response = await fetch(file.url, { cache: "no-store" });
    if (!response.ok) throw new Error(`day${file.day}.json: HTTP ${response.status}`);
    let raw = await response.text();
    // Excel ADODB.Stream may write a UTF-8 BOM; strip it before JSON.parse.
    raw = raw.replace(/^\uFEFF/, "");
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows)) throw new Error(`day${file.day}.json bukan JSON array.`);
    return rows.map(row => ({ ...row, Day: Number(row.Day ?? file.day) }));
  }));

  const allRows = [];
  const failed = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") allRows.push(...result.value);
    else failed.push(`Day ${files[index].day}: ${result.reason.message}`);
  });

  if (!allRows.length) throw new Error(failed.join(" | ") || "Tidak ada data yang berhasil dimuat.");
  return { rows: allRows, days: files.map(f => f.day), failed };
}

window.RouteData = { loadAllDayData };
