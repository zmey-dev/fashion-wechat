/**
 * TikTok-style Post Preloader Service for WeChat Mini Program
 * Intelligent preloading with network-aware optimizations
 */

const postCacheService = require('./postCache');
const mediaPreloaderService = require('./mediaPreloader');

class PostPreloaderService {
  constructor() {
    // Preloading configuration
    this.PRELOAD_DISTANCE = 3; // Number of posts to preload ahead/behind
    this.MAX_CONCURRENT_REQUESTS = 2; // Limit concurrent API requests
    this.PRELOAD_DELAY = 100; // Delay between preload requests (ms)
    
    // Network conditions
    this.networkType = 'unknown';
    this.isOnWifi = false;
    this.currentBandwidth = 'unknown';
    
    // Preloading queues
    this.preloadQueue = [];
    this.activeRequests = new Set();
    this.preloadHistory = new Set(); // Track what we've attempted to preload
    
    // Current session state
    this.currentPostId = null;
    this.currentType = null;
    this.currentOptions = {};
    this.navigationContext = {
      nextPostId: null,
      previousPostId: null,
      nextChain: [], // Chain of next post IDs
      previousChain: [] // Chain of previous post IDs
    };
    
    // Performance tracking
    this.stats = {
      preloadRequests: 0,
      preloadSuccesses: 0,
      preloadFailures: 0,
      cacheHits: 0,
      navigationTime: []
    };
    
    this.initNetworkMonitoring();
  }

  /**
   * Initialize network monitoring for adaptive preloading
   */
  initNetworkMonitoring() {
    // Get initial network info
    wx.getNetworkType({
      success: (res) => {
        this.networkType = res.networkType;
        this.isOnWifi = res.networkType === 'wifi';
        this.adjustPreloadingStrategy();
      }
    });

    // Monitor network changes
    wx.onNetworkStatusChange((res) => {
      this.networkType = res.networkType;
      this.isOnWifi = res.isConnected && res.networkType === 'wifi';
      this.adjustPreloadingStrategy();
      
    });
  }

  /**
   * Adjust preloading strategy based on network conditions
   */
  adjustPreloadingStrategy() {
    if (this.isOnWifi) {
      this.PRELOAD_DISTANCE = 5;
      this.MAX_CONCURRENT_REQUESTS = 3;
    } else if (this.networkType === '4g') {
      this.PRELOAD_DISTANCE = 3;
      this.MAX_CONCURRENT_REQUESTS = 2;
    } else if (this.networkType === '3g') {
      this.PRELOAD_DISTANCE = 2;
      this.MAX_CONCURRENT_REQUESTS = 1;
    } else {
      this.PRELOAD_DISTANCE = 1;
      this.MAX_CONCURRENT_REQUESTS = 1;
    }
    
  }

  /**
   * Set current post context and trigger intelligent preloading
   */
  setCurrentPost(postId, type, options = {}, navigationData = {}, currentPostData = null) {
    const startTime = Date.now();
    
    // Update current context
    this.currentPostId = postId;
    this.currentType = type;
    this.currentOptions = options;
    
    // Update navigation context with new API format (including null values)
    this.navigationContext.nextPostId = navigationData.next_post_id || null;
    this.navigationContext.previousPostId = navigationData.previous_post_id || null;
    
    // If we have full post objects, cache them immediately for instant navigation
    if (navigationData.next_post) {
      // Create proper cache data structure for next post
      const nextCacheData = {
        current: navigationData.next_post,
        post: navigationData.next_post, // Backward compatibility
        next: null, // Will be filled when this post becomes current
        previous: null,
        next_post_id: null,
        previous_post_id: null
      };
      
      postCacheService.setPost(
        navigationData.next_post.id, 
        this.currentType, 
        nextCacheData, 
        this.currentOptions
      );
      
      // Preload next post media with high priority
      if (navigationData.next_post.media && navigationData.next_post.media.length > 0) {
        mediaPreloaderService.preloadPostMedia(navigationData.next_post, mediaPreloaderService.PRIORITY.HIGH);
      }
    }
    
    if (navigationData.previous_post) {
      // Create proper cache data structure for previous post
      const prevCacheData = {
        current: navigationData.previous_post,
        post: navigationData.previous_post, // Backward compatibility
        next: null, // Will be filled when this post becomes current
        previous: null,
        next_post_id: null,
        previous_post_id: null
      };
      
      postCacheService.setPost(
        navigationData.previous_post.id, 
        this.currentType, 
        prevCacheData, 
        this.currentOptions
      );
      
      // Preload previous post media with medium priority
      if (navigationData.previous_post.media && navigationData.previous_post.media.length > 0) {
        mediaPreloaderService.preloadPostMedia(navigationData.previous_post, mediaPreloaderService.PRIORITY.MEDIUM);
      }
    }
    
    
    // Preload current post media with highest priority (this was moved from post-detail.js to prevent duplication)
    if (currentPostData && currentPostData.media && currentPostData.media.length > 0) {
      mediaPreloaderService.preloadPostMedia(currentPostData, mediaPreloaderService.PRIORITY.CRITICAL);
    }
    
    // Track navigation performance
    if (this.stats.navigationTime.length > 0) {
      const navTime = startTime - this.stats.navigationTime[this.stats.navigationTime.length - 1];
    }
    this.stats.navigationTime.push(startTime);
    
    // Keep only last 10 navigation times
    if (this.stats.navigationTime.length > 10) {
      this.stats.navigationTime = this.stats.navigationTime.slice(-10);
    }
    
    // Trigger preloading
    this.startIntelligentPreloading();
  }

  /**
   * Start intelligent preloading based on current context
   */
  async startIntelligentPreloading() {
    
    // Build preload candidates
    const candidates = this.buildPreloadCandidates();
    
    // Add to preload queue with priority
    candidates.forEach(candidate => {
      if (!this.preloadHistory.has(candidate.cacheKey)) {
        this.addToPreloadQueue(candidate);
      }
    });
    
    // Process queue
    this.processPreloadQueue();
  }

  /**
   * Build list of posts to preload based on navigation context
   */
  buildPreloadCandidates() {
    const candidates = [];
    
    // Immediate next/previous posts (highest priority)
    if (this.navigationContext.nextPostId) {
      candidates.push({
        postId: this.navigationContext.nextPostId,
        type: this.currentType,
        options: this.currentOptions,
        priority: 1,
        direction: 'next',
        cacheKey: postCacheService.generateCacheKey(
          this.navigationContext.nextPostId, 
          this.currentType, 
          this.currentOptions
        )
      });
    }
    
    if (this.navigationContext.previousPostId) {
      candidates.push({
        postId: this.navigationContext.previousPostId,
        type: this.currentType,
        options: this.currentOptions,
        priority: 1,
        direction: 'previous',
        cacheKey: postCacheService.generateCacheKey(
          this.navigationContext.previousPostId, 
          this.currentType, 
          this.currentOptions
        )
      });
    }
    
    // Extended chain preloading (lower priority)
    this.addChainCandidates(candidates, 'next', this.navigationContext.nextChain);
    this.addChainCandidates(candidates, 'previous', this.navigationContext.previousChain);
    
    return candidates.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Add chain candidates to preload list
   */
  addChainCandidates(candidates, direction, chain) {
    const maxDistance = Math.min(this.PRELOAD_DISTANCE - 1, chain.length);
    
    for (let i = 0; i < maxDistance; i++) {
      const postId = chain[i];
      if (postId) {
        candidates.push({
          postId: postId,
          type: this.currentType,
          options: this.currentOptions,
          priority: 2 + i, // Lower priority, increasing with distance
          direction: direction,
          cacheKey: postCacheService.generateCacheKey(postId, this.currentType, this.currentOptions)
        });
      }
    }
  }

  /**
   * Add candidate to preload queue
   */
  addToPreloadQueue(candidate) {
    // Check if already cached
    const cached = postCacheService.getPost(candidate.postId, candidate.type, candidate.options);
    if (cached) {
      this.stats.cacheHits++;
      return;
    }
    
    // Check if already in queue or being processed
    if (this.activeRequests.has(candidate.cacheKey) || 
        this.preloadQueue.some(item => item.cacheKey === candidate.cacheKey)) {
      return;
    }
    
    // Add to queue
    this.preloadQueue.push(candidate);
    this.preloadHistory.add(candidate.cacheKey);
    
    console.log(`[PostPreloader] Added to queue: ${candidate.postId} (${candidate.direction}, priority: ${candidate.priority})`);
  }

  /**
   * Process preload queue with concurrency control
   */
  async processPreloadQueue() {
    while (this.preloadQueue.length > 0 && this.activeRequests.size < this.MAX_CONCURRENT_REQUESTS) {
      const candidate = this.preloadQueue.shift();
      
      if (this.activeRequests.has(candidate.cacheKey)) {
        continue;
      }
      
      this.activeRequests.add(candidate.cacheKey);
      
      // Process with delay to avoid overwhelming the network
      setTimeout(() => {
        this.preloadPost(candidate);
      }, this.PRELOAD_DELAY * this.activeRequests.size);
    }
  }

  /**
   * Preload a single post
   */
  async preloadPost(candidate) {
    console.log(`[PostPreloader] Preloading: ${candidate.postId}`);
    this.stats.preloadRequests++;
    
    try {
      const data = await postCacheService.fetchPostData(
        candidate.postId, 
        candidate.type, 
        candidate.options
      );
      
      if (data) {
        // Cache the post data
        postCacheService.setPost(candidate.postId, candidate.type, data, candidate.options);
        
        // Update navigation chains if this is immediate next/previous
        if (candidate.priority === 1) {
          this.updateNavigationChains(candidate, data);
        }
        
        this.stats.preloadSuccesses++;
        console.log(`[PostPreloader] Successfully preloaded: ${candidate.postId}`);
      }
    } catch (error) {
      this.stats.preloadFailures++;
      console.warn(`[PostPreloader] Failed to preload ${candidate.postId}:`, error);
    } finally {
      this.activeRequests.delete(candidate.cacheKey);
      
      // Continue processing queue
      if (this.preloadQueue.length > 0) {
        this.processPreloadQueue();
      }
    }
  }

  /**
   * Update navigation chains based on preloaded data
   */
  updateNavigationChains(candidate, data) {
    if (candidate.direction === 'next' && data.next_post_id) {
      if (!this.navigationContext.nextChain.includes(data.next_post_id)) {
        this.navigationContext.nextChain.unshift(data.next_post_id);
        // Keep chain reasonable length
        if (this.navigationContext.nextChain.length > this.PRELOAD_DISTANCE * 2) {
          this.navigationContext.nextChain = this.navigationContext.nextChain.slice(0, this.PRELOAD_DISTANCE * 2);
        }
      }
    } else if (candidate.direction === 'previous' && data.previous_post_id) {
      if (!this.navigationContext.previousChain.includes(data.previous_post_id)) {
        this.navigationContext.previousChain.unshift(data.previous_post_id);
        // Keep chain reasonable length
        if (this.navigationContext.previousChain.length > this.PRELOAD_DISTANCE * 2) {
          this.navigationContext.previousChain = this.navigationContext.previousChain.slice(0, this.PRELOAD_DISTANCE * 2);
        }
      }
    }
  }

  /**
   * Get next post with instant loading from cache
   */
  async getNextPost() {
    if (!this.navigationContext.nextPostId) {
      return null;
    }
    
    const startTime = Date.now();
    
    // Try to get from cache first
    let cachedData = postCacheService.getPost(
      this.navigationContext.nextPostId, 
      this.currentType, 
      this.currentOptions
    );
    
    if (cachedData) {
      const loadTime = Date.now() - startTime;
      console.log(`[PostPreloader] Next post loaded from cache in ${loadTime}ms`);
      return cachedData;
    }
    
    // Fallback to API request
    console.log(`[PostPreloader] Next post not in cache, fetching from API`);
    try {
      const data = await postCacheService.fetchPostData(
        this.navigationContext.nextPostId,
        this.currentType,
        this.currentOptions
      );
      
      if (data) {
        postCacheService.setPost(this.navigationContext.nextPostId, this.currentType, data, this.currentOptions);
        return data;
      }
    } catch (error) {
      console.error('[PostPreloader] Failed to fetch next post:', error);
    }
    
    return null;
  }

  /**
   * Get previous post with instant loading from cache
   */
  async getPreviousPost() {
    if (!this.navigationContext.previousPostId) {
      return null;
    }
    
    const startTime = Date.now();
    
    // Try to get from cache first
    let cachedData = postCacheService.getPost(
      this.navigationContext.previousPostId,
      this.currentType,
      this.currentOptions
    );
    
    if (cachedData) {
      const loadTime = Date.now() - startTime;
      console.log(`[PostPreloader] Previous post loaded from cache in ${loadTime}ms`);
      return cachedData;
    }
    
    // Fallback to API request
    console.log(`[PostPreloader] Previous post not in cache, fetching from API`);
    try {
      const data = await postCacheService.fetchPostData(
        this.navigationContext.previousPostId,
        this.currentType,
        this.currentOptions
      );
      
      if (data) {
        postCacheService.setPost(this.navigationContext.previousPostId, this.currentType, data, this.currentOptions);
        return data;
      }
    } catch (error) {
      console.error('[PostPreloader] Failed to fetch previous post:', error);
    }
    
    return null;
  }

  /**
   * Clear preload queue and reset state
   */
  clearPreloadQueue() {
    this.preloadQueue = [];
    this.activeRequests.clear();
    this.preloadHistory.clear();
    this.navigationContext = {
      nextPostId: null,
      previousPostId: null,
      nextChain: [],
      previousChain: []
    };
    
    console.log('[PostPreloader] Preload queue cleared');
  }

  /**
   * Optimize for specific usage patterns
   */
  optimizeForPattern(pattern) {
    switch (pattern) {
      case 'binge_watching':
        // User is rapidly consuming content
        this.PRELOAD_DISTANCE = Math.min(this.isOnWifi ? 8 : 5, this.PRELOAD_DISTANCE * 2);
        this.MAX_CONCURRENT_REQUESTS = Math.min(4, this.MAX_CONCURRENT_REQUESTS + 1);
        break;
      case 'casual_browsing':
        // User is browsing slowly
        this.PRELOAD_DISTANCE = Math.max(2, Math.floor(this.PRELOAD_DISTANCE / 2));
        break;
      case 'poor_network':
        // Network is struggling
        this.PRELOAD_DISTANCE = 1;
        this.MAX_CONCURRENT_REQUESTS = 1;
        break;
    }
    
    console.log(`[PostPreloader] Optimized for pattern: ${pattern}`);
  }

  /**
   * Get preloader statistics
   */
  getStats() {
    const successRate = this.stats.preloadRequests > 0 
      ? (this.stats.preloadSuccesses / this.stats.preloadRequests * 100).toFixed(2)
      : 0;
    
    const avgNavigationTime = this.stats.navigationTime.length > 0
      ? this.stats.navigationTime.reduce((a, b, i) => i === 0 ? 0 : a + (b - this.stats.navigationTime[i-1]), 0) / Math.max(1, this.stats.navigationTime.length - 1)
      : 0;
    
    return {
      ...this.stats,
      successRate: `${successRate}%`,
      queueLength: this.preloadQueue.length,
      activeRequests: this.activeRequests.size,
      networkType: this.networkType,
      isOnWifi: this.isOnWifi,
      preloadDistance: this.PRELOAD_DISTANCE,
      avgNavigationTime: `${avgNavigationTime.toFixed(0)}ms`,
      cacheStats: postCacheService.getStats()
    };
  }
}

// Create singleton instance
const postPreloaderService = new PostPreloaderService();

module.exports = postPreloaderService;