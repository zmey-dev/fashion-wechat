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
    searchValue: '',
    isSearchMode: false,
  },

  methods: {
    // Show sidebar
    showSidebar() {
      const app = getApp();
      app.setSidebar(true);
    },

    // Hide sidebar
    hideSidebar() {
      const app = getApp();
      app.setSidebar(false);
    },

    // Toggle search mode
    toggleSearch() {
      this.setData({
        isSearchMode: !this.data.isSearchMode,
        searchValue: ''
      });
    },

    // Handle search input
    onSearchInput(e) {
      this.setData({
        searchValue: e.detail.value
      });
    },

    // Handle search confirm
    onSearchConfirm(e) {
      const searchValue = e.detail.value;
      if (searchValue.trim()) {
        // Trigger search event to parent component
        this.triggerEvent('search', { value: searchValue });
      }
    },

    // Cancel search
    cancelSearch() {
      this.setData({
        isSearchMode: false,
        searchValue: ''
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
  },
});