import Button from './ui/Button';

/**
 * Tela mostrada quando a página existe e o papel do usuário tem permissão,
 * mas o PLANO atual não inclui o módulo (Sprint 7) — diferente de
 * `BloqueadoPorPermissao` (papel sem permissão) e de `AssinaturaBloqueadaPage`
 * (conta sem nenhum acesso comercial). Mesma mensagem de
 * `getModuleBlockedMessage()` (services/subscriptions.js) usada no bloqueio
 * de navegação — não inventa um texto novo aqui.
 */
export default function BloqueadoPorPlano({ mensagem, onIrParaAssinatura = null }) {
  return (
    <div className="card" style={{ marginTop: 12 }} role="alert" aria-live="assertive">
      <h3>Recurso indisponível no seu plano</h3>
      <p style={{ marginTop: 8, opacity: 0.9 }}>{mensagem}</p>
      {onIrParaAssinatura ? (
        <Button variant="outline" onClick={onIrParaAssinatura} style={{ marginTop: 12 }}>
          Ver planos e assinatura
        </Button>
      ) : null}
    </div>
  );
}
