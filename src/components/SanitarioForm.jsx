import { useEffect, useState } from 'react';

const vazio = {
  lote_id: '',
  tipo: 'vacina',
  desc: '',
  data_aplic: '',
  proxima: '',
  alerta_dias_antes: 30,
  qtd: '',
  obs: '',
  funcionario_responsavel_id: '',
};

export default function SanitarioForm({
  initialData,
  lotes = [],
  funcionarios = [],
  onSave,
  onCancel,
}) {
  const [form, setForm] = useState(vazio);

  useEffect(() => {
    if (initialData) {
      setForm({
        lote_id: initialData.lote_id ?? '',
        tipo: initialData.tipo || 'vacina',
        desc: initialData.desc || '',
        data_aplic: initialData.data_aplic || '',
        proxima: initialData.proxima || '',
        alerta_dias_antes: initialData.alerta_dias_antes ?? 30,
        qtd: initialData.qtd ?? '',
        obs: initialData.obs || '',
        funcionario_responsavel_id: initialData.funcionario_responsavel_id ?? '',
      });
    } else {
      setForm(vazio);
    }
  }, [initialData]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();

    if (!form.lote_id) {
      alert('Selecione o lote.');
      return;
    }

    if (!form.desc.trim()) {
      alert('Informe a descrição do manejo sanitário.');
      return;
    }

    if (!form.data_aplic) {
      alert('Informe a data de aplicação.');
      return;
    }

    if (!form.qtd) {
      alert('Informe a quantidade atendida.');
      return;
    }

    if (Number(form.qtd || 0) <= 0) {
      alert('Quantidade atendida deve ser maior que zero.');
      return;
    }

    if (Number(form.alerta_dias_antes || 0) <= 0) {
      alert('Aviso de dias antes deve ser maior que zero.');
      return;
    }

    onSave({
      lote_id: Number(form.lote_id),
      tipo: form.tipo,
      desc: form.desc.trim(),
      data_aplic: form.data_aplic,
      proxima: form.proxima,
      alerta_dias_antes: Number(form.alerta_dias_antes || 0),
      qtd: Number(form.qtd || 0),
      obs: form.obs.trim(),
      funcionario_responsavel_id: form.funcionario_responsavel_id
        ? Number(form.funcionario_responsavel_id)
        : '',
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
          maxWidth: '620px',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        <div className="card-header">
          <span className="card-title">
            {initialData ? 'Editar manejo sanitário' : 'Novo manejo sanitário'}
          </span>
        </div>

        <div className="card-body">
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={labelStyle}>Lote</label>
              <select
                name="lote_id"
                value={form.lote_id}
                onChange={handleChange}
                style={inputStyle}
              >
                <option value="">Selecione</option>
                {lotes.map((lote) => (
                  <option key={lote.id} value={lote.id}>
                    {lote.nome}
                  </option>
                ))}
              </select>
            </div>

            <div style={grid2}>
              <div>
                <label style={labelStyle}>Tipo</label>
                <select
                  name="tipo"
                  value={form.tipo}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="vacina">Vacina</option>
                  <option value="vermifugo">Vermífugo</option>
                  <option value="medicamento">Medicamento</option>
                  <option value="exame">Exame</option>
                  <option value="outro">Outro</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Quantidade atendida</label>
                <input
                  name="qtd"
                  type="number"
      min="0"
                  value={form.qtd}
                  onChange={handleChange}
                  placeholder="Ex: 120"
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Descrição</label>
              <input
                name="desc"
                value={form.desc}
                onChange={handleChange}
                placeholder="Ex: Vacina contra aftosa"
                style={inputStyle}
              />
            </div>

            <div style={grid2}>
              <div>
                <label style={labelStyle}>Data de aplicação</label>
                <input
                  name="data_aplic"
                  type="date"
      max={new Date().toISOString().slice(0, 10)}
                  value={form.data_aplic}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Próxima dose / revisão</label>
                <input
                  name="proxima"
                  type="date"
      max={new Date().toISOString().slice(0, 10)}
                  value={form.proxima}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={grid2}>
              <div>
                <label style={labelStyle}>Avisar quantos dias antes</label>
                <input
                  name="alerta_dias_antes"
                  type="number"
      min="0"
                  value={form.alerta_dias_antes}
                  onChange={handleChange}
                  placeholder="Ex: 15"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Responsável pela próxima tarefa</label>
                <select
                  name="funcionario_responsavel_id"
                  value={form.funcionario_responsavel_id}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="">Sem responsável</option>
                  {funcionarios.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome} — {f.funcao}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Observação</label>
              <input
                name="obs"
                value={form.obs}
                onChange={handleChange}
                placeholder="Ex: reforço em 90 dias"
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
                Salvar manejo
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
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
};

const saveBtn = {
  padding: '10px 14px',
  borderRadius: 10,
  border: 'none',
  background: '#6bb520',
  color: '#081006',
  fontWeight: 700,
};

const grid2 = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 14,
};
