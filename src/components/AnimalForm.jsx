import { useEffect, useState } from 'react';
<<<<<<< HEAD
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import ArrobaPreview from './ArrobaPreview';

const FORM_VAZIO = {
=======
import ArrobaPreview from './ArrobaPreview';

const vazio = {
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
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

<<<<<<< HEAD
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
=======
export default function AnimalForm({
  initialData,
  lotes = [],
  onSave,
  onCancel,
}) {
  const [form, setForm] = useState(vazio);

  useEffect(() => {
    if (initialData) {
      setForm({
        lote_id: initialData.lote_id ?? '',
        sexo: initialData.sexo || 'macho',
        gen: initialData.gen || '',
        qtd: initialData.qtd ?? '',
        p_ini: initialData.p_ini ?? '',
        p_at: initialData.p_at ?? '',
        dias: initialData.dias ?? '',
        consumo: initialData.consumo ?? '',
        rendimento_carcaca: initialData.rendimento_carcaca ?? 52,
        preco_arroba: initialData.preco_arroba ?? '',
      });
    } else {
      setForm(vazio);
    }
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  }, [initialData]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
<<<<<<< HEAD
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
=======

    if (!form.lote_id) {
      alert('Selecione o lote.');
      return;
    }

    if (!form.gen.trim()) {
      alert('Informe a genética/raça.');
      return;
    }

    if (!form.qtd) {
      alert('Informe a quantidade.');
      return;
    }

    const validacoesNumericas = [
      { campo: 'Quantidade', valor: form.qtd },
      { campo: 'Peso inicial', valor: form.p_ini },
      { campo: 'Peso atual', valor: form.p_at },
      { campo: 'Dias no lote', valor: form.dias },
      { campo: 'Consumo', valor: form.consumo },
      { campo: 'Rendimento de carcaça', valor: form.rendimento_carcaca },
    ];

    const campoInvalido = validacoesNumericas.find(
      (item) => Number(item.valor || 0) <= 0
    );

    if (campoInvalido) {
      alert(`${campoInvalido.campo} deve ser maior que zero.`);
      return;
    }

    onSave({
      lote_id: Number(form.lote_id),
      sexo: form.sexo,
      gen: form.gen.trim(),
      qtd: Number(form.qtd || 0),
      p_ini: Number(form.p_ini || 0),
      p_at: Number(form.p_at || 0),
      dias: Number(form.dias || 0),
      consumo: Number(form.consumo || 0),
    });
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        zIndex: 999,
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '620px',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        <div className="card-header">
          <span className="card-title">
            {initialData ? 'Editar animais' : 'Novo grupo de animais'}
          </span>
        </div>

        <div className="card-body">
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
            <div style={grid2}>
              <div>
                <label style={labelStyle}>Lote</label>
                <select
                  name="lote_id"
                  value={form.lote_id}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="">Selecione</option>
                  {lotes.map((lote) => (
                    <option key={lote.id} value={lote.id}>
                      {lote.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Sexo</label>
                <select
                  name="sexo"
                  value={form.sexo}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="macho">Macho</option>
                  <option value="fêmea">Fêmea</option>
                </select>
              </div>
            </div>

            <div style={grid2}>
              <div>
                <label style={labelStyle}>Genética / raça</label>
                <input
                  name="gen"
                  value={form.gen}
                  onChange={handleChange}
                  placeholder="Ex: Nelore PO, Brangus, Cruzado"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Quantidade</label>
                <input
                  name="qtd"
                  type="number"
      min="0"
                  value={form.qtd}
                  onChange={handleChange}
                  placeholder="Ex: 80"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={grid2}>
              <div>
                <label style={labelStyle}>Peso inicial (kg)</label>
                <input
                  name="p_ini"
                  type="number"
                  step="0.01"
      min="0"
                  value={form.p_ini}
                  onChange={handleChange}
                  placeholder="Ex: 320"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Peso atual (kg)</label>
                <input
                  name="p_at"
                  type="number"
                  step="0.01"
      min="0"
                  value={form.p_at}
                  onChange={handleChange}
                  placeholder="Ex: 440"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={grid2}>
              <div>
                <label style={labelStyle}>Dias no lote</label>
                <input
                  name="dias"
                  type="number"
      min="0"
                  value={form.dias}
                  onChange={handleChange}
                  placeholder="Ex: 120"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Consumo (kg/dia)</label>
                <input
                  name="consumo"
                  type="number"
                  step="0.01"
      min="0"
                  value={form.consumo}
                  onChange={handleChange}
                  placeholder="Ex: 12.5"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={grid2}>
              <div>
                <label style={labelStyle}>Rendimento de carcaça (%)</label>
                <input
                  name="rendimento_carcaca"
                  type="number"
                  step="0.1"
      min="0"
                  value={form.rendimento_carcaca}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Preço por @ (opcional)</label>
                <input
                  name="preco_arroba"
                  type="number"
                  step="0.01"
      min="0"
                  value={form.preco_arroba}
                  onChange={handleChange}
                  placeholder="Ex: 290"
                  style={inputStyle}
                />
              </div>
            </div>

            <ArrobaPreview
              peso={form.p_at}
              rendimento={form.rendimento_carcaca}
              precoPorArroba={form.preco_arroba}
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 8,
              }}
            >
              <button type="button" onClick={onCancel} style={cancelBtn}>
                Cancelar
              </button>
              <button type="submit" style={saveBtn}>
                Salvar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

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
};

const saveBtn = {
  padding: '10px 14px',
  borderRadius: 10,
  border: 'none',
  background: '#6bb520',
  color: '#081006',
  fontWeight: 700,
};

const grid2 = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 14,
};
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
