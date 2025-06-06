// components/detail-panel/detail-panel.js
Component({
  properties: {
    showDetail: { type: Boolean, value: false },
    tabIndex: { type: Number, value: 1 },
    currentPost: { type: Object, value: {} },
    currentPostUser: { type: Object, value: {} },
    authUser: { type: Object, value: null },
    userComments: { type: Array, value: [] },
    selectedDot: { type: Object, value: null },
    displayFollowerCount: { type: String, value: "0" },
    displayLikeCount: { type: String, value: "0" },
  },  data: {
    panelState: 'closed', // 'closed', 'half', 'full'
    isDragging: false,
    startY: 0,
    currentY: 0,
    startTime: 0,
    translateY: 0,
    windowHeight: 0,
    containerHeight: 0,
  },

  attached() {
    // Get system info
    const systemInfo = wx.getSystemInfoSync();
    this.setData({
      windowHeight: systemInfo.windowHeight
    });
    
    // Get container dimensions
    this.getContainerDimensions();
  },
  
  ready() {
    // Update container dimensions after component is fully rendered
    this.getContainerDimensions();
  },

  observers: {
    showDetail: function(show) {
      if (show && this.data.panelState === 'closed') {
        this.setData({ panelState: 'half' });
      } else if (!show) {
        this.setData({ panelState: 'closed' });
      }
    }
  },

  methods: {
    onTabChange(e) {
      const { index } = e.currentTarget.dataset;
      this.triggerEvent("tabchange", { index });
    },

    onCloseDetail() {
      this.setData({ panelState: 'closed' });
      this.triggerEvent("closedetail");
    },    // Touch event handlers for swipe gesture
    onTouchStart(e) {
      const touch = e.touches[0];
      const { panelState } = this.data;
      
      // Only allow dragging when not in full screen mode
      if (panelState === 'full') {
        return;
      }
      
      this.setData({
        isDragging: true,
        startY: touch.clientY,
        currentY: touch.clientY,
        startTime: Date.now(),
        translateY: 0
      });
    },    onTouchMove(e) {
      if (!this.data.isDragging) return;
      
      const touch = e.touches[0];
      const deltaY = touch.clientY - this.data.startY;
      const { panelState, containerHeight, windowHeight } = this.data;
      
      // Use containerHeight if available, fallback to windowHeight
      const height = containerHeight || windowHeight;
      
      let newTranslateY = 0;
      
      // Calculate translate based on current panel state
      if (panelState === 'half') {
        if (deltaY > 0) {
          // Dragging down - allow closing
          newTranslateY = Math.min(deltaY, height * 0.6);
        } else {
          // Dragging up - allow full screen
          newTranslateY = deltaY;
        }
      } else if (panelState === 'full') {
        if (deltaY > 0) {
          // Only allow dragging down from full screen
          newTranslateY = deltaY;
        }
      }
      
      // Add haptic feedback for better UX
      if (Math.abs(deltaY) > 10 && Math.abs(deltaY) % 50 === 0) {
        wx.vibrateShort({
          type: 'light'
        });
      }
      
      this.setData({
        currentY: touch.clientY,
        translateY: newTranslateY
      });
    },    onTouchEnd(e) {
      if (!this.data.isDragging) return;
      
      const { startY, currentY, startTime, panelState, containerHeight, windowHeight } = this.data;
      const deltaY = currentY - startY;
      const deltaTime = Date.now() - startTime;
      const velocity = Math.abs(deltaY) / deltaTime; // pixels per ms
      
      // Use containerHeight if available, fallback to windowHeight
      const height = containerHeight || windowHeight;
      
      let newPanelState = panelState;
      
      // Determine new state based on gesture
      if (velocity > 0.5) {
        // Fast swipe
        if (deltaY > 50) {
          // Fast swipe down
          newPanelState = panelState === 'full' ? 'half' : 'closed';
        } else if (deltaY < -50) {
          // Fast swipe up
          newPanelState = panelState === 'half' ? 'full' : 'half';
        }
      } else {
        // Slow drag - check distance
        if (panelState === 'half') {
          if (deltaY > height * 0.2) {
            // Dragged down more than 20% of screen
            newPanelState = 'closed';
          } else if (deltaY < -height * 0.15) {
            // Dragged up more than 15% of screen
            newPanelState = 'full';
          }
        } else if (panelState === 'full') {
          if (deltaY > height * 0.15) {
            // Dragged down more than 15% of screen
            newPanelState = 'half';
          }
        }
      }
      
      // Add haptic feedback for state change
      if (newPanelState !== panelState) {
        wx.vibrateShort({
          type: 'medium'
        });
      }
      
      // Apply new state
      this.setData({
        isDragging: false,
        translateY: 0,
        panelState: newPanelState
      });
      
      // Trigger events based on state change
      if (newPanelState === 'closed') {
        this.triggerEvent("closedetail");
      } else if (newPanelState !== panelState) {
        this.triggerEvent("statechange", { state: newPanelState });
      }
    },

    onFollowUser() {
      this.triggerEvent("follow");
    },

    onSelectUserPost(e) {
      this.triggerEvent("selectpost", e.detail);
    },

    onCommentLike(e) {
      this.triggerEvent("commentlike", e.detail);
    },

    onCommentSent(e) {
      this.triggerEvent("commentsent", e.detail);
    },

    onCommentUpdated(e) {
      this.triggerEvent("commentupdated", e.detail);
    },

    onCommentDelete(e) {
      this.triggerEvent("commentdelete", e.detail);
    },    onImagePreview(e) {
      this.triggerEvent("imagepreview", e.detail);
    },

    onLoginRequired() {
      this.triggerEvent("loginrequired");
    },
    
    /**
     * Get actual container dimensions from the parent media-player
     */
    getContainerDimensions() {
      const query = this.createSelectorQuery().in(this);
      query.select('.detail-panel').boundingClientRect((rect) => {
        if (rect) {
          this.setData({
            containerHeight: rect.height
          });
        }
      }).exec();
      
      // Also try to get the parent container dimensions
      const parentQuery = this.createSelectorQuery().selectViewport();
      parentQuery.boundingClientRect((rect) => {
        if (rect && !this.data.containerHeight) {
          this.setData({
            containerHeight: rect.height
          });
        }
      }).exec();
    },
  },
});
