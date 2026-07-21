// Saída/baixa de estoque via linguagem natural (bot operacional determinístico). Puro, sem I/O.
//
// ponytail: espelha `registrarSaidaEstoque` (src/services/movimentacoes.js)
// em vez de importar de lá, porque aquele arquivo é escrito contra o cliente
// Supabase do navegador (sessão do usuário) e este orquestrador roda com o
// cliente de service role do webhook — os dois nunca podem compartilhar a
// mesma função de I/O. Se um dia isso for extraído para um helper puro
// compartilhado, ambos devem importar dali. Cobertura de paridade nos testes.
import { normalizarChave, resolverLotePorNome } from './resolvedores.js';
import { hojeLocalISO } from '../dataCivil.js';
// Sprint 5: saldo e custo unitário passam a vir da fonte canônica de Estoque.
// É exatamente o "helper puro compartilhado" previsto na nota acima —
// `domain/estoque.js` não faz I/O, então serve ao navegador e ao webhook sem
// arrastar cliente Supabase nenhum. Era a última leitura paralela de saldo
// deste domínio.
import { obterCustoUnitarioItem, obterSaldoItemEstoque } from '../estoque.js';

const erro = (codigo, extra = {}) => ({ ok: false, erro: codigo, ...extra });

const TIPOS_VALIDOS = ['consumo', 'ajuste', 'perda', 'venda'];

function resolverItemEstoquePorNome(estoque, nome) {
  const lista = Array.isArray(estoque) ? estoque : [];
  const alvo = normalizarChave(nome);
  if (!alvo) return { status: 'nao_encontrado', candidatos: [] };
  const achados = lista.filter((e) => normalizarChave(e.produto || e.nome).includes(alvo));
  if (achados.length === 0) return { status: 'nao_encontrado', candidatos: [] };
  if (achados.length > 1) return { status: 'ambiguo', candidatos: achados };
  return { status: 'ok', item: achados[0] };
}

/**
 * @param {object} db — já recortado pela fazenda ativa da conexão.
 * @param {object} dados — { item, quantidade, tipo?, lote?, data?, obs? }
 */
export function prepararSaidaEstoque(db, dados) {
  const item = String(dados?.item || '').trim();
  if (!item) return erro('ITEM_VAZIO');
  const quantidade = Number(dados?.quantidade);
  if (!(quantidade > 0)) return erro('QUANTIDADE_INVALIDA');

  const r = resolverItemEstoquePorNome(db.estoque, item);
  if (r.status === 'ambiguo') return erro('ITEM_AMBIGUO', { candidatos: r.candidatos.map((e) => ({ nome: e.produto || e.nome })) });
  if (r.status !== 'ok') return erro('ITEM_NAO_ENCONTRADO');

  const registro = r.item;
  const saldoAtual = obterSaldoItemEstoque(registro);
  if (quantidade > saldoAtual) return erro('SALDO_INSUFICIENTE', { saldoAtual, unidade: registro.unidade || registro.unidade_medida || '' });

  const tipo = TIPOS_VALIDOS.includes(dados?.tipo) ? dados.tipo : 'consumo';

  let loteId = null;
  let loteNome = null;
  if (dados?.lote) {
    const rl = resolverLotePorNome(db.lotes, dados.lote, { somenteAtivos: true });
    if (rl.status === 'ambiguo') return erro('LOTE_AMBIGUO', { candidatos: rl.candidatos });
    if (rl.status !== 'ok') return erro('LOTE_NAO_ENCONTRADO');
    loteId = rl.lote.id;
    loteNome = rl.lote.nome;
  }

  const dataFinal = dados?.data || hojeLocalISO();
  const custoUnit = obterCustoUnitarioItem(registro);
  const valorTotalSaida = quantidade * custoUnit;
  const novoSaldo = saldoAtual - quantidade;

  const writes = [
    {
      tabela: 'movimentacoes_estoque',
      tipo: 'insert',
      registro: {
        item_estoque_id: registro.id,
        lote_id: loteId,
        tipo,
        quantidade,
        custo_unitario: custoUnit,
        valor_total: valorTotalSaida,
        data: dataFinal,
        obs: dados?.obs || 'Saída via Telegram',
        origem: 'telegram',
      },
    },
    // `quantidade` acompanha `quantidade_atual` — mesma correção do app web:
    // atualizar só uma das colunas espelho fazia as telas divergirem.
    { tabela: 'estoque', tipo: 'update', match: { id: registro.id }, patch: { quantidade_atual: novoSaldo, quantidade: novoSaldo } },
  ];

  // Mesma regra de `registrarSaidaEstoque`: consumo vinculado a lote vira
  // despesa; venda vira receita — sem isso a saída fica sem rastro financeiro.
  if (tipo === 'consumo' && loteId) {
    writes.push({
      tabela: 'movimentacoes_financeiras',
      tipo: 'insert',
      registro: {
        tipo: 'despesa',
        categoria: 'consumo_estoque',
        lote_id: loteId,
        valor: valorTotalSaida,
        data: dataFinal,
        data_competencia: dataFinal,
        status: 'realizado',
        descricao: `Consumo de ${registro.produto || registro.nome} para o lote ${loteNome || loteId}`,
        origem_tipo: 'movimentacao_estoque',
        origem: 'telegram',
      },
    });
  } else if (tipo === 'venda') {
    writes.push({
      tabela: 'movimentacoes_financeiras',
      tipo: 'insert',
      registro: {
        tipo: 'receita',
        categoria: 'venda_estoque',
        lote_id: loteId || null,
        valor: valorTotalSaida,
        data: dataFinal,
        data_competencia: dataFinal,
        status: 'realizado',
        descricao: `Venda de ${registro.produto || registro.nome}`,
        origem_tipo: 'movimentacao_estoque',
        origem: 'telegram',
      },
    });
  }

  return {
    ok: true,
    resumo: [
      'Confirme a saída de estoque:',
      '',
      `Item: ${registro.produto || registro.nome}`,
      `Tipo: ${tipo}`,
      `Quantidade: -${quantidade} ${registro.unidade || registro.unidade_medida || ''}`.trim(),
      `Novo saldo: ${novoSaldo}`,
      loteNome ? `Lote: ${loteNome}` : null,
      `Data: ${dataFinal}`,
    ].filter(Boolean),
    writes,
  };
}
