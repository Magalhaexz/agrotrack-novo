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

export default function EntradaEstoqueModal({
  itens = [],
  handleRegistrarEntradaEstoque,
  onClose,
}) {
  const [form, setForm] = useState(() => normalizarInitialData(itens));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // Resetar o formulário quando o modal é aberto ou itens mudam
  // (assumindo que este modal é sempre "novo" e não de edição)
  // Se for um modal de edição, a lógica de initialData seria diferente.
  // Para entrada de estoque, geralmente é um formulário "novo" a cada abertura.
  useEffect(() => {
    setForm(normalizarInitialData(itens));
    setErro('');
  }, [itens]);

  const itemSelecionado = useMemo(
    () => itens.find((item) => String(item.id) === String(form.item_id)),
    [itens, form.item_id]
  );

  const valorTotal = useMemo(() => {
    return Number(form.quantidade || 0) * Number(form.custo_unit || 0);
  }, [form.quantidade, form.custo_unit]);

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
      // Não é ideal usar alert() aqui, o ideal seria um toast ou notificação
      // alert('Entrada registrada com sucesso');
      onClose();
    } catch (error) {
      console.error('Erro ao registrar entrada:', error);
      setErro('Erro ao registrar entrada. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      <Button variant="ghost" onClick={onClose} disabled={salvando}>Cancelar</Button>
      <Button onClick={handleSubmit} disabled={salvando}>
        {salvando ? 'Salvando...' : 'Confirmar entrada'}
      </Button>
    </div>
  );

  return (
    <Modal open onClose={onClose} title="Registrar entrada de estoque" footer={footer}>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>

        <label>
          Item
          <select className="ui-input" name="item_id" value={form.item_id} onChange={handleChange}>
            <option value="">Selecione</option>
            {itens.map((item) => (
              <option key={item.id} value={item.id}>{item.produto}</option>
            ))}
          </select>
        </label>

        <div className="grid-2">
          <label>
            Quantidade
            <input
              className="ui-input"
              name="quantidade"
              type="number"
              step="0.01"
              min={0}
              value={form.quantidade}
              onChange={handleChange}
            />
          </label>

          <label>
            Unidade
            <input
              className="ui-input"
              value={itemSelecionado?.unidade || '—'}
              readOnly
              style={{ opacity: 0.75 }}
            />
          </label>
        </div>

        <div className="grid-2">
          <label>
            Custo unitário
            <input
              className="ui-input"
              name="custo_unit"
              type="number"
              step="0.01"
              min={0}
              value={form.custo_unit}
              onChange={handleChange}
            />
          </label>

          <label>
            Valor total
            <input
              className="ui-input"
              value={`R$ ${formatarNumero(valorTotal)}`}
              readOnly
              style={{ opacity: 0.75 }}
            />
          </label>
        </div>

        <div className="grid-2">
          <label>
            Fornecedor
            <input
              className="ui-input"
              name="fornecedor"
              value={form.fornecedor}
              onChange={handleChange}
            />
          </label>
          <label>
            Data
            <input
              className="ui-input"
              name="data"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={form.data}
              onChange={handleChange}
            />
          </label>
        </div>

        <label>
          Observações
          <textarea
            className="ui-input"
            name="obs"
            value={form.obs}
            onChange={handleChange}
            rows={3}
          />
        </label>

        {erro && (
          <p style={{ margin: 0, color: 'var(--color-danger)', fontSize: '0.85rem' }}>
            {erro}
          </p>
        )}

      </form>
    </Modal>
  );
}
