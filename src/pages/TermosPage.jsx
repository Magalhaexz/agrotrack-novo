const LEGAL_STYLES = {
  page: {
    minHeight: '100vh',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    fontFamily: 'inherit',
  },
  header: {
    borderBottom: '1px solid var(--color-border)',
    padding: '16px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    background: 'var(--color-surface)',
  },
  brand: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--color-primary)',
    letterSpacing: '-0.02em',
    textDecoration: 'none',
  },
  backLink: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    textDecoration: 'none',
    marginLeft: 'auto',
  },
  container: {
    maxWidth: 780,
    margin: '0 auto',
    padding: '48px 24px 80px',
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    marginBottom: 8,
    color: 'var(--color-text)',
  },
  meta: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    marginBottom: 40,
  },
  section: {
    marginBottom: 36,
  },
  h2: {
    fontSize: 17,
    fontWeight: 600,
    marginBottom: 12,
    color: 'var(--color-text)',
    borderLeft: '3px solid var(--color-primary)',
    paddingLeft: 12,
  },
  p: {
    fontSize: 14,
    lineHeight: 1.75,
    color: 'var(--color-text-secondary)',
    marginBottom: 12,
  },
  footer: {
    borderTop: '1px solid var(--color-border)',
    padding: '24px',
    textAlign: 'center',
    fontSize: 13,
    color: 'var(--color-text-muted)',
    display: 'flex',
    gap: 16,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  footerLink: {
    color: 'var(--color-text-secondary)',
    textDecoration: 'none',
  },
};

export default function TermosPage() {
  return (
    <div style={LEGAL_STYLES.page}>
      <header style={LEGAL_STYLES.header}>
        <a href="/" style={LEGAL_STYLES.brand}>HERDON</a>
        <a href="/" style={LEGAL_STYLES.backLink}>← Voltar ao sistema</a>
      </header>

      <div style={LEGAL_STYLES.container}>
        <h1 style={LEGAL_STYLES.title}>Termos de Uso</h1>
        <p style={LEGAL_STYLES.meta}>Versão 1.0 · Vigente a partir de 15 de junho de 2026</p>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>1. O que é o HERDON</h2>
          <p style={LEGAL_STYLES.p}>
            O HERDON é uma plataforma SaaS (Software as a Service) de gestão pecuária voltada ao
            monitoramento de rebanho de corte. Permite o registro e acompanhamento de fazendas, lotes,
            animais, pesagens, manejo sanitário, estoque, suplementação, financeiro e indicadores
            zootécnicos.
          </p>
          <p style={LEGAL_STYLES.p}>
            Ao criar uma conta e utilizar o HERDON, você ("Usuário") concorda integralmente com estes
            Termos de Uso. Caso não concorde, não utilize o serviço.
          </p>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>2. Uso permitido</h2>
          <p style={LEGAL_STYLES.p}>
            O HERDON é destinado exclusivamente ao uso legítimo por produtores rurais, gestores e
            equipes de fazenda para fins de gestão interna de sua própria operação pecuária.
          </p>
          <p style={LEGAL_STYLES.p}>
            É vedado: utilizar o sistema para fins ilegais; realizar engenharia reversa; compartilhar
            credenciais de acesso; realizar ataques ou tentativas de acesso não autorizado;
            utilizar o sistema para coletar dados de terceiros sem consentimento.
          </p>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>3. Responsabilidade pelos dados</h2>
          <p style={LEGAL_STYLES.p}>
            Todos os dados inseridos no HERDON (registros de animais, pesagens, movimentações
            financeiras, estoques, etc.) são de exclusiva responsabilidade do Usuário. O HERDON não
            verifica a veracidade, precisão ou legalidade das informações inseridas.
          </p>
          <p style={LEGAL_STYLES.p}>
            O Usuário é o controlador dos dados que insere. O HERDON atua como operador, nos termos
            da Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
          </p>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>4. Natureza dos cálculos e indicadores</h2>
          <p style={LEGAL_STYLES.p}>
            Os cálculos, indicadores zootécnicos, projeções financeiras e simulações de cenários
            fornecidos pelo HERDON são ferramentas de <strong>apoio à decisão</strong> e não
            constituem garantia de resultado financeiro, produtivo ou comercial.
          </p>
          <p style={LEGAL_STYLES.p}>
            O HERDON não se responsabiliza por decisões tomadas com base nos dados exibidos pela
            plataforma. O Usuário é responsável por validar as informações com profissionais
            especializados (veterinários, zootecnistas, consultores financeiros).
          </p>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>5. Planos e assinatura</h2>
          <p style={LEGAL_STYLES.p}>
            O acesso ao HERDON está condicionado a uma assinatura ativa conforme os planos disponíveis
            na plataforma. As condições de cobrança, cancelamento e reembolso estão descritas na
            nossa <a href="/politica-de-cobranca" style={{ color: 'var(--color-primary)' }}>Política de Cobrança</a>.
          </p>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>6. Disponibilidade do serviço</h2>
          <p style={LEGAL_STYLES.p}>
            O HERDON é fornecido no estado em que se encontra ("as is"). Não garantimos disponibilidade
            ininterrupta. Realizamos manutenções periódicas e melhorias que podem causar
            indisponibilidade temporária. Em caso de indisponibilidade relevante, comunicaremos
            o Usuário por e-mail.
          </p>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>7. Propriedade intelectual</h2>
          <p style={LEGAL_STYLES.p}>
            Todo o código, design, marcas e conteúdo do HERDON são de propriedade exclusiva do
            desenvolvedor e estão protegidos por lei. O Usuário recebe apenas o direito de uso
            não exclusivo e intransferível da plataforma durante o período de assinatura ativa.
          </p>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>8. Encerramento de conta</h2>
          <p style={LEGAL_STYLES.p}>
            O Usuário pode solicitar o encerramento de sua conta a qualquer momento entrando em
            contato pelo e-mail <strong>herdonapp@gmail.com</strong>. Após o encerramento, os dados
            serão mantidos por até 30 dias para fins de backup e depois excluídos, salvo obrigação
            legal de retenção.
          </p>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>9. Alterações nos termos</h2>
          <p style={LEGAL_STYLES.p}>
            Podemos alterar estes Termos a qualquer momento. Alterações relevantes serão comunicadas
            por e-mail ou por aviso na plataforma com antecedência mínima de 15 dias. O uso
            continuado após a vigência das alterações constitui aceite dos novos termos.
          </p>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>10. Legislação aplicável</h2>
          <p style={LEGAL_STYLES.p}>
            Estes Termos são regidos pela legislação brasileira, incluindo o Código Civil (Lei nº
            10.406/2002), o Código de Defesa do Consumidor (Lei nº 8.078/1990), o Marco Civil da
            Internet (Lei nº 12.965/2014) e a LGPD (Lei nº 13.709/2018). Fica eleito o foro da
            comarca do domicílio do desenvolvedor para dirimir eventuais conflitos.
          </p>
        </div>

        <div style={LEGAL_STYLES.section}>
          <h2 style={LEGAL_STYLES.h2}>11. Contato</h2>
          <p style={LEGAL_STYLES.p}>
            Dúvidas sobre estes Termos: <strong>herdonapp@gmail.com</strong>
          </p>
        </div>
      </div>

      <footer style={LEGAL_STYLES.footer}>
        <a href="/" style={LEGAL_STYLES.footerLink}>Início</a>
        <a href="/politica-de-privacidade" style={LEGAL_STYLES.footerLink}>Privacidade</a>
        <a href="/politica-de-cobranca" style={LEGAL_STYLES.footerLink}>Cobrança</a>
        <a href="/suporte" style={LEGAL_STYLES.footerLink}>Suporte</a>
        <span>© 2026 HERDON</span>
      </footer>
    </div>
  );
}
