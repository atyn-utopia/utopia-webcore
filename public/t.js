/**
 * Utopia Webcore — Lightweight Analytics Tracker
 *
 * Usage: Add this to your website's <head>:
 *   <script defer src="https://utopia-webcore.vercel.app/t.js" data-website="your-domain.vercel.app"></script>
 *
 * Auto-tracks: pageviews on load + navigation
 * Manual tracking:
 *   window.uwc('click', { label: 'whatsapp-button' })
 *   window.uwc('impression', { label: 'product-card-123' })
 */
;(function () {
  'use strict'
  var API = 'https://utopia-webcore.vercel.app/api/public/track'
  var script = document.currentScript
  var website = script && script.getAttribute('data-website')
  if (!website) return

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

  // Expose manual tracking
  window.uwc = function (eventType, extra) {
    send(eventType || 'click', extra)
  }
})()
