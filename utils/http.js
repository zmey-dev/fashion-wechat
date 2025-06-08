// utils/http.js

const { default: config } = require("../config");

/**
 * HTTP request utility for WeChat Mini App
 */
const BASE_URL = config.BACKEND_URL;

const request = (url, method = 'GET', data = null, auth = true) => {
  return new Promise((resolve, reject) => {
    const header = {};
    
    // Add auth token if needed
    if (auth) {
      const token = getApp().globalData.userInfo?.token ;
      if (token) {
        header['Authorization'] = 'Bearer ' + token;
      }
    }
    
    // Add content type for POST, PUT requests
    if (method === 'POST' || method === 'PUT') {
      header['Content-Type'] = 'application/json';
    }
    
    wx.request({
      url: `${BASE_URL}${url}`,
      method: method,
      data: data,
      header: header,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else if (res.statusCode === 401) {
          // Token expired or invalid, redirect to login
          wx.removeStorageSync('token');
          const app = getApp();
          app.globalData.hasLogin = false;
          app.globalData.userInfo = null;
          
          // Show login modal
          wx.showModal({
            title: '登录已过期',
            content: '请重新登录',
            confirmText: '去登录',
            success: (res) => {
              if (res.confirm) {
                wx.navigateTo({
                  url: '/pages/login/login'
                });
              }
            }
          });
          
          reject(new Error('Unauthorized'));
        } else {
          reject(new Error(res.data.message || 'Request failed'));
        }
      },
      fail: (err) => {
        wx.showToast({
          title: '网络错误',
          icon: 'none'
        });
        reject(err);
      }
    });
  });
};

/**
 * GET request
 * @param {String} url - Request URL
 * @param {Object} params - Query parameters (optional)
 * @param {Boolean} auth - Whether to include auth token (default: true)
 * @returns {Promise} - Promise with response data
 */
const get = (url, params = null, auth = true) => {
  if (params) {
    const queryString = Object.keys(params)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');
    url = `${url}?${queryString}`;
  }
  return request(url, 'GET', null, auth);
};

/**
 * POST request
 * @param {String} url - Request URL
 * @param {Object} data - Request data
 * @param {Boolean} auth - Whether to include auth token (default: true)
 * @returns {Promise} - Promise with response data
 */
const post = (url, data = null, auth = true) => {
  return request(url, 'POST', data, auth);
};

/**
 * PUT request
 * @param {String} url - Request URL
 * @param {Object} data - Request data
 * @param {Boolean} auth - Whether to include auth token (default: true)
 * @returns {Promise} - Promise with response data
 */
const put = (url, data = null, auth = true) => {
  return request(url, 'PUT', data, auth);
};

/**
 * DELETE request
 * @param {String} url - Request URL
 * @param {Boolean} auth - Whether to include auth token (default: true)
 * @returns {Promise} - Promise with response data
 */
const del = (url, auth = true) => {
  return request(url, 'DELETE', null, auth);
};

module.exports = {
  get,
  post,
  put,
  delete: del
};