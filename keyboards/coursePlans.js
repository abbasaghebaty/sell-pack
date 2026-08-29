import {
  COURSE_PLAN_LIST,
  formatToman,
} from '../src/config/coursePlans.js';

import {
  COURSE_MENU_BUTTONS,
} from './courseMenu.js';

export function getCoursePlanButton(plan) {
  return `${plan.title} | ${formatToman(plan.priceToman)} تومان`;
}

export function getCoursePlansKeyboard() {
  const buttons =
    COURSE_PLAN_LIST.map((plan) => ({
      text: getCoursePlanButton(plan),
      style:
        plan.code === 'permanent'
          ? 'success'
          : 'primary',
    }));

  return {
    keyboard: [
      [buttons[0], buttons[1]],
      [buttons[2], buttons[3]],
      [buttons[4]],
      [
        {
          text: COURSE_MENU_BUTTONS.BACK,
          style: 'danger',
        },
      ],
    ],

    resize_keyboard: true,
    is_persistent: false,
  };
}

export function getPlanFromButton(text) {
  return (
    COURSE_PLAN_LIST.find(
      (plan) =>
        getCoursePlanButton(plan) === text
    ) ?? null
  );
}
