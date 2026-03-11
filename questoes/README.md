# Banco de Questoes

Sistema local para treino de questoes com leitura automatica por prova.

## Como executar

Nao existe backend obrigatorio.

O site le automaticamente a pasta `data` no mesmo local do `index.html` (com suporte a `data` ou `Data`).

Se abrir direto por `index.html` e aparecer `Erro ao carregar provas`, rode um servidor local:

```bash
python -m http.server 5500 --bind 127.0.0.1
```

Depois abra `http://127.0.0.1:5500`.

Opcao 1 clique no Windows:

- Execute `iniciar-site.bat` na pasta do projeto.
- O `.bat` atualiza automaticamente `data/provas.json` com as subpastas encontradas em `data`.

## Estrutura esperada

```txt
/data
  provas.json
  /nome-da-prova
    questoes.txt
    gabarito.txt
    meta.json
    1.png
    2.jpg
    7.webp
```

## Formato do `questoes.txt`

Use `===QUESTAO===` entre blocos:

```txt
===QUESTAO===
1) Enunciado...
A) Alternativa A
B) Alternativa B

===QUESTAO===
2) Outra questao...
A) Alternativa A
B) Alternativa B
```

## Regras de gabarito

Use arquivo `gabarito.txt` com uma letra por linha:

```txt
B
A
D
```

- Linha 1 corresponde a questao 1, linha 2 a questao 2, e assim por diante.
- Se o `gabarito.txt` nao existir, a prova e tratada como sem respostas.
- Somente questoes com letra valida entram na contagem de acertos e erros.

## Manifesto opcional

Arquivo `data/provas.json`:

```json
{
  "provas": ["acls-2025"]
}
```

O manifesto deve ser mantido para listar as provas disponiveis.
