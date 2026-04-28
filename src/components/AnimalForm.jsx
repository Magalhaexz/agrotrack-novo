import { useEffect, useState } from 'react';
import ArrobaPreview from './ArrobaPreview';
import Button from './ui/Button';
import Modal from './ui/Modal';
import { parseNumeroEntrada } from '../utils/formatters';

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
  { campo: 'Quantidade', key: 'qtd' },
  { campo: 'Peso inicial', key: 'p_ini' },
  { campo: 'Peso atual', key: 'p_at' },
  { campo: 'Dias no lote', key: 'dias' },
  { campo: 'Consumo', key: 'consumo' },
  { campo: 'Rendimento de carcaca', key: 'rendimento_carcaca' },
];

function normalizarInitialData(data) {
  if (!data) return FORM_VAZIO;
  return {
    lote_id: data.lote_id ?? '',
    sexo: data.sexo === 'fêmea' ? 'femea' : (data.sexo || 'macho'),
    gen: data.gen || '',
    qtd: data.qtd ?? '',
    p_ini: data.p_ini ?? '',
    p_at: data.p_at ?? '',
    dias: data.dias ?? '',
    consumo: data.consumo ?? '',
    rendimento_carcaca: data.rendimento_carcaca ?? 52,
    preco_arroba: data.preco_arroba ?? '',
  };
}

function obterNumero(form, key) {
  const numero = parseNumeroEntrada(form[key]);
  return Number.isFinite(numero) ? numero : 0;
}

function validarForm(form) {
  if (!form.lote_id) return 'Selecione o lote.';
  if (!form.gen.trim()) return 'Informe a genetica/raca.';

  const invalido = VALIDACOES_NUMERICAS.find(({ key }) => obterNumero(form, key) <= 0);
  if (invalido) return `${invalido.campo} deve ser maior que zero.`;

  return null;
}

export default function AnimalForm({ initialData, lotes = [], onSave, onCancel }) {
  const [form, setForm] = useState(() => normalizarInitialData(initialData));
  const [erro, setErro] = useState('');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setForm(normalizarInitialData(initialData));
    setErro('');
  }, [initialData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const erroValidacao = validarForm(form);

    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    setErro('');
    onSave?.({
      lote_id: Number(form.lote_id),
      sexo: form.sexo === 'femea' ? 'femea' : form.sexo,
      gen: form.gen.trim(),
      qtd: obterNumero(form, 'qtd'),
      p_ini: obterNumero(form, 'p_ini'),
      p_at: obterNumero(form, 'p_at'),
      dias: obterNumero(form, 'dias'),
      consumo: obterNumero(form, 'consumo'),
      rendimento_carcaca: obterNumero(form, 'rendimento_carcaca'),
      preco_arroba: form.preco_arroba === '' ? null : obterNumero(form, 'preco_arroba'),
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
    <Modal
      open
      onClose={onCancel}
      title={titulo}
      subtitle="Preencha os dados do grupo e acompanhe o reflexo em arrobas em tempo real."
      footer={footer}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="animal-form">
        <div className="animal-form-grid animal-form-grid--2">
          <label className="animal-form-field">
            <span className="animal-form-label">Lote</span>
            <select className="ui-input" name="lote_id" value={form.lote_id} onChange={handleChange}>
              <option value="">Selecione</option>
              {lotes.map((lote) => (
                <option key={lote.id} value={lote.id}>{lote.nome}</option>
              ))}
            </select>
          </label>

          <label className="animal-form-field">
            <span className="animal-form-label">Sexo</span>
            <select className="ui-input" name="sexo" value={form.sexo} onChange={handleChange}>
              <option value="macho">Macho</option>
              <option value="femea">Femea</option>
            </select>
          </label>
        </div>

        <div className="animal-form-grid animal-form-grid--2">
          <label className="animal-form-field">
            <span className="animal-form-label">Genetica / raca</span>
            <input
              className="ui-input"
              name="gen"
              value={form.gen}
              onChange={handleChange}
              placeholder="Ex: Nelore PO, Brangus, Cruzado"
            />
          </label>

          <label className="animal-form-field">
            <span className="animal-form-label">Quantidade</span>
            <input
              className="ui-input"
              type="text"
              inputMode="numeric"
              name="qtd"
              value={form.qtd}
              onChange={handleChange}
              placeholder="Ex: 80"
            />
          </label>
        </div>

        <div className="animal-form-grid animal-form-grid--2">
          <label className="animal-form-field">
            <span className="animal-form-label">Peso inicial (kg)</span>
            <input
              className="ui-input"
              type="text"
              inputMode="decimal"
              name="p_ini"
              value={form.p_ini}
              onChange={handleChange}
              placeholder="Ex: 320 ou 320,5"
            />
          </label>

          <label className="animal-form-field">
            <span className="animal-form-label">Peso atual (kg)</span>
            <input
              className="ui-input"
              type="text"
              inputMode="decimal"
              name="p_at"
              value={form.p_at}
              onChange={handleChange}
              placeholder="Ex: 440 ou 440,5"
            />
          </label>
        </div>

        <div className="animal-form-grid animal-form-grid--2">
          <label className="animal-form-field">
            <span className="animal-form-label">Dias no lote</span>
            <input
              className="ui-input"
              type="text"
              inputMode="numeric"
              name="dias"
              value={form.dias}
              onChange={handleChange}
              placeholder="Ex: 120"
            />
          </label>

          <label className="animal-form-field">
            <span className="animal-form-label">Consumo (kg/dia)</span>
            <input
              className="ui-input"
              type="text"
              inputMode="decimal"
              name="consumo"
              value={form.consumo}
              onChange={handleChange}
              placeholder="Ex: 12,5"
            />
          </label>
        </div>

        <div className="animal-form-grid animal-form-grid--2">
          <label className="animal-form-field">
            <span className="animal-form-label">Rendimento de carcaca (%)</span>
            <input
              className="ui-input"
              type="text"
              inputMode="decimal"
              name="rendimento_carcaca"
              value={form.rendimento_carcaca}
              onChange={handleChange}
              placeholder="Ex: 52"
            />
          </label>

          <label className="animal-form-field">
            <span className="animal-form-label">Preco por @ (opcional)</span>
            <input
              className="ui-input"
              type="text"
              inputMode="decimal"
              name="preco_arroba"
              value={form.preco_arroba}
              onChange={handleChange}
              placeholder="Ex: 290"
            />
          </label>
        </div>

        <ArrobaPreview
          peso={form.p_at || form.p_ini}
          rendimento={form.rendimento_carcaca}
          precoPorArroba={form.preco_arroba}
        />

        {erro ? (
          <p style={{ margin: 0, color: 'var(--color-danger)', fontSize: '0.85rem' }}>
            {erro}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
