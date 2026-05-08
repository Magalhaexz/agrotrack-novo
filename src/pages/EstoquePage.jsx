import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, FileText } from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { formatCurrency, formatDate, formatNumber } from '../utils/calculations';
import { exportarCsvCompatExcel, exportarExcelXmlCompat } from '../utils/exportadores';
import { gerarNovoId } from '../utils/id';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../auth/useAuth';
import { createOperationalRecord, updateOperationalRecord } from '../services/operationalPersistence';

const CATEGORIAS_ESTOQUE_GERAL = [
  'Medicamento',
  'Vacina',
  'Material',
  'Produto veterinário',
  'Insumo geral',
  'Outro',
];

function itemEhNutricao(item) {
  const categoria = String(item?.categoria || item?.tipo || '').toLowerCase();
  const nome = String(item?.produto || '').toLowerCase();
  return (
    categoria.includes('suplement')
    || categoria.includes('dieta')
    || categoria.includes('aliment')
    || categoria.includes('proteinado')
    || categoria.includes('sal')
    || categoria.includes('núcleo')
    || categoria.includes('nucleo')
    || nome.includes('suplement')
    || nome.includes('dieta')
    || nome.includes('sal')
    || nome.includes('núcleo')
    || nome.includes('nucleo')
    || nome.includes('proteinado')
  );
}

export default function EstoquePage({ db, setDb, onRegistrarSaidaEstoque }) {
  const { showToast } = useToast();
  const { hasPermission, session } = useAuth();
  const mensagemSemPermissao = 'Você não tem permissão para executar esta ação.';

  const [showOnlyCrit, setShowOnlyCrit] = useState(false);
  const [escopoEstoque, setEscopoEstoque] = useState('geral');
  const [openCadastroItem, setOpenCadastroItem] = useState(false);
  const [openEntrada, setOpenEntrada] = useState(false);
  const [openSaida, setOpenSaida] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [filters, setFilters] = useState({ item: 'todos', tipo: 'todos', lote: 'todos', periodo: 'todos' });

  const lotesMap = useMemo(() => new Map((db.lotes || []).map((l) => [l.id, l])), [db.lotes]);
  const estoqueMap = useMemo(() => new Map((db.estoque || []).map((i) => [i.id, i])), [db.estoque]);

  const itens = useMemo(() => {
    const base = (db.estoque || []).filter((item) => (
      escopoEstoque === 'todos'
        ? true
        : escopoEstoque === 'nutricao'
          ? itemEhNutricao(item)
          : !itemEhNutricao(item)
    ));

    return base.map((item) => {
      const hist = (db.movimentacoes_estoque || []).filter((m) => Number(m.item_estoque_id) === Number(item.id));
      const pico = Math.max(Number(item.quantidade_atual || 0), ...hist.map((h) => Number(h.quantidade || 0)));
      const saldo = Number(item.quantidade_atual || 0);
      const ratio = pico ? (saldo / pico) * 100 : 0;
      const consumos = hist.filter((h) => ['consumo', 'saida'].includes(h.tipo));
      const mediaConsumo = consumos.length ? consumos.reduce((s, c) => s + Number(c.quantidade || 0), 0) / Math.max(consumos.length, 1) : 0;
      const diasRest = mediaConsumo > 0 ? saldo / mediaConsumo : 999;
      const status = ratio < 10 ? 'critico' : ratio < 20 ? 'baixo' : 'normal';
      return {
        ...item,
        pico,
        saldo,
        ratio,
        mediaConsumo,
        diasRest,
        valorTotal: saldo * Number(item.valor_unitario || item.preco_unitario || 0),
        status,
      };
    });
  }, [db.estoque, db.movimentacoes_estoque, escopoEstoque]);

  const itensView = useMemo(() => (showOnlyCrit ? itens.filter((i) => i.status !== 'normal') : itens), [itens, showOnlyCrit]);

  const resumo = useMemo(() => ({
    total: itens.length,
    criticos: itens.filter((i) => i.status !== 'normal').length,
    valorTotal: itens.reduce((s, i) => s + i.valorTotal, 0),
  }), [itens]);

  const movs = useMemo(() => (db.movimentacoes_estoque || []).filter((m) => {
    const itemMov = (db.estoque || []).find((item) => Number(item.id) === Number(m.item_estoque_id));
    if (escopoEstoque === 'nutricao' && !itemEhNutricao(itemMov)) return false;
    if (escopoEstoque === 'geral' && itemEhNutricao(itemMov)) return false;
    if (filters.item !== 'todos' && Number(m.item_estoque_id) !== Number(filters.item)) return false;
    if (filters.tipo !== 'todos' && m.tipo !== filters.tipo) return false;
    if (filters.lote !== 'todos' && Number(m.lote_id) !== Number(filters.lote)) return false;
    return true;
  }).sort((a, b) => new Date(b.data) - new Date(a.data)), [db.movimentacoes_estoque, db.estoque, escopoEstoque, filters]);

  function exportCsv() {
    const rows = movs.map((m) => ({
      data: m.data,
      item: estoqueMap.get(m.item_estoque_id)?.produto || '',
      tipo: m.tipo,
      quantidade: m.quantidade,
      lote: lotesMap.get(m.lote_id)?.nome || '',
      valor: m.valor_total || 0,
      observacao: m.obs || '',
    }));
    const columns = [
      { key: 'data', header: 'Data', type: 'date' },
      { key: 'item', header: 'Item' },
      { key: 'tipo', header: 'Tipo' },
      { key: 'quantidade', header: 'Quantidade', type: 'number' },
      { key: 'lote', header: 'Lote' },
      { key: 'valor', header: 'Valor', type: 'currency' },
      { key: 'observacao', header: 'Observação' },
    ];
    exportarCsvCompatExcel({ filename: 'movimentacoes-estoque', rows, columns });
    exportarExcelXmlCompat({ filename: 'movimentacoes-estoque', sheets: [{ name: 'Estoque', rows, columns }] });
  }

  return (
    <div className="page rebanho-page page--estoque">
      <div className="rebanho-header">
        <h1>Estoque</h1>
        <p className="financeiro-subtitle">Medicamentos, vacinas, materiais e insumos gerais.</p>
        <div className="lote-actions">
          <select className="ui-input" value={escopoEstoque} onChange={(e) => setEscopoEstoque(e.target.value)} style={{ minWidth: 210 }}>
            <option value="geral">Estoque geral</option>
            <option value="nutricao">Nutrição / suplementação</option>
            <option value="todos">Todos os itens</option>
          </select>
          <Button disabled={!hasPermission('estoque:editar')} onClick={() => {
            if (!hasPermission('estoque:editar')) {
              showToast({ type: 'error', message: mensagemSemPermissao });
              return;
            }
            setOpenCadastroItem(true);
          }}>
            Cadastrar item
          </Button>
          <Button icon={<ArrowUpCircle size={14} />} disabled={!hasPermission('estoque:editar')} onClick={() => {
            if (!hasPermission('estoque:editar')) {
              showToast({ type: 'error', message: mensagemSemPermissao });
              return;
            }
            setSelectedItem(null);
            setOpenEntrada(true);
          }}>
            Registrar entrada
          </Button>
          <Button variant="outline" icon={<ArrowDownCircle size={14} />} disabled={!hasPermission('estoque:editar')} onClick={() => {
            if (!hasPermission('estoque:editar')) {
              showToast({ type: 'error', message: mensagemSemPermissao });
              return;
            }
            setSelectedItem(null);
            setOpenSaida(true);
          }}>
            Registrar saída
          </Button>
          <Button variant={showOnlyCrit ? 'warning' : 'ghost'} onClick={() => setShowOnlyCrit((v) => !v)}>
            {showOnlyCrit ? 'Mostrar todos' : 'Mostrar apenas críticos'}
          </Button>
        </div>
      </div>

      <Card title="Fluxo do estoque" subtitle="Cadastre o item e depois registre entradas e saídas." >
        <div className="dashboard-list">
          <div className="dashboard-list-item"><div className="dashboard-list-copy"><strong>Cadastrar item</strong><p>Cria o item base do Estoque Geral.</p></div></div>
          <div className="dashboard-list-item"><div className="dashboard-list-copy"><strong>Registrar entrada</strong><p>Adiciona quantidade em item já cadastrado.</p></div></div>
          <div className="dashboard-list-item"><div className="dashboard-list-copy"><strong>Registrar saída</strong><p>Baixa quantidade de item existente.</p></div></div>
          <div className="dashboard-list-item"><div className="dashboard-list-copy"><strong>Separação com Nutrição / Suplementação</strong><p>Itens de alimentação e suplementação devem ser priorizados no módulo Nutrição / Suplementação. Se já existirem no Estoque, a separação é somente por classificação visual.</p></div></div>
        </div>
      </Card>

      <div className="dashboard-grid dashboard-grid--kpi-secondary">
        <Card className="kpi-card" title="Total de itens">{resumo.total}</Card>
        <Card className="kpi-card" title="Itens críticos">{resumo.criticos}</Card>
        <Card className="kpi-card" title="Valor total em estoque">{formatCurrency(resumo.valorTotal)}</Card>
      </div>

      <div className="lote-cards-grid">
        {itensView.length === 0 ? (
          <div className="empty-box">
            <strong>{showOnlyCrit ? 'Nenhum item crítico.' : 'Nenhum item no estoque.'}</strong>
            <span>{showOnlyCrit ? 'Todos os itens estão em nível normal.' : 'Cadastre um item para iniciar o Estoque Geral.'}</span>
          </div>
        ) : (
          itensView.map((item) => {
            const border = item.status === 'critico' ? '#c53030' : item.status === 'baixo' ? '#b7791f' : 'var(--color-border)';
            const bar = item.status === 'critico' ? '#c53030' : item.status === 'baixo' ? '#b7791f' : '#2d6a4f';
            return (
              <Card key={item.id} className={`estoque-card estoque-card--${item.status}`} style={{ borderColor: border }}>
                <div className="estoque-card-header">
                  <div>
                    <h3 className="estoque-card-nome">{item.produto}</h3>
                    <span className={`badge-categoria ${String(item.categoria || '').toLowerCase().includes('san') ? 'badge-sanitario' : String(item.categoria || '').toLowerCase().includes('med') ? 'badge-medicamento' : 'badge-insumo'}`}>
                      <span className="dot" />
                      {item.categoria}
                    </span>
                  </div>
                  <Badge className="estoque-card-status" variant={item.status === 'critico' ? 'danger' : item.status === 'baixo' ? 'warning' : 'neutral'}>{item.status}</Badge>
                </div>
                {item.status === 'critico' ? <p className="negative estoque-card-alert"><AlertTriangle size={14} /> Crítico</p> : null}
                <div className="estoque-card-quantidade">{formatNumber(item.saldo, 2)} {item.unidade}</div>
                <div className="estoque-card-progress">
                  <div className="estoque-card-progress-head">
                    <span>Saldo atual</span>
                    <span className="progress-label">{formatNumber(item.ratio, 0)}%</span>
                  </div>
                  <div className="progress-bar-container"><div className={`progress-bar-fill ${item.status === 'critico' ? 'danger' : item.status === 'baixo' ? 'warning' : ''}`} style={{ width: `${Math.min(Math.max(item.ratio, 4), 100)}%`, background: bar }} /></div>
                </div>
                <div className="estoque-card-details">
                  <div className="estoque-detail-row"><span>Valor unitário</span><span>{formatCurrency(item.valor_unitario || item.preco_unitario || 0)}</span></div>
                  <div className="estoque-detail-row"><span>Valor total</span><span>{formatCurrency(item.valorTotal)}</span></div>
                  <div className="estoque-detail-row"><span>Consumo médio diário</span><span>{formatNumber(item.mediaConsumo, 2)} {item.unidade}</span></div>
                  <div className="estoque-detail-row"><span>Dias restantes</span><span>{item.diasRest > 900 ? '—' : `${formatNumber(item.diasRest, 0)} dias`}</span></div>
                </div>
                <div className="estoque-card-actions lote-actions">
                  <button type="button" className="btn-entrada" disabled={!hasPermission('estoque:editar')} onClick={() => { setSelectedItem(item); setOpenEntrada(true); }}>
                    Entrada
                  </button>
                  <button type="button" className="btn-saida" disabled={!hasPermission('estoque:editar')} onClick={() => { setSelectedItem(item); setOpenSaida(true); }}>
                    Saída
                  </button>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Card title="Histórico de Movimentações" action={<Button variant="outline" icon={<FileText size={14} />} onClick={exportCsv}>Exportar CSV</Button>}>
        <div className="filters-wrap">
          <label>Item
            <select className="ui-input" value={filters.item} onChange={(e) => setFilters((p) => ({ ...p, item: e.target.value }))}>
              <option value="todos">Todos</option>
              {itens.map((i) => <option key={i.id} value={i.id}>{i.produto}</option>)}
            </select>
          </label>
          <label>Tipo
            <select className="ui-input" value={filters.tipo} onChange={(e) => setFilters((p) => ({ ...p, tipo: e.target.value }))}>
              <option value="todos">Todos</option>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
              <option value="consumo">Consumo</option>
              <option value="ajuste">Ajuste</option>
              <option value="perda">Perda</option>
              <option value="tratamento">Tratamento</option>
            </select>
          </label>
          <label>Lote
            <select className="ui-input" value={filters.lote} onChange={(e) => setFilters((p) => ({ ...p, lote: e.target.value }))}>
              <option value="todos">Todos</option>
              {(db.lotes || []).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </label>
        </div>
        {movs.length > 0 ? (
          <table className="dashboard-table">
            <thead><tr><th>Data</th><th>Item</th><th>Tipo</th><th>Qtd</th><th>Lote</th><th>Valor</th></tr></thead>
            <tbody>{movs.map((m) => {
              const item = estoqueMap.get(m.item_estoque_id);
              const lote = lotesMap.get(m.lote_id);
              return <tr key={m.id}><td>{formatDate(m.data)}</td><td>{item?.produto || '—'}</td><td>{m.tipo}</td><td>{formatNumber(m.quantidade, 2)} {item?.unidade || ''}</td><td>{lote?.nome || '—'}</td><td>{formatCurrency(m.valor_total || 0)}</td></tr>;
            })}</tbody>
          </table>
        ) : (
          <div className="table-empty"><AlertTriangle className="table-empty-icon" size={20} />Nenhuma movimentação encontrada para os filtros selecionados.</div>
        )}
      </Card>

      {openCadastroItem && (
        <CadastroItemModal setDb={setDb} onClose={() => setOpenCadastroItem(false)} hasPermission={hasPermission} showToast={showToast} session={session} />
      )}
      {openEntrada && (
        <EntradaModal db={db} setDb={setDb} selectedItem={selectedItem} estoqueMap={estoqueMap} onOpenCadastroItem={() => setOpenCadastroItem(true)} onClose={() => { setSelectedItem(null); setOpenEntrada(false); }} hasPermission={hasPermission} showToast={showToast} session={session} />
      )}
      {openSaida && (
        <SaidaModal db={db} setDb={setDb} selectedItem={selectedItem} onRegistrarSaidaEstoque={onRegistrarSaidaEstoque} estoqueMap={estoqueMap} onClose={() => { setSelectedItem(null); setOpenSaida(false); }} hasPermission={hasPermission} showToast={showToast} session={session} />
      )}
    </div>
  );
}

function CadastroItemModal({ setDb, onClose, hasPermission, showToast, session }) {
  const [form, setForm] = useState({
    produto: '',
    categoria: CATEGORIAS_ESTOQUE_GERAL[0],
    unidade: 'kg',
    quantidade_inicial: '',
    quantidade_minima: '',
    custo_unitario: '',
    validade: '',
    fornecedor: '',
    obs: '',
  });

  async function submit() {
    if (!hasPermission('estoque:editar')) {
      showToast({ type: 'error', message: 'Você não tem permissão para executar esta ação.' });
      return;
    }
    if (!String(form.produto || '').trim()) {
      alert('Informe o nome do item.');
      return;
    }

    const payload = {
      produto: String(form.produto || '').trim(),
      categoria: form.categoria || 'Outro',
      unidade: form.unidade || 'un',
      quantidade_atual: Number(form.quantidade_inicial || 0),
      quantidade_minima: Number(form.quantidade_minima || 0),
      valor_unitario: Number(form.custo_unitario || 0),
      preco_unitario: Number(form.custo_unitario || 0),
      data_validade: form.validade || null,
      fornecedor: form.fornecedor || '',
      obs: form.obs || '',
    };

    const persisted = await createOperationalRecord('estoque', payload, session);
    setDb((prev) => ({
      ...prev,
      estoque: [
        ...(prev.estoque || []),
        persisted.data || { id: gerarNovoId(prev.estoque || []), ...payload },
      ],
    }));

    if (persisted.syncStatus === 'cloud_success') {
      showToast({ type: 'success', message: 'Registro salvo na nuvem.' });
    }
    if (persisted.syncStatus === 'pending_sync' || persisted.syncStatus === 'local_only') {
      showToast({ type: 'warning', message: `Registro salvo localmente. Sincronização pendente.${import.meta.env.DEV ? ` Motivo: ${persisted.error || persisted.code || 'unknown'}.` : ''}` });
    }
    showToast({ type: 'success', message: 'Item cadastrado com sucesso.' });
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Cadastrar item de estoque" footer={<Button onClick={submit}>Salvar item</Button>}>
      <div className="form-grid two">
        <Input label="Nome do item" value={form.produto} onChange={(e) => setForm((p) => ({ ...p, produto: e.target.value }))} />
        <label className="ui-input-wrap">
          <span className="ui-input-label">Categoria</span>
          <select className="ui-input" value={form.categoria} onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))}>
            {CATEGORIAS_ESTOQUE_GERAL.map((categoria) => <option key={categoria} value={categoria}>{categoria}</option>)}
          </select>
        </label>
        <Input label="Unidade de medida" value={form.unidade} onChange={(e) => setForm((p) => ({ ...p, unidade: e.target.value }))} />
        <Input label="Quantidade inicial" type="number" value={form.quantidade_inicial} onChange={(e) => setForm((p) => ({ ...p, quantidade_inicial: e.target.value }))} />
        <Input label="Quantidade mínima" type="number" value={form.quantidade_minima} onChange={(e) => setForm((p) => ({ ...p, quantidade_minima: e.target.value }))} />
        <Input label="Custo unitário" type="number" value={form.custo_unitario} onChange={(e) => setForm((p) => ({ ...p, custo_unitario: e.target.value }))} />
        <Input label="Validade" type="date" value={form.validade} onChange={(e) => setForm((p) => ({ ...p, validade: e.target.value }))} />
        <Input label="Fornecedor" value={form.fornecedor} onChange={(e) => setForm((p) => ({ ...p, fornecedor: e.target.value }))} />
        <Input label="Observações" value={form.obs} onChange={(e) => setForm((p) => ({ ...p, obs: e.target.value }))} />
      </div>
    </Modal>
  );
}

function EntradaModal({ db, setDb, selectedItem, estoqueMap, onOpenCadastroItem, onClose, hasPermission, showToast, session }) {
  const [form, setForm] = useState({
    item_id: selectedItem?.id || '',
    qtd: '',
    custo: selectedItem?.valor_unitario || selectedItem?.preco_unitario || '',
    validade: '',
    fornecedor: '',
    nf: '',
    data: '',
    obs: '',
  });

  const semItens = (db.estoque || []).length === 0;
  const item = estoqueMap.get(Number(form.item_id));
  const total = Number(form.qtd || 0) * Number(form.custo || 0);

  async function submit() {
    if (!hasPermission('estoque:editar')) {
      showToast({ type: 'error', message: 'Você não tem permissão para executar esta ação.' });
      return;
    }
    if (!form.data || !form.item_id || Number(form.qtd) <= 0) {
      alert('Preencha todos os campos obrigatórios.');
      return;
    }

    const itemAtual = (db?.estoque || []).find((entry) => entry.id === Number(form.item_id));
    const novoSaldo = Number(itemAtual?.quantidade_atual || 0) + Number(form.qtd || 0);
    const estoquePersist = await updateOperationalRecord('estoque', Number(form.item_id), {
      quantidade_atual: novoSaldo,
      valor_unitario: Number(form.custo || itemAtual?.valor_unitario || 0),
      preco_unitario: Number(form.custo || itemAtual?.preco_unitario || 0),
      data_validade: form.validade || itemAtual?.data_validade || null,
    }, session);
    const movPersist = await createOperationalRecord('movimentacoes_estoque', {
      item_estoque_id: Number(form.item_id),
      tipo: 'entrada',
      quantidade: Number(form.qtd),
      data: form.data,
      valor_total: total,
      obs: form.obs,
      fornecedor: form.fornecedor,
      numero_nf: form.nf,
    }, session);

    setDb((prev) => ({
      ...prev,
      estoque: prev.estoque.map((i) => (
        i.id === Number(form.item_id)
          ? {
              ...i,
              ...(estoquePersist.data || {
                quantidade_atual: Number(i.quantidade_atual || 0) + Number(form.qtd),
                valor_unitario: Number(form.custo || i.valor_unitario),
                preco_unitario: Number(form.custo || i.preco_unitario),
                data_validade: form.validade || i.data_validade,
              }),
            }
          : i
      )),
      movimentacoes_estoque: [
        ...(prev.movimentacoes_estoque || []),
        movPersist.data || {
          id: gerarNovoId(prev.movimentacoes_estoque || []),
          item_estoque_id: Number(form.item_id),
          tipo: 'entrada',
          quantidade: Number(form.qtd),
          data: form.data,
          valor_total: total,
          obs: form.obs,
          fornecedor: form.fornecedor,
          numero_nf: form.nf,
        },
      ],
    }));

    if (!estoquePersist.persisted || !movPersist.persisted) {
      showToast({ type: 'warning', message: 'Entrada salva apenas localmente.' });
    }
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Entrada de estoque" footer={!semItens ? <Button onClick={submit}>Confirmar entrada</Button> : null}>
      {semItens ? (
        <div className="empty-box">
          <strong>Cadastre um item antes de registrar entrada.</strong>
          <span>Entrada de estoque adiciona quantidade em item já cadastrado.</span>
          <div className="lote-actions">
            <Button type="button" onClick={() => { onClose(); onOpenCadastroItem?.(); }}>+ Cadastrar novo item</Button>
          </div>
        </div>
      ) : (
        <div className="form-grid two">
          <p className="financeiro-subtitle full">Este fluxo é para adicionar quantidade em item já cadastrado.</p>
          <label className="ui-input-wrap">
            <span className="ui-input-label">Item</span>
            <select className="ui-input" value={form.item_id} onChange={(e) => setForm((p) => ({ ...p, item_id: e.target.value }))}>
              <option value="">Selecione</option>
              {(db.estoque || []).map((i) => <option key={i.id} value={i.id}>{i.produto}</option>)}
            </select>
          </label>
          <Input label="Quantidade" type="number" value={form.qtd} onChange={(e) => setForm((p) => ({ ...p, qtd: e.target.value }))} />
          <Input label="Unidade" value={item?.unidade || ''} readOnly />
          <Input label="Custo unitário" type="number" value={form.custo} onChange={(e) => setForm((p) => ({ ...p, custo: e.target.value }))} />
          <Input label="Valor total" value={formatCurrency(total)} readOnly />
          <Input label="Validade" type="date" value={form.validade} onChange={(e) => setForm((p) => ({ ...p, validade: e.target.value }))} />
          <Input label="Fornecedor" value={form.fornecedor} onChange={(e) => setForm((p) => ({ ...p, fornecedor: e.target.value }))} />
          <Input label="Nota fiscal" value={form.nf} onChange={(e) => setForm((p) => ({ ...p, nf: e.target.value }))} />
          <Input label="Data" type="date" value={form.data} onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))} />
          <Input label="Observações" value={form.obs} onChange={(e) => setForm((p) => ({ ...p, obs: e.target.value }))} />
        </div>
      )}
    </Modal>
  );
}

function SaidaModal({ db, setDb, selectedItem, onRegistrarSaidaEstoque, estoqueMap, onClose, hasPermission, showToast, session }) {
  const [form, setForm] = useState({
    item_id: selectedItem?.id || '',
    tipo: 'consumo',
    lote_id: '',
    qtd: '',
    data: '',
    obs: '',
  });

  const item = estoqueMap.get(Number(form.item_id));
  const saldo = Number(item?.quantidade_atual || 0);

  function categoriaDespesa(cat) {
    const lowerCat = (cat || '').toLowerCase();
    if (['ração', 'racao', 'suplemento', 'insumo'].includes(lowerCat)) return 'Alimentação';
    if (['medicamento', 'sanitário', 'sanitario', 'vacina'].includes(lowerCat)) return 'Sanitário';
    return 'Outros';
  }

  async function submit() {
    if (!hasPermission('estoque:editar')) {
      showToast({ type: 'error', message: 'Você não tem permissão para executar esta ação.' });
      return;
    }
    const qtd = Number(form.qtd || 0);
    if (!form.data || !form.item_id || qtd <= 0 || qtd > saldo) {
      alert('Verifique os campos e a quantidade.');
      return;
    }

    if (typeof onRegistrarSaidaEstoque === 'function') {
      onRegistrarSaidaEstoque({
        itemId: Number(form.item_id),
        loteId: form.lote_id ? Number(form.lote_id) : '',
        quantidade: qtd,
        tipo: form.tipo,
        data: form.data,
        obs: form.obs.trim(),
      });
      onClose();
      return;
    }

    const valor = qtd * Number(item?.valor_unitario || item?.preco_unitario || 0);
    const novoSaldo = saldo - qtd;
    const estoquePersist = await updateOperationalRecord('estoque', Number(form.item_id), { quantidade_atual: novoSaldo }, session);
    const movEstoquePersist = await createOperationalRecord('movimentacoes_estoque', {
      item_estoque_id: Number(form.item_id),
      tipo: form.tipo,
      lote_id: form.lote_id ? Number(form.lote_id) : null,
      quantidade: qtd,
      data: form.data,
      valor_total: valor,
      obs: form.obs,
    }, session);
    const movFinancePersist = form.lote_id
      ? await createOperationalRecord('movimentacoes_financeiras', {
          tipo: 'despesa',
          categoria: categoriaDespesa(item?.categoria),
          valor,
          data: form.data,
          lote_id: Number(form.lote_id),
          descricao: `Consumo de ${item?.produto}`,
        }, session)
      : { persisted: true, data: null };

    setDb((prev) => ({
      ...prev,
      estoque: prev.estoque.map((i) => (i.id === Number(form.item_id)
        ? { ...i, ...(estoquePersist.data || { quantidade_atual: Number(i.quantidade_atual || 0) - qtd }) }
        : i)),
      movimentacoes_estoque: [
        ...(prev.movimentacoes_estoque || []),
        movEstoquePersist.data || {
          id: gerarNovoId(prev.movimentacoes_estoque || []),
          item_estoque_id: Number(form.item_id),
          tipo: form.tipo,
          lote_id: form.lote_id ? Number(form.lote_id) : null,
          quantidade: qtd,
          data: form.data,
          valor_total: valor,
          obs: form.obs,
        },
      ],
      movimentacoes_financeiras: form.lote_id
        ? [
            ...(prev.movimentacoes_financeiras || []),
            movFinancePersist.data || {
              id: gerarNovoId(prev.movimentacoes_financeiras || []),
              tipo: 'despesa',
              categoria: categoriaDespesa(item?.categoria),
              valor,
              data: form.data,
              lote_id: Number(form.lote_id),
              descricao: `Consumo de ${item?.produto}`,
            },
          ]
        : (prev.movimentacoes_financeiras || []),
    }));

    if (!estoquePersist.persisted || !movEstoquePersist.persisted || !movFinancePersist.persisted) {
      showToast({ type: 'warning', message: 'Saída salva parcialmente apenas no modo local.' });
    }
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Saída / Consumo" footer={<Button variant="danger" onClick={submit}>Confirmar saída</Button>}>
      <div className="form-grid two">
        <label className="ui-input-wrap">
          <span className="ui-input-label">Item</span>
          <select className="ui-input" value={form.item_id} onChange={(e) => setForm((p) => ({ ...p, item_id: e.target.value }))}>
            <option value="">Selecione</option>
            {(db.estoque || []).map((i) => <option key={i.id} value={i.id}>{i.produto} (saldo {formatNumber(i.quantidade_atual, 2)})</option>)}
          </select>
        </label>
        <label className="ui-input-wrap">
          <span className="ui-input-label">Tipo</span>
          <select className="ui-input" value={form.tipo} onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}>
            <option value="consumo">Consumo diário</option>
            <option value="tratamento">Tratamento</option>
            <option value="ajuste">Ajuste</option>
            <option value="perda">Perda</option>
            <option value="saida">Saída</option>
          </select>
        </label>
        <label className="ui-input-wrap">
          <span className="ui-input-label">Lote</span>
          <select className="ui-input" value={form.lote_id} onChange={(e) => setForm((p) => ({ ...p, lote_id: e.target.value }))}>
            <option value="">Opcional</option>
            {(db.lotes || []).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        </label>
        <Input label="Quantidade" type="number" error={Number(form.qtd || 0) > saldo ? `Máximo ${formatNumber(saldo, 2)}` : ''} value={form.qtd} onChange={(e) => setForm((p) => ({ ...p, qtd: e.target.value }))} />
        <Input label="Data" type="date" value={form.data} onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))} />
        <Input label="Observações" value={form.obs} onChange={(e) => setForm((p) => ({ ...p, obs: e.target.value }))} />
      </div>
    </Modal>
  );
}
