import { useMemo, useState, useCallback } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import { formatCurrency, formatDate, formatNumber } from '../utils/calculations';
import { gerarNovoId } from '../utils/id';
import { useToast } from '../hooks/useToast'; // Assuming useToast hook is available

export default function SuplementacaoPage({ db, setDb }) {
  const { showToast } = useToast();
  const [openDieta, setOpenDieta] = useState(false);
  const [openConsumo, setOpenConsumo] = useState(false);
  const [dietaEditando, setDietaEditando] = useState(null);

  // Pre-index data for efficient lookups
  const lotesMap = useMemo(() => new Map((db.lotes || []).map(l => [l.id, l])), [db.lotes]);
  const animaisMap = useMemo(() => {
    const map = new Map();
    (db.animais || []).forEach(a => {
      if (!map.has(a.lote_id)) map.set(a.lote_id, []);
      map.get(a.lote_id).push(a);
    });
    return map;
  }, [db.animais]);
  const dietasMap = useMemo(() => new Map((db.dietas || []).map(d => [d.lote_id, d])), [db.dietas]);
  const consumoSuplementacaoMap = useMemo(() => {
    const map = new Map();
    (db.consumo_suplementacao || []).forEach(c => {
      if (!map.has(c.lote_id)) map.set(c.lote_id, []);
      map.get(c.lote_id).push(c);
    });
    return map;
  }, [db.consumo_suplementacao]);
  const estoqueMap = useMemo(() => new Map((db.estoque || []).map(e => [e.id, e])), [db.estoque]);

  const lotesAtivos = useMemo(() => (db.lotes || []).filter((l) => l.status === 'ativo'), [db.lotes]);

  const consumoRows = useMemo(() => {
    return lotesAtivos.map((lote) => {
      const dieta = dietasMap.get(lote.id);
      const cabecas = (animaisMap.get(lote.id) || []).reduce((s, a) => s + Number(a.qtd || 0), 0);
      const previstoDia = dieta ? dieta.itens.reduce((s, i) => s + Number(i.qtd_cab_dia || 0) * cabecas, 0) : 0;
      const reais = consumoSuplementacaoMap.get(lote.id) || [];
      const realDia = reais.length ? reais.reduce((s, r) => s + Number(r.qtd_total || 0), 0) / reais.length : 0;
      return { lote, dieta, cabecas, previstoDia, realDia, diff: realDia - previstoDia };
    });
  }, [lotesAtivos, dietasMap, animaisMap, consumoSuplementacaoMap]);

  const projecao = useMemo(() => {
    const itemConsumoTotalMap = new Map(); // Map<itemId, totalConsumoDia>
    consumoRows.forEach((r) => {
      if (!r.dieta) return;
      r.dieta.itens.forEach((it) => {
        const currentConsumo = itemConsumoTotalMap.get(it.item_estoque_id) || 0;
        itemConsumoTotalMap.set(it.item_estoque_id, currentConsumo + Number(it.qtd_cab_dia || 0) * r.cabecas);
      });
    });

    return Array.from(itemConsumoTotalMap.entries()).map(([itemId, consumoDia]) => {
      const item = estoqueMap.get(Number(itemId));
      const saldo = Number(item?.quantidade_atual || 0);
      const dias = consumoDia > 0 ? saldo / consumoDia : 999;
      return { item, consumoDia, dias };
    });
  }, [consumoRows, estoqueMap]);

  const handleEditDieta = useCallback((dieta) => {
    setDietaEditando(dieta);
    setOpenDieta(true);
  }, []);

  const handleDeleteDieta = useCallback((dietaId) => {
    setDb(prevDb => ({
      ...prevDb,
      dietas: (prevDb.dietas || []).filter(d => d.id !== dietaId)
    }));
    showToast({ type: 'success', message: 'Dieta excluída com sucesso!' });
  }, [setDb, showToast]);

  return (
    <div className="page suplementacao-page">
      <header className="page-header">
        <h1>Suplementação</h1>
        <p>Gerencie dietas, consumo e projeção de estoque de suplementos.</p>
        <div className="page-actions">
          <Button onClick={() => { setDietaEditando(null); setOpenDieta(true); }}>+ Cadastrar dieta</Button>
          <Button variant="outline" onClick={() => setOpenConsumo(true)}>Registrar consumo diário</Button>
        </div>
      </header>

      <Card title="Dietas vinculadas por lote">
        <div className="table-responsive">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Dieta</th>
                <th>Itens</th>
                <th>Qtd. Prevista/Dia</th>
                <th>Qtd. Real/Dia</th>
                <th>Diferença</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {consumoRows.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state-td">Nenhuma dieta vinculada a lotes ativos.</td>
                </tr>
              ) : (
                consumoRows.map((row) => (
                  <tr key={row.lote.id}>
                    <td>{row.lote.nome}</td>
                    <td>{row.dieta?.nome || '—'}</td>
                    <td>{row.dieta?.itens.length || 0}</td>
                    <td>{formatNumber(row.previstoDia, 2)} kg</td>
                    <td>{formatNumber(row.realDia, 2)} kg</td>
                    <td>
                      <Badge variant={row.diff > 0 ? 'success' : row.diff < 0 ? 'danger' : 'neutral'}>
                        {formatNumber(row.diff, 2)} kg
                      </Badge>
                    </td>
                    <td>
                      <div className="row-actions">
                        {row.dieta && (
                          <button className="action-btn" onClick={() => handleEditDieta(row.dieta)}>Editar Dieta</button>
                        )}
                        {row.dieta && (
                          <button className="action-btn action-btn-danger" onClick={() => handleDeleteDieta(row.dieta.id)}>Excluir Dieta</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Projeção de consumo de estoque">
        <div className="table-responsive">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Item de Estoque</th>
                <th>Consumo Diário Total</th>
                <th>Saldo Atual</th>
                <th>Dias Restantes</th>
              </tr>
            </thead>
            <tbody>
              {projecao.length === 0 ? (
                <tr>
                  <td colSpan="4" className="empty-state-td">Nenhuma projeção disponível.</td>
                </tr>
              ) : (
                projecao.map((p, index) => (
                  <tr key={index}>
                    <td>{p.item?.produto || '—'}</td>
                    <td>{formatNumber(p.consumoDia, 2)} kg</td>
                    <td>{formatNumber(p.item?.quantidade_atual || 0, 2)} kg</td>
                    <td>
                      <Badge variant={p.dias < 7 ? 'danger' : p.dias < 30 ? 'warning' : 'success'}>
                        {p.dias === 999 ? '∞' : formatNumber(p.dias, 0)} dias
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {openDieta && (
        <DietaModal
          db={db}
          setDb={setDb}
          initialData={dietaEditando}
          onClose={() => { setOpenDieta(false); setDietaEditando(null); }}
          showToast={showToast}
        />
      )}

      {openConsumo && (
        <ConsumoModal
          db={db}
          setDb={setDb}
          onClose={() => setOpenConsumo(false)}
          showToast={showToast}
        />
      )}
    </div>
  );
}

/**
 * Modal para cadastrar ou editar uma dieta.
 * @param {object} props - As propriedades do componente.
 * @param {object} props.db - O objeto do banco de dados.
 * @param {function} props.setDb - Função para atualizar o banco de dados.
 * @param {object} [props.initialData] - Dados iniciais da dieta para edição.
 * @param {function} props.onClose - Callback para fechar o modal.
 * @param {function} props.showToast - Função para exibir toasts.
 */
function DietaModal({ db, setDb, initialData, onClose, showToast }) {
  const [form, setForm] = useState(initialData || {
    id: gerarNovoId(db.dietas || []),
    nome: '',
    lote_id: '',
    itens: [],
  });
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [errors, setErrors] = useState({});

  const lotesComDieta = useMemo(() => new Set((db.dietas || []).filter(d => d.id !== form.id).map(d => d.lote_id)), [db.dietas, form.id]);
  const lotesSemDieta = useMemo(() => (db.lotes || []).filter(l => l.status === 'ativo' && !lotesComDieta.has(l.id)), [db.lotes, lotesComDieta]);

  const validate = useCallback(() => {
    const newErrors = {};
    if (!form.nome.trim()) newErrors.nome = 'Nome da dieta é obrigatório.';
    if (!form.lote_id) newErrors.lote_id = 'Lote é obrigatório.';
    if (form.itens.length === 0) newErrors.itens = 'Adicione pelo menos um item à dieta.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form]);

  const addItem = useCallback(() => setEditingItemIndex(form.itens.length), [form.itens.length]);
  const removeItem = useCallback((index) => {
    setForm(prev => ({ ...prev, itens: prev.itens.filter((_, i) => i !== index) }));
  }, []);
  const saveItem = useCallback((itemData) => {
    setForm(prev => {
      const newItems = [...prev.itens];
      if (editingItemIndex !== null && editingItemIndex < newItems.length) {
        newItems[editingItemIndex] = itemData;
      } else {
        newItems.push(itemData);
      }
      return { ...prev, itens: newItems };
    });
    setEditingItemIndex(null);
  }, [editingItemIndex]);

  const submit = useCallback(() => {
    if (!validate()) {
      showToast({ type: 'error', message: 'Por favor, corrija os erros no formulário.' });
      return;
    }

    setDb(prevDb => {
      const existingDietas = prevDb.dietas || [];
      if (initialData) {
        return {
          ...prevDb,
          dietas: existingDietas.map(d => d.id === form.id ? form : d)
        };
      } else {
        return {
          ...prevDb,
          dietas: [...existingDietas, form]
        };
      }
    });
    showToast({ type: 'success', message: `Dieta ${form.nome} salva com sucesso!` });
    onClose();
  }, [form, initialData, onClose, setDb, showToast, validate]);

  return (
    <Modal open onClose={onClose} title={initialData ? "Editar Dieta" : "Cadastrar Dieta"} size="lg" footer={<Button onClick={submit}>Salvar Dieta</Button>}>
      <div className="form-grid two">
        <Input label="Nome da Dieta" value={form.nome} error={errors.nome} onChange={(e) => setForm(p => ({ ...p, nome: e.target.value }))} />
        <label className="ui-input-wrap">
          <span className="ui-input-label">Lote</span>
          <select className="ui-input" value={form.lote_id} error={errors.lote_id} onChange={(e) => setForm(p => ({ ...p, lote_id: Number(e.target.value) }))}>
            <option value="">Selecione um lote</option>
            {initialData && <option key={initialData.lote_id} value={initialData.lote_id}>{lotesMap.get(initialData.lote_id)?.nome}</option>}
            {lotesSemDieta.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
          {errors.lote_id && <small className="input-error">{errors.lote_id}</small>}
        </label>
      </div>

      <h3 className="modal-section-title">Itens da Dieta</h3>
      {errors.itens && <small className="input-error full" style={{ marginBottom: 10 }}>{errors.itens}</small>}
      <div className="table-responsive" style={{ marginBottom: 15 }}>
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Item de Estoque</th>
              <th>Qtd/cabeça/dia (kg)</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {form.itens.length === 0 ? (
              <tr><td colSpan="3" className="empty-state-td">Nenhum item adicionado à dieta.</td></tr>
            ) : (
              form.itens.map((item, index) => (
                <tr key={index}>
                  <td>{estoqueMap.get(item.item_estoque_id)?.produto || 'Item desconhecido'}</td>
                  <td>{formatNumber(item.qtd_cab_dia, 3)} kg</td>
                  <td>
                    <div className="row-actions">
                      <button className="action-btn" onClick={() => setEditingItemIndex(index)}>Editar</button>
                      <button className="action-btn action-btn-danger" onClick={() => removeItem(index)}>Remover</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Button variant="outline" onClick={addItem}>+ Adicionar Item</Button>

      {editingItemIndex !== null && (
        <ItemDietaModal
          db={db}
          initialData={form.itens[editingItemIndex]}
          onSave={saveItem}
          onCancel={() => setEditingItemIndex(null)}
          showToast={showToast}
        />
      )}
    </Modal>
  );
}

/**
 * Modal para adicionar/editar um item de dieta.
 * @param {object} props - As propriedades do componente.
 * @param {object} props.db - O objeto do banco de dados.
 * @param {object} [props.initialData] - Dados iniciais do item para edição.
 * @param {function} props.onSave - Callback para salvar o item.
 * @param {function} props.onCancel - Callback para cancelar.
 * @param {function} props.showToast - Função para exibir toasts.
 */
function ItemDietaModal({ db, initialData, onSave, onCancel, showToast }) {
  const [form, setForm] = useState(initialData || { item_estoque_id: '', qtd_cab_dia: '' });
  const [errors, setErrors] = useState({});

  const estoqueItens = useMemo(() => (db.estoque || []).filter(e => e.tipo === 'suplemento' || e.tipo === 'ração'), [db.estoque]);

  const validate = useCallback(() => {
    const newErrors = {};
    if (!form.item_estoque_id) newErrors.item_estoque_id = 'Item de estoque é obrigatório.';
    if (Number(form.qtd_cab_dia) <= 0) newErrors.qtd_cab_dia = 'Quantidade deve ser maior que zero.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form]);

  const submit = useCallback(() => {
    if (!validate()) {
      showToast({ type: 'error', message: 'Por favor, corrija os erros no formulário.' });
      return;
    }
    onSave({ ...form, item_estoque_id: Number(form.item_estoque_id), qtd_cab_dia: Number(form.qtd_cab_dia) });
    showToast({ type: 'success', message: 'Item da dieta salvo com sucesso!' });
    onCancel();
  }, [form, onSave, onCancel, showToast, validate]);

  return (
    <Modal open onClose={onCancel} title={initialData ? "Editar Item da Dieta" : "Adicionar Item à Dieta"} footer={<Button onClick={submit}>Salvar Item</Button>}>
      <label className="ui-input-wrap">
        <span className="ui-input-label">Item de Estoque</span>
        <select className="ui-input" value={form.item_estoque_id} error={errors.item_estoque_id} onChange={(e) => setForm(p => ({ ...p, item_estoque_id: e.target.value }))}>
          <option value="">Selecione um item</option>
          {estoqueItens.map(item => <option key={item.id} value={item.id}>{item.produto} (Saldo: {formatNumber(item.quantidade_atual, 2)})</option>)}
        </select>
        {errors.item_estoque_id && <small className="input-error">{errors.item_estoque_id}</small>}
      </label>
      <Input label="Quantidade por cabeça/dia (kg)" type="number" value={form.qtd_cab_dia} error={errors.qtd_cab_dia} onChange={(e) => setForm(p => ({ ...p, qtd_cab_dia: e.target.value }))} />
    </Modal>
  );
}

/**
 * Modal para registrar o consumo diário de suplementação.
 * @param {object} props - As propriedades do componente.
 * @param {object} props.db - O objeto do banco de dados.
 * @param {function} props.setDb - Função para atualizar o banco de dados.
 * @param {function} props.onClose - Callback para fechar o modal.
 * @param {function} props.showToast - Função para exibir toasts.
 */
function ConsumoModal({ db, setDb, onClose, showToast }) {
  const [form, setForm] = useState({ lote_id: '', data: formatDate(new Date()), qtd_total: '' });
  const [errors, setErrors] = useState({});

  const lotesAtivos = useMemo(() => (db.lotes || []).filter(l => l.status === 'ativo'), [db.lotes]);
  const dietasMap = useMemo(() => new Map((db.dietas || []).map(d => [d.lote_id, d])), [db.dietas]);
  const animaisMap = useMemo(() => {
    const map = new Map();
    (db.animais || []).forEach(a => {
      if (!map.has(a.lote_id)) map.set(a.lote_id, []);
      map.get(a.lote_id).push(a);
    });
    return map;
  }, [db.animais]);
  const estoqueMap = useMemo(() => new Map((db.estoque || []).map(e => [e.id, e])), [db.estoque]);

  const selectedLote = useMemo(() => lotesAtivos.find(l => l.id === Number(form.lote_id)), [lotesAtivos, form.lote_id]);
  const dieta = useMemo(() => selectedLote ? dietasMap.get(selectedLote.id) : null, [selectedLote, dietasMap]);
  const cabecas = useMemo(() => (animaisMap.get(selectedLote?.id) || []).reduce((s, a) => s + Number(a.qtd || 0), 0), [selectedLote, animaisMap]);
  const previsto = useMemo(() => dieta ? dieta.itens.reduce((s, i) => s + Number(i.qtd_cab_dia || 0) * cabecas, 0) : 0, [dieta, cabecas]);

  const validate = useCallback(() => {
    const newErrors = {};
    if (!form.lote_id) newErrors.lote_id = 'Lote é obrigatório.';
    if (!form.data) newErrors.data = 'Data é obrigatória.';
    if (!dieta) newErrors.dieta = 'O lote selecionado não possui uma dieta cadastrada.';
    if (Number(form.qtd_total || previsto) <= 0) newErrors.qtd_total = 'Quantidade total deve ser maior que zero.';

    // Validar saldo em estoque
    if (dieta) {
      dieta.itens.forEach(itemDieta => {
        const estoqueItem = estoqueMap.get(itemDieta.item_estoque_id);
        const qtdNecessaria = Number(itemDieta.qtd_cab_dia || 0) * cabecas;
        if (!estoqueItem || Number(estoqueItem.quantidade_atual || 0) < qtdNecessaria) {
          newErrors.estoque = `Saldo insuficiente para ${estoqueItem?.produto || 'um item da dieta'}.`;
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form, dieta, previsto, cabecas, estoqueMap]);

  const submit = useCallback(() => {
    if (!validate()) {
      showToast({ type: 'error', message: errors.estoque || 'Por favor, corrija os erros no formulário.' });
      return;
    }

    const qtdTotalConsumida = Number(form.qtd_total || previsto);

    setDb(prevDb => {
      let newEstoque = [...(prevDb.estoque || [])];
      const newMovEst = [...(prevDb.movimentacoes_estoque || [])];
      const newMovFin = [...(prevDb.movimentacoes_financeiras || [])];

      dieta.itens.forEach((it) => {
        const qtdItemConsumida = Number(it.qtd_cab_dia || 0) * cabecas;
        const itemEstoque = estoqueMap.get(it.item_estoque_id);

        if (itemEstoque) {
          // Atualiza o estoque
          newEstoque = newEstoque.map(e =>
            e.id === itemEstoque.id
              ? { ...e, quantidade_atual: Math.max(0, Number(e.quantidade_atual || 0) - qtdItemConsumida) }
              : e
          );

          // Registra movimentação de estoque
          const valorUnitario = Number(itemEstoque.valor_unitario || 0);
          const valorTotalMov = qtdItemConsumida * valorUnitario;
          newMovEst.push({
            id: gerarNovoId(newMovEst),
            item_estoque_id: itemEstoque.id,
            tipo: 'consumo',
            lote_id: Number(form.lote_id),
            quantidade: qtdItemConsumida,
            data: form.data,
            valor_total: valorTotalMov,
            obs: `Consumo suplementação - ${itemEstoque.produto}`,
          });

          // Registra movimentação financeira (despesa)
          newMovFin.push({
            id: gerarNovoId(newMovFin),
            tipo: 'despesa',
            categoria: 'Alimentação',
            valor: valorTotalMov,
            data: form.data,
            lote_id: Number(form.lote_id),
            descricao: `Consumo dieta ${dieta.nome} - ${itemEstoque.produto}`,
          });
        }
      });

      // Registra o consumo total de suplementação
      const newConsumoSuplementacao = [
        ...(prevDb.consumo_suplementacao || []),
        {
          id: gerarNovoId(prevDb.consumo_suplementacao || []),
          lote_id: Number(form.lote_id),
          data: form.data,
          qtd_total: qtdTotalConsumida,
        },
      ];

      return {
        ...prevDb,
        estoque: newEstoque,
        movimentacoes_estoque: newMovEst,
        movimentacoes_financeiras: newMovFin,
        consumo_suplementacao: newConsumoSuplementacao,
      };
    });
    showToast({ type: 'success', message: 'Consumo diário registrado com sucesso!' });
    onClose();
  }, [form, dieta, cabecas, previsto, setDb, onClose, showToast, validate, errors.estoque, estoqueMap]);

  return (
    <Modal open onClose={onClose} title="Registrar consumo diário" footer={<Button onClick={submit}>Confirmar consumo</Button>}>
      <div className="form-grid two">
        <label className="ui-input-wrap">
          <span className="ui-input-label">Lote</span>
          <select className="ui-input" value={form.lote_id} error={errors.lote_id} onChange={(e) => setForm(p => ({ ...p, lote_id: e.target.value }))}>
            <option value="">Selecione</option>
            {lotesAtivos.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
          {errors.lote_id && <small className="input-error">{errors.lote_id}</small>}
        </label>
        <Input label="Data" type="date" value={form.data} error={errors.data} onChange={(e) => setForm(p => ({ ...p, data: e.target.value }))} />
        <Input label="Consumo previsto" value={formatNumber(previsto, 2)} readOnly />
        <Input label="Consumo real (ajuste)" type="number" value={form.qtd_total} error={errors.qtd_total} onChange={(e) => setForm(p => ({ ...p, qtd_total: e.target.value }))} />
        {errors.dieta && <small className="input-error full">{errors.dieta}</small>}
        {errors.estoque && <small className="input-error full">{errors.estoque}</small>}
        <p className="full">Dieta: {dieta?.nome || '—'}</p>
      </div>
    </Modal>
  );
}