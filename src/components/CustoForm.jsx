import { useEffect, useState } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';

const CATEGORIAS = [
  'alimentação', 'sanitário', 'mão de obra',
  'combustível', 'manutenção', 'administrativo', 'outros',
];

const FORM_VAZIO = {
  lote_id: '',
  cat: 'alimentação',
  desc: '',
  data: '',
  val: '',
};

function normalizarInitialData(data) {
  if (!data) return FORM_VAZIO;
  return {
    lote_id: data.lote_id ?? '',
    cat: data.cat || 'alimentação',
    desc: data.desc || '',
    data: data.data || '',
    val: data.val ?? '',
  };
}

function validarForm(form) {
  if (!form.lote_id) return 'Selecione o lote.';
  if (!form.desc.trim()) return 'Informe a descrição do custo.';
  if (!form.data) return 'Informe a data.';
  if (!form.val) return 'Informe o valor.';
  if (Number(form.val || 0) <= 0) return 'Valor deve ser maior que zero.';
  return null;
}

export default function CustoForm({ initialData, lotes = [], onSave, onCancel }) {
  const [form, setForm] = useState(() => normalizarInitialData(initialData));
  const [erro, setErro] = useState('');

  useEffect(() => {
    setForm(normalizarInitialData(initialData));
    setErro('');
  }, [initialData]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const erroValidacao = validarForm(form);

    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    setErro('');
    onSave?.({
      lote_id: Number(form.lote_id),
      cat: form.cat,
      desc: form.desc.trim(),
      data: form.data,
      val: Number(form.val),
    });
  }

  const titulo = initialData ? 'Editar custo' : 'Novo custo';

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      <Button onClick={handleSubmit}>Salvar custo</Button>
    </div>
  );

  return (
    <Modal open onClose={onCancel} title={titulo} footer={footer}>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>

        <label>
          Lote
          <select className="ui-input" name="lote_id" value={form.lote_id} onChange={handleChange}>
            <option value="">Selecione</option>
            {lotes.map((lote) => (
              <option key={lote.id} value={lote.id}>{lote.nome}</option>
            ))}
          </select>
        </label>

        <div className="grid-2">
          <label>
            Categoria
            <select className="ui-input" name="cat" value={form.cat} onChange={handleChange}>
              {CATEGORIAS.map((cat) => (
                <option key={cat} value={cat}>{cat[0].toUpperCase() + cat.slice(1)}</option>
              ))}
            </select>
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
          Descrição
          <input
            className="ui-input"
            name="desc"
            value={form.desc}
            onChange={handleChange}
            placeholder="Ex: Compra de silagem, vacina, diesel..."
          />
        </label>

        <label>
          Valor (R$)
          <input
            className="ui-input"
            name="val"
            type="number"
            step="0.01"
            min={0}
            value={form.val}
            onChange={handleChange}
            placeholder="0,00"
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
