// services/socket.js
/**
 * WebSocket service for real-time communication
 */
import config from '../config';

const SOCKET_URL = config.SOCKET_SERVER_URL;
let socketTask = null;
let reconnectTimer = null;
let isConnected = false;
let messageListeners = [];
let token = '';

/**
 * Initialize WebSocket connection
 */
const connectSocket = () => {
  if (socketTask) {
    return;
  }
  
  token = wx.getStorageSync('token');
  if (!token) {
    console.log('Socket: No token available for socket connection');
    return;
  }
  
  socketTask = wx.connectSocket({
    url: `${SOCKET_URL}?token=${token}`,
    success: () => {
      console.log('Socket: Connection established');
    },
    fail: (err) => {
      console.error('Socket: Connection failed', err);
      scheduleReconnect();
    }
  });
  
  socketTask.onOpen(() => {
    console.log('Socket: Connection opened');
    isConnected = true;
    clearReconnectTimer();
  });
  
  socketTask.onClose(() => {
    console.log('Socket: Connection closed');
    isConnected = false;
    socketTask = null;
    scheduleReconnect();
  });
  
  socketTask.onError((err) => {
    console.error('Socket: Error', err);
    isConnected = false;
    socketTask = null;
    scheduleReconnect();
  });
  
  socketTask.onMessage((res) => {
    try {
      const data = JSON.parse(res.data);
      console.log('Socket: Message received', data);
      
      // Notify all listeners
      messageListeners.forEach(listener => {
        listener(data);
      });
      
    } catch (err) {
      console.error('Socket: Failed to parse message', err);
    }
  });
};

/**
 * Schedule reconnection
 */
const scheduleReconnect = () => {
  if (reconnectTimer) {
    return;
  }
  
  console.log('Socket: Scheduling reconnect');
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectSocket();
  }, 5000);
};

/**
 * Clear reconnection timer
 */
const clearReconnectTimer = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
};

/**
 * Add message listener
 * @param {Function} listener - Message listener function
 * @returns {Function} - Function to remove listener
 */
const addMessageListener = (listener) => {
  messageListeners.push(listener);
  
  return () => {
    messageListeners = messageListeners.filter(l => l !== listener);
  };
};

/**
 * Send message via WebSocket
 * @param {Object} data - Message data
 * @returns {Boolean} - Whether the message was sent
 */
const sendMessage = (data) => {
  if (!socketTask || !isConnected) {
    console.error('Socket: Cannot send message, socket not connected');
    return false;
  }
  
  try {
    socketTask.send({
      data: JSON.stringify(data),
      success: () => {
        console.log('Socket: Message sent', data);
      },
      fail: (err) => {
        console.error('Socket: Failed to send message', err);
      }
    });
    return true;
  } catch (err) {
    console.error('Socket: Error sending message', err);
    return false;
  }
};

/**
 * Disconnect WebSocket
 */
const disconnectSocket = () => {
  if (socketTask && isConnected) {
    console.log('Socket: Disconnecting');
    socketTask.close({
      success: () => {
        console.log('Socket: Disconnected successfully');
      },
      fail: (err) => {
        console.error('Socket: Failed to disconnect', err);
      }
    });
  }
  
  isConnected = false;
  socketTask = null;
  clearReconnectTimer();
  messageListeners = [];
};

module.exports = {
  connectSocket,
  disconnectSocket,
  addMessageListener,
  sendMessage,
  isConnected: () => isConnected
};