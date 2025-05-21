// app.js
import config from './config.js';

App({
  globalData: {
    userInfo: null,
    hasLogin: false,
    theme: 'dark',
    notifications: [],
    unreadMessages: [],
  },
  
  onLaunch: function() {
    // Set theme to dark
    
    wx.setStorageSync('theme', 'dark');
    
    // Check if user is logged in
    const token = wx.getStorageSync('token');
    if (token) {
        this.getUserInfo();
    }
  },
  
  getUserInfo: function() {
    const that = this;
    wx.request({
      url: config.BACKEND_URL+'/user/profile',
      method: 'GET',
      header: {
        'Authorization': 'Bearer ' + wx.getStorageSync('token')
      },
      success: function(res) {
        if (res.statusCode === 200) {
          that.globalData.userInfo = res.data;
          that.globalData.hasLogin = true;
          
          // Get notifications
          that.getNotifications();
        } else {
          // Token invalid, clear storage
          wx.removeStorageSync('token');
          that.globalData.hasLogin = false;
        }
      },
      fail: function() {
        wx.removeStorageSync('token');
        that.globalData.hasLogin = false;
      }
    });
  },
  
  getNotifications: function() {
    const that = this;
    wx.request({
      url: config.BACKEND_URL+'/notifications',
      method: 'GET',
      header: {
        'Authorization': 'Bearer ' + wx.getStorageSync('token')
      },
      success: function(res) {
        if (res.statusCode === 200) {
          that.globalData.notifications = res.data;
        }
      }
    });
  },

  logOut: function() {
    this.globalData.userInfo = null;
    this.globalData.hasLogin = false;
    this.globalData.notifications = [];
    this.globalData.unreadMessages = [];
    wx.removeStorageSync('token');
    wx.reLaunch({
      url: '/pages/index/index'
    });
  }
});