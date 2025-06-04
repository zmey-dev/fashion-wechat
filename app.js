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
      "pages/contact/contact"
    ];

    // Check if the page requires login
    if (loginRequiredPages.includes(pagePath) && isEmpty(this.globalData.userInfo)) {
      this.setState("showLoginModal", true);
      return false;
    }

    // Allow navigation
    return true;
  },

  handleGoUserProfile(username, userId) {
    if (isEmpty(this.globalData.userInfo)) {
      this.setState("showLoginModal", true);
      return;
    }
    if (username) {
      if( this.globalData.userInfo.username === username) {
        wx.navigateTo({ url: "/pages/me/me" });
      }
      else {
        wx.navigateTo({ url: `/pages/user-profile/user-profile?username=${username}` });
      }
    } else {
      console.error("Username is required to navigate to user profile");
    }
  },

  // Enhanced method for checking if current navigation requires login
  checkLoginRequired(targetPath) {
    const loginRequiredPaths = [
      "recommend", "follow", "chat", "friend", "me", 
      "notification", "upload", "event", "contact"
    ];
    
    if (loginRequiredPaths.includes(targetPath) && isEmpty(this.globalData.userInfo)) {
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
    const needsLogin = ["recommend", "follow", "chat", "friend", "me", "notification", "upload", "event", "contact"];
    
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
      default:
        console.log("Unknown path:", path);
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
  },

  // Handle force disconnect event
  handleForceDisconnect() {
    console.log("Force disconnect received from server");
    this.logout();
  },

  // Handle swear words update event
  handleSwearWordsUpdate() {
    console.log("Updating swear words from server");
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
      }
    } else {
      socketManager.disconnect();
    }
  },

  // Get user info
  getUserInfo() {
    try {
      const userInfo = wx.getStorageSync("userInfo");
      if (userInfo) {
        this.globalData.userInfo = userInfo;
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
            console.error("Error fetching user info:", err);
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
            console.error("Error fetching followed users:", err);
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
            console.error("Error fetching friends:", err);
            this.logout();
          },
        });
        return userInfo;
      }
    } catch (e) {
      console.log("Failed to get user info from storage");
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
          console.error("Error fetching swear words:", err);
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
    console.log("Logging out user");

    this.globalData.userInfo = null;
    await wx.setStorageSync("userInfo", null);
    await this.cleanupSocketListeners();

    if (this.globalData.socketManager) {
      this.globalData.socketManager.disconnect();
    }

    wx.redirectTo({ url: "/pages/login/login" });
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
      console.log("Failed to load app state", e);
    }
  },

  onTabItemTap(item) {
    const app = getApp();
    const pagePath = item.pagePath;
    
    if (!app.handleTabNavigation(pagePath)) {
      return false; 
    }
    
    return true;
  }
});
