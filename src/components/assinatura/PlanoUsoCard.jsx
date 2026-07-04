import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { getSubscriptionLimitMessage, getSubscriptionStatusLabel } from '../../services/subscriptions';
import { getPlanoConfig, listarRecursosPlano, recomendarProximoPlano, verificarLimiteUso } from '../../domain/planos';
import '../../styles/planoUso.css';

function formatarLimite(valor) {
  if (valor === null || valor === undefined) return 'ilimitado';
  return new Intl.NumberFormat('pt-BR').format(Number(valor));
}

/** Perto do limite = não bloqueado ainda, mas com 20% ou menos de folga (mínimo 1 unidade). */
function pertoDoLimite(info) {
  if (!info || info.limit === null || info.limit === undefined || !info.allowed) return false;
  return info.remaining <= Math.max(1, Math.ceil(info.limit * 0.2));
}

function MetricaLimite({ label, chave, info, planoCode }) {
  if (!info) return null;
  const percentual = info.limit ? Math.min(100, Math.round((info.current / info.limit) * 100)) : null;
  const perto = pertoDoLimite(info);
  const mensagemLimite = !info.allowed ? getSubscriptionLimitMessage(chave, info) : null;
  const recomendado = !info.allowed ? recomendarProximoPlano({ planoAtual: planoCode, chaveLimite: chave }) : null;

  return (
    <div className={`plano-uso-metrica ${!info.allowed ? 'is-limite' : perto ? 'is-perto' : ''}`}>
      <div className="plano-uso-metrica__cabecalho">
        <span className="plano-uso-metrica__label">{label}</span>
        <strong className="plano-uso-metrica__valor">
          {info.current}{info.limit === null ? '' : ` / ${formatarLimite(info.limit)}`}
        </strong>
      </div>
      {info.limit !== null ? (
        <div className="plano-uso-metrica__barra">
          <div className="plano-uso-metrica__barra-fill" style={{ width: `${percentual}%` }} />
        </div>
      ) : null}
      {mensagemLimite ? (
        <p className="plano-uso-metrica__aviso">
          {mensagemLimite}
          {recomendado ? ` Recomendamos o plano ${recomendado.planName}.` : ''}
        </p>
      ) : perto ? (
        <p className="plano-uso-metrica__aviso plano-uso-metrica__aviso--perto">Você está perto do limite deste plano.</p>
      ) : null}
    </div>
  );
}

/**
 * Card de uso do plano (Sprint 7): fazendas/usuários usados vs. limite, e os
 * recursos liberados/bloqueados no plano atual. Não recalcula nenhuma regra
 * comercial — só lê `domain/planos.js`/`services/subscriptions.js`, a mesma
 * fonte usada para bloquear escrita/navegação no resto do app.
 */
export default function PlanoUsoCard({ subscription = null, usage = {}, onUpgrade = null }) {
  const planoCode = subscription?.plan_code || subscription?.plan?.planCode || null;
  const config = getPlanoConfig(planoCode);
  const limites = verificarLimiteUso(planoCode, usage);
  const recursos = listarRecursosPlano(planoCode);
  const statusLabel = getSubscriptionStatusLabel(subscription?.status);

  return (
    <Card
      title="Uso do plano"
      subtitle={config ? `${config.planName} — ${statusLabel}` : 'Escolha um plano para ver limites e recursos.'}
    >
      <div className="plano-uso-card">
        <div className="plano-uso-card__metricas">
          <MetricaLimite label="Fazendas" chave="farms" info={limites.farms} planoCode={planoCode} />
          <MetricaLimite label="Usuários" chave="users" info={limites.users} planoCode={planoCode} />
        </div>

        <div className="plano-uso-card__recursos">
          <strong className="plano-uso-card__recursos-titulo">Recursos</strong>
          <ul>
            {recursos.map((recurso) => (
              <li key={recurso.chave}>
                <Badge variant={recurso.liberado ? 'success' : 'neutral'}>
                  {recurso.liberado ? 'Liberado' : 'Bloqueado'}
                </Badge>
                <span>
                  {recurso.label}
                  {recurso.semRestricaoDePlano ? ' — disponível em todos os planos' : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {onUpgrade ? (
          <div className="plano-uso-card__acao">
            <Button variant="outline" onClick={onUpgrade}>Fazer upgrade</Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
