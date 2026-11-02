(function () {
  'use strict';
  document.querySelectorAll('[data-copy-field]').forEach(function (button) {
    button.addEventListener('click', async function () {
      var field = document.getElementById(button.getAttribute('data-copy-field'));
      var status = button.closest('.bio-copy-panel').querySelector('.bio-copy-status');
      var value = button.getAttribute('data-copy-value') || field.value;
      try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('indisponivel');
        await navigator.clipboard.writeText(value);
        status.textContent = 'Copiado! Cole no aplicativo ou no navegador.';
      } catch (_) {
        field.focus(); field.select(); field.setSelectionRange(0, field.value.length);
        status.textContent = 'Toque e segure o texto selecionado para copiar pelo celular.';
      }
    });
  });
})();
