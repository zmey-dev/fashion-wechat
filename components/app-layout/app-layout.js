const { default: config } = require("../../config");

Component({
  /**
   * Component properties
   */
  properties: {
    // Currently active page
    currentPage: {
      type: String,
      value: "",
      observer: function (newVal) {
        this.scrollToCurrentPage();
      },
    },
  },

  /**
   * Component data
   */
  data: {
    filterScrollLeft: 0,
    dynamicTabStyle: "expanded", // 'expanded' or 'compact'
    isTeacher: false, // Flag to determine if current user is a teacher
    // All pages list - unified structure for regular users
    pages: [
      // Filter pages (top navigation)
      {
        key: "discover",
        name: "精选",
        path: "/pages/index/index",
        type: "filter",
      },
      {
        key: "recommend",
        name: "推荐",
        path: "/pages/recommend/recommend",
        type: "filter",
      },
      {
        key: "follow",
        name: "关注",
        path: "/pages/follow/follow",
        type: "filter",
      },
      {
        key: "event",
        name: "校秀",
        path: "/pages/event/event",
        type: "filter",
      },      {
        key: "contact",
        name: "学校",
        path: "/pages/contact/contact",
        type: "filter",
      },
      {
        key: "chat",
        name: "聊天",
        icon: "/images/icons/message.png",
        activeIcon: "/images/icons/message-active.png",
        path: "/pages/chat/chat",
        type: "tab",
      },
      {
        key: "friend",
        name: "朋友",
        icon: "/images/icons/friend.png",
        activeIcon: "/images/icons/friend-active.png",
        path: "/pages/friend/friend",
        type: "tab",
      },
      {
        key: "upload",
        name: "发布",
        icon: "/images/icons/circle-plus.svg",
        activeIcon: "/images/icons/circle-plus.svg",
        path: "/pages/upload/upload",
        isSpecial: true,
        type: "tab",
      },
      {
        key: "notification",
        name: "通知",
        icon: "/images/icons/notification.png",
        activeIcon: "/images/icons/notification-active.png",
        path: "/pages/notification/notification",
        type: "tab",
      },
      {
        key: "me",
        name: "我的",
        icon: "/images/icons/me.png",
        activeIcon: "/images/icons/me-active.png",
        path: "/pages/me/me",
        type: "tab",
      },
    ], // Teacher pages configuration - only filter pages (top bar only)
    teacherPages: [
      {
        key: "discover",
        name: "精选",
        path: "/pages/index/index",
        type: "filter",
      },
      {
        key: "recommend",
        name: "推荐",
        path: "/pages/recommend/recommend",
        type: "filter",
      },
      {
        key: "follow",
        name: "关注",
        path: "/pages/follow/follow",
        type: "filter",
      },
      {
        key: "event",
        name: "校秀",
        path: "/pages/event/event",
        type: "filter",
      },      {
        key: "contact",
        name: "学校",
        path: "/pages/contact/contact",
        type: "filter",
      },
      {
        key: "me",
        name: "我的",
        icon: "/images/icons/me.png",
        activeIcon: "/images/icons/me-active.png",
        path: "/pages/teacher-me/teacher-me",
        type: "filter", // Note: me page becomes a filter for teachers
      },
    ],
    messages: {
      navigationError: "页面跳转失败",
    },
    // Unread counts
    showLoginModal: false,
    userInfo: {},
    totalUnreadCount: 0,
    notificationCount: 0,

    // Computed properties for template
    filterPages: [],
    tabPages: [],
  },

  /**
   * Component observers
   */
  observers: {
    pages: function (pages) {
      // Update computed properties when pages change
      this.setData({
        filterPages: pages.filter((page) => page.type === "filter"),
        tabPages: pages.filter((page) => page.type === "tab"),
      });
    },
  },
  /**
   * Component lifecycle functions
   */
  lifetimes: {
    attached: function () {
      const app = getApp();

      // Subscribe to state changes
      this.showLoginModalHandler = (showLoginModal) => {
        this.setData({ showLoginModal });
      };      this.userInfoHandler = (userInfo) => {
        this.setData({ userInfo });
        // Update layout for user role
        this.updateLayoutForUserRole(userInfo);
        // Start notification polling when user logs in (but not for teachers)
        if (userInfo && userInfo.token && userInfo.role !== 'teacher') {
          this.startNotificationPolling();
        } else {
          this.stopNotificationPolling();
        }
      };

      // Subscribe to centralized unread count changes
      this.totalUnreadCountHandler = (totalUnreadCount) => {
        console.log(
          "App-layout received totalUnreadCount update:",
          totalUnreadCount
        );
        this.setData({ totalUnreadCount });
      };

      // Subscribe to legacy unreadMessageCount for backward compatibility
      this.unreadMessageCountHandler = (unreadMessageCount) => {
        console.log(
          "App-layout received unreadMessageCount update:",
          unreadMessageCount
        );
        this.setData({ totalUnreadCount: unreadMessageCount });
      };

      // Subscribe to notification count changes
      this.notificationCountHandler = (notificationCount) => {
        console.log(
          "App-layout received notificationCount update:",
          notificationCount
        );
        this.setData({ notificationCount });
      };

      app.subscribe("showLoginModal", this.showLoginModalHandler);
      app.subscribe("userInfo", this.userInfoHandler);
      app.subscribe("totalUnreadCount", this.totalUnreadCountHandler);
      app.subscribe("unreadMessageCount", this.unreadMessageCountHandler);
      app.subscribe("notificationCount", this.notificationCountHandler); // Set initial data from app's centralized state
      this.setData({
        showLoginModal: app.globalData.showLoginModal || false,
        userInfo: app.globalData.userInfo || {},
        totalUnreadCount: app.getTotalUnreadCount(),
        notificationCount: app.getNotificationCount() || 0,
      });

      // Check if user is teacher and update layout accordingly
      this.updateLayoutForUserRole(app.globalData.userInfo);      console.log(
        "App-layout initialized with totalUnreadCount:",
        app.getTotalUnreadCount()
      );

      // Start notification polling if user is logged in (but not for teachers)
      if (app.globalData.userInfo && app.globalData.userInfo.token && app.globalData.userInfo.role !== 'teacher') {
        this.startNotificationPolling();
      }
      // Scroll to current page when component is attached
      setTimeout(() => {
        this.scrollToCurrentPage();
      }, 100);

      // Calculate page tab widths for optimal display
      this.calculatePageTabWidths();
    },

    detached: function () {
      const app = getApp();
      // Unsubscribe from state changes
      app.unsubscribe("showLoginModal", this.showLoginModalHandler);
      app.unsubscribe("userInfo", this.userInfoHandler);
      app.unsubscribe("totalUnreadCount", this.totalUnreadCountHandler);
      app.unsubscribe("unreadMessageCount", this.unreadMessageCountHandler);
      app.unsubscribe("notificationCount", this.notificationCountHandler);

      // Stop notification polling
      this.stopNotificationPolling();
    },
  }
  /**
   * Component methods
   */,
  methods: {
    /**
     * Page click event handler (unified for both filters and tabs)
     */
    onPageTap: function (e) {
      const { page } = e.currentTarget.dataset;
      const app = getApp();

      // Find page configuration
      const pageConfig = this.data.pages.find((item) => item.key === page);
      if (!pageConfig) return;      // Pages that require login authentication (except discover)
      const needLoginPages = [
        "recommend",
        "follow",
        "event",
        "contact",
        "profile",
        "chat",
        "notification",
        "friend",
        "me",
        "upload",
      ];

      // Check if login is required
      if (needLoginPages.includes(page)) {
        const userInfo = app.globalData.userInfo;
        if (!userInfo || !userInfo.token) {
          // Show login modal
          app.setState("showLoginModal", true);
          return;
        }
      }

      // Check if clicking on currently active page
      // Only allow redirection for "discover" page when already active
      if (this.data.currentPage === page && page !== "discover") {
        // Don't navigate if it's the same page and not discover page
        return;
      }

      // Update current page
      this.setData({
        currentPage: page,
      });

      // Navigate to the page
      if (pageConfig.path) {
        // For discover page, use redirectTo; for others, use navigateTo
        if (page === "discover") {
          this.redirectToPage(pageConfig.path);
        } else {
          this.navigateToPage(pageConfig.path);
        }

        // If it's notification page, clear notification count
        if (page === "notification") {
          this.clearNotificationCount();
        }
      }

      // Trigger page change event to parent component
      this.triggerEvent("pageChange", { page, type: pageConfig.type });
    }
    /**
     * Page navigation handler
     */,
    navigateToPage: function (path) {
      wx.redirectTo({
        url: path,
        fail: () => {
          // If navigateTo fails, try redirectTo
          wx.redirectTo({
            url: path,
            fail: () => {
              this.showToast(this.data.messages.navigationError);
            },
          });
        },
      });
    },

    /**
     * Page redirect handler (for discover page)
     */
    redirectToPage: function (path) {
      wx.redirectTo({
        url: path,
        fail: () => {
          this.showToast(this.data.messages.navigationError);
        },
      });
    }
    /**
     * Auto scroll to current page
     */,
    scrollToCurrentPage: function () {
      const currentPage = this.data.currentPage;
      if (!currentPage) return;

      const query = this.createSelectorQuery();

      // Find current page index in filter pages only (for scrolling)
      const filterPages = this.data.pages.filter(
        (page) => page.type === "filter"
      );
      const index = filterPages.findIndex((item) => item.key === currentPage);

      if (index === -1) return;

      // Get position information
      query.selectAll(".filter-tab").boundingClientRect();
      query.select(".filter-scroll").boundingClientRect();

      query.exec((res) => {
        if (!res || !res[0] || !res[1]) return;

        const tabRects = res[0];
        const scrollRect = res[1];

        if (index < tabRects.length) {
          const tabRect = tabRects[index];

          // Calculate scroll position to center current page tab
          const scrollLeft = Math.max(
            0,
            tabRect.left -
              scrollRect.left -
              scrollRect.width / 2 +
              tabRect.width / 2
          );

          // Set scroll position
          this.setData({ filterScrollLeft: scrollLeft });
        }
      });
    },

    /**
     * Show toast message
     */
    showToast: function (title) {
      wx.showToast({
        title: title,
        icon: "none",
        duration: 2000,
      });
    },

    /**
     * Start notification polling every 10 seconds
     */
    startNotificationPolling: function () {
      console.log("Starting notification polling");

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
    stopNotificationPolling: function () {
      console.log("Stopping notification polling");
      if (this.notificationTimer) {
        clearInterval(this.notificationTimer);
        this.notificationTimer = null;
      }
    },

    fetchNotifications: function () {
      const userInfo = this.data.userInfo;

      if (!userInfo || !userInfo.token) {
        console.log("No user token available for fetching notifications");
        return;
      }

      wx.request({
        url: `${config.BACKEND_URL}/notify/get_notifications`,
        method: "GET",
        header: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userInfo.token}`,
        },
        success: (res) => {
          if (res.data) {
            if (res.data.status === "success") {
              const notifications =
                res.data.message || res.data.notifications || [];
              const notificationCount = notifications.length;

              console.log("Fetched notifications:", notificationCount);

              // Update local state
              this.setData({
                notificationCount: notificationCount,
              });

              // Update global state so notification page can react
              const app = getApp();
              app.updateNotifications(notifications);
            } else {
              console.error("Failed to fetch notifications:", res.data.message);
            }
          }
        },
        fail: (err) => {
          console.error("Network error fetching notifications:", err);
        },
      });
    },

    /**
     * Clear notification count (call when user views notifications)
     */
    clearNotificationCount: function () {
      this.setData({
        notificationCount: 0,
      });
    },

    /**
     * Get current unread count for display
     */
    getUnreadCount: function () {
      return this.data.totalUnreadCount;
    },

    /**
     * Get notification count for display
     */
    getNotificationCount: function () {
      return this.data.notificationCount;
    },

    /**
     * Manually refresh unread count from app
     */
    refreshUnreadCount: function () {
      const app = getApp();
      const currentCount = app.getTotalUnreadCount();
      this.setData({ totalUnreadCount: currentCount });
      console.log("App-layout manually refreshed unread count:", currentCount);
    },

    /**
     * Login modal close event handler
     */ onLoginModalClose: function () {
      const app = getApp();
      app.setState("showLoginModal", false);
    },

    /**
     * Login success event handler
     */    onLoginSuccess: function (e) {
      const app = getApp();
      const userInfo = e.detail;

      // Update app's global user info and state
      app.setState("userInfo", userInfo);
      app.setState("showLoginModal", false);

      // Start notification polling for the logged in user (but not for teachers)
      if (userInfo.role !== 'teacher') {
        this.startNotificationPolling();
      }

      console.log("User logged in successfully:", userInfo);
    }
    /**
     * Calculate and set optimal page tab widths
     */,
    calculatePageTabWidths: function () {
      const filterPages = this.data.pages.filter(
        (page) => page.type === "filter"
      );
      const filterCount = filterPages.length;

      // Always use compact mode to allow horizontal scrolling for full text display
      this.setData({
        dynamicTabStyle: "compact",
      });

      console.log(
        `Filter pages: ${filterCount}, using compact mode for full text display`
      );
    }
    /**
     * Update layout based on user role
     */,
    updateLayoutForUserRole: function (userInfo) {
      const isTeacher = userInfo && userInfo.role === "teacher";

      // Store original pages configuration if not already stored
      if (!this.originalPages) {
        this.originalPages = this.data.pages;
      }

      this.setData({
        isTeacher: isTeacher,
        pages: isTeacher ? this.data.teacherPages : this.originalPages,
      });

      console.log(
        "Layout updated for user role:",
        isTeacher ? "teacher" : "regular"
      );
    },

    /**
     * Get filter pages for template rendering
     */
    getFilterPages: function () {
      return this.data.pages.filter((page) => page.type === "filter");
    },

    /**
     * Get tab pages for template rendering
     */
    getTabPages: function () {
      return this.data.pages.filter((page) => page.type === "tab");
    },
  },
});
