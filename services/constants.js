// services/constants.js
/**
 * Application constants
 */

// API endpoints
const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    PROFILE: '/user/profile',
    PASSWORD: '/user/password'
  },
  
  POSTS: {
    LIST: '/post',
    DISCOVER: 'post/get_posts_discover',
    RECOMMEND: '/posts/recommend',
    FOLLOW: '/posts/follow',
    USER: '/posts/user',
    LIKE: '/posts/like',
    COMMENTS: '/posts/comments'
  },
  
  USERS: {
    PROFILE: '/user',
    FOLLOWINGS: '/user/followings',
    FOLLOWERS: '/user/followers',
    FOLLOW: '/user/follow',
    SEARCH: '/user/search'
  },
  
  EVENTS: {
    LIST: '/events',
    JOIN: '/events/join'
  },
  
  NOTIFICATIONS: {
    LIST: '/notifications',
    READ: '/notifications/read',
    READ_ALL: '/notifications/read-all'
  },
  
  CHATS: {
    LIST: '/chats',
    MESSAGES: '/chats/messages'
  }
};

// User roles
const USER_ROLES = {
  USER: 'user',      // Student
  TEACHER: 'teacher' // Teacher
};

// Notification types
const NOTIFICATION_TYPES = {
  LIKE: 'like',          // Post like
  COMMENT: 'comment',    // Post comment
  FOLLOW: 'follow',      // New follower
  EVENT: 'event',        // Event update
  SYSTEM: 'system'       // System notification
};

// Event status
const EVENT_STATUS = {
  UPCOMING: 'upcoming',  // Not started
  ONGOING: 'ongoing',    // In progress
  COMPLETED: 'completed' // Ended
};

// Media types
const MEDIA_TYPES = {
  IMAGE: 'image',
  VIDEO: 'video'
};

// App theme
const THEME = {
  DARK: 'dark',
  LIGHT: 'light'
};

// App settings
const APP_SETTINGS = {
  DEFAULT_THEME: THEME.DARK,
  MAX_UPLOAD_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_UPLOAD_COUNT: 9,               // Max 9 images/videos
  POST_CONTENT_MAX_LENGTH: 2000,     // Max 2000 characters
  COMMENT_MAX_LENGTH: 500            // Max 500 characters
};

module.exports = {
  API_ENDPOINTS,
  USER_ROLES,
  NOTIFICATION_TYPES,
  EVENT_STATUS,
  MEDIA_TYPES,
  THEME,
  APP_SETTINGS
};