import { useEffect, useState } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';

const SETORES = ['Lotes', 'Estoque', 'Pesagens', 'Sanitário', 'Custos', 'Fazenda', 'Geral'];
const RECORRENCIA_TIPOS = [
  { value: 'diaria', label: 'Diária' },
  { value: 'semanal', label: 'Semanal' },
];
const STATUS_TAREFA = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluido', label: 'Concluído' },
];

const DIAS_SEMANA_OPCOES = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

const FORM_VAZIO = {
  funcionario_id: '',
  lote_id: '',
  tarefa: '',
  setor: 'Lotes',
  obs: '',
  recorrente: false,

  // avulsa
  data: '', // Será preenchido com hojeISO() na normalização
  status: 'pendente',

  // recorrente
  recorrencia_tipo: 'diaria',
  dias_semana: [],
  data_inicio: '', // Será preenchido com hojeISO() na normalização
  data_fim: '',
  concluido_datas: [],
};

function hojeISO() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function normalizarInitialData(data) {
  const base = { ...FORM_VAZIO, data: hojeISO(), data_inicio: hojeISO() };
  if (!data) return base;

  return {
    ...base,
    funcionario_id: data.funcionario_id ?? '',
    lote_id: data.lote_id ?? '',
    tarefa: data.tarefa || '',
    setor: data.setor || 'Lotes',
    obs: data.obs || '',
    recorrente: Boolean(data.recorrente),

    data: data.data || hojeISO(),
    status: data.status || 'pendente',

    recorrencia_tipo: data.recorrencia_tipo || 'diaria',
    dias_semana: data.dias_semana || [],
    data_inicio: data.data_inicio || hojeISO(),
    data_fim: data.data_fim || '',
    concluido_datas: data.concluido_datas || [],
  };
}

function validarForm(form) {
  if (!form.funcionario_id) return 'Selecione o funcionário.';
  if (!form.tarefa.trim()) return 'Informe a tarefa.';

  if (form.recorrente) {
    if (!form.data_inicio) return 'Informe a data de início da recorrência.';
    if (form.recorrencia_tipo === 'semanal' && (!form.dias_semana || form.dias_semana.length === 0)) {
      return 'Selecione pelo menos um dia da semana.';
    }
  } else {
    if (!form.data) return 'Informe a data da tarefa.';
  }
  return null;
}

export default function RotinaForm({
  initialData,
  funcionarios = [],
  lotes = [],
  onSave,
  onCancel,
}) {
  const [form, setForm] = useState(() => normalizarInitialData(initialData));
  const [erro, setErro] = useState('');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setForm(normalizarInitialData(initialData));
    setErro('');
  }, [initialData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  function toggleDiaSemana(dia) {
    setForm((prev) => {
      const jaTem = prev.dias_semana.includes(dia);
      return {
        ...prev,
        dias_semana: jaTem
          ? prev.dias_semana.filter((d) => d !== dia)
          : [...prev.dias_semana, dia].sort((a, b) => a - b),
      };
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    const erroValidacao = validarForm(form);

    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    setErro('');
    const baseData = {
      funcionario_id: Number(form.funcionario_id),
      lote_id: form.lote_id ? Number(form.lote_id) : null, // Usar null para "Sem lote"
      tarefa: form.tarefa.trim(),
      setor: form.setor,
      obs: form.obs.trim(),
    };

    if (form.recorrente) {
      onSave?.({
        ...baseData,
        recorrente: true,
        recorrencia_tipo: form.recorrencia_tipo,
        dias_semana: form.recorrencia_tipo === 'semanal' ? form.dias_semana : [],
        data_inicio: form.data_inicio,
        data_fim: form.data_fim || null, // Usar null para data_fim opcional
        data: null, // Tarefas recorrentes não têm 'data' avulsa
        status: 'pendente', // Status inicial para recorrentes
        concluido_datas: initialData?.concluido_datas || [],
      });
    } else {
      onSave?.({
        ...baseData,
        recorrente: false,
        data: form.data,
        status: form.status,
        recorrencia_tipo: null,
        dias_semana: [],
        data_inicio: null,
        data_fim: null,
        concluido_datas: [],
      });
    }
  }

  const titulo = initialData ? 'Editar tarefa' : 'Nova tarefa';

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      <Button onClick={handleSubmit}>Salvar tarefa</Button>
    </div>
  );

  return (
    <Modal open onClose={onCancel} title={titulo} footer={footer}>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>

        {/* Tipo de tarefa */}
        <div>
          <label className="ui-input-label">Tipo de tarefa</label>
          <div className="ui-radio-group"> {/* Nova classe para o grupo de rádio */}
            <label className="ui-radio-label">
              <input
                type="radio"
                name="tipo_tarefa"
                checked={!form.recorrente}
                onChange={() => setForm((prev) => ({ ...prev, recorrente: false }))}
              />
              <span>Tarefa avulsa</span>
            </label>

            <label className="ui-radio-label">
              <input
                type="radio"
                name="tipo_tarefa"
                checked={form.recorrente}
                onChange={() => setForm((prev) => ({ ...prev, recorrente: true }))}
              />
              <span>Tarefa recorrente</span>
            </label>
          </div>
        </div>

        {/* Funcionário e Setor */}
        <div className="grid-2">
          <label className="ui-input-wrap">
            <span className="ui-input-label">Funcionário</span>
            <select className="ui-input" name="funcionario_id" value={form.funcionario_id} onChange={handleChange}>
              <option value="">Selecione</option>
              {funcionarios.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome} — {f.funcao}
                </option>
              ))}
            </select>
          </label>

          <label className="ui-input-wrap">
            <span className="ui-input-label">Setor</span>
            <select className="ui-input" name="setor" value={form.setor} onChange={handleChange}>
              {SETORES.map((setor) => (
                <option key={setor} value={setor}>{setor}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Lote e Data/Recorrência */}
        <div className="grid-2">
          <label className="ui-input-wrap">
            <span className="ui-input-label">Lote (opcional)</span>
            <select className="ui-input" name="lote_id" value={form.lote_id} onChange={handleChange}>
              <option value="">Sem lote</option>
              {lotes.map((lote) => (
                <option key={lote.id} value={lote.id}>{lote.nome}</option>
              ))}
            </select>
          </label>

          {!form.recorrente ? (
            <label className="ui-input-wrap">
              <span className="ui-input-label">Data</span>
              <input
                className="ui-input"
                name="data"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={form.data}
                onChange={handleChange}
              />
            </label>
          ) : (
            <label className="ui-input-wrap">
              <span className="ui-input-label">Recorrência</span>
              <select className="ui-input" name="recorrencia_tipo" value={form.recorrencia_tipo} onChange={handleChange}>
                {RECORRENCIA_TIPOS.map((tipo) => (
                  <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {/* Tarefa */}
        <label className="ui-input-wrap">
          <span className="ui-input-label">Tarefa</span>
          <input
            className="ui-input"
            name="tarefa"
            value={form.tarefa}
            onChange={handleChange}
            placeholder="Ex: Vacinar lote A"
          />
        </label>

        {/* Campos de recorrência */}
        {form.recorrente && (
          <>
            <div className="grid-2">
              <label className="ui-input-wrap">
                <span className="ui-input-label">Data de início</span>
                <input
                  className="ui-input"
                  name="data_inicio"
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={form.data_inicio}
                  onChange={handleChange}
                />
              </label>

              <label className="ui-input-wrap">
                <span className="ui-input-label">Data final (opcional)</span>
                <input
                  className="ui-input"
                  name="data_fim"
                  type="date"
                  value={form.data_fim}
                  onChange={handleChange}
                />
              </label>
            </div>

            {form.recorrencia_tipo === 'semanal' && (
              <div>
                <label className="ui-input-label">Dias da semana</label>
                <div className="ui-dias-semana-group"> {/* Nova classe para o grupo de dias */}
                  {DIAS_SEMANA_OPCOES.map((dia) => {
                    const ativo = form.dias_semana.includes(dia.value);
                    return (
                      <button
                        key={dia.value}
                        type="button"
                        onClick={() => toggleDiaSemana(dia.value)}
                        className={`ui-dia-btn ${ativo ? 'active' : ''}`}
                      >
                        {dia.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Status (apenas para tarefas avulsas) */}
        {!form.recorrente && (
          <label className="ui-input-wrap">
            <span className="ui-input-label">Status</span>
            <select className="ui-input" name="status" value={form.status} onChange={handleChange}>
              {STATUS_TAREFA.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
        )}

        {/* Observação */}
        <label className="ui-input-wrap">
          <span className="ui-input-label">Observação</span>
          <input
            className="ui-input"
            name="obs"
            value={form.obs}
            onChange={handleChange}
            placeholder="Opcional"
          />
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
