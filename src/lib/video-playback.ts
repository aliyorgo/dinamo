export function pauseOtherVideos(currentVideo: HTMLVideoElement) {
  document.querySelectorAll('video').forEach(v => {
    if (v !== currentVideo && !v.paused) v.pause()
  })
}
