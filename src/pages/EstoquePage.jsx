import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, FileText } from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { formatCurrency, formatDate, formatNumber } from '../utils/calculations';
import { gerarNovoId } from '../utils/id';

export default function EstoquePage({ db, setDb, onRegistrarSaidaEstoque }) {
  const [showOnlyCrit, setShowOnlyCrit] = useState(false);
  const [openEntrada, setOpenEntrada] = useState(false);
  const [openSaida, setOpenSaida] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [filters, setFilters] = useState({ item: 'todos', tipo: 'todos', lote: 'todos', periodo: 'todos' });

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

  const movs = useMemo(() => (db.movimentacoes_estoque || []).filter((m) => {
    if (filters.item !== 'todos' && Number(m.item_estoque_id) !== Number(filters.item)) return false;
    if (filters.tipo !== 'todos' && m.tipo !== filters.tipo) return false;
    if (filters.lote !== 'todos' && Number(m.lote_id) !== Number(filters.lote)) return false;
    return true;
  }).sort((a, b) => new Date(b.data) - new Date(a.data)), [db.movimentacoes_estoque, filters]);

  function exportCsv() {
    const header = 'data,item,tipo,quantidade,lote,valor,obs';
    const rows = movs.map((m) => {
      const item = itens.find((i) => i.id === m.item_estoque_id)?.produto || '';
      const lote = (db.lotes || []).find((l) => l.id === m.lote_id)?.nome || '';
      return [m.data, item, m.tipo, m.quantidade, lote, m.valor_total || 0, m.obs || ''].join(',');
    });
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'movimentacoes_estoque.csv';
    a.click();
  }

  return (
    <div className="page rebanho-page">
      <div className="rebanho-header">
        <h1>Estoque</h1>
        <div className="lote-actions">
          <Button icon={<ArrowUpCircle size={14} />} onClick={() => setOpenEntrada(true)}>Entrada</Button>
          <Button variant="outline" icon={<ArrowDownCircle size={14} />} onClick={() => setOpenSaida(true)}>Saída/Consumo</Button>
          <Button variant={showOnlyCrit ? 'warning' : 'ghost'} onClick={() => setShowOnlyCrit((v) => !v)}>Mostrar apenas críticos</Button>
        </div>
      </div>

      <div className="dashboard-grid dashboard-grid--kpi-secondary">
        <Card title="Total de itens">{resumo.total}</Card>
        <Card title="Itens críticos">{resumo.criticos}</Card>
        <Card title="Valor total em estoque">{formatCurrency(resumo.valorTotal)}</Card>
      </div>

      <div className="lote-cards-grid">
        {itensView.map((item) => {
          const border = item.status === 'critico' ? '#c53030' : item.status === 'baixo' ? '#b7791f' : 'var(--color-border)';
          const bar = item.status === 'critico' ? '#c53030' : item.status === 'baixo' ? '#b7791f' : '#2d6a4f';
          return (
            <Card key={item.id} className="lote-card-modern" style={{ borderColor: border }}>
              <div className="lote-card-title">
                <h3>{item.produto}</h3>
                <Badge variant={item.status === 'critico' ? 'danger' : item.status === 'baixo' ? 'warning' : 'neutral'}>{item.categoria}</Badge>
              </div>
              {item.status === 'critico' ? <p className="negative"><AlertTriangle size={14} /> Crítico</p> : null}
              <p><strong>{formatNumber(item.saldo, 2)} {item.unidade}</strong></p>
              <div className="progress-line"><span style={{ width: `${Math.min(Math.max(item.ratio, 4), 100)}%`, background: bar }} /></div>
              <p>Valor unitário: {formatCurrency(item.valor_unitario)}</p>
              <p>Valor total: {formatCurrency(item.valorTotal)}</p>
              <p>Consumo médio diário: {formatNumber(item.mediaConsumo, 2)} {item.unidade}</p>
              <p>Dias restantes: {item.diasRest > 900 ? '—' : `${formatNumber(item.diasRest, 0)} dias`}</p>
              <div className="lote-actions">
                <Button size="sm" onClick={() => { setSelectedItem(item); setOpenEntrada(true); }}>Entrada</Button>
                <Button size="sm" variant="outline" onClick={() => { setSelectedItem(item); setOpenSaida(true); }}>Saída/Consumo</Button>
                <Button size="sm" variant="ghost" icon={<FileText size={12} />} onClick={() => setFilters((f) => ({ ...f, item: item.id }))}>Histórico</Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Card title="Histórico de movimentações" action={<Button variant="outline" onClick={exportCsv}>Exportar CSV</Button>}>
        <div className="rebanho-filters">
          <select value={filters.item} onChange={(e) => setFilters((p) => ({ ...p, item: e.target.value }))}><option value="todos">Item</option>{itens.map((i) => <option key={i.id} value={i.id}>{i.produto}</option>)}</select>
          <select value={filters.tipo} onChange={(e) => setFilters((p) => ({ ...p, tipo: e.target.value }))}><option value="todos">Tipo</option><option value="entrada">Entrada</option><option value="consumo">Consumo Diário</option><option value="tratamento">Tratamento</option><option value="ajuste">Ajuste</option><option value="perda">Perda</option></select>
          <select value={filters.lote} onChange={(e) => setFilters((p) => ({ ...p, lote: e.target.value }))}><option value="todos">Lote</option>{(db.lotes || []).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}</select>
        </div>
        <div className="alerts-list">
          {movs.map((m) => {
            const itemNome = itens.find((i) => i.id === m.item_estoque_id)?.produto;
            const loteNome = (db.lotes || []).find((l) => l.id === m.lote_id)?.nome;
            return <div key={m.id} className="alert-item"><Badge variant={m.tipo === 'entrada' ? 'info' : 'warning'}>{m.tipo}</Badge><div><strong>{itemNome}</strong><p>{formatDate(m.data)} · {formatNumber(m.quantidade, 2)} · {loteNome || 'Sem lote'} · {formatCurrency(m.valor_total || 0)}</p></div></div>;
          })}
        </div>
      </Card>

      {openEntrada && <EntradaModal db={db} setDb={setDb} selectedItem={selectedItem} onClose={() => { setSelectedItem(null); setOpenEntrada(false); }} />}
      {openSaida && (
        <SaidaModal
          db={db}
          setDb={setDb}
          selectedItem={selectedItem}
          onRegistrarSaidaEstoque={onRegistrarSaidaEstoque}
          onClose={() => { setSelectedItem(null); setOpenSaida(false); }}
        />
      )}
    </div>
  );
}

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
    return 'Outros';
  }

  function submit() {
    const qtd = Number(form.qtd || 0);
    if (!form.data || !form.item_id || qtd <= 0 || qtd > saldo) return;
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
        onClose();
      } catch (error) {
        alert(error?.message || 'Erro ao registrar saída de estoque.');
      }
      return;
    }
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
