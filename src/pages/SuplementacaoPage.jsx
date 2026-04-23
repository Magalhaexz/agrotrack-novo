import { useCallback, useMemo, useState } from 'react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import { useToast } from '../hooks/useToast';
import { gerarNovoId } from '../utils/id';
import { formatNumber } from '../utils/calculations';

const getTodayIso = () => new Date().toISOString().slice(0, 10);

function getDietasNormalizadas(db) {
  const dietas = Array.isArray(db?.dietas) ? db.dietas : [];
  if (dietas.length) {
    return dietas.map((dieta) => ({
      ...dieta,
      lote_id: Number(dieta.lote_id),
      itens: Array.isArray(dieta.itens) ? dieta.itens : [],
    }));
  }

  const legacy = Array.isArray(db?.suplementacao) ? db.suplementacao : [];
  const agrupado = new Map();

  legacy.forEach((item) => {
    const loteId = Number(item?.lote_id);
    if (!loteId) {
      return;
    }

    if (!agrupado.has(loteId)) {
      agrupado.set(loteId, {
        id: loteId,
        lote_id: loteId,
        nome: `Dieta ${loteId}`,
        itens: [],
      });
    }

    agrupado.get(loteId).itens.push({
      item_estoque_id: Number(item.item_estoque_id),
      qtd_cab_dia: Number(item.consumo_por_cabeca_dia || item.qtd_cab_dia || 0),
    });
  });

  return Array.from(agrupado.values());
}

function getEstoqueSuplementacao(db) {
  return (db?.estoque || []).filter((item) => {
    const categoria = String(item?.categoria || item?.tipo || '').toLowerCase();
    const nome = String(item?.produto || '').toLowerCase();
    return categoria.includes('insumo') || categoria.includes('suplement') || nome.includes('sal') || nome.includes('nucleo');
  });
}

function saveDietasCompat(setDb, updater) {
  setDb((prevDb) => {
    const dietasNormalizadas = getDietasNormalizadas(prevDb);
    const dietasAtualizadas = updater(dietasNormalizadas);

    return {
      ...prevDb,
      dietas: dietasAtualizadas,
    };
  });
}

export default function SuplementacaoPage({ db, setDb }) {
  const { showToast } = useToast();
  const [openDieta, setOpenDieta] = useState(false);
  const [openConsumo, setOpenConsumo] = useState(false);
  const [dietaEditando, setDietaEditando] = useState(null);

  const dietas = useMemo(() => getDietasNormalizadas(db), [db]);
  const dietasMap = useMemo(() => new Map(dietas.map((dieta) => [Number(dieta.lote_id), dieta])), [dietas]);
  const animaisMap = useMemo(() => {
    const map = new Map();
    (db.animais || []).forEach((animal) => {
      const loteId = Number(animal.lote_id);
      if (!map.has(loteId)) {
        map.set(loteId, []);
      }
      map.get(loteId).push(animal);
    });
    return map;
  }, [db.animais]);
  const consumoSuplementacaoMap = useMemo(() => {
    const map = new Map();
    (db.consumo_suplementacao || []).forEach((consumo) => {
      const loteId = Number(consumo.lote_id);
      if (!map.has(loteId)) {
        map.set(loteId, []);
      }
      map.get(loteId).push(consumo);
    });
    return map;
  }, [db.consumo_suplementacao]);
  const estoqueMap = useMemo(() => new Map((db.estoque || []).map((item) => [Number(item.id), item])), [db.estoque]);
  const lotesAtivos = useMemo(() => (db.lotes || []).filter((lote) => lote.status === 'ativo'), [db.lotes]);

  const consumoRows = useMemo(() => {
    return lotesAtivos.map((lote) => {
      const dieta = dietasMap.get(Number(lote.id)) || null;
      const cabecas = (animaisMap.get(Number(lote.id)) || []).reduce((total, animal) => total + Number(animal.qtd || 0), 0);
      const itensDieta = Array.isArray(dieta?.itens) ? dieta.itens : [];
      const previstoDia = itensDieta.reduce((total, item) => total + Number(item.qtd_cab_dia || 0) * cabecas, 0);
      const registros = consumoSuplementacaoMap.get(Number(lote.id)) || [];
      const realDia = registros.length
        ? registros.reduce((total, registro) => total + Number(registro.qtd_total || 0), 0) / registros.length
        : 0;

      return {
        lote,
        dieta,
        cabecas,
        itensDieta,
        previstoDia,
        realDia,
        diff: realDia - previstoDia,
      };
    });
  }, [animaisMap, consumoSuplementacaoMap, dietasMap, lotesAtivos]);

  const projecao = useMemo(() => {
    const consumoPorItem = new Map();

    consumoRows.forEach((row) => {
      row.itensDieta.forEach((item) => {
        const itemId = Number(item.item_estoque_id);
        const consumoAtual = consumoPorItem.get(itemId) || 0;
        consumoPorItem.set(itemId, consumoAtual + Number(item.qtd_cab_dia || 0) * row.cabecas);
      });
    });

    return Array.from(consumoPorItem.entries())
      .map(([itemId, consumoDia]) => {
        const item = estoqueMap.get(Number(itemId));
        const saldo = Number(item?.quantidade_atual || 0);
        const dias = consumoDia > 0 ? saldo / consumoDia : 999;
        return { item, consumoDia, dias };
      })
      .sort((a, b) => a.dias - b.dias);
  }, [consumoRows, estoqueMap]);

  const handleEditDieta = useCallback((dieta) => {
    setDietaEditando(dieta);
    setOpenDieta(true);
  }, []);

  const handleDeleteDieta = useCallback((dietaId) => {
    saveDietasCompat(setDb, (dietasAtuais) => dietasAtuais.filter((dieta) => dieta.id !== dietaId));
    showToast({ type: 'success', message: 'Dieta excluida com sucesso.' });
  }, [setDb, showToast]);

  return (
    <div className="page suplementacao-page">
      <header className="page-header">
        <h1>Suplementacao</h1>
        <p>Gerencie dietas, acompanhe o consumo diario e proteja o saldo de estoque sem quebrar o fluxo operacional.</p>
        <div className="page-actions">
          <Button onClick={() => { setDietaEditando(null); setOpenDieta(true); }}>Cadastrar dieta</Button>
          <Button variant="outline" onClick={() => setOpenConsumo(true)}>Registrar consumo diario</Button>
        </div>
      </header>

      <Card title="Dietas vinculadas por lote" subtitle="Compatibilidade preservada com os dados legados de suplementacao.">
        <div className="table-responsive">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Dieta</th>
                <th>Cabecas</th>
                <th>Itens</th>
                <th>Previsto/dia</th>
                <th>Real/dia</th>
                <th>Diferenca</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {consumoRows.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-state-td">Nenhum lote ativo encontrado.</td>
                </tr>
              ) : (
                consumoRows.map((row) => (
                  <tr key={row.lote.id}>
                    <td>{row.lote.nome}</td>
                    <td>{row.dieta?.nome || 'Sem dieta'}</td>
                    <td>{row.cabecas}</td>
                    <td>{row.itensDieta.length}</td>
                    <td>{formatNumber(row.previstoDia, 2)} kg</td>
                    <td>{formatNumber(row.realDia, 2)} kg</td>
                    <td>
                      <Badge variant={row.diff > 0 ? 'warning' : row.diff < 0 ? 'danger' : 'success'}>
                        {formatNumber(row.diff, 2)} kg
                      </Badge>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="action-btn" type="button" onClick={() => handleEditDieta(row.dieta || { lote_id: row.lote.id, nome: '', itens: [] })}>
                          {row.dieta ? 'Editar' : 'Criar'}
                        </button>
                        {row.dieta ? (
                          <button className="action-btn action-btn-danger" type="button" onClick={() => handleDeleteDieta(row.dieta.id)}>
                            Excluir
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Projecao de consumo de estoque" subtitle="Mostra o item mais pressionado pela dieta atual de cada lote.">
        <div className="table-responsive">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Consumo diario total</th>
                <th>Saldo</th>
                <th>Dias restantes</th>
              </tr>
            </thead>
            <tbody>
              {projecao.length === 0 ? (
                <tr>
                  <td colSpan="4" className="empty-state-td">Nenhuma projecao disponivel.</td>
                </tr>
              ) : (
                projecao.map((item) => (
                  <tr key={item.item?.id || `proj-${item.consumoDia}`}>
                    <td>{item.item?.produto || 'Item nao encontrado'}</td>
                    <td>{formatNumber(item.consumoDia, 2)} kg</td>
                    <td>{formatNumber(item.item?.quantidade_atual || 0, 2)} kg</td>
                    <td>
                      <Badge variant={item.dias < 7 ? 'danger' : item.dias < 30 ? 'warning' : 'success'}>
                        {item.dias === 999 ? 'Sem consumo' : `${formatNumber(item.dias, 0)} dias`}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {openDieta ? (
        <DietaModal
          db={db}
          setDb={setDb}
          initialData={dietaEditando}
          onClose={() => {
            setOpenDieta(false);
            setDietaEditando(null);
          }}
          showToast={showToast}
        />
      ) : null}

      {openConsumo ? (
        <ConsumoModal
          db={db}
          setDb={setDb}
          onClose={() => setOpenConsumo(false)}
          showToast={showToast}
        />
      ) : null}
    </div>
  );
}

function DietaModal({ db, setDb, initialData, onClose, showToast }) {
  const dietas = useMemo(() => getDietasNormalizadas(db), [db]);
  const estoqueItens = useMemo(() => getEstoqueSuplementacao(db), [db]);
  const [form, setForm] = useState(() => ({
    id: initialData?.id || gerarNovoId(dietas),
    nome: initialData?.nome || '',
    lote_id: Number(initialData?.lote_id || '') || '',
    itens: Array.isArray(initialData?.itens) ? initialData.itens : [],
  }));
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [errors, setErrors] = useState({});

  const lotesComDieta = useMemo(
    () => new Set(dietas.filter((dieta) => dieta.id !== form.id).map((dieta) => Number(dieta.lote_id))),
    [dietas, form.id]
  );
  const lotesDisponiveis = useMemo(
    () => (db.lotes || []).filter((lote) => lote.status === 'ativo' && (!lotesComDieta.has(Number(lote.id)) || Number(lote.id) === Number(form.lote_id))),
    [db.lotes, form.lote_id, lotesComDieta]
  );
  const estoqueMap = useMemo(() => new Map(estoqueItens.map((item) => [Number(item.id), item])), [estoqueItens]);

  const validate = useCallback(() => {
    const nextErrors = {};
    if (!form.nome.trim()) nextErrors.nome = 'Informe um nome para a dieta.';
    if (!form.lote_id) nextErrors.lote_id = 'Selecione um lote.';
    if (!form.itens.length) nextErrors.itens = 'Adicione pelo menos um item.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [form]);

  function submit() {
    if (!validate()) {
      showToast({ type: 'error', message: 'Corrija os campos da dieta antes de salvar.' });
      return;
    }

    const payload = {
      ...form,
      lote_id: Number(form.lote_id),
      itens: form.itens.map((item) => ({
        item_estoque_id: Number(item.item_estoque_id),
        qtd_cab_dia: Number(item.qtd_cab_dia),
      })),
    };

    saveDietasCompat(setDb, (dietasAtuais) => {
      const existe = dietasAtuais.some((dieta) => dieta.id === payload.id);
      return existe ? dietasAtuais.map((dieta) => (dieta.id === payload.id ? payload : dieta)) : [...dietasAtuais, payload];
    });

    showToast({ type: 'success', message: `Dieta ${payload.nome} salva com sucesso.` });
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={initialData?.id ? 'Editar dieta' : 'Cadastrar dieta'} size="lg" footer={<Button onClick={submit}>Salvar dieta</Button>}>
      <div className="form-grid two">
        <Input label="Nome da dieta" value={form.nome} error={errors.nome} onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))} />
        <label className="ui-input-wrap">
          <span className="ui-input-label">Lote</span>
          <select className="ui-input" value={form.lote_id} onChange={(event) => setForm((prev) => ({ ...prev, lote_id: event.target.value }))}>
            <option value="">Selecione</option>
            {lotesDisponiveis.map((lote) => (
              <option key={lote.id} value={lote.id}>{lote.nome}</option>
            ))}
          </select>
          {errors.lote_id ? <small className="input-error">{errors.lote_id}</small> : null}
        </label>
      </div>

      <h3 className="modal-section-title">Itens da dieta</h3>
      {errors.itens ? <small className="input-error full" style={{ marginBottom: 10 }}>{errors.itens}</small> : null}

      <div className="table-responsive" style={{ marginBottom: 14 }}>
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qtd/cabeca/dia</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {form.itens.length === 0 ? (
              <tr>
                <td colSpan="3" className="empty-state-td">Nenhum item adicionado.</td>
              </tr>
            ) : (
              form.itens.map((item, index) => (
                <tr key={`${item.item_estoque_id}-${index}`}>
                  <td>{estoqueMap.get(Number(item.item_estoque_id))?.produto || 'Item desconhecido'}</td>
                  <td>{formatNumber(item.qtd_cab_dia, 3)} kg</td>
                  <td>
                    <div className="row-actions">
                      <button className="action-btn" type="button" onClick={() => setEditingItemIndex(index)}>Editar</button>
                      <button
                        className="action-btn action-btn-danger"
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, itens: prev.itens.filter((_, itemIndex) => itemIndex !== index) }))}
                      >
                        Remover
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Button variant="outline" onClick={() => setEditingItemIndex(form.itens.length)}>Adicionar item</Button>

      {editingItemIndex !== null ? (
        <ItemDietaModal
          estoqueItens={estoqueItens}
          initialData={form.itens[editingItemIndex] || null}
          onCancel={() => setEditingItemIndex(null)}
          onSave={(itemData) => {
            setForm((prev) => {
              const itens = [...prev.itens];
              if (editingItemIndex < itens.length) {
                itens[editingItemIndex] = itemData;
              } else {
                itens.push(itemData);
              }
              return { ...prev, itens };
            });
            setEditingItemIndex(null);
          }}
          showToast={showToast}
        />
      ) : null}
    </Modal>
  );
}

function ItemDietaModal({ estoqueItens, initialData, onSave, onCancel, showToast }) {
  const [form, setForm] = useState(() => ({
    item_estoque_id: initialData?.item_estoque_id || '',
    qtd_cab_dia: initialData?.qtd_cab_dia || '',
  }));
  const [errors, setErrors] = useState({});

  function submit() {
    const nextErrors = {};
    if (!form.item_estoque_id) nextErrors.item_estoque_id = 'Selecione um item.';
    if (Number(form.qtd_cab_dia) <= 0) nextErrors.qtd_cab_dia = 'Informe uma quantidade maior que zero.';
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      showToast({ type: 'error', message: 'Corrija os dados do item antes de salvar.' });
      return;
    }

    onSave({
      item_estoque_id: Number(form.item_estoque_id),
      qtd_cab_dia: Number(form.qtd_cab_dia),
    });
    showToast({ type: 'success', message: 'Item da dieta salvo com sucesso.' });
    onCancel();
  }

  return (
    <Modal open onClose={onCancel} title={initialData ? 'Editar item da dieta' : 'Adicionar item a dieta'} footer={<Button onClick={submit}>Salvar item</Button>}>
      <label className="ui-input-wrap">
        <span className="ui-input-label">Item de estoque</span>
        <select className="ui-input" value={form.item_estoque_id} onChange={(event) => setForm((prev) => ({ ...prev, item_estoque_id: event.target.value }))}>
          <option value="">Selecione</option>
          {estoqueItens.map((item) => (
            <option key={item.id} value={item.id}>{item.produto} (saldo: {formatNumber(item.quantidade_atual, 2)})</option>
          ))}
        </select>
        {errors.item_estoque_id ? <small className="input-error">{errors.item_estoque_id}</small> : null}
      </label>
      <Input
        label="Quantidade por cabeca/dia (kg)"
        type="number"
        value={form.qtd_cab_dia}
        error={errors.qtd_cab_dia}
        onChange={(event) => setForm((prev) => ({ ...prev, qtd_cab_dia: event.target.value }))}
      />
    </Modal>
  );
}

function ConsumoModal({ db, setDb, onClose, showToast }) {
  const dietas = useMemo(() => getDietasNormalizadas(db), [db]);
  const dietasMap = useMemo(() => new Map(dietas.map((dieta) => [Number(dieta.lote_id), dieta])), [dietas]);
  const lotesAtivos = useMemo(() => (db.lotes || []).filter((lote) => lote.status === 'ativo'), [db.lotes]);
  const animaisMap = useMemo(() => {
    const map = new Map();
    (db.animais || []).forEach((animal) => {
      const loteId = Number(animal.lote_id);
      if (!map.has(loteId)) {
        map.set(loteId, []);
      }
      map.get(loteId).push(animal);
    });
    return map;
  }, [db.animais]);
  const estoqueMap = useMemo(() => new Map((db.estoque || []).map((item) => [Number(item.id), item])), [db.estoque]);
  const [form, setForm] = useState({ lote_id: '', data: getTodayIso(), qtd_total: '' });
  const [errors, setErrors] = useState({});

  const selectedLote = useMemo(
    () => lotesAtivos.find((lote) => Number(lote.id) === Number(form.lote_id)) || null,
    [form.lote_id, lotesAtivos]
  );
  const dieta = useMemo(
    () => (selectedLote ? dietasMap.get(Number(selectedLote.id)) || null : null),
    [dietasMap, selectedLote]
  );
  const itensDieta = Array.isArray(dieta?.itens) ? dieta.itens : [];
  const cabecas = useMemo(
    () => (animaisMap.get(Number(selectedLote?.id)) || []).reduce((total, animal) => total + Number(animal.qtd || 0), 0),
    [animaisMap, selectedLote]
  );
  const previsto = useMemo(
    () => itensDieta.reduce((total, item) => total + Number(item.qtd_cab_dia || 0) * cabecas, 0),
    [cabecas, itensDieta]
  );

  function validate() {
    const nextErrors = {};
    if (!form.lote_id) nextErrors.lote_id = 'Selecione um lote.';
    if (!form.data) nextErrors.data = 'Informe a data.';
    if (!dieta) nextErrors.dieta = 'O lote selecionado ainda nao possui dieta cadastrada.';

    const qtdTotalConsumida = Number(form.qtd_total || previsto);
    if (qtdTotalConsumida <= 0) nextErrors.qtd_total = 'Informe um consumo maior que zero.';

    itensDieta.forEach((item) => {
      const estoqueItem = estoqueMap.get(Number(item.item_estoque_id));
      const qtdNecessaria = Number(item.qtd_cab_dia || 0) * cabecas;
      if (!estoqueItem || Number(estoqueItem.quantidade_atual || 0) < qtdNecessaria) {
        nextErrors.estoque = `Saldo insuficiente para ${estoqueItem?.produto || 'um item da dieta'}.`;
      }
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function submit() {
    if (!validate()) {
      showToast({ type: 'error', message: errors.estoque || 'Corrija os campos antes de confirmar o consumo.' });
      return;
    }

    const qtdTotalConsumida = Number(form.qtd_total || previsto);

    setDb((prevDb) => {
      let estoqueAtualizado = [...(prevDb.estoque || [])];
      const movimentacoesEstoque = [...(prevDb.movimentacoes_estoque || [])];
      const movimentacoesFinanceiras = [...(prevDb.movimentacoes_financeiras || [])];

      itensDieta.forEach((item) => {
        const itemId = Number(item.item_estoque_id);
        const quantidadeConsumida = Number(item.qtd_cab_dia || 0) * cabecas;
        const estoqueItem = estoqueMap.get(itemId);

        if (!estoqueItem) {
          return;
        }

        estoqueAtualizado = estoqueAtualizado.map((estoque) => (
          Number(estoque.id) === itemId
            ? { ...estoque, quantidade_atual: Math.max(0, Number(estoque.quantidade_atual || 0) - quantidadeConsumida) }
            : estoque
        ));

        const valorTotal = quantidadeConsumida * Number(estoqueItem.valor_unitario || 0);

        movimentacoesEstoque.push({
          id: gerarNovoId(movimentacoesEstoque),
          item_estoque_id: itemId,
          tipo: 'consumo',
          lote_id: Number(form.lote_id),
          quantidade: quantidadeConsumida,
          data: form.data,
          valor_total: valorTotal,
          obs: `Consumo diario - ${estoqueItem.produto}`,
        });

        movimentacoesFinanceiras.push({
          id: gerarNovoId(movimentacoesFinanceiras),
          tipo: 'despesa',
          categoria: 'Suplementacao',
          valor: valorTotal,
          data: form.data,
          lote_id: Number(form.lote_id),
          descricao: `Consumo da dieta ${dieta?.nome || 'sem nome'} - ${estoqueItem.produto}`,
        });
      });

      return {
        ...prevDb,
        estoque: estoqueAtualizado,
        movimentacoes_estoque: movimentacoesEstoque,
        movimentacoes_financeiras: movimentacoesFinanceiras,
        consumo_suplementacao: [
          ...(prevDb.consumo_suplementacao || []),
          {
            id: gerarNovoId(prevDb.consumo_suplementacao || []),
            lote_id: Number(form.lote_id),
            data: form.data,
            qtd_total: qtdTotalConsumida,
          },
        ],
      };
    });

    showToast({ type: 'success', message: 'Consumo diario registrado com sucesso.' });
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Registrar consumo diario" footer={<Button onClick={submit}>Confirmar consumo</Button>}>
      <div className="form-grid two">
        <label className="ui-input-wrap">
          <span className="ui-input-label">Lote</span>
          <select className="ui-input" value={form.lote_id} onChange={(event) => setForm((prev) => ({ ...prev, lote_id: event.target.value }))}>
            <option value="">Selecione</option>
            {lotesAtivos.map((lote) => (
              <option key={lote.id} value={lote.id}>{lote.nome}</option>
            ))}
          </select>
          {errors.lote_id ? <small className="input-error">{errors.lote_id}</small> : null}
        </label>
        <Input label="Data" type="date" value={form.data} error={errors.data} onChange={(event) => setForm((prev) => ({ ...prev, data: event.target.value }))} />
        <Input label="Consumo previsto" value={formatNumber(previsto, 2)} readOnly />
        <Input
          label="Consumo real (ajuste)"
          type="number"
          value={form.qtd_total}
          error={errors.qtd_total}
          onChange={(event) => setForm((prev) => ({ ...prev, qtd_total: event.target.value }))}
        />
        {errors.dieta ? <small className="input-error full">{errors.dieta}</small> : null}
        {errors.estoque ? <small className="input-error full">{errors.estoque}</small> : null}
        <p className="full">Dieta: {dieta?.nome || 'Sem dieta cadastrada'}</p>
      </div>
    </Modal>
  );
}
