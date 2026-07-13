import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useSubmitOnce } from '../../hooks/useSubmitOnce.js';

import { hojeLocalISO } from '../../domain/dataCivil.js';
const ESTADOS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN',
  'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

const FORM_VAZIO = {
  nome: '',
  estado: 'MG',
  cidade: '',
  hectares: '',
  hectares_pastagem: '',
  capacidade_lotacao: '',
  responsavel: '',
  telefone: '',
  observacoes: '',
  status: 'ativa',
};

function normalizarInitialData(data) {
  if (!data) return FORM_VAZIO;
  return {
    ...FORM_VAZIO,
    ...data,
    hectares: data.hectares ?? data.area_total_ha ?? '',
    hectares_pastagem: data.hectares_pastagem ?? data.area_pastagem_ha ?? '',
    capacidade_lotacao: data.capacidade_lotacao ?? data.capacidade_ua ?? '',
    responsavel: data.responsavel ?? data.proprietario ?? '',
  };
}

function normalizarPayload(form, initialData) {
  const text = (value) => String(value ?? '').trim();
  return {
    nome: text(form.nome),
    estado: form.estado,
    cidade: text(form.cidade),
    hectares: Number(form.hectares || 0),
    hectares_pastagem: Number(form.hectares_pastagem || 0),
    capacidade_lotacao: Number(form.capacidade_lotacao || 0),
    responsavel: text(form.responsavel),
    telefone: text(form.telefone),
    observacoes: text(form.observacoes),
    status: form.status || 'ativa',
    data_cadastro: initialData?.data_cadastro || hojeLocalISO(),
  };
}

export default function FazendaModal({ open, initialData, onSave, onCancel }) {
  const [form, setForm] = useState(() => normalizarInitialData(initialData));
  const [erro, setErro] = useState('');
  const { executar, isSubmitting } = useSubmitOnce();

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setForm(normalizarInitialData(initialData));
      setErro('');
    }
  }, [open, initialData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const titulo = initialData ? 'Editar fazenda' : 'Cadastrar fazenda';

  function onChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!String(form.nome ?? '').trim()) {
      setErro('Nome da fazenda é obrigatório.');
      return;
    }

    setErro('');
    try {
      await executar(() => onSave?.(normalizarPayload(form, initialData)));
    } catch (error) {
      setErro(error?.message || 'Não foi possível salvar agora. Tente novamente.');
    }
  }

  const footer = (
    <div className="form-actions action-row">
      <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>Cancelar</Button>
      <Button onClick={handleSubmit} loading={isSubmitting} loadingLabel="Salvando...">Salvar fazenda</Button>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={titulo}
      subtitle="Organize dados, localização e capacidade da fazenda."
      footer={footer}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="form-page form-section fazenda-form-shell">
        <section className="section-card fazenda-form-section">
          <div className="section-header">
            <h4>Dados principais</h4>
          </div>
          <div className="form-grid two">
            <label className="ui-input-wrap" style={{ gridColumn: '1 / -1' }}>
              <span className="ui-input-label">Nome da fazenda *</span>
              <input className="ui-input" name="nome" value={form.nome} onChange={onChange} placeholder="Ex.: Fazenda Santa Helena" />
            </label>
            <label className="ui-input-wrap">
              <span className="ui-input-label">Status</span>
              <select className="ui-input" name="status" value={form.status} onChange={onChange}>
                <option value="ativa">Ativa</option>
                <option value="inativa">Inativa</option>
              </select>
            </label>
          </div>
        </section>

        <section className="section-card fazenda-form-section">
          <div className="section-header">
            <h4>Localização</h4>
          </div>
          <div className="form-grid two">
            <label className="ui-input-wrap">
              <span className="ui-input-label">Estado</span>
              <select className="ui-input" name="estado" value={form.estado} onChange={onChange}>
                {ESTADOS.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </label>
            <label className="ui-input-wrap">
              <span className="ui-input-label">Cidade</span>
              <input className="ui-input" name="cidade" value={form.cidade} onChange={onChange} placeholder="Ex.: Uberlândia" />
            </label>
          </div>
        </section>

        <section className="section-card fazenda-form-section">
          <div className="section-header">
            <h4>Capacidade e área</h4>
          </div>
          <div className="form-grid three">
            <label className="ui-input-wrap">
              <span className="ui-input-label">Área total (ha)</span>
              <input className="ui-input" type="number" min={0} name="hectares" value={form.hectares} onChange={onChange} placeholder="ha" />
            </label>
            <label className="ui-input-wrap">
              <span className="ui-input-label">Área de pastagem (ha)</span>
              <input className="ui-input" type="number" min={0} name="hectares_pastagem" value={form.hectares_pastagem} onChange={onChange} placeholder="ha" />
            </label>
            <label className="ui-input-wrap">
              <span className="ui-input-label">Capacidade (UA)</span>
              <input className="ui-input" type="number" min={0} name="capacidade_lotacao" value={form.capacidade_lotacao} onChange={onChange} placeholder="UA" />
            </label>
          </div>
        </section>

        <section className="section-card fazenda-form-section">
          <div className="section-header">
            <h4>Contato e observações</h4>
          </div>
          <div className="form-grid two">
            <label className="ui-input-wrap">
              <span className="ui-input-label">Responsável</span>
              <input className="ui-input" name="responsavel" value={form.responsavel} onChange={onChange} placeholder="Nome do responsável" />
            </label>
            <label className="ui-input-wrap">
              <span className="ui-input-label">Telefone</span>
              <input className="ui-input" name="telefone" value={form.telefone} onChange={onChange} placeholder="(00) 00000-0000" />
            </label>
            <label className="ui-input-wrap" style={{ gridColumn: '1 / -1' }}>
              <span className="ui-input-label">Observações</span>
              <textarea className="ui-input" rows={3} name="observacoes" value={form.observacoes} onChange={onChange} placeholder="Detalhes operacionais e anotações relevantes" />
            </label>
          </div>
        </section>

        {erro ? (
          <p style={{ margin: 0, color: 'var(--color-danger)', fontSize: '0.85rem' }}>
            {erro}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
