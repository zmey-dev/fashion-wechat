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
    // Add Chinese messages for error states and UI text
    messages: {
      navigationError: "页面跳转失败",
      loginRequired: "需要登录",
      loading: "加载中...",
    }
  },

  lifetimes: {
    attached() {
      const app = getApp();
      
      // Subscribe to state changes
      this.showLoginModalHandler = (showLoginModal) => {
        this.setData({ showLoginModal });
      };
      
      this.userInfoHandler = (userInfo) => {
        this.setData({ userInfo });
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
    },

    detached() {
      const app = getApp();
      // Unsubscribe from state changes
      app.unsubscribe("showLoginModal", this.showLoginModalHandler);
      app.unsubscribe("userInfo", this.userInfoHandler);
      app.unsubscribe("totalUnreadCount", this.totalUnreadCountHandler);
      app.unsubscribe("unreadMessageCount", this.unreadMessageCountHandler);
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

    // Method to manually refresh unread count from app
    refreshUnreadCount() {
      const app = getApp();
      const currentCount = app.getTotalUnreadCount();
      this.setData({ totalUnreadCount: currentCount });
      console.log('Tabbar manually refreshed unread count:', currentCount);
    },
  },
});
