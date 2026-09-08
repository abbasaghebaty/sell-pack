function encodeChartConfig(config) {
  return encodeURIComponent(
    JSON.stringify(config),
  );
}

export function buildReferralBannerUrl(
  referralLink,
) {
  const safeReferralLink =
    String(referralLink ?? '');

  const config = {
    type: 'doughnut',

    data: {
      labels: ['کمیسیون', 'باقی مبلغ'],

      datasets: [
        {
          data: [20, 80],
          backgroundColor: ['#22c55e', '#1f2937'],
          borderWidth: 0,
        },
      ],
    },

    options: {
      responsive: false,
      animation: false,
      cutout: '72%',
      rotation: -90,

      layout: {
        padding: 55,
      },

      plugins: {
        legend: {
          display: false,
        },

        title: {
          display: true,

          text: [
            'EndMark',
            'سیستم همکاری و کسب درآمد',
            'با معرفی هر خرید، ۲۰٪ کمیسیون بگیر',
            safeReferralLink,
          ],

          color: '#ffffff',

          font: {
            size: 28,
            weight: 'bold',
          },

          padding: {
            top: 25,
            bottom: 20,
          },
        },

      },
    },
  };

  return `https://quickchart.io/chart?width=1200&height=630&devicePixelRatio=1&backgroundColor=%23111827&c=${encodeChartConfig(
    config,
  )}`;
}
