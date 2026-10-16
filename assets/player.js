(() => {
  "use strict";
  const video = document.getElementById("video");
  const shell = document.getElementById("playerShell");
  const controls = document.getElementById("controls");
  const message = document.getElementById("message");
  const startButton = document.getElementById("startButton");
  const playPause = document.getElementById("playPause");
  const playIcon = document.getElementById("playIcon");
  const muteButton = document.getElementById("mute");
  const volumeIcon = document.getElementById("volumeIcon");
  const volume = document.getElementById("volume");
  const pipButton = document.getElementById("pip");
  const airplayButton = document.getElementById("airplay");
  const fullscreenButton = document.getElementById("fullscreen");
  let player = null;
  let hideControlsTimer = null;

  function channelSlug() {
    const path = window.location.pathname.replace(/^\/+|\/+$/g, "");
    return path && path !== "index.html" ? decodeURIComponent(path.split("/")[0]) : "";
  }
  function showMessage(text) { message.textContent = text; message.hidden = false; }
  function clearMessage() { message.textContent = ""; message.hidden = true; }
  function setPlayIcon(isPlaying) {
    playIcon.setAttribute("d", isPlaying ? "M6 5h4v14H6zM14 5h4v14h-4z" : "M8 5v14l11-7z");
    playPause.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
  }
  function setVolumeIcon() {
    if (video.muted || video.volume === 0) {
      volumeIcon.setAttribute("d", "M3 9v6h4l5 4V5L7 9H3zm13.59 3 2.12 2.12-1.42 1.42L15.17 13.4l-2.12 2.12-1.42-1.42L13.75 12l-2.12-2.12 1.42-1.42 2.12 2.12 2.12-2.12 1.42 1.42L16.59 12z");
    } else {
      volumeIcon.setAttribute("d", "M3 9v6h4l5 4V5L7 9H3zm13.5 3a3.5 3.5 0 0 0-2-3.16v6.32a3.5 3.5 0 0 0 2-3.16zM14.5 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z");
    }
    muteButton.setAttribute("aria-label", video.muted || video.volume === 0 ? "Unmute" : "Mute");
  }
  function showControls() {
    shell.classList.remove("controls-hidden");
    clearTimeout(hideControlsTimer);
    if (!video.paused) hideControlsTimer = setTimeout(() => shell.classList.add("controls-hidden"), 2800);
  }
  function destroyPlayer() {
    if (!player) return;
    try { player.pause(); } catch (_) {}
    try { player.unload(); } catch (_) {}
    try { player.detachMediaElement(); } catch (_) {}
    try { player.destroy(); } catch (_) {}
    player = null;
  }
  async function loadChannel() {
    const slug = channelSlug();
    if (!slug) {
      showMessage("Open a channel link, for example /abc.");
      return;
    }
    try {
      const response = await fetch(`/api/channel?name=${encodeURIComponent(slug)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(data.error || "Channel not found.");
      await startPlayback(data.url);
    } catch (error) {
      console.error("Channel lookup failed:", error);
      showMessage(error.message || "Unable to load this channel.");
    }
  }
  async function startPlayback(url) {
    clearMessage();
    startButton.hidden = true;
    if (!window.mpegts || !window.mpegts.isSupported()) {
      showMessage("MPEG-TS playback is not supported by this browser.");
      startButton.hidden = false;
      return;
    }
    destroyPlayer();
    video.removeAttribute("src");
    video.load();
    try {
      player = window.mpegts.createPlayer({ type: "mpegts", isLive: true, url }, {
        enableWorker: true,
        enableStashBuffer: true,
        stashInitialSize: 128,
        lazyLoad: false,
        liveBufferLatencyChasing: true,
        liveBufferLatencyMaxLatency: 3,
        liveBufferLatencyMinRemain: 0.5,
        autoCleanupSourceBuffer: true,
        autoCleanupMaxBackwardDuration: 30,
        autoCleanupMinBackwardDuration: 15
      });
      player.attachMediaElement(video);
      player.on(window.mpegts.Events.ERROR, (type, detail, info) => {
        console.error("MPEG-TS playback error:", type, detail, info || "");
        showMessage("Playback error. Press play to retry.");
        startButton.hidden = false;
      });
      player.on(window.mpegts.Events.LOADING_COMPLETE, () => {
        showMessage("Stream ended.");
        startButton.hidden = false;
      });
      player.load();
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => { startButton.hidden = false; startButton.textContent = "Tap to play"; });
      }
    } catch (error) {
      console.error("Unable to start MPEG-TS player:", error);
      showMessage("Unable to start playback.");
      startButton.hidden = false;
    }
  }
  playPause.addEventListener("click", async () => {
    if (video.paused) {
      if (!player) await loadChannel();
      else { try { await video.play(); } catch (_) { startButton.hidden = false; } }
    } else video.pause();
    showControls();
  });
  startButton.addEventListener("click", async () => {
    if (!player) await loadChannel();
    else { clearMessage(); try { await video.play(); } catch (_) {} }
    showControls();
  });
  muteButton.addEventListener("click", () => {
    video.muted = !video.muted;
    if (!video.muted && video.volume === 0) video.volume = 0.5;
    volume.value = String(video.volume);
    setVolumeIcon();
    showControls();
  });
  volume.addEventListener("input", () => { video.volume = Number(volume.value); video.muted = video.volume === 0; setVolumeIcon(); });
  fullscreenButton.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (shell.requestFullscreen) await shell.requestFullscreen();
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
    } catch (error) { console.warn("Fullscreen unavailable:", error); }
    showControls();
  });
  pipButton.addEventListener("click", async () => {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else if (document.pictureInPictureEnabled && video.requestPictureInPicture) await video.requestPictureInPicture();
    } catch (error) { console.warn("Picture-in-picture unavailable:", error); }
    showControls();
  });
  airplayButton.addEventListener("click", () => {
    try {
      if (video.webkitShowPlaybackTargetPicker) video.webkitShowPlaybackTargetPicker();
      else showMessage("AirPlay is not supported in this browser.");
    } catch (error) { console.warn("AirPlay unavailable:", error); }
    showControls();
  });
  video.addEventListener("play", () => { setPlayIcon(true); clearMessage(); showControls(); });
  video.addEventListener("pause", () => { setPlayIcon(false); shell.classList.remove("controls-hidden"); });
  video.addEventListener("playing", () => { clearMessage(); startButton.hidden = true; showControls(); });
  video.addEventListener("waiting", () => {});
  video.addEventListener("volumechange", setVolumeIcon);
  shell.addEventListener("mousemove", showControls);
  shell.addEventListener("touchstart", showControls, { passive: true });
  controls.addEventListener("mouseenter", () => clearTimeout(hideControlsTimer));
  controls.addEventListener("mouseleave", showControls);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !video.paused) showControls(); });
  window.addEventListener("pagehide", destroyPlayer);
  video.muted = true;
  volume.value = "1";
  setVolumeIcon();
  setPlayIcon(false);
  loadChannel();
})();
