/**
 * taz-overrides.js — Tazzet app overrides
 */
(function () {
  'use strict';

  /* ── dashNewLesson ── */
  window.dashNewLesson = function dashNewLesson() {
    var editWrap = document.getElementById('edit-wrap');
    var wizWrap  = document.getElementById('wizard-wrap');
    if (editWrap) editWrap.classList.remove('active');
    window._currentProjectId = null;
    if (typeof rSteps === 'function') rSteps();
    if (typeof updUI  === 'function') updUI();
    if (wizWrap) wizWrap.classList.add('taz-modal');
  };

  /* ── _closeWizard ── */
  window._closeWizard = function _closeWizard() {
    var w = document.getElementById('wizard-wrap');
    if (w) w.classList.remove('taz-modal');
  };

  /* ── goBackToWizard ── */
  window.goBackToWizard = function goBackToWizard() {
    var editWrap = document.getElementById('edit-wrap');
    if (editWrap) editWrap.classList.remove('active');
    if (typeof clearDirty === 'function') clearDirty();
    window._currentProjectId = null;
    window._editData         = null;
    window._generatedLesson  = '';
    if (typeof showDashboard === 'function') showDashboard();
  };

  /* ── Logo click — return to dashboard ── */
  (function () {
    function bindLogo() {
      var logo = document.querySelector('.logo, [class*="logo"]');
      if (!logo || logo.dataset.tazLogoBound) return;
      logo.dataset.tazLogoBound = '1';
      logo.style.cursor = 'pointer';
      logo.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        window._closeWizard();
        if (typeof showDashboard === 'function') showDashboard();
        else window.location.replace('/');
      });
    }
    bindLogo();
    new MutationObserver(bindLogo).observe(document.body, { childList: true, subtree: true });
  }());

  /* ── Rename "+ New Lesson" to "Create" ── */
  (function () {
    function relabel() {
      document.querySelectorAll('.dash-new-btn').forEach(function (btn) {
        if (btn.dataset.tazRelabelled) return;
        btn.dataset.tazRelabelled = '1';
        Array.from(btn.childNodes).forEach(function (node) {
          if (node.nodeType === Node.TEXT_NODE) {
            node.textContent = node.textContent.replace(/\+?\s*New\s+Lesson/i, 'Create').trim();
          }
        });
        if (!btn.querySelector('*')) {
          btn.textContent = btn.textContent.replace(/\+?\s*New\s+Lesson/i, 'Create').trim();
        }
      });
    }
    relabel();
    new MutationObserver(relabel).observe(document.body, { childList: true, subtree: true });
  }());

  /* ── deleteProject — soft-delete ── */
  (function () {
    function authHeaders() {
      var token = null;
      try { token = localStorage.getItem('tazzet_jwt'); } catch (_) {}
      return token
        ? { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json' };
    }
    window.deleteProject = function deleteProject(id) {
      var projects = {};
      try { projects = JSON.parse(localStorage.getItem('tazzet_projects') || '{}'); } catch (_) {}
      var title = (projects[id] && projects[id].title) || 'this project';
      if (!confirm('\u201c' + title + '\u201d \u2014 move to Trash?')) return;
      fetch('/api/projects/' + id, { method: 'DELETE', headers: authHeaders() })
        .then(function (r) {
          if (!r.ok) { alert('Could not move to Trash. Please try again.'); return; }
          try {
            var p = JSON.parse(localStorage.getItem('tazzet_projects') || '{}');
            delete p[id];
            localStorage.setItem('tazzet_projects', JSON.stringify(p));
          } catch (_) {}
          if (typeof dashRenderProjects === 'function') dashRenderProjects();
          if (typeof _updateProjectCountLabel === 'function') _updateProjectCountLabel();
          if (typeof _syncProjectBadge === 'function') _syncProjectBadge();
        })
        .catch(function () { alert('Network error. Please try again.'); });
    };
  }());

  /* ── dashSetView('trash') ── */
  (function () {
    function authHeaders() {
      var token = null;
      try { token = localStorage.getItem('tazzet_jwt'); } catch (_) {}
      return token
        ? { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json' };
    }
    function fmtDate(iso) {
      if (!iso) return '';
      return 'Deleted ' + new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    function closeTrashPanel() {
      var panel = document.getElementById('taz-trash-panel');
      if (panel) panel.remove();
      if (typeof origDashSetView === 'function') origDashSetView('all');
    }
    function renderTrashPanel(projects) {
      var existing = document.getElementById('taz-trash-panel');
      if (existing) existing.remove();
      var panel = document.createElement('div');
      panel.id = 'taz-trash-panel';
      var hasItems = projects && projects.length > 0;
      var rows = hasItems
        ? projects.map(function (p) {
            var e = (p.title || 'Untitled').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
            return '<div class="taz-trash-row" data-id="' + p.id + '">'
              + '<div class="taz-trash-dot"></div>'
              + '<div class="taz-trash-info"><div class="taz-trash-name">' + e + '</div>'
              + '<div class="taz-trash-meta">' + fmtDate(p.deletedAt) + '</div></div>'
              + '<div class="taz-trash-actions">'
              + '<button class="taz-btn-restore" data-id="' + p.id + '" data-title="' + e + '">Restore</button>'
              + '<button class="taz-btn-delete-perm" data-id="' + p.id + '" data-title="' + e + '">Delete permanently</button>'
              + '</div></div>';
          }).join('')
        : '<div class="taz-trash-empty"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg><p>Trash is empty.</p></div>';
      panel.innerHTML = '<div class="taz-trash-card">'
        + '<div class="taz-trash-header" data-taz-dots="cream"><span class="taz-trash-title">Trash</span>'
        + '<button class="taz-trash-close" id="taz-trash-close-btn" aria-label="Close trash">&times;</button></div>'
        + '<div class="taz-trash-body">' + rows + '</div>'
        + (hasItems ? '<div class="taz-trash-footer"><button class="taz-btn-empty-trash" id="taz-empty-trash-btn">Empty Trash</button></div>' : '')
        + '</div>';
      document.body.appendChild(panel);
      document.getElementById('taz-trash-close-btn').addEventListener('click', closeTrashPanel);
      panel.addEventListener('click', function (e) { if (e.target === panel) closeTrashPanel(); });
      function onKey(e) { if (e.key === 'Escape') { closeTrashPanel(); document.removeEventListener('keydown', onKey); } }
      document.addEventListener('keydown', onKey);
      panel.querySelectorAll('.taz-btn-restore').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.dataset.id, title = btn.dataset.title;
          fetch('/api/projects/' + id + '/restore', { method: 'POST', headers: authHeaders() })
            .then(function (r) {
              if (r.ok) {
                btn.closest('.taz-trash-row').remove();
                if (!panel.querySelectorAll('.taz-trash-row').length) openTrashPanel();
                if (typeof dashRenderProjects === 'function') dashRenderProjects();
              } else { alert('Could not restore \u201c' + title + '\u201d. Please try again.'); }
            }).catch(function () { alert('Network error. Please try again.'); });
        });
      });
      panel.querySelectorAll('.taz-btn-delete-perm').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.dataset.id, title = btn.dataset.title;
          if (!confirm('Permanently delete \u201c' + title + '\u201d? This cannot be undone.')) return;
          fetch('/api/projects/' + id + '/permanent', { method: 'DELETE', headers: authHeaders() })
            .then(function (r) {
              if (r.ok) {
                btn.closest('.taz-trash-row').remove();
                if (!panel.querySelectorAll('.taz-trash-row').length) openTrashPanel();
              } else { alert('Could not delete \u201c' + title + '\u201d. Please try again.'); }
            }).catch(function () { alert('Network error. Please try again.'); });
        });
      });
      var emptyBtn = document.getElementById('taz-empty-trash-btn');
      if (emptyBtn) {
        emptyBtn.addEventListener('click', function () {
          if (!confirm('Permanently delete all items in trash? This cannot be undone.')) return;
          var ids = Array.from(panel.querySelectorAll('.taz-trash-row')).map(function (r) { return r.dataset.id; });
          Promise.all(ids.map(function (id) {
            return fetch('/api/projects/' + id + '/permanent', { method: 'DELETE', headers: authHeaders() });
          })).then(function () { openTrashPanel(); })
            .catch(function () { alert('Some items could not be deleted. Please try again.'); });
        });
      }
    }
    function openTrashPanel() {
      fetch('/api/projects/trash', { headers: authHeaders() })
        .then(function (r) { return r.json(); })
        .then(function (d) { renderTrashPanel(d.projects || []); })
        .catch(function () { renderTrashPanel([]); });
    }
    var origDashSetView = typeof window.dashSetView === 'function' ? window.dashSetView : null;
    window.dashSetView = function dashSetView(view) {
      if (view === 'trash') { openTrashPanel(); return; }
      if (origDashSetView) return origDashSetView.apply(this, arguments);
    };
  }());

  /* ── Wizard close button ── */
  (function () {
    function setup() {
      var wrap = document.getElementById('wizard-wrap');
      var card = wrap && wrap.querySelector('.wiz-card');
      if (!card || card.querySelector('.wiz-modal-close')) return;
      var btn = document.createElement('button');
      btn.className = 'wiz-modal-close';
      btn.setAttribute('aria-label', 'Close');
      btn.innerHTML = '&times;';
      btn.addEventListener('click', function (e) { e.stopPropagation(); window._closeWizard(); });
      card.insertBefore(btn, card.firstChild);
      wrap.addEventListener('click', function (e) { if (e.target === wrap) window._closeWizard(); });
      document.addEventListener('keydown', function (e) {
        var w = document.getElementById('wizard-wrap');
        if (e.key === 'Escape' && w && w.classList.contains('taz-modal')) window._closeWizard();
      });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
    else setup();
  }());

  /* ── Wizard step 1 — full JS rebuild ── */
  (function () {
    var CARD_STYLE = [
      'display:flex','flex-direction:column','align-items:center','justify-content:center',
      'gap:8px','padding:16px 12px','min-height:80px','border-radius:12px',
      'border:2px solid rgba(26,53,64,.18)','background:#ffffff','cursor:pointer',
      'text-align:center','user-select:none','box-sizing:border-box',
      'transition:border-color 180ms ease,background 180ms ease,transform 180ms ease'
    ].join(';');
    var CARD_DISABLED_STYLE = [
      'display:flex','flex-direction:column','align-items:center','justify-content:center',
      'gap:8px','padding:16px 12px','min-height:80px','border-radius:12px',
      'border:2px dashed rgba(26,53,64,.12)','background:rgba(26,53,64,.03)',
      'cursor:default','text-align:center','user-select:none','box-sizing:border-box','position:relative'
    ].join(';');
    var GRID_STYLE = [
      'display:grid','grid-template-columns:repeat(auto-fit,minmax(110px,1fr))',
      'gap:10px','padding:20px 24px 4px','background:#F5F0EC','box-sizing:border-box'
    ].join(';');
    var HINT_STYLE = [
      'grid-column:1/-1','text-align:center','font-family:Barlow,sans-serif',
      'font-size:12px','color:rgba(26,53,64,.5)','letter-spacing:.04em',
      'padding:4px 0 10px','margin:0','pointer-events:none'
    ].join(';');

    function svgForType(type) {
      var paths = {
        lesson:    '<rect x="3" y="3" width="18" height="18" rx="2.5"/><line x1="3" y1="9" x2="21" y2="9"/><path d="M8 14h2m-2 3h5"/>',
        course:    '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
        scratch:   '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
        knowledge: '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>'
      };
      var d = paths[type] || '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>';
      return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A3540" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:block;width:20px;height:20px;flex-shrink:0">' + d + '</svg>';
    }

    function findNextBtn(navEl) {
      var btns = navEl.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) { if (/next/i.test(btns[i].textContent)) return btns[i]; }
      return btns.length ? btns[btns.length - 1] : null;
    }

    function buildTypeGrid(origCards, screen1) {
      var grid = document.createElement('div');
      grid.id = 'taz-type-grid';
      grid.setAttribute('style', GRID_STYLE);
      var tazCards = [];

      origCards.forEach(function (orig) {
        var type = (orig.dataset.type || '').toLowerCase();
        var titleEl = orig.querySelector('.type-card-title');
        var label = '';
        if (titleEl) Array.from(titleEl.childNodes).forEach(function (n) { if (n.nodeType === Node.TEXT_NODE) label += n.textContent.trim(); });
        if (!label) label = type.charAt(0).toUpperCase() + type.slice(1);

        var card = document.createElement('div');
        card.setAttribute('style', CARD_STYLE);
        card.setAttribute('role', 'button'); card.setAttribute('tabindex', '0'); card.setAttribute('aria-label', label);
        card.dataset.tazType = type;

        var iconWrap = document.createElement('div');
        iconWrap.style.cssText = 'display:flex;align-items:center;justify-content:center;opacity:.6;transition:opacity 180ms ease';
        iconWrap.innerHTML = svgForType(type);

        var labelEl = document.createElement('span');
        labelEl.style.cssText = 'font-family:Barlow Condensed,sans-serif;font-size:12px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#1A3540;line-height:1.2';
        labelEl.textContent = label;
        card.appendChild(iconWrap); card.appendChild(labelEl);

        card.addEventListener('mouseenter', function () {
          if (!card.dataset.tazSel) { card.style.borderColor='#4E8D99'; card.style.background='#EAF4F6'; card.style.transform='translateY(-2px)'; iconWrap.style.opacity='1'; }
        });
        card.addEventListener('mouseleave', function () {
          if (!card.dataset.tazSel) { card.style.borderColor='rgba(26,53,64,.18)'; card.style.background='#ffffff'; card.style.transform=''; iconWrap.style.opacity='.6'; }
        });
        card.addEventListener('click', function () {
          tazCards.forEach(function (tc) { delete tc.el.dataset.tazSel; tc.el.style.borderColor='rgba(26,53,64,.18)'; tc.el.style.background='#ffffff'; tc.el.style.boxShadow=''; tc.el.style.transform=''; tc.icon.style.opacity='.6'; });
          card.dataset.tazSel='1'; card.style.borderColor='#4E8D99'; card.style.background='#C8E8ED'; card.style.boxShadow='inset 0 0 0 2px #4E8D99'; card.style.transform=''; iconWrap.style.opacity='1';
          teardownStep1(screen1); orig.click();
        });
        card.addEventListener('keydown', function (e) { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); card.click(); } });
        grid.appendChild(card); tazCards.push({ el: card, icon: iconWrap });
      });

      /* Knowledge Articles — live card wired to KB wizard */
      var kaCard = document.createElement('div');
      kaCard.setAttribute('style', CARD_STYLE);
      kaCard.setAttribute('role', 'button'); kaCard.setAttribute('tabindex', '0'); kaCard.setAttribute('aria-label', 'Knowledge Articles');
      kaCard.dataset.tazType = 'knowledge';
      var kaIconWrap = document.createElement('div');
      kaIconWrap.style.cssText = 'display:flex;align-items:center;justify-content:center;opacity:.6;transition:opacity 180ms ease';
      kaIconWrap.innerHTML = svgForType('knowledge');
      var kaLabel = document.createElement('span');
      kaLabel.style.cssText = 'font-family:Barlow Condensed,sans-serif;font-size:12px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#1A3540;line-height:1.2';
      kaLabel.textContent = 'Knowledge Articles';
      kaCard.appendChild(kaIconWrap); kaCard.appendChild(kaLabel);
      kaCard.addEventListener('mouseenter', function () {
        if (!kaCard.dataset.tazSel) { kaCard.style.borderColor='#4E8D99'; kaCard.style.background='#EAF4F6'; kaCard.style.transform='translateY(-2px)'; kaIconWrap.style.opacity='1'; }
      });
      kaCard.addEventListener('mouseleave', function () {
        if (!kaCard.dataset.tazSel) { kaCard.style.borderColor='rgba(26,53,64,.18)'; kaCard.style.background='#ffffff'; kaCard.style.transform=''; kaIconWrap.style.opacity='.6'; }
      });
      kaCard.addEventListener('click', function () {
        window._closeWizard();
        if (typeof window._tazOpenKaWizard === 'function') window._tazOpenKaWizard();
      });
      kaCard.addEventListener('keydown', function (e) { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); kaCard.click(); } });
      tazCards.push({ el: kaCard, icon: kaIconWrap });
      grid.appendChild(kaCard);

      var hint = document.createElement('p'); hint.id='taz-type-hint'; hint.setAttribute('style',HINT_STYLE); hint.textContent='Select a type to continue'; grid.appendChild(hint);
      return grid;
    }

    function teardownStep1(screen1) {
      var grid = document.getElementById('taz-type-grid'); if (grid) grid.remove();
      var typeScreen = screen1.querySelector('.type-screen'); if (typeScreen) typeScreen.style.removeProperty('display');
      var nextBtn = screen1.querySelector('[data-taz-hidden]'); if (nextBtn) { nextBtn.style.removeProperty('display'); delete nextBtn.dataset.tazHidden; }
    }

    function initWizardStep1() {
      if (document.getElementById('taz-type-grid')) return;
      var screen1 = document.querySelector('.screen.active'); if (!screen1) return;
      var typeScreen = screen1.querySelector('.type-screen'); if (!typeScreen) return;
      var origCards = Array.from(screen1.querySelectorAll('.type-card[data-type]')); if (!origCards.length) return;
      var navEl = screen1.querySelector('.wiz-nav');
      typeScreen.style.setProperty('display', 'none', 'important');
      if (navEl) { var nextBtn = findNextBtn(navEl); if (nextBtn) { nextBtn.dataset.tazHidden='1'; nextBtn.style.setProperty('display','none','important'); } }
      var grid = buildTypeGrid(origCards, screen1);
      if (navEl) screen1.insertBefore(grid, navEl); else screen1.appendChild(grid);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initWizardStep1);
    else initWizardStep1();
  }());

  /* ── Type-card auto-advance ── */
  (function () {
    function patch() {
      document.querySelectorAll('.type-card[data-type]').forEach(function (card) {
        if (card.dataset.goNPatched) return;
        card.dataset.goNPatched = '1';
        card.addEventListener('click', function () {
          if (card.dataset.type === 'scratch') return;
          setTimeout(function () { if (typeof goN === 'function') goN(); }, 150);
        });
      });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', patch);
    else patch();
  }());

  /* ── Preview button injection ── */
  (function () {
    function inject() {
      var toolbar = document.querySelector('.edit-toolbar-right');
      if (!toolbar || toolbar.querySelector('.etool-preview')) return;
      var scormBtn = Array.from(toolbar.querySelectorAll('.etool')).find(function (b) { return b.textContent.trim().startsWith('SCORM'); });
      var btn = document.createElement('button');
      btn.className = 'etool etool-preview'; btn.title = 'Preview lesson in new tab'; btn.setAttribute('aria-label', 'Preview lesson in new tab');
      btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Preview';
      btn.addEventListener('click', function () { if (typeof window.previewLesson === 'function') window.previewLesson(); });
      if (scormBtn) toolbar.insertBefore(btn, scormBtn); else toolbar.appendChild(btn);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
    else inject();
  }());

  /* ── previewLesson ── */
  window.previewLesson = function previewLesson() {
    var lessonHtml = null;
    if (window._editData) {
      var wiz = Object.assign({}, window._wizData || {}, {
        hero: (window._wizData && window._wizData.hero) || window._heroConfig || { layout: 'centered', bg: 'ocean', accent: 'orange', ctaText: 'Begin Lesson', height: 'full' },
        passingScore: (window._wizData && window._wizData.passingScore) || (window._aqConfig && window._aqConfig.passingScore) || 80
      });
      try {
        lessonHtml = assembleLessonHTML(window._editData, wiz);
        if (typeof testAndFixLesson === 'function') lessonHtml = (testAndFixLesson(lessonHtml).html) || lessonHtml;
      } catch (e) { console.warn('[tazzet preview]', e); }
    }
    if (!lessonHtml && window._generatedLesson) lessonHtml = window._generatedLesson;
    if (!lessonHtml) { alert('Nothing to preview yet \u2014 generate or edit a lesson first.'); return; }
    var blob = new Blob([lessonHtml], { type: 'text/html; charset=utf-8' });
    var url  = URL.createObjectURL(blob);
    var tab  = window.open(url, '_blank');
    if (tab) tab.addEventListener('load', function () { URL.revokeObjectURL(url); }, { once: true });
  };

  /* ── Dots network auto-application ── */
  (function () {
    var AUTO_TARGETS = [
      { sel: '.step-bar',     palette: 'teal' },
      { sel: '.edit-toolbar', palette: 'teal' },
      { sel: '.dash-sidebar', palette: 'teal' },
    ];
    function applyDots() {
      AUTO_TARGETS.forEach(function (t) {
        document.querySelectorAll(t.sel).forEach(function (el) {
          if (el.dataset.tazDots) return;
          el.dataset.tazDots = t.palette;
          if (typeof window._tazDotsCreate === 'function') { el.dataset.tazDotsInit = '1'; window._tazDotsCreate(el); }
        });
      });
    }
    applyDots();
    new MutationObserver(function (mutations) { if (mutations.some(function (m) { return m.addedNodes.length > 0; })) applyDots(); }).observe(document.body, { childList: true, subtree: true });
  }());

  /* ── Tags system ── */
  (function () {
    var COLOURS = ['#ef9a9a','#f48fb1','#ce93d8','#9fa8da','#80d8ff','#80deea','#80cbc4','#a5d6a7','#dce775','#ffe082','#ffcc80','#bcaaa4'];
    var _tags = [], _projTags = {};

    function hdrs() {
      var t = null; try { t = localStorage.getItem('tazzet_jwt'); } catch (_) {}
      return t ? { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
    }
    function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }

    function loadTagData() {
      return fetch('/api/tags', { headers: hdrs() }).then(function (r) { return r.json(); })
        .then(function (d) { _tags = d.tags || []; _projTags = d.projectTags || {}; }).catch(function () {});
    }
    function apiCreate(name, colour) { return fetch('/api/tags', { method:'POST', headers:hdrs(), body:JSON.stringify({ name:name, colour:colour }) }).then(function (r) { return r.json(); }); }
    function apiUpdate(id, name, colour) { return fetch('/api/tags/' + id, { method:'PUT', headers:hdrs(), body:JSON.stringify({ name:name, colour:colour }) }).then(function (r) { return r.json(); }); }
    function apiDelete(id) { return fetch('/api/tags/' + id, { method:'DELETE', headers:hdrs() }).then(function (r) { return r.json(); }); }
    function apiSetProjTags(projId, tagIds) { return fetch('/api/projects/' + projId + '/tags', { method:'PUT', headers:hdrs(), body:JSON.stringify({ tags:tagIds }) }).then(function (r) { return r.json(); }); }

    var PROJ_ID_RE = /(?:dashToggleFav|dashDeleteProject|loadProject|dashOpenProject|openProject|dashRenameProject|dashDuplicateProject)\(['"]( proj_[^'"]+)['"](?:,|\))/;
    function extractIdFromStr(str) { if (!str) return null; var m = PROJ_ID_RE.exec(str); return m ? m[1] : null; }
    function cardProjId(el) {
      var id, attr = el.getAttribute('onclick');
      if (attr) { id = extractIdFromStr(attr); if (id) return id; }
      if (typeof el.onclick === 'function') { id = extractIdFromStr(el.onclick.toString()); if (id) return id; }
      var kids = el.querySelectorAll('[onclick]');
      for (var i = 0; i < kids.length; i++) { var ka = kids[i].getAttribute('onclick'); if (ka) { id = extractIdFromStr(ka); if (id) return id; } }
      if (el.dataset.id && el.dataset.id.indexOf('proj_') === 0) return el.dataset.id;
      if (el.dataset.projectId) return el.dataset.projectId;
      return null;
    }

    function injectChips(card, projId) {
      var old = card.querySelector('.taz-card-tags'); if (old) old.remove();
      var wrap = document.createElement('div'); wrap.className = 'taz-card-tags';
      (_projTags[projId] || []).forEach(function (tid) {
        var tag = _tags.find(function (t) { return t.id === tid; }); if (!tag) return;
        var chip = document.createElement('span'); chip.className = 'taz-tag-chip'; chip.style.background = tag.colour; chip.textContent = tag.name; wrap.appendChild(chip);
      });
      var addBtn = document.createElement('button');
      addBtn.className = 'taz-tag-add-btn'; addBtn.title = 'Tag this project'; addBtn.setAttribute('aria-label', 'Tag this project');
      addBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>';
      addBtn.addEventListener('click', function (e) { e.stopPropagation(); openPicker(projId, addBtn); });
      wrap.appendChild(addBtn); card.appendChild(wrap);
    }
    function refreshAllCards() {
      var area = document.getElementById('dash-project-area'); if (!area) return;
      area.querySelectorAll('[data-taz-tagged]').forEach(function (card) { injectChips(card, card.dataset.tazTagged); });
    }
    function annotateNewCards(area) {
      area.querySelectorAll('.dash-card:not([data-taz-tagged]),.proj-card:not([data-taz-tagged]),.dash-list-row:not([data-taz-tagged])').forEach(function (card) {
        var pid = cardProjId(card); if (!pid) return;
        card.dataset.tazTagged = pid; injectChips(card, pid);
      });
    }
    function setupCardObserver() {
      var area = document.getElementById('dash-project-area'); if (!area) return;
      new MutationObserver(function () { annotateNewCards(area); }).observe(area, { childList: true, subtree: true });
      annotateNewCards(area);
    }
    function closePicker() { var p = document.getElementById('taz-tag-picker'); if (p) p.remove(); document.removeEventListener('click', onOutside); }
    function onOutside(e) { var p = document.getElementById('taz-tag-picker'); if (p && !p.contains(e.target)) closePicker(); }
    function openPicker(projId, anchor) {
      closePicker();
      var picker = document.createElement('div'); picker.id = 'taz-tag-picker'; picker.setAttribute('role', 'dialog'); picker.setAttribute('aria-label', 'Tag this project');
      if (!_tags.length) {
        picker.innerHTML = '<div class="taz-picker-empty">No tags yet.<br>Create tags in <strong>Settings \u2192 Workspace</strong>.</div>';
      } else {
        var cur = _projTags[projId] || [];
        _tags.forEach(function (tag) {
          var item = document.createElement('label'); item.className = 'taz-tag-picker-item';
          item.innerHTML = '<input type="checkbox" value="' + tag.id + '"' + (cur.indexOf(tag.id) !== -1 ? ' checked' : '') + '>'
            + '<span class="taz-picker-swatch" style="background:' + tag.colour + '" aria-hidden="true"></span>'
            + '<span class="taz-picker-name">' + esc(tag.name) + '</span>';
          picker.appendChild(item);
        });
      }
      document.body.appendChild(picker);
      var rect = anchor.getBoundingClientRect();
      var top = rect.bottom + window.scrollY + 4, left = rect.left + window.scrollX;
      if (left + 224 > window.innerWidth) left = window.innerWidth - 232;
      picker.style.top = top + 'px'; picker.style.left = left + 'px';
      picker.querySelectorAll('input[type=checkbox]').forEach(function (cb) {
        cb.addEventListener('change', function () {
          var checked = Array.from(picker.querySelectorAll('input:checked')).map(function (c) { return c.value; });
          _projTags[projId] = checked; apiSetProjTags(projId, checked); refreshAllCards();
        });
      });
      setTimeout(function () { document.addEventListener('click', onOutside); }, 0);
    }
    function renderTagList(section) {
      var listEl = section.querySelector('.taz-tag-list'); if (!listEl) return;
      listEl.innerHTML = '';
      if (!_tags.length) { listEl.innerHTML = '<div class="taz-tag-list-empty">No tags yet.</div>'; return; }
      _tags.forEach(function (tag) {
        var row = document.createElement('div'); row.className = 'taz-tag-list-row';
        row.innerHTML = '<span class="taz-tag-list-swatch" style="background:' + tag.colour + '" aria-hidden="true"></span>'
          + '<span class="taz-tag-list-name">' + esc(tag.name) + '</span>'
          + '<div class="taz-tag-list-actions">'
          + '<button class="taz-tag-edit-btn" data-id="' + tag.id + '" aria-label="Edit tag: ' + esc(tag.name) + '">&#9998;</button>'
          + '<button class="taz-tag-del-btn" data-id="' + tag.id + '" aria-label="Delete tag: ' + esc(tag.name) + '">&times;</button>'
          + '</div>';
        listEl.appendChild(row);
      });
      listEl.querySelectorAll('.taz-tag-del-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.dataset.id, tag = _tags.find(function (t) { return t.id === id; });
          if (!tag || !confirm('Delete tag \u201c' + tag.name + '\u201d? It will be removed from all projects.')) return;
          btn.disabled = true;
          apiDelete(id).then(function (r) {
            if (!r.ok) { btn.disabled = false; return; }
            _tags = _tags.filter(function (t) { return t.id !== id; });
            Object.keys(_projTags).forEach(function (pid) { _projTags[pid] = (_projTags[pid]||[]).filter(function (tid) { return tid !== id; }); });
            renderTagList(section); refreshAllCards();
          });
        });
      });
      listEl.querySelectorAll('.taz-tag-edit-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.dataset.id, tag = _tags.find(function (t) { return t.id === id; });
          if (tag) openEditForm(section, tag);
        });
      });
    }
    function openEditForm(section, tag) {
      var old = section.querySelector('.taz-tag-edit-form'); if (old) old.remove();
      var selColour = tag.colour;
      var form = document.createElement('div'); form.className = 'taz-tag-edit-form'; form.setAttribute('role','group'); form.setAttribute('aria-label','Edit tag');
      form.innerHTML = '<div class="taz-tag-form-title">Edit tag</div>'
        + '<input class="taz-tag-name-inp" type="text" value="' + esc(tag.name) + '" maxlength="32" aria-label="Tag name">'
        + '<div class="taz-colour-swatches" role="group" aria-label="Tag colour">'
        + COLOURS.map(function (c) { return '<button class="taz-colour-swatch' + (c===selColour?' sel':'') + '" data-colour="' + c + '" style="background:' + c + '" aria-label="Colour ' + c + '" aria-pressed="' + (c===selColour?'true':'false') + '"></button>'; }).join('')
        + '</div><div class="taz-tag-form-btns"><button class="taz-tag-save-btn">Save</button><button class="taz-tag-cancel-btn">Cancel</button></div>';
      section.querySelector('.taz-tag-form-wrap').appendChild(form);
      form.querySelectorAll('.taz-colour-swatch').forEach(function (sw) {
        sw.addEventListener('click', function () {
          selColour = sw.dataset.colour;
          form.querySelectorAll('.taz-colour-swatch').forEach(function (s) { s.classList.remove('sel'); s.setAttribute('aria-pressed','false'); });
          sw.classList.add('sel'); sw.setAttribute('aria-pressed','true');
        });
      });
      form.querySelector('.taz-tag-cancel-btn').addEventListener('click', function () { form.remove(); });
      var saveBtn = form.querySelector('.taz-tag-save-btn');
      saveBtn.addEventListener('click', function () {
        var name = form.querySelector('.taz-tag-name-inp').value.trim(); if (!name) return;
        saveBtn.disabled = true;
        apiUpdate(tag.id, name, selColour).then(function (r) {
          saveBtn.disabled = false; if (!r.ok) return;
          var t = _tags.find(function (x) { return x.id === tag.id; }); if (t) { t.name = name; t.colour = selColour; }
          form.remove(); renderTagList(section); refreshAllCards();
        });
      });
    }
    function injectTagsSettings() {
      var stab = document.getElementById('stab-workspace');
      if (!stab || document.getElementById('taz-tags-section')) return;
      var selColour = COLOURS[0];
      var section = document.createElement('div');
      section.id = 'taz-tags-section'; section.className = 'taz-tags-section'; section.setAttribute('role','region'); section.setAttribute('aria-label','Tags');
      section.innerHTML = '<div class="taz-tags-section-header" aria-hidden="true">Tags</div>'
        + '<div class="taz-tag-list" role="list"></div>'
        + '<div class="taz-tag-form-wrap"><div class="taz-tag-add-form">'
        + '<input class="taz-tag-name-inp" id="taz-new-tag-name" type="text" maxlength="32" placeholder="New tag name\u2026" aria-label="New tag name">'
        + '<div class="taz-colour-swatches" role="group" aria-label="Tag colour" id="taz-new-swatches">'
        + COLOURS.map(function (c, i) { return '<button class="taz-colour-swatch' + (i===0?' sel':'') + '" data-colour="' + c + '" style="background:' + c + '" aria-label="Colour ' + c + '" aria-pressed="' + (i===0?'true':'false') + '"></button>'; }).join('')
        + '</div><button class="taz-tag-create-btn" id="taz-create-tag-btn">Add tag</button>'
        + '</div></div>';
      stab.appendChild(section);
      section.querySelectorAll('#taz-new-swatches .taz-colour-swatch').forEach(function (sw) {
        sw.addEventListener('click', function () {
          selColour = sw.dataset.colour;
          section.querySelectorAll('#taz-new-swatches .taz-colour-swatch').forEach(function (s) { s.classList.remove('sel'); s.setAttribute('aria-pressed','false'); });
          sw.classList.add('sel'); sw.setAttribute('aria-pressed','true');
        });
      });
      var nameInp = section.querySelector('#taz-new-tag-name'), createBtn = section.querySelector('#taz-create-tag-btn');
      createBtn.addEventListener('click', function () {
        var name = nameInp.value.trim(); if (!name) { nameInp.focus(); return; }
        createBtn.disabled = true; createBtn.textContent = 'Adding\u2026';
        apiCreate(name, selColour).then(function (r) {
          createBtn.disabled = false; createBtn.textContent = 'Add tag';
          if (r.ok && r.tag) { _tags.push(r.tag); nameInp.value = ''; renderTagList(section); }
        });
      });
      nameInp.addEventListener('keydown', function (e) { if (e.key === 'Enter') createBtn.click(); });
      renderTagList(section);
    }
    function watchSettingsTab() {
      var stab = document.getElementById('stab-workspace'); if (!stab) return;
      new MutationObserver(debounce(function () {
        if (!document.getElementById('taz-tags-section')) { injectTagsSettings(); var s = document.getElementById('taz-tags-section'); if (s) renderTagList(s); }
      }, 120)).observe(stab, { childList: true });
    }
    function init() {
      loadTagData().then(function () { setupCardObserver(); injectTagsSettings(); var s = document.getElementById('taz-tags-section'); if (s) renderTagList(s); watchSettingsTab(); });
    }
    function waitForApp() {
      if (typeof window.showDashboard !== 'function') { setTimeout(waitForApp, 60); return; }
      var orig = window.showDashboard, done = false;
      window.showDashboard = function showDashboard() { orig.apply(this, arguments); if (done) return; done = true; init(); };
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitForApp);
    else waitForApp();
  }());

  /* ── Folders system (sidebar dark — cream colour tokens) ── */
  (function () {
    var C_TEXT   = 'rgba(245,240,236,.72)';
    var C_MUTED  = 'rgba(245,240,236,.35)';
    var C_HOVER  = 'rgba(245,240,236,.08)';
    var C_ACTIVE = 'rgba(78,141,153,.25)';
    var C_TEAL   = '#4E8D99';
    var _folders = [], _projectFolders = {}, _selectedFolder = null, _dragProjectId = null;

    function hdrs() {
      var t = null; try { t = localStorage.getItem('tazzet_jwt'); } catch (_) {}
      return t ? { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
    }
    function loadFolderData() {
      return fetch('/api/folders', { headers: hdrs() }).then(function (r) { return r.json(); })
        .then(function (d) { _folders = d.folders || []; _projectFolders = d.projectFolders || {}; }).catch(function () {});
    }
    function apiCreateFolder(name) { return fetch('/api/folders', { method:'POST', headers:hdrs(), body:JSON.stringify({ name:name }) }).then(function (r) { return r.json(); }); }
    function apiRenameFolder(id, name) { return fetch('/api/folders/' + id, { method:'PUT', headers:hdrs(), body:JSON.stringify({ name:name }) }).then(function (r) { return r.json(); }); }
    function apiDeleteFolder(id) { return fetch('/api/folders/' + id, { method:'DELETE', headers:hdrs() }).then(function (r) { return r.json(); }); }
    function apiMoveProject(projectId, folderId) {
      return fetch('/api/projects/' + projectId + '/folder', { method:'PUT', headers:hdrs(), body:JSON.stringify({ folderId: folderId || null }) }).then(function (r) { return r.json(); });
    }
    function applyFolderFilter() {
      var area = document.getElementById('dash-project-area'); if (!area) return;
      area.querySelectorAll('[data-taz-tagged]').forEach(function (card) {
        var fid = _projectFolders[card.dataset.tazTagged] || null;
        card.style.display = (_selectedFolder === null || fid === _selectedFolder) ? '' : 'none';
      });
      var old = document.getElementById('taz-folder-empty'); if (old) old.remove();
      if (_selectedFolder) {
        var visible = Array.from(area.querySelectorAll('[data-taz-tagged]')).filter(function (c) { return c.style.display !== 'none'; });
        if (!visible.length) {
          var empty = document.createElement('div'); empty.id = 'taz-folder-empty';
          empty.style.cssText = 'padding:48px 24px;text-align:center;font-family:Barlow,sans-serif;font-size:14px;color:rgba(26,53,64,.4);';
          empty.textContent = 'No projects in this folder. Drag a project here to add it.';
          area.appendChild(empty);
        }
      }
    }
    function makeFolderDropTarget(el, folderId) {
      el.addEventListener('dragover', function (e) { if (!_dragProjectId) return; e.preventDefault(); e.dataTransfer.dropEffect='move'; el.style.outline='2px solid '+C_TEAL; el.style.outlineOffset='-2px'; });
      el.addEventListener('dragleave', function () { el.style.outline=''; el.style.outlineOffset=''; });
      el.addEventListener('drop', function (e) {
        e.preventDefault(); el.style.outline=''; el.style.outlineOffset='';
        var pid = _dragProjectId; if (!pid) return;
        if (folderId) _projectFolders[pid]=folderId; else delete _projectFolders[pid];
        apiMoveProject(pid, folderId); applyFolderFilter(); renderFolderList();
      });
    }
    function setupCardDrag() {
      var area = document.getElementById('dash-project-area'); if (!area) return;
      area.querySelectorAll('[data-taz-tagged]').forEach(function (card) {
        if (card.dataset.tazDragReady) return; card.dataset.tazDragReady='1'; card.setAttribute('draggable','true');
        card.addEventListener('dragstart', function (e) { _dragProjectId=card.dataset.tazTagged; e.dataTransfer.effectAllowed='move'; setTimeout(function(){ card.style.opacity='.45'; },0); });
        card.addEventListener('dragend', function () { _dragProjectId=null; card.style.opacity=''; });
      });
    }
    var ITEM_STYLE='display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:8px;cursor:pointer;user-select:none;font-family:Barlow,sans-serif;font-size:12px;color:'+C_TEXT+';transition:background 140ms ease;position:relative';
    function folderSVG() { return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;opacity:.6"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'; }
    function renderFolderList() {
      var listEl = document.getElementById('taz-folder-list'); if (!listEl) return;
      listEl.innerHTML = '';
      _folders.forEach(function (folder) {
        var isSel = _selectedFolder === folder.id;
        var item = document.createElement('div'); item.dataset.folderId=folder.id;
        item.setAttribute('style', ITEM_STYLE+(isSel?';background:'+C_ACTIVE+';font-weight:500;':''));
        var iconEl=document.createElement('span'); iconEl.style.cssText='display:flex;align-items:center;color:'+C_TEXT; iconEl.innerHTML=folderSVG();
        var nameEl=document.createElement('span'); nameEl.className='taz-folder-name'; nameEl.style.cssText='flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'; nameEl.textContent=folder.name;
        var count=Object.values(_projectFolders).filter(function(fid){ return fid===folder.id; }).length;
        var badge=document.createElement('span'); badge.style.cssText='font-size:10px;padding:0 5px;background:rgba(245,240,236,.1);border-radius:8px;color:'+C_MUTED+';min-width:16px;text-align:center;'; badge.textContent=count||'';
        var acts=document.createElement('div'); acts.style.cssText='display:none;align-items:center;gap:1px;margin-left:2px;';
        function iconBtn(d,title){ var b=document.createElement('button'); b.title=title; b.style.cssText='background:none;border:none;cursor:pointer;padding:2px 3px;color:'+C_MUTED+';border-radius:3px;display:flex;align-items:center;'; b.innerHTML='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">'+d+'</svg>'; return b; }
        var renBtn=iconBtn('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>','Rename');
        var delBtn=iconBtn('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>','Delete');
        acts.appendChild(renBtn); acts.appendChild(delBtn);
        item.appendChild(iconEl); item.appendChild(nameEl); item.appendChild(badge); item.appendChild(acts); listEl.appendChild(item);
        item.addEventListener('mouseenter',function(){ if(!isSel) item.style.background=C_HOVER; acts.style.display='flex'; badge.style.display='none'; });
        item.addEventListener('mouseleave',function(){ if(!isSel) item.style.background=''; acts.style.display='none'; badge.style.display=''; });
        item.addEventListener('click',function(e){ if(acts.contains(e.target)) return; _selectedFolder=isSel?null:folder.id; renderFolderList(); applyFolderFilter(); updateAllHighlight(); });
        renBtn.addEventListener('click',function(e){ e.stopPropagation(); var inp=document.createElement('input'); inp.type='text'; inp.value=folder.name; inp.style.cssText='flex:1;border:1px solid '+C_TEAL+';border-radius:4px;padding:1px 4px;font-size:12px;font-family:Barlow,sans-serif;color:#1A3540;background:#F5F0EC;outline:none;min-width:0;'; nameEl.replaceWith(inp); inp.focus(); inp.select(); function commit(){ var v=inp.value.trim(); if(v&&v!==folder.name){ folder.name=v; apiRenameFolder(folder.id,v); } inp.replaceWith(nameEl); nameEl.textContent=folder.name; } inp.addEventListener('blur',commit); inp.addEventListener('keydown',function(ev){ if(ev.key==='Enter'){ ev.preventDefault(); commit(); } if(ev.key==='Escape') inp.replaceWith(nameEl); }); });
        delBtn.addEventListener('click',function(e){ e.stopPropagation(); if(!confirm('Delete folder \u201c'+folder.name+'\u201d? Projects inside will move to All Projects.')) return; apiDeleteFolder(folder.id).then(function(){ _folders=_folders.filter(function(f){ return f.id!==folder.id; }); Object.keys(_projectFolders).forEach(function(pid){ if(_projectFolders[pid]===folder.id) delete _projectFolders[pid]; }); if(_selectedFolder===folder.id) _selectedFolder=null; renderFolderList(); applyFolderFilter(); updateAllHighlight(); }); });
        makeFolderDropTarget(item, folder.id);
      });
    }
    function updateAllHighlight() { var btn=document.getElementById('taz-all-proj-btn'); if(!btn) return; btn.style.background=_selectedFolder===null?C_ACTIVE:''; btn.style.fontWeight=_selectedFolder===null?'500':'400'; }
    function injectFolderSidebar() {
      if (document.getElementById('taz-folders-section')) return;
      var nav = document.querySelector('.dash-nav'); if (!nav) return;
      var firstSep = nav.querySelector('.dash-nav-sep');
      var section = document.createElement('div'); section.id='taz-folders-section'; section.style.cssText='padding:4px 0 6px;';
      var allBtn = document.createElement('div'); allBtn.id='taz-all-proj-btn'; allBtn.setAttribute('style',ITEM_STYLE+';margin-bottom:2px;');
      allBtn.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;opacity:.6"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg><span>All Projects</span>';
      allBtn.addEventListener('mouseenter',function(){ if(_selectedFolder!==null) allBtn.style.background=C_HOVER; });
      allBtn.addEventListener('mouseleave',function(){ if(_selectedFolder!==null) allBtn.style.background=''; });
      allBtn.addEventListener('click',function(){ _selectedFolder=null; renderFolderList(); applyFolderFilter(); updateAllHighlight(); });
      makeFolderDropTarget(allBtn, null);
      var header=document.createElement('div'); header.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:8px 8px 3px;font-family:Barlow Condensed,sans-serif;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:'+C_MUTED+';';
      var hLabel=document.createElement('span'); hLabel.textContent='Folders';
      var newBtn=document.createElement('button'); newBtn.title='New folder'; newBtn.style.cssText='background:none;border:none;cursor:pointer;color:'+C_MUTED+';padding:0;display:flex;align-items:center;transition:color 140ms;';
      newBtn.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
      newBtn.addEventListener('mouseenter',function(){ newBtn.style.color=C_TEAL; }); newBtn.addEventListener('mouseleave',function(){ newBtn.style.color=C_MUTED; });
      newBtn.addEventListener('click',function(){ var name=window.prompt('Folder name:'); if(!name||!name.trim()) return; apiCreateFolder(name.trim()).then(function(r){ if(r.ok&&r.folder){ _folders.push(r.folder); renderFolderList(); } }); });
      header.appendChild(hLabel); header.appendChild(newBtn);
      var listEl=document.createElement('div'); listEl.id='taz-folder-list';
      section.appendChild(allBtn); section.appendChild(header); section.appendChild(listEl);
      if (firstSep) nav.insertBefore(section, firstSep); else nav.appendChild(section);
      renderFolderList(); updateAllHighlight();
    }
    function interceptDuplicate() {
      if (typeof window.dashDuplicateProject!=='function'||window.dashDuplicateProject._tazWrapped) return;
      var origDup=window.dashDuplicateProject;
      window.dashDuplicateProject=function(projectId){ showDuplicateModal(projectId,origDup); };
      window.dashDuplicateProject._tazWrapped=true;
    }
    function showDuplicateModal(projectId, origFn) {
      var existing=document.getElementById('taz-dup-modal'); if(existing) existing.remove();
      var modal=document.createElement('div'); modal.id='taz-dup-modal'; modal.style.cssText='position:fixed;inset:0;z-index:850;background:rgba(26,53,64,.55);display:flex;align-items:center;justify-content:center;';
      var card=document.createElement('div'); card.style.cssText='background:#ffffff;border-radius:16px;padding:24px 28px;width:360px;max-width:92vw;font-family:Barlow,sans-serif;box-shadow:0 8px 32px rgba(26,53,64,.18);';
      var currentFolderId=_projectFolders[projectId]||null, selectedIdx=0, opts=[];
      opts.push({ label:currentFolderId?'Same folder':'All Projects (no folder)', folderId:currentFolderId });
      _folders.forEach(function(f){ if(f.id!==currentFolderId) opts.push({ label:f.name, folderId:f.id }); });
      opts.push({ label:'New folder\u2026', folderId:'__new__' }); var newFolderIdx=opts.length-1;
      card.innerHTML='<div style="font-family:Barlow Condensed,sans-serif;font-size:17px;font-weight:700;color:#1A3540;margin-bottom:4px;">Duplicate project</div>'
        +'<p style="font-size:13px;color:rgba(26,53,64,.55);margin:0 0 14px;">Where would you like to save the copy?</p>'
        +'<div id="taz-dup-opts" style="display:flex;flex-direction:column;gap:5px;margin-bottom:14px;"></div>'
        +'<div id="taz-dup-new-wrap" style="display:none;margin-bottom:14px;"><input id="taz-dup-new-inp" type="text" placeholder="New folder name\u2026" style="width:100%;box-sizing:border-box;border:1px solid rgba(26,53,64,.2);border-radius:8px;padding:7px 10px;font-family:Barlow,sans-serif;font-size:13px;color:#1A3540;outline:none;"/></div>'
        +'<div style="display:flex;justify-content:flex-end;gap:8px;"><button id="taz-dup-cancel" style="background:none;border:1px solid rgba(26,53,64,.2);border-radius:999px;padding:0 18px;height:34px;font-family:Barlow,sans-serif;font-size:13px;cursor:pointer;color:#1A3540;">Cancel</button><button id="taz-dup-confirm" style="background:#4E8D99;border:none;border-radius:999px;padding:0 18px;height:34px;font-family:Barlow,sans-serif;font-size:13px;color:#fff;cursor:pointer;font-weight:600;">Duplicate</button></div>';
      modal.appendChild(card); document.body.appendChild(modal);
      var optsWrap=card.querySelector('#taz-dup-opts'), newWrap=card.querySelector('#taz-dup-new-wrap'), newInp=card.querySelector('#taz-dup-new-inp');
      opts.forEach(function(opt,i){ var row=document.createElement('label'); row.style.cssText='display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:8px;border:1px solid rgba(26,53,64,.12);cursor:pointer;font-size:13px;color:#1A3540;'; var radio=document.createElement('input'); radio.type='radio'; radio.name='taz-dup-dest'; radio.value=String(i); if(i===0) radio.checked=true; radio.style.accentColor=C_TEAL; row.appendChild(radio); row.appendChild(document.createTextNode(opt.label)); optsWrap.appendChild(row); radio.addEventListener('change',function(){ selectedIdx=i; newWrap.style.display=(i===newFolderIdx)?'block':'none'; if(i===newFolderIdx) setTimeout(function(){ newInp.focus(); },0); }); });
      card.querySelector('#taz-dup-cancel').addEventListener('click',function(){ modal.remove(); });
      modal.addEventListener('click',function(e){ if(e.target===modal) modal.remove(); });
      card.querySelector('#taz-dup-confirm').addEventListener('click',function(){ modal.remove(); var chosen=opts[selectedIdx]; if(chosen.folderId==='__new__'){ var newName=newInp.value.trim(); if(newName){ apiCreateFolder(newName).then(function(r){ var fid=(r.ok&&r.folder)?r.folder.id:null; if(r.ok&&r.folder){ _folders.push(r.folder); renderFolderList(); } runDuplicate(projectId,origFn,fid); }); } else runDuplicate(projectId,origFn,null); } else runDuplicate(projectId,origFn,chosen.folderId); });
    }
    function runDuplicate(projectId, origFn, targetFolderId) {
      var before={}; var area=document.getElementById('dash-project-area');
      if(area) area.querySelectorAll('[data-taz-tagged]').forEach(function(c){ before[c.dataset.tazTagged]=true; });
      origFn(projectId); if(!targetFolderId) return;
      var attempts=0, poll=setInterval(function(){ if(++attempts>24){ clearInterval(poll); return; } fetch('/api/projects',{headers:hdrs()}).then(function(r){ return r.json(); }).then(function(d){ var found=(d.projects||[]).find(function(p){ return !before[p.id]; }); if(found){ clearInterval(poll); _projectFolders[found.id]=targetFolderId; apiMoveProject(found.id,targetFolderId); applyFolderFilter(); renderFolderList(); } }); },500);
    }
    function init() {
      loadFolderData().then(function(){ injectFolderSidebar(); applyFolderFilter(); var area=document.getElementById('dash-project-area'); if(area){ setupCardDrag(); new MutationObserver(function(){ setupCardDrag(); applyFolderFilter(); }).observe(area,{childList:true,subtree:true}); } new MutationObserver(function(){ if(!document.getElementById('taz-folders-section')) injectFolderSidebar(); interceptDuplicate(); }).observe(document.body,{childList:true,subtree:false}); interceptDuplicate(); });
    }
    function waitForDashboard() { if(typeof window.showDashboard!=='function'){ setTimeout(waitForDashboard,60); return; } var orig=window.showDashboard, done=false; window.showDashboard=function(){ orig.apply(this,arguments); if(done) return; done=true; init(); }; }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',waitForDashboard);
    else waitForDashboard();
  }());

  /* ── Themes system ── */
  (function () {
    var _themes = [];

    function hdrs() {
      var t = null; try { t = localStorage.getItem('tazzet_jwt'); } catch (_) {}
      return t ? { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
    }
    function apiLoadThemes()      { return fetch('/api/themes', { headers: hdrs() }).then(function (r) { return r.json(); }); }
    function apiCreateTheme(d)    { return fetch('/api/themes', { method:'POST', headers:hdrs(), body:JSON.stringify(d) }).then(function (r) { return r.json(); }); }
    function apiUpdateTheme(id,d) { return fetch('/api/themes/'+id, { method:'PUT', headers:hdrs(), body:JSON.stringify(d) }).then(function (r) { return r.json(); }); }
    function apiDeleteTheme(id)   { return fetch('/api/themes/'+id, { method:'DELETE', headers:hdrs() }).then(function (r) { return r.json(); }); }
    function apiSetDefault(id)    { return fetch('/api/themes/'+id+'/default', { method:'PUT', headers:hdrs() }).then(function (r) { return r.json(); }); }

    var BLANK_THEME = {
      colours: { primary:'#4E8D99', secondary:'#EBBA95', accent:'#6D445E', background:'#FFFFFF', surface:'#F5F0EC', textBody:'#1A3540', textHeading:'#1A3540' },
      typography: { headingFont:'Barlow Condensed', bodyFont:'Barlow', headingWeight:'700', bodyWeight:'400', baseFontSize:'16' }
    };
    var FONT_OPTIONS = ['Barlow Condensed','Barlow','Inter','Roboto','Open Sans','Lato','Poppins','Montserrat','Raleway','Source Sans Pro','Nunito','Playfair Display','Merriweather','Georgia','Arial'];

    function publishDefault() {
      var def = _themes.find(function (t) { return t.isDefault; });
      window.TAZ_DEFAULT_THEME = def ? JSON.parse(JSON.stringify(def.data)) : null;
    }

    function swatchesHTML(data) {
      if (!data || !data.colours) return '';
      return ['primary','secondary','accent','background','surface','textBody','textHeading'].map(function (k) {
        var v = data.colours[k] || '#ccc';
        return '<span title="'+k+'" style="display:inline-block;width:14px;height:14px;border-radius:3px;background:'+v+';border:1px solid rgba(0,0,0,.1);margin-right:2px;"></span>';
      }).join('');
    }

    function buildThemeFormFields(existing) {
      var data = existing ? JSON.parse(JSON.stringify(existing)) : JSON.parse(JSON.stringify(BLANK_THEME));
      var el = document.createElement('div'); el.className = 'taz-theme-form-fields';

      var colHead = document.createElement('div'); colHead.style.cssText='font-family:Barlow Condensed,sans-serif;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:rgba(26,53,64,.4);margin:0 0 10px;'; colHead.textContent='Colours'; el.appendChild(colHead);
      var colGrid = document.createElement('div'); colGrid.style.cssText='display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-bottom:20px;';
      [{ key:'primary',label:'Primary colour' },{ key:'secondary',label:'Secondary colour' },{ key:'accent',label:'Accent colour' },{ key:'background',label:'Background' },{ key:'surface',label:'Surface / card' },{ key:'textBody',label:'Body text' },{ key:'textHeading',label:'Heading text' }].forEach(function (def) {
        var row=document.createElement('div'); row.style.cssText='display:flex;align-items:center;gap:8px;';
        var lbl=document.createElement('label'); lbl.style.cssText='flex:1;font-family:Barlow,sans-serif;font-size:13px;color:#1A3540;'; lbl.textContent=def.label;
        var picker=document.createElement('input'); picker.type='color'; picker.value=(data.colours[def.key]||'#ffffff'); picker.dataset.key=def.key; picker.style.cssText='width:36px;height:28px;padding:1px;border:1px solid rgba(26,53,64,.2);border-radius:6px;cursor:pointer;background:none;';
        picker.addEventListener('input', function () { data.colours[def.key]=picker.value; });
        row.appendChild(lbl); row.appendChild(picker); colGrid.appendChild(row);
      });
      el.appendChild(colGrid);

      var typHead = document.createElement('div'); typHead.style.cssText='font-family:Barlow Condensed,sans-serif;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:rgba(26,53,64,.4);margin:0 0 10px;'; typHead.textContent='Typography'; el.appendChild(typHead);
      var typGrid = document.createElement('div'); typGrid.style.cssText='display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-bottom:16px;';
      [{ key:'headingFont',label:'Heading font',type:'font' },{ key:'bodyFont',label:'Body font',type:'font' },{ key:'headingWeight',label:'Heading weight',type:'weight' },{ key:'bodyWeight',label:'Body weight',type:'weight' },{ key:'baseFontSize',label:'Base font size (px)',type:'size' }].forEach(function (def) {
        var row=document.createElement('div'); row.style.cssText='display:flex;align-items:center;gap:8px;';
        var lbl=document.createElement('label'); lbl.style.cssText='flex:1;font-family:Barlow,sans-serif;font-size:13px;color:#1A3540;'; lbl.textContent=def.label;
        var SF='border:1px solid rgba(26,53,64,.2);border-radius:6px;padding:4px 7px;font-family:Barlow,sans-serif;font-size:12px;color:#1A3540;background:#fff;cursor:pointer;min-width:0;'; var ctrl;
        if (def.type==='font') { ctrl=document.createElement('select'); ctrl.style.cssText=SF+'flex:1;'; FONT_OPTIONS.forEach(function(f){ var opt=document.createElement('option'); opt.value=f; opt.textContent=f; if(f===data.typography[def.key]) opt.selected=true; ctrl.appendChild(opt); }); ctrl.addEventListener('change',function(){ data.typography[def.key]=ctrl.value; }); }
        else if (def.type==='weight') { ctrl=document.createElement('select'); ctrl.style.cssText=SF+'width:90px;'; ['300','400','500','600','700','800'].forEach(function(w){ var opt=document.createElement('option'); opt.value=w; opt.textContent=w; if(w===String(data.typography[def.key])) opt.selected=true; ctrl.appendChild(opt); }); ctrl.addEventListener('change',function(){ data.typography[def.key]=ctrl.value; }); }
        else { ctrl=document.createElement('input'); ctrl.type='number'; ctrl.min='10'; ctrl.max='32'; ctrl.value=data.typography[def.key]||'16'; ctrl.style.cssText=SF+'width:70px;text-align:center;'; ctrl.addEventListener('input',function(){ data.typography[def.key]=ctrl.value; }); }
        row.appendChild(lbl); row.appendChild(ctrl); typGrid.appendChild(row);
      });
      el.appendChild(typGrid);
      el.getData = function () { return JSON.parse(JSON.stringify(data)); };
      return el;
    }

    function openThemeModal(theme) {
      var isNew = !theme;
      var existing = document.getElementById('taz-theme-modal'); if (existing) existing.remove();
      var overlay = document.createElement('div'); overlay.id='taz-theme-modal'; overlay.style.cssText='position:fixed;inset:0;z-index:8000;background:rgba(26,53,64,.6);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';
      var card = document.createElement('div'); card.style.cssText='background:#ffffff;border-radius:16px;padding:28px;width:640px;max-width:100%;max-height:90vh;overflow-y:auto;font-family:Barlow,sans-serif;box-shadow:0 12px 40px rgba(26,53,64,.2);box-sizing:border-box;';
      var titleEl = document.createElement('div'); titleEl.style.cssText='font-family:Barlow Condensed,sans-serif;font-size:20px;font-weight:700;color:#1A3540;margin-bottom:18px;'; titleEl.textContent=isNew?'Create theme':'Edit theme';
      var nameWrap=document.createElement('div'); nameWrap.style.cssText='margin-bottom:20px;';
      var nameLbl=document.createElement('label'); nameLbl.style.cssText='display:block;font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:rgba(26,53,64,.5);margin-bottom:5px;'; nameLbl.textContent='Theme name';
      var nameInp=document.createElement('input'); nameInp.type='text'; nameInp.maxLength=80; nameInp.placeholder='e.g. Amplify Infrastructure, Client ABC'; nameInp.value=isNew?'':(theme.name||''); nameInp.style.cssText='width:100%;box-sizing:border-box;border:1px solid rgba(26,53,64,.22);border-radius:8px;padding:8px 12px;font-family:Barlow,sans-serif;font-size:14px;color:#1A3540;outline:none;';
      nameInp.addEventListener('focus',function(){ nameInp.style.borderColor='#4E8D99'; }); nameInp.addEventListener('blur',function(){ nameInp.style.borderColor='rgba(26,53,64,.22)'; });
      nameWrap.appendChild(nameLbl); nameWrap.appendChild(nameInp);
      var fields=buildThemeFormFields(isNew?null:theme.data);
      var defRow=document.createElement('div'); defRow.style.cssText='display:flex;align-items:center;gap:8px;margin-bottom:20px;';
      var defChk=document.createElement('input'); defChk.type='checkbox'; defChk.id='taz-theme-set-default'; defChk.style.accentColor='#4E8D99'; defChk.checked=isNew?false:!!theme.isDefault;
      var defLbl=document.createElement('label'); defLbl.htmlFor='taz-theme-set-default'; defLbl.style.cssText='font-size:13px;color:#1A3540;cursor:pointer;'; defLbl.textContent='Set as workspace default for new projects';
      defRow.appendChild(defChk); defRow.appendChild(defLbl);
      var btnRow=document.createElement('div'); btnRow.style.cssText='display:flex;justify-content:flex-end;gap:8px;padding-top:4px;';
      var cancelBtn=document.createElement('button'); cancelBtn.textContent='Cancel'; cancelBtn.style.cssText='background:none;border:1px solid rgba(26,53,64,.2);border-radius:999px;padding:0 20px;height:36px;font-family:Barlow,sans-serif;font-size:13px;cursor:pointer;color:#1A3540;';
      var saveBtn=document.createElement('button'); saveBtn.textContent=isNew?'Create theme':'Save changes'; saveBtn.style.cssText='background:#4E8D99;border:none;border-radius:999px;padding:0 20px;height:36px;font-family:Barlow,sans-serif;font-size:13px;color:#fff;cursor:pointer;font-weight:600;';
      btnRow.appendChild(cancelBtn); btnRow.appendChild(saveBtn);
      card.appendChild(titleEl); card.appendChild(nameWrap); card.appendChild(fields); card.appendChild(defRow); card.appendChild(btnRow);
      overlay.appendChild(card); document.body.appendChild(overlay);
      cancelBtn.addEventListener('click',function(){ overlay.remove(); });
      overlay.addEventListener('click',function(e){ if(e.target===overlay) overlay.remove(); });
      document.addEventListener('keydown',function escClose(e){ if(e.key==='Escape'){ overlay.remove(); document.removeEventListener('keydown',escClose); } });
      saveBtn.addEventListener('click',function(){
        var name=nameInp.value.trim(); if(!name){ nameInp.focus(); nameInp.style.borderColor='#E04E4E'; return; }
        saveBtn.disabled=true; saveBtn.textContent='Saving\u2026';
        var payload={ name:name, data:fields.getData(), isDefault:defChk.checked };
        var call=isNew?apiCreateTheme(payload):apiUpdateTheme(theme.id,{ name:name, data:fields.getData() });
        call.then(function(r){
          if(!r.ok){ saveBtn.disabled=false; saveBtn.textContent=isNew?'Create theme':'Save changes'; return; }
          var needDefault=defChk.checked&&(isNew?(r.theme&&!r.theme.isDefault):!theme.isDefault);
          var theId=isNew?(r.theme&&r.theme.id):theme.id;
          var after=(needDefault&&theId)?apiSetDefault(theId):Promise.resolve({ ok:true });
          after.then(function(){ overlay.remove(); apiLoadThemes().then(function(d){ _themes=d.themes||[]; publishDefault(); renderThemeList(); }); });
        });
      });
    }

    function renderThemeList() {
      var listEl = document.getElementById('taz-theme-list'); if (!listEl) return;
      listEl.innerHTML = '';
      if (!_themes.length) { listEl.innerHTML='<div style="padding:24px 0;text-align:center;font-family:Barlow,sans-serif;font-size:14px;color:rgba(26,53,64,.4);">No themes yet. Create one to get started.</div>'; return; }
      _themes.forEach(function (theme) {
        var row=document.createElement('div'); row.style.cssText='display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid rgba(26,53,64,.1);border-radius:10px;margin-bottom:8px;background:#fff;';
        var swatches=document.createElement('div'); swatches.style.cssText='display:flex;align-items:center;flex-shrink:0;'; swatches.innerHTML=swatchesHTML(theme.data);
        var info=document.createElement('div'); info.style.cssText='flex:1;min-width:0;';
        var nameSpan=document.createElement('div'); nameSpan.style.cssText='font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:700;color:#1A3540;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'; nameSpan.textContent=theme.name; info.appendChild(nameSpan);
        if (theme.isDefault) { var badge=document.createElement('span'); badge.style.cssText='display:inline-block;margin-top:3px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#4E8D99;background:rgba(78,141,153,.1);border:1px solid rgba(78,141,153,.3);border-radius:4px;padding:1px 6px;'; badge.textContent='Default'; info.appendChild(badge); }
        var acts=document.createElement('div'); acts.style.cssText='display:flex;align-items:center;gap:6px;flex-shrink:0;';
        function actBtn(lbl,bg,fg){ var b=document.createElement('button'); b.textContent=lbl; b.style.cssText='border:none;border-radius:999px;padding:0 12px;height:28px;font-family:Barlow,sans-serif;font-size:12px;cursor:pointer;background:'+bg+';color:'+fg+';font-weight:500;white-space:nowrap;'; return b; }
        if (!theme.isDefault) { var setDefBtn=actBtn('Set default','rgba(78,141,153,.12)','#4E8D99'); setDefBtn.addEventListener('click',function(){ setDefBtn.disabled=true; apiSetDefault(theme.id).then(function(){ apiLoadThemes().then(function(d){ _themes=d.themes||[]; publishDefault(); renderThemeList(); }); }); }); acts.appendChild(setDefBtn); }
        var editBtn=actBtn('Edit','rgba(26,53,64,.07)','#1A3540'); editBtn.addEventListener('click',function(){ openThemeModal(theme); }); acts.appendChild(editBtn);
        var delBtn=actBtn('Delete','rgba(224,78,78,.08)','#C0392B'); delBtn.addEventListener('click',function(){ if(!confirm('Delete theme \u201c'+theme.name+'\u201d? This cannot be undone.')) return; delBtn.disabled=true; apiDeleteTheme(theme.id).then(function(){ apiLoadThemes().then(function(d){ _themes=d.themes||[]; publishDefault(); renderThemeList(); }); }); }); acts.appendChild(delBtn);
        row.appendChild(swatches); row.appendChild(info); row.appendChild(acts); listEl.appendChild(row);
      });
    }

    function injectThemesTab() {
      if (document.getElementById('stab-themes')) return;
      var tabBar=document.querySelector('.settings-tabs');
      if (tabBar&&!tabBar.querySelector('[data-taz-themes-tab]')) { var tabBtn=document.createElement('button'); tabBtn.className='settings-tab'; tabBtn.setAttribute('data-taz-themes-tab','1'); tabBtn.textContent='Themes'; tabBtn.setAttribute('onclick',"settingsTab('themes')"); tabBar.appendChild(tabBtn); }
      var modal=document.querySelector('.settings-modal'); if(!modal) return;
      var pane=document.createElement('div'); pane.id='stab-themes'; pane.className='settings-body'; pane.style.display='none';
      var hdr=document.createElement('div'); hdr.style.cssText='display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;';
      var hdrLeft=document.createElement('div');
      var hdrTitle=document.createElement('div'); hdrTitle.style.cssText='font-family:Barlow Condensed,sans-serif;font-size:18px;font-weight:700;color:#1A3540;'; hdrTitle.textContent='Themes';
      var hdrSub=document.createElement('div'); hdrSub.style.cssText='font-size:13px;color:rgba(26,53,64,.5);margin-top:3px;'; hdrSub.textContent='Set the default colour palette and typography for new projects. Project-level settings always take priority.';
      hdrLeft.appendChild(hdrTitle); hdrLeft.appendChild(hdrSub);
      var newThemeBtn=document.createElement('button'); newThemeBtn.textContent='+ New theme'; newThemeBtn.style.cssText='background:#4E8D99;border:none;border-radius:999px;padding:0 18px;height:36px;font-family:Barlow,sans-serif;font-size:13px;color:#fff;cursor:pointer;font-weight:600;flex-shrink:0;margin-left:16px;'; newThemeBtn.addEventListener('click',function(){ openThemeModal(null); });
      hdr.appendChild(hdrLeft); hdr.appendChild(newThemeBtn);
      var listEl=document.createElement('div'); listEl.id='taz-theme-list';
      pane.appendChild(hdr); pane.appendChild(listEl); modal.appendChild(pane);
      if (typeof window.settingsTab==='function'&&!window.settingsTab._tazThemesWrapped) {
        var orig=window.settingsTab;
        window.settingsTab=function settingsTab(tab){
          if(tab!=='themes'){ var tp=document.getElementById('stab-themes'); if(tp) tp.style.display='none'; var tb=document.querySelector('[data-taz-themes-tab]'); if(tb) tb.classList.remove('active'); return orig.apply(this,arguments); }
          document.querySelectorAll('.settings-body').forEach(function(p){ p.style.display='none'; });
          var myPane=document.getElementById('stab-themes'); if(myPane) myPane.style.display='';
          document.querySelectorAll('.settings-tab').forEach(function(b){ b.classList.remove('active'); });
          var myBtn=document.querySelector('[data-taz-themes-tab]'); if(myBtn) myBtn.classList.add('active');
          apiLoadThemes().then(function(d){ _themes=d.themes||[]; publishDefault(); renderThemeList(); });
        };
        window.settingsTab._tazThemesWrapped=true;
      }
      apiLoadThemes().then(function(d){ _themes=d.themes||[]; publishDefault(); renderThemeList(); });
    }

    function watchForSettings() {
      new MutationObserver(function(){ if(document.querySelector('.settings-modal')&&!document.getElementById('stab-themes')) injectThemesTab(); }).observe(document.body,{ childList:true, subtree:true });
      if(document.querySelector('.settings-modal')) injectThemesTab();
    }

    function initThemes() {
      apiLoadThemes().then(function(d){ _themes=d.themes||[]; publishDefault(); }).catch(function(){});
      watchForSettings();
    }

    function waitForApp() {
      if(typeof window.showDashboard!=='function'){ setTimeout(waitForApp,60); return; }
      var orig=window.showDashboard, done=false;
      window.showDashboard=function(){ orig.apply(this,arguments); if(done) return; done=true; initThemes(); };
    }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',waitForApp);
    else waitForApp();
  }());

  /* ── Hide Text Styles and Colour Palette from left panel ── */
  (function () {
    if (!document.getElementById('taz-ts-hide-style')) {
      var s = document.createElement('style');
      s.id = 'taz-ts-hide-style';
      s.textContent = '#nav-theme-content>[data-taz-ts-heading],' +
                      '#nav-theme-content>[data-taz-ts-heading]~*,' +
                      '#nav-theme-content>[data-taz-palette-heading],' +
                      '#nav-theme-content>.ts-palette-grid{display:none!important}';
      document.head.appendChild(s);
    }
    function markHeadings() {
      var nav = document.getElementById('nav-theme-content'); if (!nav) return;
      nav.querySelectorAll('.ts-sect').forEach(function (el) {
        var t = el.textContent.trim();
        if (/^text\s+styles$/i.test(t))    el.setAttribute('data-taz-ts-heading',     '1');
        if (/^colou?r\s+palette$/i.test(t)) el.setAttribute('data-taz-palette-heading','1');
      });
    }
    markHeadings();
    new MutationObserver(function (muts) {
      if (muts.some(function (m) { return m.addedNodes.length; })) markHeadings();
    }).observe(document.body, { childList: true, subtree: true });
  }());

  /* ── Hide Theme toolbar pill and Theme left-panel tab ── */
  (function () {
    if (!document.getElementById('taz-theme-hide-style')) {
      var s = document.createElement('style');
      s.id = 'taz-theme-hide-style';
      s.textContent = '.etool-theme{display:none!important}' +
                      '.edit-nav-tab[data-taz-theme-nav]{display:none!important}';
      document.head.appendChild(s);
    }
    function markThemeNavTab() {
      document.querySelectorAll('.edit-nav-tab').forEach(function (btn) {
        if (/^theme$/i.test(btn.textContent.trim())) {
          btn.setAttribute('data-taz-theme-nav', '1');
        }
      });
    }
    markThemeNavTab();
    new MutationObserver(function (muts) {
      if (muts.some(function (m) { return m.addedNodes.length; })) markThemeNavTab();
    }).observe(document.body, { childList: true, subtree: true });
  }());

  /* ── Project Settings ── */
  (function () {

    function hdrs() {
      var t = null; try { t = localStorage.getItem('tazzet_jwt'); } catch (_) {}
      return t ? { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
    }

    function workspaceThemeToPalette(c) {
      function darken(hex, pct) {
        if (!hex || hex.charAt(0) !== '#' || hex.length < 7) return hex || '#000000';
        var r = Math.round(parseInt(hex.slice(1,3),16) * (1-pct));
        var g = Math.round(parseInt(hex.slice(3,5),16) * (1-pct));
        var b = Math.round(parseInt(hex.slice(5,7),16) * (1-pct));
        return '#' + [r,g,b].map(function(v){ return ('0'+Math.max(0,Math.min(255,v)).toString(16)).slice(-2); }).join('');
      }
      var pri = c.primary     || '#4E8D99';
      var sec = c.secondary   || '#EBBA95';
      var acc = c.accent      || '#6D445E';
      return {
        bg1:     c.background  || '#FFFFFF',
        bg2:     c.surface     || '#F5F0EC',
        text1:   c.textBody    || '#1A3540',
        text2:   c.textHeading || '#1A3540',
        accent1: pri,
        accent2: sec,
        accent3: acc,
        accent4: darken(pri, 0.2),
        accent5: darken(sec, 0.2),
        accent6: darken(acc, 0.2)
      };
    }

    function workspaceThemeToEditTheme(ws) {
      var c  = (ws && ws.colours)    || {};
      var ty = (ws && ws.typography) || {};
      var hFont  = ty.headingFont  || 'Barlow Condensed';
      var bFont  = ty.bodyFont     || 'Barlow';
      var hW     = parseInt(ty.headingWeight) || 700;
      var bW     = parseInt(ty.bodyWeight)    || 400;
      var bSize  = parseFloat(ty.baseFontSize) || 16;
      var bg     = c.background  || '#FFFFFF';
      var tHead  = c.textHeading || '#1A3540';
      var tBody  = c.textBody    || '#1A3540';
      var pri    = c.primary     || '#4E8D99';
      var sec    = c.secondary   || '#EBBA95';
      var acc    = c.accent      || '#6D445E';
      return {
        heading:    { name:'Heading',      fontFamily:hFont, fontFallback:'serif',      fontSize:32,    fontWeight:hW,  letterSpacing:0,     lineHeight:1.25, textTransform:'none',      colorDark:tHead, colorLight:bg   },
        subheading: { name:'Subheading',   fontFamily:bFont, fontFallback:'sans-serif', fontSize:20,    fontWeight:hW,  letterSpacing:0,     lineHeight:1.4,  textTransform:'none',      colorDark:tHead, colorLight:bg   },
        body:       { name:'Body text',    fontFamily:bFont, fontFallback:'sans-serif', fontSize:bSize, fontWeight:bW,  letterSpacing:-0.01, lineHeight:1.75, textTransform:'none',      colorDark:tBody, colorLight:bg   },
        caption:    { name:'Caption',      fontFamily:bFont, fontFallback:'sans-serif', fontSize:12,    fontWeight:bW,  letterSpacing:0,     lineHeight:1.4,  textTransform:'none',      colorDark:acc,   colorLight:acc  },
        label:      { name:'Type label',   fontFamily:bFont, fontFallback:'sans-serif', fontSize:11,    fontWeight:700, letterSpacing:0.08,  lineHeight:1.2,  textTransform:'uppercase', colorDark:acc,   colorLight:sec  },
        callout:    { name:'Callout title',fontFamily:bFont, fontFallback:'sans-serif', fontSize:12,    fontWeight:700, letterSpacing:0.08,  lineHeight:1.2,  textTransform:'uppercase', colorDark:pri,   colorLight:pri  },
        quote:      { name:'Quote text',   fontFamily:hFont, fontFallback:'serif',      fontSize:22,    fontWeight:hW,  letterSpacing:0,     lineHeight:1.7,  textTransform:'none',      colorDark:tHead, colorLight:bg   },
        attribution:{ name:'Attribution',  fontFamily:bFont, fontFallback:'sans-serif', fontSize:14,    fontWeight:700, letterSpacing:0.02,  lineHeight:1.4,  textTransform:'none',      colorDark:pri,   colorLight:pri  }
      };
    }

    var FIELD_STYLE = 'width:100%;box-sizing:border-box;border:1px solid rgba(26,53,64,.18);border-radius:8px;padding:8px 12px;font-family:Barlow,sans-serif;font-size:14px;color:#1A3540;outline:none;background:#fff;';
    var LABEL_STYLE = 'display:block;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:rgba(26,53,64,.45);margin-bottom:5px;font-family:Barlow,sans-serif;';

    function field(labelText, input) {
      var wrap = document.createElement('div'); wrap.style.cssText = 'margin-bottom:16px;';
      var lbl = document.createElement('label'); lbl.style.cssText = LABEL_STYLE; lbl.textContent = labelText;
      wrap.appendChild(lbl); wrap.appendChild(input); return wrap;
    }

    function restoreTsToNav(containerEl) {
      var nav = document.getElementById('nav-theme-content'); if (!nav) return;
      var src = containerEl || document.getElementById('taz-ts-container');
      if (!src || !src.children.length) return;
      Array.from(src.children).forEach(function (el) { nav.appendChild(el); });
    }

    function restorePaletteToNav(containerEl) {
      var nav = document.getElementById('nav-theme-content'); if (!nav) return;
      var src = containerEl || document.getElementById('taz-palette-container');
      if (!src || !src.children.length) return;
      var anchor = nav.querySelector('[data-taz-ts-heading]') || nav.firstChild || null;
      Array.from(src.children).forEach(function (el) { nav.insertBefore(el, anchor); });
    }

    function openProjectSettings(startTab) {
      var existing = document.getElementById('taz-proj-settings'); if (existing) existing.remove();

      var overlay = document.createElement('div');
      overlay.id = 'taz-proj-settings';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(26,53,64,.5);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';

      var modal = document.createElement('div');
      modal.style.cssText = 'background:#F5F0EC;border-radius:16px;width:680px;max-width:100%;max-height:88vh;display:flex;flex-direction:column;font-family:Barlow,sans-serif;box-shadow:0 12px 40px rgba(26,53,64,.22);overflow:hidden;';

      var hdr = document.createElement('div');
      hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:20px 24px 0;flex-shrink:0;';
      var hTitle = document.createElement('div');
      hTitle.style.cssText = 'font-family:Barlow Condensed,sans-serif;font-size:20px;font-weight:700;color:#1A3540;';
      hTitle.textContent = 'Project Settings';
      var closeX = document.createElement('button');
      closeX.innerHTML = '&times;'; closeX.setAttribute('aria-label','Close');
      closeX.style.cssText = 'background:none;border:none;font-size:22px;line-height:1;cursor:pointer;color:rgba(26,53,64,.45);padding:0 4px;';
      hdr.appendChild(hTitle); hdr.appendChild(closeX);

      var tabBar = document.createElement('div');
      tabBar.style.cssText = 'display:flex;gap:0;padding:16px 24px 0;flex-shrink:0;border-bottom:2px solid rgba(26,53,64,.1);margin-top:12px;';

      var body = document.createElement('div');
      body.style.cssText = 'flex:1;overflow-y:auto;padding:24px;';

      var footer = document.createElement('div');
      footer.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;padding:16px 24px;flex-shrink:0;border-top:1px solid rgba(26,53,64,.1);background:#F5F0EC;';

      modal.appendChild(hdr); modal.appendChild(tabBar); modal.appendChild(body); modal.appendChild(footer);
      overlay.appendChild(modal); document.body.appendChild(overlay);

      var currentTab = startTab || 'details';

      function closeModal() {
        if (currentTab === 'textstyles') restoreTsToNav(document.getElementById('taz-ts-container'));
        if (currentTab === 'theme') restorePaletteToNav(document.getElementById('taz-palette-container'));
        overlay.remove();
      }

      closeX.addEventListener('click', closeModal);
      overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
      document.addEventListener('keydown', function escClose(e) {
        if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', escClose); }
      });

      function tabBtn(id, label) {
        var b = document.createElement('button');
        b.textContent = label; b.dataset.tabId = id;
        b.style.cssText = 'background:none;border:none;border-bottom:2px solid transparent;padding:6px 16px 10px;font-family:Barlow,sans-serif;font-size:13px;font-weight:600;cursor:pointer;color:rgba(26,53,64,.5);margin-bottom:-2px;transition:color 140ms,border-color 140ms;';
        b.addEventListener('click', function () { switchTab(id); });
        return b;
      }

      var detailsBtn    = tabBtn('details',    'Lesson Details');
      var themeBtn      = tabBtn('theme',      'Theme');
      var textStylesBtn = tabBtn('textstyles', 'Text Styles');
      tabBar.appendChild(detailsBtn); tabBar.appendChild(themeBtn); tabBar.appendChild(textStylesBtn);

      function switchTab(id) {
        if (currentTab === 'textstyles' && id !== 'textstyles') {
          restoreTsToNav(document.getElementById('taz-ts-container'));
        }
        if (currentTab === 'theme' && id !== 'theme') {
          restorePaletteToNav(document.getElementById('taz-palette-container'));
        }
        currentTab = id;
        [detailsBtn, themeBtn, textStylesBtn].forEach(function (b) {
          var active = b.dataset.tabId === id;
          b.style.color       = active ? '#1A3540' : 'rgba(26,53,64,.5)';
          b.style.borderColor = active ? '#4E8D99' : 'transparent';
        });
        body.innerHTML = '';
        body.style.padding = '24px';
        footer.innerHTML = '';
        if (id === 'details') renderDetailsTab();
        else if (id === 'theme') renderThemeTab();
        else renderTextStylesTab();
      }

      function renderDetailsTab() {
        var ed = window._editData || {};
        var wiz = window._wizData || {};

        var titleInp = document.createElement('input'); titleInp.type='text'; titleInp.value=ed.title||wiz.title||''; titleInp.maxLength=200; titleInp.style.cssText=FIELD_STYLE;
        var audInp   = document.createElement('input'); audInp.type='text'; audInp.value=ed.audience||wiz.audience||''; audInp.maxLength=200; audInp.placeholder='e.g. All staff'; audInp.style.cssText=FIELD_STYLE;
        var durInp   = document.createElement('input'); durInp.type='number'; durInp.value=ed.duration||wiz.duration||''; durInp.min='1'; durInp.max='999'; durInp.placeholder='15'; durInp.style.cssText=FIELD_STYLE+'width:120px;';
        var sumTa    = document.createElement('textarea'); sumTa.value=ed.summary||''; sumTa.rows=3; sumTa.maxLength=600; sumTa.placeholder='A short description of this lesson\u2026'; sumTa.style.cssText=FIELD_STYLE+'resize:vertical;line-height:1.5;';

        [titleInp, audInp, durInp, sumTa].forEach(function (el) {
          el.addEventListener('focus', function () { el.style.borderColor='#4E8D99'; });
          el.addEventListener('blur',  function () { el.style.borderColor='rgba(26,53,64,.18)'; });
        });

        body.appendChild(field('Lesson title', titleInp));
        body.appendChild(field('Audience', audInp));
        body.appendChild(field('Duration (minutes)', durInp));
        body.appendChild(field('Summary', sumTa));

        var cancelBtn = document.createElement('button');
        cancelBtn.textContent='Cancel'; cancelBtn.style.cssText='background:none;border:1px solid rgba(26,53,64,.2);border-radius:999px;padding:0 20px;height:36px;font-family:Barlow,sans-serif;font-size:13px;cursor:pointer;color:#1A3540;';
        cancelBtn.addEventListener('click', closeModal);

        var saveBtn = document.createElement('button');
        saveBtn.textContent='Save'; saveBtn.style.cssText='background:#4E8D99;border:none;border-radius:999px;padding:0 20px;height:36px;font-family:Barlow,sans-serif;font-size:13px;color:#fff;cursor:pointer;font-weight:600;';
        saveBtn.addEventListener('click', function () {
          if (!window._editData) { closeModal(); return; }
          var newTitle = titleInp.value.trim();
          if (newTitle) window._editData.title = newTitle;
          window._editData.audience = audInp.value.trim();
          if (durInp.value) window._editData.duration = durInp.value;
          window._editData.summary = sumTa.value.trim();
          var titleTxt = document.querySelector('.edit-title-txt');
          if (titleTxt && newTitle) titleTxt.textContent = newTitle;
          if (typeof markDirty === 'function') markDirty();
          else if (typeof window._markDirty === 'function') window._markDirty();
          closeModal();
        });

        footer.appendChild(cancelBtn); footer.appendChild(saveBtn);
      }

      function renderThemeTab() {
        if (typeof navTab === 'function') navTab('theme');

        body.style.padding = '0';
        var palContainer = document.createElement('div');
        palContainer.id = 'taz-palette-container';
        palContainer.style.cssText = 'padding:16px 24px 14px;border-bottom:1px solid rgba(26,53,64,.1);';
        body.appendChild(palContainer);

        var _nav = document.getElementById('nav-theme-content');
        if (_nav) {
          _nav.querySelectorAll('.ts-sect').forEach(function (el) {
            if (/^colou?r\s+palette$/i.test(el.textContent.trim())) el.setAttribute('data-taz-palette-heading', '1');
          });
          var palHeading = _nav.querySelector('[data-taz-palette-heading]');
          var palGrid    = _nav.querySelector('.ts-palette-grid');
          if (palHeading) palContainer.appendChild(palHeading);
          if (palGrid)    palContainer.appendChild(palGrid);
        }

        var themeSection = document.createElement('div');
        themeSection.style.cssText = 'padding:20px 24px;';
        body.appendChild(themeSection);

        var loading = document.createElement('div');
        loading.style.cssText = 'text-align:center;font-size:13px;color:rgba(26,53,64,.4);padding:24px 0;';
        loading.textContent = 'Loading themes\u2026';
        themeSection.appendChild(loading);

        fetch('/api/themes', { headers: hdrs() })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            var themes = d.themes || [];
            themeSection.innerHTML = '';

            if (!themes.length) {
              var empty = document.createElement('div');
              empty.style.cssText = 'text-align:center;';
              empty.innerHTML = '<div style="font-size:14px;color:rgba(26,53,64,.5);margin-bottom:12px;">No workspace themes saved yet.</div>'
                + '<div style="font-size:13px;color:rgba(26,53,64,.35);">Create themes in <strong>Workspace Settings \u2192 Themes</strong> and they will appear here.</div>';
              themeSection.appendChild(empty);
              return;
            }

            var intro = document.createElement('div');
            intro.style.cssText = 'font-size:13px;color:rgba(26,53,64,.5);margin-bottom:16px;line-height:1.5;';
            intro.textContent = 'Choose a workspace theme to apply to this project. This overrides the default and updates the colour palette and typography used by the editor.';
            themeSection.appendChild(intro);

            var selectedId = null;
            var list = document.createElement('div');
            list.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

            themes.forEach(function (theme) {
              var row = document.createElement('div');
              row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:12px 14px;border:2px solid rgba(26,53,64,.1);border-radius:10px;background:#fff;cursor:pointer;transition:border-color 140ms,background 140ms;';
              row.dataset.themeId = theme.id;

              var swatches = document.createElement('div');
              swatches.style.cssText = 'display:flex;align-items:center;flex-shrink:0;';
              swatches.innerHTML = (function(data){
                if (!data || !data.colours) return '';
                return ['primary','secondary','accent','background','surface','textBody','textHeading'].map(function(k){
                  return '<span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:'+(data.colours[k]||'#ccc')+';border:1px solid rgba(0,0,0,.1);margin-right:2px;"></span>';
                }).join('');
              })(theme.data);

              var info = document.createElement('div'); info.style.cssText='flex:1;min-width:0;';
              var nameEl = document.createElement('div'); nameEl.style.cssText='font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:700;color:#1A3540;'; nameEl.textContent=theme.name; info.appendChild(nameEl);
              if (theme.isDefault) {
                var badge = document.createElement('span'); badge.style.cssText='display:inline-block;margin-top:2px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#4E8D99;background:rgba(78,141,153,.1);border:1px solid rgba(78,141,153,.3);border-radius:4px;padding:1px 6px;'; badge.textContent='Workspace default'; info.appendChild(badge);
              }

              var selInd = document.createElement('div');
              selInd.style.cssText = 'width:18px;height:18px;border-radius:50%;border:2px solid rgba(26,53,64,.2);flex-shrink:0;transition:border-color 140ms,background 140ms;';

              row.appendChild(swatches); row.appendChild(info); row.appendChild(selInd);
              list.appendChild(row);

              row.addEventListener('click', function () {
                selectedId = theme.id;
                list.querySelectorAll('[data-theme-id]').forEach(function (r) {
                  var active = r.dataset.themeId === theme.id;
                  r.style.borderColor = active ? '#4E8D99' : 'rgba(26,53,64,.1)';
                  r.style.background  = active ? '#EAF4F6' : '#fff';
                  var ind = r.lastElementChild;
                  ind.style.borderColor = active ? '#4E8D99' : 'rgba(26,53,64,.2)';
                  ind.style.background  = active ? '#4E8D99' : '';
                });
                applyBtn.disabled = false; applyBtn.style.opacity = '1';
              });
            });

            themeSection.appendChild(list);

            var cancelBtn = document.createElement('button');
            cancelBtn.textContent='Cancel'; cancelBtn.style.cssText='background:none;border:1px solid rgba(26,53,64,.2);border-radius:999px;padding:0 20px;height:36px;font-family:Barlow,sans-serif;font-size:13px;cursor:pointer;color:#1A3540;';
            cancelBtn.addEventListener('click', closeModal);

            var applyBtn = document.createElement('button');
            applyBtn.textContent='Apply theme'; applyBtn.disabled=true; applyBtn.style.cssText='background:#4E8D99;border:none;border-radius:999px;padding:0 20px;height:36px;font-family:Barlow,sans-serif;font-size:13px;color:#fff;cursor:pointer;font-weight:600;opacity:.4;transition:opacity 140ms;';
            applyBtn.addEventListener('click', function () {
              if (!selectedId || !window._editData) { closeModal(); return; }
              var chosen = themes.find(function (t) { return t.id === selectedId; });
              if (chosen && chosen.data) {
                var priorPalette = window._editData._tazPalette
                  ? JSON.parse(JSON.stringify(window._editData._tazPalette))
                  : (window._theme ? JSON.parse(JSON.stringify(window._theme.palette)) : null);

                window._editData.theme = workspaceThemeToEditTheme(chosen.data);
                var savedPalette = workspaceThemeToPalette(chosen.data.colours || {});
                window._editData._tazPalette = savedPalette;
                if (window._theme) {
                  window._theme.palette = savedPalette;
                  window._theme.styles = JSON.parse(JSON.stringify(window._editData.theme));
                }

                if (priorPalette && window._editData.sections) {
                  (function () {
                    function hexToRgbStr(hex) {
                      if (!hex || hex[0] !== '#' || hex.length < 7) return null;
                      return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)].join(',');
                    }
                    var slots = ['accent1','accent2','accent3','accent4','accent5','accent6','bg1','bg2','text1','text2'];
                    var rgbMap = {};
                    slots.forEach(function (k) {
                      var oldRgb = hexToRgbStr(priorPalette[k]);
                      var newRgb = hexToRgbStr(savedPalette[k]);
                      if (oldRgb && newRgb && oldRgb !== newRgb) rgbMap[oldRgb] = newRgb;
                    });
                    window._editData.sections.forEach(function (s) {
                      if (!s._bg) return;
                      if (s._bg.accentRgb  && rgbMap[s._bg.accentRgb])  s._bg.accentRgb  = rgbMap[s._bg.accentRgb];
                      if (s._bg.accentRgb2 && rgbMap[s._bg.accentRgb2]) s._bg.accentRgb2 = rgbMap[s._bg.accentRgb2];
                    });
                  }());
                }

                if (typeof markDirty === 'function') markDirty();
                else if (typeof window._markDirty === 'function') window._markDirty();

                restorePaletteToNav(document.getElementById('taz-palette-container'));
                if (typeof renderThemePanel === 'function') renderThemePanel();
                if (typeof _themeApply === 'function') _themeApply();

                var refreshNav = document.getElementById('nav-theme-content');
                var palCont = document.getElementById('taz-palette-container');
                if (refreshNav && palCont) {
                  refreshNav.querySelectorAll('.ts-sect').forEach(function (el) {
                    if (/^colou?r\s+palette$/i.test(el.textContent.trim())) el.setAttribute('data-taz-palette-heading', '1');
                  });
                  var freshHeading = refreshNav.querySelector('[data-taz-palette-heading]');
                  var freshGrid    = refreshNav.querySelector('.ts-palette-grid');
                  if (freshHeading) palCont.appendChild(freshHeading);
                  if (freshGrid)    palCont.appendChild(freshGrid);
                }

                var oldBanner = themeSection.querySelector('.taz-theme-applied-banner');
                if (oldBanner) oldBanner.remove();
                var banner = document.createElement('div');
                banner.className = 'taz-theme-applied-banner';
                banner.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:8px;background:rgba(78,141,153,.12);border:1px solid rgba(78,141,153,.35);margin-bottom:16px;font-family:Barlow,sans-serif;font-size:13px;color:#2a6570;';
                banner.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>'
                  + '<span><strong>' + chosen.name + '</strong> applied. You can switch tabs or close when you\u2019re done.</span>';
                themeSection.insertBefore(banner, themeSection.firstChild);

                footer.innerHTML = '';
                var doneBtn = document.createElement('button');
                doneBtn.textContent = 'Done';
                doneBtn.style.cssText = 'background:#4E8D99;border:none;border-radius:999px;padding:0 20px;height:36px;font-family:Barlow,sans-serif;font-size:13px;color:#fff;cursor:pointer;font-weight:600;';
                doneBtn.addEventListener('click', closeModal);
                footer.appendChild(doneBtn);
              }
            });

            footer.appendChild(cancelBtn); footer.appendChild(applyBtn);
          })
          .catch(function () {
            themeSection.innerHTML = '<div style="text-align:center;font-size:13px;color:rgba(26,53,64,.4);">Could not load themes. Please try again.</div>';
          });
      }

      function renderTextStylesTab() {
        body.style.padding = '0';

        if (typeof navTab === 'function') navTab('theme');

        var intro = document.createElement('div');
        intro.style.cssText = 'padding:16px 20px 4px;font-size:13px;color:rgba(26,53,64,.5);line-height:1.5;';
        intro.textContent = 'Edit the typography and colour for each text element in this lesson.';
        body.appendChild(intro);

        var container = document.createElement('div');
        container.id = 'taz-ts-container';
        container.style.cssText = 'padding:4px 0 8px;';
        body.appendChild(container);

        var nav = document.getElementById('nav-theme-content');
        if (nav) {
          nav.querySelectorAll('.ts-sect').forEach(function (el) {
            if (/^text\s+styles$/i.test(el.textContent.trim())) el.setAttribute('data-taz-ts-heading', '1');
          });
          var navChildren = Array.from(nav.children);
          var startIdx = navChildren.findIndex(function (c) { return c.hasAttribute('data-taz-ts-heading'); });
          var toMove = startIdx >= 0 ? navChildren.slice(startIdx) : [];
          toMove.forEach(function (el) { container.appendChild(el); });
        }

        var doneBtn = document.createElement('button');
        doneBtn.textContent = 'Done';
        doneBtn.style.cssText = 'background:#4E8D99;border:none;border-radius:999px;padding:0 20px;height:36px;font-family:Barlow,sans-serif;font-size:13px;color:#fff;cursor:pointer;font-weight:600;';
        doneBtn.addEventListener('click', closeModal);
        footer.appendChild(doneBtn);
      }

      switchTab(currentTab);
    }

    function injectSettingsButton() {
      var toolbar = document.querySelector('.edit-toolbar-right');
      if (!toolbar || toolbar.querySelector('.etool-proj-settings')) return;

      var btn = document.createElement('button');
      btn.className = 'etool etool-proj-settings';
      btn.title = 'Project Settings';
      btn.setAttribute('aria-label', 'Project Settings');
      btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> Project Settings';
      btn.addEventListener('click', function () { openProjectSettings('details'); });

      var backBtn = Array.from(toolbar.querySelectorAll('.etool')).find(function (b) { return b.textContent.trim() === 'Back'; });
      if (backBtn) toolbar.insertBefore(btn, backBtn);
      else toolbar.appendChild(btn);
    }

    new MutationObserver(function () { injectSettingsButton(); }).observe(document.body, { childList: true, subtree: true });
    injectSettingsButton();

  }());

  /* ── Restore saved palette on project load ── */
  (function () {
    function restorePalette() {
      if (!window._editData || !window._editData._tazPalette) return;
      if (!window._theme) return;
      window._theme.palette = JSON.parse(JSON.stringify(window._editData._tazPalette));
      if (window._editData.theme) {
        window._theme.styles = JSON.parse(JSON.stringify(window._editData.theme));
      }
      if (typeof renderThemePanel === 'function') renderThemePanel();
      if (typeof _themeApply === 'function') _themeApply();
    }
    function watchEditor() {
      var ew = document.getElementById('edit-wrap');
      if (!ew) { setTimeout(watchEditor, 200); return; }
      new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          if (m.attributeName === 'class' && ew.classList.contains('active')) {
            var tries = 0;
            var poll = setInterval(function () {
              if (++tries > 40) { clearInterval(poll); return; }
              if (window._editData) { clearInterval(poll); restorePalette(); }
            }, 100);
          }
        });
      }).observe(ew, { attributes: true, attributeFilter: ['class'] });
    }
    watchEditor();
  }());

  /* ── Knowledge Articles wizard ──
   *
   * Full 4-screen modal wizard wired to:
   *   POST /api/knowledge/extract   — knowledge map (call 1)
   *   POST /api/knowledge/generate  — full article (call 2)
   *   POST /api/knowledge-articles  — save to DB
   ── */
  (function () {

    function hdrs() {
      var t = null; try { t = localStorage.getItem('tazzet_jwt'); } catch (_) {}
      return t ? { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
    }
    function kaGenId() {
      return 'ka_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    }
    function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    function parseBold(t) { return (t||'').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>'); }

    function injectKaStyles() {
      if (document.getElementById('taz-ka-styles')) return;
      var s = document.createElement('style');
      s.id = 'taz-ka-styles';
      s.textContent = [
        '#taz-ka-overlay{position:fixed;inset:0;z-index:9000;background:rgba(26,53,64,.6);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;}',
        '#taz-ka-shell{width:100%;max-width:780px;background:#F5F0EC;border-radius:20px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.35);display:flex;flex-direction:column;max-height:90vh;}',
        '#taz-ka-stepbar{background:#1A3540;padding:12px 24px;display:flex;align-items:center;flex-shrink:0;}',
        '.taz-ka-step{display:flex;align-items:center;gap:6px;font-family:Barlow Condensed,sans-serif;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(245,240,236,.3);flex:1;position:relative;transition:color .2s;}',
        '.taz-ka-step::after{content:"";position:absolute;right:0;top:50%;transform:translateY(-50%);width:18px;height:1px;background:rgba(245,240,236,.1);}',
        '.taz-ka-step:last-child::after{display:none}',
        '.taz-ka-step.ka-active{color:rgba(245,240,236,.9)}.taz-ka-step.ka-done{color:#4E8D99}',
        '.taz-ka-pip{width:18px;height:18px;border-radius:50%;background:rgba(245,240,236,.08);font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .2s,color .2s;}',
        '.taz-ka-step.ka-active .taz-ka-pip{background:#4E8D99;color:#fff}.taz-ka-step.ka-done .taz-ka-pip{background:#4E8D99;color:#fff}',
        '.taz-ka-screen{display:none;flex:1;min-height:0;flex-direction:column;animation:kaFadeUp .25s ease}',
        '.taz-ka-screen.ka-show{display:flex;min-height:0;overflow:hidden}',
        '@keyframes kaFadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}',
        '.taz-ka-body{flex:1;min-height:0;padding:24px 28px 16px;overflow-y:auto}',
        '.taz-ka-nav{padding:12px 28px 20px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid rgba(26,53,64,.1);flex-shrink:0;}',
        '.taz-ka-title{font-family:Barlow Condensed,sans-serif;font-size:22px;font-weight:800;color:#1A3540;margin-bottom:4px;letter-spacing:-.01em;}',
        '.taz-ka-sub{font-size:13px;color:rgba(26,53,64,.45);line-height:1.55;margin-bottom:20px;}',
        '.taz-ka-add-row{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;}',
        '.taz-ka-add-btn{height:32px;padding:0 12px;border:1.5px dashed rgba(26,53,64,.2);border-radius:7px;background:transparent;font-family:Barlow,sans-serif;font-size:12px;font-weight:600;color:rgba(26,53,64,.45);cursor:pointer;display:flex;align-items:center;gap:5px;transition:border-color .15s,color .15s,background .15s;}',
        '.taz-ka-add-btn:hover{border-color:#4E8D99;color:#4E8D99;background:#EAF4F6}.taz-ka-add-btn:disabled{opacity:.35;cursor:default;}',
        '.taz-ka-src-list{display:flex;flex-direction:column;gap:7px}',
        '.taz-ka-src-card{background:#fff;border:1.5px solid rgba(26,53,64,.11);border-radius:9px;padding:10px 12px;display:flex;align-items:flex-start;gap:10px;}',
        '.taz-ka-src-icon{width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}',
        '.taz-ka-src-icon.ka-file{background:rgba(78,141,153,.1);color:#4E8D99}.taz-ka-src-icon.ka-text{background:rgba(235,186,149,.15);color:#b8803a}.taz-ka-src-icon.ka-url{background:rgba(109,68,94,.1);color:#6D445E}',
        '.taz-ka-src-body{flex:1;min-width:0}',
        '.taz-ka-src-type{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(26,53,64,.45);margin-bottom:3px;}',
        '.taz-ka-src-inp{width:100%;border:1.5px solid rgba(26,53,64,.11);border-radius:6px;padding:6px 9px;font-family:Barlow,sans-serif;font-size:13px;color:#1A3540;background:#F5F0EC;resize:none;outline:none;transition:border-color .15s;line-height:1.45;}',
        '.taz-ka-src-inp:focus{border-color:#4E8D99}',
        '.taz-ka-src-rm{background:none;border:none;cursor:pointer;color:rgba(26,53,64,.2);font-size:17px;line-height:1;padding:1px 3px;flex-shrink:0;transition:color .15s;}.taz-ka-src-rm:hover{color:#c0392b}',
        '.taz-ka-counter{font-size:11px;color:rgba(26,53,64,.4);text-align:right;margin-top:4px;}',
        '.taz-ka-empty{padding:40px 0;text-align:center;color:rgba(26,53,64,.35);font-size:13px;}',
        '.taz-ka-proc-wrap{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:36px 28px;gap:14px;}',
        '.taz-ka-spin{width:48px;height:48px;border-radius:50%;border:3px solid rgba(78,141,153,.15);border-top-color:#4E8D99;animation:kaSpin 1s linear infinite;}',
        '@keyframes kaSpin{to{transform:rotate(360deg)}}',
        '.taz-ka-proc-title{font-family:Barlow Condensed,sans-serif;font-size:18px;font-weight:700;color:#1A3540;}',
        '.taz-ka-src-status-list{display:flex;flex-direction:column;gap:4px;width:100%;max-width:360px}',
        '.taz-ka-src-status-item{display:flex;align-items:center;gap:8px;background:#fff;border-radius:7px;padding:7px 11px;font-size:12px;color:rgba(26,53,64,.45);border:1px solid rgba(26,53,64,.1);}',
        '.taz-ka-src-status-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
        '.taz-ka-badge{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:2px 6px;border-radius:999px;flex-shrink:0;}',
        '.ka-badge-wait{background:rgba(26,53,64,.06);color:rgba(26,53,64,.4)}.ka-badge-read{background:rgba(78,141,153,.12);color:#4E8D99;animation:kaPulse .9s ease-in-out infinite}.ka-badge-done{background:rgba(78,141,153,.12);color:#4E8D99}.ka-badge-err{background:rgba(192,57,43,.1);color:#c0392b}',
        '@keyframes kaPulse{0%,100%{opacity:.7}50%{opacity:1}}',
        '.taz-ka-proc-steps{display:flex;flex-direction:column;gap:5px;width:100%;max-width:360px;margin-top:6px;}',
        '.taz-ka-proc-step{display:flex;align-items:center;gap:8px;font-size:12px;color:rgba(26,53,64,.4);padding:7px 11px;border-radius:7px;transition:background .25s,color .25s;}',
        '.taz-ka-proc-step.ka-ps-active{background:#fff;color:#1A3540}.taz-ka-proc-step.ka-ps-done{color:#4E8D99}',
        '.taz-ka-proc-dot{width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.4;flex-shrink:0;transition:opacity .25s;}',
        '.taz-ka-proc-step.ka-ps-active .taz-ka-proc-dot,.taz-ka-proc-step.ka-ps-done .taz-ka-proc-dot{opacity:1}',
        '.taz-ka-cfg-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;}',
        '.taz-ka-cfg-field{display:flex;flex-direction:column;gap:4px;}.taz-ka-cfg-field.ka-full{grid-column:1/-1}',
        '.taz-ka-cfg-label{font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:rgba(26,53,64,.45);}',
        '.taz-ka-cfg-inp,.taz-ka-cfg-sel,.taz-ka-cfg-ta{border:1.5px solid rgba(26,53,64,.11);border-radius:7px;padding:7px 10px;font-family:Barlow,sans-serif;font-size:13px;color:#1A3540;background:#fff;outline:none;transition:border-color .15s;width:100%;}',
        '.taz-ka-cfg-inp:focus,.taz-ka-cfg-sel:focus,.taz-ka-cfg-ta:focus{border-color:#4E8D99}.taz-ka-cfg-ta{resize:vertical;min-height:54px;line-height:1.45}',
        '.taz-ka-type-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:16px;}',
        '.taz-ka-type-card{border:1.5px solid rgba(26,53,64,.11);border-radius:9px;padding:10px 12px;cursor:pointer;background:#fff;transition:border-color .15s,background .15s;text-align:left;}',
        '.taz-ka-type-card:hover{border-color:#4E8D99;background:#EAF4F6}.taz-ka-type-card.ka-sel{border-color:#4E8D99;background:#EAF4F6}',
        '.taz-ka-type-label{font-family:Barlow Condensed,sans-serif;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#1A3540;margin-bottom:2px;display:flex;align-items:center;gap:5px;}',
        '.taz-ka-type-radio{width:13px;height:13px;border-radius:50%;border:2px solid rgba(26,53,64,.2);flex-shrink:0;position:relative;transition:border-color .15s;}',
        '.taz-ka-type-card.ka-sel .taz-ka-type-radio{border-color:#4E8D99}',
        '.taz-ka-type-card.ka-sel .taz-ka-type-radio::after{content:"";position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:5px;height:5px;border-radius:50%;background:#4E8D99;}',
        '.taz-ka-type-desc{font-size:11px;color:rgba(26,53,64,.45);line-height:1.35}',
        '.taz-ka-sec-div{font-family:Barlow Condensed,sans-serif;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(26,53,64,.4);margin:14px 0 8px;display:flex;align-items:center;gap:8px;}',
        '.taz-ka-sec-div::after{content:"";flex:1;height:1px;background:rgba(26,53,64,.1);}',
        '.taz-ka-toggles{display:grid;grid-template-columns:1fr 1fr;gap:6px;}',
        '.taz-ka-tog-row{display:flex;align-items:center;justify-content:space-between;background:#fff;border:1.5px solid rgba(26,53,64,.11);border-radius:8px;padding:9px 12px;cursor:pointer;user-select:none;transition:border-color .15s,background .15s;}',
        '.taz-ka-tog-row:hover{border-color:#4E8D99;background:#EAF4F6}.taz-ka-tog-row.ka-dis{opacity:.4;cursor:default;pointer-events:none}',
        '.taz-ka-tog-info{flex:1}.taz-ka-tog-title{font-size:12px;font-weight:600;color:#1A3540}.taz-ka-tog-desc{font-size:11px;color:rgba(26,53,64,.4);margin-top:1px}',
        '.taz-ka-tog{width:32px;height:17px;border-radius:8px;background:rgba(26,53,64,.12);position:relative;transition:background .2s;flex-shrink:0;}',
        '.taz-ka-tog::after{content:"";position:absolute;top:2px;left:2px;width:13px;height:13px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2);transition:transform .2s;}',
        '.taz-ka-tog.ka-on{background:#4E8D99}.taz-ka-tog.ka-on::after{transform:translateX(15px)}',
        '.taz-ka-km-banner{background:rgba(78,141,153,.08);border:1px solid rgba(78,141,153,.2);border-radius:7px;padding:9px 12px;font-size:12px;color:#3a6b75;margin-bottom:14px;display:flex;align-items:flex-start;gap:7px;line-height:1.45;}',
        '.taz-ka-prev-hdr{background:#1A3540;padding:16px 28px 14px;flex-shrink:0;}',
        '.taz-ka-prev-eyebrow{font-family:Barlow Condensed,sans-serif;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#EBBA95;margin-bottom:4px;display:flex;align-items:center;gap:6px;}',
        '.taz-ka-prev-type{background:rgba(235,186,149,.15);border:1px solid rgba(235,186,149,.3);border-radius:3px;padding:1px 5px;font-size:9px;color:#EBBA95;letter-spacing:.07em;}',
        '.taz-ka-prev-title{font-family:Barlow Condensed,sans-serif;font-size:22px;font-weight:800;color:#F5F0EC;letter-spacing:-.01em;line-height:1.2;}',
        '.taz-ka-prev-meta{display:flex;gap:12px;margin-top:8px;flex-wrap:wrap;}',
        '.taz-ka-prev-meta-item{font-size:11px;color:rgba(245,240,236,.5);display:flex;align-items:center;gap:4px;}',
        '.taz-ka-prev-body{flex:1;min-height:0;overflow-y:auto;padding:4px 0;}',
        '.taz-ka-art-sec{padding:14px 28px;border-left:3px solid transparent;transition:border-color .2s,background .2s;}',
        '.taz-ka-art-sec:hover{border-color:#4E8D99;background:rgba(78,141,153,.03)}',
        '.taz-ka-art-sec-hdr{display:flex;align-items:center;gap:7px;margin-bottom:8px;}',
        '.taz-ka-art-sec-icon{width:22px;height:22px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;}',
        '.taz-ka-art-sec-title{font-family:Barlow Condensed,sans-serif;font-size:12px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#1A3540;}',
        '.taz-ka-art-text{font-size:13px;color:#1A3540;line-height:1.65;opacity:.87}',
        '.taz-ka-art-text p+p{margin-top:6px}.taz-ka-art-text ul,.taz-ka-art-text ol{padding-left:16px;margin-top:5px;display:flex;flex-direction:column;gap:3px}',
        '.taz-ka-art-text strong{font-weight:600}',
        '.taz-ka-concept-def{background:#EAF4F6;border:1.5px solid rgba(78,141,153,.2);border-radius:8px;padding:11px 13px;font-size:13px;font-weight:500;color:#1A3540;line-height:1.55;margin-bottom:10px;}',
        '.taz-ka-ref-table{width:100%;border-collapse:collapse;font-size:13px;margin-top:3px;}',
        '.taz-ka-ref-table th{background:rgba(26,53,64,.05);padding:7px 11px;text-align:left;font-weight:700;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:rgba(26,53,64,.45);border-bottom:1.5px solid rgba(26,53,64,.1);}',
        '.taz-ka-ref-table td{padding:7px 11px;border-bottom:1px solid rgba(26,53,64,.08);color:#1A3540;line-height:1.45}.taz-ka-ref-table tr:last-child td{border-bottom:none}',
        '.taz-ka-step-list{list-style:none;display:flex;flex-direction:column;gap:7px}',
        '.taz-ka-step-item{display:flex;gap:10px;align-items:flex-start;background:#fff;border:1.5px solid rgba(26,53,64,.1);border-radius:8px;padding:10px 12px;}',
        '.taz-ka-step-n{width:20px;height:20px;border-radius:50%;background:#EAF4F6;color:#4E8D99;font-weight:800;font-size:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;}',
        '.taz-ka-step-t{flex:1;font-size:13px;color:#1A3540;line-height:1.5}.taz-ka-step-t strong{font-weight:600}',
        '.taz-ka-step-outcome{font-size:11px;color:rgba(26,53,64,.45);margin-top:3px;font-style:italic}',
        '.taz-ka-ss-ph{margin-top:8px;background:#F5F0EC;border:1.5px dashed rgba(26,53,64,.14);border-radius:6px;padding:8px 11px;display:flex;align-items:center;gap:7px;color:rgba(26,53,64,.4);font-size:11px;font-style:italic;}',
        '.taz-ka-steps-achv{margin-top:10px;padding:8px 11px;background:rgba(78,141,153,.07);border-radius:6px;font-size:12px;font-style:italic;color:#1A3540;}',
        '.taz-ka-issue-list{display:flex;flex-direction:column;gap:6px}',
        '.taz-ka-issue-item{background:#fffbf5;border:1.5px solid rgba(235,186,149,.4);border-radius:7px;padding:9px 12px;font-size:13px;color:#1A3540;line-height:1.5}',
        '.taz-ka-issue-q{font-weight:600;margin-bottom:2px}.taz-ka-issue-a{color:rgba(26,53,64,.55)}',
        '.taz-ka-scenario{background:rgba(109,68,94,.06);border:1.5px solid rgba(109,68,94,.15);border-radius:8px;padding:12px 14px;font-size:13px;color:#1A3540;line-height:1.6}',
        '.taz-ka-conf-items{display:flex;flex-direction:column;gap:5px}',
        '.taz-ka-conf-item{display:flex;align-items:center;gap:9px;background:#fff;border:1.5px solid rgba(26,53,64,.1);border-radius:7px;padding:8px 11px;font-size:13px;color:#1A3540}',
        '.taz-ka-conf-cb{width:16px;height:16px;border:2px solid rgba(26,53,64,.18);border-radius:3px;flex-shrink:0;cursor:pointer;position:relative;transition:background .15s,border-color .15s}',
        '.taz-ka-conf-cb.ka-on{background:#4E8D99;border-color:#4E8D99}.taz-ka-conf-cb.ka-on::after{content:"\u2713";position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-size:9px;font-weight:800}',
        '.taz-ka-related{padding:12px 28px 16px;border-top:1px solid rgba(26,53,64,.1)}',
        '.taz-ka-related-title{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(26,53,64,.4);margin-bottom:6px;}',
        '.taz-ka-related-list{display:flex;flex-direction:column;gap:4px}',
        '.taz-ka-related-link{font-size:13px;color:#4E8D99;display:flex;align-items:center;gap:4px;cursor:pointer;text-decoration:none}.taz-ka-related-link:hover{text-decoration:underline}',
        '.taz-ka-art-div{height:1px;background:rgba(26,53,64,.1);margin:0 28px}',
        '.taz-ka-btn{height:36px;border:none;border-radius:999px;padding:0 18px;font-family:Barlow,sans-serif;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:background .15s,opacity .15s,filter .15s;white-space:nowrap;}',
        '.taz-ka-btn:active{transform:scale(.97)}.taz-ka-btn-primary{background:#4E8D99;color:#fff}.taz-ka-btn-primary:hover{filter:brightness(1.08)}.taz-ka-btn-primary:disabled{opacity:.35;cursor:default}',
        '.taz-ka-btn-ghost{background:transparent;color:rgba(26,53,64,.45);border:1px solid rgba(26,53,64,.15)}.taz-ka-btn-ghost:hover{background:rgba(26,53,64,.05)}',
        '.taz-ka-btn-gen{background:#1A3540;color:#fff;height:40px;padding:0 22px}.taz-ka-btn-gen:hover{background:#0d2430}',
        '.taz-ka-err{background:rgba(192,57,43,.06);border:1.5px solid rgba(192,57,43,.18);border-radius:7px;padding:9px 12px;font-size:12px;color:#9b2335;margin-top:10px;display:none;}',
      ].join('');
      document.head.appendChild(s);
    }

    var _kaSources    = [];
    var _kaMap        = null;
    var _kaType       = 'task';
    var _kaSections   = { overview:true, steps:true, prereqs:true, issues:true, scenario:true, confidence:true, related:true };
    var _kaScreen     = 1;
    var _kaOverlay    = null;
    var _kaCurArticle = null;

    function kaOpen() {
      injectKaStyles();
      if (document.getElementById('taz-ka-overlay')) document.getElementById('taz-ka-overlay').remove();

      _kaSources = []; _kaMap = null; _kaType = 'task'; _kaScreen = 1;
      _kaSections = { overview:true, steps:true, prereqs:true, issues:true, scenario:true, confidence:true, related:true };

      _kaOverlay = document.createElement('div'); _kaOverlay.id = 'taz-ka-overlay';
      var shell = document.createElement('div'); shell.id = 'taz-ka-shell';

      var sb = document.createElement('div'); sb.id = 'taz-ka-stepbar';
      var stepDefs = [['1','Sources'],['2','Reading'],['3','Configure'],['4','Preview']];
      stepDefs.forEach(function(d){
        var st = document.createElement('div'); st.className='taz-ka-step'; st.id='taz-ka-st-'+d[0];
        var pip = document.createElement('div'); pip.className='taz-ka-pip'; pip.textContent=d[0];
        var lbl = document.createElement('span'); lbl.textContent=d[1];
        st.appendChild(pip); st.appendChild(lbl); sb.appendChild(st);
      });

      shell.appendChild(sb);
      shell.appendChild(kaScreen1());
      shell.appendChild(kaScreen2());
      shell.appendChild(kaScreen3());
      shell.appendChild(kaScreen4());

      _kaOverlay.appendChild(shell);
      document.body.appendChild(_kaOverlay);

      _kaOverlay.addEventListener('click', function(e){ if(e.target===_kaOverlay) kaClose(); });
      document.addEventListener('keydown', kaEscClose);

      kaGoTo(1);
    }

    function kaClose() {
      document.removeEventListener('keydown', kaEscClose);
      if (_kaOverlay) { _kaOverlay.remove(); _kaOverlay = null; }
    }
    function kaEscClose(e) { if(e.key==='Escape') kaClose(); }

    function kaGoTo(n) {
      _kaScreen = n;
      [1,2,3,4].forEach(function(i){
        var scr = document.getElementById('taz-ka-scr-'+i);
        if (scr) { scr.classList.toggle('ka-show', i===n); }
        var st = document.getElementById('taz-ka-st-'+i);
        if (st) {
          st.classList.toggle('ka-active', i===n);
          st.classList.toggle('ka-done', i<n);
          if(i!==n && i>=n) st.classList.remove('ka-done','ka-active');
        }
      });
    }

    function kaScreen1() {
      var scr = document.createElement('div'); scr.id='taz-ka-scr-1'; scr.className='taz-ka-screen';
      var body = document.createElement('div'); body.className='taz-ka-body';

      var titleEl = document.createElement('div'); titleEl.className='taz-ka-title'; titleEl.textContent='Add your sources';
      var subEl = document.createElement('div'); subEl.className='taz-ka-sub'; subEl.textContent='Upload files, paste text, or add a URL. Claude will extract the knowledge from all of them. Up to 5 sources.';
      body.appendChild(titleEl); body.appendChild(subEl);

      var addRow = document.createElement('div'); addRow.className='taz-ka-add-row'; addRow.id='taz-ka-add-row';
      function mkAddBtn(ico, lbl, type) {
        var b = document.createElement('button'); b.className='taz-ka-add-btn'; b.id='taz-ka-add-'+type;
        b.innerHTML = ico + ' ' + lbl;
        b.addEventListener('click', function() { kaAddSource(type); });
        addRow.appendChild(b);
      }
      var fileIco = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
      var textIco = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>';
      var urlIco  = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
      mkAddBtn(fileIco,'Upload file','file');
      mkAddBtn(textIco,'Write / paste text','text');
      mkAddBtn(urlIco, 'Add URL','url');
      body.appendChild(addRow);

      var emptyEl = document.createElement('div'); emptyEl.className='taz-ka-empty'; emptyEl.id='taz-ka-empty';
      emptyEl.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" style="display:block;margin:0 auto 10px;opacity:.2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>Add at least one source to continue';
      body.appendChild(emptyEl);

      var srcList = document.createElement('div'); srcList.className='taz-ka-src-list'; srcList.id='taz-ka-src-list';
      body.appendChild(srcList);

      var counter = document.createElement('div'); counter.className='taz-ka-counter'; counter.id='taz-ka-counter'; counter.style.display='none';
      body.appendChild(counter);

      scr.appendChild(body);

      var nav = document.createElement('div'); nav.className='taz-ka-nav';
      var cancelBtn = document.createElement('button'); cancelBtn.className='taz-ka-btn taz-ka-btn-ghost'; cancelBtn.textContent='Cancel';
      cancelBtn.addEventListener('click', kaClose);
      var nextBtn = document.createElement('button'); nextBtn.className='taz-ka-btn taz-ka-btn-primary'; nextBtn.id='taz-ka-next1'; nextBtn.disabled=true;
      nextBtn.innerHTML = 'Continue <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>';
      nextBtn.addEventListener('click', kaStartReading);
      nav.appendChild(cancelBtn); nav.appendChild(nextBtn);
      scr.appendChild(nav);
      return scr;
    }

    function kaAddSource(type) {
      if (_kaSources.length >= 5) return;
      _kaSources.push({ id: Date.now(), type: type, label: {file:'File',text:'Text',url:'URL'}[type], content: '' });
      kaRenderSources();
    }
    function kaRemoveSource(id) {
      _kaSources = _kaSources.filter(function(s){ return s.id !== id; });
      kaRenderSources();
    }
    function kaUpdateContent(id, val) {
      var s = _kaSources.find(function(x){ return x.id===id; });
      if (s) s.content = val;
    }
    function kaRenderSources() {
      var list    = document.getElementById('taz-ka-src-list');
      var empty   = document.getElementById('taz-ka-empty');
      var counter = document.getElementById('taz-ka-counter');
      var nextBtn = document.getElementById('taz-ka-next1');
      if (!list) return;
      var n = _kaSources.length;
      empty.style.display   = n===0 ? '' : 'none';
      counter.style.display = n>0   ? '' : 'none';
      counter.textContent   = n + ' / 5 source' + (n!==1?'s':'') + ' added';
      if (nextBtn) nextBtn.disabled = n===0;
      ['file','text','url'].forEach(function(t){
        var b = document.getElementById('taz-ka-add-'+t);
        if (b) b.disabled = n>=5;
      });
      list.innerHTML = '';
      _kaSources.forEach(function(src) {
        var icoMap  = {file:'\uD83D\uDCC4',text:'\u270F\uFE0F',url:'\uD83D\uDD17'};
        var clsMap  = {file:'ka-file',text:'ka-text',url:'ka-url'};
        var card = document.createElement('div'); card.className='taz-ka-src-card';
        var icon = document.createElement('div'); icon.className='taz-ka-src-icon '+clsMap[src.type]; icon.textContent=icoMap[src.type];
        var body = document.createElement('div'); body.className='taz-ka-src-body';
        var typeEl = document.createElement('div'); typeEl.className='taz-ka-src-type'; typeEl.textContent=src.label; body.appendChild(typeEl);
        if (src.type==='file') {
          var fn = src.content || 'Procedure_Manual.pdf';
          if (!src.content) { src.content=fn; src.label=fn; typeEl.textContent=fn; }
          var meta = document.createElement('div'); meta.style.cssText='font-size:12px;color:rgba(26,53,64,.4);margin-top:2px;'; meta.textContent='Simulated upload'; body.appendChild(meta);
        } else if (src.type==='text') {
          var ta = document.createElement('textarea'); ta.className='taz-ka-src-inp'; ta.rows=2; ta.placeholder='Paste or type content here\u2026'; ta.value=src.content;
          ta.addEventListener('input', (function(id){ return function(){ kaUpdateContent(id,this.value); }; })(src.id));
          body.appendChild(ta);
        } else {
          var inp = document.createElement('input'); inp.className='taz-ka-src-inp'; inp.type='url'; inp.placeholder='https://\u2026'; inp.value=src.content;
          inp.addEventListener('input', (function(id){ return function(){ kaUpdateContent(id,this.value); }; })(src.id));
          body.appendChild(inp);
        }
        var rm = document.createElement('button'); rm.className='taz-ka-src-rm'; rm.textContent='\u00d7';
        rm.addEventListener('click', (function(id){ return function(){ kaRemoveSource(id); }; })(src.id));
        card.appendChild(icon); card.appendChild(body); card.appendChild(rm);
        list.appendChild(card);
      });
    }

    function kaScreen2() {
      var scr = document.createElement('div'); scr.id='taz-ka-scr-2'; scr.className='taz-ka-screen';
      var wrap = document.createElement('div'); wrap.className='taz-ka-proc-wrap';
      var spin = document.createElement('div'); spin.className='taz-ka-spin'; spin.id='taz-ka-spin'; wrap.appendChild(spin);
      var ptitle = document.createElement('div'); ptitle.className='taz-ka-proc-title'; ptitle.id='taz-ka-ptitle'; ptitle.textContent='Reading your sources\u2026'; wrap.appendChild(ptitle);
      var statusList = document.createElement('div'); statusList.className='taz-ka-src-status-list'; statusList.id='taz-ka-status-list'; wrap.appendChild(statusList);
      var steps = document.createElement('div'); steps.className='taz-ka-proc-steps'; steps.style.marginTop='6px';
      [['taz-ka-ps-extract','Extracting text from sources'],['taz-ka-ps-analyse','Identifying concepts and procedures'],['taz-ka-ps-map','Building knowledge map']].forEach(function(d){
        var st = document.createElement('div'); st.className='taz-ka-proc-step'; st.id=d[0];
        var dot = document.createElement('div'); dot.className='taz-ka-proc-dot';
        st.appendChild(dot); st.appendChild(document.createTextNode(d[1])); steps.appendChild(st);
      });
      wrap.appendChild(steps);
      var errBox = document.createElement('div'); errBox.className='taz-ka-err'; errBox.id='taz-ka-err'; wrap.appendChild(errBox);
      scr.appendChild(wrap);
      return scr;
    }

    function kaScreen3() {
      var scr = document.createElement('div'); scr.id='taz-ka-scr-3'; scr.className='taz-ka-screen';
      var body = document.createElement('div'); body.className='taz-ka-body';
      var titleEl = document.createElement('div'); titleEl.className='taz-ka-title'; titleEl.textContent='Configure your article';
      var subEl   = document.createElement('div'); subEl.className='taz-ka-sub'; subEl.textContent='Claude has read your sources. Choose an article type, refine the details, then generate.';
      body.appendChild(titleEl); body.appendChild(subEl);
      var kmBanner = document.createElement('div'); kmBanner.className='taz-ka-km-banner'; kmBanner.id='taz-ka-km-banner'; kmBanner.style.display='none';
      kmBanner.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
      var kmText = document.createElement('span'); kmText.id='taz-ka-km-text'; kmBanner.appendChild(kmText);
      body.appendChild(kmBanner);
      var typeLbl = document.createElement('div'); typeLbl.className='taz-ka-cfg-label'; typeLbl.style.marginBottom='7px'; typeLbl.textContent='Article type';
      body.appendChild(typeLbl);
      var typeCards = document.createElement('div'); typeCards.className='taz-ka-type-cards';
      [['task','Task','How to do something. "How to\u2026"'],['concept','Concept','What something is. "What is\u2026"'],['reference','Reference','Lookup table or settings list.']].forEach(function(d){
        var tc = document.createElement('div'); tc.className='taz-ka-type-card'; tc.dataset.kaType=d[0];
        if(d[0]==='task') tc.classList.add('ka-sel');
        var lbl = document.createElement('div'); lbl.className='taz-ka-type-label';
        var radio = document.createElement('div'); radio.className='taz-ka-type-radio'; lbl.appendChild(radio);
        lbl.appendChild(document.createTextNode(d[1]));
        var desc = document.createElement('div'); desc.className='taz-ka-type-desc'; desc.textContent=d[2];
        tc.appendChild(lbl); tc.appendChild(desc);
        tc.addEventListener('click', function(){ kaSelectType(d[0]); });
        typeCards.appendChild(tc);
      });
      body.appendChild(typeCards);
      var grid = document.createElement('div'); grid.className='taz-ka-cfg-grid';
      function mkField(id, lbl, full, placeholder, ta) {
        var f = document.createElement('div'); f.className='taz-ka-cfg-field'+(full?' ka-full':'');
        var lb = document.createElement('label'); lb.className='taz-ka-cfg-label'; lb.textContent=lbl; f.appendChild(lb);
        var inp = document.createElement(ta?'textarea':'input'); inp.className=ta?'taz-ka-cfg-ta':'taz-ka-cfg-inp';
        if (!ta) inp.type='text'; inp.id=id; inp.placeholder=placeholder||'';
        if (ta) { inp.rows=2; }
        inp.addEventListener('focus',function(){inp.style.borderColor='#4E8D99'});
        inp.addEventListener('blur', function(){inp.style.borderColor='rgba(26,53,64,.11)'});
        f.appendChild(inp);
        return f;
      }
      grid.appendChild(mkField('taz-ka-cfg-title',  'Article title (sentence case)', true, 'How to create a lesson in Tazzet'));
      grid.appendChild(mkField('taz-ka-cfg-aud',    'Intended audience', false, 'e.g. New starters'));
      grid.appendChild(mkField('taz-ka-cfg-sw',     'Related software',  false, 'e.g. Tazzet'));
      grid.appendChild(mkField('taz-ka-cfg-prereqs','Prerequisites',     true,  'e.g. Admin access, Chrome browser'));
      grid.appendChild(mkField('taz-ka-cfg-focus',  'Focus (optional)',  true,  'e.g. Focus on the desktop workflow. Avoid jargon.',true));
      body.appendChild(grid);
      var secDiv = document.createElement('div'); secDiv.className='taz-ka-sec-div'; secDiv.textContent='Include in article';
      body.appendChild(secDiv);
      var togglesWrap = document.createElement('div'); togglesWrap.className='taz-ka-toggles';
      [['overview','Overview','What this article covers'],
       ['steps','Structured steps','Numbered, one action each'],
       ['prereqs','Before you start','Prerequisites for the reader'],
       ['issues','Common issues','Troubleshooting Q&A'],
       ['scenario','Practice scenario','Real-world task to try'],
       ['confidence','Confidence check','Self-assessment checklist'],
       ['related','Related articles','Links to follow-on reading']
      ].forEach(function(d){
        var row = document.createElement('div'); row.className='taz-ka-tog-row'; row.id='taz-ka-tr-'+d[0];
        var info = document.createElement('div'); info.className='taz-ka-tog-info';
        var title = document.createElement('div'); title.className='taz-ka-tog-title'; title.textContent=d[1]; info.appendChild(title);
        var desc  = document.createElement('div'); desc.className='taz-ka-tog-desc'; desc.textContent=d[2]; info.appendChild(desc);
        var tog = document.createElement('div'); tog.className='taz-ka-tog ka-on'; tog.id='taz-ka-tog-'+d[0];
        row.appendChild(info); row.appendChild(tog);
        row.addEventListener('click', (function(k){ return function(){ kaTog(k); }; })(d[0]));
        togglesWrap.appendChild(row);
      });
      body.appendChild(togglesWrap);
      scr.appendChild(body);
      var nav = document.createElement('div'); nav.className='taz-ka-nav';
      var backBtn = document.createElement('button'); backBtn.className='taz-ka-btn taz-ka-btn-ghost'; backBtn.textContent='\u2190 Back';
      backBtn.addEventListener('click', function(){ kaGoTo(1); });
      var genBtn = document.createElement('button'); genBtn.className='taz-ka-btn taz-ka-btn-gen';
      genBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Generate article';
      genBtn.addEventListener('click', kaGenerateArticle);
      nav.appendChild(backBtn); nav.appendChild(genBtn);
      scr.appendChild(nav);
      return scr;
    }

    function kaSelectType(type) {
      _kaType = type;
      document.querySelectorAll('.taz-ka-type-card').forEach(function(c){ c.classList.toggle('ka-sel', c.dataset.kaType===type); });
      var stepsRow = document.getElementById('taz-ka-tr-steps');
      var scenRow  = document.getElementById('taz-ka-tr-scenario');
      if (type==='concept') {
        if(stepsRow) stepsRow.classList.add('ka-dis'); _kaSections.steps=false; var t=document.getElementById('taz-ka-tog-steps'); if(t) t.classList.remove('ka-on');
      } else if (type==='reference') {
        if(stepsRow) stepsRow.classList.add('ka-dis'); if(scenRow) scenRow.classList.add('ka-dis');
        _kaSections.steps=false; _kaSections.scenario=false;
        var ts=document.getElementById('taz-ka-tog-steps'); if(ts) ts.classList.remove('ka-on');
        var sc=document.getElementById('taz-ka-tog-scenario'); if(sc) sc.classList.remove('ka-on');
      } else {
        if(stepsRow) stepsRow.classList.remove('ka-dis'); if(scenRow) scenRow.classList.remove('ka-dis');
        _kaSections.steps=true; _kaSections.scenario=true;
        var ts2=document.getElementById('taz-ka-tog-steps'); if(ts2) ts2.classList.add('ka-on');
        var sc2=document.getElementById('taz-ka-tog-scenario'); if(sc2) sc2.classList.add('ka-on');
      }
    }

    function kaTog(key) {
      _kaSections[key] = !_kaSections[key];
      var t = document.getElementById('taz-ka-tog-'+key);
      if (t) t.classList.toggle('ka-on', _kaSections[key]);
    }

    function kaScreen4() {
      var scr = document.createElement('div'); scr.id='taz-ka-scr-4'; scr.className='taz-ka-screen'; scr.style.flexDirection='column';
      var hdr = document.createElement('div'); hdr.className='taz-ka-prev-hdr';
      var eyebrow = document.createElement('div'); eyebrow.className='taz-ka-prev-eyebrow';
      eyebrow.innerHTML='<span>\uD83D\uDCC4 Knowledge Article</span><span class="taz-ka-prev-type" id="taz-ka-prev-type">Task</span>';
      var prevTitle = document.createElement('div'); prevTitle.className='taz-ka-prev-title'; prevTitle.id='taz-ka-prev-title'; prevTitle.textContent='\u2014';
      var meta = document.createElement('div'); meta.className='taz-ka-prev-meta';
      var audMeta = document.createElement('div'); audMeta.className='taz-ka-prev-meta-item';
      audMeta.innerHTML='<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>';
      var audSpan = document.createElement('span'); audSpan.id='taz-ka-prev-aud'; audSpan.textContent='\u2014'; audMeta.appendChild(audSpan);
      var swMeta = document.createElement('div'); swMeta.className='taz-ka-prev-meta-item';
      swMeta.innerHTML='<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/></svg>';
      var swSpan = document.createElement('span'); swSpan.id='taz-ka-prev-sw'; swSpan.textContent='\u2014'; swMeta.appendChild(swSpan);
      var rtMeta = document.createElement('div'); rtMeta.className='taz-ka-prev-meta-item'; rtMeta.id='taz-ka-prev-rt';
      meta.appendChild(audMeta); meta.appendChild(swMeta); meta.appendChild(rtMeta);
      hdr.appendChild(eyebrow); hdr.appendChild(prevTitle); hdr.appendChild(meta);
      scr.appendChild(hdr);
      var prevBody = document.createElement('div'); prevBody.className='taz-ka-prev-body'; prevBody.id='taz-ka-prev-body';
      scr.appendChild(prevBody);
      var nav = document.createElement('div'); nav.className='taz-ka-nav'; nav.style.borderTop='1px solid rgba(26,53,64,.1)';
      var backBtn = document.createElement('button'); backBtn.className='taz-ka-btn taz-ka-btn-ghost'; backBtn.textContent='\u2190 Back';
      backBtn.addEventListener('click', function(){ kaGoTo(3); });
      var btnRow = document.createElement('div'); btnRow.style.cssText='display:flex;gap:6px';
      var regenBtn = document.createElement('button'); regenBtn.className='taz-ka-btn taz-ka-btn-ghost'; regenBtn.id='taz-ka-regen-btn';
      regenBtn.innerHTML='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Regenerate';
      regenBtn.addEventListener('click', kaGenerateArticle);
      var saveBtn = document.createElement('button'); saveBtn.className='taz-ka-btn taz-ka-btn-primary'; saveBtn.id='taz-ka-save-btn';
      saveBtn.innerHTML='Save and publish <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>';
      saveBtn.addEventListener('click', kaSave);
      btnRow.appendChild(regenBtn); btnRow.appendChild(saveBtn);
      nav.appendChild(backBtn); nav.appendChild(btnRow);
      scr.appendChild(nav);
      return scr;
    }

    function kaStartReading() {
      kaGoTo(2);
      var statusList = document.getElementById('taz-ka-status-list');
      var icoMap = {file:'\uD83D\uDCC4',text:'\u270F\uFE0F',url:'\uD83D\uDD17'};
      if (statusList) {
        statusList.innerHTML = '';
        _kaSources.forEach(function(s){
          var item = document.createElement('div'); item.className='taz-ka-src-status-item'; item.id='taz-ka-ss-'+s.id;
          var ico  = document.createElement('span'); ico.style.fontSize='13px'; ico.textContent=icoMap[s.type];
          var name = document.createElement('span'); name.className='taz-ka-src-status-name'; name.textContent=s.label||s.content.slice(0,40)||'Source';
          var badge = document.createElement('span'); badge.className='taz-ka-badge ka-badge-wait'; badge.id='taz-ka-sb-'+s.id; badge.textContent='Waiting';
          item.appendChild(ico); item.appendChild(name); item.appendChild(badge);
          statusList.appendChild(item);
        });
      }
      function setStep(id, st) { var el=document.getElementById(id); if(el){ el.className='taz-ka-proc-step'; if(st) el.classList.add(st); } }
      function setBadge(id, st) {
        var el=document.getElementById('taz-ka-sb-'+id); if(!el) return;
        el.className = 'taz-ka-badge ' + ({reading:'ka-badge-read',done:'ka-badge-done',error:'ka-badge-err'}[st]||'ka-badge-wait');
        el.textContent = {reading:'Reading\u2026',done:'\u2713 Done',error:'\u2717 Error'}[st]||'Waiting';
      }
      setStep('taz-ka-ps-extract','ka-ps-active');
      _kaSources.forEach(function(s){ setBadge(s.id,'reading'); });
      setTimeout(function() {
        _kaSources.forEach(function(s){ setBadge(s.id,'done'); });
        setStep('taz-ka-ps-extract','ka-ps-done');
        setStep('taz-ka-ps-analyse','ka-ps-active');
        setTimeout(function(){
          setStep('taz-ka-ps-analyse','ka-ps-done');
          setStep('taz-ka-ps-map','ka-ps-active');
          fetch('/api/knowledge/extract', {
            method: 'POST',
            headers: hdrs(),
            body: JSON.stringify({ sources: _kaSources.map(function(s){ return { type:s.type, label:s.label, content:s.content }; }) })
          })
          .then(function(r){ return r.json(); })
          .then(function(d){
            if (d.error) throw new Error(d.error);
            _kaMap = d.knowledgeMap;
            setStep('taz-ka-ps-map','ka-ps-done');
            setTimeout(function(){ kaPrefillConfig(); kaGoTo(3); }, 400);
          })
          .catch(function(err){
            var spin = document.getElementById('taz-ka-spin'); if(spin) spin.style.display='none';
            var ptitle = document.getElementById('taz-ka-ptitle'); if(ptitle) ptitle.textContent='Something went wrong';
            var errBox = document.getElementById('taz-ka-err'); if(errBox){ errBox.style.display='block'; errBox.textContent='Could not read sources: '+(err.message||'Unknown error'); }
            setTimeout(function(){
              _kaMap = { article_type:'task', suggested_title:'How to complete the task', suggested_audience:'Team members', software:'the software', suggested_prereqs:'Account access', summary:'This material covers the steps to complete the task.' };
              kaPrefillConfig(); kaGoTo(3);
            }, 2500);
          });
        }, 500);
      }, 600);
    }

    function kaPrefillConfig() {
      if (!_kaMap) return;
      function v(id, val){ if(val){ var el=document.getElementById(id); if(el) el.value=val; } }
      v('taz-ka-cfg-title',   _kaMap.suggested_title);
      v('taz-ka-cfg-aud',     _kaMap.suggested_audience);
      v('taz-ka-cfg-sw',      _kaMap.software);
      v('taz-ka-cfg-prereqs', _kaMap.suggested_prereqs);
      if (_kaMap.article_type) kaSelectType(_kaMap.article_type);
      if (_kaMap.summary) {
        var banner = document.getElementById('taz-ka-km-banner');
        var text   = document.getElementById('taz-ka-km-text');
        if (banner && text) { banner.style.display='flex'; text.textContent='Claude detected: '+_kaMap.summary; }
      }
    }

    function kaGenerateArticle() {
      var title    = (document.getElementById('taz-ka-cfg-title')  ||{}).value || 'Knowledge Article';
      var audience = (document.getElementById('taz-ka-cfg-aud')    ||{}).value || 'Team members';
      var software = (document.getElementById('taz-ka-cfg-sw')     ||{}).value || 'the software';
      var prereqs  = (document.getElementById('taz-ka-cfg-prereqs')||{}).value || 'Account access';
      var focus    = (document.getElementById('taz-ka-cfg-focus')  ||{}).value || '';
      kaGoTo(4);
      var prevBody = document.getElementById('taz-ka-prev-body');
      if (prevBody) {
        prevBody.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 28px;gap:12px;">'
          + '<div class="taz-ka-spin"></div>'
          + '<div style="font-family:Barlow Condensed,sans-serif;font-size:16px;font-weight:700;color:#1A3540;">Generating article\u2026</div>'
          + '<div style="font-size:12px;color:rgba(26,53,64,.4);">Applying knowledge-article-creator skill</div>'
          + '</div>';
      }
      var saveBtn = document.getElementById('taz-ka-save-btn');
      if (saveBtn) saveBtn.disabled = true;
      fetch('/api/knowledge/generate', {
        method: 'POST',
        headers: hdrs(),
        body: JSON.stringify({
          knowledgeMap: _kaMap || {},
          config: { title:title, audience:audience, software:software, prereqs:prereqs, focus:focus, articleType:_kaType, sections:_kaSections }
        })
      })
      .then(function(r){ return r.json(); })
      .then(function(d){
        if (d.error) throw new Error(d.error);
        _kaCurArticle = d.article;
        kaRenderPreview(d.article, title, audience, software);
        if (saveBtn) saveBtn.disabled = false;
      })
      .catch(function(err){
        if (prevBody) prevBody.innerHTML = '<div style="padding:28px;font-size:13px;color:#9b2335;background:rgba(192,57,43,.06);border-radius:8px;margin:24px 28px;">Generation failed: ' + esc(err.message||'Unknown error') + '</div>';
        if (saveBtn) saveBtn.disabled = false;
      });
    }

    function kaRenderPreview(article, title, audience, software) {
      var t = document.getElementById('taz-ka-prev-title'); if(t) t.textContent = article.title || title;
      var pb = document.getElementById('taz-ka-prev-type'); if(pb) pb.textContent = _kaType.charAt(0).toUpperCase()+_kaType.slice(1);
      var pa = document.getElementById('taz-ka-prev-aud');  if(pa) pa.textContent = audience;
      var ps = document.getElementById('taz-ka-prev-sw');   if(ps) ps.textContent = software;
      var pr = document.getElementById('taz-ka-prev-rt');   if(pr && article.readtime) pr.innerHTML='<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'+article.readtime;
      var body = document.getElementById('taz-ka-prev-body');
      if (!body) return;
      body.innerHTML = '';
      var parts = [];
      if (_kaSections.overview) {
        if (_kaType==='concept' && (article.concept_definition||article.overview)) {
          var h='';
          if(article.concept_definition) h+='<div class="taz-ka-concept-def">'+article.concept_definition+'</div>';
          if(article.concept_why) h+='<div class="taz-ka-art-text" style="margin-top:8px"><p><strong>Why it matters</strong></p><p>'+article.concept_why+'</p></div>';
          if(article.concept_example) h+='<div class="taz-ka-art-text" style="margin-top:8px"><p><strong>Example</strong></p><p>'+article.concept_example+'</p></div>';
          if(!h && article.overview) h='<div class="taz-ka-art-text"><p>'+article.overview+'</p></div>';
          if(h) parts.push(kaMkSec('\uD83D\uDD0D','rgba(78,141,153,.1)','Overview',h));
        } else if (_kaType==='reference' && article.reference_intro) {
          parts.push(kaMkSec('\uD83D\uDCCB','rgba(78,141,153,.1)','About this reference','<div class="taz-ka-art-text"><p>'+article.reference_intro+'</p></div>'));
        } else if (article.overview) {
          parts.push(kaMkSec('\uD83D\uDD0D','rgba(78,141,153,.1)','Overview','<div class="taz-ka-art-text"><p>'+article.overview+'</p></div>'));
        }
      }
      if (_kaSections.prereqs && _kaType!=='reference' && (article.prereqs_list||article.prereqs_intro)) {
        var intro = article.prereqs_intro || 'Make sure you have the following before you start.';
        var list  = (article.prereqs_list||[]).map(function(i){ return '<li>'+i+'</li>'; }).join('');
        parts.push(kaMkSec('\u2705','rgba(78,141,153,.07)','Before you start','<div class="taz-ka-art-text"><p>'+intro+'</p>'+(list?'<ul style="margin-top:6px">'+list+'</ul>':'')+'</div>'));
      }
      if (_kaSections.steps && _kaType==='task' && article.steps && article.steps.length) {
        var stepsHtml = '<ol class="taz-ka-step-list">'
          + article.steps.map(function(s,i){
              return '<li class="taz-ka-step-item"><div class="taz-ka-step-n">'+(i+1)+'</div><div class="taz-ka-step-t">'
                + parseBold(s.text||'')
                + (s.outcome ? '<div class="taz-ka-step-outcome">'+s.outcome+'</div>' : '')
                + (s.screenshot ? '<div class="taz-ka-ss-ph"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>Screenshot placeholder</div>' : '')
                + '</div></li>';
            }).join('')
          + '</ol>'
          + (article.steps_achieved ? '<div class="taz-ka-steps-achv">'+article.steps_achieved+'</div>' : '');
        parts.push(kaMkSec('\uD83D\uDCCB','rgba(235,186,149,.1)','Steps',stepsHtml));
      }
      if (_kaType==='reference' && article.reference_rows && article.reference_rows.length) {
        var tbl = '<table class="taz-ka-ref-table"><thead><tr><th>Term</th><th>Description</th></tr></thead><tbody>'
          + article.reference_rows.map(function(r){ return '<tr><td><strong>'+r.term+'</strong></td><td>'+r.description+'</td></tr>'; }).join('')
          + '</tbody></table>';
        parts.push(kaMkSec('\uD83D\uDDC2\uFE0F','rgba(78,141,153,.07)','Reference',tbl));
      }
      if (_kaSections.issues && article.issues && article.issues.length) {
        var iss = '<div class="taz-ka-issue-list">'+article.issues.map(function(i){
          return '<div class="taz-ka-issue-item"><div class="taz-ka-issue-q">'+i.q+'</div><div class="taz-ka-issue-a">'+i.a+'</div></div>';
        }).join('')+'</div>';
        parts.push(kaMkSec('\u26A0\uFE0F','rgba(235,186,149,.12)','Common issues',iss));
      }
      if (_kaSections.scenario && _kaType==='task' && article.scenario) {
        parts.push(kaMkSec('\uD83C\uDFAF','rgba(109,68,94,.07)','Practice scenario','<div class="taz-ka-scenario">'+article.scenario+'</div>'));
      }
      if (_kaSections.confidence && article.confidence && article.confidence.length) {
        var conf = '<div class="taz-ka-conf-items">'+article.confidence.map(function(c){
          return '<div class="taz-ka-conf-item"><div class="taz-ka-conf-cb" onclick="this.classList.toggle(\'ka-on\')"></div>'+c+'</div>';
        }).join('')+'</div>';
        parts.push(kaMkSec('\uD83D\uDCA1','rgba(78,141,153,.06)','Confidence check',conf));
      }
      parts.forEach(function(el,i){
        body.appendChild(el);
        if(i<parts.length-1){ var d=document.createElement('div'); d.className='taz-ka-art-div'; body.appendChild(d); }
      });
      if (_kaSections.related && article.related && article.related.length) {
        var rel = document.createElement('div'); rel.className='taz-ka-related';
        rel.innerHTML='<div class="taz-ka-related-title">Related articles</div><div class="taz-ka-related-list">'
          +article.related.map(function(r){
            return '<a class="taz-ka-related-link" href="#" onclick="return false">'
              +'<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'
              +r+'</a>';
          }).join('')+'</div>';
        body.appendChild(rel);
      }
    }

    function kaMkSec(icon, iconBg, title, html) {
      var s = document.createElement('div'); s.className='taz-ka-art-sec';
      s.innerHTML = '<div class="taz-ka-art-sec-hdr"><div class="taz-ka-art-sec-icon" style="background:'+iconBg+'">'+icon+'</div><div class="taz-ka-art-sec-title">'+title+'</div></div>'+html;
      return s;
    }

    function kaSave() {
      if (!_kaCurArticle) return;
      var id       = kaGenId();
      var title    = _kaCurArticle.title || (document.getElementById('taz-ka-cfg-title')||{}).value || 'Untitled';
      var audience = (document.getElementById('taz-ka-cfg-aud')    ||{}).value || '';
      var software = (document.getElementById('taz-ka-cfg-sw')     ||{}).value || '';
      var prereqs  = (document.getElementById('taz-ka-cfg-prereqs')||{}).value || '';
      var saveBtn  = document.getElementById('taz-ka-save-btn');
      if (saveBtn) { saveBtn.disabled=true; saveBtn.textContent='Saving\u2026'; }
      fetch('/api/knowledge-articles', {
        method: 'POST',
        headers: hdrs(),
        body: JSON.stringify({
          id:id, title:title, articleType:_kaType,
          audience:audience, software:software, prereqs:prereqs,
          articleJson:_kaCurArticle,
          knowledgeSources:_kaSources.map(function(s){ return { type:s.type, label:s.label, charCount:(s.content||'').length }; }),
          knowledgeMap:_kaMap||{}
        })
      })
      .then(function(r){ return r.json(); })
      .then(function(d){
        if (!d.ok) throw new Error('Save failed');
        kaClose();
        if (typeof showDashboard === 'function') showDashboard();
        setTimeout(function(){ alert('\u201c'+title+'\u201d saved to Knowledge Articles.'); }, 300);
      })
      .catch(function(err){
        if (saveBtn) { saveBtn.disabled=false; saveBtn.textContent='Save and publish'; }
        alert('Could not save: '+(err.message||'Unknown error'));
      });
    }

    window._tazOpenKaWizard = kaOpen;
  }());

}());
