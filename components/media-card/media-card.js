// media-card/media-card.js
Component({
  /**
   * Component properties
   */
  properties: {
    item: {
      type: Object,
      value: {}
    },
    index: {
      type: Number,
      value: 0
    },
    isEvent: {
      type: Boolean,
      value: false
    },
    canEdit: {
      type: Boolean,
      value: false
    },
    canDelete: {
      type: Boolean,
      value: false
    },
    canRestore: {
      type: Boolean,
      value: false
    },
    userRole: {
      type: String,
      value: ''
    },
    currentUsername: {
      type: String,
      value: ''
    }
  },

  /**
   * Component initial data
   */
  data: {
    isLiked: false
  },

  /**
   * Lifecycle function - triggered when component is attached to page
   */
  attached() {
    this.setData({
      isLiked: this.properties.item.likes_exists || false
    });
  },

  /**
   * Component methods
   */
  methods: {
    // Truncate title if too long
    truncateTitle(title, maxLength = 15) {
      if (!title) return '';
      if (title.length <= maxLength) return title;
      return title.substring(0, maxLength) + '...';
    },
    
    // Handle heart/like button click
    onHeartClick() {
      this.triggerEvent('like', { postId: this.properties.item.id });
      
      // Optimistic UI update
      const updatedLikes = this.properties.item.likes + (this.data.isLiked ? -1 : 1);
      this.setData({
        isLiked: !this.data.isLiked,
        'item.likes': updatedLikes
      });
    },
    
    // Handle card click to show detail
    onClickCard() {
      this.triggerEvent('cardClick', { 
        post: this.properties.item, 
        index: this.properties.index 
      });
    },
    
    // Handle edit button click
    onEditClick() {
      this.triggerEvent('edit', { post: this.properties.item });
    },
    
    // Handle delete button click
    onDeleteClick() {
      this.triggerEvent('delete', { postId: this.properties.item.id });
    },
    
    // Handle restore button click
    onRestoreClick() {
      this.triggerEvent('restore', { postId: this.properties.item.id });
    },
    
    // Navigate to user profile
    onUserClick() {
      const username = this.properties.item.user.username;
      if (username === this.properties.currentUsername) {
        // Navigate to my posts
        wx.navigateTo({
          url: '/pages/me/posts/posts'
        });
      } else {
        // Navigate to user profile
        wx.navigateTo({
          url: `/pages/profile/profile?username=${username}`
        });
      }
    }
  }
});