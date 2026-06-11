/**
 * statscan.js
 * Statistics Canada WDS REST API data layer
 * Exposes window.StatsCanAPI with functions for each economic indicator.
 * Responses are cached in sessionStorage to avoid redundant network calls.
 */

(function () {
  'use strict';

  const BASE_URL = 'https://www150.statcan.gc.ca/t1/tbl1/en/dtbl';

  // --------------------------------------------------------------------------
  // Cache helpers
  // --------------------------------------------------------------------------

  function cacheKey(pid, coord) {
    return `statscan_${pid}_${coord}`;
  }

  function readCache(key) {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (_) { /* quota or parse error — ignore */ }
    return null;
  }

  function writeCache(key, data) {
    try {
      sessionStorage.setItem(key, JSON.stringify(data));
    } catch (_) { /* storage quota — ignore */ }
  }

  // --------------------------------------------------------------------------
  // Core fetch helpers
  // --------------------------------------------------------------------------

  async function apiFetch(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`StatsCan API error ${resp.status} for ${url}`);
    return resp.json();
  }

  /**
   * Fetch the cube metadata for a given 8-digit PID.
   * Returns the full parsed JSON body.
   */
  async function getCubeMetadata(pid) {
    const key = `statscan_meta_${pid}`;
    const cached = readCache(key);
    if (cached) return cached;
    const data = await apiFetch(`${BASE_URL}/getCubeMetadata/${pid}`);
    writeCache(key, data);
    return data;
  }

  /**
   * Fetch the latest N periods of data for a given PID + coordinate.
   * Returns the normalized { labels, values, latestValue, latestDate, change, changePercent, unit } object.
   */
  async function fetchSeries(pid, coord, latestN, unit) {
    const ck = cacheKey(pid, coord);
    const cached = readCache(ck);
    if (cached) return cached;

    const url = `${BASE_URL}/getDataFromCubePidCoordAndLatestNPeriods/${pid}/${coord}/${latestN}`;
    let json;
    try {
      json = await apiFetch(url);
    } catch (err) {
      throw new Error(`Failed to fetch StatsCan series PID ${pid} coord ${coord}: ${err.message}`);
    }

    const points = json?.object?.vectorDataPoint;
    if (!Array.isArray(points) || points.length === 0) {
      throw new Error(`No data returned for StatsCan PID ${pid} coord ${coord}`);
    }

    // Points arrive oldest-first from this endpoint; sort to be safe
    const sorted = [...points].sort((a, b) => (a.refPer < b.refPer ? -1 : 1));

    const labels = sorted.map((p) => p.refPer);
    const values = sorted.map((p) => parseFloat(p.value));

    const latestValue = values[values.length - 1];
    const latestDate = labels[labels.length - 1];
    const prevValue = values.length > 1 ? values[values.length - 2] : latestValue;
    const change = latestValue - prevValue;
    const changePercent = prevValue !== 0 ? (change / prevValue) * 100 : 0;

    const result = { labels, values, latestValue, latestDate, change, changePercent, unit };
    writeCache(ck, result);
    return result;
  }

  /**
   * Attempt to discover a coordinate from cube metadata.
   * Strategy: walk dimension members to find the target label (case-insensitive substring).
   * Returns a dot-separated coordinate string like "1.1.1".
   * Falls back to "1.1" if discovery fails.
   */
  async function discoverCoordinate(pid, dimFilters) {
    // dimFilters: array of strings, one per dimension, to match in member names
    try {
      const meta = await getCubeMetadata(pid);
      const dims = meta?.object?.dimension;
      if (!Array.isArray(dims) || dims.length === 0) {
        console.warn(`[StatsCanAPI] No dimension data for PID ${pid}, using fallback coord`);
        return dimFilters.map(() => '1').join('.');
      }

      const indices = dimFilters.map((filter, dimIdx) => {
        const dim = dims[dimIdx];
        if (!dim || !Array.isArray(dim.member)) return 1;
        const filterLower = filter.toLowerCase();
        const match = dim.member.find((m) =>
          (m.memberNameEng || '').toLowerCase().includes(filterLower)
        );
        return match ? match.memberId : 1;
      });

      return indices.join('.');
    } catch (err) {
      console.warn(`[StatsCanAPI] Coordinate discovery failed for PID ${pid}: ${err.message}. Using fallback.`);
      return dimFilters.map(() => '1').join('.');
    }
  }

  // --------------------------------------------------------------------------
  // Individual indicator functions
  // --------------------------------------------------------------------------

  /**
   * Real GDP — Table 36-10-0104-01 (quarterly, seasonally adjusted, chained 2012 dollars)
   * Dimension 1: Geography → Canada
   * Dimension 2: Prices → Chained (2012) dollars
   * Dimension 3: Seasonal adjustment → Seasonally adjusted at annual rates
   * Dimension 4: Estimates → Gross domestic product at market prices
   */
  async function getGDP() {
    const pid = '36100104';
    let coord;
    try {
      coord = await discoverCoordinate(pid, ['canada', 'chained', 'seasonally adjusted', 'gross domestic product at market']);
    } catch (_) {
      coord = '1.1.1.1';
    }
    try {
      return await fetchSeries(pid, coord, 40, 'Billions CAD (Chained 2012$)');
    } catch (_) {
      // Fallback coordinate
      return fetchSeries(pid, '1.1.1.1', 40, 'Billions CAD (Chained 2012$)');
    }
  }

  /**
   * CPI — Table 18-10-0004-01 (monthly, all-items, Canada)
   */
  async function getCPI() {
    const pid = '18100004';
    let coord;
    try {
      coord = await discoverCoordinate(pid, ['canada', 'all-items']);
    } catch (_) {
      coord = '1.1';
    }
    try {
      return await fetchSeries(pid, coord, 60, 'Index (2002=100)');
    } catch (_) {
      return fetchSeries(pid, '1.1', 60, 'Index (2002=100)');
    }
  }

  /**
   * Unemployment Rate — Table 14-10-0287-01 (monthly, both sexes, 15+, Canada)
   */
  async function getUnemployment() {
    const pid = '14100287';
    let coord;
    try {
      coord = await discoverCoordinate(pid, ['canada', 'both sexes', '15 years and over', 'unemployment rate']);
    } catch (_) {
      coord = '1.1.1.6';
    }
    try {
      return await fetchSeries(pid, coord, 60, '%');
    } catch (_) {
      return fetchSeries(pid, '1.1.1.6', 60, '%');
    }
  }

  /**
   * Labour Productivity — Table 36-10-0480-01 (quarterly, business sector)
   */
  async function getLabourProductivity() {
    const pid = '36100480';
    let coord;
    try {
      coord = await discoverCoordinate(pid, ['business sector', 'labour productivity']);
    } catch (_) {
      coord = '1.1';
    }
    try {
      return await fetchSeries(pid, coord, 40, 'Index (2012=100)');
    } catch (_) {
      return fetchSeries(pid, '1.1', 40, 'Index (2012=100)');
    }
  }

  /**
   * Housing Starts — Table 34-10-0143-01 (monthly, Canada total)
   */
  async function getHousingStarts() {
    const pid = '34100143';
    let coord;
    try {
      coord = await discoverCoordinate(pid, ['canada', 'total']);
    } catch (_) {
      coord = '1.1';
    }
    try {
      return await fetchSeries(pid, coord, 60, 'Units');
    } catch (_) {
      return fetchSeries(pid, '1.1', 60, 'Units');
    }
  }

  /**
   * Bank of Canada Rate — Table 10-10-0145-01 (monthly, bank rate / overnight rate)
   */
  async function getBoCRate() {
    const pid = '10100145';
    let coord;
    try {
      coord = await discoverCoordinate(pid, ['bank rate']);
    } catch (_) {
      coord = '1.1';
    }
    try {
      return await fetchSeries(pid, coord, 60, '%');
    } catch (err1) {
      // Try overnight rate
      try {
        const coord2 = await discoverCoordinate(pid, ['overnight']);
        return await fetchSeries(pid, coord2, 60, '%');
      } catch (_) {
        return fetchSeries(pid, '1.1', 60, '%');
      }
    }
  }

  /**
   * Retail Sales — Table 20-10-0008-01 (monthly, total retail, Canada)
   */
  async function getRetailSales() {
    const pid = '20100008';
    let coord;
    try {
      coord = await discoverCoordinate(pid, ['canada', 'total, retail trade']);
    } catch (_) {
      coord = '1.1';
    }
    try {
      return await fetchSeries(pid, coord, 60, 'Millions CAD');
    } catch (_) {
      return fetchSeries(pid, '1.1', 60, 'Millions CAD');
    }
  }

  /**
   * International Merchandise Trade — Table 12-10-0011-01
   * Returns an object with exports, imports, and net balance series.
   */
  async function getTradeBalance() {
    const pid = '12100011';

    // Discover coordinates for exports and imports
    let exportCoord, importCoord;
    try {
      exportCoord = await discoverCoordinate(pid, ['total exports']);
    } catch (_) {
      exportCoord = '1.1';
    }
    try {
      importCoord = await discoverCoordinate(pid, ['total imports']);
    } catch (_) {
      importCoord = '1.2';
    }

    const [exportData, importData] = await Promise.all([
      fetchSeries(pid, exportCoord, 60, 'Millions CAD').catch(() => fetchSeries(pid, '1.1', 60, 'Millions CAD')),
      fetchSeries(pid, importCoord, 60, 'Millions CAD').catch(() => fetchSeries(pid, '1.2', 60, 'Millions CAD')),
    ]);

    // Align the two series on common dates
    const exportMap = new Map(exportData.labels.map((l, i) => [l, exportData.values[i]]));
    const importMap = new Map(importData.labels.map((l, i) => [l, importData.values[i]]));

    // Use the union of labels, sorted
    const allLabels = [...new Set([...exportData.labels, ...importData.labels])].sort();
    const exports_ = allLabels.map((l) => exportMap.get(l) ?? null);
    const imports_ = allLabels.map((l) => importMap.get(l) ?? null);
    const balance = allLabels.map((l, i) => {
      const e = exports_[i];
      const m = imports_[i];
      return e !== null && m !== null ? e - m : null;
    });

    const latestExport = exports_.filter((v) => v !== null).at(-1) ?? 0;
    const latestImport = imports_.filter((v) => v !== null).at(-1) ?? 0;
    const latestBalance = latestExport - latestImport;
    const latestDate = allLabels.at(-1) ?? '';

    return {
      labels: allLabels,
      exports: exports_,
      imports: imports_,
      balance,
      latestValue: latestBalance,
      latestDate,
      change: 0,
      changePercent: 0,
      unit: 'Millions CAD',
    };
  }

  /**
   * GDP per Capita (derived) — real GDP (36100104) / population (17100005)
   */
  async function getGDPPerCapita() {
    const gdpPid = '36100104';
    const popPid = '17100005';

    let gdpCoord;
    try {
      gdpCoord = await discoverCoordinate(gdpPid, ['canada', 'chained', 'seasonally adjusted', 'gross domestic product at market']);
    } catch (_) {
      gdpCoord = '1.1.1.1';
    }

    let popCoord;
    try {
      popCoord = await discoverCoordinate(popPid, ['canada', 'total population']);
    } catch (_) {
      popCoord = '1.1';
    }

    const [gdpData, popData] = await Promise.all([
      fetchSeries(gdpPid, gdpCoord, 40, 'Billions CAD').catch(() => fetchSeries(gdpPid, '1.1.1.1', 40, 'Billions CAD')),
      fetchSeries(popPid, popCoord, 40, 'Thousands').catch(() => fetchSeries(popPid, '1.1', 40, 'Thousands')),
    ]);

    // Align on common labels (GDP is quarterly, pop is annual — use year prefix to match)
    const popByYear = new Map(popData.labels.map((l, i) => [l.substring(0, 4), popData.values[i]]));

    const labels = [];
    const values = [];

    for (let i = 0; i < gdpData.labels.length; i++) {
      const label = gdpData.labels[i];
      const year = label.substring(0, 4);
      const pop = popByYear.get(year);
      if (pop && pop > 0) {
        // GDP in billions → * 1e9; pop in thousands → * 1e3; result in CAD per person
        const perCapita = (gdpData.values[i] * 1e9) / (pop * 1e3);
        labels.push(label);
        values.push(Math.round(perCapita));
      }
    }

    if (values.length === 0) {
      throw new Error('Could not derive GDP per capita: no overlapping data between GDP and population tables');
    }

    const latestValue = values[values.length - 1];
    const latestDate = labels[labels.length - 1];
    const prevValue = values.length > 1 ? values[values.length - 2] : latestValue;
    const change = latestValue - prevValue;
    const changePercent = prevValue !== 0 ? (change / prevValue) * 100 : 0;

    const result = { labels, values, latestValue, latestDate, change, changePercent, unit: 'CAD per capita' };

    // Cache it under a combined key
    writeCache('statscan_gdp_per_capita', result);
    return result;
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
