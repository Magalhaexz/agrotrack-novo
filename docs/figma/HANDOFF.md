# HERDON — Handoff oficial

## Direção

O Conceito A / Light é a direção visual oficial. Dashboard, Lotes e Lotes mobile são as referências aprovadas para o shell, componentes, espaçamento, contraste e hierarquia. O Conceito B / Dark permanece arquivado apenas como referência futura.

## Auditoria de consistência

- Shell oficial com sidebar aberta, recolhida, header desktop/mobile, seletor de fazenda, menu do usuário, ações rápidas e bottom navigation.
- Sidebar mantém todos os módulos existentes; grupos podem expandir/recolher e o grupo da página atual permanece aberto.
- Dashboard usa `GMD médio` no lugar de `Fazendas` e destaca `Hoje na Fazenda`.
- Lotes usa filtro de pasto, remove Período quando não necessário para lotes ativos e mantém a hierarquia Venda → Pesagem/Trocar pasto → Mais → Morte/Perda.
- Mobile mantém uma coluna, padding de 16 px, bottom navigation, ação `+ Novo lote` sem duplicação com FAB e filtros em bottom sheet.
- Financeiro, Resultados, Decisões, Sanidade, Nutrição, Agenda, Alertas, Indicadores, Relatórios, Administração e Conta foram representados com os estados funcionais relevantes.
- Estados de referência ficam centralizados em Components; não devem ser duplicados dentro das telas funcionais.
- Datas e valores fictícios das telas devem permanecer coerentes com os contratos registrados no Figma.

## Auditoria responsiva

Frames conferidos em 1440, 1366, 1024, 768, 375 e 320 px quando aplicável. A auditoria geométrica final não encontrou overflow nos frames desktop, tablet e mobile oficiais.

Regras:

- Desktop não deve ser comprimido até parecer mobile.
- Mobile usa cards, bottom sheets e uma coluna; tabelas largas devem virar cards ou rolagem controlada.
- 320 px é validação de adaptação, não precisa duplicar todas as variações.
- Sidebar aberta, recolhida, header e bottom navigation preservam as dimensões documentadas em [TOKENS.md](./TOKENS.md).

## Regras funcionais preservadas

- Não alterar rotas, navegação, permissões, RLS, serviços, RPCs ou integrações Telegram/Supabase.
- Não alterar cálculos de GMD, UA, capacidade, lotação, custo médio, saldo, consumo, DRE, receita, margem ou resultados.
- Não criar dados locais offline sem confirmação funcional; sincronização deve representar pendente, sincronizando, sincronizado, falha e tentativa novamente conforme o código existente.
- Não transformar “indisponível” em zero em GMD ou indicadores.
- Não fazer animações comemorativas em ações sensíveis ou números financeiros.
- Manter mensagens de erro úteis sem expor detalhes técnicos ou segredos.
- A proteção real continua sendo o banco/RLS; o redesign não substitui autorização.

## Componentes e estados

Os componentes oficiais estão em [COMPONENTS.md](./COMPONENTS.md). Estados mínimos: default, hover, focus, pressed, disabled, loading, error, success, empty, sem permissão, sem conexão/offline quando funcionalmente confirmado, atenção, crítico, concluído, atrasado, estornado e dados insuficientes.

## Responsividade e acessibilidade

- Foco visível em Button, Input, Select, Tabs e menus.
- Label, valor, ajuda, erro e sucesso devem coexistir no campo quando aplicável.
- Estados não podem depender somente de cor.
- Alvos de toque devem ter pelo menos 44 px.
- Conteúdo e feedback permanecem disponíveis com movimento reduzido.
- Contraste, teclado, leitor de tela e comportamento real precisam ser validados no código.

## Arquivos React/CSS

O mapa completo está em [ROUTES_MAP.md](./ROUTES_MAP.md). CSS global atual: `src/styles/tokens.css`, `app.css`, `ui.css` e `layout.css`. CSS específico só deve ser removido gradualmente, depois de confirmação visual e funcional.

## Fora do escopo

Não alterar nesta ponte:

- qualquer arquivo em `src/**` ou `public/**`;
- React, CSS, rotas, serviços, hooks, cálculos, testes ou scripts;
- migrations, Supabase, RPCs, RLS ou banco;
- permissões e contratos de dados;
- identidade visual do Conceito A;
- conteúdo do Figma ou novos frames de produto.

## Pendências reais

- Validar no navegador com sessão autenticada todos os fluxos funcionais.
- Confirmar contraste, teclado, leitor de tela e `prefers-reduced-motion` na implementação.
- Confirmar com dados reais os estados de sincronização, faturamento, importação e operações sensíveis.
- Remover CSS legado somente depois de cada sprint passar no checklist.
