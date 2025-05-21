// components/custom-dropdown/custom-dropdown.js
Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    position: {
      type: String,
      value: 'bottom' // 'bottom', 'top', 'left', 'right'
    },
    width: {
      type: String,
      value: '240rpx'
    }
  },
  
  data: {
    isOpen: false
  },
  
  lifetimes: {
    attached: function() {
      this.setData({
        isOpen: this.properties.show
      });
    }
  },
  
  observers: {
    'show': function(value) {
      this.setData({
        isOpen: value
      });
    }
  },
  
  methods: {
    toggle: function() {
      const isOpen = !this.data.isOpen;
      this.setData({
        isOpen: isOpen
      });
      this.triggerEvent('toggle', { isOpen });
    },
    
    close: function() {
      this.setData({
        isOpen: false
      });
      this.triggerEvent('toggle', { isOpen: false });
    },
    
    stopPropagation: function(e) {
      // Prevent clicks inside dropdown from closing it
      return false;
    }
  }
});