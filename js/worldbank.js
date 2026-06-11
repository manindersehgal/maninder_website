/**
 * worldbank.js
 * World Bank Open Data API data layer
 * Exposes window.WorldBankAPI with functions for cross-country economic comparisons.
 * Responses are cached in sessionStorage.
 */

(function () {
  'use strict';

  const BASE_URL = 'https://api.worldbank.org/v2';

  // Human-readable country names
  const COUNTRY_NAMES = {
    CAN: 'Canada',
    USA: 'United States',
    GBR: 'United Kingdom',
    DEU: 'Germany',
    FRA: 'France',
    JPN: 'Japan',
    AUS: 'Australia',
    KOR: 'South Korea',
    ITA: 'Italy',
    CHN: 'China',
    IND: 'India',
    BRA: 'Brazil',
    MEX: 'Mexico',
  };

  // Colour palette for multi-country line charts
  const COUNTRY_COLORS = {
    CAN: '#d63384',
    USA: '#0d6efd',
    GBR: '#6f42c1',
    DEU: '#198754',
    FRA: '#0dcaf0',
    JPN: '#fd7e14',
    AUS: '#20c997',
    KOR: '#ffc107',
    ITA: '#6c757d',
    CHN: '#dc3545',
    IND: '#fd7e14',
    BRA: '#0dcaf0',
    MEX: '#198754',
  };

  // --------------------------------------------------------------------------
  // Cache helpers
  // --------------------------------------------------------------------------

  function cacheKey(indicator, codes, mrv) {
    return `worldbank_${indicator}_${codes.join('-')}_mrv${mrv}`;
  }

  function readCache(key) {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (_) { /* ignore */ }
    return null;
  }

  function writeCache(key, data) {
    try {
      sessionStorage.setItem(key, JSON.stringify(data));
    } catch (_) { /* ignore */ }
  }

  // --------------------------------------------------------------------------
  // Core fetch helper
  // --------------------------------------------------------------------------

  /**
   * Fetch a World Bank indicator for one or more countries.
   * Returns the raw data array (index 1 of the World Bank response).
   */
  async function wbFetch(indicatorCode, countryCodes, mrv = 30) {
    const ck = cacheKey(indicatorCode, countryCodes, mrv);
    const cached = readCache(ck);
    if (cached) return cached;

    const iso = countryCodes.join(';');
    const url = `${BASE_URL}/country/${iso}/indicator/${indicatorCode}?format=json&mrv=${mrv}&per_page=500`;

    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`World Bank API error ${resp.status} for ${indicatorCode}`);

    const json = await resp.json();
    if (!Array.isArray(json) || json.length < 2) {
      throw new Error(`Unexpected World Bank response structure for ${indicatorCode}`);
    }

    const data = json[1];
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(`No World Bank data returned for ${indicatorCode} (${iso})`);
    }

    writeCache(ck, data);
    return data;
  }

  // --------------------------------------------------------------------------
  // Data transformation helpers
  // --------------------------------------------------------------------------

  /**
   * Given a raw World Bank data array for a single country,
   * return { labels: string[], values: number[] } sorted oldest-first,
   * with null values omitted.
   */
  function singleCountrySeries(rawData, countryCode) {
    const rows = rawData
      .filter((d) => d.countryiso3code === countryCode && d.value !== null)
      .map((d) => ({ year: String(d.date), value: d.value }))
      .sort((a, b) => (a.year < b.year ? -1 : 1));

    return {
      labels: rows.map((r) => r.year),
      values: rows.map((r) => r.value),
    };
  }

  /**
   * Given a raw World Bank data array for multiple countries,
   * return a map: countryCode → { labels, values, color, name }
   */
  function multiCountrySeries(rawData, countryCodes) {
    const result = {};
    for (const code of countryCodes) {
      const series = singleCountrySeries(rawData, code);
      if (series.values.length > 0) {
        result[code] = {
          ...series,
          color: COUNTRY_COLORS[code] || '#adb5bd',
          name: COUNTRY_NAMES[code] || code,
        };
      }
    }
    return result;
  }

  // --------------------------------------------------------------------------
  // Public API functions
  // --------------------------------------------------------------------------

  /**
   * GDP per capita (current USD) over time for the given countries.
   * Returns: map of countryCode → { labels, values, color, name }
   */
  async function getGDPPerCapita(
    countryCodes = ['CAN', 'USA', 'GBR', 'DEU', 'FRA', 'JPN', 'AUS'],
    mrv = 30
  ) {
    const data = await wbFetch('NY.GDP.PCAP.CD', countryCodes, mrv);
    return multiCountrySeries(data, countryCodes);
  }

  /**
   * Latest-year GDP (current USD) for a list of countries.
   * Returns: array of { country, name, gdpUSD, gdpTrillions, year, color }
   * sorted descending by GDP.
   */
  async function getGDPComparison(
    countryCodes = ['CAN', 'USA', 'GBR', 'DEU', 'FRA', 'JPN', 'AUS', 'KOR', 'ITA']
  ) {
    const data = await wbFetch('NY.GDP.MKTP.CD', countryCodes, 5);

    // For each country, find the most recent non-null value
    const results = [];
    for (const code of countryCodes) {
      const rows = data
        .filter((d) => d.countryiso3code === code && d.value !== null)
        .sort((a, b) => Number(b.date) - Number(a.date));

      if (rows.length > 0) {
        const latest = rows[0];
        results.push({
          country: code,
          name: COUNTRY_NAMES[code] || code,
          gdpUSD: latest.value,
          gdpTrillions: latest.value / 1e12,
          year: String(latest.date),
          color: COUNTRY_COLORS[code] || '#adb5bd',
        });
      }
    }

    return results.sort((a, b) => b.gdpUSD - a.gdpUSD);
  }

  /**
   * Canada GDP growth rate (%) over time.
   * Returns: { labels: string[], values: number[], latestValue, latestDate, change, changePercent }
   */
  async function getGDPGrowth(mrv = 30) {
    const data = await wbFetch('NY.GDP.MKTP.KD.ZG', ['CAN'], mrv);
    const series = singleCountrySeries(data, 'CAN');

    if (series.values.length === 0) {
      throw new Error('No GDP growth data returned for Canada');
    }

    const latestValue = series.values[series.values.length - 1];
    const latestDate = series.labels[series.labels.length - 1];
    const prevValue = series.values.length > 1 ? series.values[series.values.length - 2] : latestValue;
    const change = latestValue - prevValue;
    const changePercent = prevValue !== 0 ? (change / prevValue) * 100 : 0;

    return {
      labels: series.labels,
      values: series.values,
      latestValue,
      latestDate,
      change,
      changePercent,
      unit: '%',
    };
  }

  /**
   * Inflation (CPI %) over time for a given country.
   * Returns: { labels, values, latestValue, latestDate, change, changePercent, unit }
   */
  async function getInflation(countryCode = 'CAN', mrv = 30) {
    const data = await wbFetch('FP.CPI.TOTL.ZG', [countryCode], mrv);
    const series = singleCountrySeries(data, countryCode);

    if (series.values.length === 0) {
      throw new Error(`No inflation data returned for ${countryCode}`);
    }

    const latestValue = series.values[series.values.length - 1];
    const latestDate = series.labels[series.labels.length - 1];
    const prevValue = series.values.length > 1 ? series.values[series.values.length - 2] : latestValue;
    const change = latestValue - prevValue;
    const changePercent = prevValue !== 0 ? (change / prevValue) * 100 : 0;

    return {
      labels: series.labels,
      values: series.values,
      latestValue,
      latestDate,
      change,
      changePercent,
      unit: '%',
    };
  }

  /**
   * Unemployment rate (%) for multiple countries, latest available year.
   * Returns: array of { country, name, value, year, color }
   */
  async function getUnemploymentComparison(
    countryCodes = ['CAN', 'USA', 'GBR', 'DEU', 'FRA', 'JPN', 'AUS'],
    mrv = 5
  ) {
    const data = await wbFetch('SL.UEM.TOTL.ZS', countryCodes, mrv);
    const results = [];
    for (const code of countryCodes) {
      const rows = data
        .filter((d) => d.countryiso3code === code && d.value !== null)
        .sort((a, b) => Number(b.date) - Number(a.date));
      if (rows.length > 0) {
        results.push({
          country: code,
          name: COUNTRY_NAMES[code] || code,
          value: rows[0].value,
          year: String(rows[0].date),
          color: COUNTRY_COLORS[code] || '#adb5bd',
        });
      }
    }
    return results;
  }

  // --------------------------------------------------------------------------
  // Expose public API
  // --------------------------------------------------------------------------

  window.WorldBankAPI = {
    getGDPPerCapita,
    getGDPComparison,
    getGDPGrowth,
    getInflation,
    getUnemploymentComparison,
    COUNTRY_NAMES,
    COUNTRY_COLORS,
  };
})();
