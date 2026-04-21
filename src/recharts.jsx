import { Children, cloneElement } from 'react';

export function ResponsiveContainer({ width = '100%', height = 300, children }) {
  const style = { width, height };
  return <div style={style}>{children}</div>;
}

export function LineChart({ data = [], children }) {
  const width = 900;
  const height = 300;
  const padding = 30;
  const lines = Children.toArray(children).filter((child) => child?.type?.displayName === 'Line');
  const xKeyComp = Children.toArray(children).find((child) => child?.type?.displayName === 'XAxis');
  const yComp = Children.toArray(children).find((child) => child?.type?.displayName === 'YAxis');
  const tooltipComp = Children.toArray(children).find((child) => child?.type?.displayName === 'Tooltip');
  const xKey = xKeyComp?.props?.dataKey || 'label';
  const yValues = data.flatMap((row) => lines.map((ln) => Number(row[ln.props.dataKey])).filter((v) => !Number.isNaN(v)));
  const yMin = Math.min(...yValues, 0);
  const yMax = Math.max(...yValues, 1);
  const scaleX = (idx) => padding + (idx * (width - padding * 2)) / Math.max(data.length - 1, 1);
  const scaleY = (v) => height - padding - ((v - yMin) / Math.max(yMax - yMin, 1)) * (height - padding * 2);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#5C7A58" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#5C7A58" />
        {lines.map((line) => {
          const points = data
            .map((row, idx) => {
              const v = Number(row[line.props.dataKey]);
              if (Number.isNaN(v)) return null;
              return `${scaleX(idx)},${scaleY(v)}`;
            })
            .filter(Boolean)
            .join(' ');
          if (line.props.hide) return null;
          return <polyline key={line.props.dataKey} fill="none" stroke={line.props.stroke} strokeWidth={line.props.strokeWidth || 2} points={points} />;
        })}
        {data.map((row, idx) => (
          <text key={idx} x={scaleX(idx)} y={height - 8} fontSize="10" textAnchor="middle" fill="#5C7A58">{row[xKey]}</text>
        ))}
        {yComp?.props?.unit ? <text x={5} y={15} fontSize="11" fill="#5C7A58">{yComp.props.unit}</text> : null}
      </svg>
      {tooltipComp?.props?.content ? cloneElement(tooltipComp.props.content, { active: false, payload: [], label: '' }) : null}
      <div style={{ position: 'absolute', right: 8, top: 8, fontSize: 11, padding: '6px 8px', borderRadius: 8, backgroundColor: '#162011', border: '1px solid #2A3D28', color: '#E8F0E6' }}>Toque no gráfico para detalhes</div>
    </div>
  );
}

export function Line() { return null; }
Line.displayName = 'Line';

export function CartesianGrid() { return null; }
CartesianGrid.displayName = 'CartesianGrid';

export function XAxis() { return null; }
XAxis.displayName = 'XAxis';

export function YAxis() { return null; }
YAxis.displayName = 'YAxis';

export function Tooltip() { return null; }
Tooltip.displayName = 'Tooltip';

export function ReferenceLine() { return null; }
ReferenceLine.displayName = 'ReferenceLine';


export function PieChart({ children }) { return <div style={{ width: '100%', height: '100%' }}><svg viewBox="0 0 300 220" width="100%" height="100%">{children}</svg></div>; }
PieChart.displayName='PieChart';

export function Pie({ data = [], dataKey = 'value', nameKey = 'name', outerRadius = 80 }) {
  const total = data.reduce((s, i) => s + Number(i[dataKey] || 0), 0) || 1;
  const cx = 150; const cy = 110;
  const segmentos = data.map((item) => Number(item[dataKey] || 0)).reduce((acc, val) => {
    const inicio = acc.cursor;
    const fim = inicio + val;
    acc.cursor = fim;
    acc.lista.push({ inicio, fim });
    return acc;
  }, { cursor: 0, lista: [] }).lista;

  return <>
    {data.map((item, idx) => {
      const start = (segmentos[idx].inicio / total) * Math.PI * 2 - Math.PI / 2;
      const end = (segmentos[idx].fim / total) * Math.PI * 2 - Math.PI / 2;
      const x1 = cx + Math.cos(start) * outerRadius;
      const y1 = cy + Math.sin(start) * outerRadius;
      const x2 = cx + Math.cos(end) * outerRadius;
      const y2 = cy + Math.sin(end) * outerRadius;
      const largeArc = end - start > Math.PI ? 1 : 0;
      const path = `M ${cx} ${cy} L ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      return <path key={idx} d={path} fill={["#4ADE80","#60A5FA","#FCD34D","#F87171"][idx%4]}><title>{item[nameKey]}: {item[dataKey]}</title></path>;
    })}
  </>;
}
Pie.displayName='Pie';

export function Cell(){return null;}
export function Legend(){return null;}


export function BarChart({ data = [], children }) {
  const width=900,height=300,p=30;
  const bars = Children.toArray(children).filter((c)=>c?.type?.displayName==='Bar');
  const x = (i)=> p + (i*(width-p*2))/Math.max(data.length,1);
  const max = Math.max(1, ...data.flatMap((r) => bars.map((b) => Number(r[b.props.dataKey] || 0))));
  return <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
    <line x1={p} y1={height-p} x2={width-p} y2={height-p} stroke="#5C7A58" />
    {data.map((row,i)=>{let stacked=0;return bars.map((b,bi)=>{const v=Number(row[b.props.dataKey]||0);const h=(v/max)*(height-p*2);const y=height-p-h-stacked;const w=20;const xx=x(i)+bi*(w+2);stacked += b.props.stackId? h:0;return <rect key={`${i}-${bi}`} x={xx} y={y} width={w} height={h} fill={b.props.fill||'#2b6cb0'}><title>{row[b.props.dataKey]}</title></rect>;})})}
    {data.map((row,i)=><text key={i} x={x(i)} y={height-8} fontSize="10" fill="#5C7A58">{row.mes||row.nome||i+1}</text>)}
  </svg>;
}
BarChart.displayName='BarChart';
export function Bar(){return null;}
Bar.displayName='Bar';
