import { useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import { useSubmitOnce } from '../../hooks/useSubmitOnce.js';

const today = new Date().toISOString().slice(0, 10);

export default function FechamentoLoteModal({ open, lote, onClose, onSubmit }) {
  const { executar, isSubmitting } = useSubmitOnce();
  const [data, setData] = useState(today);
  const [status, setStatus] = useState('encerrado');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');

  async function handleSave() {
    setError('');
    if (!data) return setError('Informe a data de encerramento.');
    if (!motivo.trim()) return setError('Informe o motivo do encerramento.');
    try {
      await executar(() => onSubmit({ data, status, motivo: motivo.trim() }));
    } catch (err) {
      setError(err?.message || 'Não foi possível salvar agora. Tente novamente.');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Finalizar lote"
      subtitle={`Lote ${lote?.nome || ''}`}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button variant="danger" onClick={handleSave} loading={isSubmitting} loadingLabel="Salvando...">Finalizar lote</Button>
        </>
      )}
    >
      <div className="form-grid">
        <Input type="date" label="Data" value={data} onChange={(e) => setData(e.target.value)} />
        <Input as="select" label="Status final" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="encerrado">Encerrado</option>
          <option value="vendido">Vendido</option>
        </Input>
        <Input as="textarea" label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </div>
      {error ? <p className="err">{error}</p> : null}
    </Modal>
  );
}
