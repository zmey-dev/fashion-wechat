// custom-tab-bar/index.js
Component({
  data: {
    selected: 0,
    color: "#FFFFFF",
    selectedColor: "#F3CC14",
    backgroundColor: "#111111",
    list: [
      {
        pagePath: "/pages/index/index",
        text: "精选",
        iconPath: "/images/icons/discover.png",
        selectedIconPath: "/images/icons/discover-active.png"
      },
      {
        pagePath: "/pages/recommend/recommend",
        text: "推荐",
        iconPath: "/images/icons/recommend.png",
        selectedIconPath: "/images/icons/recommend-active.png"
      },
      {
        pagePath: "/pages/follow/follow",
        text: "关注",
        iconPath: "/images/icons/follow.png",
        selectedIconPath: "/images/icons/follow-active.png"
      },
      {
        pagePath: "/pages/chat/chat",
        text: "对话",
        iconPath: "/images/icons/chat.png",
        selectedIconPath: "/images/icons/chat-active.png"
      },
      {
        pagePath: "/pages/friend/friend",
        text: "朋友",
        iconPath: "/images/icons/friend.png",
        selectedIconPath: "/images/icons/friend-active.png"
      },
      {
        pagePath: "/pages/me/me",
        text: "我的",
        iconPath: "/images/icons/me.png",
        selectedIconPath: "/images/icons/me-active.png"
      },
      {
        pagePath: "/pages/event/event",
        text: "比赛",
        iconPath: "/images/icons/event.png",
        selectedIconPath: "/images/icons/event-active.png"
      },
      {
        pagePath: "/pages/contact/contact",
        text: "联系我们",
        iconPath: "/images/icons/contact.png",
        selectedIconPath: "/images/icons/contact-active.png"
      }
    ],
    tabList: [],
    isStudent: true
  },
  
  lifetimes: {
    attached: function() {
      this.updateIsStudent();
      this.updateTabList();
    }
  },
  
  pageLifetimes: {
    show: function() {
      this.setData({
        selected: this.getTabBarIndex()
      });
      this.updateIsStudent();
      this.updateTabList();
    }
  },
  
  methods: {
    updateIsStudent: function() {
      const app = getApp();
      // Check if user is logged in and role is 'user' or not set
      const userInfo = app.globalData.userInfo;
      const isStudent = !userInfo || userInfo.role === 'user';
      
      this.setData({
        isStudent: isStudent
      });
    },
    
    updateTabList: function() {
      const { isStudent, list } = this.data;
      let tabList;
      
      if (isStudent) {
        tabList = list;
      } else {
        // For teachers, filter out student-specific tabs
        tabList = list.filter(tab => 
          tab.text !== '关注' && tab.text !== '对话' && tab.text !== '朋友'
        );
      }
      
      this.setData({
        tabList: tabList
      });
    },
    
    switchTab: function(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;
      const app = getApp();
      
      // Check if user is logged in for certain tabs
      if (data.index > 0 && !app.globalData.hasLogin) {
        // Show login modal
        wx.showModal({
          title: '登录提示',
          content: '您需要登录才能访问此功能',
          confirmText: '去登录',
          success (res) {
            if (res.confirm) {
              // Show login page or modal
              wx.navigateTo({
                url: '/pages/login/login'
              });
            }
          }
        });
        return;
      }
      
      // Navigate to the selected tab
      wx.switchTab({
        url
      });
      
      this.setData({
        selected: data.index
      });
    },
    
    getTabBarIndex: function() {
      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1];
      const route = '/' + currentPage.route;
      
      for (let i = 0; i < this.data.list.length; i++) {
        if (this.data.list[i].pagePath === route) {
          return i;
        }
      }
      return 0;
    }
  }
});