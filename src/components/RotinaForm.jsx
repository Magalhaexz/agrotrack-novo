import { useEffect, useState } from 'react';

const vazio = {
  funcionario_id: '',
  lote_id: '',
  tarefa: '',
  setor: 'Lotes',
  obs: '',
  recorrente: false,

  // avulsa
  data: hojeISO(),
  status: 'pendente',

  // recorrente
  recorrencia_tipo: 'diaria',
  dias_semana: [],
  data_inicio: hojeISO(),
  data_fim: '',
  concluido_datas: [],
};

const diasSemanaOpcoes = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

export default function RotinaForm({
  initialData,
  funcionarios = [],
  lotes = [],
  onSave,
  onCancel,
}) {
  const [form, setForm] = useState(vazio);

  useEffect(() => {
    if (initialData) {
      setForm({
        funcionario_id: initialData.funcionario_id ?? '',
        lote_id: initialData.lote_id ?? '',
        tarefa: initialData.tarefa || '',
        setor: initialData.setor || 'Lotes',
        obs: initialData.obs || '',
        recorrente: Boolean(initialData.recorrente),

        data: initialData.data || hojeISO(),
        status: initialData.status || 'pendente',

        recorrencia_tipo: initialData.recorrencia_tipo || 'diaria',
        dias_semana: initialData.dias_semana || [],
        data_inicio: initialData.data_inicio || hojeISO(),
        data_fim: initialData.data_fim || '',
        concluido_datas: initialData.concluido_datas || [],
      });
    } else {
      setForm(vazio);
    }
  }, [initialData]);

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

    if (!form.funcionario_id) {
      alert('Selecione o funcionário.');
      return;
    }

    if (!form.tarefa.trim()) {
      alert('Informe a tarefa.');
      return;
    }

    if (form.recorrente) {
      if (!form.data_inicio) {
        alert('Informe a data de início da recorrência.');
        return;
      }

      if (
        form.recorrencia_tipo === 'semanal' &&
        (!form.dias_semana || form.dias_semana.length === 0)
      ) {
        alert('Selecione pelo menos um dia da semana.');
        return;
      }

      onSave({
        funcionario_id: Number(form.funcionario_id),
        lote_id: form.lote_id ? Number(form.lote_id) : '',
        tarefa: form.tarefa.trim(),
        setor: form.setor,
        obs: form.obs.trim(),

        recorrente: true,
        recorrencia_tipo: form.recorrencia_tipo,
        dias_semana: form.recorrencia_tipo === 'semanal' ? form.dias_semana : [],
        data_inicio: form.data_inicio,
        data_fim: form.data_fim,

        data: '',
        status: 'pendente',
        concluido_datas: initialData?.concluido_datas || [],
      });

      return;
    }

    if (!form.data) {
      alert('Informe a data da tarefa.');
      return;
    }

    onSave({
      funcionario_id: Number(form.funcionario_id),
      lote_id: form.lote_id ? Number(form.lote_id) : '',
      tarefa: form.tarefa.trim(),
      setor: form.setor,
      obs: form.obs.trim(),

      recorrente: false,
      data: form.data,
      status: form.status,

      recorrencia_tipo: '',
      dias_semana: [],
      data_inicio: '',
      data_fim: '',
      concluido_datas: [],
    });
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        zIndex: 999,
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '700px',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        <div className="card-header">
          <span className="card-title">
            {initialData ? 'Editar tarefa' : 'Nova tarefa'}
          </span>
        </div>

        <div className="card-body">
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={labelStyle}>Tipo de tarefa</label>
              <div style={tipoBox}>
                <label style={radioLabel}>
                  <input
                    type="radio"
                    name="tipo_tarefa"
                    checked={!form.recorrente}
                    onChange={() =>
                      setForm((prev) => ({ ...prev, recorrente: false }))
                    }
                  />
                  <span>Tarefa avulsa</span>
                </label>

                <label style={radioLabel}>
                  <input
                    type="radio"
                    name="tipo_tarefa"
                    checked={form.recorrente}
                    onChange={() =>
                      setForm((prev) => ({ ...prev, recorrente: true }))
                    }
                  />
                  <span>Tarefa recorrente</span>
                </label>
              </div>
            </div>

            <div style={grid2}>
              <div>
                <label style={labelStyle}>Funcionário</label>
                <select
                  name="funcionario_id"
                  value={form.funcionario_id}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="">Selecione</option>
                  {funcionarios.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome} — {f.funcao}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Setor</label>
                <select
                  name="setor"
                  value={form.setor}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="Lotes">Lotes</option>
                  <option value="Estoque">Estoque</option>
                  <option value="Pesagens">Pesagens</option>
                  <option value="Sanitário">Sanitário</option>
                  <option value="Custos">Custos</option>
                  <option value="Fazenda">Fazenda</option>
                  <option value="Geral">Geral</option>
                </select>
              </div>
            </div>

            <div style={grid2}>
              <div>
                <label style={labelStyle}>Lote (opcional)</label>
                <select
                  name="lote_id"
                  value={form.lote_id}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="">Sem lote</option>
                  {lotes.map((lote) => (
                    <option key={lote.id} value={lote.id}>
                      {lote.nome}
                    </option>
                  ))}
                </select>
              </div>

              {!form.recorrente ? (
                <div>
                  <label style={labelStyle}>Data</label>
                  <input
                    name="data"
                    type="date"
      max={new Date().toISOString().slice(0, 10)}
                    value={form.data}
                    onChange={handleChange}
                    style={inputStyle}
                  />
                </div>
              ) : (
                <div>
                  <label style={labelStyle}>Recorrência</label>
                  <select
                    name="recorrencia_tipo"
                    value={form.recorrencia_tipo}
                    onChange={handleChange}
                    style={inputStyle}
                  >
                    <option value="diaria">Diária</option>
                    <option value="semanal">Semanal</option>
                  </select>
                </div>
              )}
            </div>

            <div>
              <label style={labelStyle}>Tarefa</label>
              <input
                name="tarefa"
                value={form.tarefa}
                onChange={handleChange}
                placeholder="Ex: Vacinar lote A"
                style={inputStyle}
              />
            </div>

            {form.recorrente ? (
              <>
                <div style={grid2}>
                  <div>
                    <label style={labelStyle}>Data de início</label>
                    <input
                      name="data_inicio"
                      type="date"
      max={new Date().toISOString().slice(0, 10)}
                      value={form.data_inicio}
                      onChange={handleChange}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Data final (opcional)</label>
                    <input
                      name="data_fim"
                      type="date"
      max={new Date().toISOString().slice(0, 10)}
                      value={form.data_fim}
                      onChange={handleChange}
                      style={inputStyle}
                    />
                  </div>
                </div>

                {form.recorrencia_tipo === 'semanal' ? (
                  <div>
                    <label style={labelStyle}>Dias da semana</label>
                    <div style={diasBox}>
                      {diasSemanaOpcoes.map((dia) => {
                        const ativo = form.dias_semana.includes(dia.value);
                        return (
                          <button
                            key={dia.value}
                            type="button"
                            onClick={() => toggleDiaSemana(dia.value)}
                            style={{
                              ...diaBtn,
                              ...(ativo ? diaBtnAtivo : {}),
                            }}
                          >
                            {dia.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div>
                <label style={labelStyle}>Status</label>
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="pendente">Pendente</option>
                  <option value="em_andamento">Em andamento</option>
                  <option value="concluido">Concluído</option>
                </select>
              </div>
            )}

            <div>
              <label style={labelStyle}>Observação</label>
              <input
                name="obs"
                value={form.obs}
                onChange={handleChange}
                placeholder="Opcional"
                style={inputStyle}
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 8,
              }}
            >
              <button type="button" onClick={onCancel} style={cancelBtn}>
                Cancelar
              </button>
              <button type="submit" style={saveBtn}>
                Salvar tarefa
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function hojeISO() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

const labelStyle = {
  display: 'block',
  marginBottom: 6,
  fontSize: 12,
};

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid #2e4020',
  background: '#0f160b',
  color: '#cce0a8',
  outline: 'none',
};

const cancelBtn = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #2e4020',
  background: 'transparent',
  color: '#7a9e62',
  cursor: 'pointer',
};

const saveBtn = {
  padding: '10px 14px',
  borderRadius: 10,
  border: 'none',
  background: '#6bb520',
  color: '#081006',
  fontWeight: 700,
  cursor: 'pointer',
};

const grid2 = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 14,
};

const tipoBox = {
  display: 'flex',
  gap: 18,
  flexWrap: 'wrap',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #2e4020',
  background: '#0f160b',
};

const radioLabel = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 14,
};

const diasBox = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
};

const diaBtn = {
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid #2e4020',
  background: 'transparent',
  color: '#7a9e62',
  cursor: 'pointer',
};

const diaBtnAtivo = {
  background: '#6bb520',
  color: '#081006',
  border: '1px solid #6bb520',
};
