(function (global) {
  "use strict";

  // Replace with your GA4 Measurement ID, e.g. "G-ABC123DEF4".
  global.USOJALECO_ANALYTICS_CONFIG = global.USOJALECO_ANALYTICS_CONFIG || {
    measurementId: "G-4E6S9EHGF6",
    debug: false,
    auth: {
      enabled: true,
      provider: "local",
      sessionKey: "uj_site_auth_v1",
      allowedDomains: [],
      allowedEmails: [],
      skipPaths: [],
      forceEntryPath: true,
      entryPath: "/inicio",
      localUsers: [
        {
          username: "arthurambrosi",
          password: "ambrosiambrosi",
          name: "Arthur Ambrosi",
          role: "admin"
        }
      ],
      title: "Acesso UsoJaleco",
      subtitle: "Entre com seu usuario e senha para continuar.",
      logoutText: "Sair"
    }
  };
})(window);
