# AgroTrack React Conversion

Base React criada a partir do protótipo HTML `AGROTRACK_v2.html`.

## Como usar
1. Crie um projeto React com Vite.
2. Copie a pasta `src` deste material para dentro do seu projeto.
3. Garanta que o `src/main.jsx` importe `App` normalmente.
4. Rode:

```bash
npm install
npm run dev
```

## Estrutura
- `src/App.jsx` — shell principal com navegação
- `src/data/mockData.js` — dados simulados
- `src/utils/calculations.js` — cálculos e alertas
- `src/components/*` — componentes reutilizáveis
- `src/pages/*` — páginas do sistema
- `src/styles/app.css` — estilos

## Observação
Esta versão já está componentizada, mas ainda usa dados mockados. O próximo passo é ligar com Supabase ou outro backend.
