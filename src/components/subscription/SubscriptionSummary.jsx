import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Card from '../ui/Card';
import {
  buildSubscriptionAccessState,
  getPlanLimits,
  getSubscriptionStatusLabel,
} from '../../services/subscriptions';

function formatLimit(value) {
  if (value === null || value === undefined) return 'Ilimitado';
  return new Intl.NumberFormat('pt-BR').format(Number(value));
}

function buildUsageLine(label, current, limit) {
  return `${label}: ${new Intl.NumberFormat('pt-BR').format(Number(current || 0))} / ${formatLimit(limit)}`;
}

export default function SubscriptionSummary({
  subscription = null,
  usage = {},
  title = 'Minha Assinatura',
  subtitle = 'Plano atual e limites de uso.',
  showActions = true,
  onPrimaryAction = null,
  onSecondaryAction = null,
  primaryLabel = 'Regularizar assinatura',
  secondaryLabel = 'Falar com o suporte',
}) {
  const normalized = subscription?.plan ? subscription : {
    ...(subscription || {}),
    plan: getPlanLimits(subscription?.plan_code),
  };
  const gate = buildSubscriptionAccessState(normalized);
  const plan = normalized?.plan || getPlanLimits(normalized?.plan_code);
  const statusLabel = gate.statusLabel || getSubscriptionStatusLabel(normalized?.status);
  const message = gate.message || 'Sua assinatura está em preparação.';
  const limitSnapshot = plan?.limits || {};

  return (
    <Card title={title} subtitle={subtitle}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <Badge variant={gate.badgeTone}>{plan?.planName || 'Plano em preparação'}</Badge>
          <Badge variant={gate.warning ? 'warning' : gate.blocked ? 'danger' : 'success'}>{statusLabel}</Badge>
          <span style={{ color: 'var(--color-text-muted)' }}>{plan?.priceLabel || 'Sob consulta'}</span>
        </div>

        <p style={{ margin: 0, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{message}</p>

        <div style={{ display: 'grid', gap: 8 }}>
          <strong style={{ fontSize: 14 }}>Resumo dos limites</strong>
          <div style={{ display: 'grid', gap: 6, color: 'var(--color-text-secondary)' }}>
            <span>{buildUsageLine('Fazendas', usage.farms ?? 0, limitSnapshot.farms)}</span>
            <span>{buildUsageLine('Animais', usage.animals ?? 0, limitSnapshot.animals)}</span>
            <span>{buildUsageLine('Usuários', usage.users ?? 0, limitSnapshot.users)}</span>
          </div>
        </div>

        {showActions ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Button type="button" variant="outline" onClick={onPrimaryAction || undefined} disabled={!onPrimaryAction}>
              {primaryLabel}
            </Button>
            <Button type="button" variant="ghost" onClick={onSecondaryAction || undefined} disabled={!onSecondaryAction}>
              {secondaryLabel}
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
