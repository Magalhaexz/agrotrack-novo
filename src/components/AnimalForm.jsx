import { useEffect, useState } from 'react';
import ArrobaPreview from './ArrobaPreview';
import Button from './ui/Button';
import Modal from './ui/Modal';
import { parseNumeroEntrada } from '../utils/formatters';

const FORM_VAZIO = {
  tipo_registro: 'grupo',
  lote_id: '',
  data_referencia: '',
  identificacao: '',
  sexo: 'macho',
  gen: '',
  qtd: '',
  p_ini: '',
  p_at: '',
  dias: '',
  consumo: '',
  status: 'ativo',
  observacao: '',
  rendimento_carcaca: 52,
  preco_arroba: '',
};

const VALIDACOES_GRUPO = [
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
    tipo_registro: data.tipo_registro || (Number(data.qtd || 0) === 1 && data.identificacao ? 'individual' : 'grupo'),
    lote_id: data.lote_id ?? '',
    data_referencia: data.data_referencia || data.data_entrada || '',
    identificacao: data.identificacao || '',
    sexo: data.sexo === 'femea' ? 'femea' : (data.sexo || 'macho'),
    gen: data.gen || '',
    qtd: data.qtd ?? '',
    p_ini: data.p_ini ?? '',
    p_at: data.p_at ?? '',
    dias: data.dias ?? '',
    consumo: data.consumo ?? '',
    status: data.status || 'ativo',
    observacao: data.observacao || '',
    rendimento_carcaca: data.rendimento_carcaca ?? 52,
    preco_arroba: data.preco_arroba ?? '',
  };
}

function obterNumero(form, key) {
  const numero = parseNumeroEntrada(form[key]);
  return Number.isFinite(numero) ? numero : 0;
}

function validarForm(form) {
  if (form.tipo_registro === 'grupo' && !form.lote_id) return 'Selecione o lote vinculado.';
  if (form.tipo_registro === 'individual' && !form.identificacao.trim()) {
    return 'Informe a identificacao / brinco / codigo.';
  }

  if (form.tipo_registro === 'grupo') {
    if (!form.gen.trim()) return 'Informe a genetica/raca.';
    const invalido = VALIDACOES_GRUPO.find(({ key }) => obterNumero(form, key) <= 0);
    if (invalido) return `${invalido.campo} deve ser maior que zero.`;
  } else {
    if (obterNumero(form, 'p_ini') <= 0) return 'Peso inicial deve ser maior que zero.';
    if (obterNumero(form, 'p_at') <= 0) return 'Peso atual deve ser maior que zero.';
  }

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
    setForm((prev) => {
      if (name === 'tipo_registro') {
        if (value === 'individual') {
          return {
            ...prev,
            tipo_registro: value,
            qtd: '1',
            dias: prev.dias || '1',
            consumo: prev.consumo || '0.01',
          };
        }
        return { ...prev, tipo_registro: value };
      }
      return { ...prev, [name]: value };
    });
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
      tipo_registro: form.tipo_registro,
      lote_id: form.lote_id ? Number(form.lote_id) : null,
      data_referencia: form.data_referencia || null,
      identificacao: form.identificacao.trim(),
      sexo: form.sexo === 'femea' ? 'femea' : form.sexo,
      gen: form.gen.trim(),
      qtd: form.tipo_registro === 'individual' ? 1 : obterNumero(form, 'qtd'),
      p_ini: obterNumero(form, 'p_ini'),
      p_at: obterNumero(form, 'p_at'),
      dias: form.tipo_registro === 'individual' ? Math.max(1, obterNumero(form, 'dias')) : obterNumero(form, 'dias'),
      consumo: form.tipo_registro === 'individual' ? Math.max(0.01, obterNumero(form, 'consumo')) : obterNumero(form, 'consumo'),
      status: form.status || 'ativo',
      observacao: form.observacao.trim(),
      rendimento_carcaca: obterNumero(form, 'rendimento_carcaca'),
      preco_arroba: form.preco_arroba === '' ? null : obterNumero(form, 'preco_arroba'),
    });
  }

  const titulo = initialData ? 'Editar animais' : 'Novo cadastro de animais';

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
      subtitle="Preencha os dados e acompanhe o reflexo em arrobas em tempo real."
      footer={footer}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="animal-form">
        <section className="animal-form-section">
          <div className="animal-form-section-head">Registro</div>
          <label className="animal-form-field">
            <span className="animal-form-label">Tipo de cadastro</span>
            <select className="ui-input" name="tipo_registro" value={form.tipo_registro} onChange={handleChange}>
              <option value="grupo">Grupo por lote</option>
              <option value="individual">Cadastro individual opcional</option>
            </select>
          </label>
        </section>

        {form.tipo_registro === 'individual' ? (
          <div className="animal-form-note">
            Cadastro individual opcional para acompanhar animais específicos dentro de um lote.
          </div>
        ) : null}

        <section className="animal-form-section">
          <div className="animal-form-section-head">Identificacao e vinculo</div>
        <div className="animal-form-grid animal-form-grid--2">
          <label className="animal-form-field">
            <span className="animal-form-label">Lote vinculado</span>
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

          <label className="animal-form-field">
            <span className="animal-form-label">Data de entrada / referencia</span>
            <input className="ui-input" type="date" name="data_referencia" value={form.data_referencia} onChange={handleChange} />
          </label>
        </div>
        </section>

        {form.tipo_registro === 'individual' ? (
          <div className="animal-form-grid animal-form-grid--2">
            <label className="animal-form-field">
              <span className="animal-form-label">Identificacao / brinco / codigo</span>
              <input
                className="ui-input"
                name="identificacao"
                value={form.identificacao}
                onChange={handleChange}
                placeholder="Ex: BR-0241"
              />
            </label>

            <label className="animal-form-field">
              <span className="animal-form-label">Status</span>
              <select className="ui-input" name="status" value={form.status} onChange={handleChange}>
                <option value="ativo">Ativo</option>
                <option value="em_tratamento">Em tratamento</option>
                <option value="vendido">Vendido</option>
                <option value="inativo">Inativo</option>
              </select>
            </label>
          </div>
        ) : null}

        <section className="animal-form-section">
          <div className="animal-form-section-head">Dados zootecnicos</div>
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
              disabled={form.tipo_registro === 'individual'}
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
        </section>

        <section className="animal-form-section">
          <div className="animal-form-section-head">Preco e rendimento</div>
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
        </section>

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

        {form.tipo_registro === 'individual' ? (
          <label className="animal-form-field">
            <span className="animal-form-label">Observacoes</span>
            <input
              className="ui-input"
              name="observacao"
              value={form.observacao}
              onChange={handleChange}
              placeholder="Ex: animal de referencia para acompanhamento individual"
            />
          </label>
        ) : null}

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
