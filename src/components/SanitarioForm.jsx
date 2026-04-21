import { useEffect, useState } from 'react';
<<<<<<< HEAD
import Modal from '../ui/Modal';
import Button from '../ui/Button';

const TIPOS_MANEJO = [
  { value: 'vacina', label: 'Vacina' },
  { value: 'vermifugo', label: 'Vermífugo' },
  { value: 'medicamento', label: 'Medicamento' },
  { value: 'exame', label: 'Exame' },
  { value: 'outro', label: 'Outro' },
];

const FORM_VAZIO = {
=======

const vazio = {
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
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

<<<<<<< HEAD
function normalizarInitialData(data) {
  if (!data) return FORM_VAZIO;
  return {
    lote_id: data.lote_id ?? '',
    tipo: data.tipo || 'vacina',
    desc: data.desc || '',
    data_aplic: data.data_aplic || '',
    proxima: data.proxima || '',
    alerta_dias_antes: data.alerta_dias_antes ?? 30,
    qtd: data.qtd ?? '',
    obs: data.obs || '',
    funcionario_responsavel_id: data.funcionario_responsavel_id ?? '',
  };
}

function validarForm(form) {
  if (!form.lote_id) return 'Selecione o lote.';
  if (!form.desc.trim()) return 'Informe a descrição do manejo sanitário.';
  if (!form.data_aplic) return 'Informe a data de aplicação.';
  if (!form.qtd) return 'Informe a quantidade atendida.';
  if (Number(form.qtd || 0) <= 0) return 'Quantidade atendida deve ser maior que zero.';
  if (Number(form.alerta_dias_antes || 0) <= 0) return 'Aviso de dias antes deve ser maior que zero.';
  return null;
}

=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
export default function SanitarioForm({
  initialData,
  lotes = [],
  funcionarios = [],
  onSave,
  onCancel,
}) {
<<<<<<< HEAD
  const [form, setForm] = useState(() => normalizarInitialData(initialData));
  const [erro, setErro] = useState('');

  useEffect(() => {
    setForm(normalizarInitialData(initialData));
    setErro('');
=======
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
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  }, [initialData]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
<<<<<<< HEAD
    const erroValidacao = validarForm(form);

    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    setErro('');
    onSave?.({
=======

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
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
      lote_id: Number(form.lote_id),
      tipo: form.tipo,
      desc: form.desc.trim(),
      data_aplic: form.data_aplic,
<<<<<<< HEAD
      proxima: form.proxima || null, // Usar null para data opcional
=======
      proxima: form.proxima,
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
      alerta_dias_antes: Number(form.alerta_dias_antes || 0),
      qtd: Number(form.qtd || 0),
      obs: form.obs.trim(),
      funcionario_responsavel_id: form.funcionario_responsavel_id
        ? Number(form.funcionario_responsavel_id)
<<<<<<< HEAD
        : null, // Usar null para responsável opcional
    });
  }

  const titulo = initialData ? 'Editar manejo sanitário' : 'Novo manejo sanitário';

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      <Button onClick={handleSubmit}>Salvar manejo</Button>
    </div>
  );

  return (
    <Modal open onClose={onCancel} title={titulo} footer={footer}>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>

        <label className="ui-input-wrap">
          <span className="ui-input-label">Lote</span>
          <select className="ui-input" name="lote_id" value={form.lote_id} onChange={handleChange}>
            <option value="">Selecione</option>
            {lotes.map((lote) => (
              <option key={lote.id} value={lote.id}>{lote.nome}</option>
            ))}
          </select>
        </label>

        <div className="grid-2">
          <label className="ui-input-wrap">
            <span className="ui-input-label">Tipo</span>
            <select className="ui-input" name="tipo" value={form.tipo} onChange={handleChange}>
              {TIPOS_MANEJO.map((tipo) => (
                <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
              ))}
            </select>
          </label>

          <label className="ui-input-wrap">
            <span className="ui-input-label">Quantidade atendida</span>
            <input
              className="ui-input"
              name="qtd"
              type="number"
              min={0}
              value={form.qtd}
              onChange={handleChange}
              placeholder="Ex: 120"
            />
          </label>
        </div>

        <label className="ui-input-wrap">
          <span className="ui-input-label">Descrição</span>
          <input
            className="ui-input"
            name="desc"
            value={form.desc}
            onChange={handleChange}
            placeholder="Ex: Vacina contra aftosa"
          />
        </label>

        <div className="grid-2">
          <label className="ui-input-wrap">
            <span className="ui-input-label">Data de aplicação</span>
            <input
              className="ui-input"
              name="data_aplic"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={form.data_aplic}
              onChange={handleChange}
            />
          </label>

          <label className="ui-input-wrap">
            <span className="ui-input-label">Próxima dose / revisão (opcional)</span>
            <input
              className="ui-input"
              name="proxima"
              type="date"
              value={form.proxima}
              onChange={handleChange}
            />
          </label>
        </div>

        <div className="grid-2">
          <label className="ui-input-wrap">
            <span className="ui-input-label">Avisar quantos dias antes</span>
            <input
              className="ui-input"
              name="alerta_dias_antes"
              type="number"
              min={0}
              value={form.alerta_dias_antes}
              onChange={handleChange}
              placeholder="Ex: 15"
            />
          </label>

          <label className="ui-input-wrap">
            <span className="ui-input-label">Responsável pela próxima tarefa (opcional)</span>
            <select
              className="ui-input"
              name="funcionario_responsavel_id"
              value={form.funcionario_responsavel_id}
              onChange={handleChange}
            >
              <option value="">Sem responsável</option>
              {funcionarios.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome} — {f.funcao}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="ui-input-wrap">
          <span className="ui-input-label">Observação</span>
          <input
            className="ui-input"
            name="obs"
            value={form.obs}
            onChange={handleChange}
            placeholder="Ex: reforço em 90 dias"
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
=======
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
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
