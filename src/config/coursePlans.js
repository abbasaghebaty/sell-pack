/**
 * Course subscription plans
 *
 * مسیر:
 * src/config/coursePlans.js
 */

export const COURSE_PLANS = Object.freeze({
  DAYS_7: Object.freeze({
    code: '7d',
    title: '۷ روز',
    durationDays: 7,
    priceToman: 40_000,
    priceRial: 400_000,
  }),

  DAYS_30: Object.freeze({
    code: '30d',
    title: '۳۰ روز',
    durationDays: 30,
    priceToman: 120_000,
    priceRial: 1_200_000,
  }),

  DAYS_90: Object.freeze({
    code: '90d',
    title: '۹۰ روز',
    durationDays: 90,
    priceToman: 240_000,
    priceRial: 2_400_000,
  }),

  DAYS_180: Object.freeze({
    code: '180d',
    title: '۱۸۰ روز',
    durationDays: 180,
    priceToman: 350_000,
    priceRial: 3_500_000,
  }),

  PERMANENT: Object.freeze({
    code: 'permanent',
    title: 'دائمی',
    durationDays: null,
    priceToman: 450_000,
    priceRial: 4_500_000,
  }),
});

export const COURSE_PLAN_LIST = Object.freeze([
  COURSE_PLANS.DAYS_7,
  COURSE_PLANS.DAYS_30,
  COURSE_PLANS.DAYS_90,
  COURSE_PLANS.DAYS_180,
  COURSE_PLANS.PERMANENT,
]);

export function getCoursePlan(code) {
  return (
    COURSE_PLAN_LIST.find(
      (plan) => plan.code === code
    ) ?? null
  );
}

export function formatToman(amount) {
  return Number(amount || 0).toLocaleString('fa-IR');
}
