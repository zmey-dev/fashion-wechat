Component({
  /**
   * Component properties
   */
  properties: {
    // Currently selected tab
    currentTab: {
      type: String,
      value: '',
      observer: function(newVal) {
        // When tab changes, clear filter selection
        if (newVal && this.data.currentFilter) {
          this.setData({ currentFilter: '' });
        }
      }
    },
    // Currently selected filter
    currentFilter: {
      type: String,
      value: '',
      observer: function(newVal) {
        // When filter changes, clear tab selection
        if (newVal && this.data.currentTab) {
          this.setData({ currentTab: '' });
        }
        this.scrollToCurrentFilter();
      }
    }
  },

  /**
   * Component data
   */
  data: {
    filterScrollLeft: 0,
    dynamicTabStyle: 'expanded', // 'expanded' or 'compact'
    // Filter options list (removed friend)
    filterOptions: [
      { key: "discover", name: "精选", path: "/pages/index/index" },
      { key: "recommend", name: "推荐", path: "/pages/recommend/recommend" },
      { key: "follow", name: "关注", path: "/pages/follow/follow" },
      { key: "event", name: "比赛", path: "/pages/event/event" },
      { key: "contact", name: "联系我们", path: "/pages/contact/contact" }
    ],
    // Tab options list (using image icons)
    tabs: [
      { 
        key: "chat", 
        name: "对话", 
        icon: "/images/icons/message.png",
        activeIcon: "/images/icons/message-active.png",
        path: "/pages/chat/chat" 
      },
      { 
        key: "friend", 
        name: "朋友", 
        icon: "/images/icons/friend.png",
        activeIcon: "/images/icons/friend-active.png",
        path: "/pages/friend/friend" 
      },
      { 
        key: "upload", 
        name: "发布", 
        icon: "/images/icons/upload.png",
        activeIcon: "/images/icons/upload-active.png",
        path: "/pages/upload/upload",
        isSpecial: true 
      },
      { 
        key: "notification", 
        name: "通知", 
        icon: "/images/icons/notification.png",
        activeIcon: "/images/icons/notification-active.png",
        path: "/pages/notification/notification" 
      },
      { 
        key: "me", 
        name: "我的", 
        icon: "/images/icons/me.png",
        activeIcon: "/images/icons/me-active.png",
        path: "/pages/me/me" 
      }
        ],
    messages: {
      navigationError: "页面跳转失败"
    },
    // Unread counts
    showLoginModal: false,
    userInfo: {},
    totalUnreadCount: 0,
    notificationCount: 0
  },
  /**
   * Component lifecycle functions
   */
  lifetimes: {
    attached: function() {
      const app = getApp();
      
      // Subscribe to state changes
      this.showLoginModalHandler = (showLoginModal) => {
        this.setData({ showLoginModal });
      };
      
      this.userInfoHandler = (userInfo) => {
        this.setData({ userInfo });
        // Start notification polling when user logs in
        if (userInfo && userInfo.token) {
          this.startNotificationPolling();
        } else {
          this.stopNotificationPolling();
        }
      };

      // Subscribe to centralized unread count changes
      this.totalUnreadCountHandler = (totalUnreadCount) => {
        console.log('App-layout received totalUnreadCount update:', totalUnreadCount);
        this.setData({ totalUnreadCount });
      };

      // Subscribe to legacy unreadMessageCount for backward compatibility
      this.unreadMessageCountHandler = (unreadMessageCount) => {
        console.log('App-layout received unreadMessageCount update:', unreadMessageCount);
        this.setData({ totalUnreadCount: unreadMessageCount });
      };

      app.subscribe("showLoginModal", this.showLoginModalHandler);
      app.subscribe("userInfo", this.userInfoHandler);
      app.subscribe("totalUnreadCount", this.totalUnreadCountHandler);
      app.subscribe("unreadMessageCount", this.unreadMessageCountHandler);

      // Set initial data from app's centralized state
      this.setData({
        showLoginModal: app.globalData.showLoginModal || false,
        userInfo: app.globalData.userInfo || {},
        totalUnreadCount: app.getTotalUnreadCount(),
      });
      
      console.log('App-layout initialized with totalUnreadCount:', app.getTotalUnreadCount());
      
      // Start notification polling if user is logged in
      if (app.globalData.userInfo && app.globalData.userInfo.token) {
        this.startNotificationPolling();
      }
        // Scroll to current filter when component is attached
      setTimeout(() => {
        this.scrollToCurrentFilter();
      }, 100);

      // Calculate filter tab widths for optimal display
      this.calculateFilterTabWidths();
    },

    detached: function() {
      const app = getApp();
      // Unsubscribe from state changes
      app.unsubscribe("showLoginModal", this.showLoginModalHandler);
      app.unsubscribe("userInfo", this.userInfoHandler);
      app.unsubscribe("totalUnreadCount", this.totalUnreadCountHandler);
      app.unsubscribe("unreadMessageCount", this.unreadMessageCountHandler);
      
      // Stop notification polling
      this.stopNotificationPolling();
    }
  },
  /**
   * Component methods
   */
  methods: {
    /**
     * Filter tab click event handler
     */
    onFilterTap: function(e) {
      const { filter } = e.currentTarget.dataset;
      const app = getApp();
      
      // Filter pages that require login authentication (except discover)
      const needLoginFilters = ['recommend', 'follow', 'event', 'contact'];
      
      // Check if login is required
      if (needLoginFilters.includes(filter)) {
        const userInfo = app.globalData.userInfo;
        if (!userInfo || !userInfo.token) {
          // Show login modal
          app.setState("showLoginModal", true);
          return;
        }
      }
      
      // Update current filter, clear tab selection
      this.setData({ 
        currentFilter: filter,
        currentTab: ''
      });
      
      // Find filter option
      const filterOption = this.data.filterOptions.find(item => item.key === filter);
      
      if (filterOption && filterOption.path) {
        // Navigate to corresponding page
        this.navigateToPage(filterOption.path);
      }      
      // Trigger filter change event to parent component
      this.triggerEvent('filterChange', { filter });
    },

    /**
     * Tab click event handler
     */
    onTabTap: function(e) {
      const { tab } = e.currentTarget.dataset;
      const app = getApp();
      
      // Pages that require login authentication
      const needLoginPages = ['chat', 'notification','friend', 'me', 'upload'];
      
      // Check if login is required
      if (needLoginPages.includes(tab)) {
        const userInfo = app.globalData.userInfo;
        if (!userInfo || !userInfo.token) {
          // Show login modal
          app.setState("showLoginModal", true);
          return;
        }
      }
      
      // Update current tab, clear filter selection
      this.setData({ 
        currentTab: tab,
        currentFilter: ''
      });
      
      // Find tab option
      const tabOption = this.data.tabs.find(item => item.key === tab);
      
      if (tabOption && tabOption.path) {
        // Navigate to corresponding page
        this.navigateToPage(tabOption.path);
        
        // If it's notification page, clear notification count
        if (tab === 'notification') {
          this.clearNotificationCount();
        }
      }
      
      // Trigger tab change event to parent component
      this.triggerEvent('tabChange', { tab });
    },

    /**
     * Page navigation handler
     */    navigateToPage: function(path) {
      wx.navigateTo({
        url: path,
        fail: () => {
          // If navigateTo fails, try redirectTo
          wx.redirectTo({
            url: path,
            fail: () => {
              this.showToast(this.data.messages.navigationError);
            }
          });
        }
      });
    },

    /**
     * Auto scroll to current filter
     */
    scrollToCurrentFilter: function() {
      const currentFilter = this.data.currentFilter;
      if (!currentFilter) return;
      
      const query = this.createSelectorQuery();
      
      // Find current filter index
      const index = this.data.filterOptions.findIndex(item => item.key === currentFilter);
      
      if (index === -1) return;
      
      // Get position information
      query.selectAll('.filter-tab').boundingClientRect();
      query.select('.filter-scroll').boundingClientRect();
      
      query.exec(res => {
        if (!res || !res[0] || !res[1]) return;
        
        const tabRects = res[0];
        const scrollRect = res[1];
        
        if (index < tabRects.length) {
          const tabRect = tabRects[index];
          
          // Calculate scroll position to center current filter tab
          const scrollLeft = Math.max(0, 
            tabRect.left - scrollRect.left - (scrollRect.width / 2) + (tabRect.width / 2)
          );
          
          // Set scroll position
          this.setData({ filterScrollLeft: scrollLeft });
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
    },

    /**
     * Start notification polling every 10 seconds
     */
    startNotificationPolling: function() {
      console.log('Starting notification polling');
      
      // Clear existing timer if any
      if (this.notificationTimer) {
        clearInterval(this.notificationTimer);
      }
      
      // Fetch notifications immediately
      this.fetchNotifications();
      
      // Set up polling every 10 seconds
      this.notificationTimer = setInterval(() => {
        this.fetchNotifications();
      }, 10000);
    },

    /**
     * Stop notification polling
     */
    stopNotificationPolling: function() {
      console.log('Stopping notification polling');
      if (this.notificationTimer) {
        clearInterval(this.notificationTimer);
        this.notificationTimer = null;
      }
    },

    /**
     * Fetch notifications from server
     */
    fetchNotifications: function() {
      const { default: config } = require("../../config");
      const userInfo = this.data.userInfo;
      
      if (!userInfo || !userInfo.token) {
        console.log('No user token available for fetching notifications');
        return;
      }

      wx.request({
        url: `${config.BACKEND_URL}/notify/get_notifications`,
        method: 'GET',
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userInfo.token}`
        },
        success: (res) => {
          if (res.data) {
            if (res.data.status === 'success') {
              const notifications = res.data.message || res.data.notifications || [];
              const notificationCount = notifications.length;
              
              console.log('Fetched notifications:', notificationCount);
              
              this.setData({
                notificationCount: notificationCount
              });
            } else {
              console.error('Failed to fetch notifications:', res.data.message);
            }
          }
        },
        fail: (err) => {
          console.error('Network error fetching notifications:', err);
        }
      });
    },

    /**
     * Clear notification count (call when user views notifications)
     */
    clearNotificationCount: function() {
      this.setData({
        notificationCount: 0
      });
    },

    /**
     * Get current unread count for display
     */
    getUnreadCount: function() {
      return this.data.totalUnreadCount;
    },

    /**
     * Get notification count for display
     */
    getNotificationCount: function() {
      return this.data.notificationCount;
    },

    /**
     * Manually refresh unread count from app
     */
    refreshUnreadCount: function() {
      const app = getApp();
      const currentCount = app.getTotalUnreadCount();
      this.setData({ totalUnreadCount: currentCount });
      console.log('App-layout manually refreshed unread count:', currentCount);
    },

    /**
     * Login modal close event handler
     */    onLoginModalClose: function() {
      const app = getApp();
      app.setState("showLoginModal", false);
    },

    /**
     * Login success event handler
     */    onLoginSuccess: function(e) {
      const app = getApp();
      const userInfo = e.detail;
      
      // Update app's global user info and state
      app.setState("userInfo", userInfo);
      app.setState("showLoginModal", false);
      
      // Start notification polling for the logged in user
      this.startNotificationPolling();
      
      console.log('User logged in successfully:', userInfo);
    },    /**
     * Calculate and set optimal filter tab widths
     */
    calculateFilterTabWidths: function() {
      const filterCount = this.data.filterOptions.length;
      
      // Always use compact mode to allow horizontal scrolling for full text display
      this.setData({
        dynamicTabStyle: 'compact'
      });
      
      console.log(`Filter tabs: ${filterCount}, using compact mode for full text display`);
    },
  }
});