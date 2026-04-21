import Icon from './Icon';

<<<<<<< HEAD
export default function KpiCard({ label, value, unit, hint, tone = 'nt', icon = 'grid' }) { // Alterado o default do icon
=======
export default function KpiCard({ label, value, unit, hint, tone = 'nt', icon = 'dashboard' }) {
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
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
<<<<<<< HEAD
        {unit && <span className="kpi-unit">{unit}</span>}
=======
        {unit ? <span className="kpi-unit">{unit}</span> : null}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
      </div>
      <div className="kpi-hint">{hint}</div>
    </div>
  );
<<<<<<< HEAD
}
=======
}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
