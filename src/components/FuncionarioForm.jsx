import { useEffect, useMemo, useState } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Input from './ui/Input';

const CARGOS = [
  'Vaqueiro',
  'Gerente',
  'Veterinário',
  'Nutricionista',
  'Tratorista',
  'Administrador',
  'Outro',
];

const FORM_VAZIO = {
  nome: '',
  cpf: '',
  telefone: '',
  cargo: 'Vaqueiro',
  salario: '',
  data_admissao: '',
  status: 'ativo',
  fazenda_id: '',
  observacoes: '',
};

function mascararCpf(valor) {
  const nums = String(valor || '').replace(/\D/g, '').slice(0, 11);
  return nums
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function mascararTelefone(valor) {
  const nums = String(valor || '').replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 10) {
    return nums
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return nums
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

function validarCpf(cpf) {
  const digits = String(cpf || '').replace(/\D/g, '');
  if (digits.length !== 11 || /(\d)\1{10}/.test(digits)) return false;

  const calc = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i += 1) sum += Number(digits[i]) * (len + 1 - i);
    const resto = (sum * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
}

function normalizarInitialData(data, fazendas) {
  if (!data) {
    return { ...FORM_VAZIO, fazenda_id: fazendas?.[0]?.id ? String(fazendas[0].id) : '' };
  }
  return {
    nome: data.nome || '',
    cpf: mascararCpf(data.cpf || ''),
    telefone: mascararTelefone(data.telefone || ''),
    cargo: data.cargo || 'Vaqueiro',
    salario: data.salario ?? '',
    data_admissao: data.data_admissao || '',
    status: data.status || 'ativo',
    fazenda_id: data.fazenda_id ? String(data.fazenda_id) : '',
    observacoes: data.observacoes || '',
  };
}

export default function FuncionarioForm({ open, onCancel, onSave, initialData, fazendas = [] }) {
  const [form, setForm] = useState(() => normalizarInitialData(initialData, fazendas));
  const [erro, setErro] = useState('');

  useEffect(() => {
    setForm(normalizarInitialData(initialData, fazendas));
    setErro('');
  }, [initialData, fazendas]);

  const titulo = useMemo(
    () => (initialData ? 'Editar funcionário' : 'Cadastrar funcionário'),
    [initialData]
  );

  function handleChange(e) {
    const { name, value } = e.target;

    if (name === 'cpf') {
      setForm((prev) => ({ ...prev, cpf: mascararCpf(value) }));
      return;
    }

    if (name === 'telefone') {
      setForm((prev) => ({ ...prev, telefone: mascararTelefone(value) }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();

    if (!form.nome.trim()) {
      setErro('Nome é obrigatório.');
      return;
    }

    if (!validarCpf(form.cpf)) {
      setErro('CPF inválido.');
      return;
    }

    if (!form.telefone.trim()) {
      setErro('Telefone é obrigatório.');
      return;
    }

    setErro('');
    onSave?.({
      nome: form.nome.trim(),
      cpf: form.cpf.replace(/\D/g, ''),
      telefone: form.telefone.replace(/\D/g, ''),
      cargo: form.cargo,
      salario: form.salario === '' ? null : Number(form.salario),
      data_admissao: form.data_admissao || null,
      status: form.status,
      fazenda_id: form.fazenda_id ? Number(form.fazenda_id) : null,
      observacoes: form.observacoes.trim(),
    });
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={titulo}
      subtitle="Preencha os dados do colaborador"
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button onClick={handleSubmit}>Salvar</Button>
        </div>
      )}
    >
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
        <Input label="Nome completo" name="nome" value={form.nome} onChange={handleChange} required />
        <Input label="CPF" name="cpf" value={form.cpf} onChange={handleChange} placeholder="000.000.000-00" inputMode="numeric" required />
        <Input label="Telefone" name="telefone" value={form.telefone} onChange={handleChange} placeholder="(00) 00000-0000" inputMode="numeric" required />

        <div className="ui-input-wrap">
          <label className="ui-input-label">Cargo</label>
          <select className="ui-input" name="cargo" value={form.cargo} onChange={handleChange}>
            {CARGOS.map((cargo) => <option key={cargo} value={cargo}>{cargo}</option>)}
          </select>
        </div>

        <Input label="Salário (R$)" name="salario" type="number" value={form.salario} onChange={handleChange} />
        <Input label="Data de admissão" name="data_admissao" type="date" value={form.data_admissao} onChange={handleChange} />

        <div className="ui-input-wrap">
          <label className="ui-input-label">Fazenda vinculada</label>
          <select className="ui-input" name="fazenda_id" value={form.fazenda_id} onChange={handleChange}>
            <option value="">Não vinculada</option>
            {fazendas.map((fazenda) => (
              <option key={fazenda.id} value={String(fazenda.id)}>{fazenda.nome}</option>
            ))}
          </select>
        </div>

        <div className="ui-input-wrap">
          <label className="ui-input-label">Status</label>
          <select className="ui-input" name="status" value={form.status} onChange={handleChange}>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>

        <div className="ui-input-wrap">
          <label className="ui-input-label">Observações</label>
          <textarea className="ui-input" name="observacoes" rows={3} value={form.observacoes} onChange={handleChange} />
        </div>

        {erro && <p style={{ color: 'var(--color-danger)', margin: 0 }}>{erro}</p>}
      </form>
    </Modal>
  );
}
