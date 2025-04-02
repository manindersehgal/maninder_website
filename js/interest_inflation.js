fetch('../data/interest_inflation.json')
  .then(res => res.json())
  .then(data => {
    new Chart(document.getElementById('ratesChart'), {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: 'Interest Rate (%)',
            data: data.interest,
            borderColor: 'blue',
            tension: 0.3,
            fill: false
          },
          {
            label: 'Inflation Rate (%)',
            data: data.inflation,
            borderColor: 'red',
            tension: 0.3,
            fill: false
          }
        ]
      },
      options: {
        plugins: {
          title: {
            display: true,
            text: 'Interest and Inflation Rates (Canada)'
          }
        }
      }
    });
  });
