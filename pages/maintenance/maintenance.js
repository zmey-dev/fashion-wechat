const maintenanceService = require('../../utils/maintenanceService');

Page({
  data: {
    maintenanceInfo: {
      message: '系统维护中',
      description: '系统正在维护，请稍后再试',
      timeRange: '维护时间待定'
    }
  },

  onLoad: function() {
    this.checkMaintenanceStatus();
  },

  onShow: function() {
    // Check status again when page shows
    this.checkMaintenanceStatus();
  },

  onUnload: function() {
    // Stop auto-checking when page unloads
    maintenanceService.stopAutoCheck();
  },

  async checkMaintenanceStatus() {
    const status = await maintenanceService.checkMaintenanceStatus();

    if (!status.isMaintenanceMode) {
      // If not in maintenance, redirect to home
      wx.reLaunch({
        url: '/pages/index/index'
      });
      return;
    }

    // Update display information
    this.setData({
      maintenanceInfo: {
        message: status.message,
        description: status.description,
        timeRange: maintenanceService.formatTimeRange(status.startTime, status.endTime)
      }
    });

    // Start auto-checking for maintenance end
    maintenanceService.startAutoCheck();
  }
});