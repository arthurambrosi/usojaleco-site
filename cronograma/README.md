# Cronograma Premium de Estudos

Site pessoal de acompanhamento de estudos com base no arquivo Excel de cronograma.

## Estrutura

- `index.html`: aplicação principal (SPA).
- `styles.css`: tema premium e responsivo.
- `app.js`: lógica de calendário, lista, revisões, pendências, estatísticas, metas, histórico, backup e sync.
- `schedule_parser.py`: converte o Excel para `data/schedule.json`.
- `data/schedule.json`: base estruturada (gerada a partir da planilha).
- `supabase.sql`: estrutura sugerida para sincronização online.

## Fonte principal (planilha)

Arquivo usado: `C:\Users\Arthur\Desktop\s\Cronograma - Residência.xlsx` (aba `Arthur`).

A prioridade por cor foi mapeada para ordenação global:

1. Azul (`FFEBFBFF`) = prioridade 1
2. Verde (`FFE0F6D9`) = prioridade 2
3. Amarelo (`FFFFF5D9`) = prioridade 3
4. Vermelho (`FFF9CAD0`) = prioridade 4

Itens sem cor mapeada ficam com prioridade residual.

## Rodar localmente

1. Entre na pasta `cronograma`.
2. Execute um servidor local simples:

```powershell
python -m http.server 5500
```

3. Abra `http://localhost:5500`.

## Regerar JSON a partir do Excel

```powershell
python schedule_parser.py --sheet Arthur
```

Você também pode informar caminho customizado:

```powershell
python schedule_parser.py --xlsx "C:\caminho\Cronograma.xlsx" --sheet Arthur --out "data\schedule.json"
```

## Publicar no GitHub Pages

1. Suba todos os arquivos da pasta `cronograma` no repositório.
2. Ative GitHub Pages para branch/pasta publicada.
3. Acesse a URL publicada.

## Persistência e sincronização

### Sem backend

- O site salva automaticamente no `localStorage` (persistente no mesmo dispositivo).

### Com sincronização entre celular e computador

- Configure Supabase na seção **Configurações**.
- Preencha: `URL`, `Anon Key`, `Tabela`, `Profile ID`.
- Use `Enviar` para subir e `Baixar` para restaurar.

## Backup

- Exportar JSON: gera backup completo do estado.
- Importar JSON: restaura o estado salvo.

## Funcionalidades implementadas

- calendário mensal com destaque do dia atual;
- cards de estudo e revisões no calendário;
- lista semanal completa, expandida, com:
  - estudo inicial;
  - revisão 1 semana;
  - revisão 1 mês;
  - revisão 3 meses;
  - revisão 6 meses;
  - questões/acertos por etapa;
  - observações por assunto;
- modo Hoje (novos, revisões, pendências antigas);
- painel de revisões;
- pendências com inconsistências e atraso;
- reagendamento inteligente;
- estatísticas com gráficos e rankings;
- score de domínio por assunto;
- painel de pontos críticos;
- linha do tempo + mapa de calor + histórico;
- metas semanais;
- backup/importação JSON;
- sincronização opcional com Supabase.

## Observação importante de arquitetura

GitHub Pages puro não oferece banco nativo para sincronização entre dispositivos.
Por isso, a arquitetura recomendada é:

- **Frontend estático no GitHub Pages**;
- **Estado local no navegador**;
- **Sincronização opcional via Supabase REST**.
