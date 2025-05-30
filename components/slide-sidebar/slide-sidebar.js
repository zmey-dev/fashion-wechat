Component({
  properties: {
    isVisible: {
      type: Boolean,
      value: false,
    },
    currentPath: {
      type: String,
      value: "discover",
    },
    userInfo: {
      type: Object,
      value: {},
    },
    pageTitle: {
      type: String,
      value: "首页",
    },
  },

  data: {
    searchValue: "",
    isSearchMode: false,
    isLoggedIn: false,
  },
  observers: {
    userInfo: function(newVal) {
      this.setData({
        isLoggedIn: !!newVal && !!newVal.username,
      });
    },
  },
  methods: {
    // Show sidebar
    showSidebar() {
      const app = getApp();
      app.setState("showSidebar", true);
    },

    // Hide sidebar
    hideSidebar() {
      const app = getApp();
      app.setState("showSidebar", false);
    },

    // Toggle search mode
    toggleSearch() {
      this.setData({
        isSearchMode: !this.data.isSearchMode,
        searchValue: "",
      });
    },

    // Handle search input
    onSearchInput(e) {
      this.setData({
        searchValue: e.detail.value,
      });
    },

    // Handle search confirm
    onSearchConfirm(e) {
      const searchValue = e.detail.value;
      if (searchValue.trim()) {
        // Trigger search event to parent component
        this.triggerEvent("search", { value: searchValue });
      }
    },

    // Cancel search
    cancelSearch() {
      this.setData({
        isSearchMode: false,
        searchValue: "",
      });
    },

    // Prevent scrolling when sidebar is open
    preventMove() {
      return false;
    },

    // Navigation methods
    navigateToDiscover() {
      getApp().navigateTo("discover");
      this.hideSidebar();
    },

    navigateToRecommend() {
      getApp().navigateTo("recommend");
      this.hideSidebar();
    },

    navigateToFollow() {
      getApp().navigateTo("follow");
      this.hideSidebar();
    },

    navigateToChat() {
      getApp().navigateTo("chat");
      this.hideSidebar();
    },

    navigateToFriend() {
      getApp().navigateTo("friend");
      this.hideSidebar();
    },

    navigateToMe() {
      getApp().navigateTo("me");
      this.hideSidebar();
    },

    navigateToNotification() {
      getApp().navigateTo("notification");
      this.hideSidebar();
    },

    navigateToUpload() {
      getApp().navigateTo("upload");
      this.hideSidebar();
    },

    navigateToEvent() {
      getApp().navigateTo("event");
      this.hideSidebar();
    },

    navigateToContact() {
      getApp().navigateTo("contact");
      this.hideSidebar();
    },

    onNavItemTap(e) {
      const destination = e.currentTarget.dataset.destination;
      if (this[destination]) {
        this[destination]();
      }
    },

    onLoginTap() {
      getApp().setState("showLoginModal", true);      
      this.hideSidebar();
    },

    onLogoutTap() {
      wx.showModal({
        title: '退出登录',
        content: '确定要退出当前账号吗？',
        success: (res) => {
          if (res.confirm) {
            // Implement logout logic here
            // For example, clear user info in storage and update app state
            wx.removeStorageSync('userInfo');
            
            // Update the component's data
            this.setData({
              userInfo: {
                username: '',
                avatar: '',
                isLoggedIn: false
              }
            });

            getApp().setState("userInfo", null);
            
            // Notify the parent component about the logout
            this.triggerEvent('logout');
            
            wx.showToast({
              title: '已退出登录',
              icon: 'success'
            });
          }
        }
      });
    }
  },
});
