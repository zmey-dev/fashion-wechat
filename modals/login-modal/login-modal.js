// modals/login-modal/login-modal.js
import config from '../../config';
Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    }
  },

  data: {
    username: '',
    password: '',
    isLoading: false,
    errorMessage: '',
    isRegisterMode: false
  },
  
  methods: {
    onInputUsername: function(e) {
      this.setData({
        username: e.detail.value,
        errorMessage: ''
      });
    },
    
    onInputPassword: function(e) {
      this.setData({
        password: e.detail.value,
        errorMessage: ''
      });
    },
    
    toggleMode: function() {
      this.setData({
        isRegisterMode: !this.data.isRegisterMode,
        errorMessage: ''
      });
    },
    
    close: function() {
      this.triggerEvent('close');
      // Reset form after a delay to avoid visual glitches
      setTimeout(() => {
        this.setData({
          username: '',
          password: '',
          errorMessage: '',
          isLoading: false
        });
      }, 300);
    },
    
    submit: function() {
      const { username, password, isRegisterMode } = this.data;
      
      // Validate inputs
      if (!username.trim()) {
        this.setData({ errorMessage: '请输入用户名' });
        return;
      }
      
      if (!password.trim()) {
        this.setData({ errorMessage: '请输入密码' });
        return;
      }
      
      this.setData({ isLoading: true, errorMessage: '' });
      
      const that = this;
      
      // Call API for login or register
      wx.request({
        url: `${config.BACKEND_URL}/auth/${isRegisterMode ? 'register' : 'login'}`,
        method: 'POST',
        data: {
          username: username,
          password: password
        },
        success: function(res) {
          if (res.statusCode === 200) {
            // Store token and user info
            wx.setStorageSync('token', res.data.token);
            
            // Update global user info
            const app = getApp();
            app.globalData.userInfo = res.data.user;
            app.globalData.hasLogin = true;
            
            // Trigger successful login event
            that.triggerEvent('success', { user: res.data.user });
            
            // Close modal
            that.close();
          } else {
            that.setData({
              errorMessage: res.data.msg || '登录失败，请重试',
              isLoading: false
            });
          }
        },
        fail: function() {
          that.setData({
            errorMessage: '网络错误，请重试',
            isLoading: false
          });
        }
      });
    }
  }
});