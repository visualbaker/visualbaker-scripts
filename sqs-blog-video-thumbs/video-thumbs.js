/* Video Thumbnails — Guide Me Social portfolio */
(function () {
  'use strict';

  /* ── SETTINGS ── */
  var CONFIG = {
    itemSelector: 'article.blog-item',   // each post card in the list
    loop: true,                          // after the last visible video, start again from the top
    visibleRatio: 0.5,                   // how much of a card must be on screen to autoplay
    fetchAhead: '600px 0px',             // look up posts this far before they scroll into view
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
    var active = null;
    var resumeFrom = null;
    var waiting = true;
    var soundOn = false;
    var userPaused = false;
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

    function getText(url) {
      return fetch(url, { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.text() : ''; });
    }

    function findStream(href) {
      var base = href.split('#')[0];
      return getText(base + (base.indexOf('?') > -1 ? '&' : '?') + 'format=json').then(function (text) {
        var body = '';
        try { body = JSON.parse(text).item.body || ''; } catch (err) {}
        return findInHtml(body, base);
      });
    }

    function resolve(card) {
      if (!card) return Promise.resolve(null);
      if (!card.lookup) {
        card.lookup = findStream(card.href)
          .then(function (src) { card.src = src; log(card.href, '→', src || 'no .mp4 found in this post'); if (src) build(card); return src; })
          .catch(function (err) { card.src = null; log(card.href, '→ lookup failed', err); return null; });
        card.lookup.then(function () { if (waiting && !active) advance(resumeFrom); });
      }
      return card.lookup;
    }

    /* ── Playback ── */
    function attach(card) {
      if (!card.video.getAttribute('src')) card.video.src = card.src;
      return Promise.resolve();
    }

    function tryPlay(v) {
      var p = v.play();
      return p && p.then ? p : Promise.resolve();
    }

    function play(card) {
      if (!card || !card.src) return;
      if (active && active !== card) stop(active);
      active = card;
      card.host.classList.add('is-loading');

      attach(card).then(function () {
        if (active !== card) return;
        var v = card.video;
        v.muted = !soundOn;
        return tryPlay(v).catch(function (err) {
          if (active !== card) return;
          if (!v.muted) {
            // Browser refused audio: fall back to muted playback
            soundOn = false;
            v.muted = true;
            cards.forEach(syncButtons);
            return tryPlay(v);
          }
          throw err;
        });
      }).catch(function (err) {
        if (active !== card) return;
        log('Could not play', card.href, err && err.name);
        stop(card);
        active = null;
        waiting = false; // autoplay blocked: leave the play buttons for visitors
      });
    }

    function stop(card) {
      var v = card.video;
      if (!v) return;
      v.pause();
      try { v.currentTime = 0; } catch (err) {}
      card.host.classList.remove('is-started', 'is-playing', 'is-loading');
      card.bar.style.transform = 'scaleX(0)';
      syncButtons(card);
      setTimeout(function () {
        if (card === active) return;
        v.removeAttribute('src');
        v.load();
      }, 500);
    }

    function finish(card) {
      stop(card);
      if (active === card) active = null;
      resumeFrom = card;
      waiting = true;
      advance(card);
    }

    function advance(from) {
      if (!autoplay || userPaused || document.hidden || active) return;
      var start = from ? cards.indexOf(from) + 1 : 0;
      var order = cards.slice(start);
      if (from && CONFIG.loop) order = order.concat(cards.slice(0, start));
      for (var i = 0; i < order.length; i++) {
        var c = order[i];
        if (!c.visible || c.failed) continue;
        if (c.src === undefined) { waiting = true; resolve(c); return; } // still looking it up
        if (c.src) { waiting = false; play(c); return; }
      }
      waiting = true;
    }

    /* ── UI ── */
    function syncButtons(card) {
      if (!card.playBtn) return;
      var playing = card === active && !card.video.paused;
      card.playBtn.setAttribute('aria-label', (playing ? 'Pause video: ' : 'Play video: ') + card.title);
      card.soundBtn.setAttribute('aria-label', soundOn ? 'Mute video' : 'Unmute video');
      card.host.classList.toggle('is-sound-on', soundOn);
    }

    function startTicker() {
      cancelAnimationFrame(rafId);
      (function tick() {
        var c = active;
        if (!c || c.video.paused) return;
        var d = c.video.duration;
        if (d && isFinite(d)) c.bar.style.transform = 'scaleX(' + (c.video.currentTime / d) + ')';
        rafId = requestAnimationFrame(tick);
      })();
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
      v.setAttribute('muted', '');
      v.setAttribute('playsinline', '');
      v.setAttribute('preload', 'none');
      v.setAttribute('disablepictureinpicture', '');
      v.setAttribute('disableremoteplayback', '');
      v.setAttribute('aria-hidden', 'true');
      link.appendChild(v);
      card.video = v;

      // Thumbnail no longer opens the post; hover and the play button still work
      link.addEventListener('click', function (e) { e.preventDefault(); });
      link.setAttribute('tabindex', '-1');
      link.style.cursor = 'default';

      var ui = document.createElement('div');
      ui.className = 'ss-vt-ui';
      ui.innerHTML =
        '<button type="button" class="ss-vt-btn ss-vt-play">' + ICONS.play + ICONS.pause + '</button>' +
        '<button type="button" class="ss-vt-btn ss-vt-sound">' + ICONS.muted + ICONS.sound +
        '</button>' +
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
      syncButtons(card);

      card.playBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (card === active && !v.paused) {
          userPaused = true; // a manual pause also holds the sequence
          v.pause();
          return;
        }
        userPaused = false;
        waiting = false;
        play(card);
      });

      card.soundBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        soundOn = !soundOn;
        if (active) active.video.muted = !soundOn;
        cards.forEach(syncButtons);
      });

      v.addEventListener('playing', function () {
        if (card !== active) { v.pause(); return; }
        card.host.classList.add('is-started', 'is-playing');
        card.host.classList.remove('is-loading');
        syncButtons(card);
        startTicker();
      });
      v.addEventListener('pause', function () {
        card.host.classList.remove('is-playing');
        syncButtons(card);
      });
      v.addEventListener('waiting', function () { if (card === active) card.host.classList.add('is-loading'); });
      v.addEventListener('canplay', function () { card.host.classList.remove('is-loading'); });
      v.addEventListener('ended', function () { finish(card); });
      v.addEventListener('error', function () {
        if (!v.getAttribute('src')) return;
        log('Video file failed to load', card.src);
        card.failed = true;
        if (active === card) finish(card);
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
        if (card === active && !e.isIntersecting) {
          // Scrolled away: hand off to the first card on screen
          stop(card);
          active = null;
          resumeFrom = null;
          waiting = true;
        }
      });
      if (waiting && !active) advance(resumeFrom);
    }, { threshold: [0, CONFIG.visibleRatio] });

    function setup(article) {
      if (article.hasAttribute('data-ss-vt')) return;
      var link = article.querySelector('a.image-wrapper');
      if (!link || !link.parentElement) return;
      article.setAttribute('data-ss-vt', '');
      var card = { article: article, host: link.parentElement, link: link, href: link.href, src: undefined, visible: false };
      cards.push(card);
      byLink.set(link, card);
      fetchIO.observe(link);
      viewIO.observe(link);
    }

    function scan() {
      document.querySelectorAll(CONFIG.itemSelector).forEach(setup);
      cards.sort(function (a, b) {
        return a.article.compareDocumentPosition(b.article) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });
    }

    scan();
    log(cards.length + ' card(s) found');
    // Infinite scroll / load more appends new posts to the same list
    new MutationObserver(scan).observe(first.closest(CONFIG.itemSelector).parentElement, { childList: true });

    document.addEventListener('visibilitychange', function () {
      if (!active) { if (!document.hidden && waiting) advance(resumeFrom); return; }
      if (document.hidden) {
        active.resume = !active.video.paused;
        active.video.pause();
      } else if (active.resume && !userPaused) {
        play(active);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
