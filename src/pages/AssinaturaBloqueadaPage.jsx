import Button from '../components/ui/Button';
import SubscriptionSummary from '../components/subscription/SubscriptionSummary';

export default function AssinaturaBloqueadaPage({ subscription = null, onSignOut = null }) {
  return (
    <div className="app-loading" style={{ minHeight: '100vh' }}>
      <div className="app-loading-panel" style={{ maxWidth: 760, width: '100%' }}>
        <span className="app-loading-pill">HERDON</span>
        <strong>Regularize sua assinatura para continuar usando o HERDON.</strong>
        <p>Fale com o suporte para ajustar seu plano.</p>
        <div style={{ width: '100%', marginTop: 8 }}>
          <SubscriptionSummary
            subscription={subscription}
            showActions={false}
            title="Sua assinatura"
            subtitle="Este acesso está temporariamente indisponível."
          />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
          <Button type="button" variant="primary" disabled>
            Regularizar assinatura
          </Button>
          <Button type="button" variant="outline" onClick={onSignOut || undefined} disabled={!onSignOut}>
            Sair da conta
          </Button>
        </div>
      </div>
    </div>
  );
}
