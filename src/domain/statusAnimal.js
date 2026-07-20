// Status de animal individual (tipo_registro: 'individual') que encerram o
// ciclo de vida do animal — reaproveitado por src/services/movimentacoes.js
// (bloqueia repetição de operação) e src/domain/integridadeDados.js
// (reconciliação lote.qtd × animais ativos), única fonte da verdade.
export const ANIMAL_INDIVIDUAL_INACTIVE_STATUSES = ['vendido', 'morte', 'descarte', 'transferencia_saida', 'perda', 'inativo'];

export function isAnimalIndividualAtivo(animal) {
  const status = String(animal?.status || 'ativo').toLowerCase();
  return !ANIMAL_INDIVIDUAL_INACTIVE_STATUSES.includes(status);
}
