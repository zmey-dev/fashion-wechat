// components/media-display/media-display.js
Component({
  properties: {
    currentPost: { type: Object, value: {} },
    currentMedia: { type: Array, value: [] },
    currentSlideIndex: { type: Number, value: 0 },
    mediaLength: { type: Number, value: 0 },
    isPlaying: { type: Boolean, value: true },
    showPlayIndicator: { type: Boolean, value: false },
    selectedDot: { type: Object, value: null }
  },

  data: {
    containerWidth: 0,
    containerHeight: 0,
    calculatedDots: []
  },

  observers: {
    'currentMedia, currentSlideIndex, isPlaying': function(currentMedia, currentSlideIndex, isPlaying) {
      if (currentMedia && currentMedia.length > 0 && !isPlaying) {
        this.calculateDotPositions();
      } else {
        this.setData({ calculatedDots: [] });
      }
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
    },

    onVideoPause() {
      console.log('Video paused');
    },

    onVideoError(e) {
      console.error('Video error:', e.detail);
    },

    /**
     * Handle image load event to recalculate positions
     */
    onImageLoad() {
      setTimeout(() => {
        this.calculateDotPositions();
      }, 100);
    }
  }
});