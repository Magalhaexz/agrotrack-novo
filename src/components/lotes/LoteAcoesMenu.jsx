import Button from '../ui/Button';
import { LOTE_ACOES, LOTE_ACOES_GRUPOS } from './loteAcoesConfig';

/**
 * Renderiza o menu de ações do lote a partir da config central (Parte 2 do
 * sprint de fechamento) — usado por LoteCard e LoteDetailsPanel para que as
 * duas telas mostrem sempre o mesmo conjunto, rótulo, ícone e regra de
 * disponibilidade. Só renderiza a ação se `handlers[acao.handlerKey]` foi
 * passado (permite omitir uma ação num consumidor específico sem duplicar a
 * lista de botões).
 *
 * Sprint Visual 5: mesmas ações e regras de sempre, só a apresentação virou
 * 3 grupos (comuns / movimentações / encerramento) em vez de uma fileira só
 * — a ação destrutiva (Finalizar lote) fica isolada por um divisor.
 * @param {object} lote
 * @param {object} handlers ex.: { onEditar, onAjusteLotacao, onVenda, onMortePerda, onTransferenciaSaida, onTrocarPasto, onFinalizar }
 * @param {(permissao: string) => boolean} hasPermission
 * @param {'sm'|'md'} size
 */
export default function LoteAcoesMenu({ lote, handlers = {}, hasPermission, size = 'md' }) {
  const grupos = LOTE_ACOES_GRUPOS.map((grupo) => ({
    ...grupo,
    acoes: LOTE_ACOES.filter((acao) => acao.grupo === grupo.id && handlers[acao.handlerKey]),
  })).filter((grupo) => grupo.acoes.length > 0);

  return (
    <div className="lote-actions-groups">
      {grupos.map((grupo) => (
        <div key={grupo.id} className={`lote-actions action-row lote-actions-group lote-actions-group--${grupo.id}`}>
          {grupo.acoes.map((acao) => {
            const handler = handlers[acao.handlerKey];
            const Icon = acao.icon;
            const semPermissao = typeof hasPermission === 'function' && !hasPermission(acao.permissao);
            const bloqueado = acao.bloqueadoPor ? acao.bloqueadoPor(lote) : false;
            return (
              <Button
                key={acao.id}
                size={size}
                variant={acao.variant}
                icon={<Icon size={16} />}
                onClick={handler}
                disabled={semPermissao || bloqueado}
              >
                {acao.label}
              </Button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
