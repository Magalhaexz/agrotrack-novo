import { gerarNovoId } from '../utils/id';

export function registrarAuditoria(db, evento) {
  const auditoria = Array.isArray(db?.auditoria) ? db.auditoria : [];

  return {
    ...db,
    auditoria: [
      ...auditoria,
      {
        id: gerarNovoId(auditoria),
        data_hora: new Date().toISOString(),
        ...evento,
      },
    ],
  };
}
