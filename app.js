const { default: config } = require("./config");

App({
  globalData: {
    showSidebar: false,
    showLoginModal: false,
    userInfo: null,
    friends: [],
    followUsers: [],
    followedUsers: [],
    swear:  [],
    currentPath: "discover",
    observers: {},
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

  // Toggle sidebar state
  toggleSidebar() {
    this.globalData.showSidebar = !this.globalData.showSidebar;
    this.notifyPagesUpdate();
  },

  // Set sidebar state
  setSidebar(isOpen) {
    this.globalData.showSidebar = isOpen;
    this.notifyPagesUpdate();

    // Optional: Save to storage for persistence
    wx.setStorageSync("showSidebar", isOpen);
  },

  // Set current path
  setCurrentPath(path) {
    this.globalData.currentPath = path;
    this.notifyPagesUpdate();
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

  // Sidebar navigation methods
  navigateTo(path) {
    switch (path) {
      case "discover":
        wx.switchTab({ url: "/pages/index/index" });
        break;
      case "recommend":
        wx.navigateTo({ url: "/pages/recommend/recommend" });
        break;
      case "follow":
        wx.navigateTo({ url: "/pages/follow/follow" });
        break;
      case "chat":
        wx.navigateTo({ url: "/pages/chat/chat" });
        break;
      case "friend":
        wx.navigateTo({ url: "/pages/friend/friend" });
        break;
      case "me":
        wx.switchTab({ url: "/pages/me/me" });
        break;
      case "event":
        wx.navigateTo({ url: "/pages/event/event" });
        break;
      case "contact":
        wx.navigateTo({ url: "/pages/contact/contact" });
        break;
      default:
        console.log("Unknown path:", path);
    }
    // Close sidebar after navigation
    this.setSidebar(false);
  },

  logout() {
    // Clear user info and sidebar state
    this.globalData.userInfo = null;
    this.globalData.showSidebar = false;
    wx.setStorageSync("userInfo", null);
    wx.setStorageSync("showSidebar", false);

    // Notify all pages about the logout
    this.notifyPagesUpdate();

    // Optionally redirect to login page
    wx.redirectTo({ url: "/pages/login/login" });
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

  // Set user info
  setUserInfo(userInfo) {
    this.globalData.userInfo = userInfo;
    wx.setStorageSync("userInfo", userInfo);
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
    } catch (e) {
      console.log("Failed to load app state", e);
    }
  },
});
