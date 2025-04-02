fetch('../data/oecd_gdp_comparison.json')
  .then(res => res.json())
  .then(data => {
    new Chart(document.getElementById('oecdGDPChart'), {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: data.datasets.map(set => ({
          label: set.label,
          data: set.data,
          fill: false,
          tension: 0.3
        }))
      },
      options: {
        plugins: {
          title: {
            display: true,
            text: 'GDP of OECD Countries (Billion USD)'
          }
        }
      }
    });
  });
