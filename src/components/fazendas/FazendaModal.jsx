import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';

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
    data_cadastro: initialData?.data_cadastro || new Date().toISOString().slice(0, 10),
  };
}

export default function FazendaModal({ open, initialData, onSave, onCancel }) {
  const [form, setForm] = useState(() => normalizarInitialData(initialData));
  const [erro, setErro] = useState('');

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

  function handleSubmit(e) {
    e.preventDefault();

    if (!String(form.nome ?? '').trim()) {
      setErro('Nome da fazenda é obrigatório.');
      return;
    }

    setErro('');
    onSave?.(normalizarPayload(form, initialData));
  }

  const footer = (
    <div className="modal-footer action-row" style={{ width: '100%' }}>
      <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      <Button onClick={handleSubmit}>Salvar fazenda</Button>
    </div>
  );

  return (
    <Modal open={open} onClose={onCancel} title={titulo} subtitle="Organize dados, localização e capacidade da fazenda." footer={footer}>
      <form onSubmit={handleSubmit} className="form-section fazenda-form-shell">
        <section className="section-card fazenda-form-section">
          <div className="section-header">
            <h4>Dados principais</h4>
          </div>
          <div className="form-grid two">
            <Input className="full" label="Nome da fazenda *" name="nome" value={form.nome} onChange={onChange} placeholder="Ex.: Fazenda Santa Helena" />
            <Input as="select" label="Status" name="status" value={form.status} onChange={onChange}>
              <option value="ativa">Ativa</option>
              <option value="inativa">Inativa</option>
            </Input>
          </div>
        </section>

        <section className="section-card fazenda-form-section">
          <div className="section-header">
            <h4>Localização</h4>
          </div>
          <div className="form-grid two">
            <Input as="select" label="Estado" name="estado" value={form.estado} onChange={onChange}>
              {ESTADOS.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </Input>
            <Input label="Cidade" name="cidade" value={form.cidade} onChange={onChange} placeholder="Ex.: Uberlândia" />
          </div>
        </section>

        <section className="section-card fazenda-form-section">
          <div className="section-header">
            <h4>Capacidade e área</h4>
          </div>
          <div className="form-grid two">
            <Input label="Área total (ha)" type="number" min={0} name="hectares" value={form.hectares} onChange={onChange} placeholder="ha" />
            <Input label="Área de pastagem (ha)" type="number" min={0} name="hectares_pastagem" value={form.hectares_pastagem} onChange={onChange} placeholder="ha" />
            <Input label="Capacidade (UA)" type="number" min={0} name="capacidade_lotacao" value={form.capacidade_lotacao} onChange={onChange} placeholder="UA" />
          </div>
        </section>

        <section className="section-card fazenda-form-section">
          <div className="section-header">
            <h4>Contato e observações</h4>
          </div>
          <div className="form-grid two">
            <Input label="Responsável" name="responsavel" value={form.responsavel} onChange={onChange} placeholder="Nome do responsável" />
            <Input label="Telefone" name="telefone" value={form.telefone} onChange={onChange} placeholder="(00) 00000-0000" />
            <Input className="full" as="textarea" rows={3} label="Observações" name="observacoes" value={form.observacoes} onChange={onChange} placeholder="Detalhes operacionais e anotações relevantes" />
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
