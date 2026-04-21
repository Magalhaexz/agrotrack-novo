import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import ArrobaPreview from './ArrobaPreview';

const FORM_VAZIO = {
  lote_id: '',
  sexo: 'macho',
  gen: '',
  qtd: '',
  p_ini: '',
  p_at: '',
  dias: '',
  consumo: '',
  rendimento_carcaca: 52,
  preco_arroba: '',
};

const VALIDACOES_NUMERICAS = [
  { campo: 'Quantidade',            key: 'qtd' },
  { campo: 'Peso inicial',          key: 'p_ini' },
  { campo: 'Peso atual',            key: 'p_at' },
  { campo: 'Dias no lote',          key: 'dias' },
  { campo: 'Consumo',               key: 'consumo' },
  { campo: 'Rendimento de carcaça', key: 'rendimento_carcaca' },
];

function normalizarInitialData(data) {
  if (!data) return FORM_VAZIO;
  return {
    lote_id:            data.lote_id          ?? '',
    sexo:               data.sexo             || 'macho',
    gen:                data.gen              || '',
    qtd:                data.qtd              ?? '',
    p_ini:              data.p_ini            ?? '',
    p_at:               data.p_at             ?? '',
    dias:               data.dias             ?? '',
    consumo:            data.consumo          ?? '',
    rendimento_carcaca: data.rendimento_carcaca ?? 52,
    preco_arroba:       data.preco_arroba     ?? '',
  };
}

function validarForm(form) {
  if (!form.lote_id)       return 'Selecione o lote.';
  if (!form.gen.trim())    return 'Informe a genética/raça.';

  const invalido = VALIDACOES_NUMERICAS.find(
    ({ key }) => Number(form[key] || 0) <= 0
  );
  if (invalido) return `${invalido.campo} deve ser maior que zero.`;

  return null;
}

export default function AnimalForm({ initialData, lotes = [], onSave, onCancel }) {
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
      lote_id:            Number(form.lote_id),
      sexo:               form.sexo,
      gen:                form.gen.trim(),
      qtd:                Number(form.qtd),
      p_ini:              Number(form.p_ini),
      p_at:               Number(form.p_at),
      dias:               Number(form.dias),
      consumo:            Number(form.consumo),
      rendimento_carcaca: Number(form.rendimento_carcaca),
      preco_arroba:       form.preco_arroba ? Number(form.preco_arroba) : null,
    });
  }

  const titulo = initialData ? 'Editar animais' : 'Novo grupo de animais';

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      <Button onClick={handleSubmit}>Salvar</Button>
    </div>
  );

  return (
    <Modal open onClose={onCancel} title={titulo} footer={footer}>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>

        <div className="grid-2">
          <label>
            Lote
            <select className="ui-input" name="lote_id" value={form.lote_id} onChange={handleChange}>
              <option value="">Selecione</option>
              {lotes.map((lote) => (
                <option key={lote.id} value={lote.id}>{lote.nome}</option>
              ))}
            </select>
          </label>
          <label>
            Sexo
            <select className="ui-input" name="sexo" value={form.sexo} onChange={handleChange}>
              <option value="macho">Macho</option>
              <option value="fêmea">Fêmea</option>
            </select>
          </label>
        </div>

        <div className="grid-2">
          <label>
            Genética / raça
            <input
              className="ui-input"
              name="gen"
              value={form.gen}
              onChange={handleChange}
              placeholder="Ex: Nelore PO, Brangus, Cruzado"
            />
          </label>
          <label>
            Quantidade
            <input
              className="ui-input"
              type="number"
              min={1}
              name="qtd"
              value={form.qtd}
              onChange={handleChange}
              placeholder="Ex: 80"
            />
          </label>
        </div>

        <div className="grid-2">
          <label>
            Peso inicial (kg)
            <input
              className="ui-input"
              type="number"
              step="0.01"
              min={0}
              name="p_ini"
              value={form.p_ini}
              onChange={handleChange}
              placeholder="Ex: 320"
            />
          </label>
          <label>
            Peso atual (kg)
            <input
              className="ui-input"
              type="number"
              step="0.01"
              min={0}
              name="p_at"
              value={form.p_at}
              onChange={handleChange}
              placeholder="Ex: 440"
            />
          </label>
        </div>

        <div className="grid-2">
          <label>
            Dias no lote
            <input
              className="ui-input"
              type="number"
              min={1}
              name="dias"
              value={form.dias}
              onChange={handleChange}
              placeholder="Ex: 120"
            />
          </label>
          <label>
            Consumo (kg/dia)
            <input
              className="ui-input"
              type="number"
              step="0.01"
              min={0}
              name="consumo"
              value={form.consumo}
              onChange={handleChange}
              placeholder="Ex: 12.5"
            />
          </label>
        </div>

        <div className="grid-2">
          <label>
            Rendimento de carcaça (%)
            <input
              className="ui-input"
              type="number"
              step="0.1"
              min={0}
              max={100}
              name="rendimento_carcaca"
              value={form.rendimento_carcaca}
              onChange={handleChange}
            />
          </label>
          <label>
            Preço por @ (opcional)
            <input
              className="ui-input"
              type="number"
              step="0.01"
              min={0}
              name="preco_arroba"
              value={form.preco_arroba}
              onChange={handleChange}
              placeholder="Ex: 290"
            />
          </label>
        </div>

        <ArrobaPreview
          peso={form.p_at}
          rendimento={form.rendimento_carcaca}
          precoPorArroba={form.preco_arroba}
        />

        {erro && (
          <p style={{ margin: 0, color: 'var(--color-danger)', fontSize: '0.85rem' }}>
            {erro}
          </p>
        )}

      </form>
    </Modal>
  );
}