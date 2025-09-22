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
    // Keep video always visible and ready to prevent black screen
    showVideo: true, // Always true to prevent black screen
    isNavigatingVideo: false, // Flag to prevent false video ended events during navigation
    videoReady: true, // Always true to prevent black screen
    videoSrc: '', // Dynamic video source
    imageDimensions: {}, // Store image dimensions for dot calculation
    lastLoadedVideoUrl: '', // Track last loaded video to prevent duplicates
    isVideoPaused: false, // Track video pause state for play button
    showVideoPlayButton: false, // Control video play button visibility
    showImagePlayButton: false // Control image play button visibility
  },

  // WeChat Doc: Single VideoContext instance management
  _videoContext: null,
  _isSettingVideo: false, // Flag to prevent recursive video setting
  _shouldAutoPlay: false, // Flag to track if video should auto-play when ready
  playButtonTimer: null, // Timer for hiding play button
  imagePlayButtonTimer: null, // Timer for hiding image play button

  observers: {
    // Initialize video URL immediately when post changes
    'currentPost, currentMedia': function(currentPost, currentMedia) {
      if (!currentPost || !currentMedia || currentMedia.length === 0) {
        // Clear video when no post
        if (this.data.videoSrc) {
            this.setData({
            videoSrc: '',
            lastLoadedVideoUrl: ''
          });
        }
        return;
      }
      
      if (currentPost.type === 'video' && currentMedia[0]) {
        const videoUrl = currentMedia[0].url || '';
        const finalUrl = videoUrl.indexOf('#') > -1 ? videoUrl.split('#')[0] : videoUrl;
        
        // Prevent recursive setting
        if (this._isSettingVideo) return;
        
        // Check both videoSrc and lastLoadedVideoUrl to prevent duplicates
        if (finalUrl && finalUrl !== this.data.videoSrc && finalUrl !== this.data.lastLoadedVideoUrl) {
          this._isSettingVideo = true;
          
          // Reset playing state when changing video
          this._isPlaying = false;
          this._videoStarting = false;
          
          // Destroy old video context to prevent multiple instances
          if (this._videoContext) {
            try {
              this._videoContext.stop();
              this._videoContext = null;
            } catch(e) {
              this._videoContext = null;
            }
          }
          
          // Set both videoSrc and lastLoadedVideoUrl atomically
          this.setData({
            videoSrc: finalUrl,
            lastLoadedVideoUrl: finalUrl
          }, () => {
            this._isSettingVideo = false;
            
            // Auto-play if this video should be playing
            if (this._shouldAutoPlay || this.properties.isPlaying === true) {
              const systemInfo = wx.getSystemInfoSync();
              const isAndroid = systemInfo.platform === 'android';
              const autoplayDelay = isAndroid ? 200 : 150;
              setTimeout(() => {
                this.startVideoAutoplay();
              }, autoplayDelay);
            }
          });
        } else if (finalUrl === this.data.lastLoadedVideoUrl && !this.data.videoSrc) {
          // If we cleared videoSrc but it's the same video, don't restore it
          // This prevents reloading when stopping
        }
      } else if (currentPost.type !== 'video' && this.data.videoSrc) {
        // Clear video source for non-video posts
        // Destroy video context first
        if (this._videoContext) {
          try {
            this._videoContext.stop();
            this._videoContext = null;
          } catch(e) {
            this._videoContext = null;
          }
        }
        
        this.setData({
          videoSrc: '',
          lastLoadedVideoUrl: '' // Clear for non-video posts
        });
      }
    },
    
    isPlaying: function(isPlaying) {
      const systemInfo = wx.getSystemInfoSync();
      const isAndroid = systemInfo.platform === 'android';

      if (isPlaying === false) {
        // Reset playing flag
        this._isPlaying = false;
        // Video will be muted automatically by muted="{{ !isPlaying }}" in WXML
        // Just pause the video if context exists (don't create new one)
        if (this._videoContext) {
          this._videoContext.pause();
        }
        // Show play button for paused video
        if (this.properties.currentPost && this.properties.currentPost.type === 'video') {
          this.setData({
            isVideoPaused: true,
            showVideoPlayButton: true
          });
        }
        // Stop audio
        this.destroyUploadedAudio();
      } else if (isPlaying === true && this.properties.currentPost && this.properties.currentPost.type === 'video') {
        // Mark that we should play this video
        this._shouldAutoPlay = true;

        // Hide play button when playing
        this.setData({
          isVideoPaused: false,
          showVideoPlayButton: false
        });

        // If video source is already set, start playing immediately
        if (this.data.videoSrc && !this._isPlaying) {
          const autoplayDelay = isAndroid ? 150 : 100;
          setTimeout(() => {
            this.startVideoAutoplay();
          }, autoplayDelay);
        }
        // If video source is not yet set, it will auto-play when videoSrc is set
      }
    },
    
    'currentSlideIndex': function(currentSlideIndex) {
      // Clear and recalculate dots when slide changes
      this.setData({ calculatedDots: [] });
      
      // Calculate dot positions after DOM updates
      setTimeout(() => {
        this.calculateDotPositions();
      }, 50);
    }
  },
  ready() {
    this.getContainerDimensions();
    
    // Check if should auto-play on initial load
    if (this.properties.isPlaying === true && this.properties.currentPost && this.properties.currentPost.type === 'video') {
      this._shouldAutoPlay = true;
      // If video source is already set, start playing
      if (this.data.videoSrc) {
        const systemInfo = wx.getSystemInfoSync();
        const isAndroid = systemInfo.platform === 'android';
        const autoplayDelay = isAndroid ? 300 : 200;
        setTimeout(() => {
          this.startVideoAutoplay();
        }, autoplayDelay);
      }
    }
    
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
    
    // Skip pre-fetching - dimensions come from parent page cache
    // This prevents duplicate downloads
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

    // Clear play button timers
    if (this.playButtonTimer) {
      clearTimeout(this.playButtonTimer);
      this.playButtonTimer = null;
    }
    if (this.imagePlayButtonTimer) {
      clearTimeout(this.imagePlayButtonTimer);
      this.imagePlayButtonTimer = null;
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
        this._videoContext = wx.createVideoContext('media-video', this);
      }
      return this._videoContext;
    },

    /**
     * WeChat Doc: Destroy VideoContext instance with Android-specific handling
     */
    destroyVideoContext() {
      if (this._videoContext) {
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
      
      // Step 1: Stop uploaded audio first to prevent audio overlap
      this.destroyUploadedAudio();
      
      // Step 2: Handle video context cleanup
      const videoContext = this.getVideoContext();
      if (videoContext) {
        try {
          if (isAndroid) {
            // Android: Multi-stage cleanup sequence
            // Stage 1: Initial stop
            videoContext.pause();
            videoContext.seek(0);
            videoContext.stop();
            
            // Stage 2: Only clear video source, keep component visible
            this.setData({
              videoSrc: ''
              // Keep lastLoadedVideoUrl to prevent reloading
              // Keep videoReady and showVideo true to prevent black screen
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
        }
      }
      
      // Clear video source only (for iOS or if no videoContext)
      if (!isAndroid) {
        this.setData({
          videoSrc: ''
          // Keep lastLoadedVideoUrl to prevent reloading
          // Keep videoReady and showVideo true to prevent black screen
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
            videoContext.play();
          } catch (error) {
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
      
      // Only clear video source, keep component visible
      this.setData({ 
        isNavigatingVideo: true,
        videoSrc: '',
        // Keep lastLoadedVideoUrl to prevent reloading same video
        userPausedVideo: false, // Reset user pause flag for new video
        calculatedDots: [] // Clear dots when clearing video state
      });
      
      const videoContext = this.getVideoContext();
      if (videoContext) {
        // Stop video completely and reset to clear loading state
        videoContext.stop();
        videoContext.seek(0);
      }
      
      // Reset navigation flag immediately
      this.setData({ 
        isNavigatingVideo: false  // Reset navigation flag
      });
    },
    
    /**
     * Clear video state when actually switching to a different post
     */
    clearVideoStateForNewPost() {
      this.clearVideoState();
      // Also clear lastLoadedVideoUrl when switching posts
      this.setData({
        lastLoadedVideoUrl: ''
      });
    },

    /**
     * Start video autoplay - Enhanced with global state verification
     */
    startVideoAutoplay() {
      // Prevent multiple calls
      if (this._videoStarting) return;
      
      const systemInfo = wx.getSystemInfoSync();
      const isAndroid = systemInfo.platform === 'android';
      
      // Basic checks
      if (!this.properties.isPlaying) {
        return;
      }
      
      // Only play if this is a video post with source set
      if (this.properties.currentPost && 
          this.properties.currentPost.type === 'video' && 
          this.properties.isPlaying === true && 
          !this.properties.isWaitingForApi &&
          this.data.videoSrc && 
          !this._isPlaying) { // Only if not already playing
        
        this._videoStarting = true;
        const videoContext = this.getVideoContext();
        
        if (videoContext) {
          // Play video
          videoContext.play();
          
          // Reset flag after a delay
          setTimeout(() => {
            this._videoStarting = false;
          }, 300);
        } else {
          this._videoStarting = false;
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
      const imageDims = (imageDimensions && imageDimensions[imageUrl]) || { width: 1080, height: 1080 };
      
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
      // Handle screen tap for both image and video posts
      const postType = this.properties.currentPost?.type;

      if (postType === 'image') {
        // Show play/pause button for images briefly when tapped
        this.setData({
          showImagePlayButton: true
        });

        // Clear existing timer if any
        if (this.imagePlayButtonTimer) {
          clearTimeout(this.imagePlayButtonTimer);
        }

        // Hide play/pause button after 1.5 seconds with fade
        this.imagePlayButtonTimer = setTimeout(() => {
          this.setData({
            showImagePlayButton: false
          });
        }, 1500);
      }

      this.triggerEvent('screentap');
    },

    onSlideChange(e) {
      this.triggerEvent('slidechange', { current: e.detail.current });
      // Immediately clear dots and recalculate for new slide
      this.setData({ calculatedDots: [] });
      
      // Simply recalculate dot positions - no preloading
      setTimeout(() => {
        this.calculateDotPositions();
      }, 100);
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
      // Toggle play/pause on video tap
      const videoContext = this.getVideoContext();
      if (!videoContext) return;
      
      if (this._isPlaying) {
        // Currently playing, so pause
        videoContext.pause();
        this._isPlaying = false;
        // Notify parent component
        this.triggerEvent('videopaused');
      } else {
        // Currently paused, so play
        videoContext.play();
        this._isPlaying = true;
        // Notify parent component  
        this.triggerEvent('videoplaying');
      }
    },
    
    onVideoPlay() {
      // Mark as playing
      this._isPlaying = true;

      // Clear timer if exists
      if (this.playButtonTimer) {
        clearTimeout(this.playButtonTimer);
        this.playButtonTimer = null;
      }

      // Hide video play button when playing
      this.setData({
        userPausedVideo: false,
        isVideoPaused: false,
        showVideoPlayButton: false
      });

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
      // Mark as not playing
      this._isPlaying = false;

      // Show video play button when paused
      this.setData({
        isVideoPaused: true,
        showVideoPlayButton: true
      });

      // Clear existing timer if any
      if (this.playButtonTimer) {
        clearTimeout(this.playButtonTimer);
      }

      // Hide play button after 1.5 seconds with fade
      this.playButtonTimer = setTimeout(() => {
        this.setData({
          showVideoPlayButton: false
        });
      }, 1500);

      this.triggerEvent('videopaused');
    },

    onVideoEnded() {
      // Always trigger video ended event to move to next post
      // Parent component will handle navigation
      this.triggerEvent('videoended');
    },

    onVideoPlayButtonTap() {
      // Clear timer if exists
      if (this.playButtonTimer) {
        clearTimeout(this.playButtonTimer);
        this.playButtonTimer = null;
      }

      // Resume video playback when play button is tapped
      const videoContext = this.getVideoContext();
      if (videoContext) {
        videoContext.play();
        // Hide the play button immediately
        this.setData({
          showVideoPlayButton: false,
          isVideoPaused: false
        });
      }
    },


    onVideoError(e) {
      
      // Check if URL contains #devtools_no_referrer
      if (this.data.videoSrc && this.data.videoSrc.includes('#')) {
      }
      
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
      
      // Don't play here - let autoplay handle it
    },

    onVideoWaiting() {
      // Video is waiting for more data - trigger event instead of direct state change
      this.triggerEvent('videowaiting', {
        isLoading: false,
        isWaitingForApi: false
      });
      
      // Don't try to play here - let the video buffer naturally
    },

    onVideoLoadedData() {
      // Video data has been loaded
      // Don't play here - autoplay attribute will handle it
      
      // Clear loading states via event
      this.triggerEvent('videoloadeddata', {
        isLoading: false,
        isWaitingForApi: false
      });
    },

    onVideoLoadedMetadata() {
      // Video metadata loaded
      // Don't play here - autoplay attribute will handle it
    },

    onVideoTimeUpdate() {
      // Video time is updating - means it's playing properly
      // Clear any lingering loading states via event
      this.triggerEvent('videotimeupdate', {
        isLoading: false,
        isWaitingForApi: false
      });
    },

    // Removed prefetchImageDimensions - keep it simple

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
        // Don't set muted property as it's controlled by WXML binding
        this.playUploadedAudio();
      } else {
        // Play both audio tracks
        // Don't set muted property as it's controlled by WXML binding
        this.playUploadedAudio();
      }
    },

    /**
     * Play uploaded audio - Enhanced with global state verification
     */
    playUploadedAudio() {
      const { currentPost, isPlaying, isWaitingForApi } = this.properties;
      const { videoReady } = this.data;
      
      
      // Only play audio if this is the currently active/playing post with strict conditions
      if (!currentPost || 
          !currentPost.audio_url || 
          !isPlaying || 
          isWaitingForApi ||
          !videoReady) {
        return;
      }
      
      // Additional check: ensure we're not in a transition state
      const parent = this.selectOwnerComponent();
      if (parent && (parent.data.isLoading || parent.data.isWaitingForApi || parent.isCurrentlyLoading)) {
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
          
          
          if (activeIndex !== -1 && activeIndex !== ourIndex) {
            return;
          }
        }
      }
      
      // Android: Additional verification
      const systemInfo = wx.getSystemInfoSync();
      if (systemInfo.platform === 'android') {
        // Double-check by looking at parent actualIsPlaying state
        if (parent && parent.data && parent.data.actualIsPlaying !== true) {
          return;
        }
      }
      
      
      // Destroy previous audio context first to prevent multiple audio playback
      this.destroyUploadedAudio();
      
      // Create new audio context for current post
      this.audioContext = wx.createInnerAudioContext();
      this.audioContext.src = currentPost.audio_url;
      this.audioContext.loop = true;
      
      // Add error handling
      this.audioContext.onError((err) => {
        this.destroyUploadedAudio();
      });
      
      this.audioContext.play();
      
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
          
          if (isAndroid) {
            // Android: Aggressive multi-stage cleanup
            
            // Stage 1: Multiple pause attempts
            try {
              this.audioContext.pause();
              this.audioContext.pause(); // Double pause for Android
            } catch (e1) {
            }
            
            // Stage 2: Multiple stop attempts  
            try {
              this.audioContext.stop();
              this.audioContext.stop(); // Double stop for Android
            } catch (e2) {
            }
            
            // Stage 3: Clear src to prevent background loading
            try {
              this.audioContext.src = '';
            } catch (e3) {
            }
            
            // Stage 4: Destroy with multiple attempts
            try {
              this.audioContext.destroy();
            } catch (e4) {
            }
            
            // Stage 5: Immediate nullification
            this.audioContext = null;
            
            // Stage 6: Additional cleanup attempts with delays
            setTimeout(() => {
              // Try to stop any remaining background audio
              try {
                wx.stopBackgroundAudio();
              } catch (bgError) {
              }
            }, 50);
            
            setTimeout(() => {
              // Final cleanup attempt
              if (this.audioContext) {
                try {
                  this.audioContext.destroy();
                  this.audioContext = null;
                } catch (finalError) {
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
          this.audioContext = null;
        }
      }
    }
  }
});
