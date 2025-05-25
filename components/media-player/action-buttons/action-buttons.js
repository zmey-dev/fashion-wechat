// components/action-buttons/action-buttons.js
Component({
  properties: {
    currentPost: { type: Object, value: {} },
    currentPostUser: { type: Object, value: {} },
    authUser: { type: Object, value: null },
    displayLikes: { type: String, value: "0" },
    displayComments: { type: String, value: "0" },
    displayFavorites: { type: String, value: "0" },
    displayShares: { type: String, value: "0" },
  },

  methods: {
    onUserProfile() {
      this.triggerEvent("userprofile");
    },

    handleLike() {
      this.triggerEvent("like");
    },

    handleFavorite() {
      this.triggerEvent("favorite");
    },

    handleShare() {
      this.triggerEvent("share");
    },

    handleFollow() {
      this.triggerEvent("follow");
    },

    onToggleDetail() {
      const app = getApp();
      app.setState("showLoginModal", true);

      this.triggerEvent("toggleDetail");
    },

    onShowReportModal() {
      this.triggerEvent("reportmodal");
    },
  },
});
