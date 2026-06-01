import { useMemo, useState } from 'react';
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
  const parsed = Number(value);
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
    nome: '',
    area_ha: '',
    capacidade_suporte_ua_ha: '',
    custo_pasto_r_cab_mes: '',
    arrendamento_ativo: 'nao',
    area_arrendada_ha: '',
    custo_arrendamento_mes: '',
    observacoes: '',
  };
}

export default function PastagensPage({ db, setDb, session, onConfirmAction }) {
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState(emptyForm());
  const [editando, setEditando] = useState(null);

  const mensagemSemPermissao = 'Você não tem permissão para executar esta ação.';
  const pastagens = useMemo(() => (Array.isArray(db?.pastagens) ? db.pastagens : []), [db?.pastagens]);
  const animais = useMemo(() => (Array.isArray(db?.animais) ? db.animais : []), [db?.animais]);
  const lotes = useMemo(() => (Array.isArray(db?.lotes) ? db.lotes : []), [db?.lotes]);

  const indicadores = useMemo(() => {
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
      cabecasTotais,
      saldoCapacidadeUa,
      statusCapacidade,
    };
  }, [pastagens, animais]);

  const uaPorLote = useMemo(() => (
    lotes.map((lote) => ({
      id: lote.id,
      nome: lote.nome || `Lote ${lote.id}`,
      ua: calcularUaPorLote(animais, lote.id),
    }))
  ), [lotes, animais]);

  function resetForm() {
    setForm(emptyForm());
    setEditando(null);
  }

  function preencherForm(item) {
    setForm({
      nome: item?.nome || '',
      area_ha: String(item?.area_ha ?? ''),
      capacidade_suporte_ua_ha: String(item?.capacidade_suporte_ua_ha ?? ''),
      custo_pasto_r_cab_mes: String(item?.custo_pasto_r_cab_mes ?? ''),
      arrendamento_ativo: item?.arrendamento_ativo ? 'sim' : 'nao',
      area_arrendada_ha: String(item?.area_arrendada_ha ?? ''),
      custo_arrendamento_mes: String(item?.custo_arrendamento_mes ?? ''),
      observacoes: item?.observacoes || '',
    });
    setEditando(item);
  }

  async function salvarPastagem() {
    if (!hasPermission('pastagens:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    if (!String(form.nome || '').trim()) {
      showToast({ type: 'warning', message: 'Informe o nome da pastagem.' });
      return;
    }

    const payload = {
      nome: String(form.nome || '').trim(),
      area_ha: toNumber(form.area_ha),
      capacidade_suporte_ua_ha: toNumber(form.capacidade_suporte_ua_ha),
      custo_pasto_r_cab_mes: toNumber(form.custo_pasto_r_cab_mes),
      arrendamento_ativo: form.arrendamento_ativo === 'sim',
      area_arrendada_ha: toNumber(form.area_arrendada_ha),
      custo_arrendamento_mes: toNumber(form.custo_arrendamento_mes),
      observacoes: String(form.observacoes || '').trim(),
    };

    if (editando) {
      const persisted = await updateOperationalRecord('pastagens', editando.id, payload, session);
      setDb((prev) => ({
        ...prev,
        pastagens: (prev.pastagens || []).map((item) => (
          item.id === editando.id ? { ...item, ...(persisted.data || payload) } : item
        )),
      }));
      showToast({ type: 'success', message: 'Pastagem atualizada.' });
    } else {
      const persisted = await createOperationalRecord('pastagens', payload, session);
      setDb((prev) => ({
        ...prev,
        pastagens: [
          ...(prev.pastagens || []),
          persisted.data || { id: gerarNovoId(prev.pastagens || []), ...payload },
        ],
      }));
      showToast({ type: 'success', message: 'Pastagem cadastrada.' });
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
        title="Pastagens"
        subtitle="Gestão de capacidade de suporte e lotação da fazenda."
      />

      <Card title={editando ? 'Editar pastagem' : 'Cadastrar pastagem'}>
        <div className="form-grid two">
          <Input
            className="full"
            label="Nome da pastagem"
            value={form.nome}
            onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
          />
          <Input
            label="Área, ha"
            type="number"
            value={form.area_ha}
            onChange={(e) => setForm((prev) => ({ ...prev, area_ha: e.target.value }))}
          />
          <Input
            label="Capacidade de suporte, UA/ha"
            type="number"
            value={form.capacidade_suporte_ua_ha}
            onChange={(e) => setForm((prev) => ({ ...prev, capacidade_suporte_ua_ha: e.target.value }))}
          />
          <Input
            label="Custo do pasto, R$/cab/mês"
            type="number"
            value={form.custo_pasto_r_cab_mes}
            onChange={(e) => setForm((prev) => ({ ...prev, custo_pasto_r_cab_mes: e.target.value }))}
          />
          <Input
            as="select"
            label="Arrendamento ativo"
            value={form.arrendamento_ativo}
            onChange={(e) => setForm((prev) => ({ ...prev, arrendamento_ativo: e.target.value }))}
          >
            <option value="nao">Não</option>
            <option value="sim">Sim</option>
          </Input>
          <Input
            label="Área arrendada, ha"
            type="number"
            value={form.area_arrendada_ha}
            onChange={(e) => setForm((prev) => ({ ...prev, area_arrendada_ha: e.target.value }))}
          />
          <Input
            label="Custo do arrendamento, R$/mês"
            type="number"
            value={form.custo_arrendamento_mes}
            onChange={(e) => setForm((prev) => ({ ...prev, custo_arrendamento_mes: e.target.value }))}
          />
          <Input
            className="full"
            as="textarea"
            label="Observações"
            value={form.observacoes}
            onChange={(e) => setForm((prev) => ({ ...prev, observacoes: e.target.value }))}
          />
        </div>
        <div className="action-row" style={{ marginTop: 12 }}>
          <Button onClick={salvarPastagem} disabled={!hasPermission('pastagens:editar')}>
            {editando ? 'Salvar alterações' : 'Cadastrar pastagem'}
          </Button>
          {editando ? (
            <Button variant="ghost" onClick={resetForm}>Cancelar edição</Button>
          ) : null}
        </div>
      </Card>

      <div className="dashboard-grid dashboard-grid--kpi-main">
        <Card title="Capacidade total, UA">
          <strong>{formatNumber(indicadores.capacidadeTotalUa, 2)}</strong>
        </Card>
        <Card title="UA total da fazenda">
          <strong>{formatNumber(indicadores.uaTotalFazenda, 2)}</strong>
        </Card>
        <Card title="Taxa de lotação, UA/ha">
          <strong>{formatNumber(indicadores.taxaLotacaoUaHa, 3)}</strong>
        </Card>
        <Card title="Lotação em cabeças/ha">
          <strong>{formatNumber(indicadores.lotacaoCabecaHa, 3)}</strong>
        </Card>
      </div>

      <Card title="Diagnóstico de capacidade">
        <div className="metrics-2col">
          <p>Área total de pastagem: <strong>{formatNumber(indicadores.areaTotalPastagem, 2)} ha</strong></p>
          <p>Capacidade total: <strong>{formatNumber(indicadores.capacidadeTotalUa, 2)} UA</strong></p>
          <p>UA da fazenda: <strong>{formatNumber(indicadores.uaTotalFazenda, 2)} UA</strong></p>
          <p>Saldo entre capacidade e demanda: <strong>{formatNumber(indicadores.saldoCapacidadeUa, 2)} UA</strong></p>
          <p>Status: <strong>{indicadores.statusCapacidade === 'superlotado' ? 'Superlotado' : 'Dentro da capacidade'}</strong></p>
          <p>Alerta de superlotação: <strong>{indicadores.superlotacao ? 'Sim' : 'Não'}</strong></p>
          <p>Pasto a arrendar, ha: <strong>{formatNumber(indicadores.pastoAArrendarHa, 2)}</strong></p>
        </div>
      </Card>

      <Card title="UA por lote">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Lote</th>
                <th>UA estimada</th>
              </tr>
            </thead>
            <tbody>
              {!uaPorLote.length ? (
                <tr>
                  <td colSpan="2" className="empty-state-td">Nenhum lote cadastrado.</td>
                </tr>
              ) : uaPorLote.map((item) => (
                <tr key={item.id}>
                  <td>{item.nome}</td>
                  <td>{formatNumber(item.ua, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Pastagens cadastradas">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Área (ha)</th>
                <th>Suporte (UA/ha)</th>
                <th>Capacidade (UA)</th>
                <th>Custo pasto</th>
                <th>Arrendamento</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {!pastagens.length ? (
                <tr>
                  <td colSpan="7" className="empty-state-td">Nenhuma pastagem cadastrada.</td>
                </tr>
              ) : pastagens.map((item) => (
                <tr key={item.id}>
                  <td>{item.nome}</td>
                  <td>{formatNumber(item.area_ha, 2)}</td>
                  <td>{formatNumber(item.capacidade_suporte_ua_ha, 2)}</td>
                  <td>{formatNumber(toNumber(item.area_ha) * toNumber(item.capacidade_suporte_ua_ha), 2)}</td>
                  <td>R$ {formatNumber(item.custo_pasto_r_cab_mes, 2)}</td>
                  <td>{item.arrendamento_ativo ? 'Ativo' : 'Não'}</td>
                  <td>
                    <div className="row-actions action-row">
                      <button className="action-btn" type="button" onClick={() => preencherForm(item)}>Editar</button>
                      <button className="action-btn action-btn-danger" type="button" onClick={() => excluirPastagem(item)}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

