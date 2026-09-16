<!-- Counter (tab-safe) -->
<script>
(function () {
  const bound = new WeakSet();
  const done = new WeakSet();

  function animate(el) {
    if (done.has(el)) return;
    done.add(el);
    const start = parseInt(el.dataset.start, 10) || 0;
    const end = parseInt(el.dataset.end, 10) || 0;
    const duration = parseInt(el.dataset.duration, 10) || 2000;
    let t0 = null;
    function step(ts) {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / duration, 1);
      el.textContent = Math.floor(start + p * (end - start));
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = end;
    }
    requestAnimationFrame(step);
  }

  function isShowing(el) {
    if (el.checkVisibility) {
      return el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    }
    return el.offsetParent !== null;
  }

  function inViewport(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const el = entry.target;
      if (entry.isIntersecting && isShowing(el)) {
        animate(el);
        io.unobserve(el);
      }
    });
  });

  function scan() {
    document.querySelectorAll('.counter').forEach((el) => {
      if (bound.has(el)) return;
      bound.add(el);
      el.textContent = el.dataset.start || 0;
      io.observe(el);
    });
  }

  function recheck() {
    document.querySelectorAll('.counter').forEach((el) => {
      if (bound.has(el) && !done.has(el) && inViewport(el) && isShowing(el)) {
        animate(el);
        io.unobserve(el);
      }
    });
  }

  // Catch counters that get added or moved in after load (tabs plugin)
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; scan(); recheck(); });
  }).observe(document.documentElement, { childList: true, subtree: true });

  // Re-check after tab clicks (allowing time for fade transitions)
  document.addEventListener('click', () => {
    setTimeout(recheck, 50);
    setTimeout(recheck, 400);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { scan(); recheck(); });
  } else {
    scan(); recheck();
  }
  window.addEventListener('load', () => { scan(); recheck(); });
})();
</script>
