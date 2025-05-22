App({
  globalData: {
    isOpenSidebar: false,
    userInfo: {
      nickname: '',
      avatar: ''
    },
    currentPath: 'discover'
  },
  
  // Toggle sidebar state
  toggleSidebar() {
    this.globalData.isOpenSidebar = !this.globalData.isOpenSidebar;
    this.notifyPagesUpdate();
  },
  
  // Set sidebar state
  setSidebar(isOpen) {
    this.globalData.isOpenSidebar = isOpen;
    this.notifyPagesUpdate();
    
    // Optional: Save to storage for persistence
    wx.setStorageSync('isOpenSidebar', isOpen);
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
    
    let currentPath = '';
    if (route.includes('discover') || route.includes('index')) {
      currentPath = 'discover';
    } else if (route.includes('recommend')) {
      currentPath = 'recommend';
    } else if (route.includes('follow')) {
      currentPath = 'follow';
    } else if (route.includes('chat')) {
      currentPath = 'chat';
    } else if (route.includes('friend')) {
      currentPath = 'friend';
    } else if (route.includes('me')) {
      currentPath = 'me';
    } else if (route.includes('event')) {
      currentPath = 'event';
    } else if (route.includes('contact')) {
      currentPath = 'contact';
    }
    
    this.globalData.currentPath = currentPath;
    return currentPath;
  },
  
  // Sidebar navigation methods
  navigateTo(path) {
    switch(path) {
      case 'discover':
        wx.switchTab({ url: '/pages/index/index' });
        break;
      case 'recommend':
        wx.navigateTo({ url: '/pages/recommend/recommend' });
        break;
      case 'follow':
        wx.navigateTo({ url: '/pages/follow/follow' });
        break;
      case 'chat':
        wx.navigateTo({ url: '/pages/chat/chat' });
        break;
      case 'friend':
        wx.navigateTo({ url: '/pages/friend/friend' });
        break;
      case 'me':
        wx.switchTab({ url: '/pages/me/me' });
        break;
      case 'event':
        wx.navigateTo({ url: '/pages/event/event' });
        break;
      case 'contact':
        wx.navigateTo({ url: '/pages/contact/contact' });
        break;
      default:
        console.log('Unknown path:', path);
    }
    // Close sidebar after navigation
    this.setSidebar(false);
  },
  
  // Get user info
  getUserInfo() {
    try {
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo) {
        this.globalData.userInfo = userInfo;
      }
    } catch (e) {
      console.log('Failed to get user info from storage');
    }
    return this.globalData.userInfo;
  },
  
  // Set user info
  setUserInfo(userInfo) {
    this.globalData.userInfo = userInfo;
    wx.setStorageSync('userInfo', userInfo);
  },
  
  // Notify all pages about sidebar state change
  notifyPagesUpdate() {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    
    if (currentPage && currentPage.updateSidebar) {
      currentPage.updateSidebar({
        isOpenSidebar: this.globalData.isOpenSidebar,
        currentPath: this.globalData.currentPath,
        userInfo: this.globalData.userInfo
      });
    }
  },
  
  // Swipe detection utility
  handleSwipe(startX, startY, endX, endY) {
    const deltaX = endX - startX;
    const deltaY = Math.abs(endY - startY);
    
    // Right swipe (open sidebar)
    if ((startX < 50 && deltaX > 100) || (deltaX > 150 && deltaY < 100)) {
      if (!this.globalData.isOpenSidebar) {
        this.setSidebar(true);
        return 'right';
      }
    }
    
    // Left swipe (close sidebar)
    if (deltaX < -100 && deltaY < 100) {
      if (this.globalData.isOpenSidebar) {
        this.setSidebar(false);
        return 'left';
      }
    }
    
    return null;
  },
  
  onLaunch() {
    // Load sidebar state from storage on app launch
    try {
      const sidebarState = wx.getStorageSync('isOpenSidebar');
      if (sidebarState !== '') {
        this.globalData.isOpenSidebar = sidebarState;
      }
      
      // Load user info
      this.getUserInfo();
    } catch (e) {
      console.log('Failed to load app state', e);
    }
  }
});