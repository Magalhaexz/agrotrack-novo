import { useMemo, useState } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';

const EXIT_REASONS = [
  { value: 'morte', label: 'Morte' },
  { value: 'descarte', label: 'Descarte' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'perda', label: 'Perda' },
  { value: 'outro', label: 'Outro' },
];

function getInitialForm(mode) {
  if (mode === 'sale') {
    return {
      data: new Date().toISOString().slice(0, 10),
      valor: '',
      peso: '',
      observacao: '',
      motivo: '',
    };
  }

  return {
    data: new Date().toISOString().slice(0, 10),
    valor: '',
    peso: '',
    observacao: '',
    motivo: 'morte',
  };
}

function validateForm(mode, form) {
  if (!form.data) return 'Informe a data da operação.';
  if (mode === 'sale') {
    if (Number(form.valor || 0) <= 0) return 'Informe o valor da venda.';
    if (form.peso !== '' && Number(form.peso || 0) <= 0) return 'Peso na venda deve ser maior que zero.';
    return null;
  }

  if (!String(form.motivo || '').trim()) return 'Selecione o motivo da saída.';
  return null;
}

export default function AnimalMovementModal({
  open,
  mode = 'sale',
  animal = null,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(() => getInitialForm(mode));
  const [error, setError] = useState('');

  const title = mode === 'sale' ? 'Registrar venda' : 'Registrar saída';
  const subtitle = useMemo(() => {
    const identificacao = animal?.identificacao || animal?.nome || 'Animal individual';
    return `${identificacao} • ${animal?.loteNome || 'Sem lote'}`;
  }, [animal]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(event) {
    event?.preventDefault?.();
    const validationError = validateForm(mode, form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    onSubmit?.({
      data: form.data,
      valor: form.valor === '' ? null : Number(form.valor),
      peso: form.peso === '' ? null : Number(form.peso),
      observacao: String(form.observacao || '').trim(),
      motivo: mode === 'sale' ? 'venda' : String(form.motivo || '').trim(),
    });
  }

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      <Button variant="ghost" onClick={onClose}>Cancelar</Button>
      <Button onClick={handleSubmit}>{mode === 'sale' ? 'Confirmar venda' : 'Confirmar saída'}</Button>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle} footer={footer} size="md">
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
        <label className="ui-input-wrap">
          <span className="ui-input-label">{mode === 'sale' ? 'Data da venda' : 'Data da saída'}</span>
          <input
            className="ui-input"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={form.data}
            onChange={(event) => updateField('data', event.target.value)}
          />
        </label>

        {mode === 'sale' ? (
          <>
            <label className="ui-input-wrap">
              <span className="ui-input-label">Valor da venda (R$)</span>
              <input
                className="ui-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="Ex.: 3200,00"
                value={form.valor}
                onChange={(event) => updateField('valor', event.target.value)}
              />
            </label>

            <label className="ui-input-wrap">
              <span className="ui-input-label">Peso na venda (kg)</span>
              <input
                className="ui-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="Opcional"
                value={form.peso}
                onChange={(event) => updateField('peso', event.target.value)}
              />
            </label>
          </>
        ) : (
          <label className="ui-input-wrap">
            <span className="ui-input-label">Motivo da saída</span>
            <select className="ui-input" value={form.motivo} onChange={(event) => updateField('motivo', event.target.value)}>
              {EXIT_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>{reason.label}</option>
              ))}
            </select>
          </label>
        )}

        <label className="ui-input-wrap">
          <span className="ui-input-label">Observação</span>
          <textarea
            className="ui-input"
            style={{ minHeight: 110, resize: 'vertical' }}
            placeholder="Detalhes opcionais da operação"
            value={form.observacao}
            onChange={(event) => updateField('observacao', event.target.value)}
          />
        </label>

        {error ? (
          <p style={{ margin: 0, color: 'var(--color-danger)', fontSize: '0.85rem' }}>
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
