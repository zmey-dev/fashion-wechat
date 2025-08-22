// components/post-info-overlay/post-info-overlay.js
Component({
  properties: {
    currentPost: { type: Object, value: {} },
    displayTitle: { type: String, value: "" },
    displayContent: { type: String, value: "" }
  },
  
  data: {
    isExpanded: false,
    showExpandIndicator: false,
    fullContent: '',
    truncatedContent: ''
  },
  
  observers: {
    'displayContent': function(content) {
      if (!content) {
        this.setData({
          fullContent: '',
          truncatedContent: '',
          showExpandIndicator: false,
          isExpanded: false
        });
        return;
      }
      
      // Store full content
      const fullContent = content;
      
      // Create truncated version (approximately 3 lines worth)
      const maxLength = 80; // Adjust based on your needs
      let truncatedContent = content;
      
      if (content.length > maxLength) {
        truncatedContent = content.substring(0, maxLength) + '...';
        this.setData({
          showExpandIndicator: true,
          fullContent: fullContent,
          truncatedContent: truncatedContent
        });
      } else {
        this.setData({
          showExpandIndicator: false,
          fullContent: fullContent,
          truncatedContent: fullContent,
          isExpanded: false
        });
      }
    }
  },
  
  methods: {
    toggleExpand() {
      this.setData({
        isExpanded: !this.data.isExpanded
      });
    },
    
    onTouchMove(e) {
      // When expanded, prevent parent's swipe gesture
      // This stops the event from bubbling up to the media-player
      if (this.data.isExpanded) {
        // Do nothing, just catch the event to prevent propagation
        return;
      }
    }
  }
});