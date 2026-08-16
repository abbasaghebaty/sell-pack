(function() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const pkg = packages.find(p => p.id === id);
  const container = document.getElementById('package-details');
  const breadcrumbTitle = document.getElementById('breadcrumb-title');

  if (!pkg) {
    container.innerHTML = '<p class="error">پکیج مورد نظر یافت نشد.</p>';
    return;
  }

  breadcrumbTitle.textContent = pkg.title;
  document.title = `${pkg.title} | آکادمی ادمین`;

  container.innerHTML = `
    <div class="package-detail-grid">
      <div class="package-detail-main">
        <div class="package-detail-head">
          <div class="package-detail-icon">${pkg.icon}</div>
          <div>
            <span class="badge-primary">${pkg.badge}</span>
            <h1>${pkg.title}</h1>
            <div class="package-meta">
              <span>${pkg.level}</span>
              <span>${pkg.sessions} جلسه</span>
              <span>${pkg.duration}</span>
              <span>${formatNumber(pkg.students)} دانشجو</span>
            </div>
          </div>
        </div>
        <p class="package-detail-desc">${pkg.description}</p>

        <div class="detail-section">
          <h2>چه چیزهایی یاد می‌گیرید؟</h2>
          <ul class="learnings-list">
            ${pkg.learnings.map(l => `<li>${l}</li>`).join('')}
          </ul>
        </div>

        <div class="detail-section">
          <h2>سرفصل‌ها</h2>
          <div class="chapters-list">
            ${pkg.chapters.map((ch, idx) => `
              <div class="chapter-item">
                <span>${idx + 1}. ${ch.title}</span>
                <span>${ch.sessions} جلسه</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="detail-section">
          <h2>این پکیج مناسب چه کسانی است؟</h2>
          <p>${pkg.audience}</p>
        </div>

        <div class="detail-section">
          <h2>سوالات متداول این پکیج</h2>
          <div class="faq-container">
            ${pkg.faqs.map((f, i) => `
              <div class="accordion-item">
                <button class="accordion-header" data-index="${i}">
                  <span>${f.q}</span>
                  <span class="accordion-icon">▼</span>
                </button>
                <div class="accordion-content">${f.a}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <aside class="package-detail-sidebar">
        <div class="price-card">
          <div class="price-row">
            ${pkg.oldPrice ? `<span class="old-price">${formatPrice(pkg.oldPrice)}</span>` : ''}
            <span class="current-price price-large">${formatPrice(pkg.price)} تومان</span>
            ${pkg.discount ? `<span class="discount">${pkg.discount}٪ تخفیف</span>` : ''}
          </div>
          <button id="buy-btn" class="btn btn-primary btn-block">خرید پکیج</button>
          <p class="price-note">دسترسی فوری بعد از خرید</p>
        </div>
        <div class="sidebar-info">
          <h3>مشخصات دوره</h3>
          <ul>
            <li>سطح: ${pkg.level}</li>
            <li>تعداد جلسات: ${pkg.sessions}</li>
            <li>مدت آموزش: ${pkg.duration}</li>
            <li>آخرین بروزرسانی: ${pkg.updated}</li>
            <li>امتیاز: ${pkg.rating} از ۵</li>
          </ul>
        </div>
      </aside>
    </div>
  `;

  document.getElementById('buy-btn').addEventListener('click', () => {
    if (!getCurrentUser()) {
      showToast('برای خرید ابتدا وارد حساب خود شوید.', 'warning');
      setTimeout(() => {
        window.location.href = 'auth.html?redirect=' + encodeURIComponent('package.html?id=' + pkg.id);
      }, 1200);
    } else {
      showToast('درخواست خرید ثبت شد. درگاه پرداخت در نسخه نمایشی فعال نیست.', 'success');
    }
  });

  const faqContainer = container.querySelector('.faq-container');
  faqContainer.addEventListener('click', (e) => {
    const header = e.target.closest('.accordion-header');
    if (!header) return;

    const item = header.parentElement;
    const isActive = item.classList.contains('active');
    faqContainer.querySelectorAll('.accordion-item').forEach(i => i.classList.remove('active'));
    if (!isActive) item.classList.add('active');
  });
})();