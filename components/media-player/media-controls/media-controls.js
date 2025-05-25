// components/media-controls/media-controls.js
Component({
  properties: {
    currentPost: { type: Object, value: {} },
    currentMedia: { type: Array, value: [] },
    currentSlideIndex: { type: Number, value: 0 },
    isPlaying: { type: Boolean, value: true },
    isContinue: { type: Boolean, value: true }
  },

  methods: {
    onPlayPause() {
      this.triggerEvent('playpause');
    },

    onContinueToggle(e) {
      this.triggerEvent('continuetoggle', { value: e.detail.value });
    },

    onProgressTap(e) {
      const { index } = e.currentTarget.dataset;
      this.triggerEvent('progresstap', { index });
    }
  }
});
