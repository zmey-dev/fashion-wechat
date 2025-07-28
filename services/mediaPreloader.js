/**
 * Professional Media Preloader Service for WeChat Mini Program
 * Handles image and video preloading with intelligent queue management
 */

class MediaPreloaderService {
  constructor() {
    // Configuration
    this.MAX_CONCURRENT_DOWNLOADS = 3;
    this.MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB
    this.MAX_SINGLE_FILE_SIZE = 20 * 1024 * 1024; // 20MB per file
    this.PRELOAD_TIMEOUT = 15000; // 15 seconds timeout
    
    // Queue management
    this.downloadQueue = [];
    this.activeDownloads = new Map();
    this.downloadHistory = new Set();
    this.failedDownloads = new Set();
    
    // Cache storage
    this.mediaCache = new Map();
    this.cacheSize = 0;
    this.accessOrder = []; // For LRU eviction
    
    // Post-level preloading tracking to prevent duplicates
    this.preloadedPosts = new Set(); // Track which posts have been preloaded
    this.activePostPreloads = new Map(); // Track active post preloading
    
    // Network conditions
    this.networkType = 'unknown';
    this.isOnWifi = false;
    
    // Performance tracking
    this.stats = {
      totalRequests: 0,
      successfulDownloads: 0,
      failedDownloads: 0,
      cacheHits: 0,
      cacheMisses: 0,
      bytesDownloaded: 0,
      avgDownloadTime: 0
    };
    
    // Priority levels
    this.PRIORITY = {
      CRITICAL: 1,    // Current post media
      HIGH: 2,        // Next/previous post media
      MEDIUM: 3,      // Chain preload media
      LOW: 4          // Background preload
    };
    
    this.initNetworkMonitoring();
    this.initCacheCleanup();
  }

  /**
   * Initialize network monitoring
   */
  initNetworkMonitoring() {
    wx.getNetworkType({
      success: (res) => {
        this.networkType = res.networkType;
        this.isOnWifi = res.networkType === 'wifi';
        this.adjustDownloadStrategy();
      }
    });

    wx.onNetworkStatusChange((res) => {
      this.networkType = res.networkType;
      this.isOnWifi = res.isConnected && res.networkType === 'wifi';
      this.adjustDownloadStrategy();
    });
  }

  /**
   * Adjust download strategy based on network
   */
  adjustDownloadStrategy() {
    if (this.isOnWifi) {
      this.MAX_CONCURRENT_DOWNLOADS = 4;
    } else if (this.networkType === '4g') {
      this.MAX_CONCURRENT_DOWNLOADS = 3;
    } else {
      this.MAX_CONCURRENT_DOWNLOADS = 2;
    }
    
    console.log(`[MediaPreloader] Strategy adjusted for ${this.networkType}, concurrent: ${this.MAX_CONCURRENT_DOWNLOADS}`);
  }

  /**
   * Initialize cache cleanup
   */
  initCacheCleanup() {
    // Clean up cache every 10 minutes
    setInterval(() => {
      this.cleanupCache();
    }, 10 * 60 * 1000);
  }

  /**
   * Preload media for a post
   */
  preloadPostMedia(post, priority = this.PRIORITY.MEDIUM) {
    if (!post || !post.media || !Array.isArray(post.media)) {
      return Promise.resolve([]);
    }
    
    const postKey = `${post.id}_${priority}`;
    
    // Check if this post is already preloaded with this priority
    if (this.preloadedPosts.has(postKey)) {
      console.log(`[MediaPreloader] Post ${post.id} already preloaded with priority ${priority}`);
      return Promise.resolve([]);
    }
    
    // Check if this post is currently being preloaded
    if (this.activePostPreloads.has(postKey)) {
      console.log(`[MediaPreloader] Post ${post.id} already being preloaded with priority ${priority}`);
      return this.activePostPreloads.get(postKey);
    }
    
    console.log(`[MediaPreloader] Preloading media for post ${post.id}, ${post.media.length} items, priority: ${priority}`);
    
    const preloadPromises = post.media.map((mediaItem, index) => {
      return this.preloadMediaItem(mediaItem, {
        postId: post.id,
        mediaIndex: index,
        priority: priority,
        isFirstMedia: index === 0 // First media gets higher priority
      });
    });
    
    const allPromises = Promise.allSettled(preloadPromises).then(results => {
      // Mark post as preloaded when done
      this.preloadedPosts.add(postKey);
      this.activePostPreloads.delete(postKey);
      return results;
    });
    
    // Track active preloading
    this.activePostPreloads.set(postKey, allPromises);
    
    return allPromises;
  }

  /**
   * Preload a single media item
   */
  async preloadMediaItem(mediaItem, options = {}) {
    if (!mediaItem || !mediaItem.url) {
      return Promise.resolve(null);
    }
    
    const url = mediaItem.url;
    const cacheKey = this.generateCacheKey(url);
    
    // Check if already cached
    if (this.mediaCache.has(cacheKey)) {
      this.updateAccessOrder(cacheKey);
      this.stats.cacheHits++;
      console.log(`[MediaPreloader] Media cache hit: ${url}`);
      return this.mediaCache.get(cacheKey);
    }
    
    // Check if already downloading
    if (this.activeDownloads.has(cacheKey)) {
      console.log(`[MediaPreloader] Media already downloading: ${url}`);
      return this.activeDownloads.get(cacheKey).promise;
    }
    
    // Check if previously failed
    if (this.failedDownloads.has(cacheKey)) {
      console.log(`[MediaPreloader] Media previously failed: ${url}`);
      return Promise.resolve(null);
    }
    
    this.stats.totalRequests++;
    this.stats.cacheMisses++;
    
    // Create download task
    const downloadTask = {
      url,
      cacheKey,
      mediaType: mediaItem.type || this.detectMediaType(url),
      priority: options.isFirstMedia ? Math.max(1, options.priority - 1) : options.priority,
      postId: options.postId,
      mediaIndex: options.mediaIndex,
      timestamp: Date.now()
    };
    
    // Add to queue or start immediate download
    if (this.activeDownloads.size < this.MAX_CONCURRENT_DOWNLOADS) {
      return this.startDownload(downloadTask);
    } else {
      return this.addToQueue(downloadTask);
    }
  }

  /**
   * Start downloading media
   */
  async startDownload(downloadTask) {
    const { url, cacheKey, mediaType } = downloadTask;
    const startTime = Date.now();
    
    console.log(`[MediaPreloader] Starting download: ${url}`);
    
    // Create download promise
    const downloadPromise = new Promise((resolve, reject) => {
      const downloadTimeout = setTimeout(() => {
        reject(new Error('Download timeout'));
      }, this.PRELOAD_TIMEOUT);
      
      if (mediaType === 'image') {
        // Preload image
        const image = wx.createOffscreenCanvas({width: 1, height: 1});
        const ctx = image.getContext('2d');
        
        const img = image.createImage();
        img.onload = () => {
          clearTimeout(downloadTimeout);
          const downloadTime = Date.now() - startTime;
          this.handleDownloadSuccess(downloadTask, { localPath: url, size: 0 }, downloadTime);
          resolve({ localPath: url, cached: true });
        };
        img.onerror = (error) => {
          clearTimeout(downloadTimeout);
          this.handleDownloadFailure(downloadTask, error);
          reject(error);
        };
        img.src = url;
      } else if (mediaType === 'video') {
        // For videos, we'll download them to local storage
        wx.downloadFile({
          url: url,
          success: (res) => {
            clearTimeout(downloadTimeout);
            if (res.statusCode === 200) {
              const downloadTime = Date.now() - startTime;
              
              // Get file size
              wx.getFileInfo({
                filePath: res.tempFilePath,
                success: (fileInfo) => {
                  if (fileInfo.size > this.MAX_SINGLE_FILE_SIZE) {
                    console.warn(`[MediaPreloader] File too large: ${fileInfo.size}B`);
                    this.handleDownloadFailure(downloadTask, new Error('File too large'));
                    reject(new Error('File too large'));
                    return;
                  }
                  
                  this.handleDownloadSuccess(downloadTask, {
                    localPath: res.tempFilePath,
                    size: fileInfo.size
                  }, downloadTime);
                  resolve({ localPath: res.tempFilePath, cached: true });
                },
                fail: (error) => {
                  this.handleDownloadFailure(downloadTask, error);
                  reject(error);
                }
              });
            } else {
              const error = new Error(`Download failed with status: ${res.statusCode}`);
              this.handleDownloadFailure(downloadTask, error);
              reject(error);
            }
          },
          fail: (error) => {
            clearTimeout(downloadTimeout);
            this.handleDownloadFailure(downloadTask, error);
            reject(error);
          }
        });
      } else {
        clearTimeout(downloadTimeout);
        resolve({ localPath: url, cached: false });
      }
    });
    
    // Track active download
    this.activeDownloads.set(cacheKey, {
      promise: downloadPromise,
      task: downloadTask,
      startTime
    });
    
    try {
      const result = await downloadPromise;
      return result;
    } finally {
      this.activeDownloads.delete(cacheKey);
      this.processQueue();
    }
  }

  /**
   * Handle successful download
   */
  handleDownloadSuccess(downloadTask, result, downloadTime) {
    const { cacheKey } = downloadTask;
    
    // Update stats
    this.stats.successfulDownloads++;
    this.stats.bytesDownloaded += result.size || 0;
    this.updateAverageDownloadTime(downloadTime);
    
    // Ensure cache capacity
    this.ensureCacheCapacity(result.size || 0);
    
    // Cache the result
    this.mediaCache.set(cacheKey, {
      localPath: result.localPath,
      originalUrl: downloadTask.url,
      size: result.size || 0,
      mediaType: downloadTask.mediaType,
      timestamp: Date.now(),
      accessCount: 1
    });
    
    this.updateAccessOrder(cacheKey);
    this.cacheSize += result.size || 0;
    
    console.log(`[MediaPreloader] Download success: ${downloadTask.url} (${downloadTime}ms)`);
  }

  /**
   * Handle download failure
   */
  handleDownloadFailure(downloadTask, error) {
    const { cacheKey } = downloadTask;
    
    this.stats.failedDownloads++;
    this.failedDownloads.add(cacheKey);
    
    console.warn(`[MediaPreloader] Download failed: ${downloadTask.url}`, error);
  }

  /**
   * Add download task to queue
   */
  addToQueue(downloadTask) {
    // Insert based on priority
    let insertIndex = this.downloadQueue.length;
    for (let i = 0; i < this.downloadQueue.length; i++) {
      if (this.downloadQueue[i].priority > downloadTask.priority) {
        insertIndex = i;
        break;
      }
    }
    
    this.downloadQueue.splice(insertIndex, 0, downloadTask);
    
    console.log(`[MediaPreloader] Added to queue: ${downloadTask.url} (priority: ${downloadTask.priority})`);
    
    // Return a promise that will be resolved when the task is processed
    return new Promise((resolve, reject) => {
      downloadTask.resolve = resolve;
      downloadTask.reject = reject;
    });
  }

  /**
   * Process download queue
   */
  processQueue() {
    while (this.downloadQueue.length > 0 && this.activeDownloads.size < this.MAX_CONCURRENT_DOWNLOADS) {
      const task = this.downloadQueue.shift();
      
      this.startDownload(task)
        .then(result => {
          if (task.resolve) task.resolve(result);
        })
        .catch(error => {
          if (task.reject) task.reject(error);
        });
    }
  }

  /**
   * Get cached media
   */
  getCachedMedia(url) {
    const cacheKey = this.generateCacheKey(url);
    
    if (this.mediaCache.has(cacheKey)) {
      const cached = this.mediaCache.get(cacheKey);
      this.updateAccessOrder(cacheKey);
      cached.accessCount++;
      return cached.localPath;
    }
    
    return null;
  }

  /**
   * Check if media is cached
   */
  isMediaCached(url) {
    const cacheKey = this.generateCacheKey(url);
    return this.mediaCache.has(cacheKey);
  }

  /**
   * Get or preload media with fallback
   */
  async getOrPreloadMedia(mediaItem, options = {}) {
    if (!mediaItem || !mediaItem.url) {
      return null;
    }
    
    // Try cache first
    const cachedPath = this.getCachedMedia(mediaItem.url);
    if (cachedPath) {
      return cachedPath;
    }
    
    // Start preload
    try {
      const result = await this.preloadMediaItem(mediaItem, options);
      return result ? result.localPath : mediaItem.url;
    } catch (error) {
      console.warn(`[MediaPreloader] Failed to preload media: ${mediaItem.url}`, error);
      return mediaItem.url; // Fallback to original URL
    }
  }

  /**
   * Detect media type from URL
   */
  detectMediaType(url) {
    const extension = url.split('.').pop().toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
      return 'image';
    } else if (['mp4', 'mov', 'avi', 'webm'].includes(extension)) {
      return 'video';
    } else if (['mp3', 'wav', 'aac', 'm4a'].includes(extension)) {
      return 'audio';
    }
    
    return 'unknown';
  }

  /**
   * Generate cache key for URL
   */
  generateCacheKey(url) {
    // Simple hash function for cache key
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `media_${Math.abs(hash)}`;
  }

  /**
   * Update access order for LRU
   */
  updateAccessOrder(cacheKey) {
    const index = this.accessOrder.indexOf(cacheKey);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(cacheKey);
  }

  /**
   * Ensure cache capacity
   */
  ensureCacheCapacity(newSize) {
    while (this.cacheSize + newSize > this.MAX_CACHE_SIZE && this.accessOrder.length > 0) {
      const lruKey = this.accessOrder.shift();
      if (this.mediaCache.has(lruKey)) {
        const cached = this.mediaCache.get(lruKey);
        this.cacheSize -= cached.size;
        this.mediaCache.delete(lruKey);
        
        // Clean up local file if it's a downloaded video
        if (cached.mediaType === 'video' && cached.localPath !== cached.originalUrl) {
          wx.removeSavedFile({
            filePath: cached.localPath,
            success: () => console.log(`[MediaPreloader] Cleaned up: ${cached.localPath}`),
            fail: () => {} // Ignore cleanup failures
          });
        }
        
        console.log(`[MediaPreloader] Evicted from cache: ${cached.originalUrl}`);
      }
    }
  }

  /**
   * Update average download time
   */
  updateAverageDownloadTime(downloadTime) {
    if (this.stats.avgDownloadTime === 0) {
      this.stats.avgDownloadTime = downloadTime;
    } else {
      this.stats.avgDownloadTime = (this.stats.avgDownloadTime * 0.8) + (downloadTime * 0.2);
    }
  }

  /**
   * Cleanup cache periodically
   */
  cleanupCache() {
    const now = Date.now();
    const HOUR = 60 * 60 * 1000;
    const keysToRemove = [];
    
    // Remove items older than 2 hours that haven't been accessed recently
    for (const [key, cached] of this.mediaCache.entries()) {
      if (now - cached.timestamp > 2 * HOUR && cached.accessCount < 2) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      const cached = this.mediaCache.get(key);
      this.cacheSize -= cached.size;
      this.mediaCache.delete(key);
      
      const accessIndex = this.accessOrder.indexOf(key);
      if (accessIndex > -1) {
        this.accessOrder.splice(accessIndex, 1);
      }
    });
    
    if (keysToRemove.length > 0) {
      console.log(`[MediaPreloader] Cleaned up ${keysToRemove.length} old cache entries`);
    }
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.mediaCache.clear();
    this.accessOrder = [];
    this.cacheSize = 0;
    this.downloadQueue = [];
    this.activeDownloads.clear();
    this.failedDownloads.clear();
    this.downloadHistory.clear();
    
    console.log('[MediaPreloader] Cache cleared');
  }

  /**
   * Get preloader statistics
   */
  getStats() {
    const successRate = this.stats.totalRequests > 0 
      ? (this.stats.successfulDownloads / this.stats.totalRequests * 100).toFixed(2)
      : 0;
    
    const cacheHitRate = (this.stats.cacheHits + this.stats.cacheMisses) > 0
      ? (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) * 100).toFixed(2)
      : 0;
    
    return {
      ...this.stats,
      successRate: `${successRate}%`,
      cacheHitRate: `${cacheHitRate}%`,
      cacheSize: `${(this.cacheSize / 1024 / 1024).toFixed(2)}MB`,
      maxCacheSize: `${(this.MAX_CACHE_SIZE / 1024 / 1024).toFixed(2)}MB`,
      cachedItems: this.mediaCache.size,
      queueLength: this.downloadQueue.length,
      activeDownloads: this.activeDownloads.size,
      avgDownloadTime: `${this.stats.avgDownloadTime.toFixed(0)}ms`,
      networkType: this.networkType,
      isOnWifi: this.isOnWifi
    };
  }

  /**
   * Preload critical media immediately
   */
  preloadCriticalMedia(mediaItems) {
    if (!Array.isArray(mediaItems)) {
      return Promise.resolve([]);
    }
    
    console.log(`[MediaPreloader] Preloading ${mediaItems.length} critical media items`);
    
    const promises = mediaItems.map(mediaItem => 
      this.preloadMediaItem(mediaItem, { priority: this.PRIORITY.CRITICAL })
    );
    
    return Promise.allSettled(promises);
  }
}

// Create singleton instance
const mediaPreloaderService = new MediaPreloaderService();

module.exports = mediaPreloaderService;