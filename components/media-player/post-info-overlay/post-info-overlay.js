// components/post-info-overlay/post-info-overlay.js
Component({
  properties: {
    currentPost: { type: Object, value: {} },
    displayTitle: { type: String, value: "" },
    displayContent: { type: String, value: "" },
    orientation: { type: String, value: "vertical" }
  },

  data: {
    isExpanded: false,
    fullContent: ''
  },

  observers: {
    'displayContent': function(content) {
      if (!content) {
        this.setData({
          fullContent: '',
          isExpanded: false
        });
        return;
      }

      this.setData({
        fullContent: content
      });
    }
  },

  methods: {
    toggleExpand() {
      this.setData({
        isExpanded: !this.data.isExpanded
      });
    },

    onTouchMove() {
      if (this.data.isExpanded) {
        return;
      }
    }
  }
});