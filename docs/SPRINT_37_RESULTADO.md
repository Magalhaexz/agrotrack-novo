# Sprint 37 — Resultado

## Funcionalidade entregue

**QA funcional completo + correção de quedas.** Escopo realizado: investigação
dirigida dos dois bugs reportados (Modo Curral → Ver pendências; Suporte),
varredura de navegação em todas as páginas do app, QA mobile em 4 larguras,
correção de uma regressão real de CSS encontrada durante a investigação, e
testes de regressão. Ver detalhe completo em
[QA_FUNCIONAL_COMPLETO_HERDON.md](QA_FUNCIONAL_COMPLETO_HERDON.md).

## 1. Os dois bugs reportados não reproduziram

Testados em `npm run dev` e em build de produção real (`npm run build` +
`vite preview`), com a conta real da usuária ("QA Piloto Sprint 34"):

- **Modo Curral → "Ver pendências"** navega para Sincronização normalmente,
  nos dois botões equivalentes da tela, sem erro de console.
- **Suporte** (menu Ajuda) abre `/suporte` normalmente, conteúdo completo,
  sem erro de console.

Não foi possível confirmar a causa raiz do relato original sem mais contexto
(dispositivo, ambiente exato — local vs. Vercel publicado, perfil de usuário).
Ver recomendação na seção 4.

## 2. Bug real encontrado durante a investigação: cabeçalho mobile sobreposto

Ao testar viewports estreitos (375-768px) para a Etapa 5, encontrado overlap
visual real do cabeçalho: os ícones de status/notificação/menu quebravam em
até 3 linhas (`flex-wrap: wrap`) dentro de um cabeçalho de altura fixa,
vazando por cima da marca "HERDON".

**Causa raiz:** `src/styles/app.css:7751` tem uma regra
`@media (max-width: 1024px) { .header.top-header .top-header-actions {
flex-wrap: wrap; } }` com especificidade mais alta que os blocos de "modo
compacto mobile" adicionados depois (`.top-header-actions` sozinho, em
`app.css:8373`). Como nenhum bloco mais novo redeclarava `flex-wrap` no
seletor de maior especificidade, a regra antiga continuava ganhando em
qualquer largura ≤1024px.

Isso é uma regressão da mesma classe de bug já registrada na
[SPRINT_35_RESULTADO.md](SPRINT_35_RESULTADO.md) ("cabeçalho mobile
sobreposto em 375px, duas regras CSS concorrentes") — `app.css` acumulou
múltiplos blocos `@media` redundantes para os mesmos seletores em sprints
sucessivos (visível pelos próprios comentários no arquivo: "Sprint 18A4",
"SPRINT18W6 HOTFIX"), e cada correção pontual deixou outras combinações de
regras conflitantes intactas.

**Correção:** adicionado `flex-wrap: nowrap` ao seletor de maior
especificidade dentro do bloco de modo compacto mobile, e ocultado o wrapper
vazio que sobrava de `.header-user-btn` (oculto, mas o `<div>` pai continuava
ocupando espaço no layout).

**Verificado em:** 375, 390, 430, 768px — sem overflow horizontal, sem erro de
console, em 7+ páginas. Screenshot antes/depois confirma a correção
visualmente.

## 3. Cobertura de QA realizada

- **Navegação:** 27 páginas do menu + 4 páginas públicas, 100% abrindo sem
  erro de console e sem tela branca.
- **Mobile:** 375/390/430/768px, sem overflow, sem erro, após a correção.
- **Persistência:** confirmado por reload completo que dados já existentes
  (fazenda, lote) seguem visíveis após reload — leitura do Supabase no boot
  funciona.
- **Não cobertos nesta sprint** (ver detalhe em
  [QA_FUNCIONAL_COMPLETO_HERDON.md](QA_FUNCIONAL_COMPLETO_HERDON.md)):
  auditoria botão a botão exaustiva de cada um dos ~30 módulos, teste com
  perfis não-proprietário, upload real de arquivo na Importação, e
  persistência de **criação** de novos registros (só leitura pós-reload de
  dados pré-existentes foi verificada, para não escrever dados de teste
  extras na conta de produção sem necessidade).

## 4. Testes e gates

- `npm test`: **625/625 passando**.
- `npm run lint`: limpo.
- `npm run build`: build de produção concluído.
- Testes de regressão adicionados a `e2e/smoke.spec.js`:
  - Modo Curral → Ver pendências → Sincronização sem erro.
  - Suporte abre sem erro.
  - Cabeçalho mobile não sobrepõe a marca (375px).

## 5. Recomendação

**Não seguir direto para auditoria de cibersegurança ou piloto** sem fechar o
loop dos dois bugs originais com a usuária primeiro: peça para ela confirmar
se o problema persiste no ambiente publicado (Vercel) — se sim, é provável
mismatch entre o deploy publicado e este repositório (vale checar
`vercel ls`/redeploy); se ela conseguir reproduzir só em mobile, é possível
que o cabeçalho sobreposto desta sprint explique o efeito ("clique parecia
não fazer nada / app parecia travar") sem ser de fato um crash de JS. Recomendo
uma sprint de QA funcional adicional focada nas áreas não cobertas (Etapa 4
botão a botão, perfis não-proprietário) antes de declarar pronto para piloto
público.
