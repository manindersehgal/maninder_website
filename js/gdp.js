async function fetchGDPData() {
  const response = await fetch('../data/gdp_canada.json');
  const json = await response.json();

  const rows = json[0]?.object?.vectorDataPoint || [];

  const years = rows.map(r => r.refPer);
  const values = rows.map(r => parseFloat(r.value));

  return { years, values };
}

(async function () {
  const canvas = document.getElementById('gdpChart');

  if (!canvas) {
    console.error("❌ Could not find canvas element with ID 'gdpChart'");
    return;
  }

  const data = await fetchGDPData();

  if (data.years.length === 0 || data.values.length === 0) {
    console.error("❌ No data to plot");
    return;
  }

  new Chart(canvas, {
    type: 'line',
    data: {
      labels: data.years,
      datasets: [{
        label: 'Quarterly GDP (CAD)',
        data: data.values,
        borderColor: 'blue',
        tension: 0.3,
        fill: false
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Canada Quarterly GDP (10 Years)'
        }
      },
      scales: {
        x: {
          ticks: {
            callback: function (value, index, ticks) {
              const label = this.getLabelForValue(value);
              return (label.includes('Q1') || label.includes('Q3')) ? label : '';
            },
            maxRotation: 0,
            minRotation: 0
          },
          title: {
            display: true,
            text: 'Quarter'
          }
        },
        y: {
          title: {
            display: true,
            text: 'GDP (in millions CAD)'
          }
        }
      }
    }
  });
})();