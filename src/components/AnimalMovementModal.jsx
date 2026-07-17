import { useMemo, useState } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { useSubmitOnce } from '../hooks/useSubmitOnce.js';

import { hojeLocalISO } from '../domain/dataCivil.js';
const EXIT_REASONS = [
  { value: 'morte', label: 'Morte' },
  { value: 'descarte', label: 'Descarte' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'perda', label: 'Perda' },
  { value: 'outro', label: 'Outro' },
];

const MODE_CONFIG = {
  sale: {
    title: 'Registrar venda',
    submitLabel: 'Confirmar venda',
    dateLabel: 'Data da venda',
    reasonLabel: null,
    reasons: [],
    showSaleFields: true,
    defaultMotive: 'venda',
  },
  death: {
    title: 'Registrar morte',
    submitLabel: 'Confirmar morte',
    dateLabel: 'Data da morte',
    reasonLabel: 'Motivo da morte',
    reasons: [
      { value: 'morte', label: 'Morte' },
      { value: 'descarte', label: 'Descarte' },
      { value: 'perda', label: 'Perda' },
      { value: 'outro', label: 'Outro' },
    ],
    showSaleFields: false,
    defaultMotive: 'morte',
  },
  exit: {
    title: 'Registrar saída',
    submitLabel: 'Confirmar saída',
    dateLabel: 'Data da saída',
    reasonLabel: 'Tipo de saída',
    reasons: EXIT_REASONS,
    showSaleFields: false,
    defaultMotive: 'outro',
  },
};

function getInitialForm(mode) {
  if (mode === 'sale') {
    return {
      data: hojeLocalISO(),
      valor: '',
      peso: '',
      observacao: '',
      motivo: '',
    };
  }

  return {
    data: hojeLocalISO(),
    observacao: '',
    motivo: MODE_CONFIG[mode]?.defaultMotive || 'morte',
  };
}

function validateForm(mode, form) {
  if (!form.data) return 'Informe a data da operação.';
  if (mode === 'sale') {
    if (Number(form.valor || 0) <= 0) return 'Informe o valor da venda.';
    if (form.peso !== '' && Number(form.peso || 0) <= 0) return 'Peso na venda deve ser maior que zero.';
    return null;
  }

  if (!String(form.motivo || '').trim()) return 'Selecione o motivo da operação.';
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
  // P1 (teste de campo): sem trava de duplo-envio — duplo clique/toque podia
  // criar 2 movimentações/2 lançamentos financeiros para a mesma venda/morte.
  const { executar, isSubmitting } = useSubmitOnce();

  const config = MODE_CONFIG[mode] || MODE_CONFIG.exit;
  const subtitle = useMemo(() => {
    const identificacao = animal?.identificacao || animal?.nome || 'Animal individual';
    return `${identificacao} • ${animal?.loteNome || 'Sem lote'}`;
  }, [animal]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event?.preventDefault?.();
    const validationError = validateForm(mode, form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    await executar(() => onSubmit?.({
      data: form.data,
      valor: mode === 'sale' ? (form.valor === '' ? null : Number(form.valor)) : null,
      peso: mode === 'sale' ? (form.peso === '' ? null : Number(form.peso)) : null,
      observacao: String(form.observacao || '').trim(),
      motivo: mode === 'sale' ? 'venda' : String(form.motivo || '').trim(),
    }));
  }

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
      <Button onClick={handleSubmit} loading={isSubmitting} loadingLabel="Salvando...">{config.submitLabel}</Button>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title={config.title} subtitle={subtitle} footer={footer} size="md">
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
        <label className="ui-input-wrap">
          <span className="ui-input-label">{config.dateLabel}</span>
          <input
            className="ui-input"
            type="date"
            max={hojeLocalISO()}
            value={form.data}
            onChange={(event) => updateField('data', event.target.value)}
          />
        </label>

        {config.showSaleFields ? (
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
            <span className="ui-input-label">{config.reasonLabel}</span>
            <select className="ui-input" value={form.motivo} onChange={(event) => updateField('motivo', event.target.value)}>
              {config.reasons.map((reason) => (
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
