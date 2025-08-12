// avatar.js
const { getUserDisplayName } = require("../../utils/getUserDisplayName");

Component({
  properties: {
    // Image URL for avatar
    avatar: {
      type: String | null,
      value: "",
    },
    // Name for displaying initials when no avatar image (legacy)
    name: {
      type: String,
      value: "",
    },
    // User object for getting display name based on role
    user: {
      type: Object,
      value: null,
    },
    // Custom size for the avatar (in rpx)
    size: {
      type: Number,
      value: 50,
    },
  },

  data: {
    fontSize: 16,
    initial: "",
  },

  lifetimes: {
    attached() {
      // Get initial from display name when component is attached
      this.updateInitial();
      // Calculate and set font size based on container dimensions
      this.updateFontSize();
    },
  },

  observers: {
    'name, user': function () {
      // Update initial when name or user changes
      this.updateInitial();
    },
    size: function (size) {
      // Update font size when container size changes
      this.updateFontSize();
    },
  },

  methods: {
    updateInitial() {
      let displayName = '';
      
      // Priority: user object > name property
      if (this.properties.user) {
        displayName = getUserDisplayName(this.properties.user);
      } else if (this.properties.name) {
        displayName = this.properties.name;
      }
      
      const initial = displayName?.[0]?.toUpperCase() || "";
      this.setData({ initial });
    },

    updateFontSize() {
      // Calculate font size based on container size
      // In WeChat, we use the size property directly instead of getting DOM element size
      const fontSize = this.properties.size * 0.4; // Reduced from 0.8 to make it smaller
      this.setData({ fontSize });
    },

    handleTap() {
      // Emit tap event with user data
      this.triggerEvent('tap', {
        user: this.properties.user,
        name: this.properties.name
      });
    },
  },
});
