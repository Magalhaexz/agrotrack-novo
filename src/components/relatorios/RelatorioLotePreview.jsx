import Badge from '../ui/Badge';
import Card from '../ui/Card';
import SaudeLoteCard from '../lotes/SaudeLoteCard';
import { formatCurrency, formatDate, formatNumber } from '../../utils/calculations';
import '../../styles/decisoes.css';
import '../../styles/rebanho.css';
import '../../styles/relatorios.css';

const GMD_STATUS_LABEL = {
  acima: 'Acima da meta',
  dentro: 'Dentro da meta',
  abaixo: 'Abaixo da meta',
  sem_dados: 'Dados insuficientes',
};

const GMD_STATUS_BADGE = {
  acima: 'success',
  dentro: 'info',
  abaixo: 'danger',
  sem_dados: 'neutral',
};

/**
 * Relatório completo e "bonito" de um lote — cabeçalho, resumo, desempenho,
 * financeiro, saúde do lote, alertas e decisões sugeridas, com rodapé.
 * Não calcula nada: recebe o objeto pronto de `gerarResumoRelatorioLote`
 * (domain/relatorioLote.js) e só formata para exibição/impressão.
 * Usado tanto no modal "Gerar relatório do lote" (LotesPage) quanto na
 * página de Relatórios (RelatorioLotePage).
 */
export default function RelatorioLotePreview({ relatorio }) {
  if (!relatorio?.encontrado) {
    return (
      <div className="relatorio-lote-preview">
        <p className="ui-input-hint">Lote não encontrado.</p>
      </div>
    );
  }

  const {
    lote, fazenda, geradoEm,
    cabecas, pesoInicial, pesoAtual, pesoAlvo, dias,
    gmd, gmdEsperado, gmdDiferenca, gmdStatus,
    custoTotal, custoPorCabeca, custoPorArroba,
    receitaPrevista, lucroEstimado,
    saudeLote, alertas, decisoes,
    custoIndisponivel, receitaIndisponivel,
  } = relatorio;

  const temCabecas = toPositiveOrZero(cabecas) > 0;

  return (
    <div className="relatorio-lote-preview">
      {/* 1. Cabeçalho */}
      <header className="relatorio-lote-preview__cabecalho">
        <div>
          <span className="relatorio-lote-preview__marca">HERDON</span>
          <h2>{lote?.nome || 'Lote'}</h2>
          <p>{fazenda || 'Fazenda não vinculada'}</p>
        </div>
        <div className="relatorio-lote-preview__data">
          <span>Gerado em</span>
          <strong>{formatDate(toISODate(geradoEm))}</strong>
        </div>
      </header>

      {relatorio.dadosInsuficientes ? (
        <div className="report-note report-note--warning">
          <div>
            <strong>Dados insuficientes para um relatório completo.</strong>
            <span>{relatorio.mensagemDadosInsuficientes || 'Cadastre pesagens, animais e custos deste lote para completar o relatório.'}</span>
          </div>
        </div>
      ) : null}

      {/* 2. Resumo do lote */}
      <Card title="Resumo do lote">
        {!temCabecas ? (
          <p className="ui-input-hint">Cadastre animais neste lote para ver peso e desempenho.</p>
        ) : (
          <div className="summary-list">
            <Row label="Cabeças" value={formatNumber(cabecas, 0)} />
            <Row label="Peso inicial" value={`${formatNumber(pesoInicial, 1)} kg`} />
            <Row label="Peso atual" value={`${formatNumber(pesoAtual, 1)} kg`} />
            <Row label="Peso alvo" value={pesoAlvo ? `${formatNumber(pesoAlvo, 1)} kg` : 'Não definido'} />
            <Row label="Dias no lote" value={dias > 0 ? formatNumber(dias, 0) : 'Sem dados suficientes'} />
          </div>
        )}
      </Card>

      {/* 3. Desempenho */}
      <Card title="Desempenho">
        {gmdStatus === 'sem_dados' ? (
          <p className="ui-input-hint">Este lote ainda não tem pesagens suficientes para calcular o GMD.</p>
        ) : (
          <div className="summary-list">
            <Row label="GMD realizado" value={`${formatNumber(gmd, 2)} kg/dia`} />
            <Row label="GMD esperado" value={gmdEsperado ? `${formatNumber(gmdEsperado, 2)} kg/dia` : 'Sem meta definida'} />
            {gmdEsperado ? <Row label="Diferença" value={`${gmdDiferenca >= 0 ? '+' : ''}${formatNumber(gmdDiferenca, 2)} kg/dia`} /> : null}
            <div className="summary-row">
              <span className="summary-row__label">Status</span>
              <Badge variant={GMD_STATUS_BADGE[gmdStatus]}>{GMD_STATUS_LABEL[gmdStatus]}</Badge>
            </div>
          </div>
        )}
      </Card>

      {/* 4. Financeiro */}
      <Card title="Financeiro">
        {custoIndisponivel ? (
          <p className="ui-input-hint">Custo ainda não informado para este lote.</p>
        ) : (
          <div className="summary-list">
            <Row label="Custo total" value={formatCurrency(custoTotal)} />
            <Row label="Custo por cabeça" value={formatCurrency(custoPorCabeca)} />
            <Row label="Custo por arroba" value={formatCurrency(custoPorArroba)} />
          </div>
        )}
        {receitaIndisponivel ? (
          <p className="ui-input-hint">Receita prevista e lucro estimado aparecem quando o lote tiver peso e custo suficientes para a simulação de venda.</p>
        ) : (
          <div className="summary-list">
            <Row label="Receita prevista (se vender hoje)" value={formatCurrency(receitaPrevista)} />
            <Row label="Lucro estimado (se vender hoje)" value={formatCurrency(lucroEstimado)} />
          </div>
        )}
      </Card>

      {/* 5. Saúde do lote */}
      <SaudeLoteCard saude={saudeLote} titulo="Saúde do lote" />

      {/* 6. Alertas */}
      <Card title="Alertas">
        {!alertas?.length ? (
          <div className="decisoes-vazio">
            <span>Nenhum alerta para este lote no momento.</span>
          </div>
        ) : (
          <ul className="decisoes-lista">
            {alertas.map((alerta) => (
              <li key={alerta.chave} className="decisoes-item decisoes-item--medio">
                <div className="decisoes-item__cabecalho">
                  <strong className="decisoes-item__titulo">{alerta.titulo}</strong>
                </div>
                <p className="decisoes-item__linha">{alerta.descricao}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 7. Decisões sugeridas */}
      <Card title="Decisões sugeridas">
        {!decisoes?.length ? (
          <p className="ui-input-hint">Nenhuma decisão sugerida no momento.</p>
        ) : (
          <ul className="relatorio-lote-preview__decisoes">
            {decisoes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </Card>

      {/* 8. Rodapé */}
      <footer className="relatorio-lote-preview__rodape">
        <span>Relatório gerado pelo HERDON em {formatDate(toISODate(geradoEm))}</span>
        <span>Os dados deste relatório dependem dos lançamentos cadastrados no HERDON.</span>
      </footer>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="summary-row">
      <span className="summary-row__label">{label}</span>
      <strong className="summary-row__value">{value ?? '—'}</strong>
    </div>
  );
}

function toPositiveOrZero(value) {
  const numero = Number(value);
  return Number.isFinite(numero) && numero > 0 ? numero : 0;
}

function toISODate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}
