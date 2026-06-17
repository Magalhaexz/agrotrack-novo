const LEGAL_STYLES = {
  page: { minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'inherit' },
  header: { borderBottom: '1px solid var(--color-border)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16, background: 'var(--color-surface)' },
  brand: { fontSize: 18, fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '-0.02em', textDecoration: 'none' },
  backLink: { fontSize: 13, color: 'var(--color-text-secondary)', textDecoration: 'none', marginLeft: 'auto' },
  container: { maxWidth: 780, margin: '0 auto', padding: '48px 24px 80px' },
  title: { fontSize: 28, fontWeight: 700, marginBottom: 8, color: 'var(--color-text)' },
  meta: { fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 40 },
  section: { marginBottom: 36 },
  h2: { fontSize: 17, fontWeight: 600, marginBottom: 12, color: 'var(--color-text)', borderLeft: '3px solid var(--color-primary)', paddingLeft: 12 },
  p: { fontSize: 14, lineHeight: 1.75, color: 'var(--color-text-secondary)', marginBottom: 12 },
  planGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 },
  planCard: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '16px 14px' },
  planName: { fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 },
  planPrice: { fontSize: 20, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 0 },
  planPer: { fontSize: 12, color: 'var(--color-text-muted)' },
  footer: { borderTop: '1px solid var(--color-border)', padding: '24px', textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)', display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' },
  footerLink: { color: 'var(--color-text-secondary)', textDecoration: 'none' },
};

export default function CobrancaPage() {
  return (
    <div style={LEGAL_STYLES.page}>
      <header style={LEGAL_STYLES.header}>
        <a href="/" style={LEGAL_STYLES.brand}>HERDON</a>
        <a href="/" style={LEGAL_STYLES.backLink}>← Voltar ao sistema</a>
      </header>

      <div style={LEGAL_STYLES.container}>
        <h1 style={LEGAL_STYLES.title}>Política de Cobrança</h1>
        <p style={LEGAL_STYLES.meta}>Versão 1.0 · Vigente a partir de 15 de junho de 2026</p>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>1. Planos disponíveis</h2>
          <div style={LEGAL_STYLES.planGrid}>
            <div style={LEGAL_STYLES.planCard}>
              <div style={LEGAL_STYLES.planName}>Fundador</div>
              <div style={LEGAL_STYLES.planPrice}>R$ 297</div>
              <div style={LEGAL_STYLES.planPer}>/mês</div>
            </div>
            <div style={LEGAL_STYLES.planCard}>
              <div style={LEGAL_STYLES.planName}>Essencial</div>
              <div style={LEGAL_STYLES.planPrice}>R$ 197</div>
              <div style={LEGAL_STYLES.planPer}>/mês</div>
            </div>
            <div style={LEGAL_STYLES.planCard}>
              <div style={LEGAL_STYLES.planName}>Pro</div>
              <div style={LEGAL_STYLES.planPrice}>R$ 397</div>
              <div style={LEGAL_STYLES.planPer}>/mês</div>
            </div>
            <div style={LEGAL_STYLES.planCard}>
              <div style={LEGAL_STYLES.planName}>Premium</div>
              <div style={LEGAL_STYLES.planPrice}>R$ 697</div>
              <div style={LEGAL_STYLES.planPer}>/mês</div>
            </div>
          </div>
          <p style={LEGAL_STYLES.p}>
            Os valores são cobrados mensalmente em reais (BRL). Consulte a página de assinatura
            dentro do sistema para detalhes sobre os recursos incluídos em cada plano.
          </p>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>2. Processamento de pagamentos</h2>
          <p style={LEGAL_STYLES.p}>
            Os pagamentos são processados pela <strong>Asaas</strong>, empresa brasileira de
            serviços financeiros regulamentada pelo Banco Central do Brasil. O HERDON não armazena
            dados de cartão de crédito — esses dados são processados diretamente pela Asaas em
            ambiente seguro (PCI-DSS).
          </p>
          <p style={LEGAL_STYLES.p}>
            Formas de pagamento aceitas: cartão de crédito, PIX e boleto bancário (conforme
            disponibilidade na plataforma Asaas).
          </p>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>3. Ciclo de cobrança</h2>
          <p style={LEGAL_STYLES.p}>
            A cobrança é mensal e recorrente, com início na data da primeira confirmação de
            pagamento. As cobranças subsequentes ocorrem no mesmo dia do mês (ou no próximo
            dia útil, em caso de final de semana ou feriado).
          </p>
          <p style={LEGAL_STYLES.p}>
            Você receberá um aviso de cobrança por e-mail antes de cada renovação, conforme
            configuração da Asaas.
          </p>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>4. Falha de pagamento</h2>
          <p style={LEGAL_STYLES.p}>
            Em caso de falha de pagamento (cartão recusado, boleto não pago, saldo insuficiente):
          </p>
          <p style={LEGAL_STYLES.p}>
            1. A Asaas realizará novas tentativas automáticas conforme sua política.<br />
            2. Você receberá avisos por e-mail sobre a situação do pagamento.<br />
            3. Após o período de carência (conforme plano), o acesso ao sistema será suspenso
            até regularização.<br />
            4. Seus dados são mantidos durante o período de suspensão.
          </p>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>5. Cancelamento</h2>
          <p style={LEGAL_STYLES.p}>
            Você pode solicitar o cancelamento da assinatura a qualquer momento entrando em
            contato pelo e-mail <strong>herdonapp@gmail.com</strong> com o assunto "Cancelamento
            de assinatura" ou pelo suporte dentro do sistema.
          </p>
          <p style={LEGAL_STYLES.p}>
            Após o cancelamento, você manterá acesso ao sistema até o fim do período já pago.
            Não há cobrança adicional após o cancelamento.
          </p>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>6. Reembolso</h2>
          <p style={LEGAL_STYLES.p}>
            Analisamos pedidos de reembolso caso a caso. Em geral:
          </p>
          <p style={LEGAL_STYLES.p}>
            — Reembolso integral é considerado em caso de falha técnica grave do sistema que
            impeça o uso por mais de 48 horas, sem resolução.<br />
            — Cancelamentos por desistência após o uso não são reembolsados.<br />
            — Para solicitar reembolso: <strong>herdonapp@gmail.com</strong> com assunto
            "Reembolso HERDON".
          </p>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>7. Alteração de preços</h2>
          <p style={LEGAL_STYLES.p}>
            Podemos alterar os valores dos planos com aviso prévio mínimo de 30 dias por e-mail.
            Assinaturas ativas serão respeitadas até o próximo ciclo de renovação após o aviso.
          </p>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>8. Ambiente de teste controlado</h2>
          <p style={LEGAL_STYLES.p}>
            Durante o período de homologação e testes controlados, cobranças podem ser realizadas
            em ambiente sandbox (simulação). Nenhuma cobrança real é gerada nesse contexto.
            Quando o sistema estiver em produção plena, esta seção será atualizada para refletir
            o início das cobranças reais.
          </p>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>9. Contato</h2>
          <p style={LEGAL_STYLES.p}>
            Dúvidas sobre cobrança: <strong>herdonapp@gmail.com</strong><br />
            Assunto: "Cobrança HERDON — [sua dúvida]"
          </p>
        </div>
      </div>

      <footer style={LEGAL_STYLES.footer}>
        <a href="/termos-de-uso" style={LEGAL_STYLES.footerLink}>Termos de Uso</a>
        <a href="/politica-de-privacidade" style={LEGAL_STYLES.footerLink}>Privacidade</a>
        <a href="/suporte" style={LEGAL_STYLES.footerLink}>Suporte</a>
        <a href="/" style={LEGAL_STYLES.footerLink}>Início</a>
        <span>© 2026 HERDON</span>
      </footer>
    </div>
  );
}
