// services/api.js
/**
 * API service functions for WeChat Mini App
 */

const http = require('../utils/http');

/**
 * Authentication Services
 */
const AuthService = {
  // Login with username and password
  login: (username, password) => {
    return http.post('/auth/login', { username, password }, false);
  },
  
  // Register new user
  register: (username, password) => {
    return http.post('/auth/register', { username, password }, false);
  },
  
  // Get current user profile
  getProfile: () => {
    return http.get('/user/profile');
  },
  
  // Update user profile
  updateProfile: (data) => {
    return http.put('/user/profile', data);
  },
  
  // Change password
  changePassword: (oldPassword, newPassword) => {
    return http.put('/user/password', { oldPassword, newPassword });
  }
};

/**
 * Post Services
 */
const PostService = {
  // Get posts for discovery page
  getDiscoveryPosts: (page = 1, limit = 15) => {
    return http.get('/post/get_posts_discover', { page, limit });
  },
  
  // Get recommended posts
  getRecommendedPosts: (page = 1, limit = 15) => {
    return http.get('/posts/recommend', { page, limit });
  },
  
  // Get posts from followed users
  getFollowedPosts: (page = 1, limit = 15) => {
    return http.get('/posts/follow', { page, limit });
  },
  
  // Get user posts
  getUserPosts: (userId, page = 1, limit = 15) => {
    return http.get(`/posts/user/${userId}`, { page, limit });
  },
  
  // Get single post
  getPost: (postId) => {
    return http.get(`/posts/${postId}`);
  },
  
  // Create new post
  createPost: (data) => {
    return http.post('/posts', data);
  },
  
  // Update post
  updatePost: (postId, data) => {
    return http.put(`/posts/${postId}`, data);
  },
  
  // Delete post
  deletePost: (postId) => {
    return http.delete(`/posts/${postId}`);
  },
  
  // Like/unlike post
  toggleLike: (postId) => {
    return http.post(`/posts/${postId}/like`);
  },
  
  // Get post comments
  getComments: (postId, page = 1, limit = 20) => {
    return http.get(`/posts/${postId}/comments`, { page, limit });
  },
  
  // Create comment
  createComment: (postId, content) => {
    return http.post(`/posts/${postId}/comments`, { content });
  }
};

/**
 * User relationship Services
 */
const UserService = {
  // Get followed users
  getFollowings: (page = 1, limit = 20) => {
    return http.get('/user/followings', { page, limit });
  },
  
  // Get followers
  getFollowers: (page = 1, limit = 20) => {
    return http.get('/user/followers', { page, limit });
  },
  
  // Follow user
  followUser: (userId) => {
    return http.post(`/user/${userId}/follow`);
  },
  
  // Unfollow user
  unfollowUser: (userId) => {
    return http.delete(`/user/${userId}/follow`);
  },
  
  // Get user information
  getUserInfo: (userId) => {
    return http.get(`/user/${userId}`);
  },
  
  // Search users
  searchUsers: (keyword, page = 1, limit = 20) => {
    return http.get('/user/search', { keyword, page, limit });
  }
};

/**
 * Event/Competition Services
 */
const EventService = {
  // Get all events
  getEvents: (page = 1, limit = 10) => {
    return http.get('/events', { page, limit });
  },
  
  // Get event details
  getEvent: (eventId) => {
    return http.get(`/teacher/event/${eventId}`);
  },
  
  // Create event (teacher role)
  createEvent: (data) => {
    return http.post('/events', data);
  },
  
  // Update event (teacher role)
  updateEvent: (eventId, data) => {
    return http.put(`/events/${eventId}`, data);
  },
  
  // Delete event (teacher role)
  deleteEvent: (eventId) => {
    return http.delete(`/teacher/event/${eventId}`);
  },
  
  // Join event (student role)
  joinEvent: (eventId) => {
    return http.post(`/events/${eventId}/join`);
  },
  
  // Leave event (student role)
  leaveEvent: (eventId) => {
    return http.delete(`/events/${eventId}/join`);
  }
};

/**
 * Notification Services
 */
const NotificationService = {
  // Get notifications
  getNotifications: (page = 1, limit = 20) => {
    return http.get('/notifications', { page, limit });
  },
  
  // Mark notification as read
  markAsRead: (notificationId) => {
    return http.put(`/notifications/${notificationId}/read`);
  },
  
  // Mark all notifications as read
  markAllAsRead: () => {
    return http.put('/notifications/read-all');
  }
};

/**
 * Chat Services
 */
const ChatService = {
  // Get chat list
  getChatList: () => {
    return http.get('/chats');
  },
  
  // Get chat history
  getChatHistory: (userId, page = 1, limit = 30) => {
    return http.get(`/chats/${userId}`, { page, limit });
  },
  
  // Send message
  sendMessage: (userId, content) => {
    return http.post(`/chats/${userId}`, { content });
  }
};

module.exports = {
  AuthService,
  PostService,
  UserService,
  EventService,
  NotificationService,
  ChatService
};