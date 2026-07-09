// Sprint 28: recorte por fazenda para as respostas do Telegram. Puro, sem I/O
// nem dependência de servidor — por isso vive em `domain/` (testável) e não
// dentro de `api/telegram-webhook.js`.
//
// Regra: o db já chega filtrado por `owner_user_id` (uma conta), então nunca
// há vazamento entre contas. Aqui tratamos apenas o recorte DENTRO da conta:
//  - conexão vinculada a uma fazenda → mostra só ela;
//  - conta com várias fazendas e conexão sem fazenda fixa → identifica a
//    fazenda de origem em cada alerta (quando o alerta se ancora num lote),
//    para nunca misturar fazendas sem rótulo.

import { filtrarDbPorFazenda, construirMapaFazendas, nomeFazendaDoLote } from './escopoFazenda.js';

/**
 * @param {object} dbConta db da conta inteira (todas as fazendas do owner).
 * @param {number|string|null} fazendaId fazenda vinculada à conexão (ou null).
 * @returns {{ db: object, identificarFazenda: boolean }}
 */
export function prepararAlertasEscopados(dbConta, fazendaId) {
  if (fazendaId != null && fazendaId !== '') {
    return { db: filtrarDbPorFazenda(dbConta, fazendaId), identificarFazenda: false };
  }
  const multiFarm = (Array.isArray(dbConta?.fazendas) ? dbConta.fazendas.length : 0) > 1;
  return { db: dbConta, identificarFazenda: multiFarm };
}

/** Marca cada alerta com `fazendaNome` (via lote), quando `identificar` e houver lote. */
export function enriquecerAlertasComFazenda(alertas, db, identificar) {
  if (!identificar) return Array.isArray(alertas) ? alertas : [];
  const mapa = construirMapaFazendas(db);
  return (Array.isArray(alertas) ? alertas : []).map((a) => ({
    ...a,
    fazendaNome: a?.loteId != null ? nomeFazendaDoLote(db, a.loteId, mapa) : null,
  }));
}
