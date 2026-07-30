import test from 'node:test';
import assert from 'node:assert/strict';
import {
  registrarSaidaLoteTransacional,
  planejarSaidaLoteTransacional,
  usaSaidaTransacional,
} from './saidaLoteTransacional.js';

// Sprint 3 — venda e morte/perda do app web pela RPC transacional
// `registrar_saida_lote`. Os testes cobrem os dois lados da garantia:
//
//   1. o plano local (mensagem imediata ao usuário), e
//   2. a revalidação do SERVIDOR sob `SELECT … FOR UPDATE` — testada com um
//      `db` local propositalmente DESATUALIZADO, que é exatamente o caso de
//      concorrência que a validação do navegador não consegue pegar.
//
// O cliente falso abaixo espelha as regras do SQL em
// supabase/migrations/20260717120000_sincroniza_animais_grupo_registrar_saida_lote.sql
// (tipo válido, qtd > 0, lote existe, lote não finalizado, qtd <= saldo,
// financeiro só para venda/abate com valor > 0).

const OWNER = 'owner-1';
const session = { user: { id: OWNER } };
const hoje = '2026-07-11';

function makeDb({ lotes = [], animais = [], sanitario = [] } = {}) {
  return {
    lotes,
    animais,
    sanitario,
    movimentacoes_animais: [],
    movimentacoes_financeiras: [],
  };
}

const makeLote = (o = {}) => ({ id: 1, nome: 'Lote A', qtd: 50, p_at: 400, status: 'ativo', ...o });
const makeAnimal = (o = {}) => ({ id: 1, lote_id: 1, qtd: 50, p_at: 400, ...o });

/**
 * Cliente falso da RPC. `estadoServidor` é o saldo REAL no banco — pode
 * divergir do `db` do navegador, e é isso que permite testar a revalidação.
 */
function makeFakeClient({ lotes = [{ id: 1, qtd: 50, status: 'ativo' }], falhaDeRede = null } = {}) {
  const chamadas = [];
  let proximoMovId = 900;
  let proximoFinId = 500;

  return {
    chamadas,
    lotesServidor: lotes,
    async rpc(nome, params) {
      chamadas.push({ nome, params });
      if (falhaDeRede) throw falhaDeRede;

      if (nome !== 'registrar_saida_lote') {
        return { data: null, error: { code: '42883', message: `RPC desconhecida: ${nome}` } };
      }
      if (params.p_owner_user_id !== OWNER) {
        return { data: null, error: { code: '42501', message: 'permission denied (row-level security)' } };
      }
      if (!['venda', 'morte', 'abate', 'descarte', 'transferencia_saida'].includes(params.p_tipo)) {
        return { data: null, error: { code: '22023', message: `Tipo de saída inválido: ${params.p_tipo}` } };
      }
      if (!(params.p_qtd > 0)) {
        return { data: null, error: { code: '22003', message: 'Informe uma quantidade válida.' } };
      }
      const lote = lotes.find((l) => Number(l.id) === Number(params.p_lote_id));
      if (!lote) {
        return { data: null, error: { code: '42501', message: 'Lote não encontrado ou não pertence à sua conta.' } };
      }
      if (['encerrado', 'vendido'].includes(lote.status)) {
        return { data: null, error: { code: '22023', message: 'Esse lote está finalizado e não aceita novas movimentações.' } };
      }
      if (params.p_qtd > (lote.qtd ?? 0)) {
        return {
          data: null,
          error: {
            code: '22003',
            message: `Quantidade de saída (${params.p_qtd}) excede o saldo do lote (${lote.qtd}).`,
          },
        };
      }

      // Mesma validação de destino da migration 20260717120000: destino
      // obrigatório, diferente da origem, existente e não finalizado.
      let destino = null;
      if (params.p_tipo === 'transferencia_saida') {
        if (params.p_destino_lote_id == null) {
          return { data: null, error: { code: '22004', message: 'Informe o lote de destino.' } };
        }
        if (Number(params.p_destino_lote_id) === Number(params.p_lote_id)) {
          return { data: null, error: { code: '22023', message: 'Origem e destino não podem ser o mesmo lote.' } };
        }
        destino = lotes.find((l) => Number(l.id) === Number(params.p_destino_lote_id));
        if (!destino) {
          return { data: null, error: { code: '42501', message: 'Lote de destino não encontrado ou não pertence à sua conta.' } };
        }
        if (['encerrado', 'vendido'].includes(destino.status)) {
          return { data: null, error: { code: '22023', message: 'O lote de destino está finalizado e não aceita novas movimentações.' } };
        }
      }

      // Transação: baixa da origem + (transferência: alta do destino) +
      // movimentação + (venda/abate com valor) financeiro.
      lote.qtd -= params.p_qtd;
      if (destino) destino.qtd += params.p_qtd;
      const movimentacaoId = (proximoMovId += 1);
      const geraReceita = ['venda', 'abate'].includes(params.p_tipo) && (params.p_valor_total || 0) > 0;
      const financeiroId = geraReceita ? (proximoFinId += 1) : null;
      return { data: [{ movimentacao_id: movimentacaoId, financeiro_id: financeiroId }], error: null };
    },
  };
}

const opcoes = (client) => ({ session, client, persist: false, userContext: { id: OWNER, email: 'a@b.c' } });

// ── Roteamento ───────────────────────────────────────────────────────────────

test('usaSaidaTransacional cobre venda, morte e transferência (P1-02)', () => {
  assert.equal(usaSaidaTransacional('venda'), true);
  assert.equal(usaSaidaTransacional('morte'), true);
  assert.equal(usaSaidaTransacional('transferencia_saida'), true);
  assert.equal(usaSaidaTransacional(undefined), false);
});

// ── 1. Venda válida reduz o lote e cria a receita correta ────────────────────

test('venda válida: chama a RPC uma vez, reduz o lote e cria a receita com o valor informado', async () => {
  const db = makeDb({ lotes: [makeLote()], animais: [makeAnimal()] });
  const client = makeFakeClient();

  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'venda', qtd: 10, pesoMedio: 420, valorTotal: 15000, data: hoje, comprador: 'Frigorífico X',
  }, opcoes(client));

  assert.equal(resultado.ok, true);
  assert.equal(client.chamadas.length, 1, 'uma única ida ao banco — a transação inteira');
  assert.equal(client.chamadas[0].nome, 'registrar_saida_lote');
  assert.equal(client.chamadas[0].params.p_custo_por_cabeca, 1500);

  const proximo = resultado.aplicar(db);
  assert.equal(proximo.lotes.find((l) => l.id === 1).qtd, 40);
  assert.equal(proximo.animais.find((a) => a.id === 1).qtd, 40, 'a linha "grupo" acompanha a baixa');

  assert.equal(proximo.movimentacoes_financeiras.length, 1);
  const receita = proximo.movimentacoes_financeiras[0];
  assert.equal(receita.tipo, 'receita');
  assert.equal(receita.categoria, 'venda_animal');
  assert.equal(receita.valor, 15000);
  assert.equal(receita.status, 'realizado');
  assert.equal(receita.lote_id, 1);
  assert.equal(receita.origem_tipo, 'movimentacao_animal');
  assert.equal(receita.origem_id, proximo.movimentacoes_animais[0].id, 'a receita aponta para a movimentação criada');
});

test('venda válida: o saldo do servidor também foi decrementado (a baixa é a da transação)', async () => {
  const db = makeDb({ lotes: [makeLote()], animais: [makeAnimal()] });
  const client = makeFakeClient();
  await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'venda', qtd: 10, pesoMedio: 420, valorTotal: 15000, data: hoje,
  }, opcoes(client));
  assert.equal(client.lotesServidor[0].qtd, 40);
});

test('venda sem valor informado não cria receita (nada a lançar)', async () => {
  const db = makeDb({ lotes: [makeLote()], animais: [makeAnimal()] });
  const client = makeFakeClient();
  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'venda', qtd: 2, pesoMedio: 400, valorTotal: 0, data: hoje,
  }, opcoes(client));
  const proximo = resultado.aplicar(db);
  assert.equal(proximo.movimentacoes_financeiras.length, 0);
});

// ── 2. Venda acima do saldo é rejeitada sem alteração parcial ────────────────

test('venda acima do saldo: barrada localmente, sem nem chamar a RPC', async () => {
  const db = makeDb({ lotes: [makeLote({ qtd: 5 })], animais: [makeAnimal({ qtd: 5 })] });
  const client = makeFakeClient({ lotes: [{ id: 1, qtd: 5, status: 'ativo' }] });

  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'venda', qtd: 10, pesoMedio: 400, valorTotal: 5000, data: hoje,
  }, opcoes(client));

  assert.equal(resultado.ok, false);
  assert.match(resultado.erro, /Quantidade indispon[íi]vel/);
  assert.equal(resultado.aplicar, null, 'sem `aplicar`, não há como a tela concluir a operação');
  assert.equal(client.chamadas.length, 0);
  assert.equal(client.lotesServidor[0].qtd, 5, 'servidor intocado');
});

test('venda acima do saldo REAL: o navegador estava desatualizado e o servidor recusa (concorrência)', async () => {
  // Outra aba já vendeu 48 das 50 cabeças; este `db` ainda mostra 50.
  const db = makeDb({ lotes: [makeLote({ qtd: 50 })], animais: [makeAnimal({ qtd: 50 })] });
  const client = makeFakeClient({ lotes: [{ id: 1, qtd: 2, status: 'ativo' }] });

  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'venda', qtd: 10, pesoMedio: 400, valorTotal: 5000, data: hoje,
  }, opcoes(client));

  assert.equal(resultado.ok, false, 'a validação local passou; quem barra é o FOR UPDATE do servidor');
  assert.match(resultado.erro, /excede o saldo do lote/);
  assert.equal(client.lotesServidor[0].qtd, 2, 'saldo do servidor inalterado — nada gravado pela metade');
  assert.equal(db.movimentacoes_animais.length, 0);
  assert.equal(db.movimentacoes_financeiras.length, 0);
  assert.equal(db.lotes[0].qtd, 50, 'o db local não foi mutado');
});

// ── 3. Morte válida reduz o lote sem criar receita ──────────────────────────

test('morte válida: reduz o lote e NUNCA cria lançamento financeiro', async () => {
  const db = makeDb({ lotes: [makeLote()], animais: [makeAnimal()] });
  const client = makeFakeClient();

  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'morte', qtd: 3, pesoMedio: 400, data: hoje,
  }, opcoes(client));

  assert.equal(resultado.ok, true);
  const proximo = resultado.aplicar(db);
  assert.equal(proximo.lotes.find((l) => l.id === 1).qtd, 47);
  assert.equal(proximo.animais.find((a) => a.id === 1).qtd, 47);
  assert.equal(proximo.movimentacoes_animais[0].tipo, 'morte');
  assert.equal(proximo.movimentacoes_financeiras.length, 0, 'morte não é receita');
  assert.equal(resultado.ids.financeiroId, null);
});

test('morte com valor informado por engano: o valor é descartado, sem receita', async () => {
  const db = makeDb({ lotes: [makeLote()], animais: [makeAnimal()] });
  const client = makeFakeClient();

  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'morte', qtd: 3, pesoMedio: 400, valorTotal: 9999, data: hoje,
  }, opcoes(client));

  assert.equal(client.chamadas[0].params.p_valor_total, 0, 'morte nunca leva valor à RPC');
  const proximo = resultado.aplicar(db);
  assert.equal(proximo.movimentacoes_financeiras.length, 0);
  assert.equal(proximo.movimentacoes_animais[0].valor_total, 0);
});

test('morte não é bloqueada por carência sanitária (carência só impede venda para abate)', async () => {
  const db = makeDb({
    lotes: [makeLote()],
    animais: [makeAnimal()],
    sanitario: [{ id: 1, lote_id: 1, desc: 'Ivermectina', data_fim_carencia: '2026-08-01' }],
  });
  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'morte', qtd: 1, pesoMedio: 400, data: hoje,
  }, opcoes(makeFakeClient()));
  assert.equal(resultado.ok, true);
});

test('venda é bloqueada durante a carência sanitária, antes de tocar no banco', async () => {
  const db = makeDb({
    lotes: [makeLote()],
    animais: [makeAnimal()],
    sanitario: [{ id: 1, lote_id: 1, desc: 'Ivermectina', data_fim_carencia: '2026-08-01' }],
  });
  const client = makeFakeClient();
  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'venda', qtd: 1, pesoMedio: 400, valorTotal: 1000, data: hoje,
  }, opcoes(client));

  assert.equal(resultado.ok, false);
  assert.match(resultado.erro, /carência.*abate.*01\/08\/2026/is);
  assert.equal(client.chamadas.length, 0);
});

// ── 4. Morte acima do saldo é rejeitada ─────────────────────────────────────

test('morte acima do saldo é rejeitada e não grava nada', async () => {
  const db = makeDb({ lotes: [makeLote({ qtd: 2 })], animais: [makeAnimal({ qtd: 2 })] });
  const client = makeFakeClient({ lotes: [{ id: 1, qtd: 2, status: 'ativo' }] });

  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'morte', qtd: 5, pesoMedio: 400, data: hoje,
  }, opcoes(client));

  assert.equal(resultado.ok, false);
  assert.match(resultado.erro, /Quantidade indispon[íi]vel/);
  assert.equal(client.lotesServidor[0].qtd, 2);
});

// ── 5. Falha da RPC não atualiza o estado local como concluído ──────────────

test('falha de rede na RPC: devolve erro amigável e nenhum `aplicar`', async () => {
  const db = makeDb({ lotes: [makeLote()], animais: [makeAnimal()] });
  const client = makeFakeClient({ falhaDeRede: new Error('Failed to fetch') });

  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'venda', qtd: 10, pesoMedio: 400, valorTotal: 15000, data: hoje,
  }, opcoes(client));

  assert.equal(resultado.ok, false);
  assert.match(resultado.erro, /conectar/i);
  assert.equal(resultado.aplicar, null);
  assert.equal(db.lotes[0].qtd, 50, 'estado local intocado');
  assert.equal(db.movimentacoes_animais.length, 0);
});

test('erro de permissão (RLS) na RPC vira mensagem de permissão, sem alterar o estado', async () => {
  const db = makeDb({ lotes: [makeLote()], animais: [makeAnimal()] });
  const client = makeFakeClient();
  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'venda', qtd: 1, pesoMedio: 400, valorTotal: 100, data: hoje,
  }, { session: { user: { id: 'outro-dono' } }, client, persist: false });

  assert.equal(resultado.ok, false);
  assert.match(resultado.erro, /não tem permissão/i);
  assert.equal(db.lotes[0].qtd, 50);
});

test('sem sessão ativa a RPC nem é chamada (owner obrigatório)', async () => {
  const db = makeDb({ lotes: [makeLote()], animais: [makeAnimal()] });
  const client = makeFakeClient();
  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'venda', qtd: 1, pesoMedio: 400, valorTotal: 100, data: hoje,
  }, { session: null, client, persist: false });

  assert.equal(resultado.ok, false);
  assert.equal(client.chamadas.length, 0);
});

// ── 6. Lote zerado permanece com qtd = 0 ────────────────────────────────────

test('venda total zera o lote e as linhas de animais, e o saldo para em 0 (nunca negativo)', async () => {
  const db = makeDb({ lotes: [makeLote({ qtd: 20 })], animais: [makeAnimal({ qtd: 20 })] });
  const client = makeFakeClient({ lotes: [{ id: 1, qtd: 20, status: 'ativo' }] });

  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'venda', qtd: 20, pesoMedio: 420, valorTotal: 30000, data: hoje,
  }, opcoes(client));

  const zerado = resultado.aplicar(db);
  assert.equal(zerado.lotes.find((l) => l.id === 1).qtd, 0);
  assert.equal(zerado.animais.find((a) => a.id === 1).qtd, 0);
  assert.equal(client.lotesServidor[0].qtd, 0);

  // Uma segunda saída no lote já zerado não passa nem localmente nem no servidor.
  const segunda = await registrarSaidaLoteTransacional(zerado, {
    loteId: 1, tipoSaida: 'morte', qtd: 1, pesoMedio: 420, data: hoje,
  }, opcoes(client));
  assert.equal(segunda.ok, false);
  assert.equal(client.lotesServidor[0].qtd, 0, 'continua 0, nunca -1');
});

test('venda total não finaliza o lote automaticamente (status preservado)', async () => {
  const db = makeDb({ lotes: [makeLote({ qtd: 20, status: 'ativo' })], animais: [makeAnimal({ qtd: 20 })] });
  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'venda', qtd: 20, pesoMedio: 420, valorTotal: 30000, data: hoje,
  }, opcoes(makeFakeClient({ lotes: [{ id: 1, qtd: 20, status: 'ativo' }] })));
  assert.equal(resultado.aplicar(db).lotes.find((l) => l.id === 1).status, 'ativo');
});

// ── 7. Lote encerrado não aceita nova saída ─────────────────────────────────

test('lote encerrado é recusado localmente, sem chamar a RPC', async () => {
  const db = makeDb({ lotes: [makeLote({ status: 'encerrado' })], animais: [makeAnimal()] });
  const client = makeFakeClient();
  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'venda', qtd: 1, pesoMedio: 400, valorTotal: 100, data: hoje,
  }, opcoes(client));

  assert.equal(resultado.ok, false);
  assert.match(resultado.erro, /finalizado/i);
  assert.equal(client.chamadas.length, 0);
});

test('lote vendido é recusado também quando só o servidor sabe do encerramento', async () => {
  const db = makeDb({ lotes: [makeLote({ status: 'ativo' })], animais: [makeAnimal()] });
  const client = makeFakeClient({ lotes: [{ id: 1, qtd: 50, status: 'vendido' }] });
  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'morte', qtd: 1, pesoMedio: 400, data: hoje,
  }, opcoes(client));

  assert.equal(resultado.ok, false);
  assert.match(resultado.erro, /finalizado/i);
  assert.equal(client.lotesServidor[0].qtd, 50);
});

// ── 8. O resultado financeiro não duplica após recarregar a página ──────────

test('o estado local usa os ids devolvidos pela RPC — recarregar não duplica a receita', async () => {
  const db = makeDb({ lotes: [makeLote()], animais: [makeAnimal()] });
  const client = makeFakeClient();

  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'venda', qtd: 10, pesoMedio: 420, valorTotal: 15000, data: hoje,
  }, opcoes(client));

  const proximo = resultado.aplicar(db);
  const movimentacao = proximo.movimentacoes_animais[0];
  const receita = proximo.movimentacoes_financeiras[0];

  assert.equal(movimentacao.id, resultado.ids.movimentacaoId);
  assert.equal(receita.id, resultado.ids.financeiroId);
  assert.ok(Number.isFinite(receita.id), 'id veio do banco, não de gerarNovoId local');

  // "Recarregar a página" = descartar o estado local e reler o que o banco tem.
  // Como as linhas locais carregam os ids reais, o recarregado é idêntico:
  // uma movimentação e uma receita, e a receita somada uma única vez.
  const recarregado = {
    ...proximo,
    movimentacoes_animais: [{ ...movimentacao }],
    movimentacoes_financeiras: [{ ...receita }],
  };
  const somaReceitas = (base) => base.movimentacoes_financeiras
    .filter((m) => m.tipo === 'receita')
    .reduce((total, m) => total + m.valor, 0);

  assert.equal(somaReceitas(recarregado), somaReceitas(proximo));
  assert.equal(somaReceitas(recarregado), 15000, 'a venda entra no resultado uma vez só');
  assert.equal(recarregado.movimentacoes_financeiras.length, 1);
});

test('duas vendas seguidas geram ids distintos e somam sem se sobrescrever', async () => {
  const db = makeDb({ lotes: [makeLote()], animais: [makeAnimal()] });
  const client = makeFakeClient();

  const primeira = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'venda', qtd: 5, pesoMedio: 400, valorTotal: 7000, data: hoje,
  }, opcoes(client));
  const depoisDaPrimeira = primeira.aplicar(db);

  const segunda = await registrarSaidaLoteTransacional(depoisDaPrimeira, {
    loteId: 1, tipoSaida: 'venda', qtd: 5, pesoMedio: 400, valorTotal: 8000, data: hoje,
  }, opcoes(client));
  const depoisDaSegunda = segunda.aplicar(depoisDaPrimeira);

  assert.notEqual(primeira.ids.financeiroId, segunda.ids.financeiroId);
  assert.equal(depoisDaSegunda.movimentacoes_financeiras.length, 2);
  assert.equal(depoisDaSegunda.lotes.find((l) => l.id === 1).qtd, 40);
  const total = depoisDaSegunda.movimentacoes_financeiras.reduce((s, m) => s + m.valor, 0);
  assert.equal(total, 15000);
});

// ── Espelho fiel do que a transação gravou ──────────────────────────────────

test('o peso médio do lote NÃO é recalculado — mesma regra da RPC e do bot', async () => {
  // Divergência aceita e medida na Sprint 3: o caminho antigo do web
  // recalculava `p_at` da origem; a RPC não toca nele. Mantemos o local igual
  // ao servidor para que recarregar a página não mude o número na tela.
  const db = makeDb({ lotes: [makeLote({ p_at: 400 })], animais: [makeAnimal({ p_at: 400 })] });
  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'venda', qtd: 10, pesoMedio: 480, valorTotal: 20000, data: hoje,
  }, opcoes(makeFakeClient()));

  const proximo = resultado.aplicar(db);
  assert.equal(proximo.lotes.find((l) => l.id === 1).p_at, 400);
  assert.equal(proximo.animais.find((a) => a.id === 1).p_at, 400);
});

test('registro individual nunca é decrementado pela saída do grupo', async () => {
  const db = makeDb({
    lotes: [makeLote({ qtd: 51 })],
    animais: [
      makeAnimal({ id: 1, qtd: 50 }),
      { id: 2, lote_id: 1, qtd: 1, p_at: 410, tipo_registro: 'individual', identificacao: 'Brinco 42' },
    ],
  });
  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'venda', qtd: 10, pesoMedio: 400, valorTotal: 15000, data: hoje,
  }, opcoes(makeFakeClient({ lotes: [{ id: 1, qtd: 51, status: 'ativo' }] })));

  const proximo = resultado.aplicar(db);
  assert.equal(proximo.animais.find((a) => a.id === 1).qtd, 41, 'a linha grupo absorve a baixa');
  assert.equal(proximo.animais.find((a) => a.id === 2).qtd, 1, 'o individual fica intocado');
});

test('a movimentação registrada espelha o que foi enviado à RPC', async () => {
  const db = makeDb({ lotes: [makeLote()], animais: [makeAnimal()] });
  const client = makeFakeClient();
  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'venda', qtd: 4, pesoMedio: 430, valorTotal: 6000, data: hoje, comprador: 'Frigorífico X',
  }, opcoes(client));

  const movimentacao = resultado.aplicar(db).movimentacoes_animais[0];
  const { params } = client.chamadas[0];
  assert.equal(movimentacao.qtd, params.p_qtd);
  assert.equal(movimentacao.peso_medio, params.p_peso_medio);
  assert.equal(movimentacao.valor_total, params.p_valor_total);
  assert.equal(movimentacao.comprador_fornecedor, params.p_comprador_fornecedor);
  assert.equal(movimentacao.data, params.p_data);
  assert.equal(movimentacao.obs, params.p_obs);
});

test('a descrição da receita acompanha a observação enviada (a RPC grava descricao = p_obs)', async () => {
  const db = makeDb({ lotes: [makeLote()], animais: [makeAnimal()] });
  const client = makeFakeClient();
  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'venda', qtd: 4, pesoMedio: 430, valorTotal: 6000, data: hoje, observacao: 'Lote 3 do caminhão',
  }, opcoes(client));

  const proximo = resultado.aplicar(db);
  assert.equal(client.chamadas[0].params.p_obs, 'Lote 3 do caminhão');
  assert.equal(proximo.movimentacoes_financeiras[0].descricao, 'Lote 3 do caminhão');
});

test('sem observação, a receita recebe a descrição padrão do fluxo', async () => {
  const db = makeDb({ lotes: [makeLote()], animais: [makeAnimal()] });
  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'venda', qtd: 4, pesoMedio: 430, valorTotal: 6000, data: hoje,
  }, opcoes(makeFakeClient()));

  assert.equal(resultado.aplicar(db).movimentacoes_financeiras[0].descricao, 'Venda de 4 animal(is) do lote 1');
});

test('a saída fica registrada na auditoria com a criticidade certa', async () => {
  const db = makeDb({ lotes: [makeLote()], animais: [makeAnimal()] });
  const venda = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'venda', qtd: 2, pesoMedio: 400, valorTotal: 3000, data: hoje,
  }, opcoes(makeFakeClient()));
  const morte = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'morte', qtd: 2, pesoMedio: 400, data: hoje,
  }, opcoes(makeFakeClient()));

  assert.equal(venda.aplicar(db).auditoria.at(-1).criticidade, 'media');
  assert.equal(morte.aplicar(db).auditoria.at(-1).criticidade, 'alta');
  assert.equal(venda.aplicar(db).auditoria.at(-1).acao, 'saida_animal');
});

// ── 9. Transferência (P1-02) — mesmo caminho transacional do Telegram ──────

const makeLoteDestino = (o = {}) => ({ id: 2, nome: 'Lote B', qtd: 20, p_at: 350, status: 'ativo', ...o });
const makeAnimalDestino = (o = {}) => ({ id: 2, lote_id: 2, qtd: 20, p_at: 350, ...o });

test('transferência válida: decrementa a origem, incrementa o destino e sincroniza os dois grupos de animais', async () => {
  const db = makeDb({
    lotes: [makeLote(), makeLoteDestino()],
    animais: [makeAnimal(), makeAnimalDestino()],
  });
  const client = makeFakeClient({ lotes: [{ id: 1, qtd: 50, status: 'ativo' }, { id: 2, qtd: 20, status: 'ativo' }] });

  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'transferencia_saida', qtd: 10, pesoMedio: 400, data: hoje, destinoLoteId: 2,
  }, opcoes(client));

  assert.equal(resultado.ok, true);
  assert.equal(client.chamadas[0].params.p_destino_lote_id, 2);
  assert.equal(client.lotesServidor[0].qtd, 40, 'origem decrementada no servidor');
  assert.equal(client.lotesServidor[1].qtd, 30, 'destino incrementado no servidor');

  const proximo = resultado.aplicar(db);
  assert.equal(proximo.lotes.find((l) => l.id === 1).qtd, 40);
  assert.equal(proximo.lotes.find((l) => l.id === 2).qtd, 30);
  assert.equal(proximo.animais.find((a) => a.id === 1).qtd, 40, 'grupo da origem acompanha a baixa');
  assert.equal(proximo.animais.find((a) => a.id === 2).qtd, 30, 'grupo do destino acompanha a alta');
  // Reponderação do destino: (20×350 + 10×400) / 30.
  assert.equal(proximo.lotes.find((l) => l.id === 2).p_at, (20 * 350 + 10 * 400) / 30);
  assert.equal(proximo.lotes.find((l) => l.id === 1).p_at, 400, 'peso médio da origem não é recalculado (mesma regra da venda/morte)');
});

test('transferência: a movimentação registrada aponta o lote de destino e nunca gera receita', async () => {
  const db = makeDb({ lotes: [makeLote(), makeLoteDestino()], animais: [makeAnimal(), makeAnimalDestino()] });
  const client = makeFakeClient({ lotes: [{ id: 1, qtd: 50, status: 'ativo' }, { id: 2, qtd: 20, status: 'ativo' }] });

  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'transferencia_saida', qtd: 10, pesoMedio: 400, data: hoje, destinoLoteId: 2, valorTotal: 9999,
  }, opcoes(client));

  assert.equal(client.chamadas[0].params.p_valor_total, 0, 'transferência nunca leva valor à RPC, mesmo informado por engano');
  const proximo = resultado.aplicar(db);
  assert.equal(proximo.movimentacoes_animais[0].destino_lote_id, 2);
  assert.equal(proximo.movimentacoes_financeiras.length, 0, 'transferência não é receita nem despesa');
  assert.equal(resultado.ids.financeiroId, null);
});

test('transferência acima do saldo da origem é rejeitada e não grava nada', async () => {
  const db = makeDb({ lotes: [makeLote({ qtd: 5 }), makeLoteDestino()], animais: [makeAnimal({ qtd: 5 }), makeAnimalDestino()] });
  const client = makeFakeClient({ lotes: [{ id: 1, qtd: 5, status: 'ativo' }, { id: 2, qtd: 20, status: 'ativo' }] });

  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'transferencia_saida', qtd: 10, pesoMedio: 400, data: hoje, destinoLoteId: 2,
  }, opcoes(client));

  assert.equal(resultado.ok, false);
  assert.match(resultado.erro, /Quantidade indispon[íi]vel/);
  assert.equal(client.chamadas.length, 0, 'barrada localmente, sem nem chamar a RPC');
  assert.equal(client.lotesServidor[0].qtd, 5);
  assert.equal(client.lotesServidor[1].qtd, 20);
});

test('lote de origem encerrado recusa a transferência localmente', async () => {
  const db = makeDb({ lotes: [makeLote({ status: 'encerrado' }), makeLoteDestino()], animais: [makeAnimal(), makeAnimalDestino()] });
  const client = makeFakeClient({ lotes: [{ id: 1, qtd: 50, status: 'encerrado' }, { id: 2, qtd: 20, status: 'ativo' }] });

  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'transferencia_saida', qtd: 5, pesoMedio: 400, data: hoje, destinoLoteId: 2,
  }, opcoes(client));

  assert.equal(resultado.ok, false);
  assert.match(resultado.erro, /finalizado/i);
  assert.equal(client.chamadas.length, 0);
});

test('lote de destino inexistente recusa a transferência localmente', async () => {
  const db = makeDb({ lotes: [makeLote()], animais: [makeAnimal()] });
  const client = makeFakeClient();

  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'transferencia_saida', qtd: 5, pesoMedio: 400, data: hoje, destinoLoteId: 999,
  }, opcoes(client));

  assert.equal(resultado.ok, false);
  assert.match(resultado.erro, /destino.*999.*não encontrado/i);
  assert.equal(client.chamadas.length, 0);
});

test('lote de destino encerrado recusa a transferência localmente', async () => {
  const db = makeDb({ lotes: [makeLote(), makeLoteDestino({ status: 'vendido' })], animais: [makeAnimal(), makeAnimalDestino()] });
  const client = makeFakeClient();

  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'transferencia_saida', qtd: 5, pesoMedio: 400, data: hoje, destinoLoteId: 2,
  }, opcoes(client));

  assert.equal(resultado.ok, false);
  assert.match(resultado.erro, /destino está finalizado/i);
  assert.equal(client.chamadas.length, 0);
});

test('origem e destino iguais são rejeitados localmente', async () => {
  const db = makeDb({ lotes: [makeLote()], animais: [makeAnimal()] });
  const client = makeFakeClient();

  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'transferencia_saida', qtd: 5, pesoMedio: 400, data: hoje, destinoLoteId: 1,
  }, opcoes(client));

  assert.equal(resultado.ok, false);
  assert.match(resultado.erro, /origem e destino devem ser diferentes/i);
  assert.equal(client.chamadas.length, 0);
});

test('falha de rede na transferência: nenhum aplicar, estado local intocado', async () => {
  const db = makeDb({ lotes: [makeLote(), makeLoteDestino()], animais: [makeAnimal(), makeAnimalDestino()] });
  const client = makeFakeClient({ falhaDeRede: new Error('Failed to fetch') });

  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'transferencia_saida', qtd: 10, pesoMedio: 400, data: hoje, destinoLoteId: 2,
  }, opcoes(client));

  assert.equal(resultado.ok, false);
  assert.equal(resultado.aplicar, null);
  assert.equal(db.lotes[0].qtd, 50, 'origem intocada');
  assert.equal(db.lotes[1].qtd, 20, 'destino intocado');
  assert.equal(db.movimentacoes_animais.length, 0);
});

test('duas transferências concorrentes não ultrapassam o saldo: o navegador estava desatualizado e o servidor recusa', async () => {
  // Outra aba já transferiu 48 das 50 cabeças; este `db` ainda mostra 50.
  const db = makeDb({ lotes: [makeLote({ qtd: 50 }), makeLoteDestino()], animais: [makeAnimal({ qtd: 50 }), makeAnimalDestino()] });
  const client = makeFakeClient({ lotes: [{ id: 1, qtd: 2, status: 'ativo' }, { id: 2, qtd: 68, status: 'ativo' }] });

  const resultado = await registrarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'transferencia_saida', qtd: 10, pesoMedio: 400, data: hoje, destinoLoteId: 2,
  }, opcoes(client));

  assert.equal(resultado.ok, false, 'a validação local passou; quem barra é o FOR UPDATE do servidor');
  assert.match(resultado.erro, /excede o saldo do lote/);
  assert.equal(client.lotesServidor[0].qtd, 2, 'origem inalterada no servidor');
  assert.equal(client.lotesServidor[1].qtd, 68, 'destino inalterado no servidor — nada gravado pela metade');
  assert.equal(db.lotes[0].qtd, 50, 'o db local não foi mutado');
  assert.equal(db.lotes[1].qtd, 20, 'o db local não foi mutado');
});

// ── Plano local (validações de formulário) ──────────────────────────────────

test('planejarSaidaLoteTransacional recusa entradas inválidas antes de qualquer I/O', () => {
  const db = makeDb({ lotes: [makeLote()], animais: [makeAnimal()] });
  const base = { loteId: 1, tipoSaida: 'venda', qtd: 5, pesoMedio: 400, valorTotal: 1000, data: hoje };

  assert.match(planejarSaidaLoteTransacional(db, { ...base, data: '' }).erro, /Data é obrigatória/);
  assert.match(planejarSaidaLoteTransacional(db, { ...base, qtd: 0 }).erro, /quantidade/i);
  assert.match(planejarSaidaLoteTransacional(db, { ...base, qtd: -3 }).erro, /quantidade/i);
  assert.match(planejarSaidaLoteTransacional(db, { ...base, pesoMedio: 0 }).erro, /peso médio/i);
  assert.match(planejarSaidaLoteTransacional(db, { ...base, loteId: 999 }).erro, /não encontrado/i);
  assert.match(planejarSaidaLoteTransacional(db, { ...base, tipoSaida: 'transferencia_saida' }).erro, /lote de destino/i);
});

test('planejarSaidaLoteTransacional usa lote.qtd como saldo canônico, não animais.qtd desatualizado', () => {
  // Ajuste de lotação baixou lote.qtd para 40; animais.qtd ficou em 50.
  const db = makeDb({ lotes: [makeLote({ qtd: 40 })], animais: [makeAnimal({ qtd: 50 })] });
  assert.match(planejarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'venda', qtd: 45, pesoMedio: 400, valorTotal: 1000, data: hoje,
  }).erro, /Quantidade indispon[íi]vel/);

  const plano = planejarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'venda', qtd: 40, pesoMedio: 400, valorTotal: 12000, data: hoje,
  });
  assert.equal(plano.ok, true);
  assert.equal(plano.contexto.saldoFinal, 0);
});

test('lote legado sem lote.qtd cai para a soma de animais.qtd', () => {
  const db = makeDb({ lotes: [makeLote({ qtd: undefined })], animais: [makeAnimal({ qtd: 50 })] });
  const plano = planejarSaidaLoteTransacional(db, {
    loteId: 1, tipoSaida: 'morte', qtd: 10, pesoMedio: 400, data: hoje,
  });
  assert.equal(plano.ok, true);
  assert.equal(plano.contexto.saldoFinal, 40);
});
