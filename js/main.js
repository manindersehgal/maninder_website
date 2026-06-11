/**
 * main.js
 * Dashboard orchestration layer.
 * Initialises all Chart.js charts and populates KPI cards + data tables.
 * Depends on: Chart.js (global `Chart`), statscan.js, worldbank.js.
 */

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // Chart.js global defaults
  // --------------------------------------------------------------------------
  Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = false;

  // Registry to allow updates when theme changes
  const chartRegistry = {};

  // --------------------------------------------------------------------------
  // Theme management
  // --------------------------------------------------------------------------

  function currentTheme() {
    return document.documentElement.getAttribute('data-bs-theme') || 'light';
  }

  function isDark() {
    return currentTheme() === 'dark';
  }

  function themeGridColor() {
    return isDark() ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  }

  function themeTextColor() {
    return isDark() ? '#e9ecef' : '#212529';
  }

  function applyThemeToAllCharts() {
    const gridColor = themeGridColor();
    const textColor = themeTextColor();

    Object.values(chartRegistry).forEach((chart) => {
      if (!chart) return;
      // Update scale colors
      ['x', 'y'].forEach((axis) => {
        if (chart.options.scales?.[axis]) {
          chart.options.scales[axis].grid.color = gridColor;
          chart.options.scales[axis].ticks.color = textColor;
        }
      });
      if (chart.options.plugins?.legend?.labels) {
        chart.options.plugins.legend.labels.color = textColor;
      }
      chart.update();
    });
  }

  // Dark/light toggle button listener — the inline script in index.html handles the
  // actual data-bs-theme toggle and localStorage persistence; this listener only
  // needs to re-render Chart.js charts with the updated theme colours.
  document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        // Theme attribute has already been flipped by the inline script.
        // Re-draw charts with new colour palette.
        applyThemeToAllCharts();
      });
    }
  });

  // --------------------------------------------------------------------------
  // Utility: build Chart.js default scale options
  // --------------------------------------------------------------------------

  function makeScales(yLabel = '', xTicksCallback = null) {
    const gridColor = themeGridColor();
    const textColor = themeTextColor();

    const xScale = {
      grid: { color: gridColor },
      ticks: {
        color: textColor,
        maxTicksLimit: 10,
        maxRotation: 45,
      },
    };
    if (xTicksCallback) xScale.ticks.callback = xTicksCallback;

    return {
      x: xScale,
      y: {
        grid: { color: gridColor },
        ticks: { color: textColor },
        title: {
          display: !!yLabel,
          text: yLabel,
          color: textColor,
        },
      },
    };
  }

  function makeLegend(display = false) {
    return {
      display,
      labels: { color: themeTextColor() },
    };
  }

  function makeTooltip() {
    return { mode: 'index', intersect: false };
  }

  // --------------------------------------------------------------------------
  // Utility: loading / error state helpers
  // --------------------------------------------------------------------------

  function setLoading(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.classList.add('loading');
    panel.classList.remove('error');
    // Show all spinners within this panel
    panel.querySelectorAll('.chart-spinner').forEach((el) => el.classList.remove('d-none'));
    // Hide all error states within this panel
    panel.querySelectorAll('.chart-error').forEach((el) => el.classList.add('d-none'));
  }

  function clearLoading(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.classList.remove('loading');
    // Hide all spinners within this panel
    panel.querySelectorAll('.chart-spinner').forEach((el) => el.classList.add('d-none'));
  }

  /**
   * Hide the spinner and show the error state for a specific chart canvas within a panel.
   * Falls back to targeting all spinners/errors in the panel if no chartId is given.
   */
  function setError(panelId, message, chartId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.classList.remove('loading');
    panel.classList.add('error');

    // Hide spinners
    const spinnerId = chartId ? `spinner-${chartId}` : null;
    if (spinnerId) {
      const sp = document.getElementById(spinnerId);
      if (sp) sp.classList.add('d-none');
    } else {
      panel.querySelectorAll('.chart-spinner').forEach((el) => el.classList.add('d-none'));
    }

    // Show the matching error element
    const errorId = chartId ? `error-${chartId}` : null;
    let errorContainer = null;
    if (errorId) {
      errorContainer = document.getElementById(errorId);
    } else {
      errorContainer = panel.querySelector('.chart-error');
    }
    if (errorContainer) {
      errorContainer.classList.remove('d-none');
      const errorEl = errorContainer.querySelector('.chart-error-msg');
      if (errorEl) errorEl.textContent = message || 'Failed to load data.';
    }
    console.error(`[Dashboard] ${panelId}: ${message}`);
  }

  // --------------------------------------------------------------------------
  // Utility: populate KPI cards
  // --------------------------------------------------------------------------

  /**
   * kpiConfig: { elementId, value, label, change, changePercent, unit, format }
   * format: 'number' | 'percent' | 'currency' | 'integer'
   */
  function populateKPI(cfg) {
    const el = document.getElementById(cfg.elementId);
    if (!el) return;

    const fmt = cfg.format || 'number';
    let displayValue;
    if (fmt === 'percent') {
      displayValue = `${cfg.value.toFixed(1)}%`;
    } else if (fmt === 'currency') {
      displayValue = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(cfg.value);
    } else if (fmt === 'integer') {
      displayValue = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 0 }).format(cfg.value);
    } else {
      displayValue = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 2 }).format(cfg.value);
    }

    const valueEl = el.querySelector('.kpi-value');
    if (valueEl) valueEl.textContent = displayValue;

    const unitEl = el.querySelector('.kpi-unit');
    if (unitEl && cfg.unit) unitEl.textContent = cfg.unit;

    const labelEl = el.querySelector('.kpi-label');
    if (labelEl && cfg.label) labelEl.textContent = cfg.label;

    if (cfg.change !== undefined && cfg.changePercent !== undefined) {
      const changeEl = el.querySelector('.kpi-change');
      if (changeEl) {
        const pct = cfg.changePercent.toFixed(2);
        const sign = cfg.change >= 0 ? '+' : '';
        changeEl.textContent = `${sign}${pct}% vs prev`;
        changeEl.className = 'kpi-change ' + (cfg.change >= 0 ? 'text-success' : 'text-danger');
      }
    }

    const dateEl = el.querySelector('.kpi-date');
    if (dateEl && cfg.latestDate) dateEl.textContent = `As of ${cfg.latestDate}`;
  }

  // --------------------------------------------------------------------------
  // Utility: populate data table
  // --------------------------------------------------------------------------

  /**
   * Fill #table-chart-{name} tbody with the last `rows` data points.
   * columns: array of { header, accessor } where accessor is called with (label, index, seriesData)
   */
  function populateTable(tableId, seriesData, rows = 8, extraColumns = []) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;

    const thead = document.querySelector(`#${tableId} thead tr`);
    if (thead && thead.children.length === 0) {
      const dateHeader = document.createElement('th');
      dateHeader.textContent = 'Date';
      thead.appendChild(dateHeader);
      const valHeader = document.createElement('th');
      valHeader.textContent = 'Value';
      thead.appendChild(valHeader);
      extraColumns.forEach((col) => {
        const th = document.createElement('th');
        th.textContent = col.header;
        thead.appendChild(th);
      });
    }

    tbody.innerHTML = '';
    const len = seriesData.labels.length;
    const start = Math.max(0, len - rows);

    for (let i = len - 1; i >= start; i--) {
      const tr = document.createElement('tr');

      const dateTd = document.createElement('td');
      dateTd.textContent = seriesData.labels[i];
      tr.appendChild(dateTd);

      const valTd = document.createElement('td');
      const v = seriesData.values[i];
      valTd.textContent = v !== null && v !== undefined
        ? new Intl.NumberFormat('en-CA', { maximumFractionDigits: 2 }).format(v)
        : '—';
      tr.appendChild(valTd);

      extraColumns.forEach((col) => {
        const td = document.createElement('td');
        td.textContent = col.accessor(seriesData, i) ?? '—';
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    }
  }

  /**
   * Populate a table where the "value" column is a named array in seriesData
   * (e.g. trade balance uses .exports, .imports, .balance arrays).
   */
  function populateMultiSeriesTable(tableId, seriesData, rows = 8, columns = []) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;

    const thead = document.querySelector(`#${tableId} thead tr`);
    if (thead && thead.children.length === 0) {
      const dateHeader = document.createElement('th');
      dateHeader.textContent = 'Date';
      thead.appendChild(dateHeader);
      columns.forEach((col) => {
        const th = document.createElement('th');
        th.textContent = col.header;
        thead.appendChild(th);
      });
    }

    tbody.innerHTML = '';
    const len = seriesData.labels.length;
    const start = Math.max(0, len - rows);

    for (let i = len - 1; i >= start; i--) {
      const tr = document.createElement('tr');
      const dateTd = document.createElement('td');
      dateTd.textContent = seriesData.labels[i];
      tr.appendChild(dateTd);

      columns.forEach((col) => {
        const td = document.createElement('td');
        const v = seriesData[col.key]?.[i];
        td.textContent = v !== null && v !== undefined
          ? new Intl.NumberFormat('en-CA', { maximumFractionDigits: 2 }).format(v)
          : '—';
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    }
  }

  // --------------------------------------------------------------------------
  // Utility: update "last updated" label for a chart
  // --------------------------------------------------------------------------

  function setUpdatedLabel(chartId, dateStr) {
    const el = document.getElementById(`updated-${chartId}`);
    if (!el) return;
    el.innerHTML = `<i class="bi bi-clock me-1"></i>Updated: ${dateStr || 'N/A'}`;
  }

  // --------------------------------------------------------------------------
  // Chart builders
  // --------------------------------------------------------------------------

  function destroyChart(canvasId) {
    if (chartRegistry[canvasId]) {
      chartRegistry[canvasId].destroy();
      delete chartRegistry[canvasId];
    }
  }

  function buildLineChart(canvasId, data, cfg = {}) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return null;

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{
          label: cfg.label || '',
          data: data.values,
          borderColor: cfg.color || '#0d6efd',
          backgroundColor: cfg.fill
            ? (cfg.fillColor || hexToRgba(cfg.color || '#0d6efd', 0.15))
            : 'transparent',
          fill: !!cfg.fill,
          tension: cfg.tension !== undefined ? cfg.tension : 0.3,
          pointRadius: cfg.pointRadius !== undefined ? cfg.pointRadius : 2,
          stepped: cfg.stepped || false,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: makeTooltip(),
        plugins: {
          legend: makeLegend(false),
          tooltip: { mode: 'index', intersect: false },
        },
        scales: makeScales(cfg.yLabel || ''),
      },
    });

    chartRegistry[canvasId] = chart;
    return chart;
  }

  function buildBarChart(canvasId, data, cfg = {}) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return null;

    const isHorizontal = cfg.horizontal || false;

    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          label: cfg.label || '',
          data: data.values,
          backgroundColor: Array.isArray(cfg.color)
            ? cfg.color
            : (cfg.color || '#198754'),
          borderColor: 'transparent',
          borderWidth: 0,
        }],
      },
      options: {
        indexAxis: isHorizontal ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        interaction: makeTooltip(),
        plugins: {
          legend: makeLegend(false),
          tooltip: { mode: 'index', intersect: false },
        },
        scales: makeScales(cfg.yLabel || ''),
      },
    });

    chartRegistry[canvasId] = chart;
    return chart;
  }

  function buildMultiLineChart(canvasId, datasets, cfg = {}) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return null;

    const chart = new Chart(ctx, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: makeTooltip(),
        plugins: {
          legend: makeLegend(true),
          tooltip: { mode: 'index', intersect: false },
        },
        scales: makeScales(cfg.yLabel || ''),
      },
    });

    chartRegistry[canvasId] = chart;
    return chart;
  }

  // --------------------------------------------------------------------------
  // Helper: hex colour to rgba
  // --------------------------------------------------------------------------

  function hexToRgba(hex, alpha) {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // --------------------------------------------------------------------------
  // Individual chart initialisation functions
  // --------------------------------------------------------------------------

  function clearChartSpinner(chartId) {
    const sp = document.getElementById(`spinner-${chartId}`);
    if (sp) sp.classList.add('d-none');
  }

  async function initGDPChart() {
    const panelId = 'panel-gdp';
    setLoading(panelId);
    try {
      const data = await window.StatsCanAPI.getGDP();
      clearLoading(panelId);

      buildLineChart('chart-gdp', data, {
        label: 'Real GDP (Chained 2012 Dollars)',
        color: '#0d6efd',
        yLabel: 'Billions CAD',
      });

      // Update KPI card elements directly using the HTML IDs
      const kpiGdpValueEl = document.getElementById('kpi-gdp-value');
      if (kpiGdpValueEl) kpiGdpValueEl.textContent = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 0 }).format(data.latestValue);
      const kpiGdpChangeEl = document.getElementById('kpi-gdp-change');
      if (kpiGdpChangeEl) {
        const sign = data.change >= 0 ? '+' : '';
        kpiGdpChangeEl.textContent = `${sign}${data.changePercent.toFixed(2)}% vs prev`;
        kpiGdpChangeEl.className = 'kpi-change ' + (data.change >= 0 ? 'positive' : 'negative');
      }

      populateTable('table-chart-gdp', data);
      setUpdatedLabel('chart-gdp', data.latestDate);
    } catch (err) {
      setError(panelId, err.message);
    }
  }

  async function initLabourProductivityChart() {
    const panelId = 'panel-labour';
    setLoading(panelId);
    try {
      const data = await window.StatsCanAPI.getLabourProductivity();
      clearLoading(panelId);

      buildLineChart('chart-labour', data, {
        label: 'Labour Productivity (Business Sector)',
        color: '#0dcaf0',
        yLabel: 'Index (2012=100)',
      });

      populateTable('table-chart-labour', data);
      setUpdatedLabel('chart-labour', data.latestDate);
    } catch (err) {
      setError(panelId, err.message);
    }
  }

  async function initGDPPerCapitaChart() {
    const panelId = 'panel-gdp-per-capita';
    setLoading(panelId);
    try {
      // Fetch both domestic (StatsCan derived) and cross-country (World Bank) in parallel
      const [wbData] = await Promise.all([
        window.WorldBankAPI.getGDPPerCapita(['CAN', 'USA', 'GBR', 'DEU', 'FRA', 'JPN', 'AUS'], 30),
      ]);

      clearLoading(panelId);

      // Build Chart.js datasets from World Bank multi-country series
      const datasets = Object.entries(wbData).map(([code, series]) => ({
        label: series.name,
        data: series.values,
        labels: series.labels,
        borderColor: series.color,
        backgroundColor: 'transparent',
        tension: 0.3,
        pointRadius: 2,
        borderWidth: 2,
      }));

      // All datasets may have different label arrays; use the longest as x-axis labels
      const allLabels = [...new Set(Object.values(wbData).flatMap((s) => s.labels))].sort();

      // Rebuild datasets aligned to allLabels
      const alignedDatasets = Object.entries(wbData).map(([code, series]) => {
        const map = new Map(series.labels.map((l, i) => [l, series.values[i]]));
        return {
          label: series.name,
          data: allLabels.map((l) => map.get(l) ?? null),
          borderColor: series.color,
          backgroundColor: 'transparent',
          tension: 0.3,
          pointRadius: 2,
          borderWidth: 2,
          spanGaps: true,
        };
      });

      destroyChart('chart-gdp-per-capita');
      const ctx = document.getElementById('chart-gdp-per-capita')?.getContext('2d');
      if (ctx) {
        const chart = new Chart(ctx, {
          type: 'line',
          data: { labels: allLabels, datasets: alignedDatasets },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: makeTooltip(),
            plugins: {
              legend: makeLegend(true),
              tooltip: { mode: 'index', intersect: false },
            },
            scales: makeScales('USD per capita'),
          },
        });
        chartRegistry['chart-gdp-per-capita'] = chart;
      }

      // Data table: Canada's series
      const canSeries = wbData['CAN'];
      if (canSeries) {
        populateTable('table-chart-gdp-per-capita', canSeries);
        setUpdatedLabel('chart-gdp-per-capita', canSeries.labels[canSeries.labels.length - 1]);
      }
    } catch (err) {
      setError(panelId, err.message);
    }
  }

  async function initInternationalComparisonChart() {
    const panelId = 'panel-international';
    setLoading(panelId);
    try {
      const compData = await window.WorldBankAPI.getGDPComparison();
      clearLoading(panelId);

      const chartData = {
        labels: compData.map((c) => c.name),
        values: compData.map((c) => c.gdpTrillions),
      };

      destroyChart('chart-international');
      const ctx = document.getElementById('chart-international')?.getContext('2d');
      if (ctx) {
        const chart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: chartData.labels,
            datasets: [{
              label: 'GDP (Trillions USD)',
              data: chartData.values,
              backgroundColor: compData.map((c) => c.color),
              borderColor: 'transparent',
              borderWidth: 0,
            }],
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            interaction: makeTooltip(),
            plugins: {
              legend: makeLegend(false),
              tooltip: {
                callbacks: {
                  label: (ctx) => ` $${ctx.raw.toFixed(2)}T`,
                },
              },
            },
            scales: makeScales('Trillions USD'),
          },
        });
        chartRegistry['chart-international'] = chart;
      }

      // Data table
      const tableBody = document.querySelector('#table-chart-international tbody');
      if (tableBody) {
        const thead = document.querySelector('#table-chart-international thead tr');
        if (thead && thead.children.length === 0) {
          ['Country', 'GDP (Trillions USD)', 'Year'].forEach((h) => {
            const th = document.createElement('th');
            th.textContent = h;
            thead.appendChild(th);
          });
        }
        tableBody.innerHTML = '';
        compData.slice(0, 9).forEach((c) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${c.name}</td><td>$${c.gdpTrillions.toFixed(2)}T</td><td>${c.year}</td>`;
          tableBody.appendChild(tr);
        });
      }
      if (compData.length > 0) setUpdatedLabel('chart-international', compData[0].year);
    } catch (err) {
      setError(panelId, err.message);
    }
  }

  async function initCPIChart() {
    const panelId = 'panel-inflation';
    try {
      const data = await window.StatsCanAPI.getCPI();
      clearChartSpinner('chart-inflation');

      buildLineChart('chart-inflation', data, {
        label: 'CPI All-Items (Canada)',
        color: '#fd7e14',
        fill: true,
        fillColor: hexToRgba('#fd7e14', 0.15),
        yLabel: 'Index (2002=100)',
      });

      // Update KPI card elements directly using the HTML IDs
      const kpiValueEl = document.getElementById('kpi-cpi-value');
      if (kpiValueEl) kpiValueEl.textContent = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 2 }).format(data.latestValue);
      const kpiChangeEl = document.getElementById('kpi-cpi-change');
      if (kpiChangeEl) {
        const sign = data.change >= 0 ? '+' : '';
        kpiChangeEl.textContent = `${sign}${data.changePercent.toFixed(2)}% vs prev`;
        kpiChangeEl.className = 'kpi-change ' + (data.change >= 0 ? 'positive' : 'negative');
      }

      populateTable('table-chart-inflation', data);
      setUpdatedLabel('chart-inflation', data.latestDate);
    } catch (err) {
      setError(panelId, err.message, 'chart-inflation');
    }
  }

  async function initInterestRateChart() {
    const panelId = 'panel-inflation';
    try {
      const data = await window.StatsCanAPI.getBoCRate();
      clearChartSpinner('chart-interest');

      buildLineChart('chart-interest', data, {
        label: 'Bank of Canada Rate',
        color: '#6f42c1',
        stepped: true,
        tension: 0,
        pointRadius: 3,
        yLabel: '%',
      });

      // Update KPI card elements directly using the HTML IDs
      const kpiValueEl = document.getElementById('kpi-boc-value');
      if (kpiValueEl) kpiValueEl.textContent = `${data.latestValue.toFixed(2)}%`;
      const kpiChangeEl = document.getElementById('kpi-boc-change');
      if (kpiChangeEl) {
        const sign = data.change >= 0 ? '+' : '';
        kpiChangeEl.textContent = `${sign}${data.changePercent.toFixed(2)}% vs prev`;
        kpiChangeEl.className = 'kpi-change ' + (data.change >= 0 ? 'positive' : 'negative');
      }

      populateTable('table-chart-interest', data);
      setUpdatedLabel('chart-interest', data.latestDate);
    } catch (err) {
      setError(panelId, err.message, 'chart-interest');
    }
  }

  async function initUnemploymentChart() {
    const panelId = 'panel-employment';
    setLoading(panelId);
    try {
      const data = await window.StatsCanAPI.getUnemployment();
      clearLoading(panelId);

      buildLineChart('chart-employment', data, {
        label: 'Unemployment Rate (Canada, Both Sexes, 15+)',
        color: '#dc3545',
        yLabel: '%',
      });

      // Update KPI card elements directly using the HTML IDs
      const kpiValueEl = document.getElementById('kpi-unemployment-value');
      if (kpiValueEl) kpiValueEl.textContent = `${data.latestValue.toFixed(1)}%`;
      const kpiChangeEl = document.getElementById('kpi-unemployment-change');
      if (kpiChangeEl) {
        const sign = data.change >= 0 ? '+' : '';
        kpiChangeEl.textContent = `${sign}${data.changePercent.toFixed(2)}% vs prev`;
        // For unemployment, rising is negative (bad), falling is positive (good)
        kpiChangeEl.className = 'kpi-change ' + (data.change <= 0 ? 'positive' : 'negative');
      }

      populateTable('table-chart-employment', data);
      setUpdatedLabel('chart-employment', data.latestDate);
    } catch (err) {
      setError(panelId, err.message);
    }
  }

  async function initHousingStartsChart() {
    const panelId = 'panel-housing';
    setLoading(panelId);
    try {
      const data = await window.StatsCanAPI.getHousingStarts();
      clearLoading(panelId);

      buildBarChart('chart-housing', data, {
        label: 'Housing Starts (Canada)',
        color: '#198754',
        yLabel: 'Units',
      });

      populateTable('table-chart-housing', data);
      setUpdatedLabel('chart-housing', data.latestDate);
    } catch (err) {
      setError(panelId, err.message);
    }
  }

  async function initRetailSalesChart() {
    const panelId = 'panel-retail';
    setLoading(panelId);
    try {
      const data = await window.StatsCanAPI.getRetailSales();
      clearLoading(panelId);

      buildLineChart('chart-retail', data, {
        label: 'Retail Sales (Canada)',
        color: '#d63384',
        yLabel: 'Millions CAD',
      });

      populateTable('table-chart-retail', data);
      setUpdatedLabel('chart-retail', data.latestDate);
    } catch (err) {
      setError(panelId, err.message);
    }
  }

  async function initTradeChart() {
    const panelId = 'panel-trade';
    setLoading(panelId);
    try {
      const data = await window.StatsCanAPI.getTradeBalance();
      clearLoading(panelId);

      destroyChart('chart-trade');
      const ctx = document.getElementById('chart-trade')?.getContext('2d');
      if (ctx) {
        const chart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: data.labels,
            datasets: [
              {
                label: 'Exports',
                data: data.exports,
                borderColor: '#0d6efd',
                backgroundColor: 'transparent',
                tension: 0.3,
                pointRadius: 1,
                borderWidth: 2,
              },
              {
                label: 'Imports',
                data: data.imports,
                borderColor: '#dc3545',
                backgroundColor: 'transparent',
                tension: 0.3,
                pointRadius: 1,
                borderWidth: 2,
              },
              {
                label: 'Net Balance',
                data: data.balance,
                borderColor: '#198754',
                backgroundColor: 'transparent',
                tension: 0.3,
                pointRadius: 1,
                borderWidth: 2,
                borderDash: [6, 3],
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: makeTooltip(),
            plugins: {
              legend: makeLegend(true),
              tooltip: { mode: 'index', intersect: false },
            },
            scales: makeScales('Millions CAD'),
          },
        });
        chartRegistry['chart-trade'] = chart;
      }

      populateMultiSeriesTable('table-chart-trade', data, 8, [
        { header: 'Exports (M CAD)', key: 'exports' },
        { header: 'Imports (M CAD)', key: 'imports' },
        { header: 'Balance (M CAD)', key: 'balance' },
      ]);
      setUpdatedLabel('chart-trade', data.latestDate);
    } catch (err) {
      setError(panelId, err.message);
    }
  }

  // --------------------------------------------------------------------------
  // Main init — runs on DOMContentLoaded
  // --------------------------------------------------------------------------

  async function initDashboard() {
    // Mark all panels as loading
    const allPanels = [
      'panel-gdp',
      'panel-labour',
      'panel-gdp-per-capita',
      'panel-international',
      'panel-inflation',
      'panel-employment',
      'panel-housing',
      'panel-retail',
      'panel-trade',
    ];
    allPanels.forEach(setLoading);

    // Fire all data fetches in parallel; each chart handler manages its own loading/error state
    await Promise.allSettled([
      initGDPChart(),
      initLabourProductivityChart(),
      initGDPPerCapitaChart(),
      initInternationalComparisonChart(),
      initCPIChart(),
      initInterestRateChart(),
      initUnemploymentChart(),
      initHousingStartsChart(),
      initRetailSalesChart(),
      initTradeChart(),
    ]);
  }

  document.addEventListener('DOMContentLoaded', initDashboard);

  // Expose for external use / manual refresh
  window.Dashboard = {
    refresh: initDashboard,
    charts: chartRegistry,
  };
})();
