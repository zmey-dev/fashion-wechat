Component({
  /**
   * Component properties
   */
  properties: {
    // Current selected filter
    currentFilter: {
      type: String,
      value: 'discover',
      observer: function(newVal) {
        // Scroll to the filter when value changes
        this.scrollToCurrentFilter();
      }
    },
    // Filter options list
    filterOptions: {
      type: Array,
      value: [
        { key: "discover", name: "发现" },
        { key: "recommend", name: "推荐" },
        { key: "follow", name: "关注" },
        { key: "friend", name: "朋友" },
        { key: "event", name: "活动" },
        { key: "contact", name: "联系" },
      ]
    },
    // Dark mode flag
    darkMode: {
      type: Boolean,
      value: true // Default to dark mode
    }
  },

  /**
   * Component data
   */
  data: {
    scrollLeft: 0,
    messages: {
      navigationError: "页面跳转失败",
      loginRequired: "需要登录",
      loading: "加载中...",
      error: "出错了"
    }
  },

  /**
   * Component lifecycle functions
   */
  lifetimes: {
    attached: function() {
      // Scroll to current filter when component is attached
      setTimeout(() => {
        this.scrollToCurrentFilter();
      }, 100);
    }
  },

  /**
   * Component methods
   */
  methods: {
    /**
     * Filter tab click event handler - redirect to page
     */
    onFilterTap: function(e) {
      const { filter } = e.currentTarget.dataset;
      
      // Do nothing if current filter is selected
      if (filter === this.properties.currentFilter) return;
      
      // Get app instance
      const app = getApp();
      
      // Check login requirement for non-discover filters
      if (filter !== 'discover' && !app.globalData.userInfo) {
        console.log('User not logged in, showing login modal for filter:', filter);
        app.setState("showLoginModal", true);
        return;
      }
      
      // Redirect to page based on filter
      if (filter === "discover") {
        wx.redirectTo({
          url: "/pages/index/index",
          fail: () => {
            this.showToast(this.data.messages.navigationError);
          }
        });
        return;
      }
      
      // Page mapping based on filter
      const pageMap = {
        "recommend": "/pages/recommend/recommend",
        "follow": "/pages/follow/follow", 
        "friend": "/pages/friend/friend",
        "event": "/pages/event/event",
        "contact": "/pages/contact/contact"
      };
      console.log("Navigating to filter:", filter, "Page:", pageMap[filter]);
      
      if (pageMap[filter]) {
        wx.redirectTo({
          url: pageMap[filter],
          fail: () => {
            this.showToast(this.data.messages.navigationError);
          }
        });
      }
    },

    /**
     * Auto scroll to current filter - improved version
     */
    scrollToCurrentFilter: function() {
      const query = this.createSelectorQuery();
      const currentFilter = this.properties.currentFilter;
      
      // Find index of current filter
      const index = this.properties.filterOptions.findIndex(item => item.key === currentFilter);
      
      if (index === -1) return;
      
      // Get position info of current filter element and scroll container
      query.selectAll('.filter-tab').boundingClientRect();
      query.select('.filter-scroll').boundingClientRect();
      
      query.exec(res => {
        if (!res || !res[0] || !res[1]) return;
        
        const tabRects = res[0];
        const scrollRect = res[1];
        
        if (index < tabRects.length) {
          const tabRect = tabRects[index];
          
          // Calculate scroll position to center the current filter tab
          const scrollLeft = Math.max(0, tabRect.left - scrollRect.left - (scrollRect.width / 2) + (tabRect.width / 2));
          
          // Set scroll position
          this.setData({ scrollLeft });
        }
      });
    },

    /**
     * Show toast message
     */
    showToast: function(title) {
      wx.showToast({
        title: title,
        icon: "none",
        duration: 2000
      });
    }
  }
});