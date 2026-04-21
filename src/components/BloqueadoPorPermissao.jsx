export default function BloqueadoPorPermissao({ mensagem = 'Você não tem permissão para acessar este conteúdo.' }) {
  return (
    <div className="card" style={{ marginTop: 12 }} role="alert" aria-live="assertive">
      <h3>Acesso não autorizado</h3>
      <p style={{ marginTop: 8, opacity: 0.9 }}>{mensagem}</p>
    </div>
  );
}