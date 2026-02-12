(function (window, document) {
  "use strict";

  var runtimeConfig = window.USOJALECO_ANALYTICS_CONFIG || {};
  var measurementId = String(runtimeConfig.measurementId || "").trim();
  var debug = !!runtimeConfig.debug;

  if (!measurementId || measurementId === "G-XXXXXXXXXX") {
    if (debug && window.console) {
      console.warn("[analytics] Defina measurementId em /analytics-config.js");
    }
    return;
  }

  var gaScript = document.createElement("script");
  gaScript.async = true;
  gaScript.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);
  document.head.appendChild(gaScript);

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, 100);
  }

  function event(name, params) {
    window.gtag("event", name, params || {});
    if (debug && window.console) {
      console.log("[analytics:event]", name, params || {});
    }
  }

  function getPagePayload() {
    return {
      page_title: cleanText(document.title),
      page_location: window.location.href,
      page_path: window.location.pathname + window.location.search
    };
  }

  function isExternalLink(url) {
    try {
      var parsed = new URL(url, window.location.href);
      return parsed.origin !== window.location.origin;
    } catch (_err) {
      return false;
    }
  }

  function getUrlFromOnclick(node) {
    var onclick = node.getAttribute("onclick") || "";
    var openMatch = onclick.match(/window\.open\(\s*['"]([^'"]+)['"]/i);
    if (openMatch && openMatch[1]) {
      return openMatch[1];
    }
    return "";
  }

  var filePattern = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|csv|zip|rar)$/i;

  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    anonymize_ip: true,
    send_page_view: false
  });

  event("page_view", getPagePayload());

  document.addEventListener(
    "click",
    function (ev) {
      var node = ev.target && ev.target.closest ? ev.target.closest("a,button,[data-track-event]") : null;
      if (!node) {
        return;
      }

      var customEvent = node.getAttribute("data-track-event");
      var customLabel = cleanText(node.getAttribute("data-track-label") || node.textContent || node.getAttribute("aria-label"));

      if (customEvent) {
        event(customEvent, {
          label: customLabel || "custom"
        });
        return;
      }

      var tagName = (node.tagName || "").toLowerCase();
      var label = cleanText(node.textContent || node.getAttribute("aria-label") || tagName);

      if (tagName === "a") {
        var href = node.href || node.getAttribute("href") || "";
        if (!href) {
          href = getUrlFromOnclick(node);
        }
        if (!href) {
          return;
        }

        var hrefLower = href.toLowerCase();

        if (hrefLower.indexOf("wa.me") !== -1 || hrefLower.indexOf("whatsapp.com") !== -1) {
          event("contact_click", {
            contact_type: "whatsapp",
            link_url: href,
            link_text: label
          });
          return;
        }

        if (hrefLower.indexOf("mailto:") === 0) {
          event("contact_click", {
            contact_type: "email",
            link_url: href,
            link_text: label
          });
          return;
        }

        if (filePattern.test(hrefLower.split("?")[0])) {
          event("file_download", {
            file_url: href,
            file_name: href.split("/").pop() || href
          });
          return;
        }

        if (isExternalLink(href)) {
          event("outbound_click", {
            link_url: href,
            link_text: label
          });
        }

        return;
      }

      if (tagName === "button") {
        event("button_click", {
          button_text: label || "button"
        });
      }
    },
    true
  );

  var forms = document.querySelectorAll("form");
  forms.forEach(function (form) {
    form.addEventListener("submit", function () {
      event("form_submit", {
        form_name: cleanText(form.getAttribute("name") || form.getAttribute("id") || form.getAttribute("action") || "form")
      });
    });
  });
})(window, document);
