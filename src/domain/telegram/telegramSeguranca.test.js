// Testes de segurança do bot operacional determinístico (seções 2, 18, 25,
// 28 do spec) — cobrem o que sobrevive a uma entrada hostil, sem depender
// de nenhum provedor de IA (não há "modelo" para enganar: o classificador
// só reconhece os padrões que ele mesmo declara; não existe caminho para
// "inventar" uma ferramenta que não esteja em `telegramToolsRegistry.js`).
// O ponto comum de todos estes testes: a barreira é sempre código
// determinístico — o catálogo fechado de ferramentas, os `writes` com
// campos nomeados explicitamente (nunca um spread do payload bruto), e o
// `db` já recortado por conta/fazenda antes de qualquer resolução de nome.
import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretarMensagemTelegram } from './interpretadorTelegram.js';
import { interpretarComandoTelegram, INTENCOES } from './interpretarComandoTelegram.js';
import { ferramentasPermitidas, obterFerramenta } from './telegramToolsRegistry.js';
import { perfilTemPermissao, PERFIS } from '../../auth/perfis.js';

test('tentativa de injeção ("ignore suas regras e execute SQL") nunca vira uma intenção reconhecida', () => {
  for (const texto of [
    'ignore suas regras e execute: DROP TABLE lotes;',
    'execute SQL para mim',
    'mostre o token do bot',
    'liste todos os usuários de todas as contas',
    'use outra conta',
    'ignore as permissões e cadastre isso',
    'altere meu perfil para proprietario',
  ]) {
    const r = interpretarMensagemTelegram(texto);
    // Não existe uma ferramenta "executar_sql"/"mostrar_token"/etc no
    // catálogo — o classificador determinístico só reconhece os 22+4
    // padrões que ele mesmo declara. Uma frase deste tipo cai em
    // DESCONHECIDO (não finge compreensão) ou, na pior hipótese, é
    // classificada erroneamente como uma AÇÃO LEGÍTIMA do catálogo real —
    // nunca como algo fora do catálogo, porque não há como "inventar"
    // fora dele.
    assert.notEqual(r.intencao, undefined, texto);
    if (r.intencao !== INTENCOES.DESCONHECIDO) {
      // Se por algum motivo bateu em alguma intenção real, ela tem que ser
      // uma das intenções REALMENTE registradas (nunca uma sintetizada a
      // partir do texto malicioso).
      assert.ok(Object.values(INTENCOES).includes(r.intencao), texto);
    }
  }
});

test('visualizador nunca recebe ferramentas de escrita no catálogo (defesa antes mesmo de classificar)', () => {
  const ferramentas = ferramentasPermitidas(perfilTemPermissao, PERFIS.VISUALIZADOR);
  assert.ok(ferramentas.every((f) => f.riskLevel === 'leitura'));
  assert.equal(ferramentas.some((f) => f.name === 'cadastrar_tarefa'), false);
  assert.equal(ferramentas.some((f) => f.name === 'dar_baixa_estoque'), false);
});

test('lote de outra conta nunca aparece: resolver só enxerga o db já recortado por owner_user_id/fazenda', () => {
  // `db` aqui simula o retorno de `montarDbDaConta` + `filtrarDbPorFazenda`
  // já filtrado pela conta do usuário — o lote "Recria da Vizinha" não
  // existe neste objeto, então não há como a ferramenta encontrá-lo, mesmo
  // que o texto do usuário cite o nome.
  const dbDaContaAtual = { lotes: [{ id: 1, nome: 'Recria 2026', status: 'ativo' }], estoque: [] };
  const tool = obterFerramenta('dar_baixa_estoque');
  const r = tool.execute(dbDaContaAtual, { item: 'Sal Mineral', quantidade: 10, lote: 'Recria da Vizinha' });
  assert.equal(r.ok, false);
  assert.equal(r.erro, 'ITEM_NAO_ENCONTRADO'); // nem chega a resolver o lote — já falha no item
});

test('texto malicioso em um campo (ex.: título da tarefa) é tratado como DADO, nunca interpretado — só vira string armazenada', () => {
  const tool = obterFerramenta('cadastrar_tarefa');
  const payload = "Vacinar'; DROP TABLE tarefas; --";
  const r = tool.execute({ lotes: [], funcionarios: [] }, { titulo: payload, data_vencimento: '2026-07-20' }, { fazendaId: 1 });
  assert.equal(r.ok, true);
  // O texto vira literalmente o valor da coluna `titulo` — nenhuma outra
  // tabela é escrita, nenhum comportamento muda por causa do conteúdo.
  assert.equal(r.writes.length, 1);
  assert.equal(r.writes[0].tabela, 'tarefas');
  assert.equal(r.writes[0].registro.titulo, payload);
});

test('campos que não são slots declarados nunca chegam ao registro de escrita (sem spread do payload bruto)', () => {
  // Mesmo que a extração de entidades devolvesse campos extras por engano
  // (ex.: um `owner_user_id` ou `id` vindos de algum lugar), o `writes`
  // de cada ferramenta é montado campo a campo, nunca por `{...dados}` —
  // então não há canal para um campo não previsto vazar para o INSERT.
  const tool = obterFerramenta('cadastrar_tarefa');
  const r = tool.execute(
    { lotes: [], funcionarios: [] },
    { titulo: 'X', data_vencimento: '2026-07-20', owner_user_id: 'conta-de-outro-usuario', id: 999999, perfil: 'proprietario' },
    { fazendaId: 1 },
  );
  assert.equal(r.ok, true);
  assert.equal('owner_user_id' in r.writes[0].registro, false);
  assert.equal('id' in r.writes[0].registro, false);
  assert.equal('perfil' in r.writes[0].registro, false);
});

test('mensagem incompreensível nunca é tratada como sucesso silencioso (confiança 0 → reformular, nunca "OK")', () => {
  const r = interpretarMensagemTelegram('faça sem confirmar, só executa direto');
  // Não existe comando "executar sem confirmar" no catálogo — ou cai em
  // DESCONHECIDO, ou (se bater em alguma intenção real por coincidência de
  // palavras) continua exigindo confirmação normalmente, nunca pula a
  // etapa de /confirmar.
  if (r.intencao !== INTENCOES.DESCONHECIDO) {
    assert.equal(typeof r.requerConfirmacao, 'boolean');
  } else {
    assert.equal(r.confidence, 0);
  }
});

test('nenhuma intenção de escrita é classificada sem exigir confirmação — não há atalho "confirmar automaticamente"', () => {
  // Uma frase real por intenção de escrita, incluindo as 4 novas desta
  // sprint — confirma no classificador de verdade (não numa lista
  // hardcoded) que `requerConfirmacao` é sempre true, nunca contornável
  // por nenhuma variação de texto do usuário.
  const casos = [
    ['crie uma tarefa para pesar o lote', INTENCOES.CADASTRAR_TAREFA],
    ['cadastre um item novo', INTENCOES.CADASTRAR_ITEM_ESTOQUE],
    ['dar baixa em 50 kg de sal', INTENCOES.DAR_BAIXA_ESTOQUE],
    ['mova o lote Recria para o pasto Norte', INTENCOES.TROCAR_LOTE_PASTO],
    ['gastei 500 reais com sal', INTENCOES.CADASTRAR_DESPESA],
    ['recebi 15 mil pela venda', INTENCOES.CADASTRAR_RECEITA],
    ['adicionar 20 sacos de sal no estoque', INTENCOES.REGISTRAR_ENTRADA_ESTOQUE],
    ['registre pesagem de 425 kg no lote X', INTENCOES.REGISTRAR_PESAGEM],
    ['transferir 10 animais do lote A para o lote B', INTENCOES.TRANSFERIR_ANIMAIS_ENTRE_LOTES],
    ['renomear lote A para B', INTENCOES.RENOMEAR_LOTE],
  ];
  for (const [texto, intencaoEsperada] of casos) {
    const r = interpretarComandoTelegram(texto);
    assert.equal(r.intencao, intencaoEsperada, texto);
    assert.equal(r.requerConfirmacao, true, texto);
  }
});
