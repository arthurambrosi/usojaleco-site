# Uso Jaleco

Site de slides médicos, apresentações sob medida, currículo, sites e identidade visual, com ferramentas de estudo e prática.

- **Site principal:** https://www.usojaleco.com.br
- **Slides:** `/slides/` · **Loja nova:** `/loja/` · **Serviços:** `/servicos/` · **Menu para a bio:** `/menu/`
- **Contatos:** usojaleco@gmail.com · WhatsApp 5571981577908

Para testar, rode `python -m http.server 8000 --bind 127.0.0.1` nesta pasta e abra http://127.0.0.1:8000. Confira links com `python scripts/verificar_links.py`.

Os dados mais usados ficam em `assets/data/`. A loja lê a planilha publicada indicada em `assets/data/loja.js`, com vitrines Medicina e Escola separadas pela coluna `area`.

Alterações são feitas em uma branch e revisadas por Pull Request. A `main` publica automaticamente no GitHub Pages. **Nunca remover um endereço antigo sem manter compatibilidade.**

A versão anterior está na tag `antes-da-limpeza`. Consulte [CLAUDE.md](CLAUDE.md) para a estrutura, identidade visual, segurança e publicação.

Para cadastrar slides, preços, capas e vídeos pela planilha, consulte [GUIA-DA-LOJA.md](GUIA-DA-LOJA.md).
