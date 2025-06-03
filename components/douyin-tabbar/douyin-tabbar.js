Component({
  properties: {
    current: {
      type: String,
      value: 'index'
    }
  },
  
  data: {
    tabs: [
      {
        name: 'index',
        icon: '/images/icons/home.png',
        activeIcon: '/images/icons/home-active.png',
        text: '首页',
        path: '/pages/index/index'
      },
      {
        name: 'friend',
        icon: '/images/icons/friend.png',
        activeIcon: '/images/icons/friend-active.png',
        text: '朋友',
        path: '/pages/friend/friend'
      },
      {
        name: 'upload',
        icon: '/images/icons/plus.png',
        activeIcon: '/images/icons/plus.png',
        text: '',
        path: '/pages/upload/upload',
        isSpecial: true
      },
      {
        name: 'notification',
        icon: '/images/icons/message.png',
        activeIcon: '/images/icons/message-active.png',
        text: '消息',
        path: '/pages/notification/notification'
      },
      {
        name: 'me',
        icon: '/images/icons/me.png',
        activeIcon: '/images/icons/me-active.png',
        text: '我',
        path: '/pages/me/me'
      }
    ]
  },
  
  methods: {
    navigateTo: function(e) {
      const path = e.currentTarget.dataset.path;
      const name = e.currentTarget.dataset.name;
      
      if (name === this.properties.current) return;
      
      const app = getApp();
      
      // Check login for certain tabs
      if (['friend', 'upload', 'notification', 'me'].includes(name) && !app.globalData.userInfo) {
        app.setState("showLoginModal", true);
        return;
      }
      
      if (name === 'upload') {
        wx.navigateTo({
          url: path
        });
      } else {
        wx.switchTab({
          url: path
        });
      }
    }
  }
});