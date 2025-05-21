// avatar.js
Component({
  properties: {
    // Image URL for avatar
    avatar: {
      type: String,
      value: ''
    },
    // Name for displaying initials when no avatar image
    name: {
      type: String,
      value: ''
    },
    // Custom size for the avatar (in rpx)
    size: {
      type: Number,
      value: 50
    }
  },
  
  data: {
    fontSize: 16,
    initial: ''
  },
  
  lifetimes: {
    attached() {
      // Get initial from name when component is attached
      const initial = this.properties.name?.[0]?.toUpperCase() || '';
      this.setData({ initial });
      
      // Calculate and set font size based on container dimensions
      this.updateFontSize();
    }
  },
  
  observers: {
    'name': function(name) {
      // Update initial when name changes
      const initial = name?.[0]?.toUpperCase() || '';
      this.setData({ initial });
    },
    'size': function(size) {
      // Update font size when container size changes
      this.updateFontSize();
    }
  },
  
  methods: {
    updateFontSize() {
      // Calculate font size based on container size
      // In WeChat, we use the size property directly instead of getting DOM element size
      const fontSize = this.properties.size * 0.8;
      this.setData({ fontSize });
    }
  }
})