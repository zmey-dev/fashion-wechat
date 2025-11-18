const { default: config } = require("../config");

/**
 * WeChat Mini Program Share Helper
 * Provides centralized share configuration for all pages
 */

/**
 * Get share configuration for sharing to friends/groups
 * @param {Object} options - Share options
 * @param {string} options.title - Share title (Chinese)
 * @param {string} options.path - Share path/route
 * @param {string} options.imageUrl - Share image URL
 * @param {Object} options.post - Post object (optional)
 * @returns {Object} Share configuration
 */
function getShareConfig(options = {}) {
  const { title, path, imageUrl, post } = options;

  // If post object is provided, extract share info from post
  if (post) {
    const shareImage = post.media && post.media.length > 0
      ? post.media[0].preview_url || post.media[0].url
      : '';

    return {
      title: post.title || '查看这个精彩内容',
      path: path || `/pages/post-detail/post-detail?postId=${post.id}`,
      imageUrl: shareImage
    };
  }

  // Default share configuration
  return {
    title: title || '校Show - 发现精彩内容',
    path: path || '/pages/index/index',
    imageUrl: imageUrl || ''
  };
}

/**
 * Get share configuration for sharing to WeChat Moments (朋友圈)
 * @param {Object} options - Share options
 * @param {string} options.title - Share title (Chinese)
 * @param {string} options.query - Query parameters
 * @param {string} options.imageUrl - Share image URL
 * @returns {Object} Moments share configuration
 */
function getTimelineConfig(options = {}) {
  const { title, query, imageUrl } = options;

  return {
    title: title || '校Show - 发现精彩内容',
    query: query || '',
    imageUrl: imageUrl || ''
  };
}

/**
 * Get current page route and parameters
 * Useful for sharing current page with all query parameters
 * @returns {Object} Current page info
 */
function getCurrentPageInfo() {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];

  if (!currentPage) {
    return {
      route: 'pages/index/index',
      options: {}
    };
  }

  return {
    route: currentPage.route,
    options: currentPage.options || {}
  };
}

/**
 * Build share path from route and options
 * @param {string} route - Page route
 * @param {Object} options - Query parameters
 * @returns {string} Complete share path
 */
function buildSharePath(route, options = {}) {
  const queryString = Object.keys(options)
    .map(key => `${key}=${options[key]}`)
    .join('&');

  return queryString ? `/${route}?${queryString}` : `/${route}`;
}

/**
 * Pre-configured share configs for common pages
 */
const PAGE_SHARE_CONFIGS = {
  // Discover page
  'pages/index/index': {
    title: '校Show - 发现精彩内容',
    path: '/pages/index/index'
  },

  // Recommend page
  'pages/recommend/recommend': {
    title: '校Show - 为你推荐',
    path: '/pages/recommend/recommend'
  },

  // Follow page
  'pages/follow/follow': {
    title: '校Show - 关注动态',
    path: '/pages/follow/follow'
  },

  // Friend page
  'pages/friend/friend': {
    title: '校Show - 好友',
    path: '/pages/friend/friend'
  },

  // Event page
  'pages/event/event': {
    title: '校Show - 活动',
    path: '/pages/event/event'
  },

  // Profile page
  'pages/me/me': {
    title: '校Show - 我的',
    path: '/pages/index/index'
  },

  // Contact page
  'pages/contact/contact': {
    title: '校Show - 消息',
    path: '/pages/index/index'
  }
};

/**
 * Get default share config for current page
 * @returns {Object} Share configuration
 */
function getDefaultShareConfig() {
  const pageInfo = getCurrentPageInfo();
  const preConfig = PAGE_SHARE_CONFIGS[pageInfo.route];

  if (preConfig) {
    return preConfig;
  }

  // Fallback to generic config
  return {
    title: '校Show - 发现精彩内容',
    path: buildSharePath(pageInfo.route, pageInfo.options)
  };
}

/**
 * Increment share count for a post
 * @param {number} postId - Post ID to increment share count
 */
function incrementShareCount(postId) {
  if (!postId) return;

  wx.request({
    url: `${config.BACKEND_URL}/post/save_share`,
    method: "POST",
    data: { post_id: postId },
    header: {
      "Content-Type": "application/json"
    },
    success: (res) => {
      console.log("Share count incremented:", res.data);
    },
    fail: (err) => {
      console.error("Failed to increment share count:", err);
    }
  });
}

module.exports = {
  getShareConfig,
  getTimelineConfig,
  getCurrentPageInfo,
  buildSharePath,
  getDefaultShareConfig,
  incrementShareCount,
  PAGE_SHARE_CONFIGS
};
