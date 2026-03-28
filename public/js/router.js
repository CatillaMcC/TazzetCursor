/**
 * router.js — Tazzet client-side route activation + URL tracking
 *
 * Strategy (v3 — MutationObserver):
 *
 * Phase 3 — Initial route activation
 *   Reads window.TAZZET_ROUTE / PARAMS (set by server.js) and calls the
 *   right app function after authentication completes.
 *
 * Phase 5 — URL tracking
 *   A MutationObserver watches the four view elements for class changes
 *   that the app already makes, and calls history.pushState accordingly.
 *   This is far more reliable than trying to intercept function calls from
 *   a separate strict-mode file.
 *
 *   Watch targets and signals:
 *     #edit-wrap      .active added   → push /projects/:id
 *     #settings-wrap  .open added     → push /workspace/:tab
 *     #settings-wrap  .open removed   → push /
 *     #wizard-wrap    .taz-modal added → push /projects/new
 *     #wizard-wrap    .taz-modal removed + editor not open → push /
 *     #dash-wrap      .active added   → push /
 *
 * Phase 5 — Back / forward
 *   popstate triggers a full page reload. The server returns the correct
 *   TAZZET_ROUTE for the popped URL and Phase 3 activates the right view.
 *   Simple, reliable, no state management needed.
 */
(function () {
  'use strict';

  /* ── Page titles ──────────────────────────────────────────────────── */
  var TITLES = {
    'dashboard':           'Tazzet',
    'wizard':              'New lesson \u2014 Tazzet',
    'editor':              'Editor \u2014 Tazzet',
    'preview':             'Preview \u2014 Tazzet',
    'workspace.settings':  'Settings \u2014 Tazzet',
    'workspace.profiles':  'Learner profiles \u2014 Tazzet',
    'workspace.templates': 'Course templates \u2014 Tazzet',
  };

  /* ── Route → path ─────────────────────────────────────────────────── */
  function routeToPath(route, params) {
    params = params || {};
    switch (route) {
      case 'dashboard':           return '/';
      case 'wizard':              return '/projects/new';
      case 'editor':              return '/projects/' + (params.projectId || '');
      case 'preview':             return '/projects/' + (params.projectId || '') + '/preview';
      case 'workspace.settings':  return '/workspace/settings';
      case 'workspace.profiles':  return '/workspace/profiles';
      case 'workspace.templates': return '/workspace/templates';
      default:                    return '/';
    }
  }

  function setTitle(route) {
    document.title = TITLES[route] || 'Tazzet';
  }

  /* pushRoute is deduplicated — never pushes the same path twice */
  function pushRoute(route, params) {
    var path = routeToPath(route, params);
    if (window.location.pathname === path) return;
    history.pushState({ route: route, params: params || {} }, '', path);
    setTitle(route);
    console.log('[tazzet/router] push:', route, path);
  }

  /* Read the active settings tab from the DOM */
  function currentSettingsRoute() {
    var active = document.querySelector('.settings-tab.active');
    if (active) {
      var tab = active.dataset.stab || 'workspace';
      if (tab === 'profiles')  return 'workspace.profiles';
      if (tab === 'templates') return 'workspace.templates';
    }
    return 'workspace.settings';
  }

  /* ── MutationObserver ─────────────────────────────────────────────── */
  function startObserver() {
    var editWrap     = document.getElementById('edit-wrap');
    var settingsWrap = document.getElementById('settings-wrap');
    var wizardWrap   = document.getElementById('wizard-wrap');
    var dashWrap     = document.getElementById('dash-wrap');

    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type !== 'attributes' || m.attributeName !== 'class') continue;
        var el = m.target;

        /* Project editor opened */
        if (el === editWrap && el.classList.contains('active')) {
          var pid = window._tazProjectId || '';
          pushRoute(pid ? 'editor' : 'wizard', pid ? { projectId: pid } : {});
        }

        /* Settings panel opened or closed */
        if (el === settingsWrap) {
          if (el.classList.contains('open')) {
            /* Read the active tab — settingsTab() runs before .open is added */
            pushRoute(currentSettingsRoute());
          } else {
            pushRoute('dashboard');
          }
        }

        /* Wizard modal opened or closed */
        if (el === wizardWrap) {
          if (el.classList.contains('taz-modal')) {
            pushRoute('wizard');
          } else if (!editWrap || !editWrap.classList.contains('active')) {
            pushRoute('dashboard');
          }
        }

        /* Dashboard shown (catches goToWizard / return-to-dash flows) */
        if (el === dashWrap && el.classList.contains('active')) {
          pushRoute('dashboard');
        }
      }
    });

    var opts = { attributes: true, attributeFilter: ['class'] };
    if (editWrap)     observer.observe(editWrap, opts);
    if (settingsWrap) observer.observe(settingsWrap, opts);
    if (wizardWrap)   observer.observe(wizardWrap, opts);
    if (dashWrap)     observer.observe(dashWrap, opts);

    console.log('[tazzet/router] observer started');
  }

  /* ── popstate: full reload ────────────────────────────────────────── */
  window.addEventListener('popstate', function () {
    /* The browser has already updated location.href to the popped URL.
       Reloading sends that URL to the server, which sets the correct
       TAZZET_ROUTE, and Phase 3 activates the right view.             */
    window.location.reload();
  });

  /* ── Initial route setup ─────────────────────────────────────────── */
  var initialRoute  = window.TAZZET_ROUTE  || 'dashboard';
  var initialParams = window.TAZZET_PARAMS || {};

  /* Replace the initial history entry with structured state */
  history.replaceState(
    { route: initialRoute, params: initialParams },
    '',
    routeToPath(initialRoute, initialParams)
  );
  setTitle(initialRoute);

  /* ── activate: fire the right app function for the initial route ── */
  function activate(route, params) {
    params = params || {};
    console.log('[tazzet/router] activate:', route, params);

    switch (route) {

      case 'wizard':
        if (typeof window.dashNewLesson === 'function') {
          window.dashNewLesson();
        }
        break;

      case 'editor':
        if (params.projectId && typeof window.loadProject === 'function') {
          window.loadProject(params.projectId);
        }
        break;

      case 'preview':
        if (params.projectId && typeof window.loadProject === 'function') {
          window.loadProject(params.projectId);
          var tries = 0;
          var iv = setInterval(function () {
            tries++;
            if (window._editData) {
              clearInterval(iv);
              if (typeof window.previewLesson === 'function') {
                window.previewLesson();
              }
            }
            if (tries > 60) clearInterval(iv);
          }, 50);
        }
        break;

      case 'workspace.settings':
        if (typeof window.openSettings === 'function') {
          window.openSettings('workspace');
        }
        break;

      case 'workspace.profiles':
        if (typeof window.openSettings === 'function') {
          window.openSettings('profiles');
        }
        break;

      case 'workspace.templates':
        if (typeof window.openSettings === 'function') {
          window.openSettings('templates');
        }
        break;
    }
  }

  /* ── hookShowDashboard ───────────────────────────────────────────────
     Polls until window.showDashboard exists (defined in the app script),
     then wraps it so we can act immediately after auth completes.

     Also wraps window.loadProject here — both functions are guaranteed
     to be defined by the time showDashboard exists.                    */
  function hookShowDashboard() {
    if (typeof window.showDashboard !== 'function') {
      setTimeout(hookShowDashboard, 50);
      return;
    }

    /* Wrap loadProject to capture the project ID being opened.
       _currentProjectId is a let in the app's script scope and is not
       accessible from here, so we intercept at the call boundary.     */
    if (typeof window.loadProject === 'function') {
      var origLP = window.loadProject;
      window.loadProject = function loadProject(id) {
        window._tazProjectId = id;
        return origLP.apply(this, arguments);
      };
    }

    /* Wrap showDashboard — fires once after auth, starts everything */
    var hooked    = false;
    var origShow  = window.showDashboard;

    window.showDashboard = function showDashboard() {
      origShow.apply(this, arguments);

      if (hooked) return;
      hooked = true;

      /* Start observing DOM class changes for URL tracking */
      startObserver();

      /* Activate the initial route if we're not on the dashboard */
      if (initialRoute !== 'dashboard') {
        setTimeout(function () {
          activate(initialRoute, initialParams);
        }, 100);
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hookShowDashboard);
  } else {
    hookShowDashboard();
  }

})();
