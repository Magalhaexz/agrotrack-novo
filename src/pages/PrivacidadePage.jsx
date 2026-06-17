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
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 },
  th: { textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', fontWeight: 600 },
  td: { padding: '8px 12px', borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-secondary)', verticalAlign: 'top' },
  footer: { borderTop: '1px solid var(--color-border)', padding: '24px', textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)', display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' },
  footerLink: { color: 'var(--color-text-secondary)', textDecoration: 'none' },
};

export default function PrivacidadePage() {
  return (
    <div style={LEGAL_STYLES.page}>
      <header style={LEGAL_STYLES.header}>
        <a href="/" style={LEGAL_STYLES.brand}>HERDON</a>
        <a href="/" style={LEGAL_STYLES.backLink}>← Voltar ao sistema</a>
      </header>

      <div style={LEGAL_STYLES.container}>
        <h1 style={LEGAL_STYLES.title}>Política de Privacidade</h1>
        <p style={LEGAL_STYLES.meta}>Versão 1.0 · Vigente a partir de 15 de junho de 2026 · Em conformidade com a LGPD (Lei nº 13.709/2018)</p>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>1. Quem somos</h2>
          <p style={LEGAL_STYLES.p}>
            O HERDON é uma plataforma de gestão pecuária operada por desenvolvedor independente
            (pessoa física), com canal de contato em <strong>herdonapp@gmail.com</strong>. Atuamos
            como operador dos dados que o Usuário insere, e como controlador dos dados de cadastro
            e uso da plataforma.
          </p>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>2. Dados que coletamos</h2>
          <table style={LEGAL_STYLES.table}>
            <thead>
              <tr>
                <th style={LEGAL_STYLES.th}>Dado</th>
                <th style={LEGAL_STYLES.th}>Finalidade</th>
                <th style={LEGAL_STYLES.th}>Base legal (LGPD)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={LEGAL_STYLES.td}>Nome e e-mail</td>
                <td style={LEGAL_STYLES.td}>Autenticação, identificação do usuário</td>
                <td style={LEGAL_STYLES.td}>Execução de contrato (Art. 7º, V)</td>
              </tr>
              <tr>
                <td style={LEGAL_STYLES.td}>Telefone (opcional)</td>
                <td style={LEGAL_STYLES.td}>Contato e suporte</td>
                <td style={LEGAL_STYLES.td}>Consentimento (Art. 7º, I)</td>
              </tr>
              <tr>
                <td style={LEGAL_STYLES.td}>Dados de fazenda e lotes</td>
                <td style={LEGAL_STYLES.td}>Core do produto — gestão pecuária</td>
                <td style={LEGAL_STYLES.td}>Execução de contrato (Art. 7º, V)</td>
              </tr>
              <tr>
                <td style={LEGAL_STYLES.td}>Dados de animais e pesagens</td>
                <td style={LEGAL_STYLES.td}>Cálculo de GMD, indicadores zootécnicos</td>
                <td style={LEGAL_STYLES.td}>Execução de contrato (Art. 7º, V)</td>
              </tr>
              <tr>
                <td style={LEGAL_STYLES.td}>Movimentações financeiras</td>
                <td style={LEGAL_STYLES.td}>Gestão financeira de lotes</td>
                <td style={LEGAL_STYLES.td}>Execução de contrato (Art. 7º, V)</td>
              </tr>
              <tr>
                <td style={LEGAL_STYLES.td}>CPF/CNPJ (via Asaas)</td>
                <td style={LEGAL_STYLES.td}>Cobrança de assinatura</td>
                <td style={LEGAL_STYLES.td}>Execução de contrato (Art. 7º, V)</td>
              </tr>
              <tr>
                <td style={LEGAL_STYLES.td}>Logs de acesso e IP</td>
                <td style={LEGAL_STYLES.td}>Segurança e diagnóstico</td>
                <td style={LEGAL_STYLES.td}>Legítimo interesse (Art. 7º, IX)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>3. Parceiros com acesso aos dados</h2>
          <table style={LEGAL_STYLES.table}>
            <thead>
              <tr>
                <th style={LEGAL_STYLES.th}>Parceiro</th>
                <th style={LEGAL_STYLES.th}>País</th>
                <th style={LEGAL_STYLES.th}>Finalidade</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={LEGAL_STYLES.td}>Supabase</td>
                <td style={LEGAL_STYLES.td}>EUA</td>
                <td style={LEGAL_STYLES.td}>Armazenamento de dados e autenticação</td>
              </tr>
              <tr>
                <td style={LEGAL_STYLES.td}>Asaas</td>
                <td style={LEGAL_STYLES.td}>Brasil</td>
                <td style={LEGAL_STYLES.td}>Processamento de pagamentos e assinaturas</td>
              </tr>
              <tr>
                <td style={LEGAL_STYLES.td}>Vercel</td>
                <td style={LEGAL_STYLES.td}>EUA</td>
                <td style={LEGAL_STYLES.td}>Hospedagem e execução do aplicativo</td>
              </tr>
            </tbody>
          </table>
          <p style={LEGAL_STYLES.p}>
            Supabase e Vercel são empresas americanas. Os dados são transferidos internacionalmente
            com garantias contratuais adequadas. O Asaas é empresa brasileira e está sujeito à
            legislação nacional.
          </p>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>4. Como protegemos seus dados</h2>
          <p style={LEGAL_STYLES.p}>
            Utilizamos Row Level Security (RLS) no banco de dados, garantindo que cada usuário
            acesse apenas seus próprios dados. As chaves de API do servidor nunca são expostas
            no código do frontend. A comunicação é feita exclusivamente via HTTPS.
          </p>
          <p style={LEGAL_STYLES.p}>
            A chave de serviço do Supabase (service_role) está restrita ao ambiente de servidor e
            nunca é enviada ao browser. Credenciais de pagamento são processadas diretamente pela
            Asaas — o HERDON não armazena dados de cartão.
          </p>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>5. Seus direitos (LGPD — Art. 18)</h2>
          <p style={LEGAL_STYLES.p}>
            Você tem direito a: confirmar a existência de tratamento; acessar seus dados; corrigir
            dados incompletos, inexatos ou desatualizados; solicitar anonimização, bloqueio ou
            eliminação de dados desnecessários; solicitar portabilidade dos dados; obter informação
            sobre compartilhamento com terceiros; e revogar o consentimento.
          </p>
          <p style={LEGAL_STYLES.p}>
            Para exercer qualquer desses direitos, entre em contato pelo e-mail
            <strong> herdonapp@gmail.com</strong> informando sua solicitação. Responderemos em
            até 15 dias úteis.
          </p>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>6. Cookies e armazenamento local</h2>
          <p style={LEGAL_STYLES.p}>
            O HERDON utiliza localStorage do navegador para armazenar preferências de sessão e
            estado da interface (ex: sidebar recolhida, alertas resolvidos). Não utilizamos
            cookies de rastreamento de terceiros ou publicidade.
          </p>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>7. Retenção de dados</h2>
          <p style={LEGAL_STYLES.p}>
            Seus dados são mantidos enquanto sua conta estiver ativa. Após o encerramento da conta,
            os dados são mantidos por 30 dias em backup e depois excluídos, salvo obrigação legal
            de retenção (ex: registros de cobrança mantidos por 5 anos conforme legislação fiscal).
          </p>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>8. Contato do encarregado (DPO)</h2>
          <p style={LEGAL_STYLES.p}>
            Canal de privacidade: <strong>herdonapp@gmail.com</strong><br />
            Assunto sugerido: "HERDON — Privacidade / LGPD"
          </p>
        </div>
      </div>

      <footer style={LEGAL_STYLES.footer}>
        <a href="/termos-de-uso" style={LEGAL_STYLES.footerLink}>Termos de Uso</a>
        <a href="/politica-de-cobranca" style={LEGAL_STYLES.footerLink}>Cobrança</a>
        <a href="/suporte" style={LEGAL_STYLES.footerLink}>Suporte</a>
        <a href="/" style={LEGAL_STYLES.footerLink}>Início</a>
        <span>© 2026 HERDON</span>
      </footer>
    </div>
  );
}
