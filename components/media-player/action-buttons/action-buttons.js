// components/action-buttons/action-buttons.js
Component({  properties: {
    currentPost: { type: Object, value: {} },
    currentPostUser: { type: Object, value: {} },
    authUser: { type: Object, value: null },
    followedUsers: { type: Array, value: [] },
    displayLikes: { type: String, value: "0" },
    displayComments: { type: String, value: "0" },
    displayFavorites: { type: String, value: "0" },
    displayShares: { type: String, value: "0" },
    isContinue: { type: Boolean, value: true },
    eventId: { type: String, value: null }
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
      this.triggerEvent("toggleDetail");
    },    onShowReportModal() {
      this.triggerEvent("reportmodal");
    },

    onContinueToggle() {
      const newValue = !this.properties.isContinue;
      this.triggerEvent('continuetoggle', { value: newValue });
    },
  },
});
