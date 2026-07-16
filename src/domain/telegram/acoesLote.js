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
import { buildAjusteLotacaoPatch } from '../../pages/lotesLogic.js';

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
  // Remover à média não muda a média da origem — `registrar_saida_lote` não
  // toca em `p_at` da origem (mesmo comportamento de venda/morte).
  const origemQtdFinal = resumoOrigem.qtd - qtd;
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
    // Sprint Paridade 1, bloco 4: transacional via `registrar_saida_lote`
    // (mesma RPC de venda/morte, tipo 'transferencia_saida') — substitui o
    // antigo objeto `writes` bespoke aplicado por 3 awaits sequenciais sem
    // transação. `p_peso_destino_final` carrega a reponderação já calculada
    // acima, preservando o comportamento antigo (origem não muda de peso
    // médio; destino recalcula a média com os animais recebidos).
    rpc: {
      nome: 'registrar_saida_lote',
      params: {
        p_lote_id: Number(origem.id),
        p_tipo: 'transferencia_saida',
        p_qtd: qtd,
        p_peso_medio: pesoTransferido,
        p_valor_total: 0,
        p_custo_por_cabeca: 0,
        p_data: hojeLocalISO(),
        p_comprador_fornecedor: '',
        p_obs: 'Transferência via Telegram',
        p_destino_lote_id: Number(destino.id),
        p_peso_destino_final: destinoPesoFinal,
      },
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
  const valorTotal = tipoSaida === 'venda' ? (Number(valor) || 0) : 0;
  const obsFinal = motivo || obs || (tipoSaida === 'venda' ? 'Venda via Telegram' : 'Perda via Telegram');

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
    // Sprint Paridade 1, bloco 4: transacional via `registrar_saida_lote`
    // (venda gera receita quando há valor > 0; morte/descarte nunca geram).
    rpc: {
      nome: 'registrar_saida_lote',
      params: {
        p_lote_id: Number(lote.id),
        p_tipo: tipoSaida,
        p_qtd: qtd,
        p_peso_medio: resumoAtual.peso,
        p_valor_total: valorTotal,
        p_custo_por_cabeca: qtd > 0 ? valorTotal / qtd : 0,
        p_data: dataFinal,
        p_comprador_fornecedor: '',
        p_obs: obsFinal,
      },
    },
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
    rpc: plano.rpc,
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
    rpc: plano.rpc,
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
    // Sprint Paridade 1, bloco 4: transacional via `finalizar_lote`, que
    // também valida server-side que o lote não está finalizado (fecha a
    // corrida entre duas finalizações simultâneas). `motivo_encerramento`
    // não existe como coluna em `lotes` — a RPC grava o motivo em `obs`.
    rpc: {
      nome: 'finalizar_lote',
      params: {
        p_lote_id: Number(lote.id),
        p_status: 'encerrado',
        p_data_encerramento: dataFinal,
        p_data_venda: null,
        p_motivo: motivoFinal,
      },
    },
  };
}

// ── Ajuste de lotação e edição básica (Sprint Paridade 1, bloco 3) ──────────
// ponytail: `buildAjusteLotacaoPatch` (src/pages/lotesLogic.js) já é uma
// função pura reaproveitada pelo próprio LotesPage.jsx — o bot só resolve o
// lote por nome e traduz o plano para o formato de `writes` em array que o
// motor de cadastro usa (aplicarWrites). Nenhuma regra nova.
/**
 * @param {object} db db recortado pela fazenda ativa.
 * @param {{ loteId, quantidade, motivo, data? }} params
 */
export function prepararAjusteLotacao(db, { loteId, quantidade, motivo, data }) {
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const lote = lotes.find((l) => Number(l.id) === Number(loteId));
  if (!lote) return erro('LOTE_NAO_ENCONTRADO');
  if (!loteAtivo(lote)) return erro('LOTE_BLOQUEADO');

  const resultado = buildAjusteLotacaoPatch({ lote, novaQtd: quantidade, motivo, data });
  if (!resultado.ok) return erro(resultado.erro);

  return {
    ok: true,
    resumo: [
      'Confirme o ajuste de lotação:',
      '',
      `Lote: ${lote.nome}`,
      `Quantidade atual: ${resultado.resumo.qtdAnterior}`,
      `Nova quantidade: ${resultado.resumo.qtdNova}`,
      `Diferença: ${resultado.resumo.delta > 0 ? '+' : ''}${resultado.resumo.delta}`,
      `Motivo: ${String(motivo || '').trim()}`,
    ],
    // Sprint Paridade 1, bloco 4: transacional via `ajustar_lotacao_lote`
    // (mesma validação de `buildAjusteLotacaoPatch`, agora também no banco).
    rpc: {
      nome: 'ajustar_lotacao_lote',
      params: {
        p_lote_id: Number(lote.id),
        p_nova_qtd: resultado.resumo.qtdNova,
        p_motivo: String(motivo || '').trim(),
        p_data: data || hojeLocalISO(),
      },
    },
  };
}

// ponytail: edição de campos básicos (sexo/raça/observação) não tem regra de
// negócio própria no app (LotesPage.jsx só faz `updateOperationalRecord`
// direto) — não há domínio para reaproveitar aqui além da resolução do lote.
const SEXO_ALIASES_EDICAO = {
  macho: 'macho', machos: 'macho',
  femea: 'femea', femeas: 'femea', 'fêmea': 'femea', 'fêmeas': 'femea',
  misto: 'misto', mistos: 'misto', mista: 'misto',
};

/**
 * @param {object} db db recortado pela fazenda ativa.
 * @param {{ loteId, sexo?, raca?, observacao?, pesoInicial?, dataEntrada? }} params — só os campos informados são alterados.
 *
 * ponytail: quantidade/pasto/status têm intenções próprias (AJUSTAR_LOTACAO,
 * TROCAR_LOTE_PASTO, FINALIZAR_LOTE) — não são campos aqui, de propósito,
 * para "editar lote" nunca contornar a validação/transação dessas RPCs.
 * "Origem" não existe como coluna em `lotes` (nem na tabela real, nem em
 * nenhum form do app — `LotesPage.jsx` não tem esse campo) — não inventado.
 */
export function prepararEdicaoLote(db, { loteId, sexo, raca, observacao, pesoInicial, dataEntrada }) {
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const lote = lotes.find((l) => Number(l.id) === Number(loteId));
  if (!lote) return erro('LOTE_NAO_ENCONTRADO');
  if (!loteAtivo(lote)) return erro('LOTE_BLOQUEADO');

  const patch = {};
  const resumoCampos = [];

  if (sexo != null && String(sexo).trim()) {
    const sexoChave = SEXO_ALIASES_EDICAO[normalizarChave(sexo)];
    if (!sexoChave) return erro('SEXO_INVALIDO');
    patch.sexo = sexoChave;
    resumoCampos.push(`Sexo: ${sexoChave}`);
  }
  if (raca != null && String(raca).trim()) {
    patch.raca = String(raca).trim();
    resumoCampos.push(`Raça: ${patch.raca}`);
  }
  if (observacao != null && String(observacao).trim()) {
    patch.obs = String(observacao).trim();
    resumoCampos.push(`Observação: ${patch.obs}`);
  }
  if (pesoInicial != null && String(pesoInicial).trim()) {
    const peso = Number(pesoInicial);
    if (!(peso > 0)) return erro('PESO_INVALIDO');
    patch.p_ini = peso;
    resumoCampos.push(`Peso inicial: ${peso} kg`);
  }
  if (dataEntrada != null && String(dataEntrada).trim()) {
    patch.entrada = String(dataEntrada).trim();
    resumoCampos.push(`Data de entrada: ${patch.entrada}`);
  }

  if (Object.keys(patch).length === 0) return erro('NENHUM_CAMPO_INFORMADO');

  return {
    ok: true,
    resumo: ['Confirme a edição do lote:', '', `Lote: ${lote.nome}`, ...resumoCampos],
    writes: [{ tabela: 'lotes', tipo: 'update', match: { id: lote.id }, patch }],
  };
}
