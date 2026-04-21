export default function PageHeader({ title, subtitle, actions }) {
  return (
<<<<<<< HEAD
    <header className="ph"> {/* Usar <header> para melhor semântica */}
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>} {/* Renderizar <p> apenas se houver subtitle */}
      </div>
      {actions && <div className="ph-actions">{actions}</div>} {/* Adicionar classe para estilização de ações */}
    </header>
  );
}
=======
    <div className="ph">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {actions ? <div>{actions}</div> : null}
    </div>
  );
}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
