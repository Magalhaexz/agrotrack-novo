import { useArroba } from '../hooks/useArroba';
import { formatarArroba, formatarNumero, parseNumeroEntrada } from '../utils/formatters';

export default function ArrobaPreview({
  peso,
  rendimento = 52,
  precoPorArroba = 0,
}) {
  const { arrobaViva, arrobaCarcaca, valorEstimado, temPesoValido } = useArroba({
    peso,
    rendimento,
    precoPorArroba,
  });

  const precoNormalizado = parseNumeroEntrada(precoPorArroba);
  const temPrecoValido = Number.isFinite(precoNormalizado) && precoNormalizado > 0;

  return (
    <div className="arroba-preview-card">
      <div className="arroba-preview-title">Indicadores em tempo real</div>

      <div className="arroba-preview-item">
        <strong>@ Viva:</strong> {formatarArroba(arrobaViva)}
      </div>
      <div className="arroba-preview-item">
        <strong>@ Carcaca:</strong> {formatarArroba(arrobaCarcaca)}
      </div>

      {!temPesoValido ? (
        <div className="arroba-preview-empty">
          Informe um peso inicial ou atual valido para calcular as arrobas.
        </div>
      ) : null}

      {temPrecoValido && temPesoValido ? (
        <div className="arroba-preview-value">
          <strong>Valor estimado:</strong> R$ {formatarNumero(valorEstimado)}
        </div>
      ) : null}
    </div>
  );
}
