import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, FileText } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SubscriptionSummary from '../components/subscription/SubscriptionSummary';
import PlanoUsoCard from '../components/assinatura/PlanoUsoCard';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import { useToast } from '../hooks/useToast';
import {
  getAvailablePlans,
  getSubscriptionDisplayCopy,
  hasSubscriptionBillingReady,
} from '../services/subscriptions';
import { getUpgradeReason, verificarLimiteUso } from '../domain/planos';
import {
  getMissingAsaasCustomerFields,
  isSandboxCheckoutAllowed,
  resolveAsaasPaymentUrl,
  requestAsaasSandboxCheckout,
} from '../services/asaasBilling';
import '../styles/subscription.css';

function formatLimit(value) {
  if (value === null || value === undefined) return 'Ilimitado';
  return new Intl.NumberFormat('pt-BR').format(Number(value));
}

function getSafeCustomerSeed({ usuarioLogado = null, session = null } = {}) {
  return {
    name:
      usuarioLogado?.nome
      || session?.user?.user_metadata?.nome
      || session?.user?.user_metadata?.name
      || session?.user?.email?.split('@')[0]
      || '',
    email:
      usuarioLogado?.email
      || session?.user?.email
      || '',
    cpfCnpj:
      usuarioLogado?.cpfCnpj
      || usuarioLogado?.cpf_cnpj
      || session?.user?.user_metadata?.cpfCnpj
      || session?.user?.user_metadata?.cpf_cnpj
      || '',
    mobilePhone:
      usuarioLogado?.mobilePhone
      || usuarioLogado?.mobile_phone
      || usuarioLogado?.telefone
      || session?.user?.user_metadata?.mobilePhone
      || session?.user?.user_metadata?.mobile_phone
      || session?.user?.user_metadata?.telefone
      || '',
  };
}

export default function MinhaAssinaturaPage({
  subscription = null,
  subscriptionUsage = {},
  session = null,
  usuarioLogado = null,
  navigationIntent = null,
}) {
  const { showToast } = useToast();
  const plans = useMemo(() => getAvailablePlans(), []);
  const actionCopy = useMemo(() => getSubscriptionDisplayCopy(subscription), [subscription]);
  const selectedPlanFallback = subscription?.plan_code || plans.find((plan) => plan.planCode !== 'enterprise')?.planCode || 'essencial';
  const [selectedPlanCode, setSelectedPlanCode] = useState(selectedPlanFallback);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerSeed, setCustomerSeed] = useState(() => getSafeCustomerSeed({ usuarioLogado, session }));
  const [missingFields, setMissingFields] = useState([]);
  const [pendingPlanCode, setPendingPlanCode] = useState(selectedPlanFallback);
  const [pendingPaymentUrl, setPendingPaymentUrl] = useState(null);
  const checkoutLockRef = useRef(false);

  const normalizedPlanCode = String(subscription?.plan_code || subscription?.plan?.planCode || '').toLowerCase();
  const checkoutReady = hasSubscriptionBillingReady(subscription);
  const canStartCheckout = isSandboxCheckoutAllowed(subscription);
  const customerFieldIssues = useMemo(() => getMissingAsaasCustomerFields(customerSeed), [customerSeed]);

  // Contexto de upgrade (Sprint 7): quando o usuário chega aqui redirecionado
  // de um bloqueio (limite de fazenda/usuário ou módulo fora do plano), via
  // `navigationIntent` — mesmo mecanismo já usado pelo resto do app (Sprint 5).
  const upgradeContext = useMemo(() => {
    if (navigationIntent?.page !== 'minhaAssinatura' || navigationIntent?.action !== 'upgrade') return null;
    const motivo = navigationIntent.motivo;
    const chaveLimite = motivo === 'limite_fazendas' ? 'farms' : motivo === 'limite_usuarios' ? 'users' : null;
    const modulo = motivo === 'modulo_bloqueado' ? navigationIntent.modulo : null;
    const titulo = motivo === 'limite_fazendas'
      ? 'Você atingiu o limite de fazendas do seu plano.'
      : motivo === 'limite_usuarios'
        ? 'Você atingiu o limite de usuários do seu plano.'
        : 'Esse recurso não está disponível no seu plano atual.';

    const avaliacao = chaveLimite ? verificarLimiteUso(normalizedPlanCode, subscriptionUsage)?.[chaveLimite] : null;

    return {
      titulo,
      ...getUpgradeReason({ planoAtual: normalizedPlanCode, tipo: chaveLimite ? 'limite' : 'modulo', chaveLimite, modulo, avaliacao }),
    };
  }, [navigationIntent, normalizedPlanCode, subscriptionUsage]);

  useEffect(() => {
    setCustomerSeed(getSafeCustomerSeed({ usuarioLogado, session }));
  }, [usuarioLogado, session]);

  useEffect(() => {
    if (!selectedPlanCode) {
      setSelectedPlanCode(selectedPlanFallback);
    }
  }, [selectedPlanCode, selectedPlanFallback]);

  useEffect(() => {
    if (!pendingPlanCode) {
      setPendingPlanCode(selectedPlanCode);
    }
  }, [pendingPlanCode, selectedPlanCode]);

  function openPaymentUrl(url) {
    if (!url) return false;
    setPendingPaymentUrl(url);
    try {
      window.location.assign(url);
      return true;
    } catch {
      return false;
    }
  }

  function openCustomerForm(planCode = selectedPlanCode) {
    setPendingPlanCode(planCode);
    setMissingFields(customerFieldIssues);
    setCustomerModalOpen(true);
  }

  async function iniciarCheckout(planCode = selectedPlanCode, customerOverride = null) {
    if (checkoutBusy || checkoutLockRef.current) {
      return;
    }

    const plan = plans.find((item) => item.planCode === planCode);
    if (!plan) {
      showToast({ type: 'warning', message: 'Escolha um plano disponível para continuar.' });
      return;
    }

    if (plan.planCode === 'enterprise') {
      showToast({ type: 'info', message: 'Plano sob consulta. Fale com a equipe para seguir com o atendimento.' });
      return;
    }

    if (!canStartCheckout) {
      showToast({ type: 'info', message: 'Este plano já está em uso. Se quiser revisar a assinatura, verifique os detalhes abaixo.' });
      return;
    }

    const customerData = customerOverride || customerSeed;
    const requiredCustomerFields = getMissingAsaasCustomerFields(customerData);
    if (requiredCustomerFields.length > 0) {
      setMissingFields(requiredCustomerFields);
      setPendingPlanCode(plan.planCode);
      setCustomerModalOpen(true);
      return;
    }

    checkoutLockRef.current = true;
    setCheckoutBusy(true);
    try {
      const result = await requestAsaasSandboxCheckout({
        session,
        planCode: plan.planCode,
        customer: customerData,
      });

      if (result?.code === 'SESSION_MISSING') {
        showToast({ type: 'warning', message: result.message || 'Sua sessão expirou. Entre novamente para continuar.' });
        return;
      }

      if (result?.code === 'INVALID_SUBSCRIPTION_PAYLOAD' || result?.code === 'INVALID_PLAN') {
        showToast({ type: 'warning', message: result.message || 'Revise os dados do plano antes de continuar.' });
        return;
      }

      if (result?.code === 'MISSING_CUSTOMER_FIELDS') {
        setMissingFields(Array.isArray(result.missingFields) ? result.missingFields : []);
        setCustomerModalOpen(true);
        showToast({ type: 'warning', message: result.message || 'Precisamos conferir alguns dados antes de continuar.' });
        return;
      }

      if (!result?.ok) {
        showToast({
          type: 'warning',
          message: result?.message || 'Não foi possível criar sua assinatura agora. Tente novamente em alguns instantes.',
        });
        return;
      }

      const redirectUrl = resolveAsaasPaymentUrl(result) || result?.paymentUrl || result?.checkoutUrl || null;
      if (redirectUrl) {
        setPendingPaymentUrl(redirectUrl);
        showToast({ type: 'success', message: 'Abrindo pagamento seguro...' });
        const opened = openPaymentUrl(redirectUrl);
        if (!opened) {
          showToast({
            type: 'warning',
            message: 'Não foi possível abrir o pagamento agora. Use o botão Abrir pagamento abaixo.',
          });
        }
        return;
      }

      if (!result?.ok) {
        showToast({
          type: 'warning',
          message: result?.message || 'Não foi possível confirmar o salvamento agora. Tente novamente em alguns instantes.',
        });
        return;
      }

      if (result.manual) {
        showToast({ type: 'info', message: result.message || 'Plano sob atendimento. Fale com a equipe para continuar.' });
        return;
      }

      showToast({
        type: 'warning',
        message: result.message || 'Não foi possível abrir o pagamento agora. Tente novamente em alguns instantes ou fale com o suporte.',
      });
    } catch {
      showToast({ type: 'warning', message: 'Não foi possível abrir o pagamento agora. Tente novamente em alguns instantes ou fale com o suporte.' });
    } finally {
      checkoutLockRef.current = false;
      setCheckoutBusy(false);
    }
  }

  function handlePrimaryAction() {
    if (actionCopy.primaryLabel === 'Regularizar assinatura' || actionCopy.primaryLabel === 'Escolher plano') {
      void iniciarCheckout(selectedPlanCode);
      return;
    }

    showToast({
      type: 'info',
      message: checkoutReady
        ? 'O gerenciamento da assinatura estará disponível em breve.'
        : 'Pagamento em preparação. Tente novamente em alguns instantes.',
    });
  }

  function handleSecondaryAction() {
    showToast({
      type: 'info',
      message: 'Nossa equipe pode ajudar você a revisar o plano ideal para sua operação.',
    });
  }

  function handleChoosePlan(planCode) {
    setSelectedPlanCode(planCode);
    const customerData = customerSeed;
    const requiredCustomerFields = getMissingAsaasCustomerFields(customerData);
    if (requiredCustomerFields.length > 0) {
      openCustomerForm(planCode);
      return;
    }

    void iniciarCheckout(planCode, customerData);
  }

  return (
    <div className="page page-shell subscription-page">
      <PageHeader
        title="Planos e Assinatura"
        subtitle="Veja seu plano atual, limites de uso e o próximo passo comercial antes da integração de pagamento."
        actions={(
          <div className="subscription-page__header-badge">
            <CheckCircle2 size={16} aria-hidden="true" />
            <span>Área do cliente</span>
          </div>
        )}
      />

      {upgradeContext ? (
        <div className="plano-upgrade-banner">
          <strong>{upgradeContext.titulo}</strong>
          <p>Plano atual: {upgradeContext.planoAtualNome || actionCopy.planName}.</p>
          <p>{upgradeContext.mensagem}</p>
          {upgradeContext.planoRecomendadoNome ? (
            <p>Para continuar, recomendamos o plano <strong>{upgradeContext.planoRecomendadoNome}</strong>.</p>
          ) : null}
        </div>
      ) : null}

      <div className="subscription-page__hero">
        <SubscriptionSummary
          subscription={subscription}
          usage={subscriptionUsage}
          onPrimaryAction={handlePrimaryAction}
          onSecondaryAction={handleSecondaryAction}
          primaryLabel={actionCopy.primaryLabel}
          secondaryLabel="Falar com o suporte"
        />

        <PlanoUsoCard
          subscription={subscription}
          usage={subscriptionUsage}
          onUpgrade={() => document.getElementById('planos-disponiveis')?.scrollIntoView({ behavior: 'smooth' })}
        />
      </div>

      {pendingPaymentUrl ? (
        <Card title="Pagamento pronto" subtitle="Se a abertura automática não acontecer, use o botão abaixo.">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <Button type="button" variant="outline" onClick={() => openPaymentUrl(pendingPaymentUrl)}>
              Abrir pagamento
            </Button>
            <span style={{ color: 'var(--color-text-secondary)' }}>
              O checkout já foi preparado para você.
            </span>
          </div>
        </Card>
      ) : null}

      <Card title="Planos disponíveis" subtitle="Referência comercial para revisão do caminho de upgrade antes da integração de pagamento.">
        <div id="planos-disponiveis" className="subscription-page__plans">
          {plans.map((plan) => {
            const isCurrent = normalizedPlanCode && normalizedPlanCode === String(plan.planCode || '').toLowerCase();
            const isEnterprise = plan.planCode === 'enterprise';
            const actionLabel = isEnterprise
              ? 'Falar com atendimento'
              : isCurrent
                ? 'Plano atual'
                : canStartCheckout
                  ? (actionCopy.primaryLabel === 'Regularizar assinatura' ? 'Regularizar assinatura' : 'Escolher plano')
                  : 'Ver detalhes';

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
                  variant={isEnterprise || isCurrent ? 'ghost' : 'outline'}
                  loading={checkoutBusy && selectedPlanCode === plan.planCode}
                  disabled={checkoutBusy}
                  onClick={() => {
                    if (isEnterprise) {
                      handleSecondaryAction();
                      return;
                    }

                    if (isCurrent) {
                      showToast({ type: 'info', message: 'Este já é o plano em uso.' });
                      return;
                    }

                    if (!canStartCheckout) {
                      showToast({ type: 'info', message: 'Confira os detalhes do plano abaixo.' });
                      return;
                    }

                    handleChoosePlan(plan.planCode);
                  }}
                  icon={!isCurrent && !isEnterprise ? <FileText size={14} aria-hidden="true" /> : undefined}
                >
                  {actionLabel}
                </Button>
              </article>
            );
          })}
        </div>
      </Card>

      <Modal
        open={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        title="Complete seus dados"
        subtitle="Precisamos confirmar alguns dados antes de abrir seu pagamento com segurança."
        size="md"
        footer={(
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' }}>
            <Button type="button" variant="ghost" onClick={() => setCustomerModalOpen(false)}>
              Agora não
            </Button>
            <Button
              type="button"
              loading={checkoutBusy}
              onClick={() => {
                setCustomerModalOpen(false);
                void iniciarCheckout(pendingPlanCode || selectedPlanCode, customerSeed);
              }}
            >
              Confirmar e continuar
            </Button>
          </div>
        )}
      >
        <div style={{ display: 'grid', gap: 14 }}>
          <Input
            label="Nome completo"
            value={customerSeed.name}
            onChange={(event) => setCustomerSeed((prev) => ({ ...prev, name: event.target.value }))}
          />
          <Input
            label="E-mail"
            value={customerSeed.email}
            onChange={(event) => setCustomerSeed((prev) => ({ ...prev, email: event.target.value }))}
          />
          <Input
            label="CPF/CNPJ"
            value={customerSeed.cpfCnpj}
            onChange={(event) => setCustomerSeed((prev) => ({ ...prev, cpfCnpj: event.target.value }))}
          />
          <Input
            label="Telefone/WhatsApp"
            value={customerSeed.mobilePhone}
            onChange={(event) => setCustomerSeed((prev) => ({ ...prev, mobilePhone: event.target.value }))}
          />
          {missingFields.length ? (
            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
              Campos pendentes: {missingFields.map((field) => ({
                name: 'nome completo',
                email: 'e-mail',
                cpfCnpj: 'CPF/CNPJ',
                mobilePhone: 'telefone/WhatsApp',
              }[field] || field)).join(', ')}.
            </p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
