import { useMemo, useState } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Input from './ui/Input';

const TIPOS = ['Corte', 'Leite', 'Misto', 'Cria', 'Recria', 'Engorda'];
const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const vazio = {
  nome: '',
  proprietario: '',
  cidade: '',
  estado: 'MG',
  area_total_ha: '',
  area_pastagem_ha: '',
  capacidade_ua: '',
  tipo_producao: 'Corte',
  inscricao_estadual: '',
  cnpj_cpf: '',
  telefone: '',
  email: '',
  endereco: '',
  status: 'ativa',
  observacoes: '',
};

export default function FazendaForm({ open, initialData, onSave, onCancel }) {
  const [erro, setErro] = useState('');
  const [form, setForm] = useState(() => ({ ...vazio, ...(initialData || {}) }));

  const titulo = useMemo(() => (initialData ? 'Editar fazenda' : 'Cadastrar fazenda'), [initialData]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();

    if (!String(form.nome || '').trim()) {
      setErro('Nome da fazenda é obrigatório.');
      return;
    }

    if (!String(form.cidade || '').trim()) {
      setErro('Cidade é obrigatória.');
      return;
    }

    setErro('');

    onSave?.({
      nome: String(form.nome || '').trim(),
      proprietario: String(form.proprietario || '').trim(),
      cidade: String(form.cidade || '').trim(),
      estado: form.estado || 'MG',
      area_total_ha: form.area_total_ha === '' ? null : Number(form.area_total_ha),
      area_pastagem_ha: form.area_pastagem_ha === '' ? null : Number(form.area_pastagem_ha),
      capacidade_ua: form.capacidade_ua === '' ? null : Number(form.capacidade_ua),
      tipo_producao: form.tipo_producao || 'Corte',
      inscricao_estadual: String(form.inscricao_estadual || '').trim(),
      cnpj_cpf: String(form.cnpj_cpf || '').trim(),
      telefone: String(form.telefone || '').trim(),
      email: String(form.email || '').trim(),
      endereco: String(form.endereco || '').trim(),
      status: form.status || 'ativa',
      observacoes: String(form.observacoes || '').trim(),
    });
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={titulo}
      subtitle="Cadastro e controle de propriedades"
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button onClick={handleSubmit}>Salvar fazenda</Button>
        </div>
      )}
    >
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
        <Input label="Nome da fazenda" name="nome" value={form.nome} onChange={handleChange} required />

        <div className="grid-2">
          <div className="ui-input-wrap">
            <label className="ui-input-label">Tipo de produção</label>
            <select className="ui-input" name="tipo_producao" value={form.tipo_producao} onChange={handleChange}>
              {TIPOS.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
            </select>
          </div>
          <div className="ui-input-wrap">
            <label className="ui-input-label">Status</label>
            <select className="ui-input" name="status" value={form.status} onChange={handleChange}>
              <option value="ativa">Ativa</option>
              <option value="inativa">Inativa</option>
            </select>
          </div>
        </div>

        <Input label="Endereço / Localidade" name="endereco" value={form.endereco} onChange={handleChange} />
        <div className="grid-2">
          <Input label="Cidade" name="cidade" value={form.cidade} onChange={handleChange} required />
          <div className="ui-input-wrap">
            <label className="ui-input-label">Estado</label>
            <select className="ui-input" name="estado" value={form.estado} onChange={handleChange}>
              {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
        </div>

        <div className="grid-3">
          <Input label="Área total (ha)" type="number" name="area_total_ha" value={form.area_total_ha} onChange={handleChange} />
          <Input label="Área pastagem (ha)" type="number" name="area_pastagem_ha" value={form.area_pastagem_ha} onChange={handleChange} />
          <Input label="Capacidade (UA)" type="number" name="capacidade_ua" value={form.capacidade_ua} onChange={handleChange} />
        </div>

        <div className="grid-2">
          <Input label="CPF/CNPJ proprietário" name="cnpj_cpf" value={form.cnpj_cpf} onChange={handleChange} />
          <Input label="Inscrição estadual" name="inscricao_estadual" value={form.inscricao_estadual} onChange={handleChange} />
        </div>

        <div className="grid-2">
          <Input label="Telefone" name="telefone" value={form.telefone} onChange={handleChange} />
          <Input label="E-mail" name="email" type="email" value={form.email} onChange={handleChange} />
        </div>

        <div className="ui-input-wrap">
          <label className="ui-input-label">Observações</label>
          <textarea className="ui-input" name="observacoes" rows={3} value={form.observacoes} onChange={handleChange} />
        </div>

        {erro ? <p style={{ color: 'var(--color-danger)', margin: 0 }}>{erro}</p> : null}
      </form>
    </Modal>
  );
}
