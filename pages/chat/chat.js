const { default: config } = require("../../config");
const { socketManager } = require("../../services/socket");
const ucloudUpload = require("../../services/ucloudUpload");

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
    isSending: false, // Add sending state

    // Context menu
    contextMenu: {
      visible: false,
      friendId: null,
      x: 0,
      y: 0,
    },
    
    // File upload states
    uploadingFiles: [],
    fileUploadProgress: {},
    fileUploadErrors: {},

    // Emojis
    emojis: [
      "😀",
      "😃",
      "😄",
      "😁",
      "😆",
      "😅",
      "😂",
      "🤣",
      "😊",
      "😇",
      "🙂",
      "🙃",
      "😉",
      "😌",
      "😍",
      "🥰",
      "😘",
      "😗",
      "😙",
      "😚",
      "😋",
      "😛",
      "😝",
      "😜",
      "🤪",
      "🤨",
      "🧐",
      "🤓",
      "😎",
      "🤩",
      "🥳",
      "😏",
      "😒",
      "😞",
      "😔",
      "😟",
      "😕",
      "🙁",
      "☹️",
      "😣",
      "😖",
      "😫",
      "😩",
      "🥺",
      "😢",
      "😭",
      "😤",
      "😠",
      "😡",
      "🤬",
      "🤯",
      "😳",
      "🥵",
      "🥶",
      "😱",
      "😨",
      "👍",
      "👎",
      "👌",
      "✌️",
      "🤞",
      "🤟",
      "🤘",
      "🤙",
      "👈",
      "👉",
      "👆",
      "👇",
      "☝️",
      "✋",
      "🤚",
      "🖐️",
      "❤️",
      "🧡",
      "💛",
      "💚",
      "💙",
      "💜",
      "🖤",
      "🤍",
      "💔",
      "❣️",
      "💕",
      "💞",
      "💓",
      "💗",
      "💖",
      "✨",
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
      noMessages: "没有消息",
    },
  }, // Class properties (not in data)
  typingTimers: {}, // Map of friend ID to their typing timer
  lastSentMessage: null, // Track last sent message to prevent duplicates
  lastSentTime: 0, // Track last sent time
  sendingTimeout: null, // Debounce timer for sending

  onLoad: function (options) {
    const app = getApp();

    this.userInfoHandler = (userInfo) => {
      this.setData({ userInfo });
    };

    // Subscribe to centralized unread messages
    this.unreadMessagesHandler = (unreadMessagesByUser) => {
      this.updateFriendsFromCentralizedData(unreadMessagesByUser);
    };

    app.subscribe("userInfo", this.userInfoHandler);
    app.subscribe("unreadMessagesByUser", this.unreadMessagesHandler);

    this.setData({
      userInfo: app.globalData.userInfo || {},
    });

    // Setup socket event listeners
    this.setupSocketListeners();

    this.getFriends();
  },

  onShow: function () {
    this.getFriends();
  },

  onUnload: function () {
    const app = getApp();
    app.unsubscribe("userInfo", this.userInfoHandler);
    app.unsubscribe("unreadMessagesByUser", this.unreadMessagesHandler);

    // Remove socket event listeners when page unloads
    this.removeSocketListeners();

    // Clear all timers when page unloads
    this.clearAllTimers();
  },
  // Clear all timers to prevent memory leaks
  clearAllTimers: function() {
    // Clear all typing timers
    Object.values(this.typingTimers).forEach((timer) => {
      if (timer) clearTimeout(timer);
    });
    this.typingTimers = {};

    // Clear sending timeout
    if (this.sendingTimeout) {
      clearTimeout(this.sendingTimeout);
      this.sendingTimeout = null;
    }
  },

  // Setup socket event listeners
  setupSocketListeners: function() {
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
  removeSocketListeners: function() {
    socketManager.off("user_online", this.handleUserOnline.bind(this));
    socketManager.off("user_offline", this.handleUserOffline.bind(this));
    socketManager.off("typing_message", this.handleTypingMessage.bind(this));
    socketManager.off("new_message", this.handleNewMessage.bind(this));

    // Remove read_message listener
    socketManager.off("read_message", this.handleReadMessage.bind(this));
  },

  // Handle new message from socket
  handleNewMessage: function(data) {

    if (
      this.data.currentView === "chat" &&
      this.data.selectedUser &&
      data.sender_id === this.data.selectedUser.id
    ) {
      const newMessage = {
        id: data.id || Date.now(),
        sender_id: data.sender_id,
        message: data.message,
        message_type: data.message_type || "text",
        created_at: data.created_at || new Date().toISOString(),
        formatted_time: this.formatTime(
          data.created_at || new Date().toISOString()
        ),
      };

      const chatMessages = [...this.data.chatMessages, newMessage];

      this.setData({
        chatMessages,
        friendsTyping: {
          ...this.data.friendsTyping,
          [data.sender_id]: false,
        },
      });

      this.scrollToBottom();

      setTimeout(() => {
        if (
          this.data.currentView === "chat" &&
          this.data.selectedUser?.id === data.sender_id &&
          !this.isPageHidden
        ) {
          this.markMessagesAsRead(data.sender_id);
        }
      }, 1000);
    }

    // No need to handle unread count here - app.js handles it centrally
  },

  // Handle typing message event from socket - closely follows React implementation
  handleTypingMessage: function(data) {

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
          friendsTyping: updatedFriendsTyping,
        });
      }

      this.typingTimers[senderId] = null;
    }, 1500);
  },

  // Check if a friend is currently typing
  isFriendTyping: function(friendId) {
    return this.data.friendsTyping[friendId] || false;
  },

  // Handle online/offline status updates
  handleUserOnline: function(userId) {
    this.updateFriendStatus(userId, "online");
  },

  handleUserOffline: function(userId) {
    this.updateFriendStatus(userId, "offline");
  },

  // Update friend's online status in UI
  updateFriendStatus(userId, status) {
    const { friends, filteredFriends, selectedUser } = this.data;

    // Update friends list
    const updatedFriends = friends.map((friend) => {
      if (friend.id === userId) {
        return { ...friend, status };
      }
      return friend;
    });

    // Update filtered friends list
    const updatedFilteredFriends = filteredFriends.map((friend) => {
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
      selectedUser: updatedSelectedUser,
    });
  },

  // Check initial online status for all friends
  checkFriendsStatus() {
    const { friends } = this.data;

    if (!friends || friends.length === 0) return;

    friends.forEach((friend) => {
      this.checkUserStatus(friend.id);
    });
  },

  // Check online status for a single user
  checkUserStatus(userId) {
    wx.request({
      url: `${config.SOCKET_SERVER_URL}/socket/check-user-status/${userId}`,
      method: "GET",
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          const status = res.data.isOnline ? "online" : "offline";
          this.updateFriendStatus(userId, status);
        }
      },
      fail: (err) => {
        console.error("Failed to check user status:", err);
      },
    });
  },

  // Search functionality
  onSearchInput(e) {
    const searchText = e.detail.value.toLowerCase();
    const filtered = this.data.friends.filter((friend) =>
      friend.nickname.toLowerCase().includes(searchText)
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
        chatMessages: [],
        friendsTyping: {
          ...this.data.friendsTyping,
          [userId]: false,
        },
        friends: this.data.friends.map((f) => (f.id === userId ? user : f)),
        filteredFriends: this.data.filteredFriends.map((f) =>
          f.id === userId ? user : f
        ),
      });

      // Clear unread count in centralized app state
      const app = getApp();
      app.clearUnreadForUser(userId);

      // Only fetch messages and mark as read if allowed to chat
      if (user.is_allow) {
        // Fetch messages from the database
        this.getMessagesByUserId(userId);

        // Mark messages as read after fetching
        setTimeout(() => {
          if (
            this.data.currentView === "chat" &&
            this.data.selectedUser?.id === userId
          ) {
            this.markMessagesAsRead(userId);
          }
        }, 500);
      }
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
        Authorization: `Bearer ${this.data.userInfo.token}`,
      },
      success: (res) => {
        wx.hideLoading();

        if (res.data) {
          // Transform messages and format times
          const formattedMessages = res.data.map((msg) => ({
            id: msg.id,
            sender_id:
              msg.sender_id === this.data.userInfo.id ? "me" : msg.sender_id,
            message: msg.message,
            message_type: msg.message_type || "text",
            created_at: msg.created_at,
            formatted_time: this.formatTime(msg.created_at),
            is_read: msg.seen_at ? true : false,
            seen_at: msg.seen_at,
          }));

          // Store in local state
          this.setData({
            chatMessages: formattedMessages,
          });

          // Find the last message sent by the current user that has been seen by the other user
          const lastReadMessage = formattedMessages
            .filter((msg) => msg.sender_id === "me" && msg.is_read)
            .pop();

          if (lastReadMessage) {
            this.setData({
              lastViewedMessageId: lastReadMessage.id,
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
  onContextAction: function(e) {
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

  hideContextMenu: function() {
    this.setData({
      contextMenu: { visible: false, friendId: null, x: 0, y: 0 },
    });
  },

  getFriends: function() {
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
              status: "unknown",
            }));
            this.setData({
              friends: friends,
              filteredFriends: friends,
            });

            // Use centralized unread message fetching
            const app = getApp();
            app.fetchUnreadMessages().then(() => {
              this.updateFriendsFromCentralizedData(
                app.globalData.unreadMessagesByUser
              );
            });

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

  // Replace updateFriendsWithUnreadCounts with this method
  updateFriendsFromCentralizedData(unreadMessagesByUser) {
    const { friends, filteredFriends } = this.data;

    // Update friends list with centralized unread data
    const updatedFriends = friends.map((friend) => {
      const unreadData = unreadMessagesByUser[friend.id];
      if (unreadData) {
        return {
          ...friend,
          unreadCount: unreadData.count,
          lastMessage: unreadData.lastMessage,
        };
      }
      return { ...friend, unreadCount: 0 };
    });

    // Update filtered friends list
    const updatedFilteredFriends = filteredFriends.map((friend) => {
      const unreadData = unreadMessagesByUser[friend.id];
      if (unreadData) {
        return {
          ...friend,
          unreadCount: unreadData.count,
          lastMessage: unreadData.lastMessage,
        };
      }
      return { ...friend, unreadCount: 0 };
    });

    this.setData({
      friends: updatedFriends,
      filteredFriends: updatedFilteredFriends,
    });
  }, // Message input handling - follows React's handleInputChange pattern
  onInputChange(e) {
    if (this.data.isSending) return; // Prevent input during sending

    const newValue = e.detail.value;

    this.setData({
      inputMessage: newValue,
    });

    // Only send typing events if we have a selected user and some text
    if (this.data.selectedUser && newValue.length > 0) {
      // Send typing event to the server - directly emitting like in React
      socketManager.sendMessage("typing_message", {
        sender_id: this.data.userInfo.id,
        receiver_id: this.data.selectedUser.id,
      });
    }
  }, // Send message - similar to React's submitHandler
  onSendMessage() {
    const message = this.data.inputMessage.trim();
    if (!message || !this.data.selectedUser) return;

    // Prevent duplicate sending
    if (this.data.isSending) return;

    // Clear any existing sending timeout
    if (this.sendingTimeout) {
      clearTimeout(this.sendingTimeout);
    }

    // Additional duplicate prevention: check if same message was sent recently
    const now = Date.now();
    if (this.lastSentMessage === message && now - this.lastSentTime < 2000) {
      return;
    }

    // Check for swear words (similar to isContainSword in React)
    const app = getApp();
    const swearWords = app.globalData.swear || [];

    const containsSwearWord = swearWords.some((word) =>
      message.toLowerCase().includes(word.name?.toLowerCase())
    );

    if (containsSwearWord) {
      wx.showToast({
        title: this.data.uiTexts.inappropriateLanguage,
        icon: "none",
      });
      return;
    }

    // Set sending state and record message info immediately
    this.setData({ isSending: true });
    this.lastSentMessage = message;
    this.lastSentTime = now;

    // Use a small debounce to prevent rapid multiple clicks
    this.sendingTimeout = setTimeout(() => {
      this.actualSendMessage(message);
    }, 100);
  },

  // Actual message sending function
  actualSendMessage(message) {
    // Send message to server
    const messageData = {
      sender_id: this.data.userInfo.id,
      receiver_id: this.data.selectedUser.id,
      message: message,
      message_type: "text",
    };

    // Send to backend
    wx.request({
      url: `${config.BACKEND_URL}/messages/send_message`,
      method: "POST",
      data: messageData,
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.data.userInfo.token}`,
      },
      success: (res) => {
        if (res.data && res.data.status === "success") {
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
              nickname: this.data.userInfo.nickname,
              avatar: this.data.userInfo.avatar,
            },
            // Include receiver info
            receiver: {
              id: this.data.selectedUser.id,
              username: this.data.selectedUser.username,
              nickname: this.data.selectedUser.nickname,
              avatar: this.data.selectedUser.avatar,
            },
          });

          // Add to local state
          const newMessage = {
            id: res.data.message.id || Date.now(),
            sender_id: "me",
            message: message,
            message_type: "text",
            created_at: res.data.message.created_at || new Date().toISOString(),
            formatted_time: this.formatTime(
              res.data.message.created_at || new Date().toISOString()
            ),
            is_read: false, // Initialize as unread
          };

          const chatMessages = [...this.data.chatMessages, newMessage];

          // Update friends list with last message
          const updatedFriends = this.data.friends.map((friend) => {
            if (friend.id === this.data.selectedUser.id) {
              return {
                ...friend,
                lastMessage: message,
                timestamp: "now",
              };
            }
            return friend;
          });

          this.setData({
            chatMessages,
            inputMessage: "",
            friends: updatedFriends,
            filteredFriends: updatedFriends,
          });

          // Hide keyboard after sending message
          wx.hideKeyboard();
          
          this.scrollToBottom();
        }
      },
      fail: (err) => {
        console.error("Failed to send message:", err);
        wx.showToast({
          title: this.data.uiTexts.sendFailed,
          icon: "none",
        });
      },
      complete: () => {
        // Reset sending state
        this.setData({ isSending: false });
        this.sendingTimeout = null;
      },
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
      day: "numeric",
    });
  },

  // Format message timestamp
  formatTime(timestamp) {
    if (!timestamp) return "";

    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 86400000) {
      // Less than a day
      return date.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    }

    if (diff < 172800000) {
      // Less than 2 days
      return (
        this.data.uiTexts.yesterday +
        " " +
        date.toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      );
    }

    return (
      date.toLocaleDateString("zh-CN", {
        month: "short",
        day: "numeric",
      }) +
      " " +
      date.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    );
  },

  // Handle read message event from socket
  handleReadMessage(data) {

    // data should contain sender_id (who read the message)
    if (!data || !data.sender_id) return;

    // Only update if the event is related to the current chat
    if (
      this.data.selectedUser &&
      this.data.selectedUser.id === data.sender_id
    ) {
      // Find all messages sent by current user to this sender
      const myMessages = this.data.chatMessages.filter(
        (msg) => msg.sender_id === "me" && !msg.is_read
      );

      if (myMessages.length > 0) {
        // Get the last message id
        const lastMessageId = myMessages[myMessages.length - 1].id;

        // Update lastViewedMessageId to show the eye icon
        this.setData({
          lastViewedMessageId: lastMessageId,
        });

        // Mark all messages as read in the local state
        const updatedMessages = this.data.chatMessages.map((msg) => {
          if (msg.sender_id === "me") {
            return { ...msg, is_read: true };
          }
          return msg;
        });

        this.setData({
          chatMessages: updatedMessages,
        });
      }
    }
  },

  // Mark messages as read
  markMessagesAsRead(userId) {
    if (!userId || !this.data.userInfo.token) return;

    // Only mark as read if currently in chat view with this user
    if (
      this.data.currentView !== "chat" ||
      this.data.selectedUser?.id !== userId
    ) {
      return;
    }

    // Call the backend API to mark messages as read
    wx.request({
      url: `${config.BACKEND_URL}/messages/mark_read_message/${userId}`,
      method: "GET",
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.data.userInfo.token}`,
      },
      success: (res) => {
        if (res.data && res.data.status === "success") {

          // Emit socket event to notify sender that messages were read
          socketManager.sendMessage("read_message", {
            sender_id: this.data.userInfo.id,
            receiver_id: userId,
          });

          // Update UI to clear unread count
          const { friends, filteredFriends } = this.data;

          const updatedFriends = friends.map((friend) => {
            if (friend.id === userId) {
              return { ...friend, unreadCount: 0 };
            }
            return friend;
          });

          const updatedFilteredFriends = filteredFriends.map((friend) => {
            if (friend.id === userId) {
              return { ...friend, unreadCount: 0 };
            }
            return friend;
          });

          this.setData({
            friends: updatedFriends,
            filteredFriends: updatedFilteredFriends,
          });
        }
      },
      fail: (err) => {
        console.error("Failed to mark messages as read:", err);
      },
    });
  },

  onInputFocus() {
    this.setData({
      showEmojiPicker: false,
    });
  },

  onInputBlur() {
    // Reset keyboard height when input loses focus
    this.setData({
      keyboardHeight: 0,
      showEmojiPicker: false,
    });
  },

  onKeyboardHeightChange(e) {
    const keyboardHeight = e.detail.height || 0;
    this.setData({
      keyboardHeight: Math.max(0, keyboardHeight), // Ensure non-negative
    });

    // Scroll to bottom when keyboard appears or disappears
    setTimeout(() => {
      this.scrollToBottom();
    }, 100);
  },
  onEmojiSelect(e) {
    if (this.data.isSending) return; // Prevent emoji selection during sending

    const emoji = e.currentTarget.dataset.emoji;
    const currentMessage = this.data.inputMessage;

    this.setData({
      inputMessage: currentMessage + emoji,
      showEmojiPicker: false,
    });
  },

  toggleEmojiPicker() {
    if (this.data.isSending) return; // Prevent emoji picker toggle during sending

    this.setData({
      showEmojiPicker: !this.data.showEmojiPicker,
    });
  },
  onMoreActions() {
    if (this.data.isSending) return; // Prevent more actions during sending

    wx.showActionSheet({
      itemList: ["拍照", "从相册选择", "位置", "文件"],
      success: (res) => {
        switch (res.tapIndex) {
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
      },
    });
  },
  takePhoto() {
    if (this.data.isSending) return; // Prevent photo taking during sending

    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["camera"],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.uploadImage(tempFilePath);
      },
    });
  },

  chooseImage() {
    if (this.data.isSending) return; // Prevent image selection during sending

    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album"],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.uploadImage(tempFilePath);
      },
    });
  },
  async uploadImage(filePath) {
    if (this.data.isSending) return; // Prevent upload during sending

    // Set sending state for image upload
    this.setData({ isSending: true });
    
    const uploadId = Date.now().toString();
    this.setData({
      uploadingFiles: [...this.data.uploadingFiles, uploadId],
      [`fileUploadProgress.${uploadId}`]: 0
    });

    wx.showLoading({
      title: "上传中...",
    });

    try {
      // Progress callback
      const progressCallback = (progress) => {
        this.setData({
          [`fileUploadProgress.${uploadId}`]: progress
        });
      };
      
      // Use UCloud upload for images
      const uploadResult = await ucloudUpload.uploadImageSimple(
        filePath,
        progressCallback,
        'chat_images'
      );
      
      if (uploadResult && uploadResult.url) {
        wx.hideLoading();
        
        // Remove from uploading list
        const updatedUploading = this.data.uploadingFiles.filter(id => id !== uploadId);
        this.setData({ uploadingFiles: updatedUploading });
        
        // Send image message
        this.sendImageMessage(uploadResult.url);
      } else {
        throw new Error("上传结果无效");
      }
    } catch (error) {
      console.error("Image upload failed:", error);
      
      wx.hideLoading();
      
      // Remove from uploading list and add error
      const updatedUploading = this.data.uploadingFiles.filter(id => id !== uploadId);
      this.setData({
        uploadingFiles: updatedUploading,
        [`fileUploadErrors.${uploadId}`]: error.message || "上传失败"
      });
      
      wx.showToast({
        title: "上传失败",
        icon: "none",
      });
    } finally {
      // Reset sending state
      this.setData({ isSending: false });
    }
  },
  // Send image message
  sendImageMessage(imageUrl) {
    if (!this.data.selectedUser || this.data.isSending) return;

    const messageData = {
      sender_id: this.data.userInfo.id,
      receiver_id: this.data.selectedUser.id,
      message: imageUrl,
      message_type: "image",
    };

    wx.request({
      url: `${config.BACKEND_URL}/messages/send_message`,
      method: "POST",
      data: messageData,
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.data.userInfo.token}`,
      },
      success: (res) => {
        if (res.data && res.data.status === "success") {
          // Send socket event
          socketManager.sendMessage("new_message", {
            id: res.data.message.id || Date.now(),
            sender_id: this.data.userInfo.id,
            receiver_id: this.data.selectedUser.id,
            message: imageUrl,
            message_type: "image",
            created_at: res.data.message.created_at || new Date().toISOString(),
          });

          // Add to local state
          const newMessage = {
            id: res.data.message.id || Date.now(),
            sender_id: "me",
            message: imageUrl,
            message_type: "image",
            created_at: res.data.message.created_at || new Date().toISOString(),
            formatted_time: this.formatTime(
              res.data.message.created_at || new Date().toISOString()
            ),
            is_read: false,
          };

          const chatMessages = [...this.data.chatMessages, newMessage];
          this.setData({ chatMessages });
          this.scrollToBottom();
        }
      },
    });
  },
  // Share location
  shareLocation() {
    if (this.data.isSending) return; // Prevent location sharing during sending

    wx.chooseLocation({
      success: (res) => {
        const locationMessage = `位置: ${res.name}\n地址: ${res.address}`;
        this.sendLocationMessage(locationMessage, res.latitude, res.longitude);
      },
    });
  },

  // Send location message
  sendLocationMessage(message, latitude, longitude) {
    if (this.data.isSending) return; // Prevent location message during sending

    const messageData = {
      sender_id: this.data.userInfo.id,
      receiver_id: this.data.selectedUser.id,
      message: message,
      message_type: "location",
      latitude: latitude,
      longitude: longitude,
    };
    // Similar to sending normal message handling...
    this.setData({
      inputMessage: message,
    });
    this.onSendMessage();
  },

  // Choose file
  chooseFile() {
    if (this.data.isSending) return; // Prevent file selection during sending

    wx.chooseMessageFile({
      count: 1,
      success: (res) => {
        const file = res.tempFiles[0];
        this.uploadFile(file.path, file.name);
      },
    });
  },
  // Upload file using UCloud
  async uploadFile(filePath, fileName) {
    if (this.data.isSending) return; // Prevent file upload during sending

    // Set sending state for file upload
    this.setData({ isSending: true });
    
    const uploadId = Date.now().toString();
    this.setData({
      uploadingFiles: [...this.data.uploadingFiles, uploadId],
      [`fileUploadProgress.${uploadId}`]: 0
    });

    wx.showLoading({
      title: "上传中...",
    });

    try {
      // Progress callback
      const progressCallback = (progress) => {
        this.setData({
          [`fileUploadProgress.${uploadId}`]: progress
        });
      };
      
      // Prepare file object for UCloud upload
      const fileForUpload = {
        tempFilePath: filePath,
        name: fileName,
        size: 0, // Size will be determined by UCloud service
        type: this.getFileTypeFromName(fileName)
      };
      
      // Use appropriate upload method based on file type
      let uploadResult;
      if (this.isImageFile(fileName)) {
        uploadResult = await ucloudUpload.uploadImageSimple(filePath, progressCallback, 'chat_files');
      } else if (this.isAudioFile(fileName)) {
        uploadResult = await ucloudUpload.uploadAudio(filePath, progressCallback, 'chat_files');
      } else {
        // For other file types, use generic upload (you may need to implement this in ucloudUpload)
        uploadResult = await ucloudUpload.uploadMedia(fileForUpload, progressCallback, {
          upload: 'chat_files'
        });
      }
      
      if (uploadResult && (uploadResult.url || uploadResult.uploadUrl || uploadResult.audioUrl)) {
        wx.hideLoading();
        
        // Remove from uploading list
        const updatedUploading = this.data.uploadingFiles.filter(id => id !== uploadId);
        this.setData({ uploadingFiles: updatedUploading });
        
        const fileUrl = uploadResult.url || uploadResult.uploadUrl || uploadResult.audioUrl;
        this.sendFileMessage(fileUrl, fileName);
      } else {
        throw new Error("上传结果无效");
      }
    } catch (error) {
      console.error("File upload failed:", error);
      
      wx.hideLoading();
      
      // Remove from uploading list and add error
      const updatedUploading = this.data.uploadingFiles.filter(id => id !== uploadId);
      this.setData({
        uploadingFiles: updatedUploading,
        [`fileUploadErrors.${uploadId}`]: error.message || "上传失败"
      });
      
      wx.showToast({
        title: "上传失败",
        icon: "none",
      });
    } finally {
      // Reset sending state
      this.setData({ isSending: false });
    }
  },
  
  // Helper functions for file type detection
  getFileTypeFromName(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) {
      return 'image';
    } else if (['mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg'].includes(ext)) {
      return 'audio';
    } else if (['mp4', 'mov', 'avi', 'wmv', 'flv', 'webm'].includes(ext)) {
      return 'video';
    }
    return 'file';
  },
  
  isImageFile(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext);
  },
  
  isAudioFile(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    return ['mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg'].includes(ext);
  },

  // Send file message
  sendFileMessage(fileUrl, fileName) {
    if (this.data.isSending) return; // Prevent file message during sending

    const message = `文件: ${fileName}`;
    this.setData({
      inputMessage: message,
    });
    this.onSendMessage();
  },

  // Check if message contains only emoji - Fixed regex
  isEmojiOnly(message) {
    if (!message || message.length === 0) return false;

    // Simplified emoji detection that doesn't cause parsing errors
    const emojiRegex =
      /^[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+$/u;
    return emojiRegex.test(message.trim());
  },

  // Create new chat
  onCreateChat() {
    wx.navigateTo({
      url: "/pages/contacts/contacts",
    });
  },

  // Remove these methods as they're now handled by app.js:
  // - clearTabbarUnreadCount
  // - updateTabbarUnreadCount
  // - getTabbarComponent
  // - clearTabbarUnreadCountForUser

  // Send friend request
  onSendFriendRequest: function() {
    if (!this.data.selectedUser) return;
    
    wx.showLoading({ title: "发送中..." });
    
    wx.request({
      url: `${config.BACKEND_URL}/friend/add_friend`,
      method: "POST",
      data: {
        friend_id: this.data.selectedUser.id
      },
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.data.userInfo.token}`,
      },
      success: (res) => {
        wx.hideLoading();
        if (res.data && res.data.status === "success") {
          wx.showToast({
            title: "好友请求已发送",
            icon: "success"
          });
          
          // Update selectedUser's is_allow status if it becomes mutual friends
          // (This happens when both users send friend requests to each other)
          if (res.data.message && res.data.message.event_type === "accept_friend") {
            const updatedUser = { ...this.data.selectedUser, is_allow: true };
            this.setData({ selectedUser: updatedUser });
            
            // Also update the friends list
            const updatedFriends = this.data.friends.map(f => 
              f.id === this.data.selectedUser.id ? updatedUser : f
            );
            const updatedFilteredFriends = this.data.filteredFriends.map(f => 
              f.id === this.data.selectedUser.id ? updatedUser : f
            );
            
            this.setData({
              friends: updatedFriends,
              filteredFriends: updatedFilteredFriends
            });
          }
        } else {
          wx.showToast({
            title: res.data.msg || "发送失败",
            icon: "none"
          });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({
          title: "网络错误",
          icon: "none"
        });
      }
    });
  },

  // Switch to chat with user
  switchToChat: function (user) {
    this.setData({
      currentView: "chat",
      selectedUser: user,
      chatMessages: [],
    });

    // Only load messages and mark as read if allowed to chat
    if (user.is_allow) {
      // Mark messages as read when entering chat
      this.markMessagesAsRead(user.id);

      // Load chat messages
      this.getMessagesByUserId(user.id);

      this.scrollToBottom();
    }
  },

  // Handle friend tap
  onFriendTap: function (e) {
    const friendId = e.currentTarget.dataset.friendId;
    const friend = this.data.friends.find((f) => f.id === friendId);

    if (friend) {
      this.switchToChat(friend);
    }
  },

  // Block user (same as web version - actually deletes friend)
  blockUser: function (friendId) {
    wx.showModal({
      title: "确认操作",
      content: "您确定要删除您的好友请求吗？", // Same message as web version
      confirmText: "确定",
      cancelText: "取消",
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: "处理中..." });
          
          wx.request({
            url: `${config.BACKEND_URL}/friend/del_friend_by_friend_id`,
            method: "DELETE",
            data: {
              friend_id: friendId
            },
            header: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.data.userInfo.token}`,
            },
            success: (res) => {
              wx.hideLoading();
              if (res.statusCode === 200) {
                // Remove friend from local state
                const updatedFriends = this.data.friends.filter(f => f.id !== friendId);
                const updatedFilteredFriends = this.data.filteredFriends.filter(f => f.id !== friendId);
                
                this.setData({
                  friends: updatedFriends,
                  filteredFriends: updatedFilteredFriends,
                  currentView: "list", // Go back to list like web version
                  selectedUser: null,
                  chatMessages: []
                });
                
                wx.showToast({
                  title: "已删除好友",
                  icon: "success"
                });
              } else {
                wx.showToast({
                  title: "删除失败",
                  icon: "none"
                });
              }
            },
            fail: () => {
              wx.hideLoading();
              wx.showToast({
                title: "网络错误",
                icon: "none"
              });
            }
          });
        }
      }
    });
  },

  // Delete messages with friend (like web version)
  deleteMessages: function (friendId) {
    wx.showModal({
      title: "确认删除",
      content: "确定要删除与此好友的所有聊天记录吗？",
      confirmText: "删除",
      cancelText: "取消",
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: "删除中..." });
          
          wx.request({
            url: `${config.BACKEND_URL}/messages/del_messages_by_friend_id`,
            method: "DELETE",
            data: {
              friend_id: friendId
            },
            header: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.data.userInfo.token}`,
            },
            success: (res) => {
              wx.hideLoading();
              if (res.statusCode === 200) {
                // Clear chat messages if currently viewing this friend
                if (this.data.selectedUser && this.data.selectedUser.id === friendId) {
                  this.setData({
                    chatMessages: []
                  });
                }
                
                // Update last message in friends list
                const updatedFriends = this.data.friends.map(f => {
                  if (f.id === friendId) {
                    return { ...f, lastMessage: null, unreadCount: 0 };
                  }
                  return f;
                });
                
                const updatedFilteredFriends = this.data.filteredFriends.map(f => {
                  if (f.id === friendId) {
                    return { ...f, lastMessage: null, unreadCount: 0 };
                  }
                  return f;
                });
                
                this.setData({
                  friends: updatedFriends,
                  filteredFriends: updatedFilteredFriends
                });
                
                wx.showToast({
                  title: "聊天记录已删除",
                  icon: "success"
                });
              } else {
                wx.showToast({
                  title: "删除失败",
                  icon: "none"
                });
              }
            },
            fail: () => {
              wx.hideLoading();
              wx.showToast({
                title: "网络错误",
                icon: "none"
              });
            }
          });
        }
      }
    });
  },
});
