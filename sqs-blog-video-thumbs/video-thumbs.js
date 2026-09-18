/* Video Thumbnails — Guide Me Social portfolio */
(function () {
  'use strict';

  /* ── SETTINGS ── */
  var CONFIG = {
    itemSelector: 'article.blog-item',   // each post card in the list
    visibleRatio: 0.35,                  // how much of a card must be on screen to play
    fetchAhead: '600px 0px',             // look up posts this far before they scroll into view
    releaseAfter: 15000,                 // free a video this long after it leaves the screen (ms)
    loopVideos: true,                    // keep each video looping while it's on screen
    debug: false                         // true = log each post lookup to the console
  };

  var ICONS = {
    play:  '<svg class="ss-vt-i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.2v13.6L19 12z" fill="currentColor"/></svg>',
    pause: '<svg class="ss-vt-i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>',
    muted: '<svg class="ss-vt-i-muted" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
    sound: '<svg class="ss-vt-i-sound" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>'
  };

  function log() { if (CONFIG.debug) console.warn.apply(console, ['[Video Thumbnails]'].concat([].slice.call(arguments))); }

  function init() {
    var first = document.querySelector(CONFIG.itemSelector + ' a.image-wrapper');
    if (!first) { log('No blog cards found on this page'); return; }

    var cards = [];
    var byLink = new WeakMap();
    var soundCard = null;   // the one card allowed to play sound
    var rafId = 0;

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var saveData = !!(navigator.connection && navigator.connection.saveData);
    var autoplay = !reduced && !saveData;

    /* ── Look up each post's .mp4 ── */
    var VIDEO_FILE = /[^"'\s()<>]+\.(mp4|webm|mov)(\?[^"'\s()<>]*)?/i;

    function findInHtml(html, base) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var el = doc.querySelector('[data-thumb-video]');
      var url = el && el.getAttribute('data-thumb-video');
      if (!url) { el = doc.querySelector('video[src], video source[src]'); url = el && el.getAttribute('src'); }
      if (!url) { el = doc.querySelector('a[href*=".mp4"], a[href*=".webm"], a[href*=".mov"]'); url = el && el.getAttribute('href'); }
      if (!url) { var m = html.match(VIDEO_FILE); url = m && m[0]; }
      if (!url) return null;
      try { return new URL(url.replace(/&amp;/g, '&'), base).href; } catch (err) { return null; }
    }

    function findVideo(href) {
      var base = href.split('#')[0];
      var url = base + (base.indexOf('?') > -1 ? '&' : '?') + 'format=json';
      return fetch(url, { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.text() : ''; })
        .then(function (text) {
          var body = '';
          try { body = JSON.parse(text).item.body || ''; } catch (err) {}
          return findInHtml(body, base);
        });
    }

    function resolve(card) {
      if (!card || card.lookup) return;
      card.lookup = findVideo(card.href)
        .then(function (src) {
          card.src = src;
          log(card.href, '→', src || 'no .mp4 found in this post');
          if (!src) return;
          build(card);
          if (card.visible) playCard(card);
        })
        .catch(function (err) { card.src = null; log(card.href, '→ lookup failed', err); });
    }

    /* ── Playback ── */
    function playCard(card, retried) {
      if (!card.video || !card.src || card.userPaused || !autoplay && !card.userStarted) return;
      if (!card.video.getAttribute('src')) card.video.src = card.src;
      clearTimeout(card.releaseTimer);
      card.host.classList.add('is-loading');
      var p = card.video.play();
      if (p && p.catch) p.catch(function (err) {
        card.host.classList.remove('is-loading');
        if (!card.video.muted && !retried) { setSound(null); playCard(card, true); return; }
        log('Could not play', card.href, err && err.name);
      });
    }

    function pauseCard(card) {
      if (!card.video) return;
      card.video.pause();
      clearTimeout(card.releaseTimer);
      card.releaseTimer = setTimeout(function () {
        if (card.visible || card === soundCard) return;
        card.video.removeAttribute('src');
        card.video.load();
        card.host.classList.remove('is-started');
        card.bar.style.transform = 'scaleX(0)';
      }, CONFIG.releaseAfter);
    }

    // Only one card may have sound; pass null to mute everything
    function setSound(card) {
      soundCard = card;
      cards.forEach(function (c) {
        if (c.video) c.video.muted = c !== card;
        c.host.classList.toggle('is-sound-on', c === card);
        sync(c);
      });
    }

    function sync(card) {
      if (!card.playBtn) return;
      var playing = card.video && !card.video.paused;
      card.host.classList.toggle('is-playing', !!playing);
      card.playBtn.setAttribute('aria-label', (playing ? 'Pause video: ' : 'Play video: ') + card.title);
      card.soundBtn.setAttribute('aria-label', card === soundCard ? 'Mute video' : 'Unmute video');
    }

    function startTicker() {
      if (rafId) return;
      rafId = requestAnimationFrame(function tick() {
        var running = false;
        for (var i = 0; i < cards.length; i++) {
          var c = cards[i];
          if (!c.video || c.video.paused) continue;
          running = true;
          var d = c.video.duration;
          if (d && isFinite(d)) c.bar.style.transform = 'scaleX(' + (c.video.currentTime / d) + ')';
        }
        rafId = running ? requestAnimationFrame(tick) : 0;
      });
    }

    function build(card) {
      var titleEl = card.article.querySelector('.blog-title');
      card.title = ((titleEl && titleEl.textContent) || 'project').trim();
      var link = card.link;
      card.host.classList.add('ss-video-thumbs');

      var v = document.createElement('video');
      v.className = 'ss-vt-video';
      v.muted = true;
      v.defaultMuted = true;
      v.playsInline = true;
      v.loop = CONFIG.loopVideos;
      v.setAttribute('muted', '');
      v.setAttribute('playsinline', '');
      v.setAttribute('preload', 'none');
      v.setAttribute('disablepictureinpicture', '');
      v.setAttribute('disableremoteplayback', '');
      v.setAttribute('aria-hidden', 'true');
      link.appendChild(v);
      card.video = v;

      // Thumbnail no longer opens the post; hover and the buttons still work
      link.addEventListener('click', function (e) { e.preventDefault(); });
      link.setAttribute('tabindex', '-1');
      link.style.cursor = 'default';

      var ui = document.createElement('div');
      ui.className = 'ss-vt-ui';
      ui.innerHTML =
        '<button type="button" class="ss-vt-btn ss-vt-play">' + ICONS.play + ICONS.pause + '</button>' +
        '<button type="button" class="ss-vt-btn ss-vt-sound">' + ICONS.muted + ICONS.sound + '</button>' +
        '<div class="ss-vt-track" aria-hidden="true"><div class="ss-vt-bar"></div></div>';
      link.insertAdjacentElement('afterend', ui);
      card.ui = ui;

      // Keep the controls layer sitting exactly over the thumbnail
      function place() {
        ui.style.top = link.offsetTop + 'px';
        ui.style.left = link.offsetLeft + 'px';
        ui.style.width = link.offsetWidth + 'px';
        ui.style.height = link.offsetHeight + 'px';
      }
      place();
      if (window.ResizeObserver) {
        var ro = new ResizeObserver(place);
        ro.observe(link);
        ro.observe(card.host);
      } else {
        window.addEventListener('resize', place);
      }

      // Hover state shared by the thumbnail and its buttons
      function inside(node) { return node && (link.contains(node) || ui.contains(node)); }
      [link, ui].forEach(function (el) {
        el.addEventListener('mouseenter', function () { card.host.classList.add('is-hover'); });
        el.addEventListener('mouseleave', function (e) {
          if (!inside(e.relatedTarget)) card.host.classList.remove('is-hover');
        });
      });

      card.playBtn = ui.querySelector('.ss-vt-play');
      card.soundBtn = ui.querySelector('.ss-vt-sound');
      card.bar = ui.querySelector('.ss-vt-bar');
      sync(card);

      card.playBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (!v.paused) {
          card.userPaused = true;   // stays paused until they press play again
          v.pause();
          return;
        }
        card.userPaused = false;
        card.userStarted = true;
        playCard(card);
      });

      card.soundBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        setSound(card === soundCard ? null : card);
        if (card !== soundCard) return;
        card.userPaused = false;
        card.userStarted = true;
        playCard(card);
      });

      v.addEventListener('playing', function () {
        card.host.classList.add('is-started');
        card.host.classList.remove('is-loading');
        sync(card);
        startTicker();
      });
      v.addEventListener('pause', function () { sync(card); });
      v.addEventListener('waiting', function () { card.host.classList.add('is-loading'); });
      v.addEventListener('canplay', function () { card.host.classList.remove('is-loading'); });
      v.addEventListener('error', function () {
        if (!v.getAttribute('src')) return;
        log('Video file failed to load', card.src);
        card.host.classList.remove('is-started', 'is-loading');
      });
    }

    /* ── Observe cards ── */
    var fetchIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        fetchIO.unobserve(e.target);
        resolve(byLink.get(e.target));
      });
    }, { rootMargin: CONFIG.fetchAhead });

    var viewIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var card = byLink.get(e.target);
        if (!card) return;
        card.visible = e.intersectionRatio >= CONFIG.visibleRatio;
        if (!card.src) return;
        if (card.visible) playCard(card);
        else if (card !== soundCard) pauseCard(card);
      });
    }, { threshold: [0, CONFIG.visibleRatio] });

    function setup(article) {
      if (article.hasAttribute('data-ss-vt')) return;
      var link = article.querySelector('a.image-wrapper');
      if (!link || !link.parentElement) return;
      article.setAttribute('data-ss-vt', '');
      var card = { article: article, host: link.parentElement, link: link, href: link.href, src: null, visible: false };
      cards.push(card);
      byLink.set(link, card);
      fetchIO.observe(link);
      viewIO.observe(link);
    }

    function scan() { document.querySelectorAll(CONFIG.itemSelector).forEach(setup); }

    scan();
    log(cards.length + ' card(s) found');
    // Infinite scroll / load more appends new posts to the same list
    new MutationObserver(scan).observe(first.closest(CONFIG.itemSelector).parentElement, { childList: true });

    document.addEventListener('visibilitychange', function () {
      cards.forEach(function (card) {
        if (!card.video || !card.src) return;
        if (document.hidden) card.video.pause();
        else if (card.visible) playCard(card);
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
