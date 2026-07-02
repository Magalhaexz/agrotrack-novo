import { useState } from 'react';
import Button from '../components/ui/Button';
import SubscriptionSummary from '../components/subscription/SubscriptionSummary';
import MinhaAssinaturaPage from './MinhaAssinaturaPage';
import { usuarioTemPermissao } from '../auth/perfis';
import { MOTIVOS_BLOQUEIO, getBlockedMessage } from '../services/accessControl';

const TITULOS_POR_MOTIVO = {
  [MOTIVOS_BLOQUEIO.SEM_PLANO]: 'Escolha um plano para começar',
  [MOTIVOS_BLOQUEIO.TRIAL_VENCIDO]: 'Seu período de teste terminou',
  [MOTIVOS_BLOQUEIO.PAGAMENTO_VENCIDO]: 'Pagamento pendente',
  [MOTIVOS_BLOQUEIO.CANCELADA]: 'Assinatura cancelada',
  [MOTIVOS_BLOQUEIO.BLOQUEADA]: 'Conta bloqueada',
};

/**
 * Tela de conta bloqueada — única saída do gate comercial (App.jsx).
 * Proprietário vê o catálogo de planos com checkout Asaas embutido;
 * subusuário vê orientação para acionar o proprietário da conta.
 */
export default function AssinaturaBloqueadaPage({
  subscription = null,
  reason = null,
  message = null,
  session = null,
  user = null,
  usuarioLogado = null,
  onSignOut = null,
  onSubscriptionRefresh = null,
}) {
  const [mostrarPlanos, setMostrarPlanos] = useState(false);
  const podeGerenciarAssinatura = usuarioTemPermissao(user, 'assinatura:gerenciar');
  const titulo = TITULOS_POR_MOTIVO[reason] || 'Sua assinatura não está ativa';
  const descricao = message || getBlockedMessage(reason);

  if (mostrarPlanos && podeGerenciarAssinatura) {
    return (
      <div style={{ minHeight: '100vh', padding: '24px 16px', display: 'grid', gap: 16, justifyItems: 'center', alignContent: 'start' }}>
        <div style={{ width: '100%', maxWidth: 1040, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          <strong>{descricao}</strong>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {onSubscriptionRefresh ? (
              <Button type="button" variant="outline" size="sm" onClick={() => onSubscriptionRefresh()}>
                Já paguei — atualizar
              </Button>
            ) : null}
            <Button type="button" variant="ghost" size="sm" onClick={onSignOut || undefined} disabled={!onSignOut}>
              Sair da conta
            </Button>
          </div>
        </div>
        <div style={{ width: '100%', maxWidth: 1040 }}>
          <MinhaAssinaturaPage
            subscription={subscription}
            session={session}
            usuarioLogado={usuarioLogado}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="app-loading" style={{ minHeight: '100vh' }}>
      <div className="app-loading-panel" style={{ maxWidth: 760, width: '100%' }}>
        <span className="app-loading-pill">HERDON</span>
        <strong>{titulo}</strong>
        <p>{descricao}</p>
        {subscription ? (
          <div style={{ width: '100%', marginTop: 8 }}>
            <SubscriptionSummary
              subscription={subscription}
              showActions={false}
              title="Sua assinatura"
              subtitle="O acesso ao app operacional está bloqueado."
            />
          </div>
        ) : null}
        {!podeGerenciarAssinatura ? (
          <p style={{ marginTop: 8 }}>
            Peça ao proprietário da conta para regularizar a assinatura. Assim que estiver ativa,
            seu acesso volta automaticamente.
          </p>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14, justifyContent: 'center' }}>
          {podeGerenciarAssinatura ? (
            <Button type="button" variant="primary" onClick={() => setMostrarPlanos(true)}>
              {reason === MOTIVOS_BLOQUEIO.SEM_PLANO || reason === MOTIVOS_BLOQUEIO.TRIAL_VENCIDO
                ? 'Escolher plano'
                : 'Regularizar assinatura'}
            </Button>
          ) : null}
          {onSubscriptionRefresh ? (
            <Button type="button" variant="outline" onClick={() => onSubscriptionRefresh()}>
              Já regularizei — atualizar
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => window.location.assign('/suporte')}>
            Falar com o suporte
          </Button>
          <Button type="button" variant="ghost" onClick={onSignOut || undefined} disabled={!onSignOut}>
            Sair da conta
          </Button>
        </div>
      </div>
    </div>
  );
}
