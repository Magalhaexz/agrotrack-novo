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
  contactCard: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '24px', marginBottom: 24 },
  contactLabel: { fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontWeight: 600 },
  contactValue: { fontSize: 16, fontWeight: 600, color: 'var(--color-primary)' },
  contactNote: { fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 6 },
  tagGrid: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tag: { background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'monospace' },
  footer: { borderTop: '1px solid var(--color-border)', padding: '24px', textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)', display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' },
  footerLink: { color: 'var(--color-text-secondary)', textDecoration: 'none' },
};

export default function SuportePage() {
  return (
    <div style={LEGAL_STYLES.page}>
      <header style={LEGAL_STYLES.header}>
        <a href="/" style={LEGAL_STYLES.brand}>HERDON</a>
        <a href="/" style={LEGAL_STYLES.backLink}>← Voltar ao sistema</a>
      </header>

      <div style={LEGAL_STYLES.container}>
        <h1 style={LEGAL_STYLES.title}>Suporte</h1>
        <p style={LEGAL_STYLES.meta}>HERDON · Canal oficial de atendimento</p>

        <div style={LEGAL_STYLES.contactCard}>
          <div style={LEGAL_STYLES.contactLabel}>Canal de suporte</div>
          <a href="mailto:herdonapp@gmail.com" style={{ ...LEGAL_STYLES.contactValue, textDecoration: 'none' }}>
            herdonapp@gmail.com
          </a>
          <div style={LEGAL_STYLES.contactNote}>Resposta em até 48 horas úteis</div>
          <p style={{ ...LEGAL_STYLES.p, marginTop: 16, marginBottom: 0 }}>
            Ao enviar feedback, informe o que você estava tentando fazer, o que aconteceu e, se possível,
            envie um print da tela.
          </p>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>Como entrar em contato</h2>
          <p style={LEGAL_STYLES.p}>
            Envie um e-mail para <strong>herdonapp@gmail.com</strong> com o assunto no formato
            abaixo para agilizar o atendimento:
          </p>
          <div style={LEGAL_STYLES.tagGrid}>
            <span style={LEGAL_STYLES.tag}>HERDON — Bug: [descrição curta]</span>
            <span style={LEGAL_STYLES.tag}>HERDON — Dúvida: [tema]</span>
            <span style={LEGAL_STYLES.tag}>HERDON — Cobrança: [assunto]</span>
            <span style={LEGAL_STYLES.tag}>HERDON — Conta: [solicitação]</span>
            <span style={LEGAL_STYLES.tag}>URGENTE — HERDON: [problema crítico]</span>
          </div>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>Bugs críticos</h2>
          <p style={LEGAL_STYLES.p}>
            Para problemas que impedem o uso do sistema (login bloqueado, dados inacessíveis,
            erro ao salvar informações críticas), use o prefixo <strong>"URGENTE"</strong> no
            assunto do e-mail. Priorizamos esses casos com resposta em até 4 horas úteis.
          </p>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>O que incluir no e-mail</h2>
          <p style={LEGAL_STYLES.p}>
            Para agilizar a resolução do seu problema, inclua:
          </p>
          <p style={LEGAL_STYLES.p}>
            1. <strong>Descrição do problema</strong> — o que aconteceu e o que era esperado.<br />
            2. <strong>Tela ou módulo</strong> — em qual parte do sistema ocorreu.<br />
            3. <strong>Passos para reproduzir</strong> — o que você fez antes do erro aparecer.<br />
            4. <strong>Captura de tela</strong> — se possível, anexe uma imagem do erro.<br />
            5. <strong>E-mail da conta</strong> — o e-mail usado para login no HERDON.<br />
            6. <strong>Navegador e dispositivo</strong> — Chrome, Safari, celular, computador, etc.
          </p>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>Solicitações de conta e dados</h2>
          <p style={LEGAL_STYLES.p}>
            Para solicitar exclusão de conta, exportação de dados, alteração de e-mail ou outras
            solicitações relacionadas à sua conta, envie um e-mail com o assunto:
          </p>
          <div style={LEGAL_STYLES.tagGrid}>
            <span style={LEGAL_STYLES.tag}>HERDON — Conta: Excluir minha conta</span>
            <span style={LEGAL_STYLES.tag}>HERDON — Conta: Exportar meus dados</span>
            <span style={LEGAL_STYLES.tag}>HERDON — Conta: Alterar e-mail</span>
          </div>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>Solicitações de cancelamento e reembolso</h2>
          <p style={LEGAL_STYLES.p}>
            Para cancelamento de assinatura ou solicitação de reembolso, consulte nossa{' '}
            <a href="/politica-de-cobranca" style={{ color: 'var(--color-primary)' }}>
              Política de Cobrança
            </a>{' '}
            e entre em contato com o assunto:
          </p>
          <div style={LEGAL_STYLES.tagGrid}>
            <span style={LEGAL_STYLES.tag}>HERDON — Cancelamento de assinatura</span>
            <span style={LEGAL_STYLES.tag}>HERDON — Reembolso</span>
          </div>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>Horário de atendimento</h2>
          <p style={LEGAL_STYLES.p}>
            Atendimento em dias úteis (segunda a sexta), das 8h às 18h (horário de Brasília).
            E-mails recebidos fora desse horário serão respondidos no próximo dia útil.
          </p>
        </div>
      </div>

      <footer style={LEGAL_STYLES.footer}>
        <a href="/termos-de-uso" style={LEGAL_STYLES.footerLink}>Termos de Uso</a>
        <a href="/politica-de-privacidade" style={LEGAL_STYLES.footerLink}>Privacidade</a>
        <a href="/politica-de-cobranca" style={LEGAL_STYLES.footerLink}>Cobrança</a>
        <a href="/" style={LEGAL_STYLES.footerLink}>Início</a>
        <span>© 2026 HERDON</span>
      </footer>
    </div>
  );
}
