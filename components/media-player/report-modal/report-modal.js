// components/report-modal/report-modal.js
Component({
  properties: {
    showReportModal: { type: Boolean, value: false }
  },

  data: {
    selectedOption: null
  },

  methods: {
    onCloseReportModal() {
      this.triggerEvent('close');
    },

    onReportOptionSelect(e) {
      const { option } = e.currentTarget.dataset;
      this.setData({ selectedOption: option });
    },

    onSubmitReport() {
      if (!this.data.selectedOption) {
        wx.showToast({
          title: 'Please select a reason',
          icon: 'error'
        });
        return;
      }
      
      this.triggerEvent('submit', { option: this.data.selectedOption });
    }
  }
});