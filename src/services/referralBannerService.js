// QuickChart's default engine is Chart.js v2, which ignores the v3-style
// options below (title, cutout). "v=3" is required. Text is Latin on purpose
// so the image never depends on Persian fonts on the server.
function encodeChartConfig(config) {
  return encodeURIComponent(JSON.stringify(config));
}

export function buildReferralBannerUrl(referralLink, percent = 20) {
  const safeReferralLink = String(referralLink ?? "");
  const commission = Number.isFinite(Number(percent)) ? Number(percent) : 20;
  const config = {
    type: "doughnut",
    data: {
      labels: [`${commission}% commission for you`, `${100 - commission}% course price`],
      datasets: [
        {
          data: [commission, 100 - commission],
          backgroundColor: ["#22c55e", "#374151"],
          borderWidth: 0
        }
      ]
    },
    options: {
      responsive: false,
      animation: false,
      cutout: "70%",
      layout: { padding: 24 },
      plugins: {
        legend: {
          display: true,
          position: "bottom",
          labels: { color: "#ffffff", font: { size: 26 }, padding: 18 }
        },
        title: {
          display: true,
          color: "#ffffff",
          text: [
            "EndMark Partner Program",
            `Invite friends and earn ${commission}% commission`,
            safeReferralLink
          ],
          font: { size: 30, weight: "bold" },
          padding: { top: 18, bottom: 18 }
        }
      }
    }
  };
  return `https://quickchart.io/chart?v=3&width=1200&height=630&devicePixelRatio=1&format=png&backgroundColor=%23111827&c=${encodeChartConfig(config)}`;
}
