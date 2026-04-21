import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, FileText } from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { formatCurrency, formatDate, formatNumber } from '../utils/calculations';
import { gerarNovoId } from '../utils/id';
<<<<<<< HEAD
// Assuming useToast is available
// import { useToast } from '../hooks/useToast';

/**
 * Página de Estoque, para gerenciamento de itens, entradas, saídas e visualização de movimentações.
 *
 * @param {object} props - As propriedades do componente.
 * @param {object} props.db - O objeto do banco de dados.
 * @param {function} props.setDb - Função para atualizar o banco de dados.
 * @param {function} [props.onRegistrarSaidaEstoque] - Callback opcional para registrar saída de estoque de forma customizada.
 */
export default function EstoquePage({ db, setDb, onRegistrarSaidaEstoque }) {
  // const { showToast } = useToast(); // Se usar useToast

=======

export default function EstoquePage({ db, setDb, onRegistrarSaidaEstoque }) {
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  const [showOnlyCrit, setShowOnlyCrit] = useState(false);
  const [openEntrada, setOpenEntrada] = useState(false);
  const [openSaida, setOpenSaida] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [filters, setFilters] = useState({ item: 'todos', tipo: 'todos', lote: 'todos', periodo: 'todos' });

<<<<<<< HEAD
  // Pré-indexar lotes e estoque para buscas eficientes
  const lotesMap = useMemo(() => new Map((db.lotes || []).map(l => [l.id, l])), [db.lotes]);
  const estoqueMap = useMemo(() => new Map((db.estoque || []).map(i => [i.id, i])), [db.estoque]);

  // Processamento principal dos itens de estoque (MEMOIZADO)
  const itens = useMemo(() => {
    return (db.estoque || []).map((item) => {
      const hist = (db.movimentacoes_estoque || []).filter((m) => Number(m.item_estoque_id) === Number(item.id));
      const pico = Math.max(Number(item.quantidade_atual || 0), ...hist.map((h) => Number(h.quantidade || 0)));
      const saldo = Number(item.quantidade_atual || 0);
      const ratio = pico ? (saldo / pico) * 100 : 0;
      const consumos = hist.filter((h) => ['consumo', 'saida'].includes(h.tipo));
      const mediaConsumo = consumos.length ? consumos.reduce((s, c) => s + Number(c.quantidade || 0), 0) / Math.max(consumos.length, 1) : 0;
      const diasRest = mediaConsumo > 0 ? saldo / mediaConsumo : 999;
      const status = ratio < 10 ? 'critico' : ratio < 20 ? 'baixo' : 'normal';
      return { ...item, pico, saldo, ratio, mediaConsumo, diasRest, valorTotal: saldo * Number(item.valor_unitario || 0), status };
    });
  }, [db.estoque, db.movimentacoes_estoque]);

  // Itens de estoque filtrados para exibição (MEMOIZADO)
  const itensView = useMemo(() => {
    return showOnlyCrit ? itens.filter((i) => i.status !== 'normal') : itens;
  }, [itens, showOnlyCrit]);

  // Resumo dos itens de estoque (MEMOIZADO)
  const resumo = useMemo(() => ({
    total: itens.length,
    criticos: itens.filter((i) => i.status !== 'normal').length,
    valorTotal: itens.reduce((s, i) => s + i.valorTotal, 0),
  }), [itens]);

  // Movimentações de estoque filtradas e ordenadas (MEMOIZADO)
=======
  const itens = (db.estoque || []).map((item) => {
    const hist = (db.movimentacoes_estoque || []).filter((m) => Number(m.item_estoque_id) === Number(item.id));
    const pico = Math.max(Number(item.quantidade_atual || 0), ...hist.map((h) => Number(h.quantidade || 0)));
    const saldo = Number(item.quantidade_atual || 0);
    const ratio = pico ? (saldo / pico) * 100 : 0;
    const consumos = hist.filter((h) => ['consumo', 'saida'].includes(h.tipo));
    const mediaConsumo = consumos.length ? consumos.reduce((s, c) => s + Number(c.quantidade || 0), 0) / Math.max(consumos.length, 1) : 0;
    const diasRest = mediaConsumo > 0 ? saldo / mediaConsumo : 999;
    const status = ratio < 10 ? 'critico' : ratio < 20 ? 'baixo' : 'normal';
    return { ...item, pico, saldo, ratio, mediaConsumo, diasRest, valorTotal: saldo * Number(item.valor_unitario || 0), status };
  });

  const itensView = showOnlyCrit ? itens.filter((i) => i.status !== 'normal') : itens;
  const resumo = {
    total: itens.length,
    criticos: itens.filter((i) => i.status !== 'normal').length,
    valorTotal: itens.reduce((s, i) => s + i.valorTotal, 0),
  };

>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  const movs = useMemo(() => (db.movimentacoes_estoque || []).filter((m) => {
    if (filters.item !== 'todos' && Number(m.item_estoque_id) !== Number(filters.item)) return false;
    if (filters.tipo !== 'todos' && m.tipo !== filters.tipo) return false;
    if (filters.lote !== 'todos' && Number(m.lote_id) !== Number(filters.lote)) return false;
    return true;
  }).sort((a, b) => new Date(b.data) - new Date(a.data)), [db.movimentacoes_estoque, filters]);

<<<<<<< HEAD
  /**
   * Exporta as movimentações de estoque para um arquivo CSV.
   */
  function exportCsv() {
    const header = 'data,item,tipo,quantidade,lote,valor,obs';
    const rows = movs.map((m) => {
      const item = estoqueMap.get(m.item_estoque_id)?.produto || ''; // Usar estoqueMap
      const lote = lotesMap.get(m.lote_id)?.nome || ''; // Usar lotesMap
=======
  function exportCsv() {
    const header = 'data,item,tipo,quantidade,lote,valor,obs';
    const rows = movs.map((m) => {
      const item = itens.find((i) => i.id === m.item_estoque_id)?.produto || '';
      const lote = (db.lotes || []).find((l) => l.id === m.lote_id)?.nome || '';
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
      return [m.data, item, m.tipo, m.quantidade, lote, m.valor_total || 0, m.obs || ''].join(',');
    });
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'movimentacoes_estoque.csv';
    a.click();
<<<<<<< HEAD
    URL.revokeObjectURL(blob); // Liberar o URL do objeto
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  }

  return (
    <div className="page rebanho-page">
      <div className="rebanho-header">
        <h1>Estoque</h1>
        <div className="lote-actions">
<<<<<<< HEAD
          <Button icon={<ArrowUpCircle size={14} />} onClick={() => { setSelectedItem(null); setOpenEntrada(true); }}>Entrada</Button>
          <Button variant="outline" icon={<ArrowDownCircle size={14} />} onClick={() => { setSelectedItem(null); setOpenSaida(true); }}>Saída/Consumo</Button>
          <Button variant={showOnlyCrit ? 'warning' : 'ghost'} onClick={() => setShowOnlyCrit((v) => !v)}>
            {showOnlyCrit ? 'Mostrar todos' : 'Mostrar apenas críticos'}
          </Button>
=======
          <Button icon={<ArrowUpCircle size={14} />} onClick={() => setOpenEntrada(true)}>Entrada</Button>
          <Button variant="outline" icon={<ArrowDownCircle size={14} />} onClick={() => setOpenSaida(true)}>Saída/Consumo</Button>
          <Button variant={showOnlyCrit ? 'warning' : 'ghost'} onClick={() => setShowOnlyCrit((v) => !v)}>Mostrar apenas críticos</Button>
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
        </div>
      </div>

      <div className="dashboard-grid dashboard-grid--kpi-secondary">
        <Card className="kpi-card" title="Total de itens">{resumo.total}</Card>
        <Card className="kpi-card" title="Itens críticos">{resumo.criticos}</Card>
        <Card className="kpi-card" title="Valor total em estoque">{formatCurrency(resumo.valorTotal)}</Card>
      </div>

      <div className="lote-cards-grid">
<<<<<<< HEAD
        {itensView.length === 0 ? (
          <div className="empty-box">
            <strong>{showOnlyCrit ? 'Nenhum item crítico.' : 'Nenhum item no estoque.'}</strong>
            <span>{showOnlyCrit ? 'Todos os itens estão em nível normal.' : 'Use o botão "Entrada" para adicionar itens.'}</span>
          </div>
        ) : (
          itensView.map((item) => {
            const border = item.status === 'critico' ? '#c53030' : item.status === 'baixo' ? '#b7791f' : 'var(--color-border)';
            const bar = item.status === 'critico' ? '#c53030' : item.status === 'baixo' ? '#b7791f' : '#2d6a4f';
            return (
              <Card key={item.id} className="estoque-card" style={{ borderColor: border }}>
                <div className="estoque-card-header">
                  <div>
                    <h3 className="estoque-card-nome">{item.produto}</h3>
                    <span className={`badge-categoria ${String(item.categoria || '').toLowerCase().includes('san') ? 'badge-sanitario' : String(item.categoria || '').toLowerCase().includes('med') ? 'badge-medicamento' : 'badge-insumo'}`}>
                      <span className="dot" />
                      {item.categoria}
                    </span>
                  </div>
                  <Badge variant={item.status === 'critico' ? 'danger' : item.status === 'baixo' ? 'warning' : 'neutral'}>{item.status}</Badge>
                </div>
                {item.status === 'critico' ? <p className="negative"><AlertTriangle size={14} /> Crítico</p> : null}
                <div className="estoque-card-quantidade">{formatNumber(item.saldo, 2)} {item.unidade}</div>
                <div className="progress-bar-container"><div className={`progress-bar-fill ${item.status === 'critico' ? 'danger' : item.status === 'baixo' ? 'warning' : ''}`} style={{ width: `${Math.min(Math.max(item.ratio, 4), 100)}%`, background: bar }} /></div>
                <div className="progress-label">{formatNumber(item.ratio, 0)}%</div>
                <div className="estoque-card-details">
                  <div className="estoque-detail-row"><span>Valor unitário</span><span>{formatCurrency(item.valor_unitario)}</span></div>
                  <div className="estoque-detail-row"><span>Valor total</span><span>{formatCurrency(item.valorTotal)}</span></div>
                  <div className="estoque-detail-row"><span>Consumo médio diário</span><span>{formatNumber(item.mediaConsumo, 2)} {item.unidade}</span></div>
                  <div className="estoque-detail-row"><span>Dias restantes</span><span>{item.diasRest > 900 ? '—' : `${formatNumber(item.diasRest, 0)} dias`}</span></div>
                </div>
                <div className="estoque-card-actions lote-actions">
                  <button type="button" className="btn-entrada" onClick={() => { setSelectedItem(item); setOpenEntrada(true); }}>Entrada</button>
                  <button type="button" className="btn-saida" onClick={() => { setSelectedItem(item); setOpenSaida(true); }}>Saída</button>
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
              const item = estoqueMap.get(m.item_estoque_id); // Usar estoqueMap
              const lote = lotesMap.get(m.lote_id); // Usar lotesMap
              return <tr key={m.id}><td>{formatDate(m.data)}</td><td>{item?.produto || '—'}</td><td>{m.tipo}</td><td>{formatNumber(m.quantidade, 2)} {item?.unidade || ''}</td><td>{lote?.nome || '—'}</td><td>{formatCurrency(m.valor_total || 0)}</td></tr>;
            })}</tbody>
          </table >
=======
        {itensView.map((item) => {
          const border = item.status === 'critico' ? '#c53030' : item.status === 'baixo' ? '#b7791f' : 'var(--color-border)';
          const bar = item.status === 'critico' ? '#c53030' : item.status === 'baixo' ? '#b7791f' : '#2d6a4f';
          return (
            <Card key={item.id} className="estoque-card" style={{ borderColor: border }}>
              <div className="estoque-card-header">
                <div>
                  <h3 className="estoque-card-nome">{item.produto}</h3>
                  <span className={`badge-categoria ${String(item.categoria || '').toLowerCase().includes('san') ? 'badge-sanitario' : String(item.categoria || '').toLowerCase().includes('med') ? 'badge-medicamento' : 'badge-insumo'}`}>
                    <span className="dot" />
                    {item.categoria}
                  </span>
                </div>
                <Badge variant={item.status === 'critico' ? 'danger' : item.status === 'baixo' ? 'warning' : 'neutral'}>{item.status}</Badge>
              </div>
              {item.status === 'critico' ? <p className="negative"><AlertTriangle size={14} /> Crítico</p> : null}
              <div className="estoque-card-quantidade">{formatNumber(item.saldo, 2)} {item.unidade}</div>
              <div className="progress-bar-container"><div className={`progress-bar-fill ${item.status === 'critico' ? 'danger' : item.status === 'baixo' ? 'warning' : ''}`} style={{ width: `${Math.min(Math.max(item.ratio, 4), 100)}%`, background: bar }} /></div>
              <div className="progress-label">{formatNumber(item.ratio, 0)}%</div>
              <div className="estoque-card-details">
                <div className="estoque-detail-row"><span className="estoque-detail-label">Valor unitário</span><span className="estoque-detail-value">{formatCurrency(item.valor_unitario)}</span></div>
                <div className="estoque-detail-row"><span className="estoque-detail-label">Valor total</span><span className="estoque-detail-value">{formatCurrency(item.valorTotal)}</span></div>
                <div className="estoque-detail-row"><span className="estoque-detail-label">Consumo médio diário</span><span className="estoque-detail-value">{formatNumber(item.mediaConsumo, 2)} {item.unidade}</span></div>
                <div className="estoque-detail-row"><span className="estoque-detail-label">Dias restantes</span><span className="estoque-detail-value">{item.diasRest > 900 ? '—' : `${formatNumber(item.diasRest, 0)} dias`}</span></div>
              </div>
              <div className="estoque-card-actions lote-actions">
                <button type="button" className="btn-entrada" onClick={() => { setSelectedItem(item); setOpenEntrada(true); }}>Entrada</button>
                <button type="button" className="btn-saida" onClick={() => { setSelectedItem(item); setOpenSaida(true); }}>Saída</button>
                <button type="button" className="btn-historico" onClick={() => setFilters((f) => ({ ...f, item: item.id }))}><FileText size={12} /> Histórico</button>
              </div>
            </Card>
          );
        })}
      </div>

      <Card title="Histórico de movimentações" action={<button type="button" className="btn-export" onClick={exportCsv}><FileText size={14} /> Exportar CSV</button>}>
        <div className="filter-row rebanho-filters">
          <div className="filter-group"><label>Item</label><select className="filter-select" value={filters.item} onChange={(e) => setFilters((p) => ({ ...p, item: e.target.value }))}><option value="todos">Item</option>{itens.map((i) => <option key={i.id} value={i.id}>{i.produto}</option>)}</select></div>
          <div className="filter-group"><label>Tipo</label><select className="filter-select" value={filters.tipo} onChange={(e) => setFilters((p) => ({ ...p, tipo: e.target.value }))}><option value="todos">Tipo</option><option value="entrada">Entrada</option><option value="consumo">Consumo Diário</option><option value="tratamento">Tratamento</option><option value="ajuste">Ajuste</option><option value="perda">Perda</option></select></div>
          <div className="filter-group"><label>Lote</label><select className="filter-select" value={filters.lote} onChange={(e) => setFilters((p) => ({ ...p, lote: e.target.value }))}><option value="todos">Lote</option>{(db.lotes || []).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}</select></div>
          <div className="filter-group"><label>Período</label><select className="filter-select" value={filters.periodo} onChange={(e) => setFilters((p) => ({ ...p, periodo: e.target.value }))}><option value="todos">Todos</option></select></div>
        </div>
        {movs.length > 0 ? (
          <table className="history-table">
            <thead><tr><th>Data</th><th>Item</th><th>Tipo</th><th>Quantidade</th><th>Lote</th><th>Valor</th></tr></thead>
            <tbody>{movs.map((m) => {
            const itemNome = itens.find((i) => i.id === m.item_estoque_id)?.produto;
            const loteNome = (db.lotes || []).find((l) => l.id === m.lote_id)?.nome;
            return <tr key={m.id}><td>{formatDate(m.data)}</td><td>{itemNome}</td><td><Badge variant={m.tipo === 'entrada' ? 'info' : 'warning'}>{m.tipo}</Badge></td><td>{formatNumber(m.quantidade, 2)}</td><td>{loteNome || 'Sem lote'}</td><td>{formatCurrency(m.valor_total || 0)}</td></tr>;
          })}</tbody>
          </table>
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
        ) : (
          <div className="table-empty"><AlertTriangle className="table-empty-icon" size={20} />Nenhuma movimentação encontrada para os filtros selecionados.</div>
        )}
      </Card>

<<<<<<< HEAD
      {openEntrada && <EntradaModal db={db} setDb={setDb} selectedItem={selectedItem} estoqueMap={estoqueMap} onClose={() => { setSelectedItem(null); setOpenEntrada(false); }} />}
=======
      {openEntrada && <EntradaModal db={db} setDb={setDb} selectedItem={selectedItem} onClose={() => { setSelectedItem(null); setOpenEntrada(false); }} />}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
      {openSaida && (
        <SaidaModal
          db={db}
          setDb={setDb}
          selectedItem={selectedItem}
          onRegistrarSaidaEstoque={onRegistrarSaidaEstoque}
<<<<<<< HEAD
          estoqueMap={estoqueMap}
          lotesMap={lotesMap}
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
          onClose={() => { setSelectedItem(null); setOpenSaida(false); }}
        />
      )}
    </div>
  );
}

<<<<<<< HEAD
/**
 * Modal para registrar a entrada de itens no estoque.
 * @param {object} props - As propriedades do componente.
 * @param {object} props.db - O objeto do banco de dados.
 * @param {function} props.setDb - Função para atualizar o banco de dados.
 * @param {object} [props.selectedItem] - Item de estoque pré-selecionado.
 * @param {Map<number, object>} props.estoqueMap - Mapa de itens de estoque por ID.
 * @param {function} props.onClose - Callback para fechar o modal.
 */
function EntradaModal({ db, setDb, selectedItem, estoqueMap, onClose }) {
  // const { showToast } = useToast(); // Se usar useToast

  const [form, setForm] = useState({
    item_id: selectedItem?.id || '',
    qtd: '',
    custo: selectedItem?.valor_unitario || '',
    validade: '',
    fornecedor: '',
    nf: '',
    data: '',
    obs: ''
  });

  const item = estoqueMap.get(Number(form.item_id)); // Usar estoqueMap
  const total = Number(form.qtd || 0) * Number(form.custo || 0);

  function submit() {
    if (!form.data || !form.item_id || Number(form.qtd) <= 0) {
      // showToast({ type: 'error', message: 'Preencha todos os campos obrigatórios.' });
      alert('Preencha todos os campos obrigatórios.');
      return;
    }

    setDb((prev) => ({
      ...prev,
      estoque: prev.estoque.map((i) =>
        i.id === Number(form.item_id)
          ? {
              ...i,
              quantidade_atual: Number(i.quantidade_atual || 0) + Number(form.qtd),
              valor_unitario: Number(form.custo || i.valor_unitario),
              data_validade: form.validade || i.data_validade,
            }
          : i
      ),
      movimentacoes_estoque: [
        ...(prev.movimentacoes_estoque || []),
        {
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
    // showToast({ type: 'success', message: 'Entrada de estoque registrada com sucesso.' });
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Entrada de estoque" footer={<Button onClick={submit}>Confirmar entrada</Button>}>
      <div className="form-grid two">
        <label className="ui-input-wrap">
          <span className="ui-input-label">Item</span>
          <select className="ui-input" value={form.item_id} onChange={(e) => setForm((p) => ({ ...p, item_id: e.target.value }))}>
            <option value="">Selecione</option>
            {(db.estoque || []).map((i) => (
              <option key={i.id} value={i.id}>
                {i.produto}
              </option>
            ))}
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
    </Modal>
  );
}

/**
 * Modal para registrar a saída ou consumo de itens do estoque.
 * @param {object} props - As propriedades do componente.
 * @param {object} props.db - O objeto do banco de dados.
 * @param {function} props.setDb - Função para atualizar o banco de dados.
 * @param {object} [props.selectedItem] - Item de estoque pré-selecionado.
 * @param {function} [props.onRegistrarSaidaEstoque] - Callback opcional para registrar saída de estoque de forma customizada.
 * @param {Map<number, object>} props.estoqueMap - Mapa de itens de estoque por ID.
 * @param {Map<number, object>} props.lotesMap - Mapa de lotes por ID.
 * @param {function} props.onClose - Callback para fechar o modal.
 */
function SaidaModal({ db, setDb, selectedItem, onRegistrarSaidaEstoque, estoqueMap, lotesMap, onClose }) {
  // const { showToast } = useToast(); // Se usar useToast

  const [form, setForm] = useState({
    item_id: selectedItem?.id || '',
    tipo: 'consumo',
    lote_id: '',
    qtd: '',
    data: '',
    obs: ''
  });

  const item = estoqueMap.get(Number(form.item_id)); // Usar estoqueMap
  const saldo = Number(item?.quantidade_atual || 0);

  /**
   * Mapeia a categoria do item de estoque para uma categoria de despesa financeira.
   * @param {string} cat - Categoria do item de estoque.
   * @returns {string} Categoria de despesa.
   */
  function categoriaDespesa(cat) {
    const lowerCat = (cat || '').toLowerCase();
    if (['ração', 'suplemento', 'insumo'].includes(lowerCat)) return 'Alimentação';
    if (['medicamento', 'sanitário', 'vacina'].includes(lowerCat)) return 'Sanitário';
=======
function EntradaModal({ db, setDb, selectedItem, onClose }) {
  const [form, setForm] = useState({ item_id: selectedItem?.id || '', qtd: '', custo: selectedItem?.valor_unitario || '', validade: '', fornecedor: '', nf: '', data: '', obs: '' });
  const item = (db.estoque || []).find((i) => Number(i.id) === Number(form.item_id));
  const total = Number(form.qtd || 0) * Number(form.custo || 0);

  function submit() {
    if (!form.data || !form.item_id || Number(form.qtd) <= 0) return;
    setDb((prev) => ({
      ...prev,
      estoque: prev.estoque.map((i) => i.id === Number(form.item_id) ? { ...i, quantidade_atual: Number(i.quantidade_atual || 0) + Number(form.qtd), valor_unitario: Number(form.custo || i.valor_unitario), data_validade: form.validade || i.data_validade } : i),
      movimentacoes_estoque: [...(prev.movimentacoes_estoque || []), { id: gerarNovoId(prev.movimentacoes_estoque || []), item_estoque_id: Number(form.item_id), tipo: 'entrada', quantidade: Number(form.qtd), data: form.data, valor_total: total, obs: form.obs, fornecedor: form.fornecedor, numero_nf: form.nf }],
    }));
    onClose();
  }

  return <Modal open onClose={onClose} title="Entrada de estoque" footer={<Button onClick={submit}>Confirmar entrada</Button>}><div className="form-grid two"><label>Item<select value={form.item_id} onChange={(e) => setForm((p) => ({ ...p, item_id: e.target.value }))}><option value="">Selecione</option>{(db.estoque || []).map((i) => <option key={i.id} value={i.id}>{i.produto}</option>)}</select></label><Input label="Quantidade" type="number" value={form.qtd} onChange={(e) => setForm((p) => ({ ...p, qtd: e.target.value }))} /><Input label="Unidade" value={item?.unidade || ''} readOnly /><Input label="Custo unitário" type="number" value={form.custo} onChange={(e) => setForm((p) => ({ ...p, custo: e.target.value }))} /><Input label="Valor total" value={formatCurrency(total)} readOnly /><Input label="Validade" type="date" value={form.validade} onChange={(e) => setForm((p) => ({ ...p, validade: e.target.value }))} /><Input label="Fornecedor" value={form.fornecedor} onChange={(e) => setForm((p) => ({ ...p, fornecedor: e.target.value }))} /><Input label="Nota fiscal" value={form.nf} onChange={(e) => setForm((p) => ({ ...p, nf: e.target.value }))} /><Input label="Data" type="date" value={form.data} onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))} /><Input label="Observações" value={form.obs} onChange={(e) => setForm((p) => ({ ...p, obs: e.target.value }))} /></div></Modal>;
}

function SaidaModal({ db, setDb, selectedItem, onRegistrarSaidaEstoque, onClose }) {
  const [form, setForm] = useState({ item_id: selectedItem?.id || '', tipo: 'consumo', lote_id: '', qtd: '', data: '', obs: '' });
  const item = (db.estoque || []).find((i) => Number(i.id) === Number(form.item_id));
  const saldo = Number(item?.quantidade_atual || 0);

  function categoriaDespesa(cat) {
    if (['ração', 'suplemento', 'insumo'].includes((cat || '').toLowerCase())) return 'Alimentação';
    if (['medicamento', 'sanitário', 'vacina'].includes((cat || '').toLowerCase())) return 'Sanitário';
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
    return 'Outros';
  }

  function submit() {
    const qtd = Number(form.qtd || 0);
<<<<<<< HEAD
    if (!form.data || !form.item_id || qtd <= 0 || qtd > saldo) {
      // showToast({ type: 'error', message: 'Verifique os campos e a quantidade.' });
      alert('Verifique os campos e a quantidade.');
      return;
    }

    // Se houver um callback customizado, use-o
=======
    if (!form.data || !form.item_id || qtd <= 0 || qtd > saldo) return;
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
    if (typeof onRegistrarSaidaEstoque === 'function') {
      try {
        onRegistrarSaidaEstoque({
          itemId: Number(form.item_id),
          loteId: form.lote_id ? Number(form.lote_id) : '',
          quantidade: qtd,
          tipo: form.tipo,
          data: form.data,
          obs: form.obs.trim(),
        });
<<<<<<< HEAD
        // showToast({ type: 'success', message: 'Saída de estoque registrada com sucesso.' });
        onClose();
      } catch (error) {
        // showToast({ type: 'error', message: error?.message || 'Erro ao registrar saída de estoque.' });
=======
        onClose();
      } catch (error) {
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
        alert(error?.message || 'Erro ao registrar saída de estoque.');
      }
      return;
    }
<<<<<<< HEAD

    // Lógica padrão de atualização do DB
    const valor = qtd * Number(item?.valor_unitario || 0);
    setDb((prev) => ({
      ...prev,
      estoque: prev.estoque.map((i) =>
        i.id === Number(form.item_id) ? { ...i, quantidade_atual: Number(i.quantidade_atual || 0) - qtd } : i
      ),
      movimentacoes_estoque: [
        ...(prev.movimentacoes_estoque || []),
        {
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
            {
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
    // showToast({ type: 'success', message: 'Saída de estoque registrada com sucesso.' });
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Saída / Consumo" footer={<Button variant="danger" onClick={submit}>Confirmar saída</Button>}>
      <div className="form-grid two">
        <label className="ui-input-wrap">
          <span className="ui-input-label">Item</span>
          <select className="ui-input" value={form.item_id} onChange={(e) => setForm((p) => ({ ...p, item_id: e.target.value }))}>
            <option value="">Selecione</option>
            {(db.estoque || []).map((i) => (
              <option key={i.id} value={i.id}>
                {i.produto} (saldo {formatNumber(i.quantidade_atual, 2)})
              </option>
            ))}
          </select>
        </label>
        <label className="ui-input-wrap">
          <span className="ui-input-label">Tipo</span>
          <select className="ui-input" value={form.tipo} onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}>
            <option value="consumo">Consumo Diário</option>
            <option value="tratamento">Tratamento</option>
            <option value="ajuste">Ajuste</option>
            <option value="perda">Perda</option>
            <option value="saida">Saída</option> {/* Adicionado tipo 'saida' */}
          </select>
        </label>
        <label className="ui-input-wrap">
          <span className="ui-input-label">Lote</span>
          <select className="ui-input" value={form.lote_id} onChange={(e) => setForm((p) => ({ ...p, lote_id: e.target.value }))}>
            <option value="">Opcional</option>
            {(db.lotes || []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
        </label>
        <Input label="Quantidade" type="number" error={Number(form.qtd || 0) > saldo ? `Máximo ${formatNumber(saldo, 2)}` : ''} value={form.qtd} onChange={(e) => setForm((p) => ({ ...p, qtd: e.target.value }))} />
        <Input label="Data" type="date" value={form.data} onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))} />
        <Input label="Observações" value={form.obs} onChange={(e) => setForm((p) => ({ ...p, obs: e.target.value }))} />
      </div>
    </Modal>
  );
}
=======
    const valor = qtd * Number(item?.valor_unitario || 0);
    setDb((prev) => ({
      ...prev,
      estoque: prev.estoque.map((i) => i.id === Number(form.item_id) ? { ...i, quantidade_atual: Number(i.quantidade_atual || 0) - qtd } : i),
      movimentacoes_estoque: [...(prev.movimentacoes_estoque || []), { id: gerarNovoId(prev.movimentacoes_estoque || []), item_estoque_id: Number(form.item_id), tipo: form.tipo, lote_id: form.lote_id ? Number(form.lote_id) : null, quantidade: qtd, data: form.data, valor_total: valor, obs: form.obs }],
      movimentacoes_financeiras: form.lote_id ? [...(prev.movimentacoes_financeiras || []), { id: gerarNovoId(prev.movimentacoes_financeiras || []), tipo: 'despesa', categoria: categoriaDespesa(item?.categoria), valor, data: form.data, lote_id: Number(form.lote_id), descricao: `Consumo de ${item?.produto}` }] : (prev.movimentacoes_financeiras || []),
    }));
    onClose();
  }

  return <Modal open onClose={onClose} title="Saída / Consumo" footer={<Button variant="danger" onClick={submit}>Confirmar saída</Button>}><div className="form-grid two"><label>Item<select value={form.item_id} onChange={(e) => setForm((p) => ({ ...p, item_id: e.target.value }))}><option value="">Selecione</option>{(db.estoque || []).map((i) => <option key={i.id} value={i.id}>{i.produto} (saldo {formatNumber(i.quantidade_atual, 2)})</option>)}</select></label><label>Tipo<select value={form.tipo} onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}><option value="consumo">Consumo Diário</option><option value="tratamento">Tratamento</option><option value="ajuste">Ajuste</option><option value="perda">Perda</option></select></label><label>Lote<select value={form.lote_id} onChange={(e) => setForm((p) => ({ ...p, lote_id: e.target.value }))}><option value="">Opcional</option>{(db.lotes || []).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}</select></label><Input label="Quantidade" type="number" error={Number(form.qtd || 0) > saldo ? `Máximo ${formatNumber(saldo, 2)}` : ''} value={form.qtd} onChange={(e) => setForm((p) => ({ ...p, qtd: e.target.value }))} /><Input label="Data" type="date" value={form.data} onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))} /><Input label="Observações" value={form.obs} onChange={(e) => setForm((p) => ({ ...p, obs: e.target.value }))} /></div></Modal>;
}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
