import { useArroba } from '../hooks/useArroba';
import { formatarNumero } from '../utils/formatters';

// Props:
// peso: number
// rendimento: number
// precoPorArroba: number
export default function ArrobaPreview({
  peso,
  rendimento = 52,
  precoPorArroba = 0,
}) {
  const { arrobaViva, arrobaCarcaca, valorEstimado } = useArroba({
    peso,
    rendimento,
    precoPorArroba,
  });

  return (
    <div
      style={{
        border: '1px solid rgba(130, 220, 90, 0.35)',
        background: 'rgba(32, 70, 22, 0.35)',
        borderRadius: 12,
        padding: 12,
        display: 'grid',
        gap: 6,
      }}
    >
      <div style={{ fontWeight: 700, color: '#d8f7bd' }}>Indicadores em tempo real</div>
      <div style={{ color: '#cce0a8' }}>
        <strong>@ Viva:</strong> {arrobaViva} arroba
      </div>
      <div style={{ color: '#cce0a8' }}>
        <strong>@ Carcaça:</strong> {arrobaCarcaca} arroba
      </div>
      {Number(precoPorArroba || 0) > 0 ? (
        <div style={{ color: '#ddfbbf' }}>
          <strong>Valor estimado:</strong> R$ {formatarNumero(valorEstimado)}
        </div>
      ) : null}
    </div>
  );
}
