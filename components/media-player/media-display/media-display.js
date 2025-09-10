// components/media-display/media-display.js
Component({
  properties: {
    currentPost: { type: Object, value: {} },
    currentMedia: { type: Array, value: [] },
    currentSlideIndex: { type: Number, value: 0 },
    mediaLength: { type: Number, value: 0 },
    isPlaying: { type: Boolean, value: true },
    showPlayIndicator: { type: Boolean, value: false },
    selectedDot: { type: Object, value: null },
    isWaitingForApi: { type: Boolean, value: false },
    isContinue: { type: Boolean, value: true },
    detailPanelState: {
      type: String,
      value: 'closed',
      observer(newVal, oldVal) {
        // When detail panel state changes, recalculate container dimensions and dots
        if (oldVal !== undefined && newVal !== oldVal) {
          // Use setTimeout to ensure DOM has updated
          setTimeout(() => {
            this.getContainerDimensions();
            // Recalculate dots with new container dimensions
            setTimeout(() => {
              this.calculateDotPositions();
            }, 100);
          }, 300); // Wait for animation to complete
        }
      }
    }
  },

  data: {
    containerWidth: 0,
    containerHeight: 0,
    calculatedDots: [],
    audioMode: 'both', // 'both', 'uploaded', 'video'
    // Removed image loading states for caching
    showVideo: true, // Control video visibility during navigation
    isNavigatingVideo: false, // Flag to prevent false video ended events during navigation
    videoReady: false, // Flag to control when video src is set
    videoSrc: '', // Dynamic video source
    imageDimensions: {}, // Store actual image dimensions for each image
  },

  // WeChat Doc: Single VideoContext instance management
  _videoContext: null,

  observers: {
    isPlaying: function(isPlaying) {
      const systemInfo = wx.getSystemInfoSync();
      const isAndroid = systemInfo.platform === 'android';
      
      console.log(`[${systemInfo.platform} Media Display] isPlaying observer:`, isPlaying);
      
      if (isPlaying === false) {
        // Stop media for all platforms
        console.log('[Media Display] Stopping media - not playing');
        
        // Use the enhanced stopVideo method for complete cleanup
        this.stopVideo();
      } else if (isPlaying === true && this.properties.currentPost && this.properties.currentPost.type === 'video') {
        const currentMedia = this.properties.currentMedia;
        if (currentMedia && currentMedia.length > 0 && currentMedia[0]) {
          const cleanUrl = this.cleanMediaUrl(currentMedia[0].url);
          const finalUrl = cleanUrl.indexOf('#') > -1 ? cleanUrl.split('#')[0] : cleanUrl;
          
          console.log(`[${systemInfo.platform} Media Display] Starting video load:`, finalUrl);
          
          // Simplified approach - same for both platforms
          this.setData({
            videoSrc: finalUrl,
            videoReady: true,
            showVideo: true,
            isNavigatingVideo: false
          });
          
          // Short delay to ensure video element is ready
          const autoplayDelay = isAndroid ? 150 : 100;
          setTimeout(() => {
            this.startVideoAutoplay();
          }, autoplayDelay);
        }
      }
    },
    
    'currentMedia, currentSlideIndex': function(currentMedia, currentSlideIndex) {
      // Clear previous dots immediately when media changes
      this.setData({ calculatedDots: [] });
      
      const systemInfo = wx.getSystemInfoSync();
      const isAndroid = systemInfo.platform === 'android';
      
      console.log(`[${systemInfo.platform} Media Observer] currentMedia changed, isPlaying:`, this.properties.isPlaying);
      
      // Only stop video if we're not playing
      if (!this.properties.isPlaying) {
        this.stopVideo();
        this.setData({
          videoSrc: '',
          videoReady: false,
          showVideo: false,
          isNavigatingVideo: false
        });
      } else if (currentMedia && currentMedia.length > 0 && currentMedia[0]) {
        // Check if this component should actually load media
        const shouldLoadMedia = this.properties.isPlaying === true;
        
        if (shouldLoadMedia && this.properties.currentPost && this.properties.currentPost.type === 'video') {
          // Clean URL to remove #devtools_no_referrer and other fragments
          const cleanUrl = this.cleanMediaUrl(currentMedia[0].url);
          const finalUrl = cleanUrl.indexOf('#') > -1 ? cleanUrl.split('#')[0] : cleanUrl;
          
          console.log(`[${systemInfo.platform} Media Observer] Loading video for active post:`, finalUrl);
          
          // Simplified approach with minimal delay
          this.setData({
            videoSrc: finalUrl,
            videoReady: true,
            showVideo: true,
            isNavigatingVideo: false
          });
          
          // Short delay to let video element load
          const autoplayDelay = isAndroid ? 200 : 100;
          setTimeout(() => {
            this.startVideoAutoplay();
          }, autoplayDelay);
        } else {
          // This is not the active post - ensure video is completely stopped
          console.log(`[${systemInfo.platform} Media Observer] Ensuring inactive post is stopped`);
          this.setData({
            videoSrc: '',
            videoReady: false,
            showVideo: false,
            isNavigatingVideo: false
          });
        }
      }
      
      // Calculate dot positions after DOM updates
      setTimeout(() => {
        this.calculateDotPositions();
      }, 50);
      
      // Pre-fetch image dimensions for better accuracy
      if (currentMedia && currentMedia.length > 0 && this.properties.currentPost?.type === 'image') {
        this.prefetchImageDimensions(currentMedia);
      }
    }
  },
  ready() {
    this.getContainerDimensions();
    
    // Store resize handler for cleanup
    this.onResizeHandler = () => {
      // Debounce resize events
      if (this.resizeTimer) {
        clearTimeout(this.resizeTimer);
      }
      this.resizeTimer = setTimeout(() => {
        this.getContainerDimensions();
      }, 200);
    };
    
    // Listen for window resize events
    wx.onWindowResize && wx.onWindowResize(this.onResizeHandler);
    
    // Pre-fetch image dimensions on ready
    const { currentMedia } = this.properties;
    if (currentMedia && currentMedia.length > 0 && this.properties.currentPost?.type === 'image') {
      this.prefetchImageDimensions(currentMedia);
    }
  },

  detached() {
    // Clean up event listeners
    if (this.onResizeHandler) {
      wx.offWindowResize && wx.offWindowResize(this.onResizeHandler);
    }
    
    // Clear any pending timers
    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
    }
    
    // WeChat Doc: Proper cleanup order
    this.destroyVideoContext();
    this.destroyUploadedAudio();
  },

  methods: {
    /**
     * WeChat Doc: Get or create single VideoContext instance
     */
    getVideoContext() {
      if (!this._videoContext) {
        console.log('[VideoContext] Creating new video context');
        this._videoContext = wx.createVideoContext('media-video', this);
      }
      return this._videoContext;
    },

    /**
     * WeChat Doc: Destroy VideoContext instance with Android-specific handling
     */
    destroyVideoContext() {
      if (this._videoContext) {
        console.log('[VideoContext] Destroying video context');
        const systemInfo = wx.getSystemInfoSync();
        const isAndroid = systemInfo.platform === 'android';
        
        try {
          // Android requires more aggressive cleanup
          if (isAndroid) {
            // Step 1: Pause first
            this._videoContext.pause();
            
            // Step 2: Seek to beginning
            this._videoContext.seek(0);
            
            // Step 3: Stop with multiple attempts
            this._videoContext.stop();
            
            // Step 4: Quick nullification
            setTimeout(() => {
              if (this._videoContext) {
                try {
                  this._videoContext.stop();
                  this._videoContext = null;
                } catch (e) {
                  console.warn('Final Android video cleanup error:', e);
                  this._videoContext = null;
                }
              }
            }, 50);  // Reduced from 200ms
          } else {
            // iOS: Simple cleanup
            this._videoContext.pause();
            this._videoContext.stop();
            this._videoContext = null;
          }
        } catch (error) {
          console.warn('Error stopping video context:', error);
          this._videoContext = null;
        }
      }
    },

    /**
     * WeChat Doc: Public method for parent components to stop video with complete cleanup
     */
    stopVideo() {
      const systemInfo = wx.getSystemInfoSync();
      const isAndroid = systemInfo.platform === 'android';
      
      console.log(`[VideoContext] External stop request - Platform: ${systemInfo.platform}`);
      
      // Step 1: Stop uploaded audio first to prevent audio overlap
      this.destroyUploadedAudio();
      
      // Step 2: Handle video context cleanup
      const videoContext = this.getVideoContext();
      if (videoContext) {
        try {
          if (isAndroid) {
            // Android: Multi-stage cleanup sequence
            console.log('[Android Video] Starting complete cleanup sequence');
            
            // Stage 1: Initial stop
            videoContext.pause();
            videoContext.seek(0);
            videoContext.stop();
            
            // Stage 2: Clear video source immediately to prevent background loading
            this.setData({
              videoSrc: '',
              videoReady: false,
              showVideo: false
            });
            
            // Stage 3: Destroy context quickly
            setTimeout(() => {
              this.destroyVideoContext();
            }, 50);  // Reduced from 100ms
            
          } else {
            // iOS: Standard cleanup
            videoContext.pause();
            videoContext.seek(0);
            videoContext.stop();
          }
        } catch (error) {
          console.warn('Error in stopVideo:', error);
        }
      }
      
      // Clear video state (for iOS or if no videoContext)
      if (!isAndroid) {
        this.setData({
          videoSrc: '',
          videoReady: false,
          showVideo: false
        });
      }
    },

    /**
     * WeChat Doc: Public method for parent components to play video
     */
    playVideo() {
      if (this.data.currentPost?.type === 'video' && this.data.videoReady) {
        const videoContext = this.getVideoContext();
        if (videoContext) {
          try {
            console.log('[VideoContext] External play request');
            videoContext.play();
          } catch (error) {
            console.warn('Error in playVideo:', error);
          }
        }
      }
    },

    /**
     * Clean URL to remove problematic fragments and parameters
     */
    cleanMediaUrl(url) {
      if (!url) return '';
      
      let cleanUrl = url;
      
      // Remove any hash fragments including #devtools_no_referrer
      cleanUrl = cleanUrl.split('#')[0];
      
      // Clean query parameters
      if (cleanUrl.includes('?')) {
        const urlParts = cleanUrl.split('?');
        const baseUrl = urlParts[0];
        const queryString = urlParts[1];
        
        if (queryString) {
          try {
            const params = new URLSearchParams(queryString);
            // Remove known problematic parameters
            params.delete('devtools_no_referrer');
            params.delete('no_referrer');
            const cleanedQuery = params.toString();
            cleanUrl = cleanedQuery ? `${baseUrl}?${cleanedQuery}` : baseUrl;
          } catch (error) {
            // If URLSearchParams fails, just use base URL
            cleanUrl = baseUrl;
          }
        }
      }
      
      return cleanUrl;
    },
    
    /**
     * Stop current video playback - Android enhanced version
     */
    stopCurrentVideo() {
      // Use the enhanced stopVideo method for consistent behavior
      this.stopVideo();
    },
    
    /**
     * Clear video state to prevent thumbnail artifacts during navigation
     */
    clearVideoState() {
      // Destroy uploaded audio context first to prevent overlap
      this.destroyUploadedAudio();
      
      // Clear video source to stop any loading
      this.setData({ 
        showVideo: false,
        isNavigatingVideo: true,
        videoReady: false,
        videoSrc: '',
        userPausedVideo: false, // Reset user pause flag for new video
        calculatedDots: [] // Clear dots when clearing video state
      });
      
      const videoContext = this.getVideoContext();
      if (videoContext) {
        // Stop video completely and reset to clear loading state
        videoContext.stop();
        videoContext.seek(0);
      }
      
      // Show video again after a delay with fresh source
      setTimeout(() => {
        this.setData({ 
          showVideo: true,
          isNavigatingVideo: false  // Reset navigation flag
        });
      }, 100);
    },

    /**
     * Start video autoplay - Enhanced with global state verification
     */
    startVideoAutoplay() {
      const systemInfo = wx.getSystemInfoSync();
      const isAndroid = systemInfo.platform === 'android';
      
      console.log(`[${systemInfo.platform} Video] startVideoAutoplay called - isPlaying:`, this.properties.isPlaying);
      
      // Basic checks
      if (!this.properties.isPlaying) {
        console.log('[Video Check] Not playing state - preventing autoplay');
        return;
      }
      
      // Check global media state at page level - but be more lenient for video autoplay
      const page = getCurrentPages()[getCurrentPages().length - 1];
      if (page && page.data && page.data.activeMediaIndex !== undefined) {
        const mediaPlayer = this.selectOwnerComponent();
        if (mediaPlayer && mediaPlayer.properties && mediaPlayer.properties.index !== undefined) {
          const ourIndex = mediaPlayer.properties.index;
          const activeIndex = page.data.activeMediaIndex;
          
          console.log(`[Video Check] Our index: ${ourIndex}, Active index: ${activeIndex}`);
          
          // Only prevent if there's a different active index (not -1 or ourselves)
          if (activeIndex !== -1 && activeIndex !== ourIndex) {
            console.log('[Video Check] Warning: Not the active post but proceeding anyway for Android compatibility');
            // Don't return on Android - sometimes activeMediaIndex updates are delayed
            if (!isAndroid) {
              return;
            }
          }
        }
      }
      
      if (isAndroid) {
        // Android: Prevent multiple concurrent autoplay attempts
        if (this._autoplayInProgress) {
          console.log('[Android] Autoplay already in progress');
          return;
        }
        this._autoplayInProgress = true;
        setTimeout(() => {
          this._autoplayInProgress = false;
        }, 1000);
      }
      
      // Only autoplay if this is a video post and playing is enabled
      if (this.properties.currentPost && 
          this.properties.currentPost.type === 'video' && 
          this.properties.isPlaying === true && 
          !this.properties.isWaitingForApi) {
        const videoContext = this.getVideoContext();
        if (videoContext) {
          console.log(`[${systemInfo.platform} Video] Starting video autoplay for active post`);
          
          // Android: Stop first to ensure clean state
          if (isAndroid) {
            videoContext.stop();
            setTimeout(() => {
              videoContext.play();
            }, 50);
          } else {
            // iOS: Just play
            videoContext.play();
          }
          
          // Apply audio mode after a delay to ensure video is actively playing
          setTimeout(() => {
            // Triple-check that this post is still the active one before applying audio mode
            const currentPage = getCurrentPages()[getCurrentPages().length - 1];
            const currentActiveIndex = currentPage && currentPage.data ? currentPage.data.activeMediaIndex : -1;
            const currentPlayer = this.selectOwnerComponent();
            const currentPlayerIndex = currentPlayer && currentPlayer.properties ? currentPlayer.properties.index : -1;
            
            if (this.properties.isPlaying && 
                this.properties.currentPost && 
                this.properties.currentPost.type === 'video' &&
                (currentActiveIndex === -1 || currentActiveIndex === currentPlayerIndex)) {
              console.log(`[${systemInfo.platform} Video] Applying audio mode for confirmed active post`);
              this.applyAudioMode(videoContext);
            } else {
              console.log(`[${systemInfo.platform} Video] Post no longer active, skipping audio mode`);
            }
          }, 500); // 500ms delay
        }
      }
    },

    // Removed image preloading methods to disable caching

    /**
     * Calculate actual image size within container (aspectFit mode)
     */
    calculateContainedImageSize(containerWidth, containerHeight, imageWidth, imageHeight) {
      
      const containerRatio = containerWidth / containerHeight;
      const imageRatio = imageWidth / imageHeight;

      let displayedWidth, displayedHeight, left, top;

      if (imageRatio > containerRatio) {
        // Image is wider, fits container width exactly
        displayedWidth = containerWidth;
        displayedHeight = containerWidth / imageRatio;
        left = 0;
        top = (containerHeight - displayedHeight) / 2;
      } else {
        // Image is taller, fits container height exactly
        displayedHeight = containerHeight;
        displayedWidth = containerHeight * imageRatio;
        top = 0;
        left = (containerWidth - displayedWidth) / 2;
      }

      return { width: displayedWidth, height: displayedHeight, left, top };
    },

    /**
     * Get container dimensions
     */
    getContainerDimensions() {
      const query = this.createSelectorQuery();
      query.select('.media-container').boundingClientRect((rect) => {
        
        if (rect) {
          const hasChanged = this.data.containerWidth !== rect.width || 
                           this.data.containerHeight !== rect.height;
          
          this.setData({
            containerWidth: rect.width,
            containerHeight: rect.height
          });
          
          // Only recalculate dots if dimensions actually changed
          if (hasChanged) {
            this.calculateDotPositions();
          }
        }
      }).exec();
    },    /**
     * Calculate dot positions based on actual image size
     */
    calculateDotPositions() {
      const { currentMedia, currentSlideIndex, containerWidth, containerHeight, imageDimensions } = this.data;
      
      // Enhanced validation - ensure we have valid data
      if (!currentMedia || currentMedia.length === 0) {
        this.setData({ calculatedDots: [] });
        return;
      }
      
      if (currentSlideIndex < 0 || currentSlideIndex >= currentMedia.length) {
        this.setData({ calculatedDots: [] });
        return;
      }
      
      const currentItem = currentMedia[currentSlideIndex];
      if (!currentItem || !currentItem.dots) {
        this.setData({ calculatedDots: [] });
        return;
      }

      const dots = currentItem.dots;
      if (!dots || dots.length === 0 || !containerWidth || !containerHeight) {
        this.setData({ calculatedDots: [] });
        return;
      }

      // Get actual image dimensions or use defaults
      const imageUrl = currentItem.url;
      const imageDims = imageDimensions[imageUrl] || { width: 1080, height: 1080 };
      
      // Calculate actual displayed image size based on real dimensions
      const actualImageSize = this.calculateContainedImageSize(
        containerWidth,
        containerHeight,
        imageDims.width,
        imageDims.height
      );

      const calculatedDots = dots.map((dot, index) => {
        const realLeft = dot.x * actualImageSize.width + actualImageSize.left;
        const realTop = dot.y * actualImageSize.height + actualImageSize.top;
        
        return {
          ...dot,
          index,
          slideIndex: currentSlideIndex, // Add slide index to identify which slide these dots belong to
          realLeft: Math.round(realLeft),
          realTop: Math.round(realTop),
          leftPercent: (realLeft / containerWidth) * 100,
          topPercent: (realTop / containerHeight) * 100
        };
      });

      this.setData({ calculatedDots });
    },onScreenTap() {
      this.triggerEvent('screentap');
    },

    onSlideChange(e) {
      this.triggerEvent('slidechange', { current: e.detail.current });
      // Immediately clear dots and recalculate for new slide
      this.setData({ calculatedDots: [] });
      
      // Get current image URL and check if we have dimensions
      const currentIndex = e.detail.current;
      const { currentMedia } = this.data;
      if (currentMedia && currentMedia[currentIndex]) {
        const imageUrl = currentMedia[currentIndex].url;
        
        // If we don't have dimensions for this image, fetch them
        if (imageUrl && !this.data.imageDimensions[imageUrl]) {
          wx.getImageInfo({
            src: imageUrl,
            success: (res) => {
              const imageDimensions = this.data.imageDimensions || {};
              imageDimensions[imageUrl] = {
                width: res.width,
                height: res.height
              };
              this.setData({ imageDimensions });
              this.calculateDotPositions();
            },
            fail: () => {
              // Fallback to calculating with default dimensions
              this.calculateDotPositions();
            }
          });
        } else {
          // We already have dimensions, just recalculate
          setTimeout(() => {
            this.calculateDotPositions();
          }, 50);
        }
      }
    },

    onDotTap(e) {
      const { index } = e.currentTarget.dataset;
      this.triggerEvent('dottap', { index });
    },

    moveToPreviousSlide() {
      this.triggerEvent('previousslide');
    },

    moveToNextSlide() {
      this.triggerEvent('nextslide');
    },

    onVideoTap(e){
    },
    
    onVideoPlay() {
      console.log('[VideoPlay] Video started playing');
      
      // Clear user pause flag since video is now playing
      this.setData({ userPausedVideo: false });
      
      // WeChat Doc: Don't directly modify parent state to prevent observer loops
      // Only trigger event to notify parent
      this.triggerEvent('videoplaying', { 
        isLoading: false,
        isWaitingForApi: false 
      });
      
      // Apply audio mode after a delay to ensure this is the actively playing post
      setTimeout(() => {
        // Only apply audio mode if this post is still active and playing
        if (this.properties.isPlaying && 
            this.properties.currentPost && 
            this.properties.currentPost.type === 'video') {
          const videoContext = this.getVideoContext();
          if (videoContext) {
            this.applyAudioMode(videoContext);
          }
        }
      }, 300); // 300ms delay
    },

    onVideoPause() {
      this.triggerEvent('videopaused');
    },    onVideoEnded() {
      // Always trigger video ended event to move to next post
      // Parent component will handle navigation
      this.triggerEvent('videoended');
    },


    onVideoError(e) {
      // Video error occurred - trigger event instead of direct state change
      this.triggerEvent('videoerror', {
        isLoading: false,
        isWaitingForApi: false
      });
      
      // Show error to user
      wx.showToast({
        title: '视频加载失败',
        icon: 'none',
        duration: 2000
      });
    },

    // New video loading event handlers
    onVideoLoadStart() {
      // Video started loading - this is called when video begins to load
      // Don't set loading here as it's already managed by parent component
    },

    onVideoCanPlay() {
      // Video can start playing - trigger event instead of direct state change
      this.triggerEvent('videocanplay', {
        isLoading: false,
        isWaitingForApi: false
      });
      
      // Also clear internal loading flags if they exist
      if (parent && parent.isCurrentlyLoading) {
        parent.isCurrentlyLoading = false;
      }
      
      // Start playing immediately when video can play
      if (this.properties.isPlaying) {
        const videoContext = this.getVideoContext();
        if (videoContext) {
          videoContext.play();
        }
      }
    },

    onVideoWaiting() {
      // Video is waiting for more data - trigger event instead of direct state change
      this.triggerEvent('videowaiting', {
        isLoading: false,
        isWaitingForApi: false
      });
      
      // Try to resume playback after short delay
      setTimeout(() => {
        const videoContext = this.getVideoContext();
        if (videoContext) {
          videoContext.play();
        }
      }, 500);
    },

    onVideoLoadedData() {
      // Video data has been loaded - immediately start playback
      const videoContext = this.getVideoContext();
      if (videoContext) {
        // Immediately play without multiple seeks to reduce loading appearance
        if (this.properties.isPlaying) {
          videoContext.play();
        }
      }
      
      // Clear loading states via event
      this.triggerEvent('videoloadeddata', {
        isLoading: false,
        isWaitingForApi: false
      });
    },

    onVideoLoadedMetadata() {
      // Video metadata loaded - can start playing now
      const videoContext = this.getVideoContext();
      if (videoContext && this.properties.isPlaying) {
        // Start playing immediately when metadata is ready
        videoContext.play();
      }
    },

    onVideoTimeUpdate() {
      // Video time is updating - means it's playing properly
      // Clear any lingering loading states via event
      this.triggerEvent('videotimeupdate', {
        isLoading: false,
        isWaitingForApi: false
      });
    },

    /**
     * Pre-fetch image dimensions for accurate dot positioning
     */
    prefetchImageDimensions(mediaList) {
      if (!mediaList || mediaList.length === 0) return;
      
      mediaList.forEach((media) => {
        if (media.url && !this.data.imageDimensions[media.url]) {
          wx.getImageInfo({
            src: media.url,
            success: (res) => {
              const imageDimensions = this.data.imageDimensions || {};
              imageDimensions[media.url] = {
                width: res.width,
                height: res.height
              };
              this.setData({ imageDimensions });
              
              // Recalculate dots if this is the current image
              const currentMedia = this.data.currentMedia;
              const currentSlideIndex = this.data.currentSlideIndex;
              if (currentMedia && currentMedia[currentSlideIndex] && 
                  currentMedia[currentSlideIndex].url === media.url) {
                this.calculateDotPositions();
              }
            },
            fail: (err) => {
              console.log('Failed to get image info:', err);
            }
          });
        }
      });
    },

    /**
     * Handle image load event to recalculate positions
     */
    onImageLoad(e) {
      // Get the actual image dimensions from the load event
      const { width: imageWidth, height: imageHeight } = e.detail;
      const imageUrl = e.currentTarget.dataset.src;
      
      // Store the actual image dimensions
      const imageDimensions = this.data.imageDimensions || {};
      imageDimensions[imageUrl] = {
        width: imageWidth,
        height: imageHeight
      };
      
      this.setData({ imageDimensions });
      
      // Recalculate dot positions with actual image dimensions
      setTimeout(() => {
        this.calculateDotPositions();
      }, 100);
    },

    /**
     * Set audio mode for video playback
     */
    setAudioMode(mode) {
      this.setData({ audioMode: mode });
      
      // Apply audio mode only if this is the currently playing post
      if (!this.properties.isPlaying) {
        return;
      }
      
      // Apply audio mode to current video if playing
      const videoContext = this.getVideoContext();
      if (videoContext && this.properties.currentPost && this.properties.currentPost.type === 'video') {
        this.applyAudioMode(videoContext);
      }
    },

    /**
     * Apply audio mode settings to video
     */
    applyAudioMode(videoContext) {
      const { audioMode } = this.data;
      const { currentPost, isPlaying } = this.properties;
      
      // Only apply audio mode if this is the currently playing post
      if (!isPlaying) {
        return;
      }
      
      // Check if post has uploaded audio
      const hasUploadedAudio = currentPost && currentPost.audio_url;
      
      if (!hasUploadedAudio) {
        // No uploaded audio, just play video normally
        return;
      }
      
      // Handle different audio modes
      if (audioMode === 'video') {
        // Mute uploaded audio, play only video audio
        this.muteUploadedAudio();
      } else if (audioMode === 'uploaded') {
        // Mute video audio, play only uploaded audio
        videoContext.muted = true;
        this.playUploadedAudio();
      } else {
        // Play both audio tracks
        videoContext.muted = false;
        this.playUploadedAudio();
      }
    },

    /**
     * Play uploaded audio - Enhanced with global state verification
     */
    playUploadedAudio() {
      const { currentPost, isPlaying, isWaitingForApi } = this.properties;
      const { videoReady } = this.data;
      
      console.log('[Audio Check] playUploadedAudio called - isPlaying:', isPlaying, 'videoReady:', videoReady);
      
      // Only play audio if this is the currently active/playing post with strict conditions
      if (!currentPost || 
          !currentPost.audio_url || 
          !isPlaying || 
          isWaitingForApi ||
          !videoReady) {
        console.log('[Audio Check] Basic conditions failed - not playing audio');
        return;
      }
      
      // Additional check: ensure we're not in a transition state
      const parent = this.selectOwnerComponent();
      if (parent && (parent.data.isLoading || parent.data.isWaitingForApi || parent.isCurrentlyLoading)) {
        console.log('[Audio Check] Parent loading state - not playing audio');
        return;
      }
      
      // CRITICAL: Check global media state at page level
      const page = getCurrentPages()[getCurrentPages().length - 1];
      if (page && page.data && page.data.activeMediaIndex !== undefined) {
        // Find our index in the page
        const mediaPlayer = this.selectOwnerComponent();
        if (mediaPlayer && mediaPlayer.properties && mediaPlayer.properties.index !== undefined) {
          const ourIndex = mediaPlayer.properties.index;
          const activeIndex = page.data.activeMediaIndex;
          
          console.log(`[Audio Check] Our index: ${ourIndex}, Active index: ${activeIndex}`);
          
          if (activeIndex !== -1 && activeIndex !== ourIndex) {
            console.log('[Audio Check] Not the active post - preventing audio playback');
            return;
          }
        }
      }
      
      // Android: Additional verification
      const systemInfo = wx.getSystemInfoSync();
      if (systemInfo.platform === 'android') {
        // Double-check by looking at parent actualIsPlaying state
        if (parent && parent.data && parent.data.actualIsPlaying !== true) {
          console.log('[Android Audio Check] Parent not actually playing - preventing audio');
          return;
        }
      }
      
      console.log('[Audio Check] All checks passed - starting audio playback');
      
      // Destroy previous audio context first to prevent multiple audio playback
      this.destroyUploadedAudio();
      
      // Create new audio context for current post
      this.audioContext = wx.createInnerAudioContext();
      this.audioContext.src = currentPost.audio_url;
      this.audioContext.loop = true;
      
      // Add error handling
      this.audioContext.onError((err) => {
        console.error('Audio playback error:', err);
        this.destroyUploadedAudio();
      });
      
      this.audioContext.play();
      
      console.log('[Audio Check] Audio context started for post:', currentPost.id);
    },

    /**
     * Mute uploaded audio
     */
    muteUploadedAudio() {
      if (this.audioContext) {
        this.audioContext.pause();
      }
    },

    /**
     * Destroy uploaded audio context to prevent memory leaks and multiple audio playback
     * Enhanced Android cleanup to completely stop background audio
     */
    destroyUploadedAudio() {
      const systemInfo = wx.getSystemInfoSync();
      const isAndroid = systemInfo.platform === 'android';
      
      if (this.audioContext) {
        try {
          console.log(`[${systemInfo.platform} Audio] Destroying audio context`);
          
          if (isAndroid) {
            // Android: Aggressive multi-stage cleanup
            console.log('[Android Audio] Starting aggressive cleanup sequence');
            
            // Stage 1: Multiple pause attempts
            try {
              this.audioContext.pause();
              this.audioContext.pause(); // Double pause for Android
            } catch (e1) {
              console.warn('Android audio pause error:', e1);
            }
            
            // Stage 2: Multiple stop attempts  
            try {
              this.audioContext.stop();
              this.audioContext.stop(); // Double stop for Android
            } catch (e2) {
              console.warn('Android audio stop error:', e2);
            }
            
            // Stage 3: Clear src to prevent background loading
            try {
              this.audioContext.src = '';
            } catch (e3) {
              console.warn('Android audio src clear error:', e3);
            }
            
            // Stage 4: Destroy with multiple attempts
            try {
              this.audioContext.destroy();
            } catch (e4) {
              console.warn('Android audio destroy error:', e4);
            }
            
            // Stage 5: Immediate nullification
            this.audioContext = null;
            
            // Stage 6: Additional cleanup attempts with delays
            setTimeout(() => {
              // Try to stop any remaining background audio
              try {
                wx.stopBackgroundAudio();
              } catch (bgError) {
                console.warn('Background audio stop error:', bgError);
              }
            }, 50);
            
            setTimeout(() => {
              // Final cleanup attempt
              if (this.audioContext) {
                try {
                  this.audioContext.destroy();
                  this.audioContext = null;
                } catch (finalError) {
                  console.warn('Final Android cleanup error:', finalError);
                  this.audioContext = null;
                }
              }
            }, 200);
            
          } else {
            // iOS: Standard WeChat cleanup sequence
            this.audioContext.pause();
            this.audioContext.stop();
            this.audioContext.destroy();
            this.audioContext = null;
          }
          
        } catch (error) {
          // Handle any errors during audio context destruction
          console.warn('Error destroying audio context:', error);
          this.audioContext = null;
        }
      }
    }
  }
});