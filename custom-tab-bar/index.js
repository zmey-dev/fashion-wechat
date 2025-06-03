// custom-tab-bar/index.js
Component({
  data: {
    selected: 0,
    list: [
      {
        pagePath: "/pages/index/index",
        text: "首页",
        iconPath: "/images/icons/home.png",
        selectedIconPath: "/images/icons/home-active.png",
        requireLogin: false
      },
      {
        pagePath: "/pages/notification/notification",
        text: "消息",
        iconPath: "/images/icons/notification.png",
        selectedIconPath: "/images/icons/notification-active.png",
        requireLogin: true
      },
      {
        pagePath: "/pages/upload/upload",
        text: "",
        iconPath: "/images/icons/upload.png",
        selectedIconPath: "/images/icons/upload-active.png",
        isSpecial: true,
        requireLogin: true
      },
      {
        pagePath: "/pages/chat/chat",
        text: "聊天",
        iconPath: "/images/icons/message.png",
        selectedIconPath: "/images/icons/message-active.png",
        requireLogin: true
      },
      {
        pagePath: "/pages/me/me",
        text: "我",
        iconPath: "/images/icons/me.png",
        selectedIconPath: "/images/icons/me-active.png",
        requireLogin: true
      }
    ]
  },
  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;
      const requireLogin = data.requireLogin;
      const app = getApp();
      
      // 로그인이 필요한 페이지이고 로그인 상태가 아닌 경우
      if (requireLogin && !app.globalData.userInfo) {
        // 로그인 모달 표시 - 안전하게 체크
        if (typeof app.setState === 'function') {
          app.setState("showLoginModal", true);
        } else {
          // fallback - 직접 토스트 표시
          wx.showToast({
            title: '请先登录',
            icon: 'none'
          });
        }
        return;
      }
      
      // 특별한 탭(업로드) 처리
      if (data.special) {
        wx.navigateTo({
          url
        });
        return;
      }
      
      wx.switchTab({
        url
      });
      
      this.setData({
        selected: data.index
      });
    }
  }
});