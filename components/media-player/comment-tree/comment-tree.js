// comment-tree.js
Component({
  properties: {
    comments: {
      type: Array,
      value: []
    },
    loggedUser: {
      type: Object,
      value: {}
    },
    authUser: {
      type: Object,
      value: {}
    },
    selectedPost: {
      type: Object,
      value: {}
    }
  },

  data: {
    personalComment: '',
    commentId: null,
    isUpdate: false,
    showEmojiPicker: false,
    replyToComment: null,
    rootComments: [],
    emojiList: ['😀', '😂', '😍', '🥰', '😊', '😎', '🤔', '😮', '😢', '😡', '👍', '👎', '❤️', '🔥', '💯', '🎉', '😱', '🤣', '😭', '🥺']
  },

  observers: {
    'comments': function(comments) {
      this.buildCommentTree();
    },
    'commentId': function(commentId) {
      if (commentId) {
        const replyComment = this.properties.comments.find(c => c.id === commentId);
        this.setData({
          replyToComment: replyComment
        });
      } else {
        this.setData({
          replyToComment: null
        });
      }
    }
  },

  lifetimes: {
    attached() {
      this.buildCommentTree();
    }
  },

  methods: {
    // Build comment tree structure
    buildCommentTree() {
      const { comments } = this.properties;
      const rootComments = comments.filter(comment => comment.parent_id === null);
      this.setData({
        rootComments: rootComments
      });
    },

    // Check if text contains inappropriate words (simplified version)
    isContainSword(text) {
      const bannedWords = ['spam', 'inappropriate']; // Add your banned words
      return bannedWords.some(word => text.toLowerCase().includes(word));
    },

    // Handle comment input
    onCommentInput(e) {
      this.setData({
        personalComment: e.detail.value
      });
    },

    // Handle emoji toggle
    onToggleEmoji() {
      this.setData({
        showEmojiPicker: !this.data.showEmojiPicker
      });
    },

    // Handle emoji click
    onEmojiClick(e) {
      const emoji = e.currentTarget.dataset.emoji;
      this.setData({
        personalComment: this.data.personalComment + emoji,
        showEmojiPicker: false
      });
    },

    // Handle image selection
    onChooseImage() {
      const that = this;
      wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success(res) {
          const tempFilePath = res.tempFilePaths[0];
          that.uploadCommentImage(tempFilePath);
        },
        fail(err) {
          console.error('Choose image failed:', err);
          wx.showToast({
            title: 'Failed to select image',
            icon: 'error'
          });
        }
      });
    },

    // Upload comment image
    uploadCommentImage(filePath) {
      wx.showLoading({
        title: 'Uploading...'
      });

      const formData = {
        parent_id: this.data.commentId,
        post_id: this.properties.selectedPost.id,
        sender_id: this.properties.loggedUser.id
      };

      wx.uploadFile({
        url: 'YOUR_API_ENDPOINT/send-comment', // Replace with your API endpoint
        filePath: filePath,
        name: 'file',
        formData: formData,
        success: (res) => {
          wx.hideLoading();
          const data = JSON.parse(res.data);
          if (data.success) {
            wx.showToast({
              title: 'Comment posted successfully',
              icon: 'success'
            });
            this.triggerEvent('commentsent', {
              comment: data.comment
            });
            this.resetCommentInput();
          } else {
            wx.showToast({
              title: 'Failed to post comment',
              icon: 'error'
            });
          }
        },
        fail: (err) => {
          wx.hideLoading();
          console.error('Upload failed:', err);
          wx.showToast({
            title: 'Upload failed',
            icon: 'error'
          });
        }
      });
    },

    // Send comment
    onSendComment() {
      const { personalComment, commentId, isUpdate } = this.data;
      const { authUser, loggedUser, selectedPost } = this.properties;

      if (!authUser) {
        this.triggerEvent('loginrequired');
        return;
      }

      if (!personalComment.trim()) {
        wx.showToast({
          title: 'Please enter a comment',
          icon: 'error'
        });
        return;
      }

      if (this.isContainSword(personalComment)) {
        wx.showToast({
          title: 'Cannot use inappropriate language',
          icon: 'error'
        });
        return;
      }

      wx.showLoading({
        title: isUpdate ? 'Updating...' : 'Posting...'
      });

      const apiUrl = isUpdate ? 
        'YOUR_API_ENDPOINT/update-comment' : 
        'YOUR_API_ENDPOINT/send-comment';

      const requestData = isUpdate ? {
        comment_id: commentId,
        new_comment: personalComment
      } : {
        parent_id: commentId,
        post_id: selectedPost.id,
        sender_id: loggedUser.id,
        content: personalComment
      };

      wx.request({
        url: apiUrl,
        method: 'POST',
        data: requestData,
        success: (res) => {
          wx.hideLoading();
          if (res.data.success) {
            wx.showToast({
              title: isUpdate ? 'Comment updated' : 'Comment posted',
              icon: 'success'
            });
            
            if (isUpdate) {
              this.triggerEvent('commentupdated', {
                comment: res.data.comment
              });
            } else {
              this.triggerEvent('commentsent', {
                comment: res.data.comment
              });
            }
            
            this.resetCommentInput();
          } else {
            wx.showToast({
              title: 'Failed to post comment',
              icon: 'error'
            });
          }
        },
        fail: (err) => {
          wx.hideLoading();
          console.error('Request failed:', err);
          wx.showToast({
            title: 'Network error',
            icon: 'error'
          });
        }
      });
    },

    // Reset comment input
    resetCommentInput() {
      this.setData({
        personalComment: '',
        commentId: null,
        isUpdate: false,
        showEmojiPicker: false,
        replyToComment: null
      });
    },

    // Cancel reply
    onCancelReply() {
      this.resetCommentInput();
    },

    // Handle like from child components
    onCommentLike(e) {
      this.triggerEvent('like', e.detail);
    },

    // Handle edit from child components
    onCommentEdit(e) {
      const { item } = e.detail;
      this.setData({
        isUpdate: true,
        commentId: item.id,
        personalComment: item.comment_text || ''
      });
    },

    // Handle reply from child components
    onCommentReply(e) {
      const { item } = e.detail;
      const { loggedUser } = this.properties;
      
      if (!loggedUser) {
        this.triggerEvent('loginrequired');
        return;
      }

      if (loggedUser.id === item.sender_id) {
        wx.showToast({
          title: 'Cannot reply to your own comment',
          icon: 'error'
        });
        return;
      }

      this.setData({
        commentId: item.id,
        personalComment: '',
        isUpdate: false,
        showEmojiPicker: false
      });
    },

    // Handle delete from child components
    onCommentDelete(e) {
      this.triggerEvent('delete', e.detail);
    },

    // Handle image preview from child components
    onImagePreview(e) {
      this.triggerEvent('imagepreview', e.detail);
    },

    // Handle image upload from child components
    onImageUpload(e) {
      this.triggerEvent('imageupload', e.detail);
    }
  }
});