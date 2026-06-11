import { useMemo, useState } from 'react';
import { getProfileAvatarInitials, resolveProfileAvatarUrl } from '../../services/profilePhotos';

export function UserAvatar({ usuario, size = 36 }) {
  const resolvedFotoUrl = useMemo(() => resolveProfileAvatarUrl(usuario?.foto_url), [usuario?.foto_url]);
  const [erroredSrc, setErroredSrc] = useState(null);
  const imageErrored = erroredSrc === resolvedFotoUrl;

  const style = {
    width: size,
    height: size,
    borderRadius: '50%',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--color-primary-subtle)',
    color: 'var(--color-primary)',
    fontWeight: 700,
    fontSize: size * 0.38,
    border: '2px solid var(--color-border)',
    flexShrink: 0,
  };

  if (resolvedFotoUrl && !imageErrored) {
    return (
      <div style={style}>
        <img
          src={resolvedFotoUrl}
          alt={usuario.nome || 'Usuário'}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => setErroredSrc(resolvedFotoUrl)}
        />
      </div>
    );
  }

  return <div style={style}>{getProfileAvatarInitials(usuario?.nome)}</div>;
}

export default UserAvatar;
