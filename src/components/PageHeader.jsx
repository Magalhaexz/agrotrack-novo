export default function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="ph"> {/* Usar <header> para melhor semântica */}
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>} {/* Renderizar <p> apenas se houver subtitle */}
      </div>
      {actions && <div className="ph-actions">{actions}</div>} {/* Adicionar classe para estilização de ações */}
    </header>
  );
}
