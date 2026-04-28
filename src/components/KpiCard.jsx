import Icon from './Icon';

export default function KpiCard({ label, value, unit, hint, tone = 'nt', icon = 'grid' }) { // Alterado o default do icon
  return (
    <div className="card kpi">
      <div className="kpi-lbl">
        {label}
        <div className={`kpi-ico ${tone}`}>
          <Icon name={icon} />
        </div>
      </div>
      <div>
        <span className={`kpi-val ${tone}`}>{value}</span>
        {unit && <span className="kpi-unit">{unit}</span>}
      </div>
      <div className="kpi-hint">{hint}</div>
    </div>
  );
}
