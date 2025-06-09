// components/detail-panel/detail-panel.js
Component({  properties: {
    showDetail: { type: Boolean, value: false },
    panelState: { type: String, value: "closed" }, // Receive panelState from parent
    tabIndex: { type: Number, value: 1 },
    currentPost: { type: Object, value: {} },
    currentPostUser: { type: Object, value: {} },
    authUser: { type: Object, value: null },
    userComments: { type: Array, value: [] },
    selectedDot: { type: Object, value: null },
    displayFollowerCount: { type: String, value: "0" },
    displayLikeCount: { type: String, value: "0" },
  },
  data: {
    // Remove local panelState, use property instead
    isDragging: false,
    startY: 0,
    currentY: 0,
    startTime: 0,
    translateY: 0,
    windowHeight: 0,
    containerHeight: 0,
  },

  attached() {
    const systemInfo = wx.getSystemInfoSync();
    this.setData({
      windowHeight: systemInfo.windowHeight,
    });

    // Get container dimensions
    this.getContainerDimensions();
  },

  ready() {
    // Update container dimensions after component is fully rendered
    this.getContainerDimensions();
  },  observers: {
    panelState: function (state) {
      console.log("detail-panel panelState observer:", state);
      // Panel state is now controlled by parent, no need to set local state
    },
    showDetail: function (show) {
      console.log(
        "detail-panel showDetail observer:",
        show,
        "current panelState:",
        this.properties.panelState
      );

      // Only trigger state change events, don't manage state locally
      if (show && this.properties.panelState === "closed") {
        this.triggerEvent("statechange", { state: "half" });
        console.log("detail-panel triggered statechange to half via observer");
      } else if (!show && this.properties.panelState !== "closed") {
        this.triggerEvent("statechange", { state: "closed" });
        console.log("detail-panel triggered statechange to closed via observer");
      }
    },
  },

  methods: {
    onTabChange(e) {
      const { index } = e.currentTarget.dataset;
      this.triggerEvent("tabchange", { index });
    },    onCloseDetail() {
      // Don't set local state, just trigger event for parent to handle
      this.triggerEvent("closedetail");
    },

    // Touch event handlers for swipe gesture
    onTouchStart(e) {
      const touch = e.touches[0];
      const { panelState } = this.properties; // Use property instead of data

      // Only allow dragging when not in full screen mode
      if (panelState === "full") {
        return;
      }

      this.setData({
        isDragging: true,
        startY: touch.clientY,
        currentY: touch.clientY,
        startTime: Date.now(),
        translateY: 0,
      });
    },    onTouchMove(e) {
      if (!this.data.isDragging) return;

      const touch = e.touches[0];
      const deltaY = touch.clientY - this.data.startY;
      const { panelState } = this.properties; // Use property instead of data
      const { containerHeight, windowHeight } = this.data;

      // Use containerHeight if available, fallback to windowHeight
      const height = containerHeight || windowHeight;

      let newTranslateY = 0;

      // Calculate translate based on current panel state
      if (panelState === "half") {
        if (deltaY > 0) {
          // Dragging down - allow closing
          newTranslateY = Math.min(deltaY, height * 0.6);
        } else {
          // Dragging up - allow full screen
          newTranslateY = deltaY;
        }
      } else if (panelState === "full") {
        if (deltaY > 0) {
          // Only allow dragging down from full screen
          newTranslateY = deltaY;
        }
      }

      // Add haptic feedback for better UX
      if (Math.abs(deltaY) > 10 && Math.abs(deltaY) % 50 === 0) {
        wx.vibrateShort({
          type: "light",
        });
      }

      this.setData({
        currentY: touch.clientY,
        translateY: newTranslateY,
      });
    },    onTouchEnd(e) {
      if (!this.data.isDragging) return;

      const {
        startY,
        currentY,
        startTime,
        containerHeight,
        windowHeight,
      } = this.data;
      const { panelState } = this.properties; // Use property instead of data
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
          newPanelState = panelState === "full" ? "half" : "closed";
        } else if (deltaY < -50) {
          // Fast swipe up
          newPanelState = panelState === "half" ? "full" : "half";
        }
      } else {
        // Slow drag - check distance
        if (panelState === "half") {
          if (deltaY > height * 0.2) {
            // Dragged down more than 20% of screen
            newPanelState = "closed";
          } else if (deltaY < -height * 0.15) {
            // Dragged up more than 15% of screen
            newPanelState = "full";
          }
        } else if (panelState === "full") {
          if (deltaY > height * 0.15) {
            // Dragged down more than 15% of screen
            newPanelState = "half";
          }
        }
      }

      // Add haptic feedback for state change
      if (newPanelState !== panelState) {
        wx.vibrateShort({
          type: "medium",
        });
      }

      // Reset dragging state
      this.setData({
        isDragging: false,
        translateY: 0,
      });

      // Trigger events based on state change - let parent handle state
      if (newPanelState === "closed") {
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
    },    onCommentSent(e) {
      // Just trigger event, parent handles state management
      this.triggerEvent("commentsent", e.detail);
    },

    onCommentUpdated(e) {
      // Just trigger event, parent handles state management
      this.triggerEvent("commentupdated", e.detail);
    },

    onCommentDelete(e) {
      this.triggerEvent("commentdelete", e.detail);
    },
    onImagePreview(e) {
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
      query
        .select(".detail-panel")
        .boundingClientRect((rect) => {
          if (rect) {
            this.setData({
              containerHeight: rect.height,
            });
          }
        })
        .exec();

      // Also try to get the parent container dimensions
      const parentQuery = this.createSelectorQuery().selectViewport();
      parentQuery
        .boundingClientRect((rect) => {
          if (rect && !this.data.containerHeight) {
            this.setData({
              containerHeight: rect.height,
            });
          }
        })
        .exec();
    },
  },
});
