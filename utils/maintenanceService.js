const MAINTENANCE_STATUS_URL = 'https://xiaoshow.cn-wlcb.ufileos.com/maintenance.json';
const CHECK_INTERVAL = 60000; // Check every minute
const CACHE_DURATION = 30000; // Cache for 30 seconds

class MaintenanceService {
  constructor() {
    this.lastCheck = null;
    this.cachedStatus = null;
    this.checkTimer = null;
  }

  async checkMaintenanceStatus(forceCheck = false) {
    const now = Date.now();

    // Return cached status if still valid and not forced
    if (!forceCheck && this.cachedStatus && this.lastCheck && (now - this.lastCheck < CACHE_DURATION)) {
      return this.cachedStatus;
    }

    return new Promise((resolve) => {
      wx.request({
        url: MAINTENANCE_STATUS_URL,
        method: 'GET',
        header: {
          'Cache-Control': 'no-cache'
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data) {
            const data = res.data;

            this.cachedStatus = {
              isMaintenanceMode: data.maintenance || false,
              startTime: data.startTime ? new Date(data.startTime) : null,
              endTime: data.endTime ? new Date(data.endTime) : null,
              message: data.message || '系统维护中',
              description: data.description || '系统正在维护，请稍后再试'
            };

            this.lastCheck = now;

            // Auto-check if currently in maintenance
            if (this.cachedStatus.isMaintenanceMode) {
              this.startAutoCheck();
            } else {
              this.stopAutoCheck();
            }

            resolve(this.cachedStatus);
          } else {
            // Return last known status if available
            resolve(this.cachedStatus || {
              isMaintenanceMode: false,
              startTime: null,
              endTime: null,
              message: '',
              description: ''
            });
          }
        },
        fail: (error) => {
          console.error('Error checking maintenance status:', error);

          // Return last known status if available
          resolve(this.cachedStatus || {
            isMaintenanceMode: false,
            startTime: null,
            endTime: null,
            message: '',
            description: ''
          });
        }
      });
    });
  }

  startAutoCheck() {
    if (this.checkTimer) {
      return;
    }

    this.checkTimer = setInterval(async () => {
      const status = await this.checkMaintenanceStatus(true);

      // Get current page
      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1];
      const currentRoute = currentPage ? currentPage.route : '';

      // If maintenance ended, navigate back to index
      if (!status.isMaintenanceMode && currentRoute === 'pages/maintenance/maintenance') {
        wx.reLaunch({
          url: '/pages/index/index'
        });
      }

      // If maintenance started, redirect to maintenance page
      if (status.isMaintenanceMode && currentRoute !== 'pages/maintenance/maintenance') {
        wx.reLaunch({
          url: '/pages/maintenance/maintenance'
        });
      }
    }, CHECK_INTERVAL);
  }

  stopAutoCheck() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  formatTimeRange(startTime, endTime) {
    const options = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    };

    if (startTime && endTime) {
      // Format dates for Chinese locale
      const startStr = `${startTime.getFullYear()}年${String(startTime.getMonth() + 1).padStart(2, '0')}月${String(startTime.getDate()).padStart(2, '0')}日 ${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`;
      const endStr = `${endTime.getFullYear()}年${String(endTime.getMonth() + 1).padStart(2, '0')}月${String(endTime.getDate()).padStart(2, '0')}日 ${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`;

      return `${startStr} 至 ${endStr}`;
    }

    return '维护时间待定';
  }

  // Check maintenance on API error
  async checkOnApiError(error) {
    // Check for network errors or server errors
    if (error && (error.statusCode >= 500 || error.errMsg === 'request:fail')) {
      const status = await this.checkMaintenanceStatus(true);

      if (status.isMaintenanceMode) {
        const pages = getCurrentPages();
        const currentPage = pages[pages.length - 1];
        const currentRoute = currentPage ? currentPage.route : '';

        if (currentRoute !== 'pages/maintenance/maintenance') {
          wx.reLaunch({
            url: '/pages/maintenance/maintenance'
          });
        }

        return true; // Maintenance mode active
      }
    }

    return false; // Not in maintenance mode
  }
}

module.exports = new MaintenanceService();