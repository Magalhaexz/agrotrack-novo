import { useMemo, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { useToast } from '../hooks/useToast';
import { aplicarRateioCustoCompartilhado } from '../services/custosCompartilhados';
import { formatarMoeda } from '../utils/formatters';

const CRITERIOS = [
  { id: 'cabecas', label: 'Por nº de cabeças' },
  { id: 'peso', label: 'Por peso total do lote' },
  { id: 'igualitario', label: 'Igualitário (partes iguais)' },
];

const CATEGORIAS = [
  { id: 'custo_indireto', label: 'Custo Indireto' },
  { id: 'mao_de_obra', label: 'Mão de Obra' },
  { id: 'arrendamento', label: 'Arrendamento' },
  { id: 'energia', label: 'Energia' },
  { id: 'manutencao', label: 'Manutenção' },
  { id: 'administrativo', label: 'Administrativo' },
  { id: 'outros', label: 'Outros' },
];

const hoje = new Date().toISOString().slice(0, 10);

function calcularPrevia(db, form) {
  if (!form.valor || Number(form.valor) <= 0) return [];
  if (!form.criterio) return [];
  if (form.loteIds.length === 0) return [];

  const lotes = (db?.lotes || []).filter((l) =>
    form.loteIds.includes(Number(l.id))
  );
  if (lotes.length === 0) return [];

  const valor = Number(form.valor);

  if (form.criterio === 'cabecas') {
    const totalCabecas = lotes.reduce((s, l) => s + Number(l.qtd || 0), 0);
    if (!totalCabecas) return lotes.map((l) => ({ lote: l, valor: 0 }));
    return lotes.map((l) => ({
      lote: l,
      valor: (Number(l.qtd || 0) / totalCabecas) * valor,
    }));
  }

  if (form.criterio === 'peso') {
    const totalPeso = lotes.reduce((s, l) => s + Number(l.qtd || 0) * Number(l.p_at || 0), 0);
    if (!totalPeso) return lotes.map((l) => ({ lote: l, valor: 0 }));
    return lotes.map((l) => ({
      lote: l,
      valor: ((Number(l.qtd || 0) * Number(l.p_at || 0)) / totalPeso) * valor,
    }));
  }

  // igualitário
  const parte = valor / lotes.length;
  return lotes.map((l) => ({ lote: l, valor: parte }));
}

export default function CustosCompartilhadosPage({ db, setDb }) {
  const { hasPermission, session, user } = useAuth();
  const { showToast } = useToast();

  const [form, setForm] = useState({
    descricao: '',
    valor: '',
    data: hoje,
    categoria: 'custo_indireto',
    criterio: 'cabecas',
    loteIds: [],
  });

  const [resultado, setResultado] = useState(null);
  const [confirmando, setConfirmando] = useState(false);

  const lotesAtivos = useMemo(
    () => (Array.isArray(db?.lotes) ? db.lotes.filter((l) => l.status === 'ativo') : []),
    [db]
  );

  const previa = useMemo(() => calcularPrevia(db, form), [db, form]);

  const podeLancar = hasPermission('financeiro:editar');

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setResultado(null);
  }

  function toggleLote(id) {
    setForm((prev) => {
      const numId = Number(id);
      const jaIncluso = prev.loteIds.includes(numId);
      return {
        ...prev,
        loteIds: jaIncluso
          ? prev.loteIds.filter((x) => x !== numId)
          : [...prev.loteIds, numId],
      };
    });
    setResultado(null);
  }

  function selecionarTodos() {
    setForm((prev) => ({ ...prev, loteIds: lotesAtivos.map((l) => Number(l.id)) }));
    setResultado(null);
  }

  function limparSelecao() {
    setForm((prev) => ({ ...prev, loteIds: [] }));
    setResultado(null);
  }

  function handleConfirmar() {
    if (!podeLancar) {
      showToast({ type: 'error', message: 'Você não tem permissão para lançar custos.' });
      return;
    }

    setConfirmando(true);
    try {
      const dados = {
        descricao: form.descricao,
        valor: Number(form.valor),
        data: form.data,
        categoria: form.categoria,
        criterio: form.criterio,
        loteIds: form.loteIds,
      };

      const userContext = { id: user?.id, email: user?.email };
      const persistContext = { session, persist: true };

      const { db: dbAtualizado, rateio } = aplicarRateioCustoCompartilhado(
        db,
        dados,
        userContext,
        persistContext
      );

      setDb(dbAtualizado);
      setResultado(rateio);
      setForm({
        descricao: '',
        valor: '',
        data: hoje,
        categoria: 'custo_indireto',
        criterio: 'cabecas',
        loteIds: [],
      });
      showToast({ type: 'success', message: 'Custo compartilhado lançado com sucesso.' });
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Erro ao aplicar rateio.' });
    } finally {
      setConfirmando(false);
    }
  }

  const formValido =
    form.descricao.trim() &&
    Number(form.valor) > 0 &&
    form.data &&
    form.criterio &&
    form.loteIds.length > 0;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Rateio de Custos</h1>
        <p className="page-subtitle">
          Lance um custo compartilhado entre lotes. O sistema distribui o valor e gera
          uma despesa por lote automaticamente.
        </p>
      </div>

      <div className="dashboard-grid dashboard-grid--dual">
        {/* ── Formulário ── */}
        <div className="ui-card">
          <div className="card-header">
            <span className="card-title">Dados do custo</span>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Descrição *</label>
              <input
                className="form-input"
                type="text"
                placeholder="Ex: Energia elétrica de junho"
                value={form.descricao}
                onChange={(e) => setField('descricao', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Valor total (R$) *</label>
              <input
                className="form-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={form.valor}
                onChange={(e) => setField('valor', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Data *</label>
              <input
                className="form-input"
                type="date"
                value={form.data}
                onChange={(e) => setField('data', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Categoria</label>
              <select
                className="form-input"
                value={form.categoria}
                onChange={(e) => setField('categoria', e.target.value)}
              >
                {CATEGORIAS.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Critério de rateio *</label>
              <select
                className="form-input"
                value={form.criterio}
                onChange={(e) => setField('criterio', e.target.value)}
              >
                {CRITERIOS.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                Lotes participantes *
                <span style={{ marginLeft: 8 }}>
                  <button
                    type="button"
                    className="btn btn-xs btn-outline"
                    onClick={selecionarTodos}
                    style={{ marginRight: 4 }}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    className="btn btn-xs btn-outline"
                    onClick={limparSelecao}
                  >
                    Limpar
                  </button>
                </span>
              </label>

              {lotesAtivos.length === 0 ? (
                <p className="empty-state-text">Nenhum lote ativo encontrado.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {lotesAtivos.map((lote) => (
                    <label
                      key={lote.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        checked={form.loteIds.includes(Number(lote.id))}
                        onChange={() => toggleLote(lote.id)}
                      />
                      <span>{lote.nome}</span>
                      <span className="badge badge-neutral" style={{ fontSize: 11 }}>
                        {lote.qtd || 0} cab · {lote.p_at || 0} kg
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Prévia e confirmação ── */}
        <div>
          <div className="ui-card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <span className="card-title">Prévia do rateio</span>
            </div>
            <div className="card-body">
              {previa.length === 0 ? (
                <p className="empty-state-text">
                  Preencha o valor, o critério e selecione ao menos um lote para ver a prévia.
                </p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Lote</th>
                      <th style={{ textAlign: 'right' }}>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previa.map(({ lote, valor }) => (
                      <tr key={lote.id}>
                        <td>{lote.nome}</td>
                        <td style={{ textAlign: 'right' }}>{formatarMoeda(valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td><strong>Total</strong></td>
                      <td style={{ textAlign: 'right' }}>
                        <strong>
                          {formatarMoeda(previa.reduce((s, r) => s + r.valor, 0))}
                        </strong>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={!formValido || confirmando || !podeLancar}
            onClick={handleConfirmar}
          >
            {confirmando ? 'Lançando...' : 'Confirmar e gerar despesas'}
          </button>

          {!podeLancar && (
            <p style={{ color: 'var(--color-danger)', marginTop: 8, fontSize: 13 }}>
              Você não tem permissão para lançar custos.
            </p>
          )}
        </div>
      </div>

      {/* ── Resultado do último rateio ── */}
      {resultado && (
        <div className="ui-card" style={{ marginTop: 24 }}>
          <div className="card-header">
            <span className="card-title">Despesas geradas</span>
          </div>
          <div className="card-body">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th style={{ textAlign: 'right' }}>Despesa lançada</th>
                </tr>
              </thead>
              <tbody>
                {resultado.map((r) => (
                  <tr key={r.lote_id}>
                    <td>{r.lote_nome}</td>
                    <td style={{ textAlign: 'right' }}>{formatarMoeda(r.custoRateado)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td><strong>Total lançado</strong></td>
                  <td style={{ textAlign: 'right' }}>
                    <strong>
                      {formatarMoeda(resultado.reduce((s, r) => s + r.custoRateado, 0))}
                    </strong>
                  </td>
                </tr>
              </tfoot>
            </table>
            <p style={{ marginTop: 8, color: 'var(--color-success)', fontSize: 13 }}>
              As despesas foram registradas em cada lote e já aparecem no financeiro.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
