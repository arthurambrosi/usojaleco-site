const fs = require("fs");
const path = require("path");
const assert = require("assert");

const htmlPath = path.join(__dirname, "..", "index.html");
const html = fs.readFileSync(htmlPath, "utf8");

function mustMatch(regex, msg) {
  assert(regex.test(html), msg);
}

function run() {
  mustMatch(/LATTES:\s*\{\s*label:\s*"Lattes",\s*price:\s*159\b/, "Preco do Lattes deve ser 159");
  mustMatch(/VITAE_COMPLETO:\s*\{\s*label:\s*"Vitae \(Completo\)",\s*price:\s*149\b/, "Preco do Vitae Completo deve ser 149");
  mustMatch(/VITAE_SINT:\s*\{\s*label:\s*"Vitae \(Sintetizado\)",\s*price:\s*109\b/, "Preco do Vitae Sintetizado deve ser 109");

  mustMatch(/GROUP_DISCOUNT\s*=\s*\{[\s\S]*minPeople:\s*2[\s\S]*stepPercent:\s*5[\s\S]*maxPercent:\s*50[\s\S]*\}/, "Regra de grupo deve ser min 2, passo 5, max 50");
  mustMatch(/if\s*\(n\s*<\s*GROUP_DISCOUNT\.minPeople\)\s*return\s*0/, "Grupo com menos de 2 pessoas deve ter 0%");
  mustMatch(/Math\.min\(pct,\s*GROUP_DISCOUNT\.maxPercent\)/, "Desconto de grupo deve respeitar teto de 50%");
  mustMatch(/\{\s*v:"GRUPO",\s*t:"Grupo"/, "Tela deve conter opcao de atendimento em grupo");
}

run();
console.log("OK: regras de precos e descontos do curriculo conferidas.");
