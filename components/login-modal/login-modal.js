const { default: config } = require("../../config");

// components/login-modal/login-modal.js
Component({
  data: {
    loginType: "wechat", // 'wechat', 'email', 'phone'
    email: "",
    phone: "",
    password: "",
    verificationCode: "",
    showPassword: false,
    countdown: 0,
    loading: false,
    emailError: "",
    phoneError: "",
    passwordError: "",
    codeError: "",
  },
  methods: {
    // Close modal
    closeModal() {
      const app = getApp();
      app.setState("showLoginModal", false);
    },

    // Prevent modal close when clicking inside
    preventClose(e) {},

    // Switch login type
    switchLoginType(e) {
      const type = e.currentTarget.dataset.type;
      this.setData({
        loginType: type,
        emailError: "",
        phoneError: "",
        passwordError: "",
        codeError: "",
      });
    },

    // Input handlers
    onEmailInput(e) {
      this.setData({
        email: e.detail.value,
        emailError: "",
      });
    },

    onPhoneInput(e) {
      this.setData({
        phone: e.detail.value,
        phoneError: "",
      });
    },

    onPasswordInput(e) {
      this.setData({
        password: e.detail.value,
        passwordError: "",
      });
    },

    onCodeInput(e) {
      this.setData({
        verificationCode: e.detail.value,
        codeError: "",
      });
    },

    // Toggle password visibility
    togglePassword() {
      console.log("==================");
      
      this.setData({
        showPassword: !this.data.showPassword,
      });
    },

    // Validation methods
    validateEmail(email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    },

    validatePhone(phone) {
      const phoneRegex = /^1[3-9]\d{9}$/;
      return phoneRegex.test(phone);
    },

    // WeChat login
    async wechatLogin() {
      try {
        this.setData({ loading: true });

        // Get WeChat login code
        const loginResult = await this.promiseWrapper(wx.login);

        if (!loginResult.code) {
          throw new Error("Failed to get WeChat login code");
        }

        // Get user info (requires user authorization)
        const userInfoResult = await this.promiseWrapper(wx.getUserProfile, {
          desc: "Login to access personalized features",
        });

        // Send to backend for authentication
        const authResult = await this.requestLogin({
          type: "wechat",
          code: loginResult.code,
          userInfo: userInfoResult.userInfo,
          signature: userInfoResult.signature,
          rawData: userInfoResult.rawData,
        });

        this.handleLoginSuccess(authResult);
      } catch (error) {
        this.handleLoginError("WeChat login failed, please try again");
      } finally {
        this.setData({ loading: false });
      }
    },

    // Email login
    async emailLogin() {
      const { email, password } = this.data;

      // Validation
      if (!email) {
        this.setData({ emailError: "Please enter email address" });
        return;
      }

      if (!this.validateEmail(email)) {
        this.setData({ emailError: "Please enter valid email address" });
        return;
      }

      if (!password) {
        this.setData({ passwordError: "Please enter password" });
        return;
      }

      if (password.length < 6) {
        this.setData({
          passwordError: "Password must be at least 6 characters",
        });
        return;
      }

      try {
        this.setData({ loading: true });

        const authResult = await this.requestLogin({
          email,
          password,
        });
        console.log("Email login result:", authResult);

        this.handleLoginSuccess(authResult);
      } catch (error) {
        this.handleLoginError("Email login failed, please check credentials");
      } finally {
        this.setData({ loading: false });
      }
    },

    // Phone login
    async phoneLogin() {
      const { phone, verificationCode } = this.data;

      // Validation
      if (!phone) {
        this.setData({ phoneError: "Please enter phone number" });
        return;
      }

      if (!this.validatePhone(phone)) {
        this.setData({ phoneError: "Please enter valid phone number" });
        return;
      }

      if (!verificationCode) {
        this.setData({ codeError: "Please enter verification code" });
        return;
      }

      if (verificationCode.length !== 6) {
        this.setData({ codeError: "Verification code must be 6 digits" });
        return;
      }

      try {
        this.setData({ loading: true });

        const authResult = await this.requestLogin({
          type: "phone",
          phone,
          code: verificationCode,
        });

        this.handleLoginSuccess(authResult);
      } catch (error) {
        this.handleLoginError(
          "Phone login failed, please check verification code"
        );
      } finally {
        this.setData({ loading: false });
      }
    },

    // Send verification code
    async sendVerificationCode() {
      const { phone, countdown } = this.data;

      if (!phone) {
        this.setData({ phoneError: "Please enter phone number first" });
        return;
      }

      if (!this.validatePhone(phone)) {
        this.setData({ phoneError: "Please enter valid phone number" });
        return;
      }

      if (countdown > 0) {
        return;
      }

      try {
        await this.requestVerificationCode(phone);

        // Start countdown
        this.startCountdown();

        wx.showToast({
          title: "Verification code sent",
          icon: "success",
        });
      } catch (error) {
        wx.showToast({
          title: "Failed to send code",
          icon: "error",
        });
      }
    },

    // Start countdown timer
    startCountdown() {
      this.setData({ countdown: 60 });

      const timer = setInterval(() => {
        const { countdown } = this.data;
        if (countdown <= 1) {
          clearInterval(timer);
          this.setData({ countdown: 0 });
        } else {
          this.setData({ countdown: countdown - 1 });
        }
      }, 1000);
    },

    // Handle login
    handleLogin() {
      const { loginType } = this.data;

      switch (loginType) {
        case "wechat":
          this.wechatLogin();
          break;
        case "email":
          this.emailLogin();
          break;
        case "phone":
          this.phoneLogin();
          break;
      }
    },

    // Handle successful login
    handleLoginSuccess(result) {
      const app = getApp();
      wx.request({
        url: `${config.BACKEND_URL}/user/get_my_follow_users`,
        method: "GET",
        header: {
          Authorization: result?.user.token
            ? `Bearer ${result?.user.token}`
            : "",
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data) {
            app.setState("followUsers", res.data.users || []);
          } else {
            app.logout();
          }
        },
        fail: (err) => {
          console.error("Error fetching user info:", err);
          app.logout();
        },
      });
      wx.request({
        url: `${config.BACKEND_URL}/user/get_my_followed_users`,
        method: "GET",
        header: {
          Authorization: result?.user.token
            ? `Bearer ${result?.user.token}`
            : "",
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data) {
            app.setState("followedUsers", res.data.users || []);
          } else {
            app.logout();
          }
        },
        fail: (err) => {
          console.error("Error fetching followed users:", err);
          app.logout();
        },
      });
      wx.request({
        url: `${config.BACKEND_URL}/friend/get_friends`,
        method: "GET",
        header: {
          Authorization: result?.user.token
            ? `Bearer ${result?.user.token}`
            : "",
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data) {
            app.setState("friends", res.data.users || []);
          } else {
            app.logout();
          }
        },
        fail: (err) => {
          console.error("Error fetching friends:", err);
          app.logout();
        },
      });
      // Store user data
      wx.setStorageSync("userInfo", result.user);
      // Trigger success event
      this.triggerEvent("loginSuccess", result);
      app.setState("userInfo", result.user);

      // Close modal
      this.closeModal();

      wx.showToast({
        title: "Login successful",
        icon: "success",
      });
    },

    // Handle login error
    handleLoginError(message) {
      wx.showToast({
        title: message,
        icon: "error",
        duration: 3000,
      });
    },

    // API request wrapper
    requestLogin(data) {
      return new Promise((resolve, reject) => {
        wx.request({
          url: `${config.BACKEND_URL}/auth/login`,
          method: "POST",
          data,
          header: {
            "Content-Type": "application/json",
          },
          success: (res) => {
            if (res.statusCode === 200 && res.data.status === "success") {
              resolve(res.data);
            } else {
              reject(new Error(res.data.message || "Login failed"));
            }
          },
          fail: reject,
        });
      });
    },

    // Request verification code
    requestVerificationCode(phone) {
      return new Promise((resolve, reject) => {
        wx.request({
          url: "https://your-api-domain.com/auth/send-code",
          method: "POST",
          data: { phone },
          header: {
            "Content-Type": "application/json",
          },
          success: (res) => {
            if (res.statusCode === 200 && res.data.success) {
              resolve(res.data);
            } else {
              reject(new Error(res.data.message || "Failed to send code"));
            }
          },
          fail: reject,
        });
      });
    },

    // Promise wrapper for wx APIs
    promiseWrapper(fn, options = {}) {
      return new Promise((resolve, reject) => {
        fn({
          ...options,
          success: resolve,
          fail: reject,
        });
      });
    },
  },
});
