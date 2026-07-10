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

function loteAtivo(lote) {
  return String(lote?.status || 'ativo').toLowerCase() !== 'encerrado';
}

/**
 * Quantidade e peso médio atuais de um lote. Fonte de verdade: as linhas de
 * `animais` do lote (mesma base do `calcLote`). Se o lote não tiver linhas de
 * animais (modelo puramente agregado no próprio lote), cai para `lote.qtd`/`p_at`.
 */
function resumoAgregado(db, lote) {
  const animais = (Array.isArray(db?.animais) ? db.animais : []).filter((a) => Number(a.lote_id) === Number(lote.id));
  if (animais.length > 0) {
    const qtd = animais.reduce((s, a) => s + toNumber(a.qtd), 0);
    const peso = qtd ? animais.reduce((s, a) => s + toNumber(a.p_at) * toNumber(a.qtd), 0) / qtd : 0;
    return { qtd, peso };
  }
  return { qtd: toNumber(lote.qtd), peso: toNumber(lote.p_at ?? lote.peso_medio_atual) };
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
