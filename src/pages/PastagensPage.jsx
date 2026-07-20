import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../auth/useAuth';
import { useToast } from '../hooks/useToast';
import { gerarNovoId } from '../utils/id';
import {
  createOperationalRecord,
  deleteOperationalRecord,
  updateOperationalRecord,
} from '../services/operationalPersistence';
import {
  calcularCapacidadeTotalUa,
  calcularDiagnosticoCapacidade,
  calcularUaPorLote,
} from '../domain/unidadeAnimal';
import { calcularOcupacaoPastos } from '../domain/ocupacaoPastos';

function toNumber(value) {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value, digits = 2) {
  return toNumber(value).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function emptyForm() {
  return {
    fazenda_id: '',
    nome: '',
    area_ha: '',
    capacidade_suporte_ua_ha: '',
    status: 'ativo',
    observacoes: '',
  };
}

function getCapacityPresentation(indicadores) {
  if (indicadores.superlotacao) {
    return {
      label: 'Superlotado',
      badgeClass: 'summary-badge summary-badge--danger',
      rowClass: 'summary-row summary-row--alert',
      helper: 'A demanda animal está acima da capacidade das pastagens cadastradas.',
    };
  }

  return {
    label: 'Dentro da capacidade',
    badgeClass: 'summary-badge summary-badge--success',
    rowClass: 'summary-row summary-row--success',
    helper: 'A capacidade instalada atende a demanda atual da fazenda.',
  };
}

const LOTACAO_BADGE_CLASS = {
  vazio: 'summary-badge',
  sem_dados: 'summary-badge',
  ok: 'summary-badge summary-badge--success',
  atencao: 'summary-badge summary-badge--warning',
  acima_capacidade: 'summary-badge summary-badge--danger',
};

function getLotacaoBadgeClass(status) {
  return LOTACAO_BADGE_CLASS[status] || LOTACAO_BADGE_CLASS.sem_dados;
}

export default function PastagensPage({ db, setDb, session, onConfirmAction, navigationIntent = null }) {
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState(emptyForm());
  const [editando, setEditando] = useState(null);
  const formCardRef = useRef(null);

  // Sprint 28: CTA do estado vazio leva o produtor ao formulário (que já fica
  // no topo da página) em vez de deixá-lo sem próximo passo.
  function focarFormularioPasto() {
    const card = formCardRef.current;
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    card.querySelector('input, select, textarea')?.focus();
  }

  // "Novo pasto" nas Ações rápidas do Dashboard: não é modal (o cadastro já é
  // inline, sempre visível), então "abrir" aqui é rolar até ele e focar.
  useEffect(() => {
    if (navigationIntent?.page === 'pastagens' && navigationIntent?.action === 'novo') {
      focarFormularioPasto();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationIntent?.at]);

  const mensagemSemPermissao = 'Você não tem permissão para executar esta ação.';
  const pastagens = useMemo(() => (Array.isArray(db?.pastagens) ? db.pastagens : []), [db]);
  const fazendas = useMemo(() => (Array.isArray(db?.fazendas) ? db.fazendas : []), [db]);
  const fazendasMap = useMemo(
    () => new Map(fazendas.map((item) => [Number(item.id), item])),
    [fazendas]
  );

  const indicadores = useMemo(() => {
    const animais = Array.isArray(db?.animais) ? db.animais : [];
    const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
    const areaTotalPastagem = pastagens.reduce((sum, item) => sum + toNumber(item.area_ha), 0);
    const capacidadeTotalUa = calcularCapacidadeTotalUa(pastagens);
    // Cabeças totais e UA seguem lote.qtd de lotes ATIVOS (teste de campo
    // PST-2): antes somava animais[] cru, sem filtrar lote finalizado/
    // vendido — um lote encerrado continuava contando na capacidade da
    // fazenda para sempre.
    const cabecasTotais = lotes
      .filter((l) => String(l?.status || 'ativo') === 'ativo')
      .reduce((sum, l) => sum + toNumber(l.qtd), 0);
    const diagnostico = calcularDiagnosticoCapacidade({ animais, pastagens, lotes });
    const uaTotalFazenda = diagnostico.uaTotalFazenda;
    const taxaLotacaoUaHa = areaTotalPastagem > 0 ? uaTotalFazenda / areaTotalPastagem : 0;
    const lotacaoCabecaHa = areaTotalPastagem > 0 ? cabecasTotais / areaTotalPastagem : 0;
    const superlotacao = diagnostico.superlotado;
    const saldoCapacidadeUa = diagnostico.saldoCapacidadeUa;
    const statusCapacidade = diagnostico.statusCapacidade;
    const pastoAArrendarHa = superlotacao
      ? (uaTotalFazenda - capacidadeTotalUa) / Math.max(0.0001, taxaLotacaoUaHa || 1)
      : 0;

    return {
      areaTotalPastagem,
      capacidadeTotalUa,
      uaTotalFazenda,
      taxaLotacaoUaHa,
      lotacaoCabecaHa,
      superlotacao,
      pastoAArrendarHa,
      saldoCapacidadeUa,
      statusCapacidade,
    };
  }, [db, pastagens]);

  const uaPorLote = useMemo(
    () => (
      (Array.isArray(db?.lotes) ? db.lotes : []).map((lote) => ({
        id: lote.id,
        nome: lote.nome || `Lote ${lote.id}`,
        // 3º argumento: usa lote.qtd (canônico) como contagem, não animais[] cru.
        ua: calcularUaPorLote(Array.isArray(db?.animais) ? db.animais : [], lote.id, lote),
      }))
    ),
    [db]
  );

  const ocupacaoPorPastoMap = useMemo(() => {
    const mapa = new Map();
    calcularOcupacaoPastos(db).forEach((item) => mapa.set(String(item.id), item));
    return mapa;
  }, [db]);

  const capacityPresentation = getCapacityPresentation(indicadores);

  function resetForm() {
    setForm(emptyForm());
    setEditando(null);
  }

  function preencherForm(item) {
    setForm({
      fazenda_id: String(item?.fazenda_id ?? item?.faz_id ?? ''),
      nome: item?.nome || '',
      area_ha: String(item?.area_ha ?? ''),
      capacidade_suporte_ua_ha: String(item?.capacidade_suporte_ua_ha ?? ''),
      status: String(item?.status || 'ativo'),
      observacoes: item?.observacoes || item?.obs || '',
    });
    setEditando(item);
  }

  async function salvarPastagem() {
    if (!hasPermission('pastagens:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    if (!String(form.fazenda_id || '').trim()) {
      showToast({ type: 'warning', message: 'Selecione a fazenda vinculada.' });
      return;
    }
    if (!String(form.nome || '').trim()) {
      showToast({ type: 'warning', message: 'Informe o nome do pasto.' });
      return;
    }

    const payload = {
      faz_id: Number(form.fazenda_id),
      nome: String(form.nome || '').trim(),
      area_ha: toNumber(form.area_ha),
      capacidade_suporte_ua_ha: toNumber(form.capacidade_suporte_ua_ha),
      status: String(form.status || 'ativo'),
      observacoes: String(form.observacoes || '').trim(),
      obs: String(form.observacoes || '').trim(),
    };

    if (editando) {
      const persisted = await updateOperationalRecord('pastagens', editando.id, payload, session);
      if (persisted.persisted) {
        const merged = {
          ...editando,
          ...payload,
          ...(persisted.data || {}),
          id: persisted.data?.id ?? editando.id,
        };
        setDb((prev) => ({
          ...prev,
          pastagens: (prev.pastagens || []).map((item) => (
            item.id === editando.id ? merged : item
          )),
        }));
        showToast({ type: 'success', message: 'Pasto atualizado com sucesso.' });
      } else {
        showToast({ type: 'error', message: persisted.error || 'Não foi possível atualizar o pasto.' });
        return;
      }
    } else {
      const persisted = await createOperationalRecord('pastagens', payload, session);
      if (persisted.persisted) {
        setDb((prev) => ({
          ...prev,
          pastagens: [
            ...(prev.pastagens || []),
            {
              ...payload,
              ...(persisted.data || {}),
              id: persisted.data?.id ?? gerarNovoId(prev.pastagens || []),
            },
          ],
        }));
        showToast({ type: 'success', message: 'Pasto cadastrado com sucesso.' });
      } else {
        showToast({ type: 'error', message: persisted.error || 'Não foi possível cadastrar o pasto.' });
        return;
      }
    }

    resetForm();
  }

  async function excluirPastagem(item) {
    if (!hasPermission('pastagens:excluir')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    // P1 (teste de campo): o app excluía um pasto mesmo com lote ativo
    // vinculado, deixando `lote.pastagem_id` órfão — o próprio bot do
    // Telegram já bloqueava esse caso (`cadastroPasto.js::prepararExclusaoPasto`)
    // e documentava a lacuna aqui como um gap real do app; agora fechada,
    // com a mesma regra (bloqueia enquanto houver lote não encerrado).
    const loteOcupando = (Array.isArray(db?.lotes) ? db.lotes : []).find((l) => (
      String(l.pastagem_id) === String(item.id) && String(l?.status || 'ativo').toLowerCase() !== 'encerrado'
    ));
    if (loteOcupando) {
      showToast({ type: 'warning', message: `O lote "${loteOcupando.nome}" ainda está vinculado a este pasto. Retire-o antes de excluir.` });
      return;
    }
    const confirmado = typeof onConfirmAction === 'function'
      ? await onConfirmAction({
          title: 'Excluir pasto?',
          message: `Deseja excluir "${item.nome}"?`,
          tone: 'danger',
        })
      : window.confirm(`Deseja excluir "${item.nome}"?`);
    if (!confirmado) return;

    const persisted = await deleteOperationalRecord('pastagens', item.id, session);
    if (!persisted.persisted) {
      showToast({ type: 'warning', message: persisted.error || 'Não foi possível confirmar a exclusão agora.' });
      return;
    }
    setDb((prev) => ({
      ...prev,
      pastagens: (prev.pastagens || []).filter((row) => row.id !== item.id),
    }));
    showToast({ type: 'success', message: 'Pasto excluído.' });
  }

  return (
    <div className="page">
      <PageHeader
        title="Pastos"
        subtitle="Cadastre os pastos da fazenda para acompanhar onde cada lote está e receber alertas de lotação."
      />

      <div ref={formCardRef}>
      <Card title={editando ? 'Editar pasto' : 'Cadastrar pasto'}>
        <div className="form-grid two">
          <Input
            as="select"
            label="Fazenda vinculada"
            value={form.fazenda_id}
            onChange={(e) => setForm((prev) => ({ ...prev, fazenda_id: e.target.value }))}
          >
            <option value="">Selecione</option>
            {fazendas.map((fazenda) => (
              <option key={fazenda.id} value={fazenda.id}>{fazenda.nome}</option>
            ))}
          </Input>
          <Input
            label="Nome do pasto"
            value={form.nome}
            onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
          />
          <Input
            label="Área em hectares"
            type="number"
            value={form.area_ha}
            onChange={(e) => setForm((prev) => ({ ...prev, area_ha: e.target.value }))}
          />
          <Input
            label="Capacidade suporte UA/ha"
            type="number"
            value={form.capacidade_suporte_ua_ha}
            onChange={(e) => setForm((prev) => ({ ...prev, capacidade_suporte_ua_ha: e.target.value }))}
          />
          <Input
            as="select"
            label="Status"
            value={form.status}
            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
          >
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </Input>
          <Input
            className="full"
            as="textarea"
            label="Observações"
            value={form.observacoes}
            onChange={(e) => setForm((prev) => ({ ...prev, observacoes: e.target.value }))}
          />
        </div>
        <div className="action-row" style={{ marginTop: 12 }}>
          <Button icon={editando ? null : <Plus size={14} />} onClick={salvarPastagem} disabled={!hasPermission('pastagens:editar')}>
            {editando ? 'Salvar alterações' : 'Novo pasto'}
          </Button>
          {editando ? (
            <Button variant="ghost" onClick={resetForm}>Cancelar edição</Button>
          ) : null}
        </div>
      </Card>
      </div>

      {!pastagens.length ? (
        <Card title="Capacidade dos pastos">
          <div className="empty-state">
            <strong>Nenhum pasto cadastrado.</strong>
            <span>Cadastre pastos para acompanhar lotação, capacidade e movimentação dos lotes.</span>
            {hasPermission('pastagens:editar') ? (
              <Button icon={<Plus size={14} />} onClick={focarFormularioPasto} style={{ marginTop: 12 }}>Cadastrar pasto</Button>
            ) : null}
          </div>
        </Card>
      ) : (
        <div className="report-stack">
          <div className="report-kpi-grid">
            <article className="metric-tile metric-tile--success">
              <span className="metric-tile__label">Capacidade total</span>
              <strong className="metric-tile__value">{formatNumber(indicadores.capacidadeTotalUa, 2)} UA</strong>
              <span className="metric-tile__meta">Soma da capacidade instalada nas pastagens cadastradas.</span>
            </article>
            <article className="metric-tile">
              <span className="metric-tile__label">UA da fazenda</span>
              <strong className="metric-tile__value">{formatNumber(indicadores.uaTotalFazenda, 2)} UA</strong>
              <span className="metric-tile__meta">Demanda animal estimada com base no rebanho atualmente registrado.</span>
            </article>
            <article className="metric-tile">
              <span className="metric-tile__label">Taxa de lotação</span>
              <strong className="metric-tile__value">{formatNumber(indicadores.taxaLotacaoUaHa, 3)} UA/ha</strong>
              <span className="metric-tile__meta">Leitura consolidada da pressão de uso sobre a área de pasto disponível.</span>
            </article>
            <article className={`metric-tile ${indicadores.superlotacao ? 'metric-tile--warning' : 'metric-tile--success'}`}>
              <span className="metric-tile__label">Pasto a arrendar</span>
              <strong className="metric-tile__value">{formatNumber(indicadores.pastoAArrendarHa, 2)} ha</strong>
              <span className="metric-tile__meta">
                {indicadores.superlotacao
                  ? 'Área estimada necessária para reequilibrar a capacidade da fazenda.'
                  : 'Sem necessidade de arrendamento no cenário atual.'}
              </span>
            </article>
          </div>

          <Card
            title="Diagnóstico de capacidade"
            subtitle="Leitura operacional da área, capacidade instalada e pressão do rebanho sobre os pastos."
          >
            <div className="summary-panel">
              <div className="summary-list">
                <div className="summary-row">
                  <span className="summary-row__label">Área total de pasto</span>
                  <strong className="summary-row__value">{formatNumber(indicadores.areaTotalPastagem, 2)} ha</strong>
                </div>
                <div className="summary-row">
                  <span className="summary-row__label">Capacidade total</span>
                  <strong className="summary-row__value">{formatNumber(indicadores.capacidadeTotalUa, 2)} UA</strong>
                </div>
                <div className="summary-row">
                  <span className="summary-row__label">UA da fazenda</span>
                  <strong className="summary-row__value">{formatNumber(indicadores.uaTotalFazenda, 2)} UA</strong>
                </div>
                <div className="summary-row">
                  <span className="summary-row__label">Saldo entre capacidade e demanda</span>
                  <strong className="summary-row__value">{formatNumber(indicadores.saldoCapacidadeUa, 2)} UA</strong>
                </div>
                <div className={capacityPresentation.rowClass}>
                  <span className="summary-row__label">Status de capacidade</span>
                  <span className={capacityPresentation.badgeClass}>{capacityPresentation.label}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-row__label">Alerta de superlotação</span>
                  <strong className="summary-row__value">{indicadores.superlotacao ? 'Sim' : 'Não'}</strong>
                </div>
              </div>
              <div className={capacityPresentation.rowClass}>
                <span className="summary-row__label">Leitura recomendada</span>
                <strong className="summary-row__value">{capacityPresentation.helper}</strong>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Card title="UA por lote">
        {!uaPorLote.length ? (
          <div className="empty-state">
            <strong>Nenhum lote cadastrado.</strong>
            <span>Cadastre um lote para visualizar a estimativa de UA vinculada às pastagens.</span>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>UA estimada</th>
                </tr>
              </thead>
              <tbody>
                {uaPorLote.map((item) => (
                  <tr key={item.id}>
                    <td>{item.nome}</td>
                    <td>{formatNumber(item.ua, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Pastos cadastrados">
        {!pastagens.length ? (
          <div className="empty-state">
            <strong>Nenhum pasto cadastrado.</strong>
            <span>Cadastre pastos para acompanhar lotação, capacidade e movimentação dos lotes.</span>
            {hasPermission('pastagens:editar') ? (
              <Button icon={<Plus size={14} />} onClick={focarFormularioPasto} style={{ marginTop: 12 }}>Cadastrar pasto</Button>
            ) : null}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fazenda</th>
                  <th>Nome</th>
                  <th>Área (ha)</th>
                  <th>Suporte (UA/ha)</th>
                  <th>Capacidade (UA)</th>
                  <th>Status</th>
                  <th>Lotação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {pastagens.map((item) => {
                  const statusAtivo = String(item.status || 'ativo').toLowerCase() !== 'inativo';
                  const ocupacao = ocupacaoPorPastoMap.get(String(item.id));

                  return (
                    <tr key={item.id}>
                      <td>{fazendasMap.get(Number(item.fazenda_id ?? item.faz_id))?.nome || '—'}</td>
                      <td>{item.nome}</td>
                      <td>{formatNumber(item.area_ha, 2)}</td>
                      <td>{formatNumber(item.capacidade_suporte_ua_ha, 2)}</td>
                      <td>{formatNumber(toNumber(item.area_ha) * toNumber(item.capacidade_suporte_ua_ha), 2)}</td>
                      <td>
                        <span className={`summary-badge ${statusAtivo ? 'summary-badge--success' : 'summary-badge--warning'}`}>
                          {statusAtivo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td>
                        {ocupacao ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span>
                              {ocupacao.quantidadeLotes} {ocupacao.quantidadeLotes === 1 ? 'lote ativo' : 'lotes ativos'} · {formatNumber(ocupacao.cabecasEstimadas, 0)} cabeças estimadas
                            </span>
                            <span className={getLotacaoBadgeClass(ocupacao.status)}>{ocupacao.statusLabel}</span>
                            {ocupacao.status === 'acima_capacidade' ? (
                              <small style={{ color: 'var(--color-danger)' }}>Lotação acima da capacidade informada</small>
                            ) : null}
                            {ocupacao.status === 'sem_dados' ? (
                              <small style={{ color: 'var(--color-text-secondary)' }}>Informe área e capacidade para acompanhar a lotação.</small>
                            ) : null}
                          </div>
                        ) : '—'}
                      </td>
                      <td>
                        <div className="row-actions action-row">
                          <button className="action-btn" type="button" onClick={() => preencherForm(item)}>Editar</button>
                          <button className="action-btn action-btn-danger" type="button" onClick={() => excluirPastagem(item)}>Excluir</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
