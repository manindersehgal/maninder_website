fetch('../data/gdp_per_capita.json')
  .then(res => res.json())
  .then(data => {
    const labels = data.map(d => d.label);
    const values = data.map(d => d.value);

    new Chart(document.getElementById('gdpPerCapitaChart'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'GDP per Capita (CAD)',
          data: values,
          borderColor: 'green',
          tension: 0.4,
          fill: false
        }]
      },
      options: {
        plugins: {
          title: {
            display: true,
            text: 'Canada GDP per Capita'
          }
        }
      }
    });
  });
