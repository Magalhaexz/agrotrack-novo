# HERDON — Tokens oficiais

Os valores abaixo foram lidos do Figma oficial e do arquivo atual `src/styles/tokens.css`. Quando houver diferença, o valor visual do Figma é o alvo do redesign; o valor CSS atual fica registrado para migração controlada.

## Cores do Figma

| Token | Hex exato | Uso |
|---|---|---|
| `Color/Primary/300` | `#86EFAC` | verde claro |
| `Color/Primary/500` | `#22C55E` | primário semântico / dark |
| `Color/Primary/600` | `#16A34A` | ação mais intensa |
| `Color/Primary/800` | `#166534` | verde profundo |
| `Color/Neutral/950` | `#030705` | neutro mais escuro |
| `Color/Neutral/900` | `#0B0F0C` | background escuro |
| `Color/Neutral/800` | `#121815` | surface escura |
| `Color/Neutral/700` | `#17201A` | surface escura secundária |
| `Color/Text/Primary` | `#E5E7EB` | texto primário escuro |
| `Color/Text/Secondary` | `#9CA3AF` | texto secundário |
| `Color/Border/Default` | `#1F2A22` | borda escura |
| `Color/Status/Success` | `#22C55E` | sucesso |
| `Color/Status/Warning` | `#F59E0B` | atenção |
| `Color/Status/Danger` | `#EF4444` | erro/perigo |
| `Color/Status/Info` | `#3B82F6` | informação |

## Conceito A / Light

| Token visual | Hex exato |
|---|---|
| `Surface/Background` | `#F4F7F5` |
| `Surface/Card` | `#FFFFFF` |
| `Primary/500` | `#258F55` |
| `Status/Warning` | `#D4A12D` |
| `Text/Primary` | `#16301F` |
| Sidebar | `#173A2B` |
| Content background quente do Dashboard/Lotes | `#F5F1E8` |
| Header | `#FFFFFF` |

O Conceito A é oficial. O tema escuro permanece documentado no Figma como provisório/arquivado e não deve ser implementado como padrão nesta etapa.

## CSS atual de referência

O código atual ainda usa a base escura em `src/styles/tokens.css`:

```css
--color-primary: #22c55e;
--color-primary-light: #4ade80;
--color-primary-dark: #15803d;
--color-bg: #0b0f0c;
--color-surface: #121815;
--color-surface-2: #17201a;
--color-surface-3: #1c2620;
--color-border: #1f2a22;
--color-text: #e5e7eb;
--color-text-secondary: #9ca3af;
--color-success: #22c55e;
--color-warning: #f59e0b;
--color-danger: #ef4444;
--color-info: #3b82f6;
```

Não substituir globalmente sem migrar tela por tela e validar contrastes.

## Tipografia

- Interface: `Inter`.
- Títulos: `Sora` está documentada como fonte de heading no Figma/tokens; exemplos oficiais de Page Title e Section Title usam `Inter Semi Bold`.
- Números, pesos, percentuais e valores financeiros: `IBM Plex Mono Medium`.

| Papel | Família/estilo | Tamanho | Line-height |
|---|---|---:|---|
| Page Title | Inter Semi Bold | 32 px | AUTO |
| Section Title | Inter Semi Bold | 20 px | AUTO |
| Body | Inter Regular | 16 px | AUTO |
| Caption | Inter Regular | 12 px | AUTO |
| Numeric/KPI | IBM Plex Mono Medium | 24 px | AUTO |

## Espaçamento, raios e sombras

### Escala

`4, 8, 12, 16, 20, 24, 32, 40, 48 px`.

### Raios

`6, 10, 14, 20, 9999 px` (`sm`, `md`, `lg`, `xl`, `full`).

### Sombras atuais

```css
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.5);
--shadow-md: 0 4px 16px rgba(0, 0, 0, 0.6);
--shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.7);
--shadow-glow: 0 0 20px rgba(34, 197, 94, 0.15);
```

No Conceito A, usar bordas e sombras discretas; não transportar automaticamente o glow do tema escuro.

## Estrutura do shell

| Token | Valor |
|---|---:|
| Sidebar aberta | 272 px |
| Sidebar recolhida | 84 px |
| Header desktop | 74 px |
| Header mobile | 60 px |
| Bottom navigation mobile | 78 px |
| Largura máxima de conteúdo | 1480 px |
| Formulário máximo | 1120 px |
| Padding lateral | clamp(16px, 2.2vw, 32px) |
| Padding vertical | clamp(20px, 2vw, 28px) |
| Gap de seção | clamp(14px, 1.8vw, 22px) |
| Padding de card | clamp(18px, 2vw, 24px) |
| Item de sidebar | 46 px |
| Rodapé da sidebar | 86 px |

## Grids e breakpoints

- Desktop: 12 colunas, gutter 24 px.
- Tablet: 8 colunas.
- Mobile: 4 colunas.
- Breakpoints de validação: `320`, `375`, `768`, `1024`, `1366`, `1440`.
- Breakpoints CSS atuais: mobile até `640px`, tablet até `1024px`, notebook até `1440px`, desktop a partir de `1441px`.
