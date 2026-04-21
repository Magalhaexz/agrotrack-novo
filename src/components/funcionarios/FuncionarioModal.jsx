<<<<<<< HEAD
import { useEffect, useState } from 'react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

const CARGOS = [
  'Vaqueiro', 'Gerente', 'Veterinário',
  'Nutricionista', 'Tratorista', 'Administrador', 'Outro',
];

const FORM_VAZIO = {
=======
import { useMemo, useState } from 'react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

const cargos = ['Vaqueiro', 'Gerente', 'Veterinário', 'Nutricionista', 'Tratorista', 'Administrador', 'Outro'];

const vazio = {
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
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

<<<<<<< HEAD
function maskCpf(v) {
  return String(v || '')
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskTel(v) {
  const n = String(v || '').replace(/\D/g, '').slice(0, 11);
  if (n.length <= 10) {
    return n.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  return n.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

function normalizarInitialData(initialData, fazendas) {
  const fazendaIdPadrao = fazendas[0]?.id ? String(fazendas[0].id) : '';

  if (!initialData) return { ...FORM_VAZIO, fazenda_id: fazendaIdPadrao };

  return {
    ...FORM_VAZIO,
    ...initialData,
    fazenda_id: initialData.fazenda_id
      ? String(initialData.fazenda_id)
      : fazendaIdPadrao,
  };
}

function normalizarPayload(form) {
  return {
    nome: form.nome.trim(),
    cpf: form.cpf,
    telefone: form.telefone,
    cargo: form.cargo,
    salario: form.salario === '' ? null : Number(form.salario),
    data_admissao: form.data_admissao || null,
    fazenda_id: form.fazenda_id ? Number(form.fazenda_id) : null,
    status: form.status || 'ativo',
    observacoes: form.observacoes.trim(),
  };
}

function validarForm(form) {
  if (!form.nome.trim()) return 'Nome completo é obrigatório.';

  const cpfLimpo = form.cpf.replace(/\D/g, '');
  if (cpfLimpo && cpfLimpo.length !== 11) return 'CPF inválido.';

  const telLimpo = form.telefone.replace(/\D/g, '');
  if (telLimpo && telLimpo.length < 10) return 'Telefone inválido.';

  return null;
}

export default function FuncionarioModal({ open, initialData, fazendas = [], onSave, onCancel }) {
  const [form, setForm] = useState(() => normalizarInitialData(initialData, fazendas));
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (open) {
      setForm(normalizarInitialData(initialData, fazendas));
      setErro('');
    }
  }, [open, initialData]);

  const titulo = initialData ? 'Editar Funcionário' : 'Cadastrar Funcionário';

  function onChange(e) {
    const { name, value } = e.target;

    if (name === 'cpf') return setForm((prev) => ({ ...prev, cpf: maskCpf(value) }));
    if (name === 'telefone') return setForm((prev) => ({ ...prev, telefone: maskTel(value) }));

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
    onSave?.(normalizarPayload(form));
  }

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      <Button onClick={handleSubmit}>Salvar</Button>
    </div>
  );

  return (
    <Modal open={open} onClose={onCancel} title={titulo} footer={footer}>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>

        <label>
          Nome completo *
          <input className="ui-input" name="nome" value={form.nome} onChange={onChange} />
        </label>

        <div className="grid-2">
          <label>
            CPF
            <input
              className="ui-input"
              name="cpf"
              value={form.cpf}
              onChange={onChange}
              placeholder="000.000.000-00"
              inputMode="numeric"
            />
          </label>
          <label>
            Telefone
            <input
              className="ui-input"
              name="telefone"
              value={form.telefone}
              onChange={onChange}
              placeholder="(00) 00000-0000"
              inputMode="numeric"
            />
          </label>
        </div>

        <div className="grid-3">
          <label>
            Cargo
            <select className="ui-input" name="cargo" value={form.cargo} onChange={onChange}>
              {CARGOS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>
            Salário
            <input
              className="ui-input"
              type="number"
              min={0}
              name="salario"
              value={form.salario}
              onChange={onChange}
            />
          </label>
          <label>
            Data de admissão
            <input className="ui-input" type="date" name="data_admissao" value={form.data_admissao} onChange={onChange} />
          </label>
        </div>

        <div className="grid-2">
          <label>
            Fazenda vinculada
            <select className="ui-input" name="fazenda_id" value={form.fazenda_id} onChange={onChange}>
              {fazendas.map((f) => (
                <option key={f.id} value={String(f.id)}>{f.nome}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select className="ui-input" name="status" value={form.status} onChange={onChange}>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </label>
        </div>

        <label>
          Observações
          <textarea className="ui-input" rows={3} name="observacoes" value={form.observacoes} onChange={onChange} />
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
=======
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
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
