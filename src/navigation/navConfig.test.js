import test from 'node:test';
import assert from 'node:assert/strict';
import { navGroups, accountNavItems, navLabelMap, getNavLabel, groupIdByPageId } from './navConfig.js';
import { pageRouteMap, getPageFromPathname } from './routes.js';
import { permissoesPorPagina, perfilTemPermissao } from '../auth/perfis.js';
import { NAV_ITEMS as MOBILE_BOTTOM_NAV_ITEMS } from '../components/mobileBottomNavItems.js';

// Sprint Visual 2 — sidebar simplificada em 6 áreas principais (linguagem do
// pecuarista). navGroups é a ÚNICA fonte usada pela sidebar desktop
// (Sidebar.jsx), pelo bottom sheet mobile (App.jsx::mobileSheetSections) e
// pela barra inferior (mobileBottomNavItems.js aponta pra cá por groupId) —
// testar a estrutura aqui cobre as três superfícies.
const todosItens = [...navGroups.flatMap((group) => group.items), ...accountNavItems];

test('a sidebar tem exatamente 6 áreas principais', () => {
  assert.equal(navGroups.length, 6, `esperado 6 grupos, encontrado ${navGroups.length}`);
});

test('"Painel Geral" é o único grupo standalone (item direto, sem submenu)', () => {
  const standalone = navGroups.filter((group) => group.standalone);
  assert.equal(standalone.length, 1, 'deveria haver exatamente 1 grupo standalone');
  assert.equal(standalone[0].id, 'painel');
  assert.equal(standalone[0].items.length, 1, 'grupo standalone deve ter exatamente 1 item');
  assert.equal(standalone[0].items[0].id, 'dashboard');
});

test('nenhum pageId duplicado em navGroups/accountNavItems', () => {
  const ids = todosItens.map((item) => item.id);
  const duplicados = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.equal(new Set(ids).size, ids.length, `ids duplicados: ${duplicados.join(', ')}`);
});

test('nenhum item aparece em mais de um grupo', () => {
  const vistos = new Set();
  for (const group of navGroups) {
    for (const item of group.items) {
      assert.ok(!vistos.has(item.id), `${item.id} aparece em mais de um grupo`);
      vistos.add(item.id);
    }
  }
});

test('nenhum grupo vazio', () => {
  for (const group of navGroups) {
    assert.ok(group.items.length > 0, `grupo "${group.id}" está vazio`);
  }
});

test('nenhum grupo (fora o standalone Painel Geral) tem só 1 item sem justificativa', () => {
  for (const group of navGroups) {
    if (group.standalone) continue;
    assert.ok(group.items.length > 1, `grupo "${group.id}" tem só 1 item — junte a outro grupo ou justifique`);
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

test('"Estoque" está no grupo Gestão, não isolado', () => {
  const grupoIsolado = navGroups.find((group) => group.id === 'estoque');
  assert.equal(grupoIsolado, undefined, 'não deveria existir um grupo isolado "estoque"');

  const grupoGestao = navGroups.find((group) => group.id === 'gestao');
  assert.ok(grupoGestao.items.some((item) => item.id === 'estoque'), '"estoque" deveria estar no grupo Gestão');
  assert.ok(grupoGestao.items.length > 1, 'o grupo Gestão não pode ficar com 1 item só');
});

test('hub "Relatórios" continua na sidebar; relatórios específicos continuam com rota própria', () => {
  assert.ok(todosItens.some((item) => item.id === 'relatorios'), 'hub de Relatórios deveria continuar na sidebar');
  for (const id of ['relatorioLote', 'relatorioPesagens', 'relatorioFinanceiro', 'relatorioPastagens', 'relatorioResumoGeral']) {
    assert.ok(pageRouteMap[id], `rota ausente para relatório específico "${id}"`);
  }
});

test('"Relatórios Financeiros" segue fora da sidebar mas mantém rota funcionando', () => {
  assert.ok(!todosItens.some((item) => item.id === 'relatorioFinanceiro'), 'relatorioFinanceiro não deveria mais estar na sidebar (acessível via hub Relatórios)');
  assert.ok(pageRouteMap.relatorioFinanceiro, 'rota /relatorio-financeiro precisa continuar existindo');
});

test('"Painel Gerencial" está na sidebar — é recurso vendido no plano PRO', () => {
  assert.ok(
    todosItens.some((item) => item.id === 'relatoriosGerenciais'),
    'relatoriosGerenciais precisa estar na sidebar: é vendido como "Relatórios avançados" no plano PRO'
  );
  assert.ok(pageRouteMap.relatoriosGerenciais, 'rota /relatorios-gerenciais precisa continuar existindo');
});

test('DashboardPremiumPage foi removida e sua rota antiga redireciona sem quebrar link salvo', () => {
  assert.ok(!pageRouteMap.dashboardPremium, 'dashboardPremium não deveria ter rota própria (página removida)');
  assert.equal(
    getPageFromPathname('/dashboard-premium'),
    'relatoriosGerenciais',
    '/dashboard-premium precisa redirecionar para o Painel Gerencial (superconjunto)'
  );
});

test('"Funcionários" está na sidebar — é o único ponto de cadastro de responsáveis', () => {
  assert.ok(
    todosItens.some((item) => item.id === 'funcionarios'),
    'funcionarios precisa estar na sidebar (único cadastro de funcionário do app)'
  );
  assert.ok(pageRouteMap.funcionarios, 'rota de funcionários precisa existir');
});

test('"Equipe e Acessos" e "Funcionários" continuam como entradas distintas (entidades diferentes)', () => {
  // Funcionários (tabela funcionarios) = peões/vaqueiros sem login. Equipe e
  // Acessos (profiles/invites) = quem tem login na conta. Forçar uma entrada
  // única esconderia o único cadastro de funcionário do app (ver teste acima).
  const grupoAdministracao = navGroups.find((group) => group.id === 'administracao');
  assert.ok(grupoAdministracao.items.some((item) => item.id === 'funcionarios'));
  assert.ok(grupoAdministracao.items.some((item) => item.id === 'equipeAcessos'));
});

test('toda página da sidebar/conta tem rota registrada (nenhum item leva a rota inexistente)', () => {
  for (const item of todosItens) {
    assert.ok(pageRouteMap[item.id], `sem rota registrada para o item de sidebar "${item.id}"`);
  }
});

test('getNavLabel devolve o label configurado e cai para um label legível em pageId desconhecido', () => {
  assert.equal(getNavLabel('pesagens'), 'Pesagens');
  assert.equal(getNavLabel('paginaSemLabelAlgumaCoisa'), 'Pagina Sem Label Alguma Coisa');
});

test('navLabelMap cobre todos os itens de navGroups e accountNavItems', () => {
  for (const item of todosItens) {
    assert.equal(navLabelMap[item.id], item.label);
  }
});

test('groupIdByPageId cobre todo item de navGroups e aponta pro grupo certo', () => {
  for (const group of navGroups) {
    for (const item of group.items) {
      assert.equal(groupIdByPageId[item.id], group.id);
    }
  }
});

// Permissões — a reorganização não pode alterar quem vê o quê.
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

// Mobile: a barra inferior é uma lista curta e fixa (não deriva 1:1 de
// navGroups), mas "rebanho"/"manejo"/"gestao" apontam por groupId para um
// grupo real (abrem um bottom sheet); só "dashboard" navega direto e só
// "mais" abre o restante.
test('barra inferior mobile tem no máximo 5 itens, sem duplicados e sem acompanhamentoPeso', () => {
  assert.ok(MOBILE_BOTTOM_NAV_ITEMS.length <= 5, 'a barra inferior deve ter no máximo 5 itens');
  const ids = MOBILE_BOTTOM_NAV_ITEMS.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, 'ids duplicados na barra inferior');
  assert.ok(!ids.includes('acompanhamentoPeso'));

  for (const item of MOBILE_BOTTOM_NAV_ITEMS) {
    if (item.type === 'page') {
      assert.ok(pageRouteMap[item.id], `item de página "${item.id}" da barra inferior não tem rota`);
    } else if (item.type === 'group') {
      assert.ok(
        navGroups.some((group) => group.id === item.groupId),
        `item "${item.id}" aponta para um groupId inexistente ("${item.groupId}")`
      );
    } else {
      assert.equal(item.type, 'more', `item "${item.id}" tem tipo desconhecido`);
    }
  }
});

test('barra inferior mobile não deixa nenhum grupo órfão: rebanho/manejo/gestao cobertos, resto vai para "mais"', () => {
  const groupIdsNaBarra = MOBILE_BOTTOM_NAV_ITEMS.filter((item) => item.type === 'group').map((item) => item.groupId);
  const groupIdsForaDaBarra = navGroups.map((group) => group.id).filter((id) => id !== 'painel' && !groupIdsNaBarra.includes(id));
  // Os grupos que não têm aba própria (acompanhamento, administracao) só
  // são alcançáveis mobile via "mais" — isso é validado em App.jsx, aqui só
  // garantimos que a lista de "restantes" é a esperada (nada some sem querer).
  assert.deepEqual(groupIdsForaDaBarra.sort(), ['acompanhamento', 'administracao']);
});
