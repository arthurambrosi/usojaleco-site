/* Medição pública. Sem login local, campos de formulários ou textos de WhatsApp. */
(function(window, document) {
  "use strict";
  try { ["uj_site_auth_v1", "uj_site_local_users_v1"].forEach(function(k) { localStorage.removeItem(k); sessionStorage.removeItem(k); }); } catch (_) {}
  if (!/^(www\.)?usojaleco\.com\.br$/.test(location.hostname) || window.ujAnalyticsLoaded) return;
  var id = (window.USOJALECO_ANALYTICS_CONFIG || {}).measurementId || ((window.UJ || {}).config || {}).ga4;
  if (!/^G-[A-Z0-9]+$/.test(id || "")) return;
  window.ujAnalyticsLoaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function() { window.dataLayer.push(arguments); };
  var script = document.createElement("script"); script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
  document.head.appendChild(script);
  window.gtag("js", new Date());
  window.gtag("config", id, { page_location: location.origin + location.pathname,
    page_referrer: document.referrer ? new URL(document.referrer).origin : "",
    allow_google_signals: false, allow_ad_personalization_signals: false });
  document.addEventListener("click", function(e) {
    var a = e.target.closest && e.target.closest("a[href]"); if (!a) return;
    var u; try { u = new URL(a.href); } catch (_) { return; }
    if (u.protocol === "mailto:" || /^(wa\.me|api\.whatsapp\.com)$/.test(u.hostname)) {
      window.gtag("event", "contact_click", { contact_type: u.protocol === "mailto:" ? "email" : "whatsapp" });
    } else if (u.hostname === "payfast.greenn.com.br") {
      window.gtag("event", "checkout_click", { provider: "greenn" });
    }
  });
})(window, document);
