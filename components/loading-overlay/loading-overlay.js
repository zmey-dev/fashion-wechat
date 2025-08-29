// components/loading-overlay/loading-overlay.js
Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    loadingText: {
      type: String,
      value: '加载中...'
    }
  },

  data: {
  },

  attached() {
    // Subscribe to global loading state
    const app = getApp();
    this.updateLoadingState = () => {
      this.setData({
        visible: app.globalData.isGlobalLoading || false,
        loadingText: app.globalData.loadingText || '加载中...'
      });
    };
    
    // Initial state
    this.updateLoadingState();
    
    // Subscribe to changes
    app.subscribe('globalLoading', this.updateLoadingState);
  },

  detached() {
    // Unsubscribe from global loading state
    const app = getApp();
    app.unsubscribe('globalLoading', this.updateLoadingState);
  },

  methods: {
  }
});