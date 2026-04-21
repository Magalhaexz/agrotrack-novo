import { gerarNovoId } from '../utils/id';

/**
 * Registra um evento de auditoria no banco de dados.
 *
 * @param {object} db - O objeto do banco de dados atual.
 * @param {object} evento - Um objeto contendo os detalhes do evento de auditoria (ex: { usuario_id, acao, detalhes }).
 * @returns {object} Um novo objeto de banco de dados com o evento de auditoria adicionado.
 */
export function registrarAuditoria(db, evento) {
  // Garante que 'auditoria' é um array, mesmo que não exista no db.
  const auditoria = Array.isArray(db?.auditoria) ? db.auditoria : [];

  return {
    ...db, // Mantém todas as outras propriedades do db inalteradas
    auditoria: [
      ...auditoria, // Adiciona os eventos de auditoria existentes
      {
        id: gerarNovoId(auditoria), // Gera um novo ID único para o evento
        data_hora: new Date().toISOString(), // Adiciona um timestamp ISO para o evento
        ...evento, // Inclui todos os detalhes do evento fornecidos
      },
    ],
  };
}