// components/detail-panel/detail-panel.js
Component({
  properties: {
    showDetail: { type: Boolean, value: false },
    tabIndex: { type: Number, value: 1 },
    currentPost: { type: Object, value: {} },
    currentPostUser: { type: Object, value: {} },
    authUser: { type: Object, value: null },
    userComments: { type: Array, value: [] },
    selectedDot: { type: Object, value: null },
    displayFollowerCount: { type: String, value: "0" },
    displayLikeCount: { type: String, value: "0" },
  },
  methods: {
    onTabChange(e) {
      const { index } = e.currentTarget.dataset;
      this.triggerEvent("tabchange", { index });
    },

    onCloseDetail() {
      this.triggerEvent("closedetail");
    },

    onFollowUser() {
      this.triggerEvent("follow");
    },

    onSelectUserPost(e) {
      this.triggerEvent("selectpost", e.detail);
    },

    onCommentLike(e) {
      this.triggerEvent("commentlike", e.detail);
    },

    onCommentSent(e) {
      this.triggerEvent("commentsent", e.detail);
    },

    onCommentUpdated(e) {
      this.triggerEvent("commentupdated", e.detail);
    },

    onCommentDelete(e) {
      this.triggerEvent("commentdelete", e.detail);
    },

    onImagePreview(e) {
      this.triggerEvent("imagepreview", e.detail);
    },

    onLoginRequired() {
      this.triggerEvent("loginrequired");
    },
  },
});
