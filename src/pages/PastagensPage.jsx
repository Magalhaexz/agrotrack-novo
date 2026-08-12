import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, MapPin, Plus, Users } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../auth/useAuth';
import { useToast } from '../hooks/useToast';
import { gerarNovoId } from '../utils/id';
import { isModoConsolidado } from '../domain/escopoFazenda';
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
import '../styles/pastagens.css';

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

export default function PastagensPage({ db, setDb, session, onConfirmAction, navigationIntent = null, fazendaSelecionada = null }) {
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
  const consolidado = isModoConsolidado(fazendaSelecionada);
  const contextoFazenda = consolidado ? 'Todas as fazendas' : (fazendaSelecionada?.nome || 'Nenhuma fazenda selecionada');

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
        subtitle={
          <span className="pastagens-header-context">
            {contextoFazenda}
            <span className="pastagens-header-context-dot" aria-hidden="true">·</span>
            {pastagens.length} {pastagens.length === 1 ? 'pasto' : 'pastos'}
          </span>
        }
        actions={
          <Button
            icon={<Plus size={14} />}
            onClick={focarFormularioPasto}
            disabled={!hasPermission('pastagens:editar')}
            title={!hasPermission('pastagens:editar') ? mensagemSemPermissao : undefined}
          >
            Cadastrar pasto
          </Button>
        }
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
        // Sprint Visual 3 (hierarquia de CTAs): sem botão aqui — o formulário
        // de cadastro já está sempre visível logo acima, então um CTA
        // "Cadastrar pasto" repetindo a ação do header + do form não orienta
        // nada, só duplica visualmente. O CTA de empty state fica só no card
        // "Pastos cadastrados" abaixo, mais longe do formulário.
        <Card title="Capacidade dos pastos">
          <EmptyState
            title="Nenhum pasto cadastrado."
            subtitle="Cadastre pastos para acompanhar lotação, capacidade e movimentação dos lotes."
          />
        </Card>
      ) : (
        <div className="report-stack">
          <div className="dashboard-grid dashboard-grid--kpi-main">
            <div className="kpi-card kpi-card--compact">
              <div className="kpi-content">
                <div className="kpi-label">Área total</div>
                <div className="kpi-value">{formatNumber(indicadores.areaTotalPastagem, 2)} ha</div>
              </div>
            </div>
            <div className="kpi-card kpi-card--compact">
              <div className="kpi-content">
                <div className="kpi-label">Capacidade total</div>
                <div className="kpi-value">{formatNumber(indicadores.capacidadeTotalUa, 2)} UA</div>
              </div>
            </div>
            <div className="kpi-card kpi-card--compact">
              <div className="kpi-content">
                <div className="kpi-label">UA da fazenda</div>
                <div className="kpi-value">{formatNumber(indicadores.uaTotalFazenda, 2)} UA</div>
              </div>
            </div>
            <div className="kpi-card kpi-card--compact">
              <div className="kpi-content">
                <div className="kpi-label">Taxa de lotação</div>
                <div className={indicadores.superlotacao ? 'kpi-val rd' : 'kpi-value'}>{formatNumber(indicadores.taxaLotacaoUaHa, 3)} UA/ha</div>
              </div>
            </div>
          </div>

          <Card
            title="Diagnóstico de capacidade"
            subtitle={capacityPresentation.helper}
          >
            <div className="summary-panel">
              <div className="summary-list">
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
                <div className="summary-row">
                  <span className="summary-row__label">Pasto a arrendar</span>
                  <strong className="summary-row__value">
                    {indicadores.superlotacao ? `${formatNumber(indicadores.pastoAArrendarHa, 2)} ha` : 'Sem necessidade no cenário atual'}
                  </strong>
                </div>
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
          <EmptyState
            title="Nenhum pasto cadastrado."
            subtitle="Cadastre pastos para acompanhar lotação, capacidade e movimentação dos lotes."
            action={
              hasPermission('pastagens:editar') ? (
                // Sprint Visual 3: secondary — "Cadastrar pasto" do header já é
                // o CTA primário da página, este é o único CTA de empty state
                // que sobrou (o outro card removeu o dele por duplicidade).
                <Button variant="secondary" icon={<Plus size={14} />} onClick={focarFormularioPasto}>Cadastrar pasto</Button>
              ) : null
            }
          />
        ) : (
          <div className="pastos-grid">
            {pastagens.map((item) => {
              const statusAtivo = String(item.status || 'ativo').toLowerCase() !== 'inativo';
              const ocupacao = ocupacaoPorPastoMap.get(String(item.id));
              const percentual = ocupacao?.percentualOcupacao != null ? Math.round(ocupacao.percentualOcupacao * 100) : null;

              return (
                <div key={item.id} className="pasto-card">
                  <div className="pasto-card-top">
                    <div className="pasto-card-heading">
                      <h3>{item.nome}</h3>
                      <p className="pasto-card-farm">{fazendasMap.get(Number(item.fazenda_id ?? item.faz_id))?.nome || 'Sem fazenda'}</p>
                    </div>
                    <div className="pasto-card-badges">
                      <span className={`summary-badge ${statusAtivo ? 'summary-badge--success' : 'summary-badge--warning'}`}>
                        {statusAtivo ? 'Ativo' : 'Inativo'}
                      </span>
                      {ocupacao ? <span className={getLotacaoBadgeClass(ocupacao.status)}>{ocupacao.statusLabel}</span> : null}
                    </div>
                  </div>

                  <div className="pasto-card-stats">
                    <div className="pasto-card-stat pasto-card-stat--primary">
                      <MapPin size={15} aria-hidden="true" />
                      <strong>{formatNumber(item.area_ha, 2)} ha</strong>
                      <span>área</span>
                    </div>
                    <div className="pasto-card-stat pasto-card-stat--primary">
                      <Users size={15} aria-hidden="true" />
                      <strong>{formatNumber(toNumber(item.area_ha) * toNumber(item.capacidade_suporte_ua_ha), 2)} UA</strong>
                      <span>capacidade</span>
                    </div>
                    <div className="pasto-card-stat">
                      <span>{ocupacao ? `${ocupacao.quantidadeLotes} ${ocupacao.quantidadeLotes === 1 ? 'lote ativo' : 'lotes ativos'}` : 'Sem lote vinculado'}</span>
                    </div>
                    <div className="pasto-card-stat">
                      <span>{ocupacao ? `${formatNumber(ocupacao.cabecasEstimadas, 0)} cabeças estimadas` : '—'}</span>
                    </div>
                  </div>

                  {ocupacao?.lotesAtivos?.length ? (
                    <div className="pasto-card-lotes">
                      {ocupacao.lotesAtivos.map((lote) => (
                        <span key={lote.id} className="pasto-card-lote-chip">{lote.nome}</span>
                      ))}
                    </div>
                  ) : null}

                  {percentual !== null ? (
                    <div className="pasto-card-progress">
                      <div className="pasto-card-progress-head">
                        <span>Lotação</span>
                        <span>{percentual}%</span>
                      </div>
                      <div className="progress-bar-container">
                        <div
                          className={`progress-bar-fill ${ocupacao.status === 'acima_capacidade' ? 'danger' : ocupacao.status === 'atencao' ? 'warning' : ''}`}
                          style={{ width: `${Math.min(Math.max(percentual, 4), 100)}%` }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {ocupacao?.status === 'acima_capacidade' ? (
                    <p className="pasto-card-alert"><AlertTriangle size={13} aria-hidden="true" /> Lotação acima da capacidade informada</p>
                  ) : null}
                  {ocupacao?.status === 'sem_dados' ? (
                    <p className="pasto-card-hint">Informe área e capacidade para acompanhar a lotação.</p>
                  ) : null}

                  <div className="pasto-card-actions">
                    <div className="pasto-actions-group">
                      <button className="action-btn" type="button" onClick={() => preencherForm(item)} disabled={!hasPermission('pastagens:editar')}>Editar</button>
                    </div>
                    <div className="pasto-actions-group pasto-actions-group--destructive">
                      <button className="action-btn action-btn-danger" type="button" onClick={() => excluirPastagem(item)} disabled={!hasPermission('pastagens:excluir')}>Excluir</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
