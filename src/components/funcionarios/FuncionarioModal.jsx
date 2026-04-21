import { useMemo, useState } from 'react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

const cargos = ['Vaqueiro', 'Gerente', 'Veterinário', 'Nutricionista', 'Tratorista', 'Administrador', 'Outro'];

const vazio = {
  nome: '',
  cpf: '',
  telefone: '',
  cargo: 'Vaqueiro',
  salario: '',
  data_admissao: '',
  fazenda_id: '',
  status: 'ativo',
  observacoes: '',
};

const maskCpf = (v) => String(v || '').replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
const maskTel = (v) => {
  const n = String(v || '').replace(/\D/g, '').slice(0, 11);
  if (n.length <= 10) return n.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  return n.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
};

export default function FuncionarioModal({ open, initialData, fazendas = [], onSave, onCancel }) {
  const [form, setForm] = useState(() => ({ ...vazio, ...(initialData || {}), fazenda_id: initialData?.fazenda_id ? String(initialData.fazenda_id) : (fazendas[0]?.id ? String(fazendas[0].id) : '') }));
  const [erro, setErro] = useState('');
  const titulo = useMemo(() => (initialData ? 'Editar Funcionário' : 'Cadastrar Funcionário'), [initialData]);

  function onChange(e) {
    const { name, value } = e.target;
    if (name === 'cpf') return setForm((prev) => ({ ...prev, cpf: maskCpf(value) }));
    if (name === 'telefone') return setForm((prev) => ({ ...prev, telefone: maskTel(value) }));
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function submit(e) {
    e.preventDefault();
    if (!form.nome.trim()) {
      setErro('Nome completo é obrigatório.');
      return;
    }
    setErro('');
    onSave?.({
      nome: form.nome.trim(),
      cpf: form.cpf,
      telefone: form.telefone,
      cargo: form.cargo,
      salario: form.salario === '' ? null : Number(form.salario),
      data_admissao: form.data_admissao || null,
      fazenda_id: form.fazenda_id ? Number(form.fazenda_id) : null,
      status: form.status || 'ativo',
      observacoes: form.observacoes.trim(),
    });
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={titulo}
      footer={<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><Button variant="ghost" onClick={onCancel}>Cancelar</Button><Button onClick={submit}>Salvar</Button></div>}
    >
      <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
        <label>Nome completo *<input className="ui-input" name="nome" value={form.nome} onChange={onChange} /></label>
        <div className="grid-2">
          <label>CPF<input className="ui-input" name="cpf" value={form.cpf} onChange={onChange} placeholder="000.000.000-00" /></label>
          <label>Telefone<input className="ui-input" name="telefone" value={form.telefone} onChange={onChange} placeholder="(00) 00000-0000" /></label>
        </div>
        <div className="grid-3">
          <label>Cargo<select className="ui-input" name="cargo" value={form.cargo} onChange={onChange}>{cargos.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
          <label>Salário<input className="ui-input" type="number" name="salario" value={form.salario} onChange={onChange} /></label>
          <label>Data de admissão<input className="ui-input" type="date" name="data_admissao" value={form.data_admissao} onChange={onChange} /></label>
        </div>
        <div className="grid-2">
          <label>Fazenda vinculada<select className="ui-input" name="fazenda_id" value={form.fazenda_id} onChange={onChange}>{fazendas.map((f) => <option key={f.id} value={String(f.id)}>{f.nome}</option>)}</select></label>
          <label>Status<select className="ui-input" name="status" value={form.status} onChange={onChange}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></label>
        </div>
        <label>Observações<textarea className="ui-input" rows={3} name="observacoes" value={form.observacoes} onChange={onChange} /></label>
        {erro ? <p style={{ margin: 0, color: 'var(--color-danger)' }}>{erro}</p> : null}
      </form>
    </Modal>
  );
}
