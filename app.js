const { default: config } = require("./config");
const { socketManager } = require("./services/socket");
const { isEmpty } = require("./utils/isEmpty");

App({
  globalData: {
    showSidebar: false,
    showLoginModal: false,
    userInfo: null,
    friends: [],
    followUsers: [],
    followedUsers: [],
    swear: [],
    currentPath: "discover",
    observers: {},
    socketManager: socketManager,
    // Centralized unread message management
    unreadMessageCount: 0,
    totalUnreadCount: 0,
    unreadMessagesByUser: {}, // { userId: { count: number, lastMessage: string } }
    // Notification management
    notifications: [],
    notificationCount: 0,
  },

  // Subscribe to state changes
  subscribe(key, callback) {
    if (!this.globalData.observers[key]) {
      this.globalData.observers[key] = [];
    }
    this.globalData.observers[key].push(callback);
  },

  // Unsubscribe from state changes
  unsubscribe(key, callback) {
    if (this.globalData.observers[key]) {
      const index = this.globalData.observers[key].indexOf(callback);
      if (index > -1) {
        this.globalData.observers[key].splice(index, 1);
      }
    }
  },

  // Update state and notify observers
  setState(key, value) {
    this.globalData[key] = value;
    if (this.globalData.observers[key]) {
      this.globalData.observers[key].forEach((callback) => {
        callback(value);
      });
    }
  },

  // Get current state
  getState(key) {
    return this.globalData[key];
  },

  // Centralized unread message management methods
  updateUnreadMessages(unreadMessages) {
    // Reset the unread messages map
    this.globalData.unreadMessagesByUser = {};

    // Update unread messages by user
    unreadMessages.forEach((msg) => {
      this.globalData.unreadMessagesByUser[msg.sender_id] = {
        count: msg.count || 0,
        lastMessage: msg.last_message || "",
      };
    });

    // Calculate total unread count
    const totalUnread = unreadMessages.reduce(
      (total, message) => total + (message.count || 0),
      0
    );

    this.globalData.totalUnreadCount = totalUnread;
    this.globalData.unreadMessageCount = totalUnread; // For backward compatibility

    // Notify observers
    this.setState("totalUnreadCount", totalUnread);
    this.setState("unreadMessageCount", totalUnread);
    this.setState("unreadMessagesByUser", this.globalData.unreadMessagesByUser);
  },

  // Increment unread count for a specific user
  incrementUnreadForUser(senderId, message) {
    if (!this.globalData.unreadMessagesByUser[senderId]) {
      this.globalData.unreadMessagesByUser[senderId] = { count: 0, lastMessage: "" };
    }

    this.globalData.unreadMessagesByUser[senderId].count += 1;
    this.globalData.unreadMessagesByUser[senderId].lastMessage = message;

    // Recalculate total
    const totalUnread = Object.values(this.globalData.unreadMessagesByUser).reduce(
      (total, user) => total + user.count,
      0
    );

    this.globalData.totalUnreadCount = totalUnread;
    this.globalData.unreadMessageCount = totalUnread;

    // Notify observers
    this.setState("totalUnreadCount", totalUnread);
    this.setState("unreadMessageCount", totalUnread);
    this.setState("unreadMessagesByUser", this.globalData.unreadMessagesByUser);
  },

  // Clear unread count for a specific user
  clearUnreadForUser(userId) {
    if (this.globalData.unreadMessagesByUser[userId]) {
      delete this.globalData.unreadMessagesByUser[userId];

      // Recalculate total
      const totalUnread = Object.values(this.globalData.unreadMessagesByUser).reduce(
        (total, user) => total + user.count,
        0
      );

      this.globalData.totalUnreadCount = totalUnread;
      this.globalData.unreadMessageCount = totalUnread;

      // Notify observers
      this.setState("totalUnreadCount", totalUnread);
      this.setState("unreadMessageCount", totalUnread);
      this.setState("unreadMessagesByUser", this.globalData.unreadMessagesByUser);
    }
  },

  // Clear all unread messages
  clearAllUnreadMessages() {
    this.globalData.unreadMessagesByUser = {};
    this.globalData.totalUnreadCount = 0;
    this.globalData.unreadMessageCount = 0;

    // Notify observers
    this.setState("totalUnreadCount", 0);
    this.setState("unreadMessageCount", 0);
    this.setState("unreadMessagesByUser", {});
  },

  // Get unread count for a specific user
  getUnreadCountForUser(userId) {
    return this.globalData.unreadMessagesByUser[userId]?.count || 0;
  },

  // Get total unread count
  getTotalUnreadCount() {
    return this.globalData.totalUnreadCount;
  },

  // Update notifications globally
  updateNotifications(notifications) {
    this.globalData.notifications = notifications || [];
    this.globalData.notificationCount = notifications ? notifications.length : 0;
    
    // Notify observers
    this.setState("notifications", this.globalData.notifications);
    this.setState("notificationCount", this.globalData.notificationCount);
  },

  // Get current notifications
  getNotifications() {
    return this.globalData.notifications;
  },

  // Get notification count
  getNotificationCount() {
    return this.globalData.notificationCount;
  },

  // Fetch unread messages from server
  fetchUnreadMessages() {
    if (!this.globalData.userInfo || !this.globalData.userInfo.token) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      wx.request({
        url: `${config.BACKEND_URL}/messages/get_unread_message`,
        method: "GET",
        header: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.globalData.userInfo.token}`,
        },
        success: (res) => {
          if (
            res.statusCode === 200 &&
            res.data &&
            res.data.status === "success"
          ) {
            const unreadMessages = res.data.messages || [];
            // Update centralized unread messages
            this.updateUnreadMessages(unreadMessages);
            resolve(unreadMessages);
          } else {
            this.updateUnreadMessages([]);
            resolve([]);
          }
        },
        fail: (err) => {
          reject(err);
        },
      });
    });
  },

  // Setup socket listeners for unread message management
  setupUnreadMessageSocketListeners() {
    // Handle new message events
    socketManager.on("new_message", (data) => {
      // Get current page info to determine if user is in chat with sender
      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1];
      const isInChatWithSender =
        currentPage?.route?.includes("chat") &&
        currentPage?.data?.selectedUser?.id === data.sender_id;

      // Only increment unread count if not currently chatting with sender
      if (!isInChatWithSender) {
        this.incrementUnreadForUser(data.sender_id, data.message);
      }
    });

    // Handle read message events
    socketManager.on("read_message", (data) => {
      // When someone reads our messages, we don't need to update unread counts
      // as unread counts are for messages WE haven't read
    });
  },

  // Remove socket listeners
  cleanupUnreadMessageSocketListeners() {
    socketManager.off("new_message");
    socketManager.off("read_message");
  },

  // Set current path
  setCurrentPath(path) {
    this.globalData.currentPath = path;
  },

  // Determine current path based on route
  determineCurrentPath() {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    const route = currentPage.route;

    let currentPath = "";
    if (route.includes("discover") || route.includes("index")) {
      currentPath = "discover";
    } else if (route.includes("recommend")) {
      currentPath = "recommend";
    } else if (route.includes("follow")) {
      currentPath = "follow";
    } else if (route.includes("chat")) {
      currentPath = "chat";
    } else if (route.includes("friend")) {
      currentPath = "friend";
    } else if (route.includes("me")) {
      currentPath = "me";
    } else if (route.includes("event")) {
      currentPath = "event";
    } else if (route.includes("contact")) {
      currentPath = "contact";
    }

    this.globalData.currentPath = currentPath;
    return currentPath;
  },

  // Method to handle tab bar navigation with login check
  handleTabNavigation(pagePath) {
    const loginRequiredPages = [
      "pages/recommend/recommend",
      "pages/follow/follow",
      "pages/chat/chat",
      "pages/upload/upload",
      "pages/notification/notification",
      "pages/friend/friend",
      "pages/me/me",
      "pages/event/event",
      "pages/contact/contact",
    ];

    // Check if the page requires login
    if (
      loginRequiredPages.includes(pagePath) &&
      isEmpty(this.globalData.userInfo)
    ) {
      this.setState("showLoginModal", true);
      return false;
    }

    // Allow navigation
    return true;
  },

  handleGoUserProfile(username) {
    if (isEmpty(this.globalData.userInfo)) {
      this.setState("showLoginModal", true);
      return;
    }
    if (username) {
      if (this.globalData.userInfo.username === username) {
        wx.navigateTo({ url: "/pages/me/me" });
      } else {
        wx.navigateTo({
          url: `/pages/user-profile/user-profile?username=${username}`,
        });
      }
    }
  },

  // Enhanced method for checking if current navigation requires login
  checkLoginRequired(targetPath) {
    const loginRequiredPaths = [
      "recommend",
      "follow",
      "chat",
      "friend",
      "me",
      "notification",
      "upload",
      "event",
      "contact",
    ];

    if (
      loginRequiredPaths.includes(targetPath) &&
      isEmpty(this.globalData.userInfo)
    ) {
      this.setState("showLoginModal", true);
      return false;
    }
    return true;
  },

  // Sidebar navigation methods
  navigateTo(path) {
    // Check login requirement first
    if (!this.checkLoginRequired(path)) {
      return;
    }

    // Check if user is trying to navigate from home page and needs login
    // (except for post-detail which should be accessible without login)
    const needsLogin = [
      "recommend",
      "follow",
      "chat",
      "friend",
      "me",
      "notification",
      "upload",
      "event",
      "contact",
    ];

    if (needsLogin.includes(path) && isEmpty(this.globalData.userInfo)) {
      this.setState("showLoginModal", true);
      return;
    }

    switch (path) {
      case "discover":
        wx.redirectTo({ url: "/pages/index/index" });
        this.globalData.currentPath = "discover";
        break;
      case "recommend":
        wx.redirectTo({ url: "/pages/recommend/recommend" });
        this.globalData.currentPath = "recommend";
        break;
      case "follow":
        wx.redirectTo({ url: "/pages/follow/follow" });
        this.globalData.currentPath = "follow";
        break;
      case "chat":
        wx.redirectTo({ url: "/pages/chat/chat" });
        this.globalData.currentPath = "chat";
        break;
      case "friend":
        wx.redirectTo({ url: "/pages/friend/friend" });
        this.globalData.currentPath = "friend";
        break;
      case "me":
        wx.redirectTo({ url: "/pages/me/me" });
        this.globalData.currentPath = "me";
        break;
      case "notification":
        wx.redirectTo({ url: "/pages/notification/notification" });
        this.globalData.currentPath = "notification";
        break;
      case "upload":
        wx.redirectTo({ url: "/pages/upload/upload" });
        this.globalData.currentPath = "upload";
        break;
      case "event":
        wx.redirectTo({ url: "/pages/event/event" });
        this.globalData.currentPath = "event";
        break;
      case "contact":
        wx.redirectTo({ url: "/pages/contact/contact" });
        this.globalData.currentPath = "contact";
        break;
    }
    this.globalData.showSidebar = false;
  },

  // New method for checking login requirement before navigation
  requireLogin(callback) {
    if (isEmpty(this.globalData.userInfo)) {
      this.setState("showLoginModal", true);
      return false;
    }
    if (callback) callback();
    return true;
  },

  // Set user info
  setUserInfo(userInfo) {
    this.globalData.userInfo = userInfo;
    wx.setStorageSync("userInfo", userInfo);
    // Initialize socket when user info changes
    this.initializeSocket();
    // Fetch unread messages when user logs in
    this.fetchUnreadMessages();
  },

  // Handle force disconnect event
  handleForceDisconnect() {
    this.logout();
  },

  // Handle swear words update event
  handleSwearWordsUpdate() {
    this.getSwearWords();
  },

  initializeSocket() {
    // Check if userInfo exists in globalData
    if (this.globalData.userInfo && this.globalData.userInfo.token) {
      const userId =
        this.globalData.userInfo.id || this.globalData.userInfo.userId;
      const token = this.globalData.userInfo.token;

      if (userId && token) {
        socketManager.connect(userId, token);
        // Setup unread message socket listeners
        this.setupUnreadMessageSocketListeners();
      }
    } else {
      socketManager.disconnect();
      this.cleanupUnreadMessageSocketListeners();
    }
  },

  // Get user info
  getUserInfo() {
    try {
      const userInfo = wx.getStorageSync("userInfo");
      if (userInfo) {
        this.globalData.userInfo = userInfo;

        // Fetch unread messages after setting user info
        this.fetchUnreadMessages();

        wx.request({
          url: `${config.BACKEND_URL}/user/get_my_follow_users`,
          method: "GET",
          header: {
            Authorization: userInfo.token ? `Bearer ${userInfo.token}` : "",
          },
          success: (res) => {
            if (res.statusCode === 200 && res.data) {
              this.globalData.followUsers = res.data.users || [];
            } else {
              this.logout();
            }
          },
          fail: (err) => {
            this.logout();
          },
        });
        wx.request({
          url: `${config.BACKEND_URL}/user/get_my_followed_users`,
          method: "GET",
          header: {
            Authorization: userInfo.token ? `Bearer ${userInfo.token}` : "",
          },
          success: (res) => {
            if (res.statusCode === 200 && res.data) {
              this.globalData.followedUsers = res.data.users || [];
            } else {
              this.logout();
            }
          },
          fail: (err) => {
            this.logout();
          },
        });
        wx.request({
          url: `${config.BACKEND_URL}/friend/get_friends`,
          method: "GET",
          header: {
            Authorization: userInfo.token ? `Bearer ${userInfo.token}` : "",
          },
          success: (res) => {
            if (res.statusCode === 200 && res.data) {
              this.globalData.friends = res.data.users || [];
            } else {
              this.logout();
            }
          },
          fail: (err) => {
            this.logout();
          },
        });
        return userInfo;
      }
    } catch (e) {
      // Handle storage error silently
    }
    return this.globalData.userInfo;
  },

  //get swear words
  getSwearWords() {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${config.BACKEND_URL}/swear`,
        method: "GET",
        success: (res) => {
          if (res.statusCode === 200 && res.data) {
            this.globalData.swear = res.data.swear_words || [];
            resolve(res.data);
          } else {
            reject(new Error("Failed to fetch swear words"));
          }
        },
        fail: (err) => {
          reject(err);
        },
      });
    });
  },

  // Notify all pages about sidebar state change
  notifyPagesUpdate() {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];

    if (currentPage && currentPage.updateSidebar) {
      currentPage.updateSidebar({
        showSidebar: this.globalData.showSidebar,
        currentPath: this.globalData.currentPath,
        userInfo: this.globalData.userInfo,
      });
    }
  },

  // Swipe detection utility
  handleSwipe(startX, startY, endX, endY) {
    const deltaX = endX - startX;
    const deltaY = Math.abs(endY - startY);

    // Right swipe (open sidebar) - only from left edge
    if (startX < 50 && deltaX > 100 && deltaY < 100) {
      if (!this.globalData.showSidebar) {
        this.setSidebar(true);
        return "right";
      }
    }

    // Left swipe (close sidebar)
    if (deltaX < -100 && deltaY < 100) {
      if (this.globalData.showSidebar) {
        this.setSidebar(false);
        return "left";
      }
    }

    return null;
  },

  async logout() {
    // Clear unread messages
    this.clearAllUnreadMessages();

    this.globalData.userInfo = null;
    await wx.setStorageSync("userInfo", null);

    if (this.globalData.socketManager) {
      this.globalData.socketManager.disconnect();
    }

    // Cleanup unread message socket listeners
    this.cleanupUnreadMessageSocketListeners();

    wx.redirectTo({ url: "/pages/index/index" });
  },

  onLaunch() {
    // Load sidebar state from storage on app launch
    try {
      const sidebarState = wx.getStorageSync("showSidebar");
      if (sidebarState !== "") {
        this.globalData.showSidebar = sidebarState;
      }

      // Load user info
      this.getUserInfo();
      this.getSwearWords();
      this.initializeSocket();
    } catch (e) {
      // Handle launch error silently
    }
  },

  onTabItemTap(item) {
    const app = getApp();
    const pagePath = item.pagePath;

    if (!app.handleTabNavigation(pagePath)) {
      return false;
    }

    return true;
  },
});