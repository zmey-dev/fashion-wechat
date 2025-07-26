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
    detailPanelState: {
      type: String,
      value: 'closed',
      observer(newVal) {
        this.getContainerDimensions();
      }
    }
  },

  data: {
    containerWidth: 0,
    containerHeight: 0,
    calculatedDots: [],
    audioMode: 'both', // 'both', 'uploaded', 'video'
    imageLoadingStates: {}, // Track loading state for each image
    currentImageLoading: true, // Current image loading state
    showImageLoader: false // Show loader overlay
  },

  observers: {
    'currentMedia, currentSlideIndex, isPlaying': function(currentMedia, currentSlideIndex, isPlaying) {
      if (currentMedia && currentMedia.length > 0 && !isPlaying) {
        this.calculateDotPositions();
      } else {
        this.setData({ calculatedDots: [] });
      }
    },
    'currentMedia, currentSlideIndex': function(currentMedia, currentSlideIndex) {
      // Check if current image is loaded when media or slide changes
      this.checkCurrentImageLoadingState(currentMedia, currentSlideIndex);
    }
  },
  ready() {
    this.getContainerDimensions();
    
    // Listen for window resize events
    wx.onWindowResize && wx.onWindowResize(() => {
      setTimeout(() => {
        this.getContainerDimensions();
      }, 200);
    });
  },

  detached() {
    // Clean up event listeners
    wx.offWindowResize && wx.offWindowResize();
  },

  methods: {
    /**
     * Check current image loading state
     */
    checkCurrentImageLoadingState(currentMedia, currentSlideIndex) {
      if (!currentMedia || !currentMedia[currentSlideIndex]) {
        this.setData({ 
          currentImageLoading: false,
          showImageLoader: false 
        });
        return;
      }

      const currentItem = currentMedia[currentSlideIndex];
      const imageUrl = currentItem.url;
      const { imageLoadingStates } = this.data;

      // If image is already loaded, don't show loader
      if (imageLoadingStates[imageUrl]) {
        this.setData({ 
          currentImageLoading: false,
          showImageLoader: false 
        });
        return;
      }

      // Show loader for unloaded image
      this.setData({ 
        currentImageLoading: true,
        showImageLoader: true 
      });

      // Start preloading the image
      this.preloadImage(imageUrl);
    },

    /**
     * Preload image and update loading state
     */
    preloadImage(imageUrl) {
      wx.getImageInfo({
        src: imageUrl,
        success: () => {
          // Image loaded successfully, but add artificial delay
          const { imageLoadingStates } = this.data;
          imageLoadingStates[imageUrl] = true;
          
          // Force longer loading time for better UX
          setTimeout(() => {
            this.setData({ 
              imageLoadingStates,
              currentImageLoading: false,
              showImageLoader: false 
            });
          }, 2500); // Increased to 2.5 seconds artificial delay
        },
        fail: (error) => {
          console.error('Failed to preload image:', error);
          // Hide loader even on error after delay
          setTimeout(() => {
            this.setData({ 
              currentImageLoading: false,
              showImageLoader: false 
            });
          }, 1500); // Increased error delay to 1.5 seconds
        }
      });
    },

    /**
     * Calculate actual image size within container (aspectFit mode)
     */
    calculateContainedImageSize(containerWidth, containerHeight, imageWidth, imageHeight) {
      console.log(containerWidth, containerHeight, imageWidth, imageHeight);
      
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
        console.log(rect);
        
        if (rect) {
          this.setData({
            containerWidth: rect.width,
            containerHeight: rect.height
          });
          this.calculateDotPositions();
        }
      }).exec();
    },    /**
     * Calculate dot positions based on actual image size
     */
    calculateDotPositions() {
      const { currentMedia, currentSlideIndex, containerWidth, containerHeight } = this.data;
      
      if (!currentMedia || !currentMedia[currentSlideIndex] || !currentMedia[currentSlideIndex].dots) {
        this.setData({ calculatedDots: [] });
        return;
      }

      const currentItem = currentMedia[currentSlideIndex];
      const dots = currentItem.dots;

      if (!dots || dots.length === 0 || !containerWidth || !containerHeight) {
        this.setData({ calculatedDots: [] });
        return;
      }

      // For WeChat Mini Program, we need to handle the image dimensions differently
      // We'll try to get the image info first
      wx.getImageInfo({
        src: currentItem.url,
        success: (imageInfo) => {
          const imageWidth = imageInfo.width;
          const imageHeight = imageInfo.height;
          
          const actualImageSize = this.calculateContainedImageSize(
            containerWidth,
            containerHeight,
            imageWidth,
            imageHeight
          );

          const calculatedDots = dots.map((dot, index) => {
            const realLeft = dot.x * actualImageSize.width + actualImageSize.left;
            const realTop = dot.y * actualImageSize.height + actualImageSize.top;
            
            return {
              ...dot,
              index,
              realLeft: Math.round(realLeft),
              realTop: Math.round(realTop),
              // Calculate percentage relative to container for positioning
              leftPercent: (realLeft / containerWidth) * 100,
              topPercent: (realTop / containerHeight) * 100
            };
          });

          this.setData({ calculatedDots });
        },
        fail: (error) => {
          console.warn('Failed to get image info, using fallback dimensions:', error);
          // Fallback to default dimensions if image info fails
          const actualImageSize = this.calculateContainedImageSize(
            containerWidth,
            containerHeight,
            1080, // fallback width
            1080  // fallback height
          );

          const calculatedDots = dots.map((dot, index) => {
            const realLeft = dot.x * actualImageSize.width + actualImageSize.left;
            const realTop = dot.y * actualImageSize.height + actualImageSize.top;
            
            return {
              ...dot,
              index,
              realLeft: Math.round(realLeft),
              realTop: Math.round(realTop),
              leftPercent: (realLeft / containerWidth) * 100,
              topPercent: (realTop / containerHeight) * 100
            };
          });

          this.setData({ calculatedDots });
        }
      });
    },onScreenTap() {
      this.triggerEvent('screentap');
    },

    onSlideChange(e) {
      this.triggerEvent('slidechange', { current: e.detail.current });
      // Recalculate dots when slide changes
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
    },
    
    onVideoPlay() {
      console.log('Video started playing');
    },    onVideoPause() {
      console.log('Video paused');
    },    onVideoEnded() {
      console.log('Video ended');
      this.triggerEvent('videoended');
    },

    // Restart video from beginning with auto-play
    restartVideo() {
      const videoContext = wx.createVideoContext('media-video', this);
      if (videoContext) {
        console.log('Restarting video with auto-play');
        videoContext.seek(0);
        setTimeout(() => {
          videoContext.play();
        }, 100);
      }
    },

    onVideoError(e) {
      console.error('Video error:', e.detail);
    },

    /**
     * Handle image load event to recalculate positions
     */
    onImageLoad(e) {
      // Get the loaded image URL from the event
      const loadedImageUrl = e.currentTarget.dataset.src || e.detail.src;
      
      if (loadedImageUrl) {
        // Update loading state for this specific image with artificial delay
        const { imageLoadingStates } = this.data;
        imageLoadingStates[loadedImageUrl] = true;
        
        // Force longer loading time for better visual feedback
        setTimeout(() => {
          this.setData({ 
            imageLoadingStates,
            currentImageLoading: false,
            showImageLoader: false 
          });
        }, 2200); // Increased to 2.2 seconds artificial delay
      }

      setTimeout(() => {
        this.calculateDotPositions();
      }, 100);
    },

    /**
     * Set audio mode for video playback
     */
    setAudioMode(mode) {
      this.setData({ audioMode: mode });
      
      // Apply audio mode to current video if playing
      const videoContext = wx.createVideoContext('media-video', this);
      if (videoContext && this.properties.currentPost && this.properties.currentPost.type === 'video') {
        this.applyAudioMode(videoContext);
      }
    },

    /**
     * Apply audio mode settings to video
     */
    applyAudioMode(videoContext) {
      const { audioMode, currentPost } = this.data;
      
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
     * Play uploaded audio
     */
    playUploadedAudio() {
      const { currentPost } = this.properties;
      if (!currentPost || !currentPost.audio_url) return;
      
      // Create or get audio context
      if (!this.audioContext) {
        this.audioContext = wx.createInnerAudioContext();
        this.audioContext.src = currentPost.audio_url;
        this.audioContext.loop = true;
      }
      
      this.audioContext.play();
    },

    /**
     * Mute uploaded audio
     */
    muteUploadedAudio() {
      if (this.audioContext) {
        this.audioContext.pause();
      }
    }
  }
});