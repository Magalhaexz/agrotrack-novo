import { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { formatarNumero } from '../utils/formatters';

const FORM_VAZIO = {
  item_id: '',
  quantidade: '',
  custo_unit: '',
  fornecedor: '',
  data: '',
  obs: '',
};

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function normalizarInitialData(itens) {
  return {
    ...FORM_VAZIO,
    item_id: itens[0]?.id ? String(itens[0].id) : '',
    data: hojeISO(),
  };
}

function validarForm(form) {
  if (!form.item_id) return 'Selecione o item de estoque.';
  if (Number(form.quantidade || 0) <= 0) return 'Informe uma quantidade válida.';
  if (Number(form.custo_unit || 0) <= 0) return 'Informe o custo unitário.';
  if (!form.data) return 'Informe a data.';
  return null;
}

export default function EntradaEstoqueModal({ itens = [], handleRegistrarEntradaEstoque, onClose }) {
  const [form, setForm] = useState(() => normalizarInitialData(itens));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    setForm(normalizarInitialData(itens));
    setErro('');
  }, [itens]);

  const itemSelecionado = useMemo(
    () => itens.find((item) => String(item.id) === String(form.item_id)),
    [itens, form.item_id]
  );

  const valorTotal = useMemo(() => Number(form.quantidade || 0) * Number(form.custo_unit || 0), [form.quantidade, form.custo_unit]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const erroValidacao = validarForm(form);

    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    setErro('');
    setSalvando(true);

    try {
      await handleRegistrarEntradaEstoque({
        itemId: Number(form.item_id),
        quantidade: Number(form.quantidade),
        custoUnit: Number(form.custo_unit),
        data: form.data,
        fornecedor: form.fornecedor.trim(),
        obs: form.obs.trim(),
      });
      onClose();
    } catch {
      setErro('Erro ao registrar entrada. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  const footer = (
    <div className="modal-footer action-row" style={{ width: '100%' }}>
      <Button variant="ghost" onClick={onClose} disabled={salvando}>Cancelar</Button>
      <Button onClick={handleSubmit} disabled={salvando}>{salvando ? 'Salvando...' : 'Confirmar entrada'}</Button>
    </div>
  );

  return (
    <Modal open onClose={onClose} title="Registrar entrada de estoque" subtitle="Adicione quantidade e custo ao item selecionado." footer={footer}>
      <form onSubmit={handleSubmit} className="form-section">
        <section className="section-card">
          <div className="section-header"><h4>Dados principais</h4></div>
          <div className="form-grid two">
            <label className="ui-input-wrap">
              <span className="ui-input-label">Item</span>
              <select className="ui-input" name="item_id" value={form.item_id} onChange={handleChange}>
                <option value="">Selecione</option>
                {itens.map((item) => <option key={item.id} value={item.id}>{item.produto}</option>)}
              </select>
            </label>
            <label className="ui-input-wrap">
              <span className="ui-input-label">Quantidade</span>
              <input className="ui-input" name="quantidade" type="number" step="0.01" min={0} value={form.quantidade} onChange={handleChange} />
            </label>
            <label className="ui-input-wrap">
              <span className="ui-input-label">Unidade</span>
              <input className="ui-input" value={itemSelecionado?.unidade || '—'} readOnly />
            </label>
            <label className="ui-input-wrap">
              <span className="ui-input-label">Custo unitário</span>
              <input className="ui-input" name="custo_unit" type="number" step="0.01" min={0} value={form.custo_unit} onChange={handleChange} />
            </label>
          </div>
        </section>

        <section className="section-card">
          <div className="section-header"><h4>Rastreabilidade</h4></div>
          <div className="form-grid two">
            <label className="ui-input-wrap">
              <span className="ui-input-label">Fornecedor</span>
              <input className="ui-input" name="fornecedor" value={form.fornecedor} onChange={handleChange} />
            </label>
            <label className="ui-input-wrap">
              <span className="ui-input-label">Data</span>
              <input className="ui-input" name="data" type="date" max={hojeISO()} value={form.data} onChange={handleChange} />
            </label>
            <label className="ui-input-wrap full">
              <span className="ui-input-label">Observação</span>
              <textarea className="ui-input" name="obs" value={form.obs} onChange={handleChange} rows={3} />
            </label>
          </div>
        </section>

        <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
          Valor total: <strong>R$ {formatarNumero(valorTotal)}</strong>
        </p>

        {erro ? <p style={{ margin: 0, color: 'var(--color-danger)', fontSize: '0.85rem' }}>{erro}</p> : null}
      </form>
    </Modal>
  );
}
