// Explicit banker/player video lifecycle. DragonFx still owns thresholds, result timing and exit timing.
(function () {
  'use strict';
  const video = document.getElementById('dragonVideo');
  const overlay = document.getElementById('dragonOverlay');
  if (!video || !overlay) return;

  let generation = 0;
  let playbackColor = null;
  let startupTimer = null;
  let unbind = null;

  function clearStartup() {
    clearTimeout(startupTimer);
    startupTimer = null;
  }

  function stop(keepFrame = false) {
    generation++;
    clearStartup();
    if (unbind) { unbind(); unbind = null; }
    video.pause();
    overlay.classList.remove('dragon-video-exit');
    if (!keepFrame) {
      playbackColor = null;
      overlay.classList.remove('dragon-video-mode');
      if (video.hasAttribute('src')) {
        video.removeAttribute('src');
        video.load();
      }
    }
  }

  function play(color, onEnded, onFallback) {
    stop();
    const src = color === 'B' ? video.dataset.bankerSrc : color === 'P' ? video.dataset.playerSrc : null;
    if (!src || !video.canPlayType('video/webm; codecs="vp9"')) return false;
    // The user confirmed this exact historical blue video. Old shared-gold markup
    // must fall back to native blue, never reuse currentSrc or the banker source.
    if (color === 'P' && new URL(src, document.baseURI).href !==
        new URL('特效/dragon-long-v2.webm', document.baseURI).href) return false;
    playbackColor = color;
    const run = generation;
    const sideClass = color === 'P' ? 'player-dragon-overlay' : 'banker-dragon-overlay';
    const otherClass = color === 'P' ? 'banker-dragon-overlay' : 'player-dragon-overlay';
    const current = () => run === generation &&
      overlay.classList.contains('active') &&
      overlay.classList.contains(sideClass) &&
      !overlay.classList.contains(otherClass);

    function fallback() {
      if (!current()) return;
      stop();
      onFallback();
    }
    function playing() {
      if (!current()) return;
      clearStartup();
      overlay.classList.add('dragon-video-mode');
    }
    function setSpeed() {
      if (!current()) return;
      // Banker video is already cut to 6 seconds; player keeps the 5.5-second rule.
      video.playbackRate = color === 'P' && Number.isFinite(video.duration) && video.duration > 0
        ? video.duration / 5.5 : 1;
    }
    function timeupdate() {
      // The banker clip ends with the dragon still at the right edge: slide it out on the page.
      if (!current() || color !== 'B' || !Number.isFinite(video.duration)) return;
      if (video.duration - video.currentTime <= 0.8) overlay.classList.add('dragon-video-exit');
    }
    function ended() {
      if (current() && video.ended) onEnded();
    }
    function waiting() {
      if (!current()) return;
      clearStartup();
      startupTimer = setTimeout(fallback, 6000);
    }
    const mediaError = () => { if (video.error) fallback(); };
    const handlers = { loadedmetadata: setSpeed, timeupdate, playing, ended, error: mediaError, waiting, stalled: waiting };
    for (const [type, listener] of Object.entries(handlers)) video.addEventListener(type, listener);
    unbind = () => {
      for (const [type, listener] of Object.entries(handlers)) video.removeEventListener(type, listener);
    };
    video.muted = true;
    video.playsInline = true;
    video.loop = false;
    video.playbackRate = 1;
    video.src = src;
    startupTimer = setTimeout(fallback, 6000);
    try {
      const pending = video.play();
      if (pending && typeof pending.catch === 'function') pending.catch(fallback);
    } catch (_) {
      fallback();
    }
    return true;
  }

  window.BaccaratDragonVideo = { play, stop };
  new MutationObserver(() => {
    // Defensive cleanup for external dismissal; retain the last frame through the native fade.
    const sideClass = playbackColor === 'P' ? 'player-dragon-overlay' : 'banker-dragon-overlay';
    if ((playbackColor && !overlay.classList.contains(sideClass)) ||
        (!overlay.classList.contains('active') && !overlay.classList.contains('fading-out'))) {
      if (video.hasAttribute('src') || overlay.classList.contains('dragon-video-mode')) stop();
    }
  }).observe(overlay, { attributes: true, attributeFilter: ['class'] });
})();
