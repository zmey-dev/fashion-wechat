Component({
  /**
   * 组件属性
   */
  properties: {
    // 当前选中的标签页
    currentTab: {
      type: String,
      value: '',
      observer: function(newVal) {
        // 当标签页改变时，清除过滤器选择
        if (newVal && this.data.currentFilter) {
          this.setData({ currentFilter: '' });
        }
      }
    },
    // 当前选中的过滤器
    currentFilter: {
      type: String,
      value: '',
      observer: function(newVal) {
        // 当过滤器改变时，清除标签页选择
        if (newVal && this.data.currentTab) {
          this.setData({ currentTab: '' });
        }
        this.scrollToCurrentFilter();
      }
    }
  },

  /**
   * 组件数据
   */  data: {
    filterScrollLeft: 0,
    dynamicTabStyle: 'expanded', // 'expanded' or 'compact'    // 过滤器选项列表 (去掉friend)
    filterOptions: [
      { key: "discover", name: "精选", path: "/pages/index/index" },
      { key: "recommend", name: "推荐", path: "/pages/recommend/recommend" },
      { key: "follow", name: "关注", path: "/pages/follow/follow" },
      { key: "event", name: "比赛", path: "/pages/event/event" },
            { key: "contact", name: "联系我们", path: "/pages/contact/contact" }
    ],
    // 标签页选项列表 (이미지 아이콘 사용)
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
   * 组件生命周期函数
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
      
      // 组件附加时滚动到当前过滤器
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
   * 组件方法
   */
  methods: {
    /**
     * 过滤器标签点击事件处理
     */    onFilterTap: function(e) {
      const { filter } = e.currentTarget.dataset;
      const app = getApp();
      
      // 需要登录验证的过滤器页面 (discover除外)
      const needLoginFilters = ['recommend', 'follow', 'event', 'contact'];        // 检查是否需要登录
      if (needLoginFilters.includes(filter)) {
        const userInfo = app.globalData.userInfo;
        if (!userInfo || !userInfo.token) {
          // 显示登录模态框
          app.setState("showLoginModal", true);
          return;
        }
      }
      
      // 更新当前过滤器，清除标签页选择
      this.setData({ 
        currentFilter: filter,
        currentTab: ''
      });
      
      // 查找过滤器选项
      const filterOption = this.data.filterOptions.find(item => item.key === filter);
      
      if (filterOption && filterOption.path) {
        // 导航到对应页面
        this.navigateToPage(filterOption.path);
      }
      
      // 向父组件传递过滤器变化事件
      this.triggerEvent('filterChange', { filter });
    },/**
     * 标签页点击事件处理
     */
    onTabTap: function(e) {
      const { tab } = e.currentTarget.dataset;
      const app = getApp();
      
      // 需要登录验证的页面
      const needLoginPages = ['chat', 'notification','friend', 'me', 'upload'];
        // 检查是否需要登录
      if (needLoginPages.includes(tab)) {
        const userInfo = app.globalData.userInfo;
        if (!userInfo || !userInfo.token) {
          // 显示登录模态框
          app.setState("showLoginModal", true);
          return;
        }
      }
      
      // 更新当前标签页，清除过滤器选择
      this.setData({ 
        currentTab: tab,
        currentFilter: ''
      });
      
      // 查找标签页选项
      const tabOption = this.data.tabs.find(item => item.key === tab);
      
      if (tabOption && tabOption.path) {
        // 导航到对应页面
        this.navigateToPage(tabOption.path);
        
        // 如果是通知页面，清除通知计数
        if (tab === 'notification') {
          this.clearNotificationCount();
        }
      }
      
      // 向父组件传递标签页变化事件
      this.triggerEvent('tabChange', { tab });
    },

    /**
     * 页面导航处理
     */
    navigateToPage: function(path) {
      wx.navigateTo({
        url: path,
        fail: () => {
          // 如果navigateTo失败，尝试redirectTo
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
     * 自动滚动到当前过滤器
     */
    scrollToCurrentFilter: function() {
      const currentFilter = this.data.currentFilter;
      if (!currentFilter) return;
      
      const query = this.createSelectorQuery();
      
      // 查找当前过滤器的索引
      const index = this.data.filterOptions.findIndex(item => item.key === currentFilter);
      
      if (index === -1) return;
      
      // 获取位置信息
      query.selectAll('.filter-tab').boundingClientRect();
      query.select('.filter-scroll').boundingClientRect();
      
      query.exec(res => {
        if (!res || !res[0] || !res[1]) return;
        
        const tabRects = res[0];
        const scrollRect = res[1];
        
        if (index < tabRects.length) {
          const tabRect = tabRects[index];
          
          // 计算滚动位置以居中当前过滤器标签
          const scrollLeft = Math.max(0, 
            tabRect.left - scrollRect.left - (scrollRect.width / 2) + (tabRect.width / 2)
          );
          
          // 设置滚动位置
          this.setData({ filterScrollLeft: scrollLeft });
        }
      });
    },    /**
     * 显示提示消息
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