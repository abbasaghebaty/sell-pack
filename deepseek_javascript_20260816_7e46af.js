(function() {
  // رندر پکیج‌ها
  const packagesContainer = document.getElementById('packages-container');
  if (packagesContainer) {
    packagesContainer.innerHTML = packages.map(pkg => `
      <article class="package-card">
        <a href="package.html?id=${pkg.id}" class="package-card-image" aria-hidden="true">${pkg.icon}</a>
        <div class="package-card-body">
          <div class="package-badge">${pkg.badge || 'آموزش'}</div>
          <h3 class="package-title"><a href="package.html?id=${pkg.id}">${pkg.title}</a></h3>
          <p class="package-desc">${pkg.shortDesc}</p>
          <div class="package-meta">
            <span>${pkg.level}</span>
            <span>${pkg.sessions} جلسه</span>
          </div>
          <div class="price-row">
            ${pkg.oldPrice ? `<span class="old-price">${formatPrice(pkg.oldPrice)}</span>` : ''}
            <span class="current-price">${formatPrice(pkg.price)} تومان</span>
            ${pkg.discount ? `<span class="discount">${pkg.discount}٪ تخفیف</span>` : ''}
          </div>
          <a href="package.html?id=${pkg.id}" class="btn btn-primary btn-block mt-3">مشاهده پکیج</a>
        </div>
      </article>
    `).join('');
  }

  // رندر FAQ
  const faqContainer = document.getElementById('faq-container');
  if (faqContainer) {
    faqContainer.innerHTML = faqs.map((item, index) => `
      <div class="accordion-item">
        <button class="accordion-header" data-index="${index}">
          <span>${item.q}</span>
          <span class="accordion-icon">▼</span>
        </button>
        <div class="accordion-content">${item.a}</div>
      </div>
    `).join('');

    faqContainer.addEventListener('click', (e) => {
      const header = e.target.closest('.accordion-header');
      if (!header) return;

      const item = header.parentElement;
      const isActive = item.classList.contains('active');

      faqContainer.querySelectorAll('.accordion-item').forEach(i => i.classList.remove('active'));
      if (!isActive) item.classList.add('active');
    });
  }
})();