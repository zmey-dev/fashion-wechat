// layouts/main-header/main-header.js
Component({
  properties: {
    showSidebar: {
      type: Boolean,
      value: false
    }
  },

  data: {
    user: null,
    hasLogin: false,
    notifications: [],
    unreadMessages: [],
    showUserDropdown: false,
    showNotificationDropdown: false,
    showMessageDropdown: false,
    showCreateDropdown: false
  },

  lifetimes: {
    attached: function() {
      // Get app instance
      const app = getApp();
      
      // Check if user is logged in
      this.setData({
        user: app.globalData.userInfo,
        hasLogin: app.globalData.hasLogin,
        notifications: app.globalData.notifications,
        unreadMessages: app.globalData.unreadMessages
      });
    }
  },

  pageLifetimes: {
    show: function() {
      // Update data when page is shown
      const app = getApp();
      this.setData({
        user: app.globalData.userInfo,
        hasLogin: app.globalData.hasLogin,
        notifications: app.globalData.notifications,
        unreadMessages: app.globalData.unreadMessages
      });
    }
  },

  methods: {
    toggleSideBar: function() {
      this.triggerEvent('toggleSideBar');
    },
    
    toggleUserDropdown: function() {
      this.setData({
        showUserDropdown: !this.data.showUserDropdown,
        showNotificationDropdown: false,
        showMessageDropdown: false,
        showCreateDropdown: false
      });
    },
    
    toggleNotificationDropdown: function() {
      this.setData({
        showNotificationDropdown: !this.data.showNotificationDropdown,
        showUserDropdown: false,
        showMessageDropdown: false,
        showCreateDropdown: false
      });
    },
    
    toggleMessageDropdown: function() {
      this.setData({
        showMessageDropdown: !this.data.showMessageDropdown,
        showUserDropdown: false,
        showNotificationDropdown: false,
        showCreateDropdown: false
      });
    },
    
    toggleCreateDropdown: function() {
      this.setData({
        showCreateDropdown: !this.data.showCreateDropdown,
        showUserDropdown: false,
        showNotificationDropdown: false,
        showMessageDropdown: false
      });
    },
    
    hideAllDropdowns: function() {
      this.setData({
        showUserDropdown: false,
        showNotificationDropdown: false,
        showMessageDropdown: false,
        showCreateDropdown: false
      });
    },
    
    navigateToLogin: function() {
      wx.navigateTo({
        url: '/pages/login/login'
      });
    },
    
    navigateToNotification: function() {
      wx.navigateTo({
        url: '/pages/notification/notification'
      });
      this.hideAllDropdowns();
    },
    
    navigateToChat: function() {
      wx.navigateTo({
        url: '/pages/chat/chat'
      });
      this.hideAllDropdowns();
    },
    
    createPost: function() {
      wx.navigateTo({
        url: '/pages/create-post/create-post'
      });
      this.hideAllDropdowns();
    },
    
    createEvent: function() {
      wx.navigateTo({
        url: '/pages/create-event/create-event'
      });
      this.hideAllDropdowns();
    },
    
    editProfile: function() {
      wx.navigateTo({
        url: '/pages/profile/profile'
      });
      this.hideAllDropdowns();
    },
    
    changePassword: function() {
      wx.navigateTo({
        url: '/pages/change-password/change-password'
      });
      this.hideAllDropdowns();
    },
    
    logOut: function() {
      const app = getApp();
      app.logOut();
      this.hideAllDropdowns();
    }
  }
});