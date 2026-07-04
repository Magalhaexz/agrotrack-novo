import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { listarResumosPermissoesPerfil } from '../../domain/equipe';

const BADGE_POR_PERFIL = {
  proprietario: 'success',
  gerente: 'info',
  operador: 'warning',
  visualizador: 'neutral',
};

/**
 * Explica em uma frase o que cada papel pode fazer (Sprint 6, Parte 4).
 * Puramente apresentação — o texto vem de `domain/equipe.js`, que é a
 * mesma fonte usada nos testes, para nunca divergir do que a matriz de
 * permissões (`auth/perfis.js`) realmente aplica.
 */
export default function PermissoesPerfilResumo() {
  const resumos = listarResumosPermissoesPerfil();

  return (
    <Card title="O que cada papel pode fazer" className="permissoes-perfil-resumo">
      <ul className="permissoes-perfil-resumo__lista">
        {resumos.map((item) => (
          <li key={item.perfil}>
            <Badge variant={BADGE_POR_PERFIL[item.perfil] || 'neutral'}>{item.label}</Badge>
            <span>{item.resumo}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
