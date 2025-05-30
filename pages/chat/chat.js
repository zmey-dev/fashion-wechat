// pages/chat/chat.js
Page({
  data: {
    // UI State
    currentView: 'list', // 'list' or 'chat'
    
    // Chat list data
    friends: [
      {
        id: 1,
        username: "Alice Johnson",
        avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
        lastMessage: "Hey, how are you doing today?",
        unreadCount: 3,
        isOnline: true,
        timestamp: "10:30"
      },
      {
        id: 2,
        username: "Bob Smith", 
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
        lastMessage: "See you tomorrow at the meeting!",
        unreadCount: 0,
        isOnline: false,
        timestamp: "09:15"
      },
      {
        id: 3,
        username: "Charlie Brown",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
        lastMessage: "Thanks for your help! 👍",
        unreadCount: 1,
        isOnline: true,
        timestamp: "Yesterday"
      },
      {
        id: 4,
        username: "Diana Prince",
        avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
        lastMessage: "Let's catch up soon!",
        unreadCount: 0,
        isOnline: true,
        timestamp: "2 days ago"
      }
    ],
    filteredFriends: [],
    searchText: '',
    
    // Selected chat data
    selectedUser: null,
    messages: [],
    inputMessage: '',
    showEmojiPicker: false,
    
    // Context menu
    contextMenu: {
      visible: false,
      friendId: null,
      x: 0,
      y: 0
    },
    
    // Current user
    currentUser: {
      id: 'me',
      username: 'Me',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face'
    },
    
    // Emojis
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
      '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', 
      '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜',
      '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏',
      '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
      '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠',
      '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨',
      '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙',
      '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️',
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
      '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '✨'
    ],
    
    scrollIntoView: '',
    keyboardHeight: 0
  },

  onLoad() {
    this.setData({
      filteredFriends: this.data.friends
    });
    this.mockMessages();
  },

  // Mock message data
  mockMessages() {
    this.messageData = {
      1: [
        {
          id: 1,
          sender_id: 1,
          message: "Hello! How are you?",
          created_at: new Date(Date.now() - 300000).toISOString()
        },
        {
          id: 2,
          sender_id: 'me',
          message: "Hi Alice! I'm doing great, thanks!",
          created_at: new Date(Date.now() - 240000).toISOString()
        },
        {
          id: 3,
          sender_id: 1,
          message: "That's wonderful to hear! 😊",
          created_at: new Date(Date.now() - 180000).toISOString()
        },
        {
          id: 4,
          sender_id: 'me', 
          message: "What are you up to today?",
          created_at: new Date(Date.now() - 120000).toISOString()
        }
      ],
      2: [
        {
          id: 1,
          sender_id: 2,
          message: "Don't forget about tomorrow's meeting",
          created_at: new Date(Date.now() - 7200000).toISOString()
        },
        {
          id: 2,
          sender_id: 'me',
          message: "Thanks for reminding me!",
          created_at: new Date(Date.now() - 7100000).toISOString()
        }
      ],
      3: [
        {
          id: 1,
          sender_id: 'me',
          message: "Here's the document you requested",
          created_at: new Date(Date.now() - 1800000).toISOString()
        },
        {
          id: 2,
          sender_id: 3,
          message: "Thanks for your help! 👍",
          created_at: new Date(Date.now() - 1200000).toISOString()
        }
      ],
      4: [
        {
          id: 1, 
          sender_id: 4,
          message: "Hey! Long time no see 👋",
          created_at: new Date(Date.now() - 172800000).toISOString()
        },
        {
          id: 2,
          sender_id: 'me',
          message: "Diana! Yes, it's been too long!",
          created_at: new Date(Date.now() - 172700000).toISOString()
        }
      ]
    };
  },

  // Search functionality
  onSearchInput(e) {
    const searchText = e.detail.value.toLowerCase();
    const filtered = this.data.friends.filter(friend => 
      friend.username.toLowerCase().includes(searchText)
    );
    
    this.setData({
      searchText: searchText,
      filteredFriends: filtered
    });
  },

  // Open chat with selected user
  onSelectUser(e) {
    const userId = parseInt(e.currentTarget.dataset.userid);
    const user = this.data.friends.find(f => f.id === userId);
    
    if (user) {
      // Mark as read
      user.unreadCount = 0;
      
      const messages = this.messageData[userId] || [];
      
      this.setData({
        currentView: 'chat',
        selectedUser: user,
        messages: messages,
        friends: this.data.friends.map(f => f.id === userId ? user : f),
        filteredFriends: this.data.filteredFriends.map(f => f.id === userId ? user : f)
      });
      
      // Scroll to bottom after a brief delay
      setTimeout(() => {
        this.scrollToBottom();
      }, 300);
    }
  },

  // Go back to chat list
  onBackToList() {
    this.setData({
      currentView: 'list',
      selectedUser: null,
      messages: [],
      showEmojiPicker: false,
      inputMessage: ''
    });
  },

  // Long press context menu
  onLongPress(e) {
    const userId = parseInt(e.currentTarget.dataset.userid);
    
    this.setData({
      contextMenu: {
        visible: true,
        friendId: userId,
        x: 50,
        y: 200
      }
    });
  },

  // Context menu actions
  onContextAction(e) {
    const action = e.currentTarget.dataset.action;
    const friendId = this.data.contextMenu.friendId;
    
    switch(action) {
      case 'profile':
        wx.showToast({ title: 'Go to Profile', icon: 'none' });
        break;
      case 'delete':
        this.deleteMessages(friendId);
        break;
      case 'block':
        this.blockUser(friendId);
        break;
    }
    
    this.hideContextMenu();
  },

  hideContextMenu() {
    this.setData({
      contextMenu: { visible: false, friendId: null, x: 0, y: 0 }
    });
  },

  deleteMessages(friendId) {
    wx.showModal({
      title: 'Delete Messages',
      content: 'Are you sure you want to delete all messages?',
      success: (res) => {
        if (res.confirm) {
          this.messageData[friendId] = [];
          if (this.data.selectedUser && this.data.selectedUser.id === friendId) {
            this.setData({ messages: [] });
          }
          wx.showToast({ title: 'Messages deleted', icon: 'success' });
        }
      }
    });
  },

  blockUser(friendId) {
    wx.showModal({
      title: 'Block User',
      content: 'Are you sure you want to block this user?',
      success: (res) => {
        if (res.confirm) {
          const friends = this.data.friends.filter(f => f.id !== friendId);
          this.setData({
            friends: friends,
            filteredFriends: friends
          });
          
          if (this.data.selectedUser && this.data.selectedUser.id === friendId) {
            this.onBackToList();
          }
          
          wx.showToast({ title: 'User blocked', icon: 'success' });
        }
      }
    });
  },

  // Message input handling
  onInputChange(e) {
    this.setData({
      inputMessage: e.detail.value
    });
  },

  onInputFocus(e) {
    this.setData({
      keyboardHeight: e.detail.height || 0
    });
  },

  onInputBlur() {
    this.setData({
      keyboardHeight: 0
    });
  },

  // Send message
  onSendMessage() {
    const message = this.data.inputMessage.trim();
    if (!message || !this.data.selectedUser) return;
    
    const newMessage = {
      id: Date.now(),
      sender_id: 'me',
      message: message,
      created_at: new Date().toISOString()
    };
    
    const messages = [...this.data.messages, newMessage];
    this.messageData[this.data.selectedUser.id] = messages;
    
    // Update friend's last message
    const friends = this.data.friends.map(f => {
      if (f.id === this.data.selectedUser.id) {
        return { ...f, lastMessage: message, timestamp: 'now' };
      }
      return f;
    });
    
    this.setData({
      messages: messages,
      inputMessage: '',
      friends: friends,
      filteredFriends: friends
    });
    
    // Simulate reply
    setTimeout(() => {
      this.simulateReply();
    }, 1000);
    
    this.scrollToBottom();
  },

  // Simulate reply
  simulateReply() {
    if (!this.data.selectedUser) return;
    
    const replies = [
      "That's interesting! 🤔",
      "I agree with you 👍", 
      "Thanks for sharing that!",
      "Haha, that's funny 😄",
      "Really? Tell me more!",
      "I see what you mean 🙂",
      "That sounds great! ✨"
    ];
    
    const randomReply = replies[Math.floor(Math.random() * replies.length)];
    
    const replyMessage = {
      id: Date.now(),
      sender_id: this.data.selectedUser.id,
      message: randomReply,
      created_at: new Date().toISOString()
    };
    
    const messages = [...this.data.messages, replyMessage];
    this.messageData[this.data.selectedUser.id] = messages;
    
    this.setData({
      messages: messages
    });
    
    this.scrollToBottom();
  },

  // Emoji picker
  toggleEmojiPicker() {
    this.setData({
      showEmojiPicker: !this.data.showEmojiPicker
    });
  },

  onEmojiSelect(e) {
    const emoji = e.currentTarget.dataset.emoji;
    this.setData({
      inputMessage: this.data.inputMessage + emoji,
      showEmojiPicker: false
    });
  },

  // Scroll to bottom
  scrollToBottom() {
    if (this.data.messages.length > 0) {
      const lastMessageId = `msg-${this.data.messages.length - 1}`;
      this.setData({
        scrollIntoView: lastMessageId
      });
    }
  },

  // Format time
  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 86400000) {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    }
    
    if (diff < 172800000) {
      return 'Yesterday';
    }
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
  },

  // Check if emoji only
  isEmojiOnly(text) {
    const emojiRegex = /^[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\s]*$/u;
    return emojiRegex.test(text.trim()) && text.trim().length > 0;
  },

  // Handle keyboard
  onKeyboardHeightChange(e) {
    this.setData({
      keyboardHeight: e.detail.height
    });
    
    if (e.detail.height > 0) {
      setTimeout(() => {
        this.scrollToBottom();
      }, 100);
    }
  }
});