// Cadastro de manejo sanitário via linguagem natural (bot operacional
// determinístico). Puro, sem I/O. Mesma tabela/campos de `sanitario` já
// usada por `SanitarioPage.jsx::salvarItem` (base + tipo/desc + metadata).
//
// ponytail: a baixa de estoque reaproveita `calcularBaixaSanitaria`
// (`domain/estoqueSanidade.js`, Sprint 15) em vez de reimplementar a regra —
// mesma fórmula usada pelo app. Também mesma política do app (ver
// `services/estoqueSanidade.js::aplicarMovimentoEstoqueSanidade`): saldo
// insuficiente NÃO bloqueia o manejo — só pula a baixa de estoque e avisa.
import { resolverLotePorNome, normalizarChave } from './resolvedores.js';
import { calcularBaixaSanitaria } from '../estoqueSanidade.js';
import { hojeLocalISO } from '../dataCivil.js';
import { addDaysToDate } from '../calcHelpers.js';

const erro = (codigo, extra = {}) => ({ ok: false, erro: codigo, ...extra });

const TIPO_ALIASES = {
  vacina: 'vacina', vacinacao: 'vacina', vacinar: 'vacina', vacinado: 'vacina', vacinei: 'vacina',
  vermifugo: 'vermifugo', vermifugacao: 'vermifugo', vermifugar: 'vermifugo',
  tratamento: 'tratamento', tratar: 'tratamento',
};

function tipoCanonico(bruto) {
  const chave = normalizarChave(bruto);
  for (const [alias, canonico] of Object.entries(TIPO_ALIASES)) {
    if (chave.includes(alias)) return canonico;
  }
  return chave || 'outro';
}

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
 * @param {object} dados — { lote, tipo, quantidade_animais, produto?, quantidade_produto?, data?, proxima?, carencia_dias?, obs? }
 */
export function prepararCadastroManejo(db, dados) {
  const rl = resolverLotePorNome(db?.lotes, dados?.lote, { somenteAtivos: true });
  if (rl.status === 'ambiguo') return erro('LOTE_AMBIGUO', { candidatos: rl.candidatos });
  if (rl.status !== 'ok') return erro('LOTE_NAO_ENCONTRADO');
  const lote = rl.lote;

  const tipo = tipoCanonico(dados?.tipo);
  const quantidadeAnimais = Number(dados?.quantidade_animais);
  if (!Number.isInteger(quantidadeAnimais) || quantidadeAnimais <= 0) return erro('QUANTIDADE_INVALIDA');

  const dataFinal = dados?.data || hojeLocalISO();
  const carenciaDias = Number(dados?.carencia_dias) || 0;

  let produtoId = null;
  let produtoNome = null;
  let quantidadeProduto = 0;
  let avisoEstoque = null;
  const writes = [];

  if (dados?.produto) {
    const ri = resolverItemEstoquePorNome(db?.estoque, dados.produto);
    if (ri.status === 'ambiguo') return erro('ITEM_AMBIGUO', { candidatos: ri.candidatos.map((e) => ({ nome: e.produto || e.nome })) });
    if (ri.status !== 'ok') return erro('ITEM_NAO_ENCONTRADO');
    const item = ri.item;
    produtoId = item.id;
    produtoNome = item.produto || item.nome;
    quantidadeProduto = Number(dados?.quantidade_produto) || 0;

    if (quantidadeProduto > 0) {
      const saldoAtual = Number(item.quantidade_atual ?? item.quantidade ?? 0);
      const calculo = calcularBaixaSanitaria({ quantidadeAplicada: quantidadeProduto, quantidadeAnterior: 0, saldoAtual });
      if (calculo.podeBaixar) {
        writes.push({
          tabela: 'estoque', tipo: 'update', match: { id: produtoId },
          patch: { quantidade_atual: calculo.saldoProjetado, quantidade: calculo.saldoProjetado },
        });
        writes.push({
          tabela: 'movimentacoes_estoque',
          tipo: 'insert',
          registro: {
            item_estoque_id: produtoId,
            lote_id: lote.id,
            tipo: 'consumo',
            quantidade: quantidadeProduto,
            data: dataFinal,
            origem: 'sanidade',
            origem_tipo: 'sanitario',
            obs: 'Baixa automática por aplicação sanitária (Telegram).',
          },
        });
      } else {
        avisoEstoque = `Estoque insuficiente para ${produtoNome} — o manejo será registrado, mas o estoque não será baixado.`;
      }
    }
  }

  writes.unshift({
    tabela: 'sanitario',
    tipo: 'insert',
    registro: {
      lote_id: lote.id,
      data_aplic: dataFinal,
      proxima: dados?.proxima || null,
      alerta_dias_antes: null,
      data_fim_carencia: carenciaDias > 0 ? addDaysToDate(dataFinal, carenciaDias) : null,
      qtd: quantidadeAnimais,
      obs: dados?.obs || '',
      funcionario_responsavel_id: null,
      tipo,
      desc: dados?.obs || tipo,
      metadata: {
        item_estoque_id: produtoId,
        quantidade_utilizada: quantidadeProduto > 0 ? quantidadeProduto : null,
      },
      origem: 'telegram',
    },
  });

  return {
    ok: true,
    resumo: [
      'Confirme o manejo sanitário:',
      '',
      `Lote: ${lote.nome}`,
      `Tipo: ${tipo}`,
      `Animais tratados: ${quantidadeAnimais}`,
      produtoNome ? `Produto: ${produtoNome}` : null,
      quantidadeProduto > 0 ? `Quantidade utilizada: ${quantidadeProduto}` : null,
      `Data: ${dataFinal}`,
      avisoEstoque,
    ].filter(Boolean),
    writes,
  };
}
