(function() {
  const tabs = document.querySelectorAll('.auth-tab');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      if (tab.dataset.tab === 'login') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
      } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
      }
    });
  });

  function getRedirect() {
    const params = new URLSearchParams(window.location.search);
    return params.get('redirect') || 'dashboard.html';
  }

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const identifier = document.getElementById('login-identifier').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!identifier || !password) {
      showToast('لطفا همه فیلدها را پر کنید', 'error');
      return;
    }

    const user = {
      name: 'کاربر',
      phone: identifier,
      email: '',
      loggedInAt: new Date().toISOString()
    };
    setCurrentUser(user);
    showToast('ورود موفقیت‌آمیز بود');

    setTimeout(() => {
      window.location.href = getRedirect();
    }, 800);
  });

  registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const mobile = document.getElementById('reg-mobile').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value.trim();
    const ref = document.getElementById('reg-ref').value.trim();

    if (!name || !mobile || !password) {
      showToast('لطفا فیلدهای الزامی را پر کنید', 'error');
      return;
    }

    const user = {
      name,
      phone: mobile,
      email,
      referralCode: ref || null,
      createdAt: new Date().toISOString()
    };
    setCurrentUser(user);

    if (ref) {
      const note = document.getElementById('ref-note');
      note.textContent = `ثبت‌نام با کد معرف ${ref} انجام شد.`;
      note.style.display = 'block';
      showToast('ثبت‌نام با کد معرف ثبت شد');
    } else {
      showToast('ثبت‌نام موفقیت‌آمیز بود');
    }

    setTimeout(() => {
      window.location.href = getRedirect();
    }, 1200);
  });
})();