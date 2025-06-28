// WeChat Socket Manager - Handles real-time communication

const { isEmpty } = require("../utils/isEmpty");

class WeChatSocketManager {
  constructor() {
    this.socketTask = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 3000;
    this.serverUrl = "wss://backend.xueshow.com/ws";
    this.userId = null;
    this.token = null;
    this.heartbeatInterval = null;
    this.keepAliveInterval = null;
    this.connectionTimeout = null;
    this.isReconnecting = false;
    this.isConnecting = false;
    this.pendingMessages = [];
    this.typingTimeout = null;
    
    this.handlers = new Map();
  }

  on(eventType, handler) {
    if (typeof handler !== 'function') {
      return;
    }
    
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType).push(handler);
  }

  off(eventType, handler) {
    if (this.handlers.has(eventType)) {
      const handlers = this.handlers.get(eventType);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  removeAllHandlers(eventType) {
    if (this.handlers.has(eventType)) {
      this.handlers.delete(eventType);
    }
  }

  triggerHandler(eventType, data) {
    if (this.handlers.has(eventType)) {
      this.handlers.get(eventType).forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          // Handler error occurred
        }
      });
    }
  }

  connect(userId, token) {
    // Validate input parameters
    if (!userId || !token) {
      wx.showToast({
        title: "连接参数缺失",
        icon: "error",
      });
      return;
    }

    if (this.isConnecting || this.isConnected) {
      return;
    }

    this.userId = userId;
    this.token = token;
    this.isConnecting = true;

    // Set connection timeout
    this.connectionTimeout = setTimeout(() => {
      this.isConnecting = false;
      this.handleReconnect();
    }, 10000);

    this.socketTask = wx.connectSocket({
      url: this.serverUrl,
      header: {
        "content-type": "application/json",
      },
      success: () => {
        // WebSocket connection initiated
      },
      fail: (err) => {
        this.isConnecting = false;
        this.clearConnectionTimeout();
        this.handleReconnect();
      },
    });

    this.setupEventListeners();
  }

  // Clear connection timeout
  clearConnectionTimeout() {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }

  setupEventListeners() {
    if (!this.socketTask) return;

    this.socketTask.onOpen(() => {
      this.clearConnectionTimeout();
      this.isConnected = true;
      this.isConnecting = false;
      this.isReconnecting = false;
      this.reconnectAttempts = 0;

      // Join the chat room
      this.joinChat();

      // Start heartbeat and keepAlive
      this.startHeartbeat();
      this.startKeepAlive();

      // Send any pending messages
      this.processPendingMessages();

      // Trigger connected event
      this.triggerHandler("connected", { userId: this.userId });
    });

    // Message received
    this.socketTask.onMessage((res) => {
      try {
        const message = JSON.parse(res.data);
        this.handleMessage(message);
      } catch (error) {
        // Error parsing message
      }
    });

    // Connection error
    this.socketTask.onError((err) => {
      this.isConnected = false;
      this.isConnecting = false;
      this.clearConnectionTimeout();
      this.stopHeartbeat();
      this.stopKeepAlive();
      
      // Trigger error handler
      this.triggerHandler("error", { error: err, type: "connection_error" });
    });

    // Connection closed
    this.socketTask.onClose((res) => {
      this.isConnected = false;
      this.isConnecting = false;
      this.clearConnectionTimeout();
      this.stopHeartbeat();
      this.stopKeepAlive();

      // Trigger disconnected event
      this.triggerHandler("disconnected", { code: res.code, reason: res.reason });

      // Attempt to reconnect if not intentionally closed
      if (res.code !== 1000 && !this.isReconnecting) {
        this.handleReconnect();
      }
    });
  }

  // Join chat room
  joinChat() {
    this.sendMessage("join", {
      userId: this.userId,
      token: this.token,
      timestamp: new Date().toISOString(),
    });
  }

  // Send message to server with retry mechanism
  sendMessage(eventType, data, retryOnFail = true) {
    if (!this.isConnected || !this.socketTask) {
      if (retryOnFail) {
        // Queue message for later sending
        this.pendingMessages.push({ eventType, data, timestamp: Date.now() });
        
        // Limit pending messages to prevent memory issues
        if (this.pendingMessages.length > 100) {
          this.pendingMessages.shift(); // Remove oldest message
        }
      }
      
      return false;
    }

    const message = {
      event: eventType,
      data: data,
    };

    this.socketTask.send({
      data: JSON.stringify(message),
      success: () => {
        // Message sent successfully
      },
      fail: (err) => {
        if (retryOnFail) {
          // Queue message for retry
          this.pendingMessages.push({ eventType, data, timestamp: Date.now() });
        }
      },
    });

    return true;
  }

  // Process pending messages when connection is restored
  processPendingMessages() {
    if (this.pendingMessages.length === 0) return;
    
    // Filter out old messages (older than 5 minutes)
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const validMessages = this.pendingMessages.filter(msg => msg.timestamp > fiveMinutesAgo);
    
    // Send valid pending messages
    validMessages.forEach(({ eventType, data }) => {
      this.sendMessage(eventType, data, false); // Don't retry these again
    });
    
    // Clear pending messages
    this.pendingMessages = [];
  }

  // Handle incoming messages
  handleMessage(message) {
    const eventType = message.event || message.type;
    const data = message.data;

    if (!eventType) {
      return;
    }

    switch (eventType) {
      case "connected":
        this.triggerHandler("connected", data);
        break;

      case "join_ack":
        this.triggerHandler("join_ack", data);
        break;

      case "pong":
        this.triggerHandler("pong", data);
        break;

      case "keepAliveAck":
        this.triggerHandler("keepAliveAck", data);
        break;

      case "user_online":
        this.triggerHandler("user_online", data);
        break;

      case "user_offline":
        this.triggerHandler("user_offline", data);
        break;

      case "new_message":
        this.triggerHandler("new_message", data);
        break;

      case "read_message":
        this.triggerHandler("read_message", data);
        break;

      case "typing_message":
        this.triggerHandler("typing_message", data);
        break;

      case "add_friend":
        this.triggerHandler("add_friend", data);
        break;

      case "accept_friend":
        this.triggerHandler("accept_friend", data);
        break;

      case "decline_friend":
        this.triggerHandler("decline_friend", data);
        break;

      case "del_friend":
        this.triggerHandler("del_friend", data);
        break;

      case "new_comment":
        this.triggerHandler("new_comment", data);
        break;

      case "update_swear_words":
        this.triggerHandler("update_swear_words", data);
        break;

      case "force_disconnect":
        const app = getApp();
        app.logout();
        this.triggerHandler("force_disconnect", data);
        this.disconnect();
        wx.showModal({
          title: "连接通知",
          content: "您的账户已在其他设备登录，当前连接将被终止。",
          showCancel: false,
          confirmText: "确定",
        });
        break;

      case "error":
        this.triggerHandler("error", data);
        break;

      default:
        this.triggerHandler("unknown_message", { eventType, data });
    }
  }

  // Start heartbeat mechanism
  startHeartbeat() {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.sendMessage("ping", {
          timestamp: new Date().toISOString(),
          userId: this.userId
        }, false); // Don't queue heartbeat messages
      }
    }, 30000);
  }

  // Start keepAlive mechanism
  startKeepAlive() {
    this.stopKeepAlive();

    setTimeout(() => {
      this.sendKeepAlive();
      this.keepAliveInterval = setInterval(() => {
        if (this.isConnected) {
          this.sendKeepAlive();
        }
      }, 10000);
    }, 10000);
  }

  // Send keepAlive message
  sendKeepAlive() {
    if (this.isConnected) {
      this.sendMessage("keepAlive", {
        userId: this.userId,
        timestamp: Date.now(),
      }, false); // Don't queue keepAlive messages
    }
  }

  // Stop heartbeat
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Stop keepAlive
  stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  // Handle reconnection with exponential backoff
  handleReconnect() {
    if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.triggerHandler("max_reconnect_attempts", { attempts: this.reconnectAttempts });
        
        wx.showModal({
          title: "连接失败",
          content: "无法连接到服务器，请检查网络连接后重试。",
          showCancel: true,
          confirmText: "重试",
          cancelText: "取消",
          success: (res) => {
            if (res.confirm) {
              this.reconnectAttempts = 0;
              this.connect(this.userId, this.token);
            }
          },
        });
      }
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    
    this.triggerHandler("reconnecting", { 
      attempt: this.reconnectAttempts, 
      maxAttempts: this.maxReconnectAttempts 
    });

    // Exponential backoff
    const delay = Math.min(
      this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      30000
    );

    setTimeout(() => {
      if (!this.isConnected && !isEmpty(getApp().getState("userInfo"))) {
        this.connect(getApp().getState("userInfo").id, getApp().getState("userInfo").token);
      } else {
        this.isReconnecting = false;
      }
    }, delay);
  }

  // Enhanced chat message sending with validation
  sendChatMessage(receiverId, message, messageType = "text") {
    if (!receiverId) {
      return false;
    }

    if (!message || (typeof message === 'string' && !message.trim())) {
      return false;
    }

    const messageData = {
      receiver_id: receiverId,
      message: typeof message === 'string' ? message.trim() : message,
      type: messageType,
      timestamp: new Date().toISOString(),
      sender_id: this.userId,
    };

    return this.sendMessage("new_message", messageData);
  }

  // Send typing indicator with debouncing
  sendTyping(receiverId, isTyping = true) {
    if (!receiverId) {
      return false;
    }

    // Clear previous typing timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    const result = this.sendMessage("typing_message", {
      receiver_id: receiverId,
      is_typing: isTyping,
      sender_id: this.userId,
    });

    // Auto-stop typing after 3 seconds
    if (isTyping && result) {
      this.typingTimeout = setTimeout(() => {
        this.sendTyping(receiverId, false);
      }, 3000);
    }

    return result;
  }

  // Mark message as read
  markMessageAsRead(receiverId, messageId) {
    if (!receiverId || !messageId) {
      return false;
    }

    return this.sendMessage("read_message", {
      receiver_id: receiverId,
      message_id: messageId,
      sender_id: this.userId,
    });
  }

  // Send friend request
  sendFriendRequest(receiverId, message = "") {
    if (!receiverId) {
      return false;
    }

    return this.sendMessage("add_friend", {
      receiver_id: receiverId,
      message: message,
      sender_id: this.userId,
    });
  }

  // Accept friend request
  acceptFriendRequest(receiverId) {
    if (!receiverId) {
      return false;
    }

    return this.sendMessage("accept_friend", {
      receiver_id: receiverId,
      sender_id: this.userId,
    });
  }

  // Decline friend request
  declineFriendRequest(receiverId) {
    if (!receiverId) {
      return false;
    }

    return this.sendMessage("decline_friend", {
      receiver_id: receiverId,
      sender_id: this.userId,
    });
  }

  // Delete friend
  deleteFriend(receiverId) {
    if (!receiverId) {
      return false;
    }

    return this.sendMessage("del_friend", {
      receiver_id: receiverId,
      sender_id: this.userId,
    });
  }

  // Send comment
  sendComment(receiverId, comment, isReply = false) {
    if (!receiverId || !comment) {
      return false;
    }

    return this.sendMessage("new_comment", {
      receiver_id: receiverId,
      comments: comment,
      isReply: isReply,
      sender_id: this.userId,
    });
  }

  // Get connection status
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      userId: this.userId,
      reconnectAttempts: this.reconnectAttempts,
      serverUrl: this.serverUrl,
    };
  }

  // Get socket task
  getSocketTask() {
    return this.socketTask;
  }

  // Disconnect
  disconnect() {
    this.stopHeartbeat();
    this.stopKeepAlive();
    this.clearConnectionTimeout();

    // Clear typing timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }

    if (this.socketTask) {
      this.socketTask.close({
        code: 1000,
        reason: "用户断开连接",
      });
    }

    this.isConnected = false;
    this.isConnecting = false;
    this.isReconnecting = false;
    this.socketTask = null;
    this.reconnectAttempts = 0;
    this.pendingMessages = [];
  }

  // Force reconnect
  forceReconnect() {
    this.disconnect();
    setTimeout(() => {
      if (this.userId && this.token) {
        this.connect(this.userId, this.token);
      }
    }, 1000);
  }
}

// Export for use in other pages
module.exports = {
  socketManager: new WeChatSocketManager(),
};