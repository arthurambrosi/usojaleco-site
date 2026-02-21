(function (window, document) {
  "use strict";

  var runtimeConfig = window.USOJALECO_ANALYTICS_CONFIG || {};
  var measurementId = String(runtimeConfig.measurementId || "").trim();
  var debug = !!runtimeConfig.debug;

  initUnifiedAuth(runtimeConfig.auth || {});

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

  function initUnifiedAuth(rawConfig) {
    var config = rawConfig || {};
    if (config.enabled === false) {
      return;
    }

    var provider = String(config.provider || "google").toLowerCase();
    if (provider !== "google" && provider !== "local") {
      return;
    }

    var skipPaths = toStringArray(config.skipPaths);
    if (pathMatches(window.location.pathname || "/", skipPaths)) {
      return;
    }

    var sessionKey = String(config.sessionKey || "uj_site_auth_v1").trim() || "uj_site_auth_v1";
    var googleClientId = String(config.googleClientId || "").trim();
    var allowedDomains = toStringArray(config.allowedDomains).map(toLowerSafe);
    var allowedEmails = toStringArray(config.allowedEmails).map(toLowerSafe);
    var protectedPaths = toStringArray(config.protectedPaths);
    var localUsersStorageKey = String(config.localUsersStorageKey || "uj_site_local_users_v1").trim() || "uj_site_local_users_v1";
    var configLocalUsers = normalizeLocalUsers(config.localUsers);
    var localUsers = [];
    var allowGuest = config.allowGuest !== false;
    var allowSignup = config.allowSignup !== false;
    var forceEntryPath = config.forceEntryPath !== false;
    var entryPath = String(config.entryPath || "/inicio").trim() || "/inicio";

    refreshLocalUsers();
    if (protectedPaths.length && !pathMatches(window.location.pathname || "/", protectedPaths)) {
      disableAuthUi();
      exposeDisabledApi();
      return;
    }

    var text = {
      title: String(config.title || "Acesso restrito"),
      subtitle: String(
        config.subtitle ||
          (provider === "local"
            ? "Entre com seu usuario e senha para continuar."
            : "Entre com sua conta Google para continuar.")
      ),
      waiting: String(config.waitingText || "Carregando login Google..."),
      retry: String(config.retryText || "Tentar novamente"),
      error: String(config.errorText || "Nao foi possivel autenticar agora."),
      blocked: String(config.blockedText || "Este e-mail nao tem permissao para acessar este conteudo."),
      logout: String(config.logoutText || "Sair"),
      usernameLabel: String(config.usernameLabel || "Usuario"),
      passwordLabel: String(config.passwordLabel || "Senha"),
      usernamePlaceholder: String(config.usernamePlaceholder || "Digite seu usuario"),
      passwordPlaceholder: String(config.passwordPlaceholder || "Digite sua senha"),
      submitLabel: String(config.submitLabel || "Entrar"),
      invalidCredentials: String(config.invalidCredentialsText || "Usuario ou senha invalidos."),
      guestLabel: String(config.guestLabel || "Entrar como visitante"),
      signupToggleLabel: String(config.signupToggleLabel || "Criar conta"),
      signupNameLabel: String(config.signupNameLabel || "Nome"),
      signupUserLabel: String(config.signupUserLabel || "Novo usuario"),
      signupPassLabel: String(config.signupPassLabel || "Nova senha"),
      signupPassConfirmLabel: String(config.signupPassConfirmLabel || "Confirmar senha"),
      signupNamePlaceholder: String(config.signupNamePlaceholder || "Seu nome"),
      signupUserPlaceholder: String(config.signupUserPlaceholder || "Escolha um usuario"),
      signupPassPlaceholder: String(config.signupPassPlaceholder || "Crie uma senha"),
      signupPassConfirmPlaceholder: String(config.signupPassConfirmPlaceholder || "Repita a senha"),
      signupCreateLabel: String(config.signupCreateLabel || "Criar e entrar"),
      signupCancelLabel: String(config.signupCancelLabel || "Cancelar"),
      signupExistsText: String(config.signupExistsText || "Esse usuario ja existe."),
      signupSuccessText: String(config.signupSuccessText || "Conta criada com sucesso."),
      signupInvalidText: String(config.signupInvalidText || "Preencha os dados corretamente.")
    };

    var ui = ensureAuthUi(text);
    var currentUser = null;

    function disableAuthUi() {
      var overlay = document.getElementById("uj-auth-overlay");
      var account = document.getElementById("uj-auth-account");
      document.documentElement.classList.remove("uj-auth-locked");
      if (overlay) {
        overlay.style.display = "none";
      }
      if (account) {
        account.style.display = "none";
      }
    }

    function exposeDisabledApi() {
      window.USOJALECO_AUTH = window.USOJALECO_AUTH || {};
      window.USOJALECO_AUTH.sessionKey = sessionKey;
      window.USOJALECO_AUTH.getUser = function () {
        return null;
      };
      window.USOJALECO_AUTH.isAuthenticated = function () {
        return false;
      };
      window.USOJALECO_AUTH.logout = function () {
        try {
          window.localStorage.removeItem(sessionKey);
        } catch (_err) {
          // no-op
        }
      };
    }

    function readStoredUser() {
      var data = readJsonStorage(sessionKey);
      if (!data || (!data.email && !data.username)) {
        return null;
      }

      if (isFiniteNumber(data.exp) && Number(data.exp) > 0 && Math.floor(Date.now() / 1000) >= Number(data.exp)) {
        clearStoredUser();
        return null;
      }

      var user = normalizeUser(data);
      if (provider === "google") {
        if (!isAllowedEmail(user.email)) {
          clearStoredUser();
          return null;
        }
      } else if (!isAllowedLocalUser(user.username || user.email)) {
        clearStoredUser();
        return null;
      }

      return user;
    }

    function setStoredUser(user) {
      writeJsonStorage(sessionKey, normalizeUser(user));
    }

    function clearStoredUser() {
      try {
        window.localStorage.removeItem(sessionKey);
      } catch (_err) {
        // no-op
      }
    }

    function setUiError(message) {
      ui.error.textContent = message || text.error;
      ui.error.style.display = "block";
    }

    function resetUiError() {
      ui.error.textContent = "";
      ui.error.style.display = "none";
    }

    function updateApi() {
      window.USOJALECO_AUTH = window.USOJALECO_AUTH || {};
      window.USOJALECO_AUTH.sessionKey = sessionKey;
      window.USOJALECO_AUTH.getUser = function () {
        return currentUser ? copyUser(currentUser) : null;
      };
      window.USOJALECO_AUTH.isAuthenticated = function () {
        return !!currentUser;
      };
      window.USOJALECO_AUTH.logout = function () {
        clearStoredUser();
        applyState(null);
        clearProviderState();
      };
    }

    function clearProviderState() {
      if (provider !== "google") {
        return;
      }
      if (window.google && window.google.accounts && window.google.accounts.id) {
        try {
          window.google.accounts.id.disableAutoSelect();
        } catch (_err) {
          // no-op
        }
      }
    }

    function normalizedEntryPath() {
      return normalizePathForAuth(entryPath);
    }

    function isOnEntryPath() {
      return normalizePathForAuth(window.location.pathname || "/") === normalizedEntryPath();
    }

    function isSafeNextPath(path) {
      var value = String(path || "").trim();
      if (!value) {
        return false;
      }
      if (value.charAt(0) !== "/") {
        return false;
      }
      if (value.indexOf("//") === 0) {
        return false;
      }
      return true;
    }

    function buildEntryUrl() {
      var target = normalizedEntryPath();
      if (!forceEntryPath) {
        return target;
      }

      var currentFull = window.location.pathname + window.location.search + window.location.hash;
      if (isOnEntryPath() || !isSafeNextPath(currentFull)) {
        return target;
      }

      return target + "?next=" + encodeURIComponent(currentFull);
    }

    function redirectToEntryIfNeeded() {
      if (!forceEntryPath || isOnEntryPath()) {
        return false;
      }

      var targetUrl = buildEntryUrl();
      var currentFull = window.location.pathname + window.location.search + window.location.hash;
      if (targetUrl === currentFull) {
        return false;
      }

      window.location.replace(targetUrl);
      return true;
    }

    function getNextParam() {
      try {
        var params = new URLSearchParams(window.location.search || "");
        return String(params.get("next") || "");
      } catch (_err) {
        return "";
      }
    }

    function redirectToNextAfterLogin() {
      if (!forceEntryPath || !isOnEntryPath()) {
        return;
      }

      var next = getNextParam();
      if (!isSafeNextPath(next)) {
        return;
      }

      if (normalizePathForAuth(next) === normalizedEntryPath()) {
        return;
      }

      window.location.replace(next);
    }

    function emitState() {
      var detail = {
        authenticated: !!currentUser,
        user: currentUser ? copyUser(currentUser) : null
      };

      try {
        var eventObj;
        if (typeof window.CustomEvent === "function") {
          eventObj = new window.CustomEvent("usojaleco:auth-change", { detail: detail });
        } else {
          eventObj = document.createEvent("CustomEvent");
          eventObj.initCustomEvent("usojaleco:auth-change", false, false, detail);
        }
        window.dispatchEvent(eventObj);
      } catch (_err) {
        // no-op
      }
    }

    function renderAccount(user) {
      ui.account.style.display = "flex";
      ui.name.textContent = user.name || user.email || "Usuario";
      ui.email.textContent = formatUserSubtitle(user);
      if (user.picture) {
        ui.avatar.textContent = "";
        ui.avatar.style.backgroundImage = "url(\"" + user.picture.replace(/"/g, "%22") + "\")";
        ui.avatar.classList.add("has-image");
      } else {
        ui.avatar.classList.remove("has-image");
        ui.avatar.style.backgroundImage = "";
        ui.avatar.textContent = getInitial(user.name || user.email || "U");
      }
    }

    function lockScreen() {
      document.documentElement.classList.add("uj-auth-locked");
      ui.overlay.style.display = "flex";
      ui.account.style.display = "none";
      ui.status.textContent = "";
      resetUiError();
      startLoginFlow();
    }

    function unlockScreen(user) {
      document.documentElement.classList.remove("uj-auth-locked");
      ui.overlay.style.display = "none";
      renderAccount(user);
    }

    function applyState(user) {
      currentUser = user ? normalizeUser(user) : null;
      if (currentUser) {
        unlockScreen(currentUser);
        redirectToNextAfterLogin();
      } else {
        if (redirectToEntryIfNeeded()) {
          return;
        }
        lockScreen();
      }
      updateApi();
      emitState();
    }

    function startLoginFlow() {
      if (provider === "local") {
        startLocalLogin();
        return;
      }
      startGoogleButton();
    }

    function startLocalLogin() {
      resetUiError();
      ui.status.textContent = "";
      ui.retry.style.display = "none";
      ui.googleMount.innerHTML = "";
      refreshLocalUsers();

      if (!localUsers.length && !allowGuest && !allowSignup) {
        setUiError("Configure auth.localUsers em /analytics-config.js.");
        return;
      }

      var form = document.createElement("form");
      form.id = "uj-auth-local-form";
      form.setAttribute("autocomplete", "on");

      var userField = document.createElement("label");
      userField.className = "uj-auth-field";
      var userLabel = document.createElement("span");
      userLabel.textContent = text.usernameLabel;
      var userInput = document.createElement("input");
      userInput.type = "text";
      userInput.autocomplete = "username";
      userInput.placeholder = text.usernamePlaceholder;
      userInput.required = true;
      userField.appendChild(userLabel);
      userField.appendChild(userInput);

      var passField = document.createElement("label");
      passField.className = "uj-auth-field";
      var passLabel = document.createElement("span");
      passLabel.textContent = text.passwordLabel;
      var passInput = document.createElement("input");
      passInput.type = "password";
      passInput.autocomplete = "current-password";
      passInput.placeholder = text.passwordPlaceholder;
      passInput.required = true;
      passField.appendChild(passLabel);
      passField.appendChild(passInput);

      var submit = document.createElement("button");
      submit.type = "submit";
      submit.textContent = text.submitLabel;

      var altRow = document.createElement("div");
      altRow.className = "uj-auth-alt-row";

      var guestBtn = null;
      if (allowGuest) {
        guestBtn = document.createElement("button");
        guestBtn.type = "button";
        guestBtn.className = "uj-auth-alt-btn";
        guestBtn.textContent = text.guestLabel;
        altRow.appendChild(guestBtn);
      }

      var signupToggle = null;
      if (allowSignup) {
        signupToggle = document.createElement("button");
        signupToggle.type = "button";
        signupToggle.className = "uj-auth-alt-btn";
        signupToggle.textContent = text.signupToggleLabel;
        altRow.appendChild(signupToggle);
      }

      var signupBox = null;
      var signupNameInput = null;
      var signupUserInput = null;
      var signupPassInput = null;
      var signupPassConfirmInput = null;
      var signupSubmit = null;
      var signupCancel = null;

      if (allowSignup) {
        signupBox = document.createElement("div");
        signupBox.className = "uj-auth-signup";
        signupBox.style.display = "none";

        function createSignupField(labelText, placeholderText, type, autocompleteValue) {
          var field = document.createElement("label");
          field.className = "uj-auth-field";
          var label = document.createElement("span");
          label.textContent = labelText;
          var input = document.createElement("input");
          input.type = type || "text";
          input.placeholder = placeholderText || "";
          input.autocomplete = autocompleteValue || "off";
          field.appendChild(label);
          field.appendChild(input);
          return { field: field, input: input };
        }

        var fName = createSignupField(text.signupNameLabel, text.signupNamePlaceholder, "text", "name");
        var fUser = createSignupField(text.signupUserLabel, text.signupUserPlaceholder, "text", "username");
        var fPass = createSignupField(text.signupPassLabel, text.signupPassPlaceholder, "password", "new-password");
        var fPass2 = createSignupField(
          text.signupPassConfirmLabel,
          text.signupPassConfirmPlaceholder,
          "password",
          "new-password"
        );

        signupNameInput = fName.input;
        signupUserInput = fUser.input;
        signupPassInput = fPass.input;
        signupPassConfirmInput = fPass2.input;

        signupBox.appendChild(fName.field);
        signupBox.appendChild(fUser.field);
        signupBox.appendChild(fPass.field);
        signupBox.appendChild(fPass2.field);

        var signupActions = document.createElement("div");
        signupActions.className = "uj-auth-signup-actions";

        signupSubmit = document.createElement("button");
        signupSubmit.type = "button";
        signupSubmit.textContent = text.signupCreateLabel;

        signupCancel = document.createElement("button");
        signupCancel.type = "button";
        signupCancel.className = "secondary";
        signupCancel.textContent = text.signupCancelLabel;

        signupActions.appendChild(signupSubmit);
        signupActions.appendChild(signupCancel);
        signupBox.appendChild(signupActions);
      }

      form.appendChild(userField);
      form.appendChild(passField);
      form.appendChild(submit);
      if (allowGuest || allowSignup) {
        form.appendChild(altRow);
      }
      if (signupBox) {
        form.appendChild(signupBox);
      }
      ui.googleMount.appendChild(form);

      function setSignupVisible(show) {
        if (!signupBox) {
          return;
        }
        signupBox.style.display = show ? "grid" : "none";
        if (signupToggle) {
          signupToggle.textContent = show ? text.signupCancelLabel : text.signupToggleLabel;
        }
      }

      if (signupToggle) {
        signupToggle.addEventListener("click", function () {
          setSignupVisible(signupBox && signupBox.style.display === "none");
        });
      }

      if (signupCancel) {
        signupCancel.addEventListener("click", function () {
          setSignupVisible(false);
        });
      }

      if (guestBtn) {
        guestBtn.addEventListener("click", function () {
          resetUiError();
          ui.status.textContent = "";
          var guestUser = normalizeUser({
            email: "visitante@usojaleco.local",
            username: "visitante",
            name: "Visitante",
            picture: "",
            sub: "local:visitante",
            provider: "local",
            role: "guest",
            iat: Math.floor(Date.now() / 1000),
            exp: 0
          });
          setStoredUser(guestUser);
          applyState(guestUser);
        });
      }

      if (signupSubmit) {
        signupSubmit.addEventListener("click", function () {
          resetUiError();
          ui.status.textContent = "";

          var signupName = String(signupNameInput.value || "").trim();
          var signupUser = normalizeLoginKey(signupUserInput.value || "");
          var signupPass = String(signupPassInput.value || "");
          var signupPassConfirm = String(signupPassConfirmInput.value || "");

          if (!signupName || !signupUser || signupUser.length < 3 || signupPass.length < 4 || signupPass !== signupPassConfirm) {
            setUiError(text.signupInvalidText);
            return;
          }

          if (!/^[a-z0-9._-]+$/.test(signupUser)) {
            setUiError("Use apenas letras, numeros, ponto, underscore ou hifen.");
            return;
          }

          if (findLocalUserByIdentity(signupUser)) {
            setUiError(text.signupExistsText);
            return;
          }

          var created = createCustomUser({
            username: signupUser,
            password: signupPass,
            name: signupName,
            role: "user"
          });

          if (!created) {
            setUiError(text.signupInvalidText);
            return;
          }

          ui.status.textContent = text.signupSuccessText;
          userInput.value = created.username;
          passInput.value = created.password;
          setSignupVisible(false);

          var createdUser = normalizeUser({
            email: created.email || created.username,
            username: created.username,
            name: created.name || created.username,
            picture: created.picture || "",
            sub: created.sub || ("local:" + created.username),
            provider: "local",
            role: created.role || "user",
            iat: Math.floor(Date.now() / 1000),
            exp: 0
          });
          setStoredUser(createdUser);
          applyState(createdUser);
        });
      }

      form.addEventListener("submit", function (eventObj) {
        eventObj.preventDefault();
        resetUiError();
        ui.status.textContent = "";

        var typedUser = normalizeLoginKey(userInput.value);
        var typedPass = String(passInput.value || "");
        if (!typedUser || !typedPass) {
          setUiError(text.invalidCredentials);
          return;
        }

        var localUser = findLocalUser(typedUser, typedPass);
        if (!localUser) {
          setUiError(text.invalidCredentials);
          passInput.value = "";
          passInput.focus();
          return;
        }

        var authUser = normalizeUser({
          email: localUser.email || localUser.username,
          username: localUser.username,
          name: localUser.name || localUser.username,
          picture: localUser.picture || "",
          sub: localUser.sub || ("local:" + localUser.username),
          provider: "local",
          role: localUser.role || "user",
          iat: Math.floor(Date.now() / 1000),
          exp: 0
        });

        setStoredUser(authUser);
        applyState(authUser);
      });

      window.setTimeout(function () {
        try {
          userInput.focus();
        } catch (_err) {
          // no-op
        }
      }, 30);
    }

    function onCredentialResponse(response) {
      var payload = parseJwt(response && response.credential);
      if (!payload || !payload.email) {
        setUiError(text.error);
        ui.retry.style.display = "inline-flex";
        return;
      }

      var user = normalizeUser({
        email: payload.email,
        name: payload.name || payload.given_name || payload.email,
        picture: payload.picture || "",
        sub: payload.sub || "",
        iat: payload.iat || 0,
        exp: payload.exp || 0,
        provider: "google"
      });

      if (!isAllowedEmail(user.email)) {
        clearStoredUser();
        setUiError(text.blocked);
        ui.retry.style.display = "inline-flex";
        return;
      }

      setStoredUser(user);
      applyState(user);
    }

    function mountGoogleButton() {
      if (!googleClientId) {
        setUiError("Configure auth.googleClientId em /analytics-config.js.");
        ui.retry.style.display = "none";
        ui.status.textContent = "";
        return;
      }

      if (!(window.google && window.google.accounts && window.google.accounts.id)) {
        setUiError(text.error);
        ui.retry.style.display = "inline-flex";
        ui.status.textContent = "";
        return;
      }

      resetUiError();
      ui.status.textContent = "";
      ui.retry.style.display = "none";
      ui.googleMount.innerHTML = "";

      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: onCredentialResponse
        });
        window.google.accounts.id.renderButton(ui.googleMount, {
          theme: "outline",
          size: "large",
          shape: "pill",
          width: 320,
          text: "continue_with"
        });
      } catch (_err) {
        setUiError(text.error);
        ui.retry.style.display = "inline-flex";
      }
    }

    function startGoogleButton() {
      ui.status.textContent = text.waiting;
      ui.retry.style.display = "none";
      ui.googleMount.innerHTML = "";

      ensureGoogleScript(function (err) {
        if (err) {
          ui.status.textContent = "";
          setUiError(text.error);
          ui.retry.style.display = "inline-flex";
          return;
        }
        mountGoogleButton();
      });
    }

    function normalizeLocalUsers(list) {
      var result = [];
      if (!Array.isArray(list)) {
        return result;
      }

      for (var i = 0; i < list.length; i += 1) {
        var item = list[i] || {};
        var username = normalizeLoginKey(item.username || item.user || item.login || item.email || "");
        var password = String(item.password || item.pass || "").trim();
        if (!username || !password) {
          continue;
        }

        result.push({
          username: username,
          password: password,
          name: String(item.name || item.displayName || item.username || item.user || "").trim(),
          email: String(item.email || item.username || item.user || "").trim(),
          picture: String(item.picture || "").trim(),
          role: String(item.role || "user").trim() || "user",
          sub: String(item.sub || "").trim()
        });
      }

      return result;
    }

    function mergeUsers(baseUsers, extraUsers) {
      var map = {};
      var merged = [];

      function appendUser(user) {
        if (!user || !user.username) {
          return;
        }
        if (map[user.username]) {
          return;
        }
        map[user.username] = true;
        merged.push(user);
      }

      for (var i = 0; i < baseUsers.length; i += 1) {
        appendUser(baseUsers[i]);
      }
      for (var j = 0; j < extraUsers.length; j += 1) {
        appendUser(extraUsers[j]);
      }

      return merged;
    }

    function refreshLocalUsers() {
      var storedUsers = normalizeLocalUsers(readJsonStorage(localUsersStorageKey));
      localUsers = mergeUsers(configLocalUsers, storedUsers);
    }

    function createCustomUser(payload) {
      var normalized = normalizeLocalUsers([payload]);
      if (!normalized.length) {
        return null;
      }

      refreshLocalUsers();
      var candidate = normalized[0];
      if (findLocalUserByIdentity(candidate.username)) {
        return null;
      }

      var storedUsers = normalizeLocalUsers(readJsonStorage(localUsersStorageKey));
      storedUsers.push(candidate);
      writeJsonStorage(localUsersStorageKey, storedUsers);
      refreshLocalUsers();
      return candidate;
    }

    function findLocalUserByIdentity(value) {
      var key = normalizeLoginKey(value);
      if (!key) {
        return null;
      }
      for (var i = 0; i < localUsers.length; i += 1) {
        var item = localUsers[i];
        if (item.username === key || normalizeLoginKey(item.email) === key) {
          return item;
        }
      }
      return null;
    }

    function findLocalUser(username, password) {
      for (var i = 0; i < localUsers.length; i += 1) {
        var item = localUsers[i];
        if (item.username === username && item.password === password) {
          return item;
        }
      }
      return null;
    }

    function normalizeLoginKey(value) {
      return String(value || "").trim().toLowerCase();
    }

    function isAllowedLocalUser(loginValue) {
      var key = normalizeLoginKey(loginValue);
      if (!key) {
        return false;
      }

      if (allowGuest && key === "visitante") {
        return true;
      }

      if (!localUsers.length) {
        return false;
      }

      for (var i = 0; i < localUsers.length; i += 1) {
        var item = localUsers[i];
        if (item.username === key) {
          return true;
        }
        if (normalizeLoginKey(item.email) === key) {
          return true;
        }
      }

      return false;
    }

    function isAllowedEmail(email) {
      var normalizedEmail = toLowerSafe(email);
      if (!normalizedEmail) {
        return false;
      }

      if (!allowedEmails.length && !allowedDomains.length) {
        return true;
      }

      if (allowedEmails.indexOf(normalizedEmail) !== -1) {
        return true;
      }

      var atPos = normalizedEmail.lastIndexOf("@");
      if (atPos === -1) {
        return false;
      }

      var domain = normalizedEmail.slice(atPos + 1);
      return allowedDomains.indexOf(domain) !== -1;
    }

    ui.retry.addEventListener("click", function () {
      startLoginFlow();
    });

    ui.logout.addEventListener("click", function () {
      clearStoredUser();
      applyState(null);
      clearProviderState();
    });

    window.addEventListener("storage", function (eventObj) {
      if (!eventObj || eventObj.key !== sessionKey) {
        return;
      }
      applyState(readStoredUser());
    });

    updateApi();
    applyState(readStoredUser());

    function formatUserSubtitle(user) {
      var role = String(user && user.role ? user.role : "user").toUpperCase();
      var id = String(user && (user.username || user.email) ? user.username || user.email : "").trim();
      if (!id) {
        return role;
      }
      return role + " | " + id;
    }
  }

  function ensureUnifiedHeader(ui) {
    ensureUnifiedHeaderStyles();

    var existing = document.getElementById("uj-unified-header");
    var header = existing || document.createElement("div");
    var inner;
    var left;
    var center;
    var right;

    if (!existing) {
      header.id = "uj-unified-header";

      inner = document.createElement("div");
      inner.id = "uj-unified-inner";

      left = document.createElement("div");
      left.id = "uj-unified-left";

      center = document.createElement("div");
      center.id = "uj-unified-center";
      center.setAttribute("data-has-search", "0");

      right = document.createElement("div");
      right.id = "uj-unified-right";

      var brandLink = document.createElement("a");
      brandLink.id = "uj-unified-brand";
      brandLink.href = "/inicio";
      brandLink.setAttribute("aria-label", "UsoJaleco");

      var logo = document.createElement("img");
      logo.id = "uj-unified-brand-logo";
      logo.alt = "Logo UsoJaleco";
      logo.src = findUnifiedHeaderLogo();

      var brandText = document.createElement("div");
      brandText.id = "uj-unified-brand-text";
      var brandPartA = document.createElement("span");
      brandPartA.textContent = "uso";
      var brandPartB = document.createElement("b");
      brandPartB.textContent = "jaleco";
      brandText.appendChild(brandPartA);
      brandText.appendChild(brandPartB);

      brandLink.appendChild(logo);
      brandLink.appendChild(brandText);
      left.appendChild(brandLink);

      inner.appendChild(left);
      inner.appendChild(center);
      inner.appendChild(right);
      header.appendChild(inner);

      if (document.body && document.body.firstChild) {
        document.body.insertBefore(header, document.body.firstChild);
      } else if (document.body) {
        document.body.appendChild(header);
      } else {
        document.documentElement.appendChild(header);
      }
    } else {
      inner = document.getElementById("uj-unified-inner");
      left = document.getElementById("uj-unified-left");
      center = document.getElementById("uj-unified-center");
      right = document.getElementById("uj-unified-right");
    }

    if (!right || !center) {
      return;
    }

    var legacyHeaders = collectLegacyHeaders(header);
    var searchNode = findSearchNodeInLegacyHeaders(legacyHeaders);
    mountSearchInUnifiedCenter(center, searchNode);
    hideLegacyHeaders(legacyHeaders);

    if (ui && ui.account) {
      ui.account.classList.add("uj-auth-account-inline");
      if (ui.account.parentNode !== right) {
        right.appendChild(ui.account);
      }
    }
  }

  function findUnifiedHeaderLogo() {
    var fallback = "https://raw.githubusercontent.com/arthurambrosi/usojaleco/0204905b333f11d1eec3c7c6667d17dbfb457774/Design%20sem%20nome%20(28).png";
    var candidates = [
      "img[src*='Design%20sem%20nome%20(28)']",
      "img[alt*='UsoJaleco' i]",
      ".brand img",
      "header img"
    ];

    for (var i = 0; i < candidates.length; i += 1) {
      var node = document.querySelector(candidates[i]);
      if (node && node.getAttribute) {
        var src = String(node.getAttribute("src") || node.src || "").trim();
        if (src) {
          return src;
        }
      }
    }

    return fallback;
  }

  function collectLegacyHeaders(unifiedHeader) {
    var headers = [];
    if (!document.body || !document.body.children) {
      return headers;
    }

    var children = Array.prototype.slice.call(document.body.children);
    for (var i = 0; i < children.length && i < 12; i += 1) {
      var child = children[i];
      if (!child || child === unifiedHeader) {
        continue;
      }
      if (child.id === "uj-auth-overlay" || child.id === "uj-auth-account") {
        continue;
      }
      if (isLikelyLegacyHeader(child)) {
        headers.push(child);
      }
    }

    return headers;
  }

  function isLikelyLegacyHeader(node) {
    if (!node || !node.tagName) {
      return false;
    }

    var tag = String(node.tagName || "").toLowerCase();
    var cls = String(node.className || "").toLowerCase();
    var id = String(node.id || "").toLowerCase();
    var marker = tag + " " + cls + " " + id;

    if (tag === "header") {
      return true;
    }

    if (marker.indexOf("topbar") !== -1 || marker.indexOf("header") !== -1 || marker.indexOf("navbar") !== -1) {
      return true;
    }

    if (node.querySelector) {
      if (node.querySelector(".brand,.brandName,[class*='brand'],[id*='brand']")) {
        return true;
      }
      if (node.querySelector("img[alt*='UsoJaleco' i]")) {
        return true;
      }
      if (node.querySelector("[role='search'],.searchWrap,.searchPill")) {
        return true;
      }
    }

    return false;
  }

  function findSearchNodeInLegacyHeaders(headers) {
    for (var i = 0; i < headers.length; i += 1) {
      var header = headers[i];
      if (!header || !header.querySelectorAll) {
        continue;
      }

      var containerCandidates = header.querySelectorAll("[role='search'],.searchWrap,.searchPill,.searchBox,.search-bar,.search");
      for (var j = 0; j < containerCandidates.length; j += 1) {
        var container = containerCandidates[j];
        if (containsSearchInput(container)) {
          return container;
        }
      }

      var inputs = header.querySelectorAll(
        "input[type='search'],input[placeholder*='busca' i],input[placeholder*='busque' i],input[placeholder*='pesquis' i],input[id*='search' i],input[class*='search' i],input[id='q'],input[name='q']"
      );
      for (var k = 0; k < inputs.length; k += 1) {
        var input = inputs[k];
        if (!looksLikeSearchInput(input)) {
          continue;
        }
        var wrap = input.closest("form,[role='search'],.searchWrap,.searchPill,.searchBox,.search-bar");
        return wrap || input;
      }
    }

    return null;
  }

  function containsSearchInput(node) {
    if (!node || !node.querySelectorAll) {
      return false;
    }
    var inputs = node.querySelectorAll("input,textarea");
    for (var i = 0; i < inputs.length; i += 1) {
      if (looksLikeSearchInput(inputs[i])) {
        return true;
      }
    }
    return false;
  }

  function looksLikeSearchInput(input) {
    if (!input || !input.tagName) {
      return false;
    }

    var tag = String(input.tagName || "").toLowerCase();
    if (tag !== "input" && tag !== "textarea") {
      return false;
    }

    var type = String(input.type || "text").toLowerCase();
    if (type === "password" || type === "email" || type === "number" || type === "tel" || type === "date" || type === "datetime-local" || type === "month" || type === "time" || type === "week" || type === "url") {
      return false;
    }

    if (type === "search") {
      return true;
    }

    var marker =
      String(input.id || "") +
      " " +
      String(input.name || "") +
      " " +
      String(input.className || "") +
      " " +
      String(input.getAttribute("placeholder") || "") +
      " " +
      String(input.getAttribute("aria-label") || "");
    marker = marker.toLowerCase();

    if (marker.indexOf("search") !== -1 || marker.indexOf("pesquis") !== -1 || marker.indexOf("busca") !== -1 || marker.indexOf("busque") !== -1) {
      return true;
    }

    return marker.trim() === "q";
  }

  function mountSearchInUnifiedCenter(center, searchNode) {
    if (!center) {
      return;
    }

    while (center.firstChild) {
      center.removeChild(center.firstChild);
    }

    if (!searchNode) {
      center.setAttribute("data-has-search", "0");
      return;
    }

    var tag = String(searchNode.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") {
      var wrap = document.createElement("div");
      wrap.className = "uj-unified-search-wrap";
      wrap.appendChild(searchNode);
      center.appendChild(wrap);
    } else {
      center.appendChild(searchNode);
    }

    searchNode.setAttribute("data-uj-search-in-head", "1");
    center.setAttribute("data-has-search", "1");
  }

  function hideLegacyHeaders(headers) {
    for (var i = 0; i < headers.length; i += 1) {
      var node = headers[i];
      if (!node || node.id === "uj-unified-header") {
        continue;
      }
      node.setAttribute("data-uj-legacy-header", "1");
      node.style.display = "none";
    }
  }

  function ensureUnifiedHeaderStyles() {
    if (document.getElementById("uj-unified-header-style")) {
      return;
    }

    var style = document.createElement("style");
    style.id = "uj-unified-header-style";
    style.textContent =
      "#uj-unified-header{position:sticky;top:0;z-index:2147483000;background:#fff;border-bottom:1px solid #e2e8f0;box-shadow:0 8px 18px rgba(15,23,42,.08);}" +
      "#uj-unified-inner{max-width:1240px;height:64px;margin:0 auto;padding:0 16px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:14px;}" +
      "#uj-unified-left{display:flex;align-items:center;min-width:170px;}" +
      "#uj-unified-brand{display:flex;align-items:center;gap:10px;color:#334155;text-decoration:none;user-select:none;}" +
      "#uj-unified-brand-logo{height:28px;width:auto;display:block;}" +
      "#uj-unified-brand-text{display:flex;align-items:baseline;gap:0;font-family:Outfit,Manrope,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:18px;font-weight:500;color:#475569;}" +
      "#uj-unified-brand-text b{font-weight:800;color:#334155;}" +
      "#uj-unified-center{display:flex;justify-content:center;align-items:center;min-width:0;}" +
      "#uj-unified-center>*{width:min(760px,100%);}" +
      "#uj-unified-center .searchWrap{width:100%;display:flex;justify-content:center;}" +
      "#uj-unified-center .searchPill{width:min(760px,100%);}" +
      "#uj-unified-center .uj-unified-search-wrap{display:flex;justify-content:center;width:min(760px,100%);}" +
      "#uj-unified-center input[type='search'],#uj-unified-center input[type='text']{max-width:100%;}" +
      "#uj-unified-right{display:flex;justify-content:flex-end;align-items:center;min-width:150px;}" +
      "[data-uj-legacy-header='1']{display:none !important;}" +
      "@media (max-width:860px){#uj-unified-inner{grid-template-columns:auto minmax(0,1fr) auto;height:60px;gap:10px;padding:0 12px;}#uj-unified-left{min-width:130px;}#uj-unified-right{min-width:100px;}#uj-unified-brand-text{font-size:16px;}#uj-unified-brand-logo{height:24px;}}" +
      "@media (max-width:640px){#uj-unified-inner{grid-template-columns:auto auto;grid-template-areas:'left right' 'center center';height:auto;row-gap:10px;padding:10px 12px;}#uj-unified-left{grid-area:left;}#uj-unified-right{grid-area:right;min-width:0;}#uj-unified-center{grid-area:center;}}";

    document.head.appendChild(style);
  }

  function ensureAuthUi(text) {
    var existingOverlay = document.getElementById("uj-auth-overlay");
    var existingAccount = document.getElementById("uj-auth-account");
    if (existingOverlay && existingAccount) {
      return {
        overlay: existingOverlay,
        account: existingAccount,
        googleMount: document.getElementById("uj-auth-google-mount"),
        status: document.getElementById("uj-auth-status"),
        error: document.getElementById("uj-auth-error"),
        retry: document.getElementById("uj-auth-retry"),
        logout: document.getElementById("uj-auth-logout"),
        name: document.getElementById("uj-auth-name"),
        email: document.getElementById("uj-auth-email"),
        avatar: document.getElementById("uj-auth-avatar")
      };
    }

    ensureAuthStyles();

    var overlay = document.createElement("div");
    overlay.id = "uj-auth-overlay";
    overlay.setAttribute("aria-hidden", "true");

    var card = document.createElement("div");
    card.id = "uj-auth-card";

    var title = document.createElement("h2");
    title.id = "uj-auth-title";
    title.textContent = text.title;

    var subtitle = document.createElement("p");
    subtitle.id = "uj-auth-subtitle";
    subtitle.textContent = text.subtitle;

    var googleMount = document.createElement("div");
    googleMount.id = "uj-auth-google-mount";

    var status = document.createElement("p");
    status.id = "uj-auth-status";

    var error = document.createElement("p");
    error.id = "uj-auth-error";
    error.style.display = "none";

    var retry = document.createElement("button");
    retry.id = "uj-auth-retry";
    retry.type = "button";
    retry.textContent = text.retry;
    retry.style.display = "none";

    card.appendChild(title);
    card.appendChild(subtitle);
    card.appendChild(googleMount);
    card.appendChild(status);
    card.appendChild(error);
    card.appendChild(retry);
    overlay.appendChild(card);

    var account = document.createElement("div");
    account.id = "uj-auth-account";
    account.style.display = "none";

    var avatar = document.createElement("span");
    avatar.id = "uj-auth-avatar";
    avatar.textContent = "U";

    var meta = document.createElement("div");
    meta.id = "uj-auth-meta";

    var name = document.createElement("strong");
    name.id = "uj-auth-name";
    name.textContent = "Usuario";

    var email = document.createElement("small");
    email.id = "uj-auth-email";
    email.textContent = "";

    meta.appendChild(name);
    meta.appendChild(email);

    var logout = document.createElement("button");
    logout.id = "uj-auth-logout";
    logout.type = "button";
    logout.textContent = text.logout;

    account.appendChild(avatar);
    account.appendChild(meta);
    account.appendChild(logout);

    if (document.body) {
      document.body.appendChild(overlay);
      document.body.appendChild(account);
    } else {
      document.documentElement.appendChild(overlay);
      document.documentElement.appendChild(account);
    }

    return {
      overlay: overlay,
      account: account,
      googleMount: googleMount,
      status: status,
      error: error,
      retry: retry,
      logout: logout,
      name: name,
      email: email,
      avatar: avatar
    };
  }

  function ensureAuthStyles() {
    if (document.getElementById("uj-auth-style")) {
      return;
    }

    var style = document.createElement("style");
    style.id = "uj-auth-style";
    style.textContent =
      "html.uj-auth-locked,html.uj-auth-locked body{overflow:hidden !important;}" +
      "#uj-auth-overlay{position:fixed;inset:0;z-index:2147483647;display:none;align-items:center;justify-content:center;padding:16px;background:radial-gradient(1200px 500px at 10% 10%,rgba(249,115,22,.22),transparent 60%),radial-gradient(1200px 500px at 90% 10%,rgba(15,23,42,.10),transparent 60%),rgba(255,255,255,.94);}" +
      "#uj-auth-card{width:min(420px,96vw);background:#fff;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 20px 45px rgba(15,23,42,.15);padding:22px;font-family:Manrope,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;}" +
      "#uj-auth-title{margin:0;font-size:26px;line-height:1.1;font-weight:800;color:#0f172a;}" +
      "#uj-auth-subtitle{margin:10px 0 16px;font-size:14px;line-height:1.5;color:#475569;}" +
      "#uj-auth-google-mount{display:flex;justify-content:center;align-items:center;min-height:44px;}" +
      "#uj-auth-local-form{width:100%;display:grid;gap:10px;margin-top:4px;}" +
      "#uj-auth-local-form .uj-auth-field{display:grid;gap:6px;text-align:left;}" +
      "#uj-auth-local-form .uj-auth-field span{font-size:12px;font-weight:700;color:#334155;}" +
      "#uj-auth-local-form input{height:40px;padding:0 12px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#0f172a;font:600 14px Manrope,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;}" +
      "#uj-auth-local-form input:focus{outline:none;border-color:#f97316;box-shadow:0 0 0 3px rgba(249,115,22,.16);}" +
      "#uj-auth-local-form button{height:40px;padding:0 14px;border:0;border-radius:999px;background:linear-gradient(90deg,#f97316,#fb923c);color:#fff;font:800 14px Manrope,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;cursor:pointer;}" +
      "#uj-auth-local-form button:hover{filter:brightness(.98);}" +
      "#uj-auth-local-form .uj-auth-alt-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}" +
      "#uj-auth-local-form .uj-auth-alt-btn{height:34px;padding:0 12px;border-radius:999px;border:1px solid #e2e8f0;background:#fff;color:#334155;font:700 12px Manrope,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;cursor:pointer;}" +
      "#uj-auth-local-form .uj-auth-alt-btn:hover{border-color:#f97316;color:#c2410c;background:#fff7ed;}" +
      "#uj-auth-local-form .uj-auth-signup{display:grid;gap:8px;border:1px solid #e2e8f0;border-radius:12px;padding:10px;background:#f8fafc;}" +
      "#uj-auth-local-form .uj-auth-signup-actions{display:flex;gap:8px;}" +
      "#uj-auth-local-form .uj-auth-signup-actions .secondary{background:#fff;border:1px solid #e2e8f0;color:#334155;font-weight:700;}" +
      "#uj-auth-status{margin:10px 0 0;font-size:12px;color:#64748b;text-align:center;}" +
      "#uj-auth-error{margin:10px 0 0;font-size:13px;color:#b91c1c;text-align:center;}" +
      "#uj-auth-retry{margin:12px auto 0;height:38px;padding:0 16px;border-radius:999px;border:1px solid #f97316;background:#fff;color:#c2410c;font-weight:700;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;}" +
      "#uj-auth-account{position:fixed;top:12px;right:12px;z-index:2147483646;display:none;align-items:center;gap:8px;padding:4px 8px;background:#fff;border:1px solid #e2e8f0;border-radius:999px;box-shadow:0 8px 20px rgba(15,23,42,.12);font-family:Manrope,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;}" +
      "#uj-auth-account.uj-auth-account-inline{position:static;box-shadow:none;}" +
      "#uj-auth-avatar{width:28px;height:28px;border-radius:999px;background:#f97316;color:#fff;font-size:12px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;background-size:cover;background-position:center;}" +
      "#uj-auth-avatar.has-image{color:transparent;}" +
      "#uj-auth-meta{display:flex;flex-direction:column;min-width:0;}" +
      "#uj-auth-name{font-size:11px;line-height:1.1;color:#0f172a;max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
      "#uj-auth-email{font-size:10px;line-height:1.1;color:#64748b;max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
      "#uj-auth-logout{height:24px;padding:0 8px;border-radius:999px;border:0;background:transparent;color:#64748b;font-size:11px;font-weight:700;cursor:pointer;}" +
      "#uj-auth-logout:hover{background:#f8fafc;color:#0f172a;}" +
      "@media (max-width:720px){#uj-auth-account{top:8px;right:8px;}#uj-auth-email{display:none;}#uj-auth-name{max-width:90px;}}";

    document.head.appendChild(style);
  }

  function ensureGoogleScript(done) {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      done();
      return;
    }

    var existing = document.getElementById("uj-gsi-script");
    if (existing) {
      existing.addEventListener(
        "load",
        function () {
          done();
        },
        { once: true }
      );
      existing.addEventListener(
        "error",
        function () {
          done(new Error("gsi_load_error"));
        },
        { once: true }
      );
      return;
    }

    var script = document.createElement("script");
    script.id = "uj-gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.addEventListener(
      "load",
      function () {
        done();
      },
      { once: true }
    );
    script.addEventListener(
      "error",
      function () {
        done(new Error("gsi_load_error"));
      },
      { once: true }
    );
    document.head.appendChild(script);
  }

  function parseJwt(token) {
    var parts = String(token || "").split(".");
    if (parts.length < 2) {
      return null;
    }

    var payload = decodeBase64Url(parts[1]);
    if (!payload) {
      return null;
    }

    try {
      return JSON.parse(payload);
    } catch (_err) {
      return null;
    }
  }

  function decodeBase64Url(value) {
    var base = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
    while (base.length % 4 !== 0) {
      base += "=";
    }

    try {
      var binary = window.atob(base);
      var chars = [];
      for (var i = 0; i < binary.length; i += 1) {
        var code = binary.charCodeAt(i).toString(16);
        chars.push("%" + ("00" + code).slice(-2));
      }
      return decodeURIComponent(chars.join(""));
    } catch (_err) {
      try {
        return window.atob(base);
      } catch (_err2) {
        return "";
      }
    }
  }

  function normalizeUser(user) {
    var normalized = {
      email: String(user && user.email ? user.email : "").trim(),
      username: String(user && user.username ? user.username : "").trim(),
      name: String(user && user.name ? user.name : "").trim(),
      picture: String(user && user.picture ? user.picture : "").trim(),
      sub: String(user && user.sub ? user.sub : "").trim(),
      provider: String(user && user.provider ? user.provider : "local").trim() || "local",
      role: String(user && user.role ? user.role : "user").trim() || "user",
      iat: isFiniteNumber(user && user.iat) ? Number(user.iat) : 0,
      exp: isFiniteNumber(user && user.exp) ? Number(user.exp) : 0
    };

    if (!normalized.email && normalized.username) {
      normalized.email = normalized.username;
    }

    if (!normalized.username && normalized.email) {
      normalized.username = normalized.email;
    }

    if (!normalized.name) {
      normalized.name = normalized.email || "Usuario";
    }

    return normalized;
  }

  function copyUser(user) {
    return {
      email: user.email,
      username: user.username,
      name: user.name,
      picture: user.picture,
      sub: user.sub,
      provider: user.provider,
      role: user.role,
      iat: user.iat,
      exp: user.exp
    };
  }

  function toStringArray(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map(function (item) {
        return String(item || "").trim();
      })
      .filter(function (item) {
        return !!item;
      });
  }

  function toLowerSafe(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizePathForAuth(pathname) {
    var path = String(pathname || "/");
    try {
      path = decodeURIComponent(path);
    } catch (_err) {
      // no-op
    }

    path = path.split("#")[0].split("?")[0];
    if (!path) {
      path = "/";
    }
    if (path.charAt(0) !== "/") {
      path = "/" + path;
    }

    path = path.replace(/\\/g, "/").replace(/\/{2,}/g, "/");

    if (path.length > 1 && path.slice(-1) === "/") {
      path = path.slice(0, -1);
    }

    if (path.toLowerCase().slice(-11) === "/index.html") {
      path = path.slice(0, -11) || "/";
    }

    return path.toLowerCase() || "/";
  }

  function pathMatches(pathname, patterns) {
    if (!patterns || !patterns.length) {
      return false;
    }

    var currentPath = normalizePathForAuth(pathname || "/");

    for (var i = 0; i < patterns.length; i += 1) {
      var rawPattern = String(patterns[i] || "").trim();
      if (!rawPattern) {
        continue;
      }

      var hasWildcard = rawPattern.slice(-1) === "*";
      var normalizedPattern = normalizePathForAuth(hasWildcard ? rawPattern.slice(0, -1) : rawPattern);

      if (hasWildcard && currentPath.indexOf(normalizedPattern) === 0) {
        return true;
      }

      if (currentPath === normalizedPattern) {
        return true;
      }

      if (currentPath.indexOf(normalizedPattern + "/") === 0) {
        return true;
      }
    }

    return false;
  }

  function readJsonStorage(key) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw);
    } catch (_err) {
      return null;
    }
  }

  function writeJsonStorage(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (_err) {
      // no-op
    }
  }

  function isFiniteNumber(value) {
    var number = Number(value);
    return Number.isFinite ? Number.isFinite(number) : isFinite(number);
  }

  function getInitial(value) {
    var safe = String(value || "").trim();
    if (!safe) {
      return "U";
    }
    return safe.charAt(0).toUpperCase();
  }
})(window, document);
