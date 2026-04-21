import { Children, cloneElement } from 'react';

/**
 * Componente de contêiner responsivo.
 * @param {object} props - As propriedades do componente.
 * @param {string|number} [props.width='100%'] - A largura do contêiner.
 * @param {string|number} [props.height=300] - A altura do contêiner.
 * @param {React.ReactNode} props.children - Os elementos filhos a serem renderizados.
 * @returns {JSX.Element} Um div com largura e altura especificadas.
 */
export function ResponsiveContainer({ width = '100%', height = 300, children }) {
  const style = { width, height };
  return <div style={style}>{children}</div>;
}

/**
 * Componente de gráfico de linha SVG customizado.
 * Renderiza linhas, eixos X e Y, e um tooltip básico.
 *
 * @param {object} props - As propriedades do componente.
 * @param {Array<object>} [props.data=[]] - Os dados a serem exibidos no gráfico.
 * @param {React.ReactNode} props.children - Componentes Line, XAxis, YAxis, Tooltip.
 * @returns {JSX.Element} Um div contendo o SVG do gráfico de linha.
 */
export function LineChart({ data = [], children }) {
  // Dimensões fixas para o viewBox, o redimensionamento é feito pelo SVG width/height
  const width = 900;
  const height = 300;
  const padding = 30; // Espaçamento interno para os eixos

  // Filtra os filhos para encontrar os componentes específicos do gráfico
  const lines = Children.toArray(children).filter((child) => child?.type?.displayName === 'Line');
  const xAxisComp = Children.toArray(children).find((child) => child?.type?.displayName === 'XAxis');
  const yAxisComp = Children.toArray(children).find((child) => child?.type?.displayName === 'YAxis');
  const tooltipComp = Children.toArray(children).find((child) => child?.type?.displayName === 'Tooltip');

  // Determina a chave para o eixo X (padrão 'label')
  const xKey = xAxisComp?.props?.dataKey || 'label';

  // Extrai todos os valores Y de todas as linhas para determinar a escala do eixo Y
  const yValues = data.flatMap((row) =>
    lines.map((ln) => Number(row[ln.props.dataKey])).filter((v) => !Number.isNaN(v))
  );
  const yMin = Math.min(...yValues, 0); // Garante que o mínimo seja pelo menos 0
  const yMax = Math.max(...yValues, 1); // Garante que o máximo seja pelo menos 1

  // Funções de escala para mapear dados para coordenadas SVG
  const scaleX = (idx) => padding + (idx * (width - padding * 2)) / Math.max(data.length - 1, 1);
  const scaleY = (v) => height - padding - ((v - yMin) / Math.max(yMax - yMin, 1)) * (height - padding * 2);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
        {/* Eixo X */}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#5C7A58" />
        {/* Eixo Y */}
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#5C7A58" />

        {/* Renderiza as linhas do gráfico */}
        {lines.map((line) => {
          const points = data
            .map((row, idx) => {
              const v = Number(row[line.props.dataKey]);
              if (Number.isNaN(v)) return null; // Ignora valores não numéricos
              return `${scaleX(idx)},${scaleY(v)}`;
            })
            .filter(Boolean) // Remove pontos nulos
            .join(' ');

          if (line.props.hide) return null; // Oculta a linha se a prop 'hide' for true

          return (
            <polyline
              key={line.props.dataKey}
              fill="none"
              stroke={line.props.stroke}
              strokeWidth={line.props.strokeWidth || 2}
              points={points}
            />
          );
        })}

        {/* Rótulos do eixo X */}
        {data.map((row, idx) => (
          <text key={idx} x={scaleX(idx)} y={height - 8} fontSize="10" textAnchor="middle" fill="#5C7A58">
            {row[xKey]}
          </text>
        ))}

        {/* Rótulo da unidade do eixo Y */}
        {yAxisComp?.props?.unit ? (
          <text x={5} y={15} fontSize="11" fill="#5C7A58">
            {yAxisComp.props.unit}
          </text>
        ) : null}
      </svg>

      {/* Renderiza o conteúdo do Tooltip, se fornecido */}
      {tooltipComp?.props?.content ? (
        cloneElement(tooltipComp.props.content, { active: false, payload: [], label: '' })
      ) : null}

      {/* Mensagem de instrução para o usuário */}
      <div
        style={{
          position: 'absolute',
          right: 8,
          top: 8,
          fontSize: 11,
          padding: '6px 8px',
          borderRadius: 8,
          backgroundColor: '#162011',
          border: '1px solid #2A3D28',
          color: '#E8F0E6',
        }}
      >
        Toque no gráfico para detalhes
      </div>
    </div>
  );
}

// Componentes de "placeholder" para definir as props dos gráficos
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

/**
 * Componente de gráfico de pizza SVG customizado.
 *
 * @param {object} props - As propriedades do componente.
 * @param {React.ReactNode} props.children - Componentes Pie.
 * @returns {JSX.Element} Um div contendo o SVG do gráfico de pizza.
 */
export function PieChart({ children }) {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <svg viewBox="0 0 300 220" width="100%" height="100%">
        {children}
      </svg>
    </div>
  );
}
PieChart.displayName = 'PieChart';

/**
 * Componente de fatia de pizza para o PieChart.
 *
 * @param {object} props - As propriedades do componente.
 * @param {Array<object>} [props.data=[]] - Os dados para as fatias da pizza.
 * @param {string} [props.dataKey='value'] - A chave para o valor numérico de cada fatia.
 * @param {string} [props.nameKey='name'] - A chave para o nome de cada fatia.
 * @param {number} [props.outerRadius=80] - O raio externo da pizza.
 * @returns {JSX.Element} Um fragmento contendo os elementos path SVG para as fatias.
 */
export function Pie({ data = [], dataKey = 'value', nameKey = 'name', outerRadius = 80 }) {
  const total = data.reduce((s, i) => s + Number(i[dataKey] || 0), 0) || 1;
  const cx = 150; // Centro X do círculo
  const cy = 110; // Centro Y do círculo

  // Calcula os segmentos (início e fim acumulado) para cada fatia
  const segmentos = data
    .map((item) => Number(item[dataKey] || 0))
    .reduce(
      (acc, val) => {
        const inicio = acc.cursor;
        const fim = inicio + val;
        acc.cursor = fim;
        acc.lista.push({ inicio, fim });
        return acc;
      },
      { cursor: 0, lista: [] }
    ).lista;

  return (
    <>
      {data.map((item, idx) => {
        // Calcula os ângulos de início e fim para cada fatia
        const startAngle = (segmentos[idx].inicio / total) * Math.PI * 2 - Math.PI / 2;
        const endAngle = (segmentos[idx].fim / total) * Math.PI * 2 - Math.PI / 2;

        // Calcula as coordenadas dos pontos no arco
        const x1 = cx + Math.cos(startAngle) * outerRadius;
        const y1 = cy + Math.sin(startAngle) * outerRadius;
        const x2 = cx + Math.cos(endAngle) * outerRadius;
        const y2 = cy + Math.sin(endAngle) * outerRadius;

        // Determina se o arco é grande (maior que 180 graus)
        const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

        // Constrói o comando path SVG para a fatia
        const path = `M ${cx} ${cy} L ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

        // Cores predefinidas para as fatias
        const colors = ["#4ADE80", "#60A5FA", "#FCD34D", "#F87171"];

        return (
          <path key={idx} d={path} fill={colors[idx % colors.length]}>
            <title>{item[nameKey]}: {item[dataKey]}</title>
          </path>
        );
      })}
    </>
  );
}
Pie.displayName = 'Pie';

export function Cell() { return null; }
export function Legend() { return null; }

/**
 * Componente de gráfico de barras SVG customizado.
 *
 * @param {object} props - As propriedades do componente.
 * @param {Array<object>} [props.data=[]] - Os dados a serem exibidos no gráfico.
 * @param {React.ReactNode} props.children - Componentes Bar.
 * @returns {JSX.Element} Um div contendo o SVG do gráfico de barras.
 */
export function BarChart({ data = [], children }) {
  const width = 900,
    height = 300,
    padding = 30;

  // Filtra os filhos para encontrar os componentes Bar
  const bars = Children.toArray(children).filter((c) => c?.type?.displayName === 'Bar');

  // Função de escala para o eixo X
  const scaleX = (i) => padding + (i * (width - padding * 2)) / Math.max(data.length, 1);

  // Encontra o valor máximo para o eixo Y, considerando todas as barras
  const maxYValue = Math.max(1, ...data.flatMap((r) => bars.map((b) => Number(r[b.props.dataKey] || 0))));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
      {/* Eixo X */}
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#5C7A58" />

      {/* Renderiza as barras */}
      {data.map((row, i) => {
        let stackedHeight = 0; // Para barras empilhadas
        return bars.map((bar, barIdx) => {
          const value = Number(row[bar.props.dataKey] || 0);
          const barHeight = (value / maxYValue) * (height - padding * 2);
          const barWidth = 20;
          const xPosition = scaleX(i) + barIdx * (barWidth + 2); // Posição X para cada barra
          let yPosition;

          if (bar.props.stackId) {
            // Se for empilhada, a posição Y é ajustada pelo stackedHeight
            yPosition = height - padding - barHeight - stackedHeight;
            stackedHeight += barHeight;
          } else {
            // Se não for empilhada, a posição Y é calculada normalmente
            yPosition = height - padding - barHeight;
          }

          return (
            <rect
              key={`${i}-${barIdx}`}
              x={xPosition}
              y={yPosition}
              width={barWidth}
              height={barHeight}
              fill={bar.props.fill || '#2b6cb0'}
            >
              <title>{row[bar.props.dataKey]}</title>
            </rect>
          );
        });
      })}

      {/* Rótulos do eixo X */}
      {data.map((row, i) => (
        <text key={i} x={scaleX(i)} y={height - 8} fontSize="10" fill="#5C7A58">
          {row.mes || row.nome || i + 1}
        </text>
      ))}
    </svg>
  );
}
BarChart.displayName = 'BarChart';

// Componente de "placeholder" para definir as props das barras
export function Bar() { return null; }
Bar.displayName = 'Bar';