import { useMemo, useState } from 'react';
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

export default function PastagensPage({ db, setDb, session, onConfirmAction }) {
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState(emptyForm());
  const [editando, setEditando] = useState(null);

  const mensagemSemPermissao = 'Você não tem permissão para executar esta ação.';
  const pastagens = useMemo(() => (Array.isArray(db?.pastagens) ? db.pastagens : []), [db]);
  const fazendas = useMemo(() => (Array.isArray(db?.fazendas) ? db.fazendas : []), [db]);
  const fazendasMap = useMemo(
    () => new Map(fazendas.map((item) => [Number(item.id), item])),
    [fazendas]
  );

  const indicadores = useMemo(() => {
    const animais = Array.isArray(db?.animais) ? db.animais : [];
    const areaTotalPastagem = pastagens.reduce((sum, item) => sum + toNumber(item.area_ha), 0);
    const capacidadeTotalUa = calcularCapacidadeTotalUa(pastagens);
    const cabecasTotais = animais.reduce((sum, item) => sum + toNumber(item.qtd), 0);
    const diagnostico = calcularDiagnosticoCapacidade({ animais, pastagens });
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
        ua: calcularUaPorLote(Array.isArray(db?.animais) ? db.animais : [], lote.id),
      }))
    ),
    [db]
  );

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
      showToast({ type: 'warning', message: 'Informe o nome da pastagem.' });
      return;
    }

    const payload = {
      fazenda_id: Number(form.fazenda_id),
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
      if (persisted.persisted) {
        showToast({ type: 'success', message: 'Pastagem atualizada com sucesso.' });
      } else if (persisted.data) {
        showToast({ type: 'warning', message: 'Pastagem atualizada com sucesso.' });
      } else {
        showToast({ type: 'error', message: persisted.error || 'Não foi possível atualizar a pastagem.' });
      }
    } else {
      const persisted = await createOperationalRecord('pastagens', payload, session);
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
      if (persisted.persisted) {
        showToast({ type: 'success', message: 'Pastagem cadastrada com sucesso.' });
      } else if (persisted.data) {
        showToast({ type: 'warning', message: 'Pastagem cadastrada com sucesso.' });
      } else {
        showToast({ type: 'error', message: persisted.error || 'Não foi possível cadastrar a pastagem.' });
      }
    }

    resetForm();
  }

  async function excluirPastagem(item) {
    if (!hasPermission('pastagens:excluir')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    const confirmado = typeof onConfirmAction === 'function'
      ? await onConfirmAction({
          title: 'Excluir pastagem?',
          message: `Deseja excluir "${item.nome}"?`,
          tone: 'danger',
        })
      : window.confirm(`Deseja excluir "${item.nome}"?`);
    if (!confirmado) return;

    await deleteOperationalRecord('pastagens', item.id, session);
    setDb((prev) => ({
      ...prev,
      pastagens: (prev.pastagens || []).filter((row) => row.id !== item.id),
    }));
    showToast({ type: 'success', message: 'Pastagem excluída.' });
  }

  return (
    <div className="page">
      <PageHeader
        title="Pastos"
        subtitle="Cadastre pastagens vinculadas às fazendas para usar em lotes e planejamento."
      />

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

      {!pastagens.length ? (
        <Card title="Capacidade das pastagens">
          <div className="empty-state">
            <strong>Nenhuma pastagem cadastrada.</strong>
            <span>Cadastre uma pastagem para calcular capacidade, lotação e necessidade de arrendamento.</span>
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
              <span className="metric-tile__meta">Leitura consolidada da pressão de uso sobre a área de pastagem disponível.</span>
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
            subtitle="Leitura operacional da área, capacidade instalada e pressão do rebanho sobre as pastagens."
          >
            <div className="summary-panel">
              <div className="summary-list">
                <div className="summary-row">
                  <span className="summary-row__label">Área total de pastagem</span>
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
            <strong>Nenhuma pastagem cadastrada.</strong>
            <span>Cadastre uma pastagem vinculada à fazenda para liberar o vínculo com lotes e os indicadores de capacidade.</span>
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
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {pastagens.map((item) => {
                  const statusAtivo = String(item.status || 'ativo').toLowerCase() !== 'inativo';

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
