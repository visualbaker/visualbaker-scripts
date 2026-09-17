/* Blog Tags — Guide Me Social portfolio */
(function () {
  'use strict';

  /* ── SETTINGS ── */
  var CONFIG = {
    itemSelector: 'article.blog-item',  // each post card in the list
    insertAfter: '.blog-excerpt',       // tags go right after this (falls back to the title)
    linkTags: true,                     // true = each tag opens the filtered list
    maxTags: 0                          // 0 = show every tag
  };

  function pathOf(href) {
    try { return new URL(href, location.href).pathname.replace(/\/$/, ''); } catch (err) { return href; }
  }

  function withJson(url) {
    var clean = url.split('#')[0];
    return clean + (clean.indexOf('?') > -1 ? '&' : '?') + 'format=json';
  }

  function getJson(url) {
    return fetch(withJson(url), { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  // Last resort: rebuild names from the card's tag-* classes
  function fromClasses(card) {
    return [].slice.call(card.classList)
      .filter(function (c) { return c.indexOf('tag-') === 0; })
      .map(function (c) {
        return c.slice(4).replace(/-/g, ' ').replace(/\b\w/g, function (l) { return l.toUpperCase(); });
      });
  }

  function init() {
    if (!document.querySelector(CONFIG.itemSelector)) return;

    var tagsByPath = {};
    var listReady = getJson(location.href).then(function (data) {
      ((data && data.items) || []).forEach(function (item) {
        if (item.fullUrl) tagsByPath[pathOf(item.fullUrl)] = item.tags || [];
      });
    });

    function tagsFor(card, href) {
      var path = pathOf(href);
      if (tagsByPath[path]) return Promise.resolve(tagsByPath[path]);
      return getJson(href).then(function (data) {
        return (data && data.item && data.item.tags) || fromClasses(card);
      });
    }

    function render(card, href, tags) {
      if (!tags || !tags.length) return;
      if (CONFIG.maxTags) tags = tags.slice(0, CONFIG.maxTags);
      var base = pathOf(href).replace(/\/[^\/]+$/, '');

      var list = document.createElement('ul');
      list.className = 'ss-blog-tags';
      list.setAttribute('aria-label', 'Tags');

      tags.forEach(function (name) {
        var li = document.createElement('li');
        var tag = document.createElement(CONFIG.linkTags ? 'a' : 'span');
        tag.className = 'ss-bt-tag';
        tag.textContent = name;
        if (CONFIG.linkTags) tag.href = base + '/tag/' + encodeURIComponent(name).replace(/%20/g, '+');
        li.appendChild(tag);
        list.appendChild(li);
      });

      var anchor = card.querySelector(CONFIG.insertAfter) || card.querySelector('.blog-title');
      if (anchor) anchor.insertAdjacentElement('afterend', list);
      else (card.querySelector('.blog-basic-grid--text') || card).appendChild(list);
    }

    function scan() {
      document.querySelectorAll(CONFIG.itemSelector).forEach(function (card) {
        if (card.hasAttribute('data-ss-bt')) return;
        var link = card.querySelector('.blog-title a[href], a.image-wrapper[href]');
        if (!link) return;
        card.setAttribute('data-ss-bt', '');
        var href = link.href;
        listReady
          .then(function () { return tagsFor(card, href); })
          .then(function (tags) { render(card, href, tags); });
      });
    }

    scan();
    var first = document.querySelector(CONFIG.itemSelector);
    if (first.parentElement) new MutationObserver(scan).observe(first.parentElement, { childList: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
