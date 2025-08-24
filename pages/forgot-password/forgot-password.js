const config = require('../../config').default;

Page({
  data: {
    // Step management (exact same as web version)
    showForgotPassword: true,
    resetStep: 1, // 1: method selection, 2: code verification, 3: new password
    resetSuccess: false,
    
    // Reset method (exact same as web version)
    resetMethod: "phone", // "phone" or "email"
    
    // Form data (exact same variable names as web version)
    phone: "",
    phoneCode: "",
    emailForReset: "",
    emailCodeForReset: "",
    newPassword: "",
    confirmPassword: "",
    
    // UI states (exact same as web version)
    showPwd: false,
    sendingPhoneCode: false,
    sendingEmailCode: false,
    
    // Countdown timer (exact same as web version)
    countdown: 0,
    isCountdownActive: false,
    countdownTimer: null,
    
    // Error states (exact same as web version)
    errors: {
      phone: "",
      phoneAlert: "",
      email: "",
      emailAlert: "",
      password: ""
    },
    
    // Page title
    pageTitle: '找回密码'
  },

  onLoad() {
    this.initializeFromStorage();
  },

  onUnload() {
    if (this.data.countdownTimer) {
      clearTimeout(this.data.countdownTimer);
    }
  },

  // Initialize countdown state from storage on component mount (same as web)
  initializeFromStorage() {
    try {
      const storedVerificationData = wx.getStorageSync("verificationTimer");
      if (storedVerificationData) {
        const { expiryTime, phoneNumber, emailAddress, isReset, method } = JSON.parse(storedVerificationData);
        const currentTime = new Date().getTime();
        const remainingTime = Math.floor((expiryTime - currentTime) / 1000);

        if (remainingTime > 0) {
          this.setData({
            countdown: remainingTime,
            isCountdownActive: true
          });

          if (method) {
            this.setData({ resetMethod: method });
          }

          if (phoneNumber && method === "phone") {
            this.setData({ phone: phoneNumber });
          }

          if (emailAddress && method === "email") {
            this.setData({ emailForReset: emailAddress });
          }

          if (isReset) {
            this.setData({
              showForgotPassword: true,
              resetStep: 2
            });
          }

          this.startCountdownTimer();
        } else {
          wx.removeStorageSync("verificationTimer");
        }
      }
    } catch (error) {
      console.log('Error loading stored data:', error);
    }
  },

  // Countdown timer effect with storage persistence (same as web)
  startCountdownTimer() {
    if (this.data.countdownTimer) {
      clearTimeout(this.data.countdownTimer);
    }

    const timer = setTimeout(() => {
      if (this.data.countdown > 0) {
        this.setData({
          countdown: this.data.countdown - 1
        });
        this.startCountdownTimer();
      } else {
        this.setData({
          isCountdownActive: false,
          countdownTimer: null
        });
        wx.removeStorageSync("verificationTimer");
      }
    }, 1000);

    this.setData({
      countdownTimer: timer
    });
  },

  // Navigation methods
  goBack() {
    if (this.data.resetStep > 1 && !this.data.resetSuccess) {
      this.goToPreviousStep();
    } else {
      wx.navigateBack();
    }
  },

  goToPreviousStep() {
    if (this.data.resetStep > 1) {
      this.setData({
        resetStep: this.data.resetStep - 1,
        'errors.phone': '',
        'errors.email': '',
        'errors.password': ''
      });
    }
  },

  handleBackToLogin() {
    this.setData({
      showForgotPassword: false,
      resetSuccess: false
    });
    wx.removeStorageSync("verificationTimer");
    wx.navigateBack();
  },

  backToLogin() {
    this.handleBackToLogin();
  },

  // Method selection (same as web)
  switchResetMethod(e) {
    const method = e.currentTarget.dataset.method;
    this.setData({
      resetMethod: method,
      'errors.phone': '',
      'errors.email': '',
      'errors.phoneAlert': '',
      'errors.emailAlert': ''
    });
  },

  // Phone formatting and validation (exact same as web)
  formatPhoneNumber(value) {
    return value.replace(/\D/g, "");
  },

  handlePhoneChange(value) {
    const formattedPhone = this.formatPhoneNumber(value);
    this.setData({
      phone: formattedPhone,
      'errors.phone': ''
    });
  },

  stripSpaces(phoneNumber) {
    return phoneNumber.replace(/\s/g, "");
  },

  ensureCountryCode(phoneNumber) {
    if (!phoneNumber) return phoneNumber;
    
    const cleaned = phoneNumber.replace(/[^\d+]/g, "");
    
    if (cleaned.startsWith('+86')) {
      return cleaned;
    }
    
    if (cleaned.startsWith('86') && cleaned.length === 13) {
      return '+' + cleaned;
    }
    
    if (cleaned.length === 11 && !cleaned.startsWith('86')) {
      return '+86' + cleaned;
    }
    
    return cleaned.startsWith('+86') ? cleaned : '+86' + cleaned.replace(/^\+?86?/, '');
  },

  isPhoneValid() {
    const digitsOnly = this.data.phone.replace(/\D/g, "");
    return digitsOnly.length === 11;
  },

  isEmailValid(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  // Input handlers
  onPhoneInput(e) {
    this.handlePhoneChange(e.detail.value);
  },

  onEmailInput(e) {
    this.setData({
      emailForReset: e.detail.value,
      'errors.email': ''
    });
  },

  onCodeInput(e) {
    this.setData({
      phoneCode: e.detail.value,
      emailCodeForReset: e.detail.value,
      'errors.phone': '',
      'errors.email': ''
    });
  },

  onNewPasswordInput(e) {
    this.setData({
      newPassword: e.detail.value,
      'errors.password': ''
    });
  },

  onConfirmPasswordInput(e) {
    this.setData({
      confirmPassword: e.detail.value,
      'errors.password': ''
    });
  },

  togglePasswordVisibility() {
    this.setData({
      showPwd: !this.data.showPwd
    });
  },

  // Request verification code (exact same API calls as web)
  requestVerificationCode(isReset = false) {
    if (this.data.sendingPhoneCode || this.data.isCountdownActive) return;

    if (!this.isPhoneValid()) {
      this.setData({
        'errors.phone': "请输入完整的11位手机号码"
      });
      return;
    }

    this.setData({
      sendingPhoneCode: true
    });

    const phoneWithoutSpaces = this.stripSpaces(this.data.phone);
    const phoneWithCountryCode = this.ensureCountryCode(phoneWithoutSpaces);

    wx.request({
      url: `${config.BACKEND_URL}/verification/send_phone_sms_code`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json'
      },
      data: {
        phone: phoneWithCountryCode,
        is_login: !isReset,
        is_reset: isReset,
      },
      success: (res) => {
        if (res.data?.status == "success") {
          this.setData({
            'errors.phone': ''
          });

          if (res.data?.alert) {
            this.setData({
              'errors.phoneAlert': res.data.alert
            });
          } else {
            this.setData({
              'errors.phoneAlert': ''
            });

            const countdownSeconds = 60;
            this.setData({
              countdown: countdownSeconds,
              isCountdownActive: true
            });

            const currentTime = new Date().getTime();
            const expiryTime = currentTime + countdownSeconds * 1000;
            wx.setStorageSync("verificationTimer", JSON.stringify({
              expiryTime,
              phoneNumber: this.data.phone,
              isReset,
              method: "phone",
            }));

            this.startCountdownTimer();
          }

          if (isReset) {
            this.setData({
              resetStep: 2
            });
          }
        } else if (res.data?.status == "failed") {
          this.setData({
            'errors.phone': res.data?.error,
            'errors.phoneAlert': ''
          });
        }
      },
      fail: (error) => {
        console.log('Send phone code error:', error);
        this.setData({
          'errors.phone': "网络错误，请检查网络连接"
        });
      },
      complete: () => {
        this.setData({
          sendingPhoneCode: false
        });
      }
    });
  },

  sendPhoneCode() {
    this.requestVerificationCode(true);
  },

  requestEmailVerificationCode(isReset = false) {
    if (this.data.sendingEmailCode || this.data.isCountdownActive) return;

    if (!this.isEmailValid(this.data.emailForReset)) {
      this.setData({
        'errors.email': "请输入有效的电子邮箱地址"
      });
      return;
    }

    this.setData({
      sendingEmailCode: true
    });

    wx.request({
      url: `${config.BACKEND_URL}/verification/send_email_code`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json'
      },
      data: {
        email: this.data.emailForReset,
        is_login: !isReset,
        is_reset: isReset,
      },
      success: (res) => {
        if (res.data?.status == "success") {
          this.setData({
            'errors.email': ''
          });

          if (res.data?.alert) {
            this.setData({
              'errors.emailAlert': res.data.alert
            });
          } else {
            this.setData({
              'errors.emailAlert': ''
            });

            const countdownSeconds = 60;
            this.setData({
              countdown: countdownSeconds,
              isCountdownActive: true
            });

            const currentTime = new Date().getTime();
            const expiryTime = currentTime + countdownSeconds * 1000;
            wx.setStorageSync("verificationTimer", JSON.stringify({
              expiryTime,
              emailAddress: this.data.emailForReset,
              isReset,
              method: "email",
            }));

            this.startCountdownTimer();
          }

          if (isReset) {
            this.setData({
              resetStep: 2
            });
          }
        } else if (res.data?.status == "failed") {
          this.setData({
            'errors.email': res.data?.error,
            'errors.emailAlert': ''
          });
        }
      },
      fail: (error) => {
        console.log('Send email code error:', error);
        this.setData({
          'errors.email': "网络错误，请检查网络连接"
        });
      },
      complete: () => {
        this.setData({
          sendingEmailCode: false
        });
      }
    });
  },

  sendEmailCode() {
    this.requestEmailVerificationCode(true);
  },

  // Verify reset code (exact same as web version)
  handleVerifyResetCode() {
    if (this.data.resetMethod === "phone") {
      if (!this.isPhoneValid()) {
        this.setData({
          'errors.phone': "请输入完整的11位手机号码"
        });
        return;
      }
      if (this.data.phoneCode.length !== 6) {
        this.setData({
          'errors.phone': "请输入正确的验证码"
        });
        return;
      }

      const phoneWithoutSpaces = this.stripSpaces(this.data.phone);
      const phoneWithCountryCode = this.ensureCountryCode(phoneWithoutSpaces);

      wx.request({
        url: `${config.BACKEND_URL}/verification/verify_and_login`,
        method: 'POST',
        header: {
          'Content-Type': 'application/json'
        },
        data: {
          phone: phoneWithCountryCode,
          code: this.data.phoneCode,
          verify_only: true,
        },
        success: (res) => {
          if (res.data.status == "success") {
            this.setData({
              resetStep: 3,
              'errors.phone': ''
            });
          } else if (res.data.status == "failed") {
            this.setData({
              'errors.phone': res.data.error
            });
          }
        },
        fail: (error) => {
          console.log('Verify phone code error:', error);
          this.setData({
            'errors.phone': "验证失败，请重试"
          });
        }
      });
    } else if (this.data.resetMethod === "email") {
      if (!this.isEmailValid(this.data.emailForReset)) {
        this.setData({
          'errors.email': "请输入有效的电子邮箱地址"
        });
        return;
      }
      if (this.data.emailCodeForReset.length !== 6) {
        this.setData({
          'errors.email': "请输入正确的验证码"
        });
        return;
      }

      wx.request({
        url: `${config.BACKEND_URL}/verification/verify_email_code`,
        method: 'POST',
        header: {
          'Content-Type': 'application/json'
        },
        data: {
          email: this.data.emailForReset,
          code: this.data.emailCodeForReset,
        },
        success: (res) => {
          if (res.data.status == "success") {
            this.setData({
              resetStep: 3,
              'errors.email': ''
            });
          } else if (res.data.status == "failed") {
            this.setData({
              'errors.email': res.data.error
            });
          }
        },
        fail: (error) => {
          console.log('Verify email code error:', error);
          this.setData({
            'errors.email': "验证失败，请重试"
          });
        }
      });
    }
  },

  verifyCode() {
    this.handleVerifyResetCode();
  },

  // Reset password (exact same as web version)
  handleResetPassword() {
    if (this.data.newPassword.length < 8) {
      this.setData({
        'errors.password': "密码长度至少为8位"
      });
      return;
    }
    if (this.data.newPassword !== this.data.confirmPassword) {
      this.setData({
        'errors.password': "两次输入的密码不一致"
      });
      return;
    }

    if (this.data.resetMethod === "phone") {
      const phoneWithoutSpaces = this.stripSpaces(this.data.phone);
      const phoneWithCountryCode = this.ensureCountryCode(phoneWithoutSpaces);

      wx.request({
        url: `${config.BACKEND_URL}/verification/reset_password_phone`,
        method: 'POST',
        header: {
          'Content-Type': 'application/json'
        },
        data: {
          phone: phoneWithCountryCode,
          code: this.data.phoneCode,
          new_password: this.data.newPassword,
        },
        success: (res) => {
          if (res.data.status == "success") {
            wx.removeStorageSync("verificationTimer");
            this.setData({
              resetSuccess: true,
              pageTitle: '重置成功'
            });
          } else if (res.data.status == "failed") {
            this.setData({
              'errors.password': res.data.error
            });
          }
        },
        fail: (error) => {
          console.log('Reset password error:', error);
          this.setData({
            'errors.password': "重置密码失败，请重试"
          });
        }
      });
    } else if (this.data.resetMethod === "email") {
      wx.request({
        url: `${config.BACKEND_URL}/verification/reset_password_email`,
        method: 'POST',
        header: {
          'Content-Type': 'application/json'
        },
        data: {
          email: this.data.emailForReset,
          code: this.data.emailCodeForReset,
          new_password: this.data.newPassword,
        },
        success: (res) => {
          if (res.data.status == "success") {
            wx.removeStorageSync("verificationTimer");
            this.setData({
              resetSuccess: true,
              pageTitle: '重置成功'
            });
          } else if (res.data.status == "failed") {
            this.setData({
              'errors.password': res.data.error
            });
          }
        },
        fail: (error) => {
          console.log('Reset password error:', error);
          this.setData({
            'errors.password': "重置密码失败，请重试"
          });
        }
      });
    }
  },

  resetPassword() {
    this.handleResetPassword();
  }
});