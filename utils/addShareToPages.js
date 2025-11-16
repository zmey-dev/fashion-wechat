/**
 * Script to add share functionality template code to remaining pages
 * This is a reference template - manually add to each page
 */

const SHARE_CODE_TEMPLATE = `
  // Share to friends/groups
  onShareAppMessage: function() {
    return shareHelper.getDefaultShareConfig();
  },

  // Share to WeChat Moments
  onShareTimeline: function() {
    return shareHelper.getTimelineConfig();
  }
`;

const IMPORT_STATEMENT = `const shareHelper = require("../../utils/shareHelper");`;

/**
 * Pages that need share functionality added:
 *
 * 1. pages/follow/follow.js - Follow page
 * 2. pages/friend/friend.js - Friend page
 * 3. pages/event/event.js - Event list page
 * 4. pages/event-detail/event-detail.js - Event detail page
 * 5. pages/event-create/event-create.js - Event creation page
 * 6. pages/company-posts/company-posts.js - Company posts page
 * 7. pages/me/me.js - Profile page
 * 8. pages/teacher-me/teacher-me.js - Teacher profile page
 * 9. pages/user-profile/user-profile.js - User profile page
 * 10. pages/profile/profile.js - Profile settings page
 * 11. pages/contact/contact.js - Contact/Messages page
 * 12. pages/chat/chat.js - Chat page
 * 13. pages/notification/notification.js - Notifications page
 * 14. pages/upload/upload.js - Upload page
 * 15. pages/register/register.js - Register page (probably no share needed)
 * 16. pages/forgot-password/forgot-password.js - Password reset (no share needed)
 * 17. pages/terms/terms.js - Terms page (no share needed)
 * 18. pages/privacy/privacy.js - Privacy page (no share needed)
 * 19. pages/maintenance/maintenance.js - Maintenance page (no share needed)
 */

console.log('Share code template:');
console.log(IMPORT_STATEMENT);
console.log(SHARE_CODE_TEMPLATE);

module.exports = {
  SHARE_CODE_TEMPLATE,
  IMPORT_STATEMENT
};
