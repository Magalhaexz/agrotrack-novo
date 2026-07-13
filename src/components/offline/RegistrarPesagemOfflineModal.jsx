import { useMemo, useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import { filterLotesAtivosPorFazenda, validarPesagemOfflineForm } from '../../domain/offlineCaptureLogic';

import { hojeLocalISO } from '../../domain/dataCivil.js';
const today = hojeLocalISO();

function emptyForm() {
  return {
    fazendaId: '',
    loteId: '',
    data: today,
    pesoMedio: '',
    quantidadeCabecas: '',
    observacao: '',
  };
}

export default function RegistrarPesagemOfflineModal({ open, fazendas = [], lotes = [], onClose, onSubmit }) {
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');

  const lotesDaFazenda = useMemo(
    () => filterLotesAtivosPorFazenda(lotes, form.fazendaId),
    [lotes, form.fazendaId]
  );

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSave() {
    setError('');
    const validation = validarPesagemOfflineForm(form);
    if (validation) {
      setError(validation);
      return;
    }
    onSubmit({
      loteId: Number(form.loteId),
      data: form.data,
      pesoMedio: Number(form.pesoMedio),
      quantidadeCabecas: form.quantidadeCabecas === '' ? null : Number(form.quantidadeCabecas),
      observacao: form.observacao.trim() || null,
    });
    setForm(emptyForm());
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar pesagem"
      subtitle="Funciona sem internet — fica salvo neste aparelho até sincronizar."
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar pesagem</Button>
        </>
      )}
    >
      <div className="form-grid two">
        <Input as="select" label="Fazenda" value={form.fazendaId} onChange={(e) => { updateField('fazendaId', e.target.value); updateField('loteId', ''); }}>
          <option value="">Selecione</option>
          {fazendas.map((fazenda) => (
            <option key={fazenda.id} value={fazenda.id}>{fazenda.nome}</option>
          ))}
        </Input>
        <Input as="select" label="Lote" value={form.loteId} onChange={(e) => updateField('loteId', e.target.value)}>
          <option value="">Selecione</option>
          {lotesDaFazenda.map((lote) => (
            <option key={lote.id} value={lote.id}>{lote.nome}</option>
          ))}
        </Input>
        <Input type="date" label="Data da pesagem" value={form.data} onChange={(e) => updateField('data', e.target.value)} />
        <Input type="number" label="Peso médio (kg)" value={form.pesoMedio} onChange={(e) => updateField('pesoMedio', e.target.value)} />
        <Input type="number" label="Quantidade de cabeças (opcional)" value={form.quantidadeCabecas} onChange={(e) => updateField('quantidadeCabecas', e.target.value)} />
        <Input className="full" as="textarea" label="Observações" value={form.observacao} onChange={(e) => updateField('observacao', e.target.value)} />
      </div>
      {error ? <p className="err">{error}</p> : null}
    </Modal>
  );
}
