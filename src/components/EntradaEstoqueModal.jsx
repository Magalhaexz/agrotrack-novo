import { useMemo, useState } from 'react';
<<<<<<< HEAD
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

=======
import { formatarNumero } from '../utils/formatters';

// Props:
// itens: Array<{ id, produto, unidade, quantidade_atual }>
// handleRegistrarEntradaEstoque: (dados) => void
// onClose: () => void
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
export default function EntradaEstoqueModal({
  itens = [],
  handleRegistrarEntradaEstoque,
  onClose,
}) {
<<<<<<< HEAD
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
=======
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({
    item_id: itens[0]?.id ? String(itens[0].id) : '',
    quantidade: '',
    custo_unit: '',
    fornecedor: '',
    data: hojeISO(),
    obs: '',
  });
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d

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
<<<<<<< HEAD
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
=======

    const quantidade = Number(form.quantidade || 0);
    const custoUnit = Number(form.custo_unit || 0);

    if (!form.item_id) {
      alert('Selecione o item de estoque.');
      return;
    }

    if (quantidade <= 0) {
      alert('Informe uma quantidade válida.');
      return;
    }

    if (custoUnit <= 0) {
      alert('Informe o custo unitário.');
      return;
    }

    if (!form.data) {
      alert('Informe a data.');
      return;
    }

    setSalvando(true);

    await Promise.resolve(
      handleRegistrarEntradaEstoque({
      itemId: Number(form.item_id),
      quantidade,
      custoUnit,
      data: form.data,
      fornecedor: form.fornecedor.trim(),
      obs: form.obs.trim(),
      })
    );
    setSalvando(false);

    alert('Entrada registrada com sucesso');
    onClose();
  }

  return (
    <div style={overlayStyle}>
      <div className="card" style={cardStyle}>
        <div className="card-header">
          <span className="card-title">Registrar entrada de estoque</span>
        </div>

        <div className="card-body">
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={labelStyle}>Item</label>
              <select
                name="item_id"
                value={form.item_id}
                onChange={handleChange}
                style={inputStyle}
              >
                <option value="">Selecione</option>
                {itens.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.produto}
                  </option>
                ))}
              </select>
            </div>

            <div style={grid2}>
              <div>
                <label style={labelStyle}>Quantidade</label>
                <input
                  name="quantidade"
                  type="number"
                  step="0.01"
      min="0"
                  value={form.quantidade}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Unidade</label>
                <input
                  value={itemSelecionado?.unidade || '—'}
                  readOnly
                  style={{ ...inputStyle, opacity: 0.75 }}
                />
              </div>
            </div>

            <div style={grid2}>
              <div>
                <label style={labelStyle}>Custo unitário</label>
                <input
                  name="custo_unit"
                  type="number"
                  step="0.01"
      min="0"
                  value={form.custo_unit}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Valor total</label>
                <input
                  value={`R$ ${formatarNumero(valorTotal)}`}
                  readOnly
                  style={{ ...inputStyle, opacity: 0.75 }}
                />
              </div>
            </div>

            <div style={grid2}>
              <div>
                <label style={labelStyle}>Fornecedor</label>
                <input
                  name="fornecedor"
                  value={form.fornecedor}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Data</label>
                <input
                  name="data"
                  type="date"
      max={new Date().toISOString().slice(0, 10)}
                  value={form.data}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Observações</label>
              <textarea
                name="obs"
                value={form.obs}
                onChange={handleChange}
                style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={onClose} style={cancelBtn}>
                Cancelar
              </button>
              <button type="submit" style={saveBtn} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Confirmar entrada'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}


const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  zIndex: 999,
};

const cardStyle = {
  width: '100%',
  maxWidth: '680px',
  borderRadius: '16px',
  overflow: 'hidden',
};

const labelStyle = {
  display: 'block',
  marginBottom: 6,
  fontSize: 12,
};

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid #2e4020',
  background: '#0f160b',
  color: '#cce0a8',
  outline: 'none',
};

const cancelBtn = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #2e4020',
  background: 'transparent',
  color: '#7a9e62',
  cursor: 'pointer',
};

const saveBtn = {
  padding: '10px 14px',
  borderRadius: 10,
  border: 'none',
  background: '#6bb520',
  color: '#081006',
  fontWeight: 700,
  cursor: 'pointer',
};

const grid2 = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 14,
};
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
