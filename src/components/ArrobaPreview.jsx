import { useArroba } from '../hooks/useArroba';
import { formatarNumero } from '../utils/formatters';

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
    <div className="arroba-preview-card">
      <div className="arroba-preview-title">Indicadores em tempo real</div>
      <div className="arroba-preview-item">
        <strong>@ Viva:</strong> {arrobaViva} arroba
      </div>
      <div className="arroba-preview-item">
        <strong>@ Carcaça:</strong> {arrobaCarcaca} arroba
      </div>
      {Number(precoPorArroba || 0) > 0 && (
        <div className="arroba-preview-value">
          <strong>Valor estimado:</strong> R$ {formatarNumero(valorEstimado)}
        </div>
      )}
    </div>
  );
}