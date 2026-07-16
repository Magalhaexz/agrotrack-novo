// Ações mutáveis de lote, PURAS, para o Bot do Telegram (Partes 12, 13, 14).
// Não fazem I/O: validam e calculam o novo estado + um "plano de escrita" que o
// webhook aplica com o admin client. Recebem IDs já resolvidos (o webhook
// resolve nome→lote e trata ambiguidade antes de chamar aqui).
//
// ponytail: a regra agregada (média ponderada, decrementa origem / incrementa
// destino, cria movimentacoes_animais) espelha `src/services/movimentacoes.js`
// (registrarSaidaAnimal com tipo 'transferencia_saida') — a fonte de verdade do
// app. Não é reescrita: é a mesma fórmula, sem o acoplamento à persistência do
// browser. Se algum dia extrair a fórmula para um helper único compartilhado,
// os dois passam a importar dele; até lá, os testes garantem paridade.
import { toNumber } from '../calcHelpers.js';
import { normalizarChave } from './resolvedores.js';
import { hojeLocalISO } from '../dataCivil.js';

function loteAtivo(lote) {
  return String(lote?.status || 'ativo').toLowerCase() !== 'encerrado';
}

/**
 * Quantidade e peso médio atuais de um lote. Peso médio: linhas de `animais`
 * do lote (mesma base do `calcLote`), com fallback para `lote.p_at`. Quantidade:
 * segue `lote.qtd` quando definido — mesma fonte canônica de
 * `services/movimentacoes.js::obterResumoLote` (Seção 8 do sprint de
 * fechamento). Sem isso, um Ajuste de lotação (que só atualiza `lote.qtd`,
 * nunca `animais.qtd`) ficava invisível aqui: o bot podia validar/mover uma
 * quantidade maior que o saldo real usando a soma desatualizada de `animais`.
 */
function resumoAgregado(db, lote) {
  const animais = (Array.isArray(db?.animais) ? db.animais : []).filter((a) => Number(a.lote_id) === Number(lote.id));
  const qtdRegistrada = animais.reduce((s, a) => s + toNumber(a.qtd), 0);
  const peso = qtdRegistrada
    ? animais.reduce((s, a) => s + toNumber(a.p_at) * toNumber(a.qtd), 0) / qtdRegistrada
    : toNumber(lote.p_at ?? lote.peso_medio_atual);
  const qtd = lote?.qtd != null ? toNumber(lote.qtd) : qtdRegistrada;
  return { qtd, peso };
}

const erro = (codigo) => ({ ok: false, erro: codigo });

/**
 * Prepara a transferência agregada de animais entre dois lotes da mesma fazenda.
 * Puro: não altera nada. Devolve `{ ok, resumo, writes }` ou `{ ok:false, erro }`.
 * @param {object} db db recortado pela fazenda ativa.
 * @param {{ loteOrigemId, loteDestinoId, quantidade }} params
 */
export function prepararTransferenciaAnimais(db, { loteOrigemId, loteDestinoId, quantidade }) {
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const origem = lotes.find((l) => Number(l.id) === Number(loteOrigemId));
  const destino = lotes.find((l) => Number(l.id) === Number(loteDestinoId));

  if (!origem) return erro('LOTE_ORIGEM_NAO_ENCONTRADO');
  if (!destino) return erro('LOTE_DESTINO_NAO_ENCONTRADO');
  if (Number(origem.id) === Number(destino.id)) return erro('MESMO_LOTE');
  if (!loteAtivo(origem) || !loteAtivo(destino)) return erro('LOTE_INATIVO');

  const qtd = Number(quantidade);
  if (!Number.isInteger(qtd) || qtd <= 0) return erro('QUANTIDADE_INVALIDA');

  const resumoOrigem = resumoAgregado(db, origem);
  const resumoDestino = resumoAgregado(db, destino);
  if (qtd > resumoOrigem.qtd) return erro('ANIMAIS_INSUFICIENTES');

  const pesoTransferido = resumoOrigem.peso; // animais saem com a média da origem
  const origemQtdFinal = resumoOrigem.qtd - qtd;
  // Remover à média não muda a média da origem; mantém o peso quando ainda há animais.
  const origemPesoFinal = origemQtdFinal > 0 ? resumoOrigem.peso : 0;
  const destinoQtdFinal = resumoDestino.qtd + qtd;
  const destinoPesoFinal = destinoQtdFinal
    ? (resumoDestino.qtd * resumoDestino.peso + qtd * pesoTransferido) / destinoQtdFinal
    : pesoTransferido;

  return {
    ok: true,
    resumo: {
      origemNome: origem.nome,
      destinoNome: destino.nome,
      quantidade: qtd,
      origemQtdFinal,
      destinoQtdFinal,
    },
    writes: {
      movimentacaoAnimal: {
        lote_id: Number(origem.id),
        destino_lote_id: Number(destino.id),
        lote_destino: destino.nome,
        tipo: 'transferencia_saida',
        qtd,
        peso_medio: pesoTransferido,
        valor_total: 0,
        origem: 'telegram',
      },
      loteOrigem: { id: Number(origem.id), qtd: origemQtdFinal, p_at: origemPesoFinal },
      loteDestino: { id: Number(destino.id), qtd: destinoQtdFinal, p_at: destinoPesoFinal },
    },
  };
}

/**
 * Prepara a renomeação de um lote (Parte 14). Preserva o ID; não cria lote novo.
 * @param {object} db db recortado pela fazenda ativa.
 * @param {{ loteId, novoNome }} params
 */
export function prepararRenomearLote(db, { loteId, novoNome }) {
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const lote = lotes.find((l) => Number(l.id) === Number(loteId));
  if (!lote) return erro('LOTE_NAO_ENCONTRADO');

  const nome = String(novoNome || '').trim();
  if (!nome) return erro('NOME_VAZIO');

  const chaveNova = normalizarChave(nome);
  if (chaveNova === normalizarChave(lote.nome)) return erro('NOME_IGUAL');

  const duplicado = lotes.some((l) => Number(l.id) !== Number(lote.id)
    && loteAtivo(l)
    && normalizarChave(l.nome) === chaveNova);
  if (duplicado) return erro('NOME_DUPLICADO');

  return {
    ok: true,
    resumo: { nomeAnterior: lote.nome, nomeNovo: nome },
    writes: { loteUpdate: { id: Number(lote.id), nome } },
  };
}

// ── Venda / morte via linguagem natural (bot operacional determinístico) ────
// Puro, sem I/O. Diferente das duas funções acima (transferência/renomeação,
// que usam o objeto `writes` bespoke executado por `executarTransferencia`/
// `executarRenomear` em `_telegramBot.js`): estas seguem o padrão em ARRAY de
// `acoesEstoque.js`/`acoesPasto.js`, consumido pelo motor de cadastro
// genérico (`cadastros.js` + `aplicarWrites`).
//
// ponytail: mesma fórmula de `registrarSaidaAnimal` (src/services/
// movimentacoes.js) — peso médio da origem não muda ao retirar a média;
// venda/abate geram receita, morte não. Ver nota no topo do arquivo sobre
// por que é espelhada e não importada.
function prepararSaidaLote(db, { loteId, quantidade, valor, data, motivo, obs }, { tipoSaida }) {
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const lote = lotes.find((l) => Number(l.id) === Number(loteId));
  if (!lote) return erro('LOTE_NAO_ENCONTRADO');
  if (!loteAtivo(lote)) return erro('LOTE_BLOQUEADO');

  const qtd = Number(quantidade);
  if (!Number.isInteger(qtd) || qtd <= 0) return erro('QUANTIDADE_INVALIDA');

  const resumoAtual = resumoAgregado(db, lote);
  if (qtd > resumoAtual.qtd) return erro('ANIMAIS_INSUFICIENTES', { qtdAtual: resumoAtual.qtd });

  const dataFinal = data || hojeLocalISO();
  const novaQtd = resumoAtual.qtd - qtd;
  const novoPeso = novaQtd > 0 ? resumoAtual.peso : 0;
  const valorTotal = tipoSaida === 'venda' ? (Number(valor) || 0) : 0;

  const writes = [
    {
      tabela: 'movimentacoes_animais',
      tipo: 'insert',
      registro: {
        lote_id: Number(lote.id),
        tipo: tipoSaida,
        qtd,
        peso_medio: resumoAtual.peso,
        valor_total: valorTotal,
        custo_por_cabeca: qtd > 0 ? valorTotal / qtd : 0,
        data: dataFinal,
        comprador_fornecedor: '',
        obs: motivo || obs || (tipoSaida === 'venda' ? 'Venda via Telegram' : 'Perda via Telegram'),
        origem: 'telegram',
      },
    },
    { tabela: 'lotes', tipo: 'update', match: { id: Number(lote.id) }, patch: { qtd: novaQtd, p_at: novoPeso } },
  ];

  if (tipoSaida === 'venda' && valorTotal > 0) {
    writes.push({
      tabela: 'movimentacoes_financeiras',
      tipo: 'insert',
      registro: {
        tipo: 'receita',
        categoria: 'venda_animal',
        lote_id: Number(lote.id),
        valor: valorTotal,
        data: dataFinal,
        data_competencia: dataFinal,
        status: 'realizado',
        descricao: `Venda de ${qtd} animal(is) do lote ${lote.nome}`,
        origem_tipo: 'movimentacao_animal',
        origem: 'telegram',
      },
    });
  }

  return {
    ok: true,
    resumo: {
      loteNome: lote.nome,
      quantidadeAtual: resumoAtual.qtd,
      quantidadeSaida: qtd,
      quantidadeRestante: novaQtd,
      valor: valorTotal,
      data: dataFinal,
      motivo: motivo || null,
    },
    writes,
  };
}

/**
 * Prepara a venda de animais de um lote. Puro: não altera nada.
 * @param {object} db db recortado pela fazenda ativa.
 * @param {{ loteId, quantidade, valor?, data?, obs? }} params
 */
export function prepararVendaAnimais(db, params) {
  const plano = prepararSaidaLote(db, params, { tipoSaida: 'venda' });
  if (!plano.ok) return plano;
  return {
    ok: true,
    writes: plano.writes,
    resumo: [
      'Confirme a venda:',
      '',
      `Lote: ${plano.resumo.loteNome}`,
      `Quantidade atual: ${plano.resumo.quantidadeAtual} cabeças`,
      `Quantidade vendida: ${plano.resumo.quantidadeSaida} cabeças`,
      `Quantidade restante: ${plano.resumo.quantidadeRestante} cabeças`,
      plano.resumo.valor > 0 ? `Valor: R$ ${plano.resumo.valor.toFixed(2).replace('.', ',')}` : 'Valor: não informado',
      `Data: ${plano.resumo.data}`,
    ],
  };
}

/**
 * Prepara a baixa por morte/perda de animais de um lote. Nunca gera receita.
 * @param {object} db db recortado pela fazenda ativa.
 * @param {{ loteId, quantidade, data?, motivo?, obs? }} params
 */
export function prepararMorteAnimais(db, params) {
  const plano = prepararSaidaLote(db, params, { tipoSaida: 'morte' });
  if (!plano.ok) return plano;
  return {
    ok: true,
    writes: plano.writes,
    resumo: [
      'Confirme a baixa por morte/perda:',
      '',
      `Lote: ${plano.resumo.loteNome}`,
      `Quantidade atual: ${plano.resumo.quantidadeAtual} cabeças`,
      `Quantidade da perda: ${plano.resumo.quantidadeSaida} cabeças`,
      `Quantidade restante: ${plano.resumo.quantidadeRestante} cabeças`,
      plano.resumo.motivo ? `Motivo: ${plano.resumo.motivo}` : null,
      `Data: ${plano.resumo.data}`,
    ].filter(Boolean),
  };
}

// ── Finalização de lote via linguagem natural ────────────────────────────────
// ponytail: espelha `FechamentoLoteModal.jsx` + `LotesPage.jsx::handleFechamento`
// — um simples update de status, sem tocar pasto/pesagens/custos (o app
// também não toca: histórico é sempre preservado).
/**
 * @param {object} db db recortado pela fazenda ativa.
 * @param {{ loteId, motivo, data? }} params
 */
export function prepararFinalizarLote(db, { loteId, motivo, data }) {
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const lote = lotes.find((l) => Number(l.id) === Number(loteId));
  if (!lote) return erro('LOTE_NAO_ENCONTRADO');
  if (!loteAtivo(lote)) return erro('LOTE_JA_FINALIZADO');

  const motivoFinal = String(motivo || '').trim();
  if (!motivoFinal) return erro('MOTIVO_VAZIO');

  const dataFinal = data || hojeLocalISO();
  const pastagens = Array.isArray(db?.pastagens) ? db.pastagens : [];
  const pastoAtual = lote.pastagem_id != null ? pastagens.find((p) => Number(p.id) === Number(lote.pastagem_id)) : null;

  return {
    ok: true,
    resumo: [
      'Confirme a finalização do lote:',
      '',
      `Lote: ${lote.nome}`,
      `Quantidade atual: ${toNumber(lote.qtd)} cabeças`,
      `Pasto atual: ${pastoAtual?.nome || 'não definido'}`,
      `Data: ${dataFinal}`,
      `Motivo: ${motivoFinal}`,
      '',
      'Depois de finalizado, o lote não aceita mais pesagens, ajustes de lotação, vendas, mortes/perdas ou trocas de pasto — o histórico é preservado.',
    ],
    writes: [{
      tabela: 'lotes',
      tipo: 'update',
      match: { id: Number(lote.id) },
      patch: { status: 'encerrado', data_encerramento: dataFinal, data_venda: null, motivo_encerramento: motivoFinal },
    }],
  };
}
