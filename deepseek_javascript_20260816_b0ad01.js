function formatPrice(price) {
  if (price === 0) return '۰';
  return price.toLocaleString('fa-IR');
}

function formatNumber(num) {
  return num.toLocaleString('fa-IR');
}

function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise((resolve, reject) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand('copy');
      resolve();
    } catch (e) {
      reject(e);
    }

    document.body.removeChild(textarea);
  });
}

function getCurrentUser() {
  const user = localStorage.getItem('currentUser');
  return user ? JSON.parse(user) : null;
}

function setCurrentUser(user) {
  localStorage.setItem('currentUser', JSON.stringify(user));
}

function logoutUser() {
  localStorage.removeItem('currentUser');
}

function generateReferralCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function buildPackageUrl(packageId, refCode = '') {
  const base = window.location.href.split('/').slice(0, -1).join('/') + '/package.html';
  return `${base}?id=${encodeURIComponent(packageId)}${refCode ? '&ref=' + encodeURIComponent(refCode) : ''}`;
}