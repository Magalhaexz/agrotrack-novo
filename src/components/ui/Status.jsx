import { Circle, AlertTriangle, AlertOctagon, CheckCircle2, Clock, XCircle, RefreshCw } from 'lucide-react';

const STATUS_MAP = {
  normal: { icon: Circle, tone: 'neutral', label: 'Normal' },
  atencao: { icon: AlertTriangle, tone: 'warning', label: 'Atenção' },
  critico: { icon: AlertOctagon, tone: 'danger', label: 'Crítico' },
  concluido: { icon: CheckCircle2, tone: 'success', label: 'Concluído' },
  atrasado: { icon: Clock, tone: 'danger', label: 'Atrasado' },
  erro: { icon: XCircle, tone: 'danger', label: 'Erro' },
  sincronizado: { icon: RefreshCw, tone: 'success', label: 'Sincronizado' },
};

export default function Status({ value = 'normal', label, className = '' }) {
  const entry = STATUS_MAP[value] || STATUS_MAP.normal;
  const Icon = entry.icon;

  return (
    <span className={`ui-status ui-status--${entry.tone} ${className}`.trim()}>
      <Icon size={13} aria-hidden="true" />
      <span>{label || entry.label}</span>
    </span>
  );
}
