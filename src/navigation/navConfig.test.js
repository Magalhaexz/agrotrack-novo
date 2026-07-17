import test from 'node:test';
import assert from 'node:assert/strict';
import { navSections, secondaryNavItems, navLabelMap, getNavLabel } from './navConfig.js';
import { pageRouteMap } from './routes.js';
import { permissoesPorPagina, perfilTemPermissao } from '../auth/perfis.js';
import { NAV_ITEMS as MOBILE_BOTTOM_NAV_ITEMS } from '../components/mobileBottomNavItems.js';

// Sprint de reorganização estratégica da sidebar — testes cobrindo a
// estrutura de navConfig.js. navSections é a ÚNICA fonte usada tanto pela
// sidebar desktop (Sidebar.jsx) quanto pelo drawer mobile "Mais opções"
// (App.jsx::mobileNavGroups é derivado dela, mesmo filtro de permissão) —
// então testar a estrutura de dados aqui cobre os dois.
const todosItens = [...navSections.flatMap((section) => section.items), ...secondaryNavItems];

test('nenhum pageId duplicado em navSections/secondaryNavItems', () => {
  const ids = todosItens.map((item) => item.id);
  const duplicados = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.equal(new Set(ids).size, ids.length, `ids duplicados: ${duplicados.join(', ')}`);
});

test('nenhum item aparece em mais de um grupo', () => {
  const vistos = new Set();
  for (const section of navSections) {
    for (const item of section.items) {
      assert.ok(!vistos.has(item.id), `${item.id} aparece em mais de um grupo`);
      vistos.add(item.id);
    }
  }
});

test('nenhum grupo vazio', () => {
  for (const section of navSections) {
    assert.ok(section.items.length > 0, `grupo "${section.id}" está vazio`);
  }
});

test('nenhum grupo com apenas 1 item (sem justificativa formal registrada)', () => {
  for (const section of navSections) {
    assert.ok(section.items.length > 1, `grupo "${section.id}" tem só 1 item — junte a outro grupo ou justifique`);
  }
});

test('"Pesagens" está na sidebar e "Acompanhamento de Peso" não aparece mais', () => {
  assert.ok(todosItens.some((item) => item.id === 'pesagens'), 'Pesagens deveria estar na sidebar');
  assert.ok(!todosItens.some((item) => item.id === 'acompanhamentoPeso'), 'acompanhamentoPeso não deveria mais existir como item de menu');
  assert.ok(
    !todosItens.some((item) => item.label.toLowerCase().includes('acompanhamento de peso')),
    'nenhum label deveria mencionar "Acompanhamento de Peso"'
  );
});

test('"Produtos e Insumos" saiu do grupo isolado "Estoque" e foi para Rebanho e Campo', () => {
  const grupoEstoqueIsolado = navSections.find((section) => section.id === 'estoque');
  assert.equal(grupoEstoqueIsolado, undefined, 'o grupo isolado "estoque" deveria ter sido removido');

  const grupoComProdutos = navSections.find((section) => section.items.some((item) => item.id === 'estoque'));
  assert.ok(grupoComProdutos, '"Produtos e Insumos" (id: estoque) deveria estar em algum grupo');
  assert.ok(grupoComProdutos.items.length > 1, 'o grupo que recebeu Produtos e Insumos não pode ficar com 1 item só');
});

test('hub "Relatórios" continua na sidebar; relatórios específicos continuam com rota própria', () => {
  assert.ok(todosItens.some((item) => item.id === 'relatorios'), 'hub de Relatórios deveria continuar na sidebar');
  for (const id of ['relatorioLote', 'relatorioPesagens', 'relatorioFinanceiro', 'relatorioPastagens', 'relatorioResumoGeral']) {
    assert.ok(pageRouteMap[id], `rota ausente para relatório específico "${id}"`);
  }
});

test('"Relatórios Financeiros" e "Painel Gerencial" saíram da sidebar mas mantêm rota funcionando', () => {
  assert.ok(!todosItens.some((item) => item.id === 'relatorioFinanceiro'), 'relatorioFinanceiro não deveria mais estar na sidebar (acessível via hub Relatórios)');
  assert.ok(!todosItens.some((item) => item.id === 'relatoriosGerenciais'), 'relatoriosGerenciais não deveria mais estar na sidebar (duplica DashboardPremiumPage)');
  assert.ok(pageRouteMap.relatorioFinanceiro, 'rota /relatorio-financeiro precisa continuar existindo');
  assert.ok(pageRouteMap.relatoriosGerenciais, 'rota /relatorios-gerenciais precisa continuar existindo');
});

test('toda página da sidebar tem rota registrada (nenhum item leva a rota inexistente)', () => {
  for (const item of todosItens) {
    assert.ok(pageRouteMap[item.id], `sem rota registrada para o item de sidebar "${item.id}"`);
  }
});

test('getNavLabel devolve o label configurado e cai para um label legível em pageId desconhecido', () => {
  assert.equal(getNavLabel('pesagens'), 'Pesagens');
  assert.equal(getNavLabel('paginaSemLabelAlgumaCoisa'), 'Pagina Sem Label Alguma Coisa');
});

test('navLabelMap cobre todos os itens de navSections e secondaryNavItems', () => {
  for (const item of todosItens) {
    assert.equal(navLabelMap[item.id], item.label);
  }
});

// Permissões — a reorganização não pode alterar quem vê o quê (Etapa 8).
// Reaproveita permissoesPorPagina/permissoesPorPerfil de auth/perfis.js,
// que não foi tocado nesta sprint; só confirma que a filtragem por
// permissão (mesma lógica usada em Sidebar.jsx e App.jsx::mobileNavGroups)
// continua produzindo o resultado esperado por perfil.
function podeVerPagina(perfil, pageId) {
  const permissao = permissoesPorPagina[pageId];
  return !permissao || perfilTemPermissao(perfil, permissao);
}

test('proprietário vê os itens administrativos (Equipe e Acessos, Planos e Assinatura)', () => {
  assert.ok(podeVerPagina('proprietario', 'equipeAcessos'));
  assert.ok(podeVerPagina('proprietario', 'minhaAssinatura'));
});

test('gerente não recebe itens proibidos (Equipe e Acessos, Planos e Assinatura)', () => {
  assert.ok(!podeVerPagina('gerente', 'equipeAcessos'));
  assert.ok(!podeVerPagina('gerente', 'minhaAssinatura'));
});

test('operador vê somente módulos operacionais permitidos', () => {
  assert.ok(podeVerPagina('operador', 'pesagens'));
  assert.ok(podeVerPagina('operador', 'lotes'));
  assert.ok(!podeVerPagina('operador', 'equipeAcessos'));
  assert.ok(!podeVerPagina('operador', 'minhaAssinatura'));
  assert.ok(!podeVerPagina('operador', 'importacao'));
});

test('visualizador não recebe ações de gestão (Equipe, Importação, Assinatura)', () => {
  assert.ok(!podeVerPagina('visualizador', 'equipeAcessos'));
  assert.ok(!podeVerPagina('visualizador', 'importacao'));
  assert.ok(!podeVerPagina('visualizador', 'minhaAssinatura'));
});

test('"Planos e Assinatura" continua restrito conforme regra atual (só proprietário)', () => {
  assert.equal(permissoesPorPagina.minhaAssinatura, 'assinatura:gerenciar');
  for (const perfil of ['gerente', 'operador', 'visualizador']) {
    assert.ok(!perfilTemPermissao(perfil, 'assinatura:gerenciar'), `${perfil} não deveria ter assinatura:gerenciar`);
  }
  assert.ok(perfilTemPermissao('proprietario', 'assinatura:gerenciar'));
});

// Mobile: a barra inferior é uma lista curta e fixa (não deriva de
// navSections), mas precisa continuar curta, sem "Acompanhamento de Peso"
// e sem pageId inválido.
test('barra inferior mobile é curta, sem duplicados, sem acompanhamentoPeso e com pageIds válidos', () => {
  assert.ok(MOBILE_BOTTOM_NAV_ITEMS.length <= 6, 'a barra inferior deve permanecer curta');
  const ids = MOBILE_BOTTOM_NAV_ITEMS.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, 'ids duplicados na barra inferior');
  assert.ok(!ids.includes('acompanhamentoPeso'));
  for (const item of MOBILE_BOTTOM_NAV_ITEMS) {
    if (item.id === 'mais') continue; // "mais" abre o drawer, não é um pageId
    assert.ok(pageRouteMap[item.id], `item "${item.id}" da barra inferior não tem rota`);
  }
});
