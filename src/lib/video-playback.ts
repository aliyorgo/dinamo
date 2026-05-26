export function pauseOtherVideos(currentVideo: HTMLVideoElement) {
  document.querySelectorAll('video').forEach(v => {
    if (v !== currentVideo && !v.paused && !(v as HTMLVideoElement).dataset.banner) v.pause()
  })
}
