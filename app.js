const { default: config } = require("./config");
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

  // Sidebar navigation methods
  navigateTo(path) {
    switch (path) {
      case "discover":
        wx.redirectTo({ url: "/pages/index/index" });
        this.globalData.currentPath = "discover";
        break;
      case "recommend":
        if (isEmpty(this.globalData.userInfo)) {
          getApp().setState("showLoginModal", true);
          return;
        }
        wx.redirectTo({ url: "/pages/recommend/recommend" });
        this.globalData.currentPath = "recommend";
        break;
      case "follow":
        if (isEmpty(this.globalData.userInfo)) {
          getApp().setState("showLoginModal", true);
          return;
        }

        wx.redirectTo({ url: "/pages/follow/follow" });
        this.globalData.currentPath = "follow";
        break;
      case "chat":
        if (isEmpty(this.globalData.userInfo)) {
          getApp().setState("showLoginModal", true);
          return;
        }

        wx.redirectTo({ url: "/pages/chat/chat" });
        this.globalData.currentPath = "chat";
        break;
      case "friend":
        if (isEmpty(this.globalData.userInfo)) {
          getApp().setState("showLoginModal", true);
          return;
        }

        wx.redirectTo({ url: "/pages/friend/friend" });
        this.globalData.currentPath = "friend";
        break;
      case "me":
        if (isEmpty(this.globalData.userInfo)) {
          getApp().setState("showLoginModal", true);
          return;
        }

        wx.redirectTo({ url: "/pages/me/me" });
        this.globalData.currentPath = "me";
        break;

      case "notification":
        if (isEmpty(this.globalData.userInfo)) {
          getApp().setState("showLoginModal", true);
          return;
        }

        wx.redirectTo({ url: "/pages/notification/notification" });
        this.globalData.currentPath = "notification";
        break;
      case "upload":
        if (isEmpty(this.globalData.userInfo)) {
          getApp().setState("showLoginModal", true);
          return;
        }

        wx.redirectTo({ url: "/pages/upload/upload" });
        this.globalData.currentPath = "upload";
        break;
      case "event":
        if (isEmpty(this.globalData.userInfo)) {
          getApp().setState("showLoginModal", true);
          return;
        }

        wx.redirectTo({ url: "/pages/event/event" });
        this.globalData.currentPath = "event";
        break;
      case "contact":
        if (isEmpty(this.globalData.userInfo)) {
          getApp().setState("showLoginModal", true);
          return;
        }

        wx.redirectTo({ url: "/pages/contact/contact" });
        this.globalData.currentPath = "contact";
        break;
      default:
        console.log("Unknown path:", path);
    }
    this.globalData.showSidebar = false;
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
