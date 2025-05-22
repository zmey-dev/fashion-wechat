Component({
  properties: {
    isVisible: {
      type: Boolean,
      value: false,
    },
    currentPath: {
      type: String,
      value: 'discover'
    },
    userInfo: {
      type: Object,
      value: {}
    }
  },
  
  data: {
    touchStartX: 0,
    touchStartY: 0
  },
  
  methods: {
    hideSidebar() {
      const app = getApp();
      app.setSidebar(false);
    },
    
    preventMove() {
      return false;
    },
    
    onTouchStart(e) {
      this.setData({
        touchStartX: e.touches[0].clientX,
        touchStartY: e.touches[0].clientY
      });
    },
    
    onTouchMove(e) {
    },
    
    onTouchEnd(e) {
      const app = getApp();
      app.handleSwipe(
        this.data.touchStartX, 
        this.data.touchStartY,
        e.changedTouches[0].clientX,
        e.changedTouches[0].clientY
      );
    },
    
    navigateToDiscover() {
      getApp().navigateTo('discover');
    },
    
    navigateToRecommend() {
      getApp().navigateTo('recommend');
    },
    
    navigateToFollow() {
      getApp().navigateTo('follow');
    },
    
    navigateToChat() {
      getApp().navigateTo('chat');
    },
    
    navigateToFriend() {
      getApp().navigateTo('friend');
    },
    
    navigateToMe() {
      getApp().navigateTo('me');
    },
    
    navigateToEvent() {
      getApp().navigateTo('event');
    },
    
    navigateToContact() {
      getApp().navigateTo('contact');
    }
  }
})