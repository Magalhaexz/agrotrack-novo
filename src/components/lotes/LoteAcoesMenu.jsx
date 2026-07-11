import Button from '../ui/Button';
import { LOTE_ACOES } from './loteAcoesConfig';

/**
 * Renderiza o menu de ações do lote a partir da config central (Parte 2 do
 * sprint de fechamento) — usado por LoteCard e LoteDetailsPanel para que as
 * duas telas mostrem sempre o mesmo conjunto, rótulo, ícone e regra de
 * disponibilidade. Só renderiza a ação se `handlers[acao.handlerKey]` foi
 * passado (permite omitir uma ação num consumidor específico sem duplicar a
 * lista de botões).
 * @param {object} lote
 * @param {object} handlers ex.: { onEditar, onAjusteLotacao, onVenda, onMortePerda, onTransferenciaSaida, onTrocarPasto, onFinalizar }
 * @param {(permissao: string) => boolean} hasPermission
 * @param {'sm'|'md'} size
 */
export default function LoteAcoesMenu({ lote, handlers = {}, hasPermission, size = 'md' }) {
  return (
    <div className="lote-actions action-row">
      {LOTE_ACOES.map((acao) => {
        const handler = handlers[acao.handlerKey];
        if (!handler) return null;
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
  );
}
