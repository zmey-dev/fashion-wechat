import config from '../../config';
const app = getApp();

Page({
  data: {
    isOpenSidebar: false,
    currentPath: 'discover',
    userInfo: {},
    
    posts: [],
    isLoading: true,
    
    touchStartX: 0,
    touchStartY: 0
  },
  
  onLoad: function() {
    this.getPosts();
    
    const currentPath = app.determineCurrentPath();
    const userInfo = app.getUserInfo();
    
    this.setData({
      isOpenSidebar: app.globalData.isOpenSidebar,
      currentPath: currentPath,
      userInfo: userInfo
    });
  },
  
  updateSidebar: function(data) {
    this.setData({
      isOpenSidebar: data.isOpenSidebar,
      currentPath: data.currentPath,
      userInfo: data.userInfo
    });
  },
  
  onTouchStart: function(e) {
    this.setData({
      touchStartX: e.touches[0].clientX,
      touchStartY: e.touches[0].clientY
    });
  },
  
  onTouchEnd: function(e) {
    app.handleSwipe(
      this.data.touchStartX,
      this.data.touchStartY,
      e.changedTouches[0].clientX,
      e.changedTouches[0].clientY
    );
  },
  
  toggleSideBar: function() {
    app.toggleSidebar();
  },
  
  getPosts: function() {
    const that = this;
    wx.showLoading({
      title: '加载中...',
    });
    
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