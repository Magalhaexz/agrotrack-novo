import { useMemo } from 'react';
import { CheckCircle2, FileText } from 'lucide-react';
import SubscriptionSummary from '../components/subscription/SubscriptionSummary';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { useToast } from '../hooks/useToast';
import {
  getAvailablePlans,
  getSubscriptionDisplayCopy,
  hasSubscriptionBillingReady,
} from '../services/subscriptions';
import '../styles/subscription.css';

function formatLimit(value) {
  if (value === null || value === undefined) return 'Ilimitado';
  return new Intl.NumberFormat('pt-BR').format(Number(value));
}

function buildStatusTone(status) {
  if (status === 'past_due') return 'warning';
  if (status === 'canceled' || status === 'blocked') return 'danger';
  return 'success';
}

function resolveSnapshotValue(value, fallback = 'Em preparação') {
  if (value === null || value === undefined || value === '') return fallback;
  return value;
}

export default function MinhaAssinaturaPage({ subscription = null, subscriptionUsage = {} }) {
  const { showToast } = useToast();
  const plans = useMemo(() => getAvailablePlans(), []);
  const actionCopy = useMemo(() => getSubscriptionDisplayCopy(subscription), [subscription]);
  const normalizedPlanCode = String(subscription?.plan_code || subscription?.plan?.planCode || '').toLowerCase();
  const checkoutReady = hasSubscriptionBillingReady(subscription);
  const statusTone = buildStatusTone(actionCopy.status);

  function handlePrimaryAction() {
    if (actionCopy.primaryLabel === 'Regularizar assinatura') {
      showToast({
        type: 'warning',
        message: 'Ainda estamos preparando a liberação do checkout. Fale com o suporte para regularizar sua assinatura.',
      });
      return;
    }

    if (actionCopy.primaryLabel === 'Escolher plano') {
      showToast({
        type: 'info',
        message: 'Checkout em preparação. Fale com o suporte para escolher o melhor plano.',
      });
      return;
    }

    showToast({
      type: 'info',
      message: checkoutReady
        ? 'O gerenciamento da assinatura estará disponível em breve.'
        : 'Checkout em preparação. Fale com o suporte para ajustar seu plano.',
    });
  }

  function handleSecondaryAction() {
    showToast({
      type: 'info',
      message: 'Nossa equipe pode ajudar você a revisar o plano ideal para sua operação.',
    });
  }

  return (
    <div className="page page-shell subscription-page">
      <header className="page-header subscription-page__header">
        <div>
          <h1>Minha Assinatura</h1>
          <p>Veja seu plano atual, limites de uso e o próximo passo comercial antes da integração de pagamento.</p>
        </div>
        <div className="subscription-page__header-badge">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>Área do cliente</span>
        </div>
      </header>

      <div className="subscription-page__hero">
        <SubscriptionSummary
          subscription={subscription}
          usage={subscriptionUsage}
          onPrimaryAction={handlePrimaryAction}
          onSecondaryAction={handleSecondaryAction}
          primaryLabel={actionCopy.primaryLabel}
          secondaryLabel="Falar com o suporte"
        />

        <Card title="Visão da assinatura" subtitle="Base comercial exibida para validação antes do checkout.">
          <div className="subscription-page__snapshot">
            <div className="summary-row">
              <span className="summary-row__label">Plano atual</span>
              <strong className="summary-row__value">{actionCopy.planName}</strong>
            </div>
            <div className={`summary-row ${statusTone === 'danger' ? 'summary-row--alert' : statusTone === 'success' ? 'summary-row--success' : ''}`}>
              <span className="summary-row__label">Status</span>
              <span className={`summary-badge summary-badge--${statusTone}`}>{actionCopy.statusLabel}</span>
            </div>
            <div className="summary-row">
              <span className="summary-row__label">Valor</span>
              <strong className="summary-row__value">{actionCopy.priceLabel}</strong>
            </div>
            <div className="summary-row">
              <span className="summary-row__label">Cobrança</span>
              <strong className="summary-row__value">{resolveSnapshotValue(subscription?.plan?.billingIntervalLabel)}</strong>
            </div>
            <div className="summary-row">
              <span className="summary-row__label">Fazendas</span>
              <strong className="summary-row__value">{resolveSnapshotValue(subscription?.plan ? formatLimit(subscription?.plan?.limits?.farms) : null)}</strong>
            </div>
            <div className="summary-row">
              <span className="summary-row__label">Animais</span>
              <strong className="summary-row__value">{resolveSnapshotValue(subscription?.plan ? formatLimit(subscription?.plan?.limits?.animals) : null)}</strong>
            </div>
            <div className="summary-row">
              <span className="summary-row__label">Usuários</span>
              <strong className="summary-row__value">{resolveSnapshotValue(subscription?.plan ? formatLimit(subscription?.plan?.limits?.users) : null)}</strong>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Planos disponíveis" subtitle="Referência comercial para revisão do caminho de upgrade antes da integração de pagamento.">
        <div className="subscription-page__plans">
          {plans.map((plan) => {
            const isCurrent = normalizedPlanCode && normalizedPlanCode === String(plan.planCode || '').toLowerCase();
            const actionLabel = isCurrent ? 'Plano atual' : 'Ver detalhes';

            return (
              <article key={plan.planCode} className={`subscription-plan-card ${isCurrent ? 'is-current' : ''}`}>
                <div className="subscription-plan-card__top">
                  <Badge variant={isCurrent ? 'success' : 'neutral'}>{plan.planName}</Badge>
                  {isCurrent ? <span className="subscription-plan-card__current">Em uso</span> : null}
                </div>
                <strong className="subscription-plan-card__price">{plan.priceLabel}</strong>
                <span className="subscription-plan-card__period">{plan.billingIntervalLabel}</span>
                <p className="subscription-plan-card__description">{plan.description}</p>
                <div className="subscription-plan-card__limits">
                  <span>Fazendas: {formatLimit(plan.limits?.farms)}</span>
                  <span>Animais: {formatLimit(plan.limits?.animals)}</span>
                  <span>Usuários: {formatLimit(plan.limits?.users)}</span>
                </div>
                <Button
                  type="button"
                  variant={isCurrent ? 'ghost' : 'outline'}
                  onClick={handleSecondaryAction}
                  icon={!isCurrent ? <FileText size={14} aria-hidden="true" /> : undefined}
                >
                  {actionLabel}
                </Button>
              </article>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
