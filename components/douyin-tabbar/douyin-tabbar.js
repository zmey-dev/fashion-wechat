const { default: config } = require("../../config");

Component({
  properties: {
    current: {
      type: String,
      value: "index",
    },
  },

  data: {
    tabs: [
      {
        name: "index",
        icon: "/images/icons/home.png",
        activeIcon: "/images/icons/home-active.png",
        text: "首页",
        path: "/pages/index/index",
      },
      {
        name: "chat",
        icon: "/images/icons/message.png",
        activeIcon: "/images/icons/message-active.png",
        text: "聊天",
        path: "/pages/chat/chat",
      },
      {
        name: "upload",
        icon: "/images/icons/upload.png",
        activeIcon: "/images/icons/upload.png",
        text: "",
        path: "/pages/upload/upload",
        isSpecial: true,
      },
      {
        name: "notification",
        icon: "/images/icons/notification.png",
        activeIcon: "/images/icons/notification-active.png",
        text: "消息",
        path: "/pages/notification/notification",
      },
      {
        name: "me",
        icon: "/images/icons/me.png",
        activeIcon: "/images/icons/me-active.png",
        text: "我",
        path: "/pages/me/me",
      },
    ],
    showLoginModal: false,
    userInfo: getApp().globalData.userInfo || {},
    // Get unread count from app's centralized state
    totalUnreadCount: 0,
    // Add notification count for alarm
    notificationCount: 0,
    // Add Chinese messages for error states and UI text
    messages: {
      navigationError: "页面跳转失败",
      loginRequired: "需要登录",
      loading: "加载中...",
    }
  },

  // Add timer property
  notificationTimer: null,

  lifetimes: {
    attached() {
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
        console.log('Tabbar received totalUnreadCount update:', totalUnreadCount);
        this.setData({ totalUnreadCount });
      };

      // Subscribe to legacy unreadMessageCount for backward compatibility
      this.unreadMessageCountHandler = (unreadMessageCount) => {
        console.log('Tabbar received unreadMessageCount update:', unreadMessageCount);
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
      
      console.log('Tabbar initialized with totalUnreadCount:', app.getTotalUnreadCount());
      
      // Start notification polling if user is logged in
      if (app.globalData.userInfo && app.globalData.userInfo.token) {
        this.startNotificationPolling();
      }
    },

    detached() {
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

  methods: {
    navigateTo: function (e) {
      const path = e.currentTarget.dataset.path;
      const name = e.currentTarget.dataset.name;

      if (name === this.properties.current) return;

      const app = getApp();

      // Check login for certain tabs
      if (
        ["chat", "upload", "notification", "me"].includes(name) &&
        !app.globalData.userInfo
      ) {
        console.log("User not logged in, showing login modal.");
        app.setState("showLoginModal", true);
        return;
      }

      wx.redirectTo({
        url: path,
        fail: (err) => {
          console.error(`Failed to navigate to ${name}:`, err);
          wx.showToast({
            title: this.data.messages.navigationError,
            icon: "none",
          });
        },
      });
    },

    // Method to get current unread count for display
    getUnreadCount() {
      return this.data.totalUnreadCount;
    },

    // Method to get notification count for display
    getNotificationCount() {
      return this.data.notificationCount;
    },

    // Method to manually refresh unread count from app
    refreshUnreadCount() {
      const app = getApp();
      const currentCount = app.getTotalUnreadCount();
      this.setData({ totalUnreadCount: currentCount });
      console.log('Tabbar manually refreshed unread count:', currentCount);
    },

    // Start notification polling every 10 seconds
    startNotificationPolling() {
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

    // Stop notification polling
    stopNotificationPolling() {
      console.log('Stopping notification polling');
      if (this.notificationTimer) {
        clearInterval(this.notificationTimer);
        this.notificationTimer = null;
      }
    },

    // Fetch notifications from server
    fetchNotifications() {
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

    // Method to clear notification count (call when user views notifications)
    clearNotificationCount() {
      this.setData({
        notificationCount: 0
      });
    },
  },
});
