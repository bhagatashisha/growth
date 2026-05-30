// Paste this snippet into trust.korrali.com and revenue.korrali.com
// Place just before </body> in the root layout.
// Replace GROWTH_API_URL with the actual growth tool URL.

export const TRACKER_SNIPPET = `
(function() {
  try {
    var sid = sessionStorage.getItem('_ksid') ||
      (function() { var s = Math.random().toString(36).slice(2); sessionStorage.setItem('_ksid', s); return s; })();
    var utm = {};
    new URLSearchParams(location.search).forEach(function(v, k) {
      if (k.startsWith('utm_')) utm[k] = v;
    });
    navigator.sendBeacon(
      'https://growth.korrali.com/api/visitor',
      JSON.stringify({ page: location.pathname, referrer: document.referrer, utm: utm, sessionId: sid })
    );
  } catch(e) {}
})();
`.trim();
