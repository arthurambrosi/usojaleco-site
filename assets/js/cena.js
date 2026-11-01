/*
 * Uso Jaleco — cena de projeção da home.
 *
 * Desenha um auditório e uma sala de tutoria e projeta as capas do portfólio
 * com transições de apresentação (foco, persiana, varredura e mosaico). A luz
 * da sala acompanha a cor do slide projetado.
 *
 * Para usar uma foto (por exemplo, gerada por IA) no lugar do desenho, preencha
 * UJ.config.cena.<auditorio|tutoria>.fundo com o caminho da imagem (16:9) e
 * ajuste "tela" com a posição da tela/TV em porcentagem da imagem.
 */
(function () {
  "use strict";

  var UJ = window.UJ || {};
  var PORT = (UJ.portfolio || []).slice();
  var CFG = (UJ.config && UJ.config.cena) || {};
  var doc = document;
  var raiz = doc.documentElement.getAttribute("data-raiz") || "";
  var semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function img(nome, pequeno) { return raiz + "assets/img/portfolio/" + nome + (pequeno ? "-sm" : "") + ".webp"; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  // Gerador pseudoaleatório fixo, para a plateia ser sempre a mesma
  function rnd(seed) { return function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

  // ---------------- Desenhos ----------------
  function svgAuditorio() {
    var r = rnd(7), s = "";
    s += '<defs>' +
      '<linearGradient id="a-parede" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050505"/><stop offset=".55" stop-color="#101010"/><stop offset="1" stop-color="#070707"/></linearGradient>' +
      '<linearGradient id="a-poltrona" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d0d0d"/><stop offset=".25" stop-color="#050505"/><stop offset="1" stop-color="#000"/></linearGradient>' +
      '<radialGradient id="a-painel" cx=".5" cy=".4" r=".55"><stop offset="0" stop-color="#1c1c1c"/><stop offset="1" stop-color="#0b0b0b"/></radialGradient>' +
      '</defs>';
    s += '<rect width="1600" height="900" fill="url(#a-parede)"/>';
    // painéis acústicos
    for (var x = 24; x < 370; x += 42) s += '<rect x="' + x + '" y="' + (70 + (x % 3) * 4) + '" width="34" height="560" rx="2" fill="url(#a-painel)" opacity="' + (0.55 + x / 900) + '"/>';
    for (x = 1240; x < 1580; x += 42) s += '<rect x="' + x + '" y="' + (70 + (x % 3) * 4) + '" width="34" height="560" rx="2" fill="url(#a-painel)" opacity="' + (0.55 + (1600 - x) / 900) + '"/>';
    // luzes do teto (plateia apagada)
    for (x = 120; x < 1600; x += 170) s += '<circle cx="' + x + '" cy="34" r="3" fill="#ffd9bf" opacity=".35"/><ellipse cx="' + x + '" cy="40" rx="26" ry="8" fill="#ffd9bf" opacity=".04"/>';
    // moldura da tela
    s += '<rect x="390" y="100" width="820" height="470" rx="4" fill="#020202" stroke="#1e1e1e" stroke-width="2"/>';
    // palco
    s += '<path d="M250 590 L1350 590 L1440 676 L160 676 Z" fill="#111"/>';
    s += '<path d="M160 676 L1440 676" stroke="#ff6b1a" stroke-width="2.5" opacity=".75"/>';
    s += '<path d="M160 678 L1440 678 L1440 700 L160 700 Z" fill="#070707"/>';
    // púlpito
    s += '<path d="M1238 560 L1338 560 L1328 600 L1322 676 L1254 676 L1248 600 Z" fill="#161616"/>' +
      '<path d="M1232 556 L1344 556 L1338 566 L1238 566 Z" fill="#1f1f1f"/>' +
      '<rect x="1279" y="610" width="18" height="18" rx="2" fill="#ff6b1a" opacity=".9"/>' +
      '<path d="M1262 556 L1300 556 L1306 540 L1268 540 Z" class="luz-preenche" opacity=".55"/>';
    // plateia: fileiras de poltronas, de trás para frente
    var fileiras = 6;
    for (var f = 0; f < fileiras; f++) {
      var w = 70 + f * 24, base = 700 + f * 40 + f * f * 7, gap = w * 0.14, curva = 30 + f * 14;
      var inicio = -((w + gap) * 0.5) + (f % 2 ? (w + gap) / 2 : 0);
      for (x = inicio; x < 1600 + w; x += w + gap) {
        var cx = x + w / 2, dx = (cx - 800) / 800;
        var y = base - curva * dx * dx;
        var h = 900 - y + 40, rr = w * 0.22;
        // cabeça (cerca de metade das poltronas ocupada)
        if (r() < 0.55) {
          var hr = w * 0.19, hy = y - hr * 0.9 + (r() * 6 - 3), hx = cx + (r() * 10 - 5);
          s += '<ellipse cx="' + hx.toFixed(1) + '" cy="' + hy.toFixed(1) + '" rx="' + (hr * 0.92).toFixed(1) + '" ry="' + hr.toFixed(1) + '" fill="#060606"/>' +
            '<path d="M' + (hx - hr * 0.8).toFixed(1) + ' ' + (hy - hr * 0.45).toFixed(1) + ' A' + (hr * 0.92).toFixed(1) + ' ' + hr.toFixed(1) + ' 0 0 1 ' + (hx + hr * 0.8).toFixed(1) + ' ' + (hy - hr * 0.45).toFixed(1) + '" fill="none" class="luz-traco" stroke-width="' + (1 + f * 0.3).toFixed(1) + '" opacity="' + (0.5 - f * 0.05).toFixed(2) + '"/>';
        }
        s += '<path d="M' + x.toFixed(1) + ' ' + (y + rr).toFixed(1) + ' Q' + x.toFixed(1) + ' ' + y.toFixed(1) + ' ' + (x + rr).toFixed(1) + ' ' + y.toFixed(1) + ' L' + (x + w - rr).toFixed(1) + ' ' + y.toFixed(1) + ' Q' + (x + w).toFixed(1) + ' ' + y.toFixed(1) + ' ' + (x + w).toFixed(1) + ' ' + (y + rr).toFixed(1) + ' L' + (x + w).toFixed(1) + ' ' + (y + h).toFixed(1) + ' L' + x.toFixed(1) + ' ' + (y + h).toFixed(1) + ' Z" fill="url(#a-poltrona)"/>' +
          '<path d="M' + (x + rr * 0.6).toFixed(1) + ' ' + (y + 1).toFixed(1) + ' L' + (x + w - rr * 0.6).toFixed(1) + ' ' + (y + 1).toFixed(1) + '" class="luz-traco" stroke-width="' + (1.2 + f * 0.35).toFixed(1) + '" opacity="' + (0.42 - f * 0.05).toFixed(2) + '"/>';
      }
    }
    return s;
  }

  function svgTutoria() {
    var s = "";
    s += '<defs>' +
      '<linearGradient id="t-parede" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0b0b"/><stop offset=".6" stop-color="#151515"/><stop offset="1" stop-color="#0a0a0a"/></linearGradient>' +
      '<linearGradient id="t-mesa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1b1b"/><stop offset="1" stop-color="#080808"/></linearGradient>' +
      '<linearGradient id="t-lampada" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc79e" stop-opacity=".16"/><stop offset="1" stop-color="#ffc79e" stop-opacity="0"/></linearGradient><filter id="t-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="10"/></filter>' +
      '<linearGradient id="t-janela" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a2a2a"/><stop offset="1" stop-color="#111"/></linearGradient>' +
      '</defs>';
    s += '<rect width="1600" height="900" fill="url(#t-parede)"/>';
    // rodapé da parede
    s += '<rect x="0" y="600" width="1600" height="300" fill="#0c0c0c"/>';
    // estante
    s += '<rect x="70" y="150" width="270" height="430" fill="#0d0d0d" stroke="#1d1d1d" stroke-width="3"/>';
    var r = rnd(3), y, x;
    for (y = 150; y < 560; y += 105) {
      s += '<rect x="70" y="' + (y + 100) + '" width="270" height="5" fill="#1d1d1d"/>';
      for (x = 82; x < 320;) {
        var lw = 10 + Math.floor(r() * 14), lh = 58 + Math.floor(r() * 34);
        if (x + lw > 328) break;
        var cor = r() < 0.05 ? "#ff6b1a" : (r() < 0.5 ? "#1a1a1a" : "#222");
        s += '<rect x="' + x + '" y="' + (y + 100 - lh) + '" width="' + lw + '" height="' + lh + '" fill="' + cor + '" opacity="' + (cor === "#ff6b1a" ? 0.8 : 1) + '"/>';
        x += lw + 2 + (r() < 0.15 ? 18 : 0);
      }
    }
    // janela com persiana
    s += '<rect x="1270" y="140" width="260" height="380" fill="url(#t-janela)" stroke="#1d1d1d" stroke-width="4"/>';
    for (y = 150; y < 515; y += 13) s += '<rect x="1274" y="' + y + '" width="252" height="8" fill="#0e0e0e"/>';
    // TV
    s += '<rect x="500" y="130" width="600" height="355" rx="8" fill="#000" stroke="#232323" stroke-width="2"/>';
    s += '<rect x="470" y="535" width="660" height="22" rx="2" fill="#151515"/><rect x="470" y="557" width="660" height="40" fill="#0e0e0e"/>';
    // luminárias pendentes
    [560, 800, 1040].forEach(function (lx) {
      s += '<path d="M' + lx + ' 0 L' + lx + ' 60" stroke="#262626" stroke-width="2"/>' +
        '<path d="M' + (lx - 30) + ' 84 Q' + lx + ' 48 ' + (lx + 30) + ' 84 Z" fill="#1c1c1c"/>' +
        '<ellipse cx="' + lx + '" cy="86" rx="16" ry="3" fill="#ffd2ad" opacity=".9"/>' +
        '<path d="M' + (lx - 22) + ' 88 L' + (lx + 22) + ' 88 L' + (lx + 120) + ' 420 L' + (lx - 120) + ' 420 Z" fill="url(#t-lampada)" filter="url(#t-blur)"/>';
    });
    // mesa em perspectiva
    s += '<path d="M330 640 L1270 640 L1470 900 L130 900 Z" fill="url(#t-mesa)"/>';
    s += '<path d="M330 640 L1270 640" class="luz-traco" stroke-width="2" opacity=".5"/>';
    s += '<ellipse cx="800" cy="700" rx="380" ry="50" class="luz-preenche" opacity=".08"/>';
    // notebooks e objetos
    [[470, 700, 1], [800, 690, 1.05], [1130, 700, 1]].forEach(function (n) {
      var nx = n[0], ny = n[1], k = n[2];
      s += '<path d="M' + (nx - 70 * k) + ' ' + ny + ' L' + (nx + 70 * k) + ' ' + ny + ' L' + (nx + 64 * k) + ' ' + (ny - 92 * k) + ' L' + (nx - 64 * k) + ' ' + (ny - 92 * k) + ' Z" fill="#1a1a1a" stroke="#242424"/>' +
        '<circle cx="' + nx + '" cy="' + (ny - 48 * k) + '" r="5" fill="#ff6b1a" opacity=".85"/>' +
        '<path d="M' + (nx - 64 * k) + ' ' + (ny - 92 * k) + ' L' + (nx + 64 * k) + ' ' + (ny - 92 * k) + '" class="luz-traco" stroke-width="1.5" opacity=".6"/>';
    });
    s += '<rect x="610" y="670" width="70" height="18" rx="2" fill="#1e1e1e" transform="rotate(-6 645 679)"/>';
    s += '<path d="M958 668 L982 668 L979 700 L961 700 Z" fill="#202020"/><path d="M982 676 Q994 680 981 690" stroke="#202020" stroke-width="4" fill="none"/>';
    // alunos de costas
    [[400, 1.05], [800, 1.15], [1200, 1.05]].forEach(function (a) {
      var ax = a[0], k = a[1], hy = 740 - 20 * k;
      s += '<path d="M' + (ax - 150 * k) + ' 900 Q' + (ax - 150 * k) + ' ' + (hy + 70 * k) + ' ' + (ax - 50 * k) + ' ' + (hy + 58 * k) + ' L' + (ax + 50 * k) + ' ' + (hy + 58 * k) + ' Q' + (ax + 150 * k) + ' ' + (hy + 70 * k) + ' ' + (ax + 150 * k) + ' 900 Z" fill="#050505"/>' +
        '<ellipse cx="' + ax + '" cy="' + hy + '" rx="' + (52 * k) + '" ry="' + (60 * k) + '" fill="#060606"/>' +
        '<path d="M' + (ax - 44 * k) + ' ' + (hy - 30 * k) + ' A' + (52 * k) + ' ' + (60 * k) + ' 0 0 1 ' + (ax + 44 * k) + ' ' + (hy - 30 * k) + '" fill="none" class="luz-traco" stroke-width="2.5" opacity=".55"/>' +
        '<path d="M' + (ax - 140 * k) + ' ' + (hy + 90 * k) + ' Q' + (ax - 130 * k) + ' ' + (hy + 64 * k) + ' ' + (ax - 50 * k) + ' ' + (hy + 58 * k) + ' M' + (ax + 50 * k) + ' ' + (hy + 58 * k) + ' Q' + (ax + 130 * k) + ' ' + (hy + 64 * k) + ' ' + (ax + 140 * k) + ' ' + (hy + 90 * k) + '" fill="none" class="luz-traco" stroke-width="2" opacity=".35"/>';
    });
    return s;
  }

  var CENAS = {
    auditorio: {
      nome: "Auditório",
      tela: (CFG.auditorio && CFG.auditorio.tela) || { x: 25, y: 12.2222, w: 50, h: 50 },
      fundo: CFG.auditorio && CFG.auditorio.fundo,
      desenho: svgAuditorio,
      feixe: true
    },
    tutoria: {
      nome: "Sala de tutoria",
      tela: (CFG.tutoria && CFG.tutoria.tela) || { x: 32.5, y: 16.6667, w: 35, h: 35 },
      fundo: CFG.tutoria && CFG.tutoria.fundo,
      desenho: svgTutoria,
      feixe: false
    }
  };

  // ---------------- Transições ----------------
  var TRANS = ["foco", "persiana", "varredura", "mosaico"];
  var NOMES_T = { foco: "Foco", persiana: "Persiana", varredura: "Varredura de luz", mosaico: "Mosaico", fade: "Esmaecer" };

  function esperar(anims) {
    return Promise.all(anims.map(function (a) { return a.finished.catch(function () {}); }));
  }

  function transicao(tipo, tela, base, urlNova) {
    var camada = doc.createElement("div");
    camada.className = "cena-efeito";
    tela.appendChild(camada);
    var anims = [];
    var E = "cubic-bezier(.65,0,.35,1)";

    if (tipo === "foco") {
      var nova = doc.createElement("img");
      nova.src = urlNova; nova.alt = "";
      camada.appendChild(nova);
      anims.push(base.animate([{ filter: "blur(0) brightness(1)", transform: "scale(1)" }, { filter: "blur(16px) brightness(1.7)", transform: "scale(1.04)" }], { duration: 700, easing: "ease-in", fill: "forwards" }));
      anims.push(nova.animate([{ opacity: 0, filter: "blur(18px) brightness(1.8)", transform: "scale(1.05)" }, { opacity: 1, filter: "blur(10px) brightness(1.4)", transform: "scale(1.03)", offset: 0.45 }, { opacity: 1, filter: "blur(0) brightness(1)", transform: "scale(1)" }], { duration: 1500, easing: E, fill: "forwards" }));
    } else if (tipo === "persiana") {
      var n = 12;
      camada.style.perspective = "900px";
      for (var i = 0; i < n; i++) {
        var t = doc.createElement("div");
        t.className = "cena-tira";
        t.style.left = (i * 100 / n) + "%";
        t.style.width = (100 / n + 0.2) + "%";
        t.style.backgroundImage = "url(" + urlNova + ")";
        t.style.backgroundSize = (n * 100) + "% 100%";
        t.style.backgroundPosition = (i / (n - 1) * 100) + "% 0";
        camada.appendChild(t);
        anims.push(t.animate([{ transform: "rotateY(-90deg)", filter: "brightness(2)" }, { transform: "rotateY(0)", filter: "brightness(1)" }], { duration: 650, delay: i * 55, easing: E, fill: "both" }));
      }
    } else if (tipo === "varredura") {
      var v = doc.createElement("div");
      v.className = "cena-cheia";
      v.style.backgroundImage = "url(" + urlNova + ")";
      var linha = doc.createElement("i");
      linha.className = "cena-linha";
      camada.appendChild(v); camada.appendChild(linha);
      anims.push(v.animate([{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], { duration: 1300, easing: E, fill: "forwards" }));
      anims.push(linha.animate([{ left: "0%", opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.9 }, { left: "100%", opacity: 0 }], { duration: 1300, easing: E, fill: "forwards" }));
    } else if (tipo === "mosaico") {
      var cols = 10, rows = 6;
      camada.style.display = "grid";
      camada.style.gridTemplateColumns = "repeat(" + cols + ",1fr)";
      camada.style.gridTemplateRows = "repeat(" + rows + ",1fr)";
      for (var yy = 0; yy < rows; yy++) for (var xx = 0; xx < cols; xx++) {
        var q = doc.createElement("div");
        q.style.backgroundImage = "url(" + urlNova + ")";
        q.style.backgroundSize = (cols * 100) + "% " + (rows * 100) + "%";
        q.style.backgroundPosition = (xx / (cols - 1) * 100) + "% " + (yy / (rows - 1) * 100) + "%";
        q.style.margin = "-.5px";
        camada.appendChild(q);
        anims.push(q.animate([{ opacity: 0, transform: "scale(.2)" }, { opacity: 1, transform: "scale(1)" }], { duration: 520, delay: (xx + yy) * 55, easing: "cubic-bezier(.2,.8,.2,1)", fill: "both" }));
      }
    } else {
      var f = doc.createElement("img");
      f.src = urlNova; f.alt = "";
      camada.appendChild(f);
      anims.push(f.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, fill: "forwards" }));
    }

    return esperar(anims).then(function () {
      base.src = urlNova;
      return (base.decode ? base.decode() : Promise.resolve()).catch(function () {});
    }).then(function () {
      base.getAnimations && base.getAnimations().forEach(function (a) { a.cancel(); });
      camada.remove();
    });
  }

  // Cor média do slide, levemente saturada, para iluminar a sala
  var canvas = doc.createElement("canvas"), ctx = canvas.getContext("2d", { willReadFrequently: true });
  canvas.width = 24; canvas.height = 14;
  function corDe(imagem) {
    try {
      ctx.drawImage(imagem, 0, 0, 24, 14);
      var d = ctx.getImageData(0, 0, 24, 14).data, r = 0, g = 0, b = 0, peso = 0;
      for (var i = 0; i < d.length; i += 4) {
        var mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
        var w = 0.25 + (mx - mn) / 255 * 2 + mx / 255 * 0.5;
        r += d[i] * w; g += d[i + 1] * w; b += d[i + 2] * w; peso += w;
      }
      r /= peso; g /= peso; b /= peso;
      var m = (r + g + b) / 3, k = 1.35;
      r = m + (r - m) * k; g = m + (g - m) * k; b = m + (b - m) * k;
      var ajuste = 200 / Math.max(r, g, b, 1);
      if (ajuste > 1) { r *= ajuste; g *= ajuste; b *= ajuste; }
      var c = function (v) { return Math.max(0, Math.min(255, Math.round(v))); };
      return "rgb(" + c(r) + "," + c(g) + "," + c(b) + ")";
    } catch (e) { return "#ff8a4c"; }
  }
  var cache = {};
  function prepararCor(p) {
    if (cache[p.img]) return Promise.resolve(cache[p.img]);
    return new Promise(function (ok) {
      var im = new Image();
      im.onload = function () { cache[p.img] = corDe(im); ok(cache[p.img]); };
      im.onerror = function () { ok("#ff8a4c"); };
      im.src = img(p.img, true);
    });
  }
  function precarregar(url) {
    return new Promise(function (ok) {
      var im = new Image();
      im.onload = im.onerror = function () { ok(); };
      im.src = url;
    });
  }

  // ---------------- Montagem ----------------
  function montar(el) {
    if (!PORT.length) return;
    var cenaAtual = CFG.inicial === "tutoria" ? "tutoria" : "auditorio";
    var i = 0, tocando = !semMovimento, ocupado = false, timer = null, visivel = true, ti = 0;
    var DUR = 5600;

    var desenhos = Object.keys(CENAS).map(function (k) {
      var c = CENAS[k];
      var conteudo = c.fundo
        ? '<img class="cena-foto" src="' + esc(raiz + c.fundo) + '" alt="">'
        : '<svg viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true">' + c.desenho() + "</svg>";
      return '<div class="cena-fundo" data-cena="' + k + '"' + (k === cenaAtual ? " data-ativa" : "") + ">" + conteudo + "</div>";
    }).join("");

    el.innerHTML =
      '<div class="cena-topo">' +
      '<div class="cena-troca" role="group" aria-label="Ambiente">' +
      Object.keys(CENAS).map(function (k) { return '<button type="button" data-cena="' + k + '" aria-pressed="' + (k === cenaAtual) + '">' + CENAS[k].nome + "</button>"; }).join("") +
      "</div></div>" +
      '<div class="cena-quadro"><div class="cena-palco">' +
      desenhos +
      '<div class="cena-ambiente"></div>' +
      '<div class="cena-tela"><img class="cena-base" alt=""><span class="cena-brilho"></span></div>' +
      '<svg class="cena-feixe" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="feixe-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".45" stop-color="#fff" stop-opacity=".05"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>' +
      '<filter id="feixe-b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>' +
      '<path d="M786 -60 L814 -60 L1190 118 L1190 552 L410 552 L410 118 Z" fill="url(#feixe-g)" filter="url(#feixe-b)"/>' +
      '<path d="M798 -60 L802 -60 L1000 300 L960 300 Z M796 -60 L800 -60 L640 330 L610 330 Z" fill="#fff" opacity=".035" filter="url(#feixe-b)"/></svg>' +
      '<canvas class="cena-poeira" aria-hidden="true"></canvas>' +
      "</div></div>" +
      '<div class="cena-legenda">' +
      '<div class="tela-num" aria-hidden="true"></div>' +
      '<div class="tela-info" aria-live="polite"></div>' +
      '<div class="tela-ctrl"><button type="button" data-a="ant" aria-label="Apresentação anterior">' + UJ.ico("voltar") + '</button>' +
      '<button type="button" data-a="pausa" aria-label="Pausar">' + UJ.ico("pausa") + '</button>' +
      '<button type="button" data-a="prox" aria-label="Próxima apresentação">' + UJ.ico("seta") + "</button></div>" +
      '<div class="tela-barra"><i></i></div></div>';

    var palco = el.querySelector(".cena-palco"), tela = el.querySelector(".cena-tela"), base = el.querySelector(".cena-base");
    var num = el.querySelector(".tela-num"), info = el.querySelector(".tela-info"), barra = el.querySelector(".tela-barra i"), bp = el.querySelector('[data-a="pausa"]');
    var feixe = el.querySelector(".cena-feixe"), poeira = el.querySelector(".cena-poeira");

    function posicionarTela(k) {
      var t = CENAS[k].tela;
      tela.style.left = t.x + "%"; tela.style.top = t.y + "%"; tela.style.width = t.w + "%"; tela.style.height = t.h + "%";
      palco.setAttribute("data-cena", k);
      feixe.style.opacity = CENAS[k].feixe ? "" : "0";
      poeira.style.opacity = CENAS[k].feixe ? "" : "0";
    }

    function legenda(t) {
      var p = PORT[i];
      num.innerHTML = pad(i + 1) + " <span>/ " + pad(PORT.length) + "</span>";
      info.innerHTML = "<strong>" + esc(p.titulo) + "</strong><span>" + esc(p.tipo) + ", " + esc(p.contexto) + (t ? '<em>Transição: ' + NOMES_T[t] + "</em>" : "") + "</span>";
    }

    function barraReset() {
      barra.style.transition = "none"; barra.style.width = "0";
      if (!tocando) return;
      void barra.offsetWidth;
      barra.style.transition = "width " + DUR + "ms linear"; barra.style.width = "100%";
    }

    function irPara(k, tipo) {
      if (ocupado) return;
      ocupado = true;
      i = (k + PORT.length) % PORT.length;
      var p = PORT[i], url = img(p.img, false);
      if (!tipo) { tipo = semMovimento ? "fade" : TRANS[ti % TRANS.length]; ti++; }
      Promise.all([precarregar(url), prepararCor(p)]).then(function (r) {
        el.style.setProperty("--luz", r[1]);
        legenda(tipo);
        palco.classList.add("trocando");
        return transicao(tipo, tela, base, url);
      }).then(function () {
        palco.classList.remove("trocando");
        ocupado = false;
        agendar();
      });
      barraReset();
    }

    function agendar() {
      clearTimeout(timer);
      if (tocando && visivel) timer = setTimeout(function () { irPara(i + 1); }, DUR);
    }
    function setTocando(v) {
      tocando = v;
      bp.innerHTML = UJ.ico(v ? "pausa" : "tocar");
      bp.setAttribute("aria-label", v ? "Pausar" : "Reproduzir");
      barraReset(); agendar();
    }

    el.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      var a = b.getAttribute("data-a"), c = b.getAttribute("data-cena");
      if (a === "prox") irPara(i + 1);
      if (a === "ant") irPara(i - 1);
      if (a === "pausa") setTocando(!tocando);
      if (c && c !== cenaAtual) {
        cenaAtual = c;
        el.querySelectorAll(".cena-troca button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        el.querySelectorAll(".cena-fundo").forEach(function (f) { if (f.getAttribute("data-cena") === c) f.setAttribute("data-ativa", ""); else f.removeAttribute("data-ativa"); });
        posicionarTela(c);
      }
    });

    // Início: primeiro slide sem transição
    posicionarTela(cenaAtual);
    base.src = img(PORT[0].img, false);
    base.alt = "";
    tela.setAttribute("role", "img");
    tela.setAttribute("aria-label", "Capas de apresentações do portfólio projetadas na tela");
    prepararCor(PORT[0]).then(function (c) { el.style.setProperty("--luz", c); });
    legenda(null);
    setTocando(tocando);

    // Pausa fora da tela ou com a aba oculta
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (ents) { visivel = ents[0].isIntersecting; if (visivel) { agendar(); poeiraLoop(); } else clearTimeout(timer); }, { threshold: 0.2 }).observe(el);
    }
    doc.addEventListener("visibilitychange", function () { visivel = !doc.hidden; if (visivel) agendar(); else clearTimeout(timer); });

    // ---------- Poeira no feixe do projetor ----------
    var pc = poeira.getContext("2d"), parts = [], rodando = false;
    function dimensionar() {
      var r = palco.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      poeira.width = Math.round(r.width * dpr); poeira.height = Math.round(r.height * dpr);
    }
    function novaParticula() {
      return { x: 0.3 + Math.random() * 0.4, y: Math.random() * 0.62, v: (Math.random() - 0.5) * 0.00025, u: -0.00008 - Math.random() * 0.00018, r: 0.4 + Math.random() * 1.3, a: 0.15 + Math.random() * 0.5 };
    }
    for (var k = 0; k < 70; k++) parts.push(novaParticula());
    function dentroDoFeixe(x, y) {
      // feixe: ápice (0.5, 0) até a tela (0.25..0.75, 0.122..0.622)
      var t = Math.min(1, y / 0.122), meia = 0.0125 + (0.25 - 0.0125) * t;
      return y < 0.622 && Math.abs(x - 0.5) < meia;
    }
    function poeiraLoop() {
      if (rodando || semMovimento) return;
      rodando = true;
      (function quadro() {
        if (!visivel || doc.hidden || cenaAtual !== "auditorio") { rodando = false; pc.clearRect(0, 0, poeira.width, poeira.height); return; }
        var W = poeira.width, H = poeira.height;
        pc.clearRect(0, 0, W, H);
        parts.forEach(function (p, n) {
          p.x += p.v; p.y += p.u;
          if (p.y < 0 || p.x < 0.2 || p.x > 0.8) parts[n] = p = novaParticula(), p.y = 0.62;
          if (!dentroDoFeixe(p.x, p.y)) return;
          pc.globalAlpha = p.a * (0.4 + p.y);
          pc.fillStyle = "#fff";
          pc.beginPath(); pc.arc(p.x * W, p.y * H, p.r * (W / 900), 0, 6.283); pc.fill();
        });
        requestAnimationFrame(quadro);
      })();
    }
    dimensionar();
    window.addEventListener("resize", dimensionar);
    poeiraLoop();
    el.addEventListener("click", function () { setTimeout(poeiraLoop, 50); });
  }

  var alvo = doc.querySelector("[data-render='cena']");
  if (alvo && UJ.ico) montar(alvo);
})();
