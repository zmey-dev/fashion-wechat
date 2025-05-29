// comment-tree-item-child.js
Component({
  properties: {
    comment: {
      type: Object,
      value: {}
    },
    allComments: {
      type: Array,
      value: []
    },
    loggedUser: {
      type: Object,
      value: {}
    },
    depth: {
      type: Number,
      value: 0
    },
    selectedPost: {
      type: Object,
      value: {}
    }
  },

  data: {
    isExpanded: false,
    replies: [],
    hasReplies: false,
    replyCount: 0
  },

  observers: {
    'comment, allComments': function(comment, allComments) {
      this.buildReplies();
    }
  },

  lifetimes: {
    attached() {
      this.buildReplies();
    }
  },

  methods: {
    // Build replies for this comment
    buildReplies() {
      const { comment, allComments } = this.properties;
      if (!comment || !allComments) return;

      const replies = allComments.filter(c => c.parent_id === comment.id);
      const hasReplies = replies.length > 0;      
      this.setData({
        replies: replies,
        hasReplies: hasReplies,
        replyCount: replies.length
      });
    },

    // Toggle replies visibility
    onToggleReplies() {
      this.setData({
        isExpanded: !this.data.isExpanded
      });
    },

    // Handle like action
    onLikeHandle(e) {
      this.triggerEvent('like', e.detail);
    },

    // Handle edit action
    onEditHandle(e) {
      this.triggerEvent('edit', e.detail);
    },

    // Handle reply action
    onReplyHandle(e) {
      this.triggerEvent('reply', e.detail);
    },

    // Handle delete action
    onDeleteHandle(e) {
      this.triggerEvent('delete', e.detail);
    },

    // Handle image preview
    onImagePreviewHandle(e) {
      this.triggerEvent('imagepreview', e.detail);
    },

    // Handle image upload
    onImageUploadHandle(e) {
      this.triggerEvent('imageupload', e.detail);
    }
  }
});