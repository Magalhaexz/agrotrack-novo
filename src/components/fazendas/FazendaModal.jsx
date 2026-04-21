import { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

const estados = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

const vazio = {
  nome: '',
  estado: 'MG',
  cidade: '',
  hectares: '',
  hectares_pastagem: '',
  capacidade_lotacao: '',
  responsavel: '',
  telefone: '',
  observacoes: '',
};

export default function FazendaModal({ open, initialData, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({ ...vazio, ...(initialData || {}) }));
  const [erro, setErro] = useState('');

  const titulo = useMemo(() => (initialData ? 'Editar Fazenda' : 'Cadastrar Fazenda'), [initialData]);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.nome.trim()) {
      setErro('Nome da fazenda é obrigatório.');
      return;
    }

    setErro('');
    onSave?.({
      nome: form.nome.trim(),
      estado: form.estado,
      cidade: form.cidade.trim(),
      hectares: Number(form.hectares || 0),
      hectares_pastagem: Number(form.hectares_pastagem || 0),
      capacidade_lotacao: Number(form.capacidade_lotacao || 0),
      responsavel: form.responsavel.trim(),
      telefone: form.telefone.trim(),
      observacoes: form.observacoes.trim(),
      data_cadastro: initialData?.data_cadastro || new Date().toISOString().slice(0, 10),
      area_total_ha: Number(form.hectares || 0),
      area_pastagem_ha: Number(form.hectares_pastagem || 0),
      capacidade_ua: Number(form.capacidade_lotacao || 0),
      proprietario: form.responsavel.trim(),
    });
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={titulo}
      footer={<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><Button variant="ghost" onClick={onCancel}>Cancelar</Button><Button onClick={handleSubmit}>Salvar</Button></div>}
    >
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
        <label>Nome da fazenda *<input className="ui-input" name="nome" value={form.nome} onChange={onChange} /></label>
        <div className="grid-2">
          <label>Estado
            <select className="ui-input" name="estado" value={form.estado} onChange={onChange}>{estados.map((uf) => <option key={uf} value={uf}>{uf}</option>)}</select>
          </label>
          <label>Cidade<input className="ui-input" name="cidade" value={form.cidade} onChange={onChange} /></label>
        </div>
        <div className="grid-3">
          <label>Hectares totais<input className="ui-input" type="number" name="hectares" value={form.hectares} onChange={onChange} /></label>
          <label>Hectares de pastagem<input className="ui-input" type="number" name="hectares_pastagem" value={form.hectares_pastagem} onChange={onChange} /></label>
          <label>Capacidade de lotação<input className="ui-input" type="number" name="capacidade_lotacao" value={form.capacidade_lotacao} onChange={onChange} /></label>
        </div>
        <div className="grid-2">
          <label>Responsável<input className="ui-input" name="responsavel" value={form.responsavel} onChange={onChange} /></label>
          <label>Telefone<input className="ui-input" name="telefone" value={form.telefone} onChange={onChange} /></label>
        </div>
        <label>Observações<textarea className="ui-input" rows={3} name="observacoes" value={form.observacoes} onChange={onChange} /></label>
        {erro ? <p style={{ margin: 0, color: 'var(--color-danger)' }}>{erro}</p> : null}
      </form>
    </Modal>
  );
}
