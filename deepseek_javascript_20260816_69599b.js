function renderHeader() {
  const placeholder = document.getElementById('site-header');
  if (!placeholder) return;

  const currentUser = getCurrentUser();
  const authHref = currentUser ? 'dashboard.html' : 'auth.html';
  const authLabel = currentUser ? 'داشبورد' : 'ورود / ثبت‌نام';

  placeholder.innerHTML = `
    <div class="header-container">
      <a href="index.html" class="logo">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="#1e40af"/>
          <path d="M9 23V9l7 8 7-8v14" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>آکادمی ادمین</span>
      </a>
      <nav class="nav-desktop">
        <a href="index.html" data-nav="home">خانه</a>
        <a href="index.html#packages" data-nav="packages">پکیج‌ها</a>
        <a href="affiliate.html" data-nav="affiliate">کسب درآمد</a>
        <a href="index.html#faq" data-nav="faq">سوالات متداول</a>
        <a href="about.html" data-nav="about">درباره ما</a>
      </nav>
      <div class="nav-actions">
        <a href="${authHref}" class="btn btn-primary btn-sm">${authLabel}</a>
        <button class="hamburger" id="hamburger" aria-label="منو">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>
    <div class="mobile-menu" id="mobile-menu">
      <a href="index.html">خانه</a>
      <a href="index.html#packages">پکیج‌ها</a>
      <a href="affiliate.html">کسب درآمد</a>
      <a href="index.html#faq">سوالات متداول</a>
      <a href="about.html">درباره ما</a>
    </div>
  `;

  // فعال‌سازی لینک ناوبری
  const currentPage = document.body.dataset.page;
  placeholder.querySelectorAll('.nav-desktop [data-nav]').forEach(link => {
    if (link.dataset.nav === currentPage) {
      link.classList.add('active');
    }
  });

  // Hamburger
  const hamburger = placeholder.querySelector('#hamburger');
  const mobileMenu = placeholder.querySelector('#mobile-menu');
  hamburger.addEventListener('click', () => mobileMenu.classList.toggle('open'));
  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => mobileMenu.classList.remove('open'));
  });
}

function renderFooter() {
  const placeholder = document.getElementById('site-footer');
  if (!placeholder) return;

  placeholder.innerHTML = `
    <div class="footer-container">
      <div class="footer-col">
        <div class="logo">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#1e40af"/>
            <path d="M9 23V9l7 8 7-8v14" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>آکادمی ادمین</span>
        </div>
        <p>مرجع تخصصی آموزش ادمینی و مدیریت شبکه‌های اجتماعی. مهارت یاد بگیر، درآمد بساز.</p>
        <div class="social-links">
          <a href="#" aria-label="اینستاگرام">IG</a>
          <a href="#" aria-label="تلگرام">TG</a>
          <a href="#" aria-label="یوتیوب">YT</a>
        </div>
      </div>
      <div class="footer-col">
        <h4>دسترسی سریع</h4>
        <a href="index.html">خانه</a>
        <a href="index.html#packages">پکیج‌ها</a>
        <a href="affiliate.html">کسب درآمد</a>
        <a href="dashboard.html">داشبورد</a>
      </div>
      <div class="footer-col">
        <h4>پکیج‌ها</h4>
        <a href="package.html?id=admin-instagram">ادمینی اینستاگرام</a>
        <a href="package.html?id=content-production">تولید محتوا</a>
        <a href="package.html?id=page-management">مدیریت پیج</a>
        <a href="package.html?id=comprehensive-admin">پکیج جامع</a>
      </div>
      <div class="footer-col">
        <h4>پشتیبانی</h4>
        <a href="about.html">درباره ما</a>
        <a href="contact.html">تماس با ما</a>
        <a href="rules.html">قوانین</a>
        <a href="privacy.html">حریم خصوصی</a>
      </div>
    </div>
    <div class="footer-bottom">© ۱۴۰۴ آکادمی ادمین. تمامی حقوق محفوظ است.</div>
  `;
}

renderHeader();
renderFooter();