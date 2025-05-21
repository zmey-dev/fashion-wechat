// pages/index/index.js
import config from '../../config';
Page({
  data: {
    isOpenSideBar: false,
    posts: [],
    isLoading: true
  },
  
  onLoad: function() {
    // Initialize page
    this.getPosts();
  },
  
  onShow: function() {
    // Update selected tab
    // if (typeof this.getTabBar === 'function') {
    //   this.getTabBar().setData({
    //     selected: 0
    //   });
    // }
  },
  
  toggleSideBar: function() {
    this.setData({
      isOpenSideBar: !this.data.isOpenSideBar
    });
  },
  
  getPosts: function() {
    const that = this;
    wx.showLoading({
      title: '加载中...',
    });
    
    // Call API to get posts
    wx.request({
      url: `${config.BACKEND_URL}/post/get_posts_discover`,
      method: 'GET',
      data: {
        scope: 15,
        isDiscover: true
      },
      success: function(res) {
        if (res.statusCode === 200) {
          that.setData({
            posts: res.data.posts,
            isLoading: false
          });
        }
      },
      fail: function() {
        that.setData({
          isLoading: false
        });
      },
      complete: function() {
        wx.hideLoading();
      }
    });
  },
  
  onPullDownRefresh: function() {
    this.getPosts();
    wx.stopPullDownRefresh();
  }
});