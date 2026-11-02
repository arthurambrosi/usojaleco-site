(function () {
  'use strict';
  var mensagens = {
    apresentacoes: 'Olá! Vim pelo menu do Uso Jaleco e gostaria de um orçamento para uma apresentação sob medida.',
    curriculo: 'Olá! Vim pelo menu do Uso Jaleco e gostaria de saber mais sobre o serviço de currículo.',
    projeto: 'Olá! Vim pelo menu do Uso Jaleco e quero conversar sobre um projeto.',
    geral: 'Olá! Vim pelo menu do Uso Jaleco e gostaria de mais informações.'
  };
  var assunto = new URLSearchParams(location.search).get('assunto');
  if (!Object.prototype.hasOwnProperty.call(mensagens, assunto)) assunto = 'geral';
  var mensagem = document.getElementById('mensagem-contato');
  mensagem.value = mensagens[assunto];
  document.getElementById('abrir-whatsapp').href = 'https://wa.me/5571981577908?text=' + encodeURIComponent(mensagem.value);
  document.getElementById('link-contato').value = 'https://www.usojaleco.com.br/contato/?assunto=' + assunto;
  document.querySelectorAll('[data-copiar]').forEach(function (botao) {
    botao.addEventListener('click', async function () {
      var campo = document.getElementById(botao.getAttribute('data-copiar'));
      var status = document.getElementById('contato-status');
      try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('indisponivel');
        await navigator.clipboard.writeText(campo.value);
        status.textContent = 'Copiado! Agora você pode colar no navegador ou no WhatsApp.';
      } catch (_) {
        campo.classList.remove('sr');
        campo.focus(); campo.select(); campo.setSelectionRange(0, campo.value.length);
        status.textContent = 'Selecione e segure o texto destacado para copiar pelo menu do celular.';
      }
    });
  });
})();
