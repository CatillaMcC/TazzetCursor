/**
 * taz-dots.js — Dots Network canvas background
 *
 * Apply by adding data-taz-dots="[palette]" to any element.
 * The element must have a defined height (position:relative is set by CSS).
 *
 * Palettes:
 *   teal   — teal dots on dark (ocean) background  [default]
 *   cream  — cream/light dots on dark background
 *   ocean  — dark dots on light (cream) background
 *   orange — orange dots on dark background
 *   plum   — plum dots on dark background
 *
 * Features:
 *   • ResizeObserver — reflows canvas on resize
 *   • IntersectionObserver — pauses animation when off-screen
 *   • prefers-reduced-motion — static snapshot, no animation
 *   • MutationObserver — auto-initialises dynamically added elements
 */
(function () {
  'use strict';

  var PALETTES = {
    teal:   { dot: [78, 141, 153],  dotA: 0.7,  lineA: 0.3  },
    cream:  { dot: [245, 240, 236], dotA: 0.6,  lineA: 0.25 },
    ocean:  { dot: [26,  53,  64],  dotA: 0.45, lineA: 0.15 },
    orange: { dot: [235, 186, 149], dotA: 0.65, lineA: 0.28 },
    plum:   { dot: [109, 68,  94],  dotA: 0.55, lineA: 0.22 },
  };

  var MAX_DIST    = 140;   // px — max distance for a connecting line
  var DOT_RADIUS  = 1.8;  // px
  var SPEED       = 0.28; // px per frame baseline
  var DENSITY     = 35;   // target dots per 100,000 px²
  var MIN_DOTS    = 10;
  var MAX_DOTS    = 90;

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Dot initialisation ---- */
  function makeDot(w, h) {
    var angle = Math.random() * Math.PI * 2;
    var speed = SPEED * (0.5 + Math.random());
    return {
      x:  Math.random() * w,
      y:  Math.random() * h,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    };
  }

  /* ---- Engine ---- */
  function createEngine(el) {
    if (el._tazDots) return;

    var key    = el.dataset.tazDots || 'teal';
    var pal    = PALETTES[key] || PALETTES.teal;
    var dotRGB = 'rgba(' + pal.dot[0] + ',' + pal.dot[1] + ',' + pal.dot[2] + ',';

    var canvas = document.createElement('canvas');
    canvas.className = 'taz-dots-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = [
      'position:absolute',
      'inset:0',
      'width:100%',
      'height:100%',
      'pointer-events:none',
      'z-index:0',
    ].join(';');
    el.insertBefore(canvas, el.firstChild);

    var ctx  = canvas.getContext('2d');
    var dots = [];
    var raf  = null;
    var running = false;
    var w = 0, h = 0;

    /* Resize: refit canvas, rescale dot count */
    function resize() {
      var rect = el.getBoundingClientRect();
      w = Math.round(rect.width)  || el.offsetWidth  || 1;
      h = Math.round(rect.height) || el.offsetHeight || 1;
      canvas.width  = w;
      canvas.height = h;

      var target = Math.max(MIN_DOTS, Math.min(MAX_DOTS,
        Math.round((w * h / 100000) * DENSITY)
      ));

      while (dots.length < target) dots.push(makeDot(w, h));
      if (dots.length > target) dots.length = target;

      /* Clamp existing dots inside new bounds */
      dots.forEach(function (d) {
        d.x = Math.min(d.x, w);
        d.y = Math.min(d.y, h);
      });
    }

    /* Draw one frame */
    function frame() {
      ctx.clearRect(0, 0, w, h);

      if (!reducedMotion) {
        dots.forEach(function (d) {
          d.x += d.vx;
          d.y += d.vy;
          if (d.x < 0) { d.x = 0;  d.vx = Math.abs(d.vx); }
          if (d.x > w) { d.x = w;  d.vx = -Math.abs(d.vx); }
          if (d.y < 0) { d.y = 0;  d.vy = Math.abs(d.vy); }
          if (d.y > h) { d.y = h;  d.vy = -Math.abs(d.vy); }
        });
      }

      /* Lines (drawn first, under dots) */
      var n = dots.length;
      for (var i = 0; i < n; i++) {
        for (var j = i + 1; j < n; j++) {
          var dx   = dots[i].x - dots[j].x;
          var dy   = dots[i].y - dots[j].y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX_DIST) {
            var a = (1 - dist / MAX_DIST) * pal.lineA;
            ctx.beginPath();
            ctx.moveTo(dots[i].x, dots[i].y);
            ctx.lineTo(dots[j].x, dots[j].y);
            ctx.strokeStyle = dotRGB + a + ')';
            ctx.lineWidth   = 0.75;
            ctx.stroke();
          }
        }
      }

      /* Dots */
      dots.forEach(function (d) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = dotRGB + pal.dotA + ')';
        ctx.fill();
      });

      if (running && !reducedMotion) {
        raf = requestAnimationFrame(frame);
      }
    }

    function start() {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(frame);
    }

    function pause() {
      running = false;
      if (raf) { cancelAnimationFrame(raf); raf = null; }
    }

    /* ResizeObserver */
    var ro = new ResizeObserver(function () {
      resize();
      if (reducedMotion || !running) frame();
    });
    ro.observe(el);

    /* IntersectionObserver — pause off-screen */
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          if (!reducedMotion) start();
        } else {
          pause();
        }
      });
    }, { threshold: 0.01 });
    io.observe(el);

    /* Boot */
    resize();
    if (reducedMotion) {
      frame(); // one static draw
    } else {
      start();
    }

    el._tazDots = {
      canvas: canvas,
      start:  start,
      pause:  pause,
      resize: resize,
      destroy: function () {
        pause();
        ro.disconnect();
        io.disconnect();
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        delete el._tazDots;
        delete el.dataset.tazDotsInit;
      },
    };
  }

  /* ---- Scan DOM for [data-taz-dots] ---- */
  function scan() {
    document.querySelectorAll('[data-taz-dots]:not([data-taz-dots-init])').forEach(function (el) {
      el.dataset.tazDotsInit = '1';
      createEngine(el);
    });
  }

  /* Alias so Patch C can call it directly */
  var createEngine_public = createEngine;
  window._tazDotsCreate = createEngine_public;

  /* Watch for elements added after page load */
  new MutationObserver(scan).observe(document.documentElement, {
    childList:      true,
    subtree:        true,
    attributes:     true,
    attributeFilter: ['data-taz-dots'],
  });

  /* Boot after DOM ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }
})();
