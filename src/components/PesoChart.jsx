<<<<<<< HEAD

import React from 'react';

// Funções auxiliares (manter fora do componente para evitar recriação desnecessária)
function calcularDias(dataInicial, dataFinal) {
  if (!dataInicial || !dataFinal) return 0;
  const inicio = new Date(dataInicial);
  const fim = new Date(dataFinal);
  const diferencaMs = fim - inicio;
  const dias = Math.round(diferencaMs / (1000 * 60 * 60 * 24));
  return dias > 0 ? dias : 0;
}

function criarTicks(min, max, quantidade) {
  if (quantidade <= 1) return [min]; // Evita divisão por zero ou ticks insuficientes
  const passo = (max - min) / (quantidade - 1);
  return Array.from({ length: quantidade }, (_, i) => min + passo * i);
}

function formatarTick(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

function formatarDataCurta(data) {
  if (!data) return '—';
  const [, mes, dia] = data.split('-');
  return `${dia}/${mes}`;
}

// Componente auxiliar para um tick do eixo Y
function YAxisTick({ y, x1, x2, label }) {
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} className="peso-grid-line" />
      <text x={x1 - 12} y={y + 4} textAnchor="end" className="peso-axis-tick">
        {label}
      </text>
    </g>
  );
}

// Componente auxiliar para um tick do eixo X e labels
function XAxisTick({ x, y, daysLabel, dateLabel }) {
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y + 6} className="peso-axis" />
      <text x={x} y={y + 22} textAnchor="middle" className="peso-axis-tick">
        {daysLabel}
      </text>
      <text x={x} y={y + 38} textAnchor="middle" className="peso-date-label">
        {dateLabel}
      </text>
    </g>
  );
}

=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
export default function PesoChart({ data = [], metaGmd = 0 }) {
  if (!data.length) {
    return (
      <div className="empty-box">
        <strong>Sem dados para o gráfico.</strong>
        <span>Cadastre pesagens para visualizar a evolução do lote.</span>
      </div>
    );
  }

<<<<<<< HEAD
  // Dimensões e paddings do SVG
  const width = 900;
  const height = 360;
=======
  const width = 900;
  const height = 360;

>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  const paddingLeft = 84;
  const paddingRight = 34;
  const paddingTop = 34;
  const paddingBottom = 72;

<<<<<<< HEAD
  // Calcula dados com peso esperado
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  const primeiraData = data[0]?.data;
  const primeiroPeso = Number(data[0]?.peso_medio || 0);

  const dataComEsperado = data.map((item) => {
    const diasDesdeInicio = calcularDias(primeiraData, item.data);
    const pesoReal = Number(item.peso_medio || 0);
    const pesoEsperado = primeiroPeso + Number(metaGmd || 0) * diasDesdeInicio;
<<<<<<< HEAD
    return { ...item, diasDesdeInicio, pesoReal, pesoEsperado };
  });

  // Determina se o último ponto real está abaixo da meta
  const ultimoPonto = dataComEsperado[dataComEsperado.length - 1];
  const abaixoDaMeta = ultimoPonto.pesoReal < ultimoPonto.pesoEsperado;

  // Calcula min/max pesos para a escala Y
  const todosPesos = dataComEsperado.flatMap((item) => [item.pesoReal, item.pesoEsperado]);
  let minPeso = Math.min(...todosPesos);
  let maxPeso = Math.max(...todosPesos);

  if (minPeso === maxPeso) { // Evita range zero
    minPeso -= 10;
    maxPeso += 10;
  } else {
    const margem = (maxPeso - minPeso) * 0.12; // Adiciona margem para melhor visualização
=======

    return {
      ...item,
      diasDesdeInicio,
      pesoReal,
      pesoEsperado,
    };
  });

  const ultimoPonto = dataComEsperado[dataComEsperado.length - 1];
  const abaixoDaMeta = ultimoPonto.pesoReal < ultimoPonto.pesoEsperado;

  const todosPesos = dataComEsperado.flatMap((item) => [
    item.pesoReal,
    item.pesoEsperado,
  ]);

  let minPeso = Math.min(...todosPesos);
  let maxPeso = Math.max(...todosPesos);

  if (minPeso === maxPeso) {
    minPeso -= 10;
    maxPeso += 10;
  } else {
    const margem = (maxPeso - minPeso) * 0.12;
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
    minPeso -= margem;
    maxPeso += margem;
  }

<<<<<<< HEAD
  const rangePeso = maxPeso - minPeso || 1; // Garante que rangePeso não seja zero
  const maxDias = Math.max(...dataComEsperado.map((item) => item.diasDesdeInicio), 1); // Garante que maxDias não seja zero

  // Funções de mapeamento de coordenadas
  const getX = (dias) =>
    paddingLeft + (dias / maxDias) * (width - paddingLeft - paddingRight);

  const getY = (peso) =>
    height - paddingBottom - ((peso - minPeso) / rangePeso) * (height - paddingTop - paddingBottom);

  // Calcula pontos para as linhas real e esperada
=======
  const rangePeso = maxPeso - minPeso || 1;
  const maxDias = Math.max(...dataComEsperado.map((item) => item.diasDesdeInicio), 1);

  const getX = (dias) =>
    paddingLeft +
    (dias / maxDias) * (width - paddingLeft - paddingRight);

  const getY = (peso) =>
    height -
    paddingBottom -
    ((peso - minPeso) / rangePeso) * (height - paddingTop - paddingBottom);

>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  const pointsReal = dataComEsperado.map((item) => ({
    ...item,
    x: getX(item.diasDesdeInicio),
    y: getY(item.pesoReal),
  }));

  const pointsEsperado = dataComEsperado.map((item) => ({
    ...item,
    x: getX(item.diasDesdeInicio),
    y: getY(item.pesoEsperado),
  }));

  const realLine = pointsReal.map((p) => `${p.x},${p.y}`).join(' ');
  const expectedLine = pointsEsperado.map((p) => `${p.x},${p.y}`).join(' ');

<<<<<<< HEAD
  // Ticks do eixo Y
  const yTicks = criarTicks(minPeso, maxPeso, 5);

  // Classes CSS condicionais
=======
  const yTicks = criarTicks(minPeso, maxPeso, 5);

>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  const realLineClass = abaixoDaMeta ? 'peso-line-real below' : 'peso-line-real ok';
  const realPointClass = abaixoDaMeta ? 'peso-point-real below' : 'peso-point-real ok';
  const realLegendClass = abaixoDaMeta ? 'peso-legend-line real below' : 'peso-legend-line real ok';

  return (
    <div className="peso-chart-wrap">
      <div className="peso-chart-legend">
        <div className="peso-legend-item">
          <span className={realLegendClass} />
          <span>
            Crescimento real {abaixoDaMeta ? '(abaixo da meta)' : '(na meta/acima)'}
          </span>
        </div>

        <div className="peso-legend-item">
          <span className="peso-legend-line expected" />
          <span>Crescimento esperado</span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="peso-chart-svg"
        preserveAspectRatio="none"
<<<<<<< HEAD
        role="img" // Indica que é uma imagem
        aria-labelledby="chart-title chart-desc" // Liga a um título e descrição
      >
        <title id="chart-title">Gráfico de Evolução de Peso do Lote</title>
        <desc id="chart-desc">
          Exibe o peso médio real e esperado do lote ao longo do tempo.
          O eixo X representa os dias desde a primeira pesagem.
          O eixo Y representa o peso médio em quilogramas.
          A linha real mostra o peso médio registrado.
          A linha esperada mostra o peso médio projetado com base na meta de GMD.
        </desc>

        {/* Eixo Y e linhas de grade */}
        {yTicks.map((tick, index) => (
          <YAxisTick
            key={index}
            y={getY(tick)}
            x1={paddingLeft}
            x2={width - paddingRight}
            label={formatarTick(tick)}
          />
        ))}

        {/* Linhas dos eixos */}
=======
      >
        {yTicks.map((tick, index) => {
          const y = getY(tick);

          return (
            <g key={index}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                className="peso-grid-line"
              />
              <text
                x={paddingLeft - 12}
                y={y + 4}
                textAnchor="end"
                className="peso-axis-tick"
              >
                {formatarTick(tick)}
              </text>
            </g>
          );
        })}

>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
        <line
          x1={paddingLeft}
          y1={paddingTop}
          x2={paddingLeft}
          y2={height - paddingBottom}
          className="peso-axis"
        />
        <line
          x1={paddingLeft}
          y1={height - paddingBottom}
          x2={width - paddingRight}
          y2={height - paddingBottom}
          className="peso-axis"
        />

<<<<<<< HEAD
        {/* Ticks e labels do eixo X */}
        {pointsReal.map((point) => (
          <XAxisTick
            key={`x-${point.id}`}
            x={point.x}
            y={height - paddingBottom}
            daysLabel={point.diasDesdeInicio}
            dateLabel={formatarDataCurta(point.data)}
          />
        ))}

        {/* Linha de crescimento esperado */}
=======
        {pointsReal.map((point) => (
          <g key={`x-${point.id}`}>
            <line
              x1={point.x}
              y1={height - paddingBottom}
              x2={point.x}
              y2={height - paddingBottom + 6}
              className="peso-axis"
            />
            <text
              x={point.x}
              y={height - paddingBottom + 22}
              textAnchor="middle"
              className="peso-axis-tick"
            >
              {point.diasDesdeInicio}
            </text>
            <text
              x={point.x}
              y={height - paddingBottom + 38}
              textAnchor="middle"
              className="peso-date-label"
            >
              {formatarDataCurta(point.data)}
            </text>
          </g>
        ))}

>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
        <polyline
          fill="none"
          points={expectedLine}
          className="peso-line-expected"
<<<<<<< HEAD
          aria-label="Linha de crescimento esperado"
        />

        {/* Linha de crescimento real */}
=======
        />

>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
        <polyline
          fill="none"
          points={realLine}
          className={realLineClass}
<<<<<<< HEAD
          aria-label="Linha de crescimento real"
        />

        {/* Pontos e labels de valor da linha real */}
=======
        />

>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
        {pointsReal.map((point, index) => {
          const isFirst = index === 0;
          const isLast = index === pointsReal.length - 1;

          let anchor = 'middle';
          let dx = 0;

          if (isFirst) {
            anchor = 'start';
            dx = 10;
          }

          if (isLast) {
            anchor = 'end';
            dx = -10;
          }

          return (
            <g key={point.id}>
<<<<<<< HEAD
              <circle
                cx={point.x}
                cy={point.y}
                r="5.5"
                className={realPointClass}
                aria-label={`Pesagem em ${formatarDataCurta(point.data)}: ${formatarTick(point.pesoReal)} kg`}
              />
=======
              <circle cx={point.x} cy={point.y} r="5.5" className={realPointClass} />
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
              <text
                x={point.x + dx}
                y={point.y - 12}
                textAnchor={anchor}
                className="peso-value-label"
              >
                {formatarTick(point.pesoReal)}
              </text>
            </g>
          );
        })}

<<<<<<< HEAD
        {/* Títulos dos eixos */}
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
        <text
          x={(paddingLeft + width - paddingRight) / 2}
          y={height - 12}
          textAnchor="middle"
          className="peso-axis-title"
        >
          Dias desde a 1ª pesagem
        </text>

        <text
          x={24}
          y={height / 2}
          textAnchor="middle"
          transform={`rotate(-90 24 ${height / 2})`}
          className="peso-axis-title"
        >
          Peso médio (kg)
        </text>
      </svg>
    </div>
  );
<<<<<<< HEAD
}
=======
}

function calcularDias(dataInicial, dataFinal) {
  if (!dataInicial || !dataFinal) return 0;

  const inicio = new Date(dataInicial);
  const fim = new Date(dataFinal);
  const diferencaMs = fim - inicio;
  const dias = Math.round(diferencaMs / (1000 * 60 * 60 * 24));

  return dias > 0 ? dias : 0;
}

function criarTicks(min, max, quantidade) {
  const passo = (max - min) / (quantidade - 1);
  return Array.from({ length: quantidade }, (_, i) => min + passo * i);
}

function formatarTick(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

function formatarDataCurta(data) {
  if (!data) return '—';
  const [, mes, dia] = data.split('-');
  return `${dia}/${mes}`;
}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
