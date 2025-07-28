/**
 * Professional Post Caching Service for WeChat Mini Program
 * TikTok-style caching with LRU eviction and intelligent preloading
 */

class PostCacheService {
  constructor() {
    // Cache configuration - optimized for WeChat mini program memory constraints
    this.MAX_POST_CACHE_SIZE = 50; // Maximum number of posts to cache
    this.MAX_MEMORY_SIZE = 20 * 1024 * 1024; // 20MB memory limit
    this.CACHE_EXPIRY_TIME = 30 * 60 * 1000; // 30 minutes cache expiry
    
    // Cache storage
    this.postCache = new Map(); // LRU cache for post data
    this.accessOrder = []; // Track access order for LRU
    this.memoryUsage = 0; // Track approximate memory usage
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0
    };
    
    // Post type configurations
    this.cacheKeyTypes = {
      DISCOVER: 'discover',
      RECOMMEND: 'recommend', 
      USER_POSTS: 'user_posts',
      EVENT_POSTS: 'event_posts'
    };
    
    // Initialize cache cleanup interval
    this.initCleanupInterval();
  }

  /**
   * Generate cache key for post
   */
  generateCacheKey(postId, type, options = {}) {
    const baseKey = `${type}_${postId}`;
    if (options.user_id) return `${baseKey}_user_${options.user_id}`;
    if (options.event_id) return `${baseKey}_event_${options.event_id}`;
    if (options.filter) return `${baseKey}_filter_${options.filter}`;
    return baseKey;
  }

  /**
   * Get post from cache with LRU update
   */
  getPost(postId, type, options = {}) {
    const cacheKey = this.generateCacheKey(postId, type, options);
    this.cacheStats.totalRequests++;
    
    if (this.postCache.has(cacheKey)) {
      const cachedData = this.postCache.get(cacheKey);
      
      // Check if cache is still valid
      if (Date.now() - cachedData.timestamp < this.CACHE_EXPIRY_TIME) {
        // Update access order (move to end for LRU)
        this.updateAccessOrder(cacheKey);
        this.cacheStats.hits++;
        
        console.log(`[PostCache] Cache hit for ${cacheKey}`);
        return cachedData.data;
      } else {
        // Cache expired, remove it
        this.removeFromCache(cacheKey);
      }
    }
    
    this.cacheStats.misses++;
    console.log(`[PostCache] Cache miss for ${cacheKey}`);
    return null;
  }

  /**
   * Store post in cache with intelligent eviction
   */
  setPost(postId, type, postData, options = {}) {
    const cacheKey = this.generateCacheKey(postId, type, options);
    
    // Calculate approximate data size
    const dataSize = this.calculateDataSize(postData);
    
    // Check if we need to evict data
    this.ensureCacheCapacity(dataSize);
    
    // Store in cache - supports both new and old API format
    const cacheEntry = {
      data: {
        // Current post (supports both 'current' and 'post' for backward compatibility)
        post: postData.current || postData.post,
        // New format with full post objects
        next_post: postData.next || null,
        previous_post: postData.previous || null,
        // Backward compatibility with old ID format
        next_post_id: postData.next_post_id || postData.next?.id || null,
        previous_post_id: postData.previous_post_id || postData.previous?.id || null
      },
      timestamp: Date.now(),
      size: dataSize,
      type: type,
      accessCount: 1
    };
    
    this.postCache.set(cacheKey, cacheEntry);
    this.updateAccessOrder(cacheKey);
    this.memoryUsage += dataSize;
    
    console.log(`[PostCache] Cached ${cacheKey}, size: ${dataSize}B, total: ${this.memoryUsage}B`);
  }

  /**
   * Preload posts for better navigation experience
   */
  async preloadPosts(postIds, type, options = {}) {
    const preloadPromises = [];
    
    for (const postId of postIds) {
      const cacheKey = this.generateCacheKey(postId, type, options);
      
      // Skip if already cached
      if (this.postCache.has(cacheKey)) {
        continue;
      }
      
      // Create preload promise
      const preloadPromise = this.fetchPostData(postId, type, options)
        .then(data => {
          if (data) {
            this.setPost(postId, type, data, options);
            console.log(`[PostCache] Preloaded post ${postId}`);
          }
        })
        .catch(err => {
          console.warn(`[PostCache] Failed to preload post ${postId}:`, err);
        });
      
      preloadPromises.push(preloadPromise);
    }
    
    return Promise.allSettled(preloadPromises);
  }

  /**
   * Fetch post data from API
   */
  fetchPostData(postId, type, options = {}) {
    return new Promise((resolve, reject) => {
      const params = { type };
      Object.keys(options).forEach(key => {
        if (options[key] !== null && options[key] !== undefined) {
          params[key] = options[key];
        }
      });

      wx.request({
        url: `${getApp().globalData.config.BACKEND_URL}/v2/post/detail/${postId}`,
        method: 'GET',
        data: params,
        header: {
          'Content-Type': 'application/json',
          Authorization: getApp().globalData?.userInfo?.token
            ? `Bearer ${getApp().globalData?.userInfo?.token}`
            : ''
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data.status === 'success') {
            resolve(res.data);
          } else {
            reject(new Error(res.data?.msg || 'Failed to fetch post'));
          }
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
  }

  /**
   * Update access order for LRU management
   */
  updateAccessOrder(cacheKey) {
    // Remove from current position
    const index = this.accessOrder.indexOf(cacheKey);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    
    // Add to end (most recently used)
    this.accessOrder.push(cacheKey);
    
    // Update access count
    if (this.postCache.has(cacheKey)) {
      this.postCache.get(cacheKey).accessCount++;
    }
  }

  /**
   * Ensure cache capacity by evicting LRU items
   */
  ensureCacheCapacity(newDataSize) {
    // Check size-based eviction
    while (
      this.memoryUsage + newDataSize > this.MAX_MEMORY_SIZE && 
      this.accessOrder.length > 0
    ) {
      const lruKey = this.accessOrder[0];
      this.removeFromCache(lruKey);
      this.cacheStats.evictions++;
    }
    
    // Check count-based eviction
    while (this.postCache.size >= this.MAX_POST_CACHE_SIZE) {
      const lruKey = this.accessOrder[0];
      this.removeFromCache(lruKey);
      this.cacheStats.evictions++;
    }
  }

  /**
   * Remove item from cache
   */
  removeFromCache(cacheKey) {
    if (this.postCache.has(cacheKey)) {
      const cacheEntry = this.postCache.get(cacheKey);
      this.memoryUsage -= cacheEntry.size;
      this.postCache.delete(cacheKey);
      
      const index = this.accessOrder.indexOf(cacheKey);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
      
      console.log(`[PostCache] Evicted ${cacheKey}, freed: ${cacheEntry.size}B`);
    }
  }

  /**
   * Calculate approximate data size
   */
  calculateDataSize(data) {
    try {
      return JSON.stringify(data).length * 2; // Rough estimate (UTF-16)
    } catch (e) {
      return 1024; // Default estimate
    }
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredEntries() {
    const now = Date.now();
    const expiredKeys = [];
    
    for (const [key, entry] of this.postCache.entries()) {
      if (now - entry.timestamp > this.CACHE_EXPIRY_TIME) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.removeFromCache(key));
    
    if (expiredKeys.length > 0) {
      console.log(`[PostCache] Cleared ${expiredKeys.length} expired entries`);
    }
  }

  /**
   * Initialize cleanup interval
   */
  initCleanupInterval() {
    // Run cleanup every 5 minutes
    setInterval(() => {
      this.clearExpiredEntries();
    }, 5 * 60 * 1000);
  }

  /**
   * Invalidate cache for specific post or pattern
   */
  invalidateCache(pattern) {
    const keysToRemove = [];
    
    for (const key of this.postCache.keys()) {
      if (typeof pattern === 'string' && key.includes(pattern)) {
        keysToRemove.push(key);
      } else if (pattern instanceof RegExp && pattern.test(key)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => this.removeFromCache(key));
    console.log(`[PostCache] Invalidated ${keysToRemove.length} cache entries`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.cacheStats.totalRequests > 0 
      ? (this.cacheStats.hits / this.cacheStats.totalRequests * 100).toFixed(2)
      : 0;
    
    return {
      ...this.cacheStats,
      hitRate: `${hitRate}%`,
      cacheSize: this.postCache.size,
      memoryUsage: `${(this.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
      maxMemory: `${(this.MAX_MEMORY_SIZE / 1024 / 1024).toFixed(2)}MB`
    };
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.postCache.clear();
    this.accessOrder = [];
    this.memoryUsage = 0;
    console.log('[PostCache] Cache cleared');
  }

  /**
   * Warmup cache with initial posts
   */
  async warmupCache(type, options = {}) {
    try {
      console.log(`[PostCache] Warming up cache for type: ${type}`);
      
      // Fetch initial batch of posts based on type
      let url, params;
      
      switch (type) {
        case this.cacheKeyTypes.DISCOVER:
          url = `${getApp().globalData.config.BACKEND_URL}/v2/post/discover`;
          params = { limit: 5, offset: 0 };
          break;
        case this.cacheKeyTypes.RECOMMEND:
          url = `${getApp().globalData.config.BACKEND_URL}/v2/post/recommend`;
          params = { limit: 5, offset: 0, ...options };
          break;
        default:
          return;
      }
      
      const response = await new Promise((resolve, reject) => {
        wx.request({
          url,
          method: 'GET',
          data: params,
          header: {
            'Content-Type': 'application/json',
            Authorization: getApp().globalData?.userInfo?.token
              ? `Bearer ${getApp().globalData?.userInfo?.token}`
              : ''
          },
          success: resolve,
          fail: reject
        });
      });
      
      if (response.statusCode === 200 && response.data.status === 'success') {
        const posts = response.data.posts || [];
        const postIds = posts.map(post => post.id).slice(0, 3); // Cache first 3 posts
        
        await this.preloadPosts(postIds, type, options);
        console.log(`[PostCache] Warmed up cache with ${postIds.length} posts`);
      }
    } catch (err) {
      console.warn('[PostCache] Cache warmup failed:', err);
    }
  }
}

// Create singleton instance
const postCacheService = new PostCacheService();

module.exports = postCacheService;