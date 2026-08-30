/**
 * Compatibility facade for course access.
 *
 * منطق Invite، فعال‌سازی و انقضا به ماژول‌های مستقل منتقل شده است.
 */

export {
  COURSE_CHANNEL_ID,
  issueFreshInviteLink,
  activateCoursePurchase,
  sendAccessLink,
} from '../services/courseAccessService.js';

export {
  handleCourseJoinRequest,
} from './courseJoinRequestHandler.js';

export {
  expireCourses,
} from './courseExpirationHandler.js';
