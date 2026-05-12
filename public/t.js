/**
 * Utopia Webcore — Lightweight Analytics Tracker + Alt-Text Override Applier
 *
 * Usage: Add this to your website's <head>:
 *   <script defer src="https://utopia-webcore.vercel.app/t.js" data-website="your-domain.vercel.app"></script>
 *
 * Auto-tracks: pageviews on load + navigation.
 * Auto-applies: alt-text overrides set in the webcore SEO admin — walks every
 *   <img> on the page and fills in `alt=` from the override map (matched by src).
 *   Re-applies on DOM mutations so client-rendered images get covered too.
 * Manual tracking:
 *   window.uwc('click', { label: 'whatsapp-button' })
 *   window.uwc('impression', { label: 'product-card-123' })
 */
;(function () {
  'use strict'
  var script = document.currentScript
  var website = script && script.getAttribute('data-website')
  if (!website) return
  // Derive ORIGIN from the script's own URL so this tracker keeps working
  // when webcore moves between Vercel projects or domain aliases change.
  // Hardcoding caused every analytics + GTM-config fetch to 404 once the
  // production domain switched from utopia-webcore.vercel.app to
  // webcore.utopiaai.my.
  var ORIGIN = 'https://webcore.utopiaai.my'
  try {
    if (script && script.src) ORIGIN = new URL(script.src).origin
  } catch (e) { /* fall back to the literal */ }
  var API = ORIGIN + '/api/public/track'
  var ALTS_API = ORIGIN + '/api/public/seo/alts'
  var CONFIG_API = ORIGIN + '/api/public/config'

  // Simple session ID (persists per tab, no cookies)
  var sid = sessionStorage.getItem('_uwc_sid')
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36)
    sessionStorage.setItem('_uwc_sid', sid)
  }

  // Device detection
  var ua = navigator.userAgent || ''
  var device = /Mobile|Android|iPhone/i.test(ua) ? 'mobile' : /Tablet|iPad/i.test(ua) ? 'tablet' : 'desktop'
  var browser = /Firefox/i.test(ua) ? 'Firefox' : /Edg/i.test(ua) ? 'Edge' : /Chrome/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : 'Other'

  function send(eventType, extra) {
    var data = {
      website: website,
      event_type: eventType,
      path: location.pathname,
      referrer: document.referrer || null,
      device: device,
      browser: browser,
      session_id: sid,
      label: (extra && extra.label) || null,
    }
    if (navigator.sendBeacon) {
      navigator.sendBeacon(API, JSON.stringify(data))
    } else {
      var xhr = new XMLHttpRequest()
      xhr.open('POST', API, true)
      xhr.setRequestHeader('Content-Type', 'application/json')
      xhr.send(JSON.stringify(data))
    }
  }

  // Track pageview on load
  send('pageview')

  // Track SPA navigations (pushState/replaceState)
  var origPush = history.pushState
  var origReplace = history.replaceState
  history.pushState = function () {
    origPush.apply(this, arguments)
    setTimeout(function () { send('pageview') }, 10)
  }
  history.replaceState = function () {
    origReplace.apply(this, arguments)
    setTimeout(function () { send('pageview') }, 10)
  }
  window.addEventListener('popstate', function () {
    setTimeout(function () { send('pageview') }, 10)
  })

  // Expose manual tracking. Two side-effects:
  //   1. POST to /api/public/track for first-party webcore analytics.
  //   2. Push to window.dataLayer so any GTM container loaded by the GTM
  //      auto-connect flow can hang triggers off the same event name
  //      (e.g. `whatsapp_click` → GA4 Event tag → counted in Analytics).
  // Designer code that already calls window.uwc('whatsapp_click') therefore
  // lights up GTM-side tracking with no additional integration work.
  window.uwc = function (eventType, extra) {
    var name = eventType || 'click'
    send(name, extra)
    try {
      window.dataLayer = window.dataLayer || []
      var payload = { event: name }
      if (extra && extra.label != null) payload.label = extra.label
      window.dataLayer.push(payload)
    } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------------------
  // Alt-text override applier
  // ---------------------------------------------------------------------------
  // Match an <img> against the override map by absolute URL, original src
  // attribute, and the path portion. This covers most ways designer sites
  // reference images (relative, root-relative, absolute, with/without query).
  function srcKeys(img) {
    var keys = []
    var raw = img.getAttribute('src')
    if (raw) keys.push(raw)
    var resolved = img.src
    if (resolved && keys.indexOf(resolved) === -1) keys.push(resolved)
    if (resolved) {
      try {
        var u = new URL(resolved)
        if (keys.indexOf(u.pathname) === -1) keys.push(u.pathname)
        var noQuery = u.origin + u.pathname
        if (keys.indexOf(noQuery) === -1) keys.push(noQuery)
      } catch (e) { /* ignore */ }
    }
    return keys
  }

  var altMap = null
  // Per-image marker — uses a direct property instead of dataset so we don't
  // crash on legacy browsers that don't support the dataset API, and so we
  // don't keep mutating attributes (which would feed back into observers).
  var APPLIED = '__uwcAltApplied'
  function applyAlts() {
    if (!altMap) return
    var imgs = document.getElementsByTagName('img')
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i]
      if (img[APPLIED]) continue
      var keys = srcKeys(img)
      for (var k = 0; k < keys.length; k++) {
        if (Object.prototype.hasOwnProperty.call(altMap, keys[k])) {
          img.setAttribute('alt', altMap[keys[k]])
          img[APPLIED] = 1
          break
        }
      }
    }
  }

  function loadAlts() {
    try {
      var xhr = new XMLHttpRequest()
      // Don't cache-bust — the public endpoint sets a short Cache-Control
      // (~30s), so freshly saved overrides propagate quickly without slamming
      // the API on every SPA navigation.
      xhr.open('GET', ALTS_API + '?website=' + encodeURIComponent(website), true)
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return
        if (xhr.status < 200 || xhr.status >= 300) return
        try {
          var body = JSON.parse(xhr.responseText)
          var list = (body && body.overrides) || []
          altMap = {}
          for (var i = 0; i < list.length; i++) {
            altMap[list[i].src] = list[i].alt
          }
          applyAlts()
        } catch (e) { /* ignore */ }
      }
      xhr.send()
    } catch (e) { /* ignore */ }
  }

  loadAlts()

  // ---------------------------------------------------------------------------
  // Per-site config — currently used to inject GTM at runtime so admins can
  // toggle GA/GTM on/off without redeploying the customer site.
  // ---------------------------------------------------------------------------
  function injectGtm(gtmId) {
    if (!gtmId || window.__uwcGtmLoaded) return
    window.__uwcGtmLoaded = true
    // Standard GTM snippet — initialise dataLayer + load gtm.js. Skipping the
    // <noscript> iframe; the tracker is JS-only anyway.
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' })
    var s = document.createElement('script')
    s.async = true
    s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(gtmId)
    var first = document.getElementsByTagName('script')[0]
    if (first && first.parentNode) first.parentNode.insertBefore(s, first)
    else document.head.appendChild(s)
  }

  function loadConfig() {
    try {
      var xhr = new XMLHttpRequest()
      xhr.open('GET', CONFIG_API + '?website=' + encodeURIComponent(website), true)
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return
        if (xhr.status < 200 || xhr.status >= 300) return
        try {
          var body = JSON.parse(xhr.responseText)
          if (body && body.gtmId) injectGtm(body.gtmId)
        } catch (e) { /* ignore */ }
      }
      xhr.send()
    } catch (e) { /* ignore */ }
  }

  loadConfig()

  // Re-apply when the DOM changes — covers client-rendered images and SPA nav.
  // Coalesce bursts of mutations into one applyAlts pass per frame so we don't
  // stall the main thread on busy pages (infinite scroll, ad reflow, etc.).
  if (typeof MutationObserver !== 'undefined') {
    var pending = false
    var schedule = (typeof requestAnimationFrame === 'function')
      ? function (fn) { requestAnimationFrame(fn) }
      : function (fn) { setTimeout(fn, 50) }
    var mo = new MutationObserver(function () {
      if (!altMap || pending) return
      pending = true
      schedule(function () { pending = false; applyAlts() })
    })
    mo.observe(document.documentElement, { childList: true, subtree: true })
  }
})()
