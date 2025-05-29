// components/user-posts-tab/user-posts-tab.js
Component({
  properties: {
    selectedPost: { type: Object, value: {} },
    currentPostUser: { type: Object, value: {} },
    authUser: { type: Object, value: null },
    displayFollowerCount: { type: String, value: "0" },
    displayLikeCount: { type: String, value: "0" }
  },
  methods: {
    handleFollow() {
      this.triggerEvent('follow');
    },

    onSelectUserPost(e) {
      const { post } = e.currentTarget.dataset;
      this.triggerEvent('selectpost', { post });
    }
  }
});