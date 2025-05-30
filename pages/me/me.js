Page({
  data: {
    user: {
      username: 'John Doe',
      avatar: '/images/default-avatar.png',
      phone: '12345678',
      gender: 'male',
      birthday: '1995-06-15'
    },
    likes: 128,
    friends: [],
    followUsers: [],
    followedUsers: [],
    posts: [],
    loading: false,
    hasMore: true,
    currentTab: 0,
    tabs: ['작품', '좋아요', '즐겨찾기', '기록'],
    age: 0
  },

  onLoad() {
    this.calculateAge();
    this.loadPosts();
  },

  onShow() {
    // Refresh data when page shows
    this.loadPosts();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMorePosts();
    }
  },

  onPullDownRefresh() {
    this.refreshPosts();
  },

  calculateAge() {
    const birthday = new Date(this.data.user.birthday);
    const today = new Date();
    let age = today.getFullYear() - birthday.getFullYear();
    const hasHadBirthdayThisYear = 
      today.getMonth() > birthday.getMonth() ||
      (today.getMonth() === birthday.getMonth() && today.getDate() >= birthday.getDate());
    
    if (!hasHadBirthdayThisYear) {
      age -= 1;
    }
    
    this.setData({ age });
  },

  onTabChange(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ 
      currentTab: parseInt(index),
      posts: []
    });
    this.loadPosts();
  },

  async loadPosts() {
    this.setData({ loading: true });
    
    try {
      // Simulate API call
      await this.mockApiCall();
      const mockPosts = this.generateMockPosts();
      
      this.setData({ 
        posts: mockPosts,
        loading: false
      });
    } catch (error) {
      console.error('Failed to load posts:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: 'Loading failed',
        icon: 'none'
      });
    }
  },

  async loadMorePosts() {
    this.setData({ loading: true });
    
    try {
      await this.mockApiCall();
      const morePosts = this.generateMockPosts();
      
      this.setData({ 
        posts: [...this.data.posts, ...morePosts],
        loading: false
      });
    } catch (error) {
      this.setData({ loading: false });
    }
  },

  async refreshPosts() {
    this.setData({ posts: [] });
    await this.loadPosts();
    wx.stopPullDownRefresh();
  },

  mockApiCall() {
    return new Promise(resolve => {
      setTimeout(resolve, 1000);
    });
  },

  generateMockPosts() {
    const posts = [];
    for (let i = 0; i < 10; i++) {
      posts.push({
        id: Date.now() + i,
        title: `Post ${i + 1}`,
        image: '/images/placeholder.jpg',
        likes: Math.floor(Math.random() * 100),
        comments: Math.floor(Math.random() * 50),
        createTime: new Date().toISOString()
      });
    }
    return posts;
  },

  onPostTap(e) {
    const postId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/postDetail/postDetail?id=${postId}`
    });
  },

  onEditPost(e) {
    const postId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/editPost/editPost?id=${postId}`
    });
  },

  onDeletePost(e) {
    const postId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: 'Delete Confirmation',
      content: 'Are you sure you want to delete this post?',
      success: (res) => {
        if (res.confirm) {
          this.deletePost(postId);
        }
      }
    });
  },

  deletePost(postId) {
    const posts = this.data.posts.filter(post => post.id !== postId);
    this.setData({ posts });
    
    wx.showToast({
      title: 'Deleted successfully',
      icon: 'success'
    });
  },

  scrollToTop() {
    wx.pageScrollTo({
      scrollTop: 0,
      duration: 300
    });
  }
});