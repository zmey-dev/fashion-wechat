// utils/util.js
/**
 * Common utility functions for WeChat Mini App
 */

/**
 * Format date
 * @param {Date} date - Date object
 * @param {String} format - Format string (yyyy-MM-dd HH:mm:ss)
 * @returns {String} - Formatted date string
 */
const formatDate = (date, format = 'yyyy-MM-dd HH:mm:ss') => {
  if (!date) return '';
  if (typeof date === 'string') {
    date = new Date(date);
  }
  
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();
  
  const formatObj = {
    yyyy: year,
    MM: month.toString().padStart(2, '0'),
    dd: day.toString().padStart(2, '0'),
    HH: hour.toString().padStart(2, '0'),
    mm: minute.toString().padStart(2, '0'),
    ss: second.toString().padStart(2, '0')
  };
  
  return format.replace(/(yyyy|MM|dd|HH|mm|ss)/g, (match) => formatObj[match]);
};

/**
 * Format relative time
 * @param {Date|String} date - Date object or date string
 * @returns {String} - Relative time (e.g. "just now", "5 minutes ago", "2 hours ago", etc.)
 */
const formatRelativeTime = (date) => {
  if (!date) return '';
  if (typeof date === 'string') {
    date = new Date(date);
  }
  
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) {
    return '刚刚';
  } else if (minutes < 60) {
    return `${minutes}分钟前`;
  } else if (hours < 24) {
    return `${hours}小时前`;
  } else if (days < 30) {
    return `${days}天前`;
  } else {
    return formatDate(date, 'yyyy-MM-dd');
  }
};

/**
 * Throttle function
 * @param {Function} fn - Function to throttle
 * @param {Number} delay - Delay in milliseconds
 * @returns {Function} - Throttled function
 */
const throttle = (fn, delay = 500) => {
  let timer = null;
  let lastTime = 0;
  
  return function(...args) {
    const now = Date.now();
    const remaining = delay - (now - lastTime);
    
    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      
      lastTime = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastTime = Date.now();
        timer = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
};

/**
 * Debounce function
 * @param {Function} fn - Function to debounce
 * @param {Number} delay - Delay in milliseconds
 * @returns {Function} - Debounced function
 */
const debounce = (fn, delay = 500) => {
  let timer = null;
  
  return function(...args) {
    if (timer) {
      clearTimeout(timer);
    }
    
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
};

/**
 * Generate unique ID
 * @returns {String} - Unique ID
 */
const generateUniqueId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

module.exports = {
  formatDate,
  formatRelativeTime,
  throttle,
  debounce,
  generateUniqueId
};