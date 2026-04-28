import { gerarNovoId } from '../utils/id.js';
import { createAuditEvent } from './operationalPersistence.js';

/**
 * Registra um evento de auditoria no banco de dados.
 *
 * @param {object} db - O objeto do banco de dados atual.
 * @param {object} evento - Um objeto contendo os detalhes do evento de auditoria (ex: { usuario_id, acao, detalhes }).
 * @returns {object} Um novo objeto de banco de dados com o evento de auditoria adicionado.
 */
export function registrarAuditoria(db, evento, persistContext = {}) {
  // Garante que 'auditoria' é um array, mesmo que não exista no db.
  const auditoria = Array.isArray(db?.auditoria) ? db.auditoria : [];

  const eventoNormalizado = {
    id: gerarNovoId(auditoria), // Gera um novo ID único para o evento
    data_hora: new Date().toISOString(), // Adiciona um timestamp ISO para o evento
    ...evento, // Inclui todos os detalhes do evento fornecidos
  };

  if (persistContext?.session?.user?.id) {
    void createAuditEvent({
      acao: eventoNormalizado?.acao || 'acao_nao_informada',
      entidade: eventoNormalizado?.entidade || 'sistema',
      entidade_id: eventoNormalizado?.entidade_id || null,
      usuario_id: eventoNormalizado?.ator_id || persistContext.session.user.id,
      criticidade: eventoNormalizado?.criticidade || 'media',
      detalhes: {
        descricao: eventoNormalizado?.descricao || '',
        ator_email: eventoNormalizado?.ator_email || '',
      },
      data_hora: eventoNormalizado.data_hora,
    }, persistContext.session).then((result) => {
      if (!result?.persisted && import.meta.env.DEV) {
        console.warn('[HERDON_AUDITORIA_PERSISTENCIA]', result?.error || 'Falha ao persistir auditoria.');
      }
    });
  }

  return {
    ...db, // Mantém todas as outras propriedades do db inalteradas
    auditoria: [
      ...auditoria, // Adiciona os eventos de auditoria existentes
      eventoNormalizado,
    ],
  };
}
