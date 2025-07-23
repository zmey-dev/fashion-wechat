// components/post-navigation/post-navigation.js
Component({
  properties: {
    show: { type: Boolean, value: true },
    hasPrevious: { type: Boolean, value: false },
    hasNext: { type: Boolean, value: false },
    currentIndex: { type: Number, value: 0 },
    totalCount: { type: Number, value: 1 },
    isLoading: { type: Boolean, value: false },
    showHints: { type: Boolean, value: false }
  },

  data: {
    isPressed: false,
    pressedButton: null,
    progressPercentage: 100
  },


  observers: {
    'currentIndex, totalCount': function(currentIndex, totalCount) {
      this.setData({
        progressPercentage: totalCount <= 1 ? 100 : ((currentIndex + 1) / totalCount) * 100
      });
    }
  },

  methods: {
    onPreviousPost() {
      if (!this.properties.hasPrevious || this.properties.isLoading) return;
      
      this.triggerEvent('previouspost', {});
      this.addFeedback('prev');
    },

    onNextPost() {
      if (!this.properties.hasNext || this.properties.isLoading) return;
      
      this.triggerEvent('nextpost', {});
      this.addFeedback('next');
    },

    onTouchStart(e) {
      const dataset = e.currentTarget.dataset;
      const buttonType = dataset.type || 'unknown';
      this.setData({
        isPressed: true,
        pressedButton: buttonType
      });
    },

    onTouchEnd() {
      // Add small delay for visual feedback
      setTimeout(() => {
        this.setData({
          isPressed: false,
          pressedButton: null
        });
      }, 150);
    },

    addFeedback(type) {
      // Haptic feedback
      wx.vibrateShort({
        type: 'light'
      });

      // Visual feedback animation
      const animation = wx.createAnimation({
        duration: 200,
        timingFunction: 'ease-out'
      });

      animation.scale(0.95).step();
      animation.scale(1).step();

      this.setData({
        [`${type}Animation`]: animation.export()
      });
    },

    // Show/hide hints based on interaction
    showNavigationHints() {
      if (!this.properties.showHints) {
        this.triggerEvent('updatehints', { show: true });
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
          this.triggerEvent('updatehints', { show: false });
        }, 3000);
      }
    }
  }
});