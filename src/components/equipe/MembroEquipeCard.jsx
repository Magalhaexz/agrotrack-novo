import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { obterLabelPerfil, PERFIS } from '../../auth/perfis';

const PAPEL_BADGE = {
  [PERFIS.PROPRIETARIO]: 'success',
  [PERFIS.GERENTE]: 'info',
  [PERFIS.OPERADOR]: 'warning',
  [PERFIS.VISUALIZADOR]: 'neutral',
};

/**
 * Um membro da equipe (Sprint 6): nome, e-mail, papel, data de entrada e
 * status, com ações de alterar papel/remover acesso quando aplicável. Não
 * decide se a ação é permitida — isso é responsabilidade de
 * `domain/equipe.js` (`podeAlterarPapel`/`podeRemoverAcesso`), chamado pela
 * página antes de confirmar a ação.
 */
export default function MembroEquipeCard({
  membro,
  isProprietario = false,
  isSelf = false,
  onAlterarPapel = null,
  onRemover = null,
}) {
  const status = String(membro?.status || 'ativo').toLowerCase();
  const removido = status === 'removido';

  return (
    <div className={`membro-equipe-card ${removido ? 'membro-equipe-card--removido' : ''}`}>
      <div className="membro-equipe-card__info">
        <strong>{membro?.nome || 'Sem nome'}</strong>
        <span className="membro-equipe-card__email">{membro?.email || '—'}</span>
        <span className="membro-equipe-card__meta">
          Entrou em {membro?.created_at ? new Date(membro.created_at).toLocaleDateString('pt-BR') : '—'}
        </span>
      </div>

      <div className="membro-equipe-card__papel">
        <Badge variant={PAPEL_BADGE[membro?.perfil] || 'neutral'}>{obterLabelPerfil(membro?.perfil)}</Badge>
        {isProprietario ? <Badge variant="success">Proprietário</Badge> : null}
        {isSelf ? <Badge variant="neutral">Você</Badge> : null}
        {removido ? <Badge variant="danger">Acesso removido</Badge> : null}
      </div>

      {!isProprietario && (onAlterarPapel || onRemover) ? (
        <div className="membro-equipe-card__acoes">
          {onAlterarPapel ? (
            <select
              className="ui-input"
              value={membro?.perfil}
              disabled={removido}
              onChange={(e) => onAlterarPapel(e.target.value)}
              aria-label={`Alterar papel de ${membro?.nome || membro?.email || 'membro'}`}
            >
              <option value="admin">Proprietário</option>
              <option value="gerente">Gerente</option>
              <option value="operador">Operador</option>
              <option value="visualizador">Visualizador</option>
            </select>
          ) : null}
          {onRemover && !removido && !isSelf ? (
            <Button size="sm" variant="danger" onClick={onRemover}>
              Remover acesso
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
