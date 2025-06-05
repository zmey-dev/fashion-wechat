// WeChat Socket Manager - Updated with handlers property

const { isEmpty } = require("../utils/isEmpty");

class WeChatSocketManager {
  constructor() {
    this.socketTask = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 3000;
    this.serverUrl = "wss://backend.xiaoshow.com/ws";
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
      console.error('Handler must be a function');
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
          console.error(`Error in ${eventType} handler:`, error);
        }
      });
    }
  }

  connect(userId, token) {
    // Validate input parameters
    if (!userId || !token) {
      console.error("UserId and token are required for connection");
      wx.showToast({
        title: "Connection parameters missing",
        icon: "error",
      });
      return;
    }

    if (this.isConnecting || this.isConnected) {
      console.log("Already connected or connecting");
      return;
    }

    this.userId = userId;
    this.token = token;
    this.isConnecting = true;

    console.log("Connecting to WebSocket server...");

    // Set connection timeout
    this.connectionTimeout = setTimeout(() => {
      console.error("Connection timeout");
      this.isConnecting = false;
      this.handleReconnect();
    }, 10000);

    this.socketTask = wx.connectSocket({
      url: this.serverUrl,
      header: {
        "content-type": "application/json",
      },
      success: () => {
        console.log("WebSocket connection initiated");
      },
      fail: (err) => {
        console.error("WebSocket connection failed:", err);
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
      console.log("WebSocket connected successfully");

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
        console.log("Message received:", message);
        this.handleMessage(message);
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    });

    // Connection error
    this.socketTask.onError((err) => {
      console.error("WebSocket error:", err);
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
      console.log("WebSocket connection closed:", res);
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
    console.log("Joining chat room...");

    this.sendMessage("join", {
      userId: this.userId,
      token: this.token,
      timestamp: new Date().toISOString(),
    });
  }

  // Send message to server with retry mechanism
  sendMessage(eventType, data, retryOnFail = true) {
    if (!this.isConnected || !this.socketTask) {
      console.log("WebSocket is not connected, queuing message");
      
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
        console.log(`Message sent successfully: ${eventType}`, data);
      },
      fail: (err) => {
        console.error(`Failed to send message: ${eventType}`, err);
        
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

    console.log(`Processing ${this.pendingMessages.length} pending messages`);
    
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
      console.error("Message missing event/type property:", message);
      return;
    }

    switch (eventType) {
      case "connected":
        console.log("Connected to server:", data);
        this.triggerHandler("connected", data);
        break;

      case "join_ack":
        console.log("Successfully joined chat room");
        this.triggerHandler("join_ack", data);
        break;

      case "pong":
        console.log("Heartbeat pong received");
        this.triggerHandler("pong", data);
        break;

      case "keepAliveAck":
        console.log("Keep alive acknowledged");
        this.triggerHandler("keepAliveAck", data);
        break;

      case "user_online":
        console.log(`User ${data} came online`);
        this.triggerHandler("user_online", data);
        break;

      case "user_offline":
        console.log(`User ${data} went offline`);
        this.triggerHandler("user_offline", data);
        break;

      case "new_message":
        console.log("New message received:", data);
        this.triggerHandler("new_message", data);
        break;

      case "read_message":
        console.log("Message read notification:", data);
        this.triggerHandler("read_message", data);
        break;

      case "typing_message":
        console.log("User typing:", data);
        this.triggerHandler("typing_message", data);
        break;

      case "add_friend":
        console.log("Friend request received:", data);
        this.triggerHandler("add_friend", data);
        break;

      case "accept_friend":
        console.log("Friend request accepted:", data);
        this.triggerHandler("accept_friend", data);
        break;

      case "decline_friend":
        console.log("Friend request declined:", data);
        this.triggerHandler("decline_friend", data);
        break;

      case "del_friend":
        console.log("Friend deleted:", data);
        this.triggerHandler("del_friend", data);
        break;

      case "new_comment":
        console.log("New comment received:", data);
        this.triggerHandler("new_comment", data);
        break;

      case "update_swear_words":
        console.log("Swear words updated:", data);
        this.triggerHandler("update_swear_words", data);
        break;

      case "force_disconnect":
        console.log("Force disconnect received");
        const app = getApp();
        app.logout();
        this.triggerHandler("force_disconnect", data);
        this.disconnect();
        wx.showModal({
          title: "Connection Notice",
          content: "Your account has been logged in from another device. This connection will be terminated.",
          showCancel: false,
          confirmText: "OK",
        });
        break;

      case "error":
        console.error("Server error:", data);
        this.triggerHandler("error", data);
        break;

      default:
        console.log(`Unknown message type: ${eventType}`, data);
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
        console.log("Max reconnection attempts reached");
        this.triggerHandler("max_reconnect_attempts", { attempts: this.reconnectAttempts });
        
        wx.showModal({
          title: "Connection Failed",
          content: "Unable to connect to the server. Please check your network connection and try again.",
          showCancel: true,
          confirmText: "Retry",
          cancelText: "Cancel",
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
    
    console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
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
      console.error("Receiver ID is required");
      return false;
    }

    if (!message || (typeof message === 'string' && !message.trim())) {
      console.error("Message content is required");
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
      console.error("Receiver ID is required");
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
      console.error("Receiver ID and message ID are required");
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
      console.error("Receiver ID is required");
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
      console.error("Receiver ID is required");
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
      console.error("Receiver ID is required");
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
      console.error("Receiver ID is required");
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
      console.error("Receiver ID and comment are required");
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
    console.log("Disconnecting from WebSocket server...");

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
        reason: "User initiated disconnect",
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
    console.log("Force reconnecting...");
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