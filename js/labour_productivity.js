fetch('../data/labour_productivity.json')
  .then(res => res.json())
  .then(data => {
    const labels = data.map(d => d.label);
    const values = data.map(d => d.value);

    new Chart(document.getElementById('labourChart'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Labour Productivity Index',
          data: values,
          backgroundColor: 'orange'
        }]
      },
      options: {
        plugins: {
          title: {
            display: true,
            text: 'Labour Productivity (Indexed)'
          }
        }
      }
    });
  });
