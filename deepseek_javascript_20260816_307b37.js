(function() {
  // کد معرف
  let refCode = localStorage.getItem('refCode');
  if (!refCode) {
    refCode = generateReferralCode();
    localStorage.setItem('refCode', refCode);
  }
  document.getElementById('ref-code-display').textContent = refCode;

  // آمار
  document.getElementById('stat-balance').textContent = formatPrice(dashboardData.balance) + ' تومان';
  document.getElementById('stat-total-income').textContent = formatPrice(dashboardData.totalIncome) + ' تومان';
  document.getElementById('stat-sales').textContent = formatNumber(dashboardData.sales);
  document.getElementById('stat-clicks').textContent = formatNumber(dashboardData.clicks);
  document.getElementById('stat-referrals').textContent = formatNumber(dashboardData.referrals);
  document.getElementById('stat-month').textContent = formatPrice(dashboardData.monthCommission) + ' تومان';

  // نمودار
  const chart = document.getElementById('chart');
  const max = Math.max(...dashboardData.chart);

  chart.innerHTML = dashboardData.chart.map((value, index) => {
    const height = Math.round((value / max) * 100);
    return `
      <div class="chart-bar-wrapper">
        <div class="chart-bar" style="height:${height}%">
          <span>${formatPrice(value)}</span>
        </div>
        <div class="chart-label">${dashboardData.chartLabels[index]}</div>
      </div>
    `;
  }).join('');

  // لینک‌های معرفی
  const linksContainer = document.getElementById('referral-links-container');
  linksContainer.innerHTML = packages.map(pkg => {
    const url = buildPackageUrl(pkg.id, refCode);
    return `
      <div class="referral-item">
        <div><strong>${pkg.title}</strong></div>
        <div class="referral-link" dir="ltr">${url}</div>
        <button class="btn btn-primary btn-sm copy-link-btn" data-url="${url}">کپی لینک</button>
      </div>
    `;
  }).join('');

  linksContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.copy-link-btn');
    if (!btn) return;

    copyToClipboard(btn.dataset.url)
      .then(() => showToast('لینک کپی شد'))
      .catch(() => showToast('خطا در کپی لینک', 'error'));
  });

  // کپی لینک عمومی
  document.getElementById('copy-ref-link').addEventListener('click', () => {
    const publicUrl = buildPackageUrl('general', refCode);
    copyToClipboard(publicUrl)
      .then(() => showToast('لینک عمومی کپی شد'))
      .catch(() => showToast('خطا در کپی لینک', 'error'));
  });

  // خروج
  document.getElementById('logout-btn').addEventListener('click', () => {
    logoutUser();
    showToast('از حساب خارج شدید');
    setTimeout(() => window.location.href = 'auth.html', 800);
  });
})();