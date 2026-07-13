import { useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import { CATEGORIAS_DESPESA_OFFLINE, validarDespesaOfflineForm } from '../../domain/offlineCaptureLogic';

import { hojeLocalISO } from '../../domain/dataCivil.js';
const today = hojeLocalISO();

function emptyForm() {
  return {
    fazendaId: '',
    data: today,
    descricao: '',
    valor: '',
    categoria: CATEGORIAS_DESPESA_OFFLINE[0],
    observacoes: '',
  };
}

export default function RegistrarDespesaOfflineModal({ open, fazendas = [], onClose, onSubmit }) {
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSave() {
    setError('');
    const validation = validarDespesaOfflineForm(form);
    if (validation) {
      setError(validation);
      return;
    }
    onSubmit({
      fazendaId: Number(form.fazendaId),
      data: form.data,
      descricao: form.descricao.trim(),
      valor: Number(form.valor),
      categoria: form.categoria,
      observacoes: form.observacoes.trim() || null,
    });
    setForm(emptyForm());
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Lançar despesa"
      subtitle="Funciona sem internet — fica salvo neste aparelho até sincronizar."
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar despesa</Button>
        </>
      )}
    >
      <div className="form-grid two">
        <Input as="select" label="Fazenda" value={form.fazendaId} onChange={(e) => updateField('fazendaId', e.target.value)}>
          <option value="">Selecione</option>
          {fazendas.map((fazenda) => (
            <option key={fazenda.id} value={fazenda.id}>{fazenda.nome}</option>
          ))}
        </Input>
        <Input type="date" label="Data" value={form.data} onChange={(e) => updateField('data', e.target.value)} />
        <Input className="full" label="Descrição" value={form.descricao} onChange={(e) => updateField('descricao', e.target.value)} />
        <Input type="number" label="Valor (R$)" value={form.valor} onChange={(e) => updateField('valor', e.target.value)} />
        <Input as="select" label="Categoria" value={form.categoria} onChange={(e) => updateField('categoria', e.target.value)}>
          {CATEGORIAS_DESPESA_OFFLINE.map((categoria) => (
            <option key={categoria} value={categoria}>{categoria}</option>
          ))}
        </Input>
        <Input className="full" as="textarea" label="Observações" value={form.observacoes} onChange={(e) => updateField('observacoes', e.target.value)} />
      </div>
      {error ? <p className="err">{error}</p> : null}
    </Modal>
  );
}
