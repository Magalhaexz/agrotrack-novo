# Agrotrack — Segundo Cérebro (Obsidian)

Esta pasta (`D:\agrotrack-novo`) é simultaneamente um repositório git do projeto Agrotrack **e** um vault Obsidian configurado como segundo cérebro.

## Estrutura do vault

| Pasta | Finalidade |
|-------|-----------|
| `00-Inbox/` | Captura rápida de ideias e tarefas brutas |
| `10-Projetos/` | Notas de projetos ativos (ex: `Agrotrack-Novo.md`) |
| `20-Decisoes/` | Registro de decisões técnicas e de produto |
| `30-Diario/` | Diário diário no formato `YYYY-MM-DD.md` |
| `40-Recursos/` | Referências, artigos, documentação externa |
| `90-Templates/` | Templates para novas notas |

## Home

A nota principal é `00-Home.md`. É o mapa do vault.

## Convenções

- **Wikilinks** para notas internas: `[[Nome da Nota]]`
- **Frontmatter** obrigatório com `title`, `tags`, e `created`
- **Capture primeiro** no Inbox, organize depois nas pastas corretas
- Notas diárias ficam em `30-Diario/YYYY-MM-DD.md`
- Decisões ficam em `20-Decisoes/YYYY-MM-DD-Titulo.md`

## Skills disponíveis

Use `/obsidian-cli` para interagir com o vault via CLI.
Use `/obsidian-markdown` para criar/editar notas com sintaxe correta.
Use `/obsidian-bases` para criar views `.base` (banco de dados de notas).
Use `/json-canvas` para criar mapas visuais `.canvas`.
Use `/defuddle` para extrair conteúdo limpo de páginas web para o vault.
