const { default: config } = require("../../config");
const { socketManager } = require("../../services/socket");

// pages/chat/chat.js
Page({
  data: {
    userInfo: getApp().globalData.userInfo || {},
    currentView: "list", // 'list' or 'chat'

    // Chat list data
    friends: [],
    filteredFriends: [],
    searchText: "",

    // Selected chat data
    selectedUser: null,
    chatMessages: [], 
    inputMessage: "",
    showEmojiPicker: false,

    // Context menu
    contextMenu: {
      visible: false,
      friendId: null,
      x: 0,
      y: 0,
    },

    // Emojis
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇",
      "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚",
      "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩",
      "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣",
      "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬",
      "🤯", "😳", "🥵", "🥶", "😱", "😨", "👍", "👎", "👌", "✌️",
      "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇", "☝️", "✋",
      "🤚", "🖐️", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
      "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "✨",
    ],

    scrollIntoView: "",
    keyboardHeight: 0,

    // Typing indicators - tracked per friend
    friendsTyping: {},

    // Add this to track the last viewed message
    lastViewedMessageId: null,
    
    uiTexts: {
      loading: "加载中...",
      loadingMessages: "加载消息中...",
      failedToLoad: "加载失败",
      failedToLoadFriends: "加载好友失败",
      networkError: "网络错误",
      deleteConfirm: "删除消息",
      deletePrompt: "确定要删除所有消息吗？",
      messagesDeleted: "消息已删除",
      blockConfirm: "屏蔽用户",
      blockPrompt: "确定要屏蔽此用户吗？",
      userBlocked: "用户已屏蔽",
      sendFailed: "发送失败",
      inappropriateLanguage: "请避免使用不当语言",
      today: "今天",
      yesterday: "昨天",
      goToProfile: "查看资料",
      noMessages: "没有消息"
    }
  },
  
  // Class properties (not in data)
  typingTimers: {}, // Map of friend ID to their typing timer
  
  onLoad: function (options) {
    const app = getApp();

    this.userInfoHandler = (userInfo) => {
      this.setData({ userInfo });
    };
    app.subscribe("userInfo", this.userInfoHandler);
    this.setData({
      userInfo: app.globalData.userInfo || {},
    });
    
    // Setup socket event listeners
    this.setupSocketListeners();
    
    this.getFriends();
  },

  onUnload: function () {
    const app = getApp();
    app.unsubscribe("userInfo", this.userInfoHandler);
    
    // Remove socket event listeners when page unloads
    this.removeSocketListeners();
    
    // Clear all timers when page unloads
    this.clearAllTimers();
  },
  
  // Clear all timers to prevent memory leaks
  clearAllTimers() {
    // Clear all typing timers
    Object.values(this.typingTimers).forEach(timer => {
      if (timer) clearTimeout(timer);
    });
    this.typingTimers = {};
  },
  
  // Setup socket event listeners
  setupSocketListeners() {
    // Handle user online events
    socketManager.on("user_online", this.handleUserOnline.bind(this));
    
    // Handle user offline events
    socketManager.on("user_offline", this.handleUserOffline.bind(this));
    
    // Handle typing indicator events
    socketManager.on("typing_message", this.handleTypingMessage.bind(this));
    
    // Handle new message events
    socketManager.on("new_message", this.handleNewMessage.bind(this));
    
    // Add read_message listener
    socketManager.on("read_message", this.handleReadMessage.bind(this));
  },
  
  // Remove socket event listeners
  removeSocketListeners() {
    socketManager.off("user_online", this.handleUserOnline.bind(this));
    socketManager.off("user_offline", this.handleUserOffline.bind(this));
    socketManager.off("typing_message", this.handleTypingMessage.bind(this));
    socketManager.off("new_message", this.handleNewMessage.bind(this));
    
    // Remove read_message listener
    socketManager.off("read_message", this.handleReadMessage.bind(this));
  },
  
  // Handle new message from socket
  handleNewMessage(data) {
    console.log("New message received:", data);
    
    // Only show messages in current chat and mark as read if in chat view with that user
    if (this.data.currentView === 'chat' && 
        this.data.selectedUser && 
        data.sender_id === this.data.selectedUser.id) {
      const newMessage = {
        id: data.id || Date.now(),
        sender_id: data.sender_id,
        message: data.message,
        created_at: data.created_at || new Date().toISOString(),
        formatted_time: this.formatTime(data.created_at || new Date().toISOString()),
      };
      
      const chatMessages = [...this.data.chatMessages, newMessage];
      
      this.setData({
        chatMessages,
        friendsTyping: {
          ...this.data.friendsTyping,
          [data.sender_id]: false
        }
      });
      
      // Mark as read only if currently in chat view
      this.markMessagesAsRead(data.sender_id);
      
      this.scrollToBottom();
    } else {
      // Update friends list with unread count for messages not in current chat
      const { friends, filteredFriends } = this.data;
      
      const updatedFriends = friends.map(friend => {
        if (friend.id === data.sender_id) {
          return { 
            ...friend, 
            unreadCount: (friend.unreadCount || 0) + 1,
            lastMessage: data.message
          };
        }
        return friend;
      });
      
      const updatedFilteredFriends = filteredFriends.map(friend => {
        if (friend.id === data.sender_id) {
          return { 
            ...friend, 
            unreadCount: (friend.unreadCount || 0) + 1,
            lastMessage: data.message
          };
        }
        return friend;
      });
      
      this.setData({
        friends: updatedFriends,
        filteredFriends: updatedFilteredFriends
      });
    }
  },
  
  // Handle typing message event from socket - closely follows React implementation
  handleTypingMessage(data) {
    console.log("Typing message received:", data);
    
    const senderId = data.sender_id;
    // Initialize object copy for safety
    const friendsTyping = this.data.friendsTyping || {};
    
    // Set this friend as typing
    friendsTyping[senderId] = true;
    this.setData({ friendsTyping });
    
    // Clear existing timer if any
    if (this.typingTimers[senderId]) {
      clearTimeout(this.typingTimers[senderId]);
    }
    
    // Set a timer to reset typing state after 1.5 seconds
    this.typingTimers[senderId] = setTimeout(() => {
      // Check if object exists before updating
      const updatedFriendsTyping = { ...this.data.friendsTyping };
      if (updatedFriendsTyping) {
        updatedFriendsTyping[senderId] = false;
        
        this.setData({
          friendsTyping: updatedFriendsTyping
        });
      }
      
      this.typingTimers[senderId] = null;
    }, 1500);
  },
  
  // Check if a friend is currently typing
  isFriendTyping(friendId) {
    return this.data.friendsTyping[friendId] || false;
  },
  
  // Handle online/offline status updates
  handleUserOnline(userId) {
    console.log(`User ${userId} came online`);
    this.updateFriendStatus(userId, "online");
  },
  
  handleUserOffline(userId) {
    console.log(`User ${userId} went offline`);
    this.updateFriendStatus(userId, "offline");
  },
  
  // Update friend's online status in UI
  updateFriendStatus(userId, status) {
    const { friends, filteredFriends, selectedUser } = this.data;
    
    // Update friends list
    const updatedFriends = friends.map(friend => {
      if (friend.id === userId) {
        return { ...friend, status };
      }
      return friend;
    });
    
    // Update filtered friends list
    const updatedFilteredFriends = filteredFriends.map(friend => {
      if (friend.id === userId) {
        return { ...friend, status };
      }
      return friend;
    });
    
    // Update selected user if applicable
    let updatedSelectedUser = selectedUser;
    if (selectedUser && selectedUser.id === userId) {
      updatedSelectedUser = { ...selectedUser, status };
    }
    
    this.setData({
      friends: updatedFriends,
      filteredFriends: updatedFilteredFriends,
      selectedUser: updatedSelectedUser
    });
  },
  
  // Check initial online status for all friends
  checkFriendsStatus() {
    const { friends } = this.data;
    
    if (!friends || friends.length === 0) return;
    
    friends.forEach(friend => {
      this.checkUserStatus(friend.id);
    });
  },
  
  // Check online status for a single user
  checkUserStatus(userId) {
    wx.request({
      url: `${config.SOCKET_SERVER_URL}/socket/check-user-status/${userId}`,
      method: 'GET',
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          const status = res.data.isOnline ? "online" : "offline";
          this.updateFriendStatus(userId, status);
        }
      },
      fail: (err) => {
        console.error('Failed to check user status:', err);
      }
    });
  },

  // Search functionality
  onSearchInput(e) {
    const searchText = e.detail.value.toLowerCase();
    const filtered = this.data.friends.filter((friend) =>
      friend.username.toLowerCase().includes(searchText)
    );

    this.setData({
      searchText: searchText,
      filteredFriends: filtered,
    });
  },

  // Open chat with selected user
  onSelectUser(e) {
    const userId = parseInt(e.currentTarget.dataset.userid);
    const user = this.data.friends.find((f) => f.id === userId);

    if (user) {
      // Reset unread count in local state
      user.unreadCount = 0;

      this.setData({
        currentView: "chat",
        selectedUser: user,
        chatMessages: [], // Initially empty until we fetch messages
        friendsTyping: {
          ...this.data.friendsTyping,
          [userId]: false
        },
        friends: this.data.friends.map((f) => (f.id === userId ? user : f)),
        filteredFriends: this.data.filteredFriends.map((f) =>
          f.id === userId ? user : f
        ),
      });

      // Fetch messages from the database
      this.getMessagesByUserId(userId);
      
      // Mark messages as read after fetching
      setTimeout(() => {
        // Only mark as read if still in chat view with this user
        if (this.data.currentView === 'chat' && this.data.selectedUser?.id === userId) {
          this.markMessagesAsRead(userId);
        }
      }, 500);
    }
  },

  // Add this new method to fetch messages by user ID
  getMessagesByUserId(userId) {
    if (!userId || !this.data.userInfo.token) return;

    wx.showLoading({
      title: this.data.uiTexts.loadingMessages,
    });

    wx.request({
      url: `${config.BACKEND_URL}/messages/get_message/${userId}`,
      method: "GET",
      header: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.data.userInfo.token}`,
      },
      success: (res) => {
        wx.hideLoading();

        if (res.data) {
          // Transform messages and format times
          const formattedMessages = res.data.map(msg => ({
            id: msg.id,
            sender_id: msg.sender_id === this.data.userInfo.id ? "me" : msg.sender_id,
            message: msg.message,
            created_at: msg.created_at,
            formatted_time: this.formatTime(msg.created_at),
            is_read: msg.seen_at ? true : false,
            seen_at: msg.seen_at
          }));

          // Store in local state
          this.setData({
            chatMessages: formattedMessages
          });

          // Find the last message sent by the current user that has been seen by the other user
          const lastReadMessage = formattedMessages
            .filter(msg => msg.sender_id === 'me' && msg.is_read)
            .pop();

          if (lastReadMessage) {
            this.setData({
              lastViewedMessageId: lastReadMessage.id
            });
          }

          // Scroll to bottom after a brief delay to ensure rendering
          setTimeout(() => {
            this.scrollToBottom();
          }, 300);
        } else {
          wx.showToast({
            title: this.data.uiTexts.failedToLoad,
            icon: "none",
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error("Failed to fetch messages:", err);
        wx.showToast({
          title: this.data.uiTexts.networkError,
          icon: "none",
        });
      },
    });
  },

  // Go back to chat list
  onBackToList() {
    this.setData({
      currentView: "list",
      selectedUser: null,
      chatMessages: [],
      showEmojiPicker: false,
      inputMessage: "",
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
        y: 200,
      },
    });
  },

  // Context menu actions
  onContextAction(e) {
    const action = e.currentTarget.dataset.action;
    const friendId = this.data.contextMenu.friendId;

    switch (action) {
      case "profile":
        wx.showToast({ title: this.data.uiTexts.goToProfile, icon: "none" });
        break;
      case "delete":
        this.deleteMessages(friendId);
        break;
      case "block":
        this.blockUser(friendId);
        break;
    }

    this.hideContextMenu();
  },

  hideContextMenu() {
    this.setData({
      contextMenu: { visible: false, friendId: null, x: 0, y: 0 },
    });
  },

  getFriends() {
    try {
      wx.request({
        url: `${config.BACKEND_URL}/friend/get_friends`,
        method: "GET",
        header: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.data.userInfo.token}`,
        },
        success: (res) => {
          if (res.data && res.data.status === "success") {
            const friends = res.data.users.map((friend) => ({
              ...friend,
              unreadCount: 0,
              status: "unknown" // Initialize status as unknown
            }));
            this.setData({
              friends: friends,
              filteredFriends: friends,
            });
            this.messageData = {};
            
            // Check online status for all friends after fetching the list
            this.checkFriendsStatus();
          } else {
            wx.showToast({
              title: this.data.uiTexts.failedToLoadFriends,
              icon: "none",
            });
          }
        },
        fail: () => {
          wx.showToast({
            title: this.data.uiTexts.networkError,
            icon: "none",
          });
        },
      });
    } catch (error) {
      console.error("Error fetching friends:", error);
    }
  },

  deleteMessages(friendId) {
    wx.showModal({
      title: this.data.uiTexts.deleteConfirm,
      content: this.data.uiTexts.deletePrompt,
      success: (res) => {
        if (res.confirm) {
          this.messageData[friendId] = [];
          if (
            this.data.selectedUser &&
            this.data.selectedUser.id === friendId
          ) {
            this.setData({ chatMessages: [] });
          }
          wx.showToast({ title: this.data.uiTexts.messagesDeleted, icon: "success" });
        }
      },
    });
  },

  blockUser(friendId) {
    wx.showModal({
      title: this.data.uiTexts.blockConfirm,
      content: this.data.uiTexts.blockPrompt,
      success: (res) => {
        if (res.confirm) {
          const friends = this.data.friends.filter((f) => f.id !== friendId);
          this.setData({
            friends: friends,
            filteredFriends: friends,
          });

          if (
            this.data.selectedUser &&
            this.data.selectedUser.id === friendId
          ) {
            this.onBackToList();
          }

          wx.showToast({ title: this.data.uiTexts.userBlocked, icon: "success" });
        }
      },
    });
  },

  // Message input handling - follows React's handleInputChange pattern
  onInputChange(e) {
    const newValue = e.detail.value;
    
    this.setData({
      inputMessage: newValue,
    });
    
    // Only send typing events if we have a selected user and some text
    if (this.data.selectedUser && newValue.length > 0) {
      // Send typing event to the server - directly emitting like in React
      socketManager.sendMessage("typing_message", {
        sender_id: this.data.userInfo.id,
        receiver_id: this.data.selectedUser.id
      });
    }
  },
  
  // Send message - similar to React's submitHandler
  onSendMessage() {
    const message = this.data.inputMessage.trim();
    if (!message || !this.data.selectedUser) return;
    
    // Check for swear words (similar to isContainSword in React)
    const app = getApp();
    const swearWords = app.globalData.swear || [];
    
    const containsSwearWord = swearWords.some(word => 
      message.toLowerCase().includes(word.name?.toLowerCase())
    );
    
    if (containsSwearWord) {
      wx.showToast({
        title: this.data.uiTexts.inappropriateLanguage,
        icon: "none"
      });
      return;
    }

    // Send message to server
    const messageData = {
      sender_id: this.data.userInfo.id,
      receiver_id: this.data.selectedUser.id,
      message: message,
      message_type: "text"
    };
    
    // Send to backend
    wx.request({
      url: `${config.BACKEND_URL}/messages/send_message`,
      method: 'POST',
      data: messageData,
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.data.userInfo.token}`
      },
      success: (res) => {
        if (res.data && res.data.status === 'success') {
          // Emit socket event for real-time delivery with all required fields
          // This includes the fields that the React app expects
          socketManager.sendMessage("new_message", {
            id: res.data.message.id || Date.now(),
            sender_id: this.data.userInfo.id,
            receiver_id: this.data.selectedUser.id,
            message: message,
            message_type: "text",
            created_at: res.data.message.created_at || new Date().toISOString(),
            // Include sender info that React needs
            sender: {
              id: this.data.userInfo.id,
              username: this.data.userInfo.username,
              avatar: this.data.userInfo.avatar
            },
            // Include receiver info
            receiver: {
              id: this.data.selectedUser.id,
              username: this.data.selectedUser.username,
              avatar: this.data.selectedUser.avatar
            }
          });
          
          // Add to local state
          const newMessage = {
            id: res.data.message.id || Date.now(),
            sender_id: "me",
            message: message,
            created_at: res.data.message.created_at || new Date().toISOString(),
            is_read: false, // Initialize as unread
          };
          
          const chatMessages = [...this.data.chatMessages, newMessage];
          
          // Update friends list with last message
          const updatedFriends = this.data.friends.map(friend => {
            if (friend.id === this.data.selectedUser.id) {
              return {
                ...friend,
                lastMessage: message,
                timestamp: "now"
              };
            }
            return friend;
          });
          
          this.setData({
            chatMessages,
            inputMessage: "",
            friends: updatedFriends,
            filteredFriends: updatedFriends
          });
          
          this.scrollToBottom();
        }
      },
      fail: (err) => {
        console.error("Failed to send message:", err);
        wx.showToast({
          title: this.data.uiTexts.sendFailed,
          icon: "none"
        });
      }
    });
  },
  
  // Scroll to bottom
  scrollToBottom() {
    if (this.data.chatMessages.length > 0) {
      const lastMessageId = `msg-${this.data.chatMessages.length - 1}`;
      this.setData({
        scrollIntoView: lastMessageId,
      });
    }
  },

  // Format date only
  formatDate(timestamp) {
    if (!timestamp) return "";
    
    const date = new Date(timestamp);
    const now = new Date();
    
    // Check if today
    if (date.toDateString() === now.toDateString()) {
      return this.data.uiTexts.today;
    }
    
    // Check if yesterday
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return this.data.uiTexts.yesterday;
    }
    
    // General date format
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  },

  // Format message timestamp
  formatTime(timestamp) {
    if (!timestamp) return "";
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 86400000) { // Less than a day
      return date.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    }
    
    if (diff < 172800000) { // Less than 2 days
      return this.data.uiTexts.yesterday + " " + date.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    }
    
    return date.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
    }) + " " + date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  },

  // Handle read message event from socket
  handleReadMessage(data) {
    console.log("Read message event received:", data);
    
    // data should contain sender_id (who read the message)
    if (!data || !data.sender_id) return;
    
    // Only update if the event is related to the current chat
    if (this.data.selectedUser && this.data.selectedUser.id === data.sender_id) {
      // Find all messages sent by current user to this sender
      const myMessages = this.data.chatMessages.filter(msg => 
        msg.sender_id === 'me' && !msg.is_read
      );
      
      if (myMessages.length > 0) {
        // Get the last message id
        const lastMessageId = myMessages[myMessages.length - 1].id;
        
        // Update lastViewedMessageId to show the eye icon
        this.setData({
          lastViewedMessageId: lastMessageId
        });
        
        // Mark all messages as read in the local state
        const updatedMessages = this.data.chatMessages.map(msg => {
          if (msg.sender_id === 'me') {
            return { ...msg, is_read: true };
          }
          return msg;
        });
        
        this.setData({
          chatMessages: updatedMessages
        });
      }
    }
  },

  // Mark messages as read
  markMessagesAsRead(userId) {
    if (!userId || !this.data.userInfo.token) return;
    
    // Only mark as read if currently in chat view with this user
    if (this.data.currentView !== 'chat' || this.data.selectedUser?.id !== userId) {
      console.log('Not marking messages as read - not in chat view with this user');
      return;
    }
    
    // Call the backend API to mark messages as read
    wx.request({
      url: `${config.BACKEND_URL}/messages/mark_read_message/${userId}`,
      method: 'GET',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.data.userInfo.token}`
      },
      success: (res) => {
        if (res.data && res.data.status === 'success') {
          console.log('Messages marked as read');
          
          // Emit socket event to notify sender that messages were read
          socketManager.sendMessage("read_message", {
            sender_id: this.data.userInfo.id,
            receiver_id: userId
          });
          
          // Update UI to clear unread count
          const { friends, filteredFriends } = this.data;
          
          const updatedFriends = friends.map(friend => {
            if (friend.id === userId) {
              return { ...friend, unreadCount: 0 };
            }
            return friend;
          });
          
          const updatedFilteredFriends = filteredFriends.map(friend => {
            if (friend.id === userId) {
              return { ...friend, unreadCount: 0 };
            }
            return friend;
          });
          
          this.setData({
            friends: updatedFriends,
            filteredFriends: updatedFilteredFriends
          });
        }
      },
      fail: (err) => {
        console.error('Failed to mark messages as read:', err);
      }
    });
  },

  onInputFocus() {
    this.setData({
      showEmojiPicker: false
    });
  },

  onInputBlur() {
  },

  onKeyboardHeightChange(e) {
    const keyboardHeight = e.detail.height || 0;
    this.setData({
      keyboardHeight
    });
    
    if (keyboardHeight > 0) {
      setTimeout(() => {
        this.scrollToBottom();
      }, 100);
    }
  },

  onEmojiSelect(e) {
    const emoji = e.currentTarget.dataset.emoji;
    const currentMessage = this.data.inputMessage;
    
    this.setData({
      inputMessage: currentMessage + emoji,
      showEmojiPicker: false
    });
  },

  toggleEmojiPicker() {
    this.setData({
      showEmojiPicker: !this.data.showEmojiPicker
    });
  },

  onMoreActions() {
    wx.showActionSheet({
      itemList: ['拍照', '从相册选择', '位置', '文件'],
      success: (res) => {
        switch(res.tapIndex) {
          case 0:
            this.takePhoto();
            break;
          case 1:
            this.chooseImage();
            break;
          case 2:
            this.shareLocation();
            break;
          case 3:
            this.chooseFile();
            break;
        }
      }
    });
  },

  takePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.uploadImage(tempFilePath);
      }
    });
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.uploadImage(tempFilePath);
      }
    });
  },

  uploadImage(filePath) {
    wx.showLoading({
      title: '上传中...'
    });
    
    wx.uploadFile({
      url: `${config.BACKEND_URL}/upload/image`,
      filePath: filePath,
      name: 'image',
      header: {
        'Authorization': `Bearer ${this.data.userInfo.token}`
      },
      success: (res) => {
        wx.hideLoading();
        const data = JSON.parse(res.data);
        if (data.status === 'success') {
          // 发送图片消息
          this.sendImageMessage(data.url);
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({
          title: '上传失败',
          icon: 'none'
        });
      }
    });
  },

  // 发送图片消息
  sendImageMessage(imageUrl) {
    if (!this.data.selectedUser) return;
    
    const messageData = {
      sender_id: this.data.userInfo.id,
      receiver_id: this.data.selectedUser.id,
      message: imageUrl,
      message_type: "image"
    };
    
    wx.request({
      url: `${config.BACKEND_URL}/messages/send_message`,
      method: 'POST',
      data: messageData,
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.data.userInfo.token}`
      },
      success: (res) => {
        if (res.data && res.data.status === 'success') {
          // 发送socket事件
          socketManager.sendMessage("new_message", {
            id: res.data.message.id || Date.now(),
            sender_id: this.data.userInfo.id,
            receiver_id: this.data.selectedUser.id,
            message: imageUrl,
            message_type: "image",
            created_at: res.data.message.created_at || new Date().toISOString()
          });
          
          // 添加到本地状态
          const newMessage = {
            id: res.data.message.id || Date.now(),
            sender_id: "me",
            message: imageUrl,
            message_type: "image",
            created_at: res.data.message.created_at || new Date().toISOString(),
            formatted_time: this.formatTime(res.data.message.created_at || new Date().toISOString()),
            is_read: false
          };
          
          const chatMessages = [...this.data.chatMessages, newMessage];
          this.setData({ chatMessages });
          this.scrollToBottom();
        }
      }
    });
  },

  // 分享位置
  shareLocation() {
    wx.chooseLocation({
      success: (res) => {
        const locationMessage = `位置: ${res.name}\n地址: ${res.address}`;
        this.sendLocationMessage(locationMessage, res.latitude, res.longitude);
      }
    });
  },

  // 发送位置消息
  sendLocationMessage(message, latitude, longitude) {
    const messageData = {
      sender_id: this.data.userInfo.id,
      receiver_id: this.data.selectedUser.id,
      message: message,
      message_type: "location",
      latitude: latitude,
      longitude: longitude
    };
    
    // 类似于发送普通消息的处理...
    this.setData({
      inputMessage: message
    });
    this.onSendMessage();
  },

  // 选择文件
  chooseFile() {
    wx.chooseMessageFile({
      count: 1,
      success: (res) => {
        const file = res.tempFiles[0];
        this.uploadFile(file.path, file.name);
      }
    });
  },

  // 上传文件
  uploadFile(filePath, fileName) {
    wx.showLoading({
      title: '上传中...'
    });
    
    wx.uploadFile({
      url: `${config.BACKEND_URL}/upload/file`,
      filePath: filePath,
      name: 'file',
      formData: {
        'fileName': fileName
      },
      header: {
        'Authorization': `Bearer ${this.data.userInfo.token}`
      },
      success: (res) => {
        wx.hideLoading();
        const data = JSON.parse(res.data);
        if (data.status === 'success') {
          this.sendFileMessage(data.url, fileName);
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({
          title: '上传失败',
          icon: 'none'
        });
      }
    });
  },

  // 发送文件消息
  sendFileMessage(fileUrl, fileName) {
    const message = `文件: ${fileName}`;
    this.setData({
      inputMessage: message
    });
    this.onSendMessage();
  },

  // 检查是否只包含表情符号
  isEmojiOnly(message) {
    if (!message || message.length === 0) return false;
    
    // 简单的表情符号检测
    const emojiRegex = /^[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]+$/u;
    return emojiRegex.test(message.trim());
  },

  // 创建新聊天
  onCreateChat() {
    wx.navigateTo({
      url: '/pages/contacts/contacts'
    });
  },

  // ...existing code...
});
