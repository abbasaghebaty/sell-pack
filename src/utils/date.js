/**
 * Date Utilities
 *
 * مسیر:
 * src/utils/date.js
 *
 * ابزارهای مربوط به تاریخ و روز هفته
 */

/**
 * بررسی می‌کند امروز جمعه است یا نه.
 *
 * از منطقه زمانی ایران استفاده می‌کنیم
 * تا تغییر ساعت سرور Cloudflare روی نتیجه اثر نگذارد.
 */
export function isFriday() {
  const dayName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    weekday: 'long',
  }).format(new Date());

  return dayName === 'Friday';
}
