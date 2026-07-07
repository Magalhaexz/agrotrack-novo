// Persistência da tratativa de alertas (Sprint 16) — tabela
// `alertas_tratativas` (migration 20260708090000). Segue o mesmo padrão já
// usado pelo resto do app: lê de `db.alertas_tratativas` (já sincronizado
// por `useOperationalData.js`), grava via `createOperationalRecord`/
// `updateOperationalRecord` (que já injetam `owner_user_id` da sessão).
import { createOperationalRecord, updateOperationalRecord } from './operationalPersistence.js';
import { criarTratativaAlerta } from '../domain/tratativasAlertas.js';

export function listarTratativasAlertas(db) {
  return Array.isArray(db?.alertas_tratativas) ? db.alertas_tratativas : [];
}

export function buscarTratativaPorAlertaId(db, alertaId) {
  const alvo = String(alertaId ?? '');
  return listarTratativasAlertas(db).find((tratativa) => String(tratativa?.alerta_id) === alvo) || null;
}

/**
 * Cria ou atualiza a tratativa de UM alerta — nunca duplica: se já existe
 * uma tratativa para `dados.alertaId`, atualiza em vez de criar outra linha.
 * Retorna `{ persisted, data, isUpdate, error }`; nunca lança erro.
 */
export async function salvarTratativaAlerta(db, session, dados) {
  const tratativa = criarTratativaAlerta(dados);
  if (!tratativa) {
    return { persisted: false, isUpdate: false, data: null, error: 'Dados inválidos para registrar a tratativa deste alerta.' };
  }

  const existente = buscarTratativaPorAlertaId(db, tratativa.alerta_id);
  if (existente?.id) {
    const resultado = await updateOperationalRecord('alertas_tratativas', existente.id, tratativa, session);
    return {
      persisted: Boolean(resultado?.persisted),
      isUpdate: true,
      data: resultado?.data || { ...existente, ...tratativa },
      error: resultado?.persisted ? null : (resultado?.error || 'Não foi possível atualizar a tratativa agora.'),
    };
  }

  const resultado = await createOperationalRecord('alertas_tratativas', tratativa, session);
  return {
    persisted: Boolean(resultado?.persisted),
    isUpdate: false,
    data: resultado?.data || tratativa,
    error: resultado?.persisted ? null : (resultado?.error || 'Não foi possível registrar a tratativa agora.'),
  };
}
