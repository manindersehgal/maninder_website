/**
 * statscan.js
 * Statistics Canada economic data layer.
 *
 * In production: reads from a pre-built JSON blob written by the Databricks
 * pipeline every Monday morning.  No StatsCan POST calls from the browser,
 * no CORS issues.
 *
 * In local development: if BLOB_DATA_URL is empty the functions fall back to
 * calling the StatsCan WDS API directly (requires a local HTTP server — not
 * file:// protocol).
 *
 * Setup:
 *   1. Run databricks/statscan_pipeline.py on Databricks.
 *   2. Copy the printed Blob URL into BLOB_DATA_URL below.
 *   3. Push to GitHub.  Done.
 */

(function () {
  'use strict';

  // ── Set this to your Azure Blob Storage URL after running the Databricks pipeline ──
  // e.g. 'https://mystorageaccount.blob.core.windows.net/website-data/statscan_data.json'
  const BLOB_DATA_URL = '';
  // ─────────────────────────────────────────────────────────────────────────────────

  const BASE_URL = 'https://www150.statcan.gc.ca/t1/wds/rest';

  // --------------------------------------------------------------------------
  // Blob data loader — fetches once and caches for the page session
  // --------------------------------------------------------------------------

  let _blobPromise = null;

  function loadBlobData() {
    if (!BLOB_DATA_URL) return Promise.resolve(null);
    if (_blobPromise) return _blobPromise;

    _blobPromise = fetch(BLOB_DATA_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`Blob fetch failed: ${r.status}`);
        return r.json();
      })
      .then((data) => {
        console.log(`[StatsCanAPI] Loaded blob data (updated: ${data.lastUpdated})`);
        return data;
      })
      .catch((err) => {
        console.warn(`[StatsCanAPI] Blob unavailable, falling back to direct API: ${err.message}`);
        _blobPromise = null;
        return null;
      });

    return _blobPromise;
  }

  // --------------------------------------------------------------------------
  // Session cache helpers (used by direct API fallback path)
  // --------------------------------------------------------------------------

  function readCache(key) {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return null;
  }

  function writeCache(key, data) {
    try { sessionStorage.setItem(key, JSON.stringify(data)); } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // Direct API helpers (fallback when blob URL is not set)
  // --------------------------------------------------------------------------

  async function apiPost(endpoint, body) {
    const resp = await fetch(`${BASE_URL}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`StatsCan API error ${resp.status} for ${endpoint}`);
    return resp.json();
  }

  async function fetchVectorSeries(vectorId, latestN, unit) {
    const ck = `statscan_vec_${vectorId}`;
    const cached = readCache(ck);
    if (cached) return cached;

    const data = await apiPost('getDataFromVectorsAndLatestNPeriods', [{ vectorId, latestN }]);
    const obj = data?.[0];
    if (!obj || obj.status !== 'SUCCESS') {
      throw new Error(`StatsCan vector ${vectorId} returned status: ${obj?.status ?? 'unknown'}`);
    }

    const points = obj.object?.vectorDataPoint;
    if (!Array.isArray(points) || points.length === 0) {
      throw new Error(`No data for StatsCan vector ${vectorId}`);
    }

    const sorted = [...points].sort((a, b) => {
      const da = a.refPerRaw || a.refPer;
      const db = b.refPerRaw || b.refPer;
      return da < db ? -1 : 1;
    });

    const labels = sorted.map((p) => p.refPerRaw || p.refPer);
    const values = sorted.map((p) => parseFloat(p.value));
    const result = buildSeriesResult(labels, values, unit);
    writeCache(ck, result);
    return result;
  }

  async function fetchCoordSeries(pid, coord, latestN, unit) {
    const ck = `statscan_${pid}_${coord}`;
    const cached = readCache(ck);
    if (cached) return cached;

    const data = await apiPost('getDataFromCubePidCoordAndLatestNPeriods', [
      { productId: pid, coordinate: coord, latestN },
    ]);

    const points = data[0]?.object?.vectorDataPoint;
    if (!Array.isArray(points) || points.length === 0) {
      throw new Error(`No data for StatsCan PID ${pid} coord ${coord}`);
    }

    const sorted = [...points].sort((a, b) => {
      const da = a.refPerRaw || a.refPer;
      const db = b.refPerRaw || b.refPer;
      return da < db ? -1 : 1;
    });

    const labels = sorted.map((p) => p.refPerRaw || p.refPer);
    const values = sorted.map((p) => parseFloat(p.value));
    const result = buildSeriesResult(labels, values, unit);
    writeCache(ck, result);
    return result;
  }

  function buildSeriesResult(labels, values, unit) {
    const latestValue  = values[values.length - 1];
    const latestDate   = labels[labels.length - 1];
    const prevValue    = values.length > 1 ? values[values.length - 2] : latestValue;
    const change       = latestValue - prevValue;
    const changePercent = prevValue !== 0 ? (change / prevValue) * 100 : 0;
    return { labels, values, latestValue, latestDate, change, changePercent, unit };
  }

  // --------------------------------------------------------------------------
  // Public indicator functions
  // Each tries the blob first, then falls back to a direct API call.
  // --------------------------------------------------------------------------

  async function getUnemployment() {
    const blob = await loadBlobData();
    if (blob?.unemployment) return blob.unemployment;
    // Fallback: vector 2062815 = Canada unemployment rate, both sexes, 15+ (confirmed)
    return fetchVectorSeries(2062815, 60, '%');
  }

  async function getGDP() {
    const blob = await loadBlobData();
    if (blob?.gdp) return blob.gdp;
    return fetchCoordSeries(36100104, '1.1.1.1', 40, 'Billions CAD (Chained 2012$)');
  }

  async function getCPI() {
    const blob = await loadBlobData();
    if (blob?.cpi) return blob.cpi;
    return fetchCoordSeries(18100004, '1.1', 60, 'Index (2002=100)');
  }

  async function getLabourProductivity() {
    const blob = await loadBlobData();
    if (blob?.labour_productivity) return blob.labour_productivity;
    return fetchCoordSeries(36100480, '1.1', 40, 'Index (2012=100)');
  }

  async function getHousingStarts() {
    const blob = await loadBlobData();
    if (blob?.housing_starts) return blob.housing_starts;
    return fetchCoordSeries(34100143, '1.1', 60, 'Units');
  }

  async function getBoCRate() {
    const blob = await loadBlobData();
    if (blob?.boc_rate) return blob.boc_rate;
    return fetchCoordSeries(10100145, '1.2', 60, '%');
  }

  async function getRetailSales() {
    const blob = await loadBlobData();
    if (blob?.retail_sales) return blob.retail_sales;
    return fetchCoordSeries(20100008, '1.1', 60, 'Millions CAD');
  }

  async function getTradeBalance() {
    const blob = await loadBlobData();
    if (blob?.trade) return blob.trade;

    // Fallback: fetch exports and imports separately and compute balance
    const [exportData, importData] = await Promise.all([
      fetchCoordSeries(12100011, '1.1', 60, 'Millions CAD'),
      fetchCoordSeries(12100011, '1.2', 60, 'Millions CAD'),
    ]);

    const exportMap = new Map(exportData.labels.map((l, i) => [l, exportData.values[i]]));
    const importMap = new Map(importData.labels.map((l, i) => [l, importData.values[i]]));
    const allLabels = [...new Set([...exportData.labels, ...importData.labels])].sort();
    const exports_  = allLabels.map((l) => exportMap.get(l) ?? null);
    const imports_  = allLabels.map((l) => importMap.get(l) ?? null);
    const balance   = allLabels.map((l, i) => {
      const e = exports_[i], m = imports_[i];
      return e !== null && m !== null ? e - m : null;
    });

    const latestBalance = balance.filter((v) => v !== null).at(-1) ?? 0;
    const prevBalance   = balance.filter((v) => v !== null).at(-2) ?? latestBalance;

    return {
      labels: allLabels, exports: exports_, imports: imports_, balance,
      latestValue: latestBalance, latestDate: allLabels.at(-1) ?? '',
      change: latestBalance - prevBalance,
      changePercent: prevBalance !== 0 ? ((latestBalance - prevBalance) / Math.abs(prevBalance)) * 100 : 0,
      unit: 'Millions CAD',
    };
  }

  async function getGDPPerCapita() {
    // GDP per capita comparison uses the World Bank API (GET-based, no CORS issues).
    // This function is intentionally left as a passthrough — see worldbank.js.
    throw new Error('getGDPPerCapita: use WorldBankAPI.getGDPPerCapita() instead');
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  window.StatsCanAPI = {
    getGDP,
    getCPI,
    getUnemployment,
    getLabourProductivity,
    getHousingStarts,
    getBoCRate,
    getRetailSales,
    getTradeBalance,
    getGDPPerCapita,
  };
})();
