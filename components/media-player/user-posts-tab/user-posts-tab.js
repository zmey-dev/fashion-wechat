// components/user-posts-tab/user-posts-tab.js
Component({
  properties: {
    currentPostUser: { type: Object, value: {} },
    authUser: { type: Object, value: null },
    displayFollowerCount: { type: String, value: "0" },
    displayLikeCount: { type: String, value: "0" }
  },
  observers: {
    currentPostUser: function(user) {
      console.log('User data updated:', user);      
    }
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