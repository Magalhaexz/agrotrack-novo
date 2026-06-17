import Icon from './Icon';

export default function KpiCard({ label, value, unit, hint, tone = 'nt', icon = 'grid' }) {
  return (
    <div className="kpi-card">
      <div className="kpi-icon-wrap">
        <Icon name={icon} size={20} />
      </div>
      <div className="kpi-content">
        <p className="kpi-label">{label}</p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span className={`kpi-value kpi-val ${tone}`}>{value}</span>
          {unit && <span className="kpi-unit">{unit}</span>}
        </div>
        {hint && <p className="kpi-sub-value">{hint}</p>}
      </div>
    </div>
  );
}
