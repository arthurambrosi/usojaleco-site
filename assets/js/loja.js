/*
 * Uso Jaleco — vitrine de slides (lista, destaque da home e página de produto).
 */
(function () {
  "use strict";

  var UJ = window.UJ || {};
  var L = UJ.loja || {};
  var C = UJ.config || {};
  var doc = document;
  var raiz = doc.documentElement.getAttribute("data-raiz") || "";
  var oficial = true; // Never present demonstration products as real stock.
  var explicito = location.protocol === "file:" || !/(usojaleco\.com\.br|github\.io|localhost|127\.0\.0\.1)$/.test(location.hostname);

  function u(c) {
    var p = raiz + c;
    if (explicito) p = p.replace(/\/(\?|#|$)/, "/index.html$1");
    return p;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function chave(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); }
  function slug(s) { return chave(s).replace(/_/g, "-"); }
  function ico(n) { return UJ.ico ? UJ.ico(n) : ""; }

  // ---------- Leitura da planilha ----------
  function csv(texto) {
    var linhas = [], linha = [], campo = "", aspas = false;
    var sep = (texto.split("\n")[0].match(/;/g) || []).length > (texto.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
    for (var i = 0; i < texto.length; i++) {
      var c = texto[i];
      if (aspas) {
        if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
        else if (c === '"') aspas = false;
        else campo += c;
      } else if (c === '"') aspas = true;
      else if (c === sep) { linha.push(campo); campo = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && texto[i + 1] === "\n") i++;
        linha.push(campo); linhas.push(linha); linha = []; campo = "";
      } else campo += c;
    }
    if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
    return linhas.filter(function (l) { return l.some(function (x) { return x.trim(); }); });
  }
  function pegar(obj, nomes) {
    for (var i = 0; i < nomes.length; i++) if (obj[nomes[i]]) return obj[nomes[i]].trim();
    return "";
  }
  function urlImagem(v) {
    v = String(v || "").trim();
    if (!v) return "";
    if (/\.pdf(?:[?#]|$)/i.test(v)) return "";
    if (/^(?:javascript|data|vbscript):/i.test(v)) return "";
    var m = v.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)/);
    if (m) return "https://drive.google.com/thumbnail?id=" + m[1] + "&sz=w1600";
    if (/^https?:/.test(v)) return v;
    return raiz + v;
  }
  function urlSegura(v) { v = String(v || "").trim(); return /^https:\/\//i.test(v) ? v : ""; }
  function preco(v) {
    v = String(v || "").trim();
    if (!v) return "";
    return /R\$/.test(v) ? v : "R$ " + v;
  }
  function normalizar(o) {
    return {
      id: slug(o.id || o.titulo),
      titulo: o.titulo,
      area: o.area || "Outros temas",
      preco: preco(o.preco),
      descricao: o.descricao || "",
      imagem: urlImagem(o.imagem),
      previa: urlSegura(o.previa),
      compra: urlSegura(o.compra)
    };
  }
  function daPlanilha(texto) {
    var l = csv(texto);
    if (l.length < 2) return [];
    var cab = l[0].map(chave);
    return l.slice(1).map(function (cols) {
      var o = {}; cab.forEach(function (k, i) { o[k] = cols[i] || ""; });
      var ativo = chave(pegar(o, ["ativo", "active", "publicar", "status"]));
      if (/^(nao|false|0|inativo|n)$/.test(ativo)) return null;
      var t = pegar(o, ["titulo", "slide", "nome", "tema", "titulo_do_slide", "assunto"]);
      if (!t) return null;
      return normalizar({
        id: pegar(o, ["id", "slug"]),
        titulo: t,
        preco: pegar(o, ["preco", "valor", "preco_r", "preco_em_reais"]),
        descricao: pegar(o, ["descricao", "descricao_do_slide", "resumo", "subtitulo"]),
        imagem: pegar(o, ["imagem", "thumb", "thumbnail", "capa", "foto"]),
        previa: pegar(o, ["pdf", "link_pdf", "preview_pdf", "previa", "video", "link_video"]),
        compra: pegar(o, ["link_compra", "link_de_compra", "link_de_pagamento", "link", "url"]),
        area: pegar(o, ["area_do_tema", "area_tema", "area", "especialidade", "categoria"])
      });
    }).filter(Boolean);
  }

  var promessa = null;
  function carregar() {
    if (promessa) return promessa;
    var exemplos = function () { return (L.exemplos || []).map(normalizar); };
    promessa = (L.planilhaCSV && window.fetch
      ? fetch(L.planilhaCSV, { cache: "no-store", signal: AbortSignal.timeout(12000) }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(daPlanilha)
      : Promise.reject(new Error("sem planilha"))
    ).then(function (lista) {
      if (lista.length) return { lista: lista, exemplo: false };
      throw new Error("vazia");
    }).catch(function () {
      if (oficial) return { lista: [], exemplo: false, erro: true };
      return { lista: exemplos(), exemplo: true };
    });
    return promessa;
  }

  // ---------- Peças visuais ----------
  function capa(p, grande) {
    if (p.imagem) return '<img src="' + esc(p.imagem) + '" alt="Capa do slide ' + esc(p.titulo) + '" loading="' + (grande ? "eager" : "lazy") + '" width="1600" height="900" onerror="this.parentNode.classList.add(\'sem-capa\');this.parentNode.querySelector(\'.capa-texto\').hidden=false;this.remove()">' + capaTexto(p);
    return capaTexto(p, true);
  }
  function capaTexto(p, ativa) {
    return '<span class="capa-texto"' + (ativa ? "" : " hidden") + '><small>' + esc(p.area) + "</small><b>" + esc(p.titulo) + "</b></span>";
  }
  function linkProduto(p) { return u("loja/slide/?id=" + encodeURIComponent(p.id)); }
  function zap(t) { return "https://wa.me/" + C.whatsapp + "?text=" + encodeURIComponent(t); }

  function cartao(p) {
    return '<li class="produto"><a href="' + linkProduto(p) + '">' +
      '<span class="produto-capa' + (p.imagem ? "" : " sem-capa") + '">' + capa(p) + "</span>" +
      '<span class="produto-info"><span class="produto-area">' + esc(p.area) + "</span>" +
      "<strong>" + esc(p.titulo) + "</strong>" +
      '<span class="produto-rodape"><span class="produto-preco">' + (p.preco ? esc(p.preco) : "Consultar valor") + '</span><span class="produto-ver">Ver detalhes ' + ico("seta") + "</span></span></span></a></li>";
  }
  function avisoExemplo(r) {
    return r.exemplo ? '<p class="aviso-exemplo">Prévia com itens de exemplo. No site oficial, a vitrine carrega os slides da sua planilha de vendas.</p>' : "";
  }
  function erro() {
    return '<div class="vazio"><strong>A vitrine não carregou agora.</strong><p>Tente atualizar a página em alguns instantes ou peça a lista de slides pelo WhatsApp.</p><a class="btn btn-tinta" href="' + zap("Olá! Quero ver os slides prontos do Uso Jaleco.") + '" target="_blank" rel="noopener">Pedir lista pelo WhatsApp</a></div>';
  }

  // ---------- Destaque na home ----------
  function destaque(el) {
    el.innerHTML = '<p class="carregando">Carregando slides…</p>';
    carregar().then(function (r) {
      if (r.erro || !r.lista.length) { el.innerHTML = erro(); return; }
      el.innerHTML = avisoExemplo(r) + '<ul class="vitrine">' + r.lista.slice(0, 4).map(cartao).join("") + "</ul>";
    });
  }

  // ---------- Vitrine completa ----------
  function vitrine(el) {
    el.innerHTML = '<p class="carregando">Carregando slides…</p>';
    carregar().then(function (r) {
      if (r.erro || !r.lista.length) { el.innerHTML = erro(); return; }
      var areas = [];
      r.lista.forEach(function (p) { if (areas.indexOf(p.area) < 0) areas.push(p.area); });
      areas.sort(function (a, b) { return a.localeCompare(b, "pt-BR"); });
      var area = "Todas", termo = "";
      el.innerHTML = avisoExemplo(r) +
        '<div class="vitrine-barra"><div class="filtros" role="group" aria-label="Filtrar por área">' +
        ["Todas"].concat(areas).map(function (a) { return '<button type="button" data-a="' + esc(a) + '" aria-pressed="' + (a === area) + '">' + esc(a) + "</button>"; }).join("") +
        '</div><label class="busca"><span class="sr">Buscar slide</span><input id="busca-slide" type="search" placeholder="Buscar por tema"></label></div>' +
        '<ul class="vitrine" aria-live="polite"></ul>';
      var ul = el.querySelector(".vitrine");
      function desenhar() {
        var t = chave(termo);
        var lista = r.lista.filter(function (p) {
          return (area === "Todas" || p.area === area) && (!t || chave(p.titulo + " " + p.area + " " + p.descricao).indexOf(t) >= 0);
        });
        ul.innerHTML = lista.length ? lista.map(cartao).join("") :
          '<li class="vazio"><strong>Nenhum slide encontrado.</strong><p>Tente outro termo ou peça um slide sob medida.</p><a class="btn btn-tinta" href="' + u("orcamento/?s=apresentacoes") + '">Pedir slide sob medida</a></li>';
      }
      el.querySelector(".filtros").addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) return;
        area = b.getAttribute("data-a");
        el.querySelectorAll(".filtros button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        desenhar();
      });
      el.querySelector("input").addEventListener("input", function (e) { termo = e.target.value; desenhar(); });
      desenhar();
    });
  }

  // ---------- Página do produto ----------
  function produto(el) {
    var id = new URLSearchParams(location.search).get("id") || "";
    el.innerHTML = '<div class="cont"><p class="carregando">Carregando slide…</p></div>';
    carregar().then(function (r) {
      if (r.erro) { el.innerHTML = '<section class="sec"><div class="cont">' + erro() + '</div></section>'; return; }
      var p = r.lista.filter(function (x) { return x.id === id; })[0];
      if (!p) {
        el.innerHTML = '<section class="cab-pag escuro palco"><div class="cont"><h1 class="titulo-palco">Slide não encontrado</h1><p class="lead">Ele pode ter saído da vitrine. Veja os slides disponíveis.</p><div class="acoes"><a class="btn btn-laranja" href="' + u("loja/") + '">Ir para a vitrine</a></div></div></section>';
        return;
      }
      doc.title = p.titulo + " | Vitrine Uso Jaleco";
      var comprar = p.compra
        ? '<a class="btn btn-laranja btn-grande" href="' + esc(p.compra) + '" target="_blank" rel="noopener">Comprar agora</a>'
        : '<a class="btn btn-laranja btn-grande" href="' + zap("Olá! Quero comprar o slide \"" + p.titulo + "\" da vitrine do Uso Jaleco.") + '" target="_blank" rel="noopener">Comprar pelo WhatsApp</a>';
      var relacionados = r.lista.filter(function (x) { return x.area === p.area && x.id !== p.id; }).concat(r.lista.filter(function (x) { return x.area !== p.area && x.id !== p.id; })).slice(0, 3);
      el.innerHTML = avisoExemplo(r).replace('class="aviso-exemplo"', 'class="aviso-exemplo aviso-topo"') +
        '<section class="produto-pag escuro"><div class="cont">' +
        '<p class="trilha"><a href="' + u("loja/") + '">Vitrine</a> / ' + esc(p.area) + "</p>" +
        '<div class="produto-grid">' +
        '<div class="produto-vitrine"><div class="monitor"><div class="monitor-tela' + (p.imagem ? "" : " sem-capa") + '">' + capa(p, true) + '</div></div><div class="monitor-pe"></div><div class="monitor-base"></div></div>' +
        '<div class="produto-dados">' +
        '<span class="produto-area">' + esc(p.area) + "</span>" +
        '<h1 class="titulo-palco">' + esc(p.titulo) + "</h1>" +
        (p.descricao ? '<p class="lead">' + esc(p.descricao) + "</p>" : "") +
        '<p class="produto-valor">' + (p.preco ? esc(p.preco) : "Valor sob consulta") + "</p>" +
        '<div class="acoes">' + comprar +
        (p.previa ? '<a class="btn btn-linha btn-grande" href="' + esc(p.previa) + '" target="_blank" rel="noopener">Ver prévia</a>' : "") +
        "</div>" +
        '<p class="nota">A compra é concluída no provedor de pagamento. Confira o valor, os arquivos incluídos e as condições de entrega antes de pagar.</p>' +
        '<ul class="lista-check escura">' + (L.inclui || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" +
        '<p class="nota">Dúvidas antes de comprar? <a class="link-seta" href="' + zap("Olá! Tenho uma dúvida sobre o slide \"" + p.titulo + "\".") + '" target="_blank" rel="noopener">Falar no WhatsApp</a></p>' +
        "</div></div></div></section>" +
        (relacionados.length ? '<section class="sec"><div class="cont"><div class="cab-sec"><h2 class="titulo-sec">Você também pode gostar</h2><a class="link-seta" href="' + u("loja/") + '">Ver a vitrine completa ' + ico("seta") + '</a></div><ul class="vitrine vitrine-3">' + relacionados.map(cartao).join("") + "</ul></div></section>" : "") +
        '<section class="sec branco"><div class="cont colunas"><div><h2 class="titulo-sec">Precisa de um tema que não está aqui?</h2></div><div><p class="lead" style="margin-bottom:24px">Criamos a apresentação do zero, com o seu conteúdo e o padrão visual Uso Jaleco.</p><a class="btn btn-tinta" href="' + u("orcamento/?s=apresentacoes") + '">Pedir slide sob medida</a></div></div></section>';
    });
  }

  var mapa = { "vitrine-destaque": destaque, vitrine: vitrine, produto: produto };
  Array.prototype.forEach.call(doc.querySelectorAll("[data-render]"), function (el) {
    var f = mapa[el.getAttribute("data-render")];
    if (f) f(el);
  });
})();
