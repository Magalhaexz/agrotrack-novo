import { useMemo, useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import { TIPOS_OCORRENCIA, filterLotesAtivosPorFazenda, validarOcorrenciaOfflineForm } from '../../domain/offlineCaptureLogic';

const today = new Date().toISOString().slice(0, 10);

function emptyForm() {
  return {
    fazendaId: '',
    loteId: '',
    data: today,
    tipo: '',
    descricao: '',
    observacoes: '',
  };
}

export default function RegistrarOcorrenciaOfflineModal({ open, fazendas = [], lotes = [], onClose, onSubmit }) {
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
    const validation = validarOcorrenciaOfflineForm(form);
    if (validation) {
      setError(validation);
      return;
    }
    onSubmit({
      fazendaId: Number(form.fazendaId),
      loteId: form.loteId ? Number(form.loteId) : null,
      data: form.data,
      tipo: form.tipo,
      descricao: form.descricao.trim(),
      observacoes: form.observacoes.trim() || null,
    });
    setForm(emptyForm());
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar ocorrência"
      subtitle="Funciona sem internet — fica salvo neste aparelho até sincronizar."
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar ocorrência</Button>
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
        <Input as="select" label="Lote (opcional)" value={form.loteId} onChange={(e) => updateField('loteId', e.target.value)}>
          <option value="">Não se aplica</option>
          {lotesDaFazenda.map((lote) => (
            <option key={lote.id} value={lote.id}>{lote.nome}</option>
          ))}
        </Input>
        <Input type="date" label="Data" value={form.data} onChange={(e) => updateField('data', e.target.value)} />
        <Input as="select" label="Tipo" value={form.tipo} onChange={(e) => updateField('tipo', e.target.value)}>
          <option value="">Selecione</option>
          {TIPOS_OCORRENCIA.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </Input>
        <Input className="full" label="Descrição" value={form.descricao} onChange={(e) => updateField('descricao', e.target.value)} />
        <Input className="full" as="textarea" label="Observações" value={form.observacoes} onChange={(e) => updateField('observacoes', e.target.value)} />
      </div>
      {error ? <p className="err">{error}</p> : null}
    </Modal>
  );
}
