import { useMemo, useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import { RETIRADA_TIPOS } from './constants';

const today = new Date().toISOString().slice(0, 10);

export default function RetiradaAnimaisModal({ open, lote, onClose, onSubmit, maxCabecas }) {
  const [form, setForm] = useState({
    tipo: 'venda',
    data: today,
    quantidade: '',
    pesoMedio: '',
    valorTotal: '',
    valorCabeca: '',
    destino: '',
    observacao: '',
  });
  const [error, setError] = useState('');

  const valorCalculado = useMemo(() => {
    const qtd = Number(form.quantidade || 0);
    const porCabeca = Number(form.valorCabeca || 0);
    if (qtd > 0 && porCabeca > 0) return qtd * porCabeca;
    return Number(form.valorTotal || 0);
  }, [form.quantidade, form.valorCabeca, form.valorTotal]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit() {
    setError('');
    const qtd = Number(form.quantidade || 0);
    const peso = Number(form.pesoMedio || 0);
    if (!form.data) return setError('Informe a data da retirada.');
    if (!qtd || qtd <= 0) return setError('Informe a quantidade de cabeças.');
    if (qtd > Number(maxCabecas || 0)) return setError('A retirada não pode superar o total do lote.');
    if (!peso || peso <= 0) return setError('Informe o peso médio.');

    onSubmit({
      loteId: lote.id,
      tipoSaida: form.tipo,
      data: form.data,
      qtd,
      pesoMedio: peso,
      valorTotal: Number(valorCalculado || 0),
      comprador: form.destino,
      observacao: form.observacao,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Retirada de animais"
      subtitle={`Lote ${lote?.nome || ''}`}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit}>Salvar retirada</Button>
        </>
      )}
    >
      <div className="form-grid two">
        <Input as="select" label="Tipo de retirada" value={form.tipo} onChange={(e) => updateField('tipo', e.target.value)}>
          {RETIRADA_TIPOS.map((tipo) => (
            <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
          ))}
        </Input>
        <Input type="date" label="Data" value={form.data} onChange={(e) => updateField('data', e.target.value)} />
        <Input type="number" label="Quantidade de cabeças" value={form.quantidade} onChange={(e) => updateField('quantidade', e.target.value)} />
        <Input type="number" label="Peso médio (kg)" value={form.pesoMedio} onChange={(e) => updateField('pesoMedio', e.target.value)} />
        <Input type="number" label="Valor total (R$)" value={form.valorTotal} onChange={(e) => updateField('valorTotal', e.target.value)} />
        <Input type="number" label="Valor por cabeça (R$)" value={form.valorCabeca} onChange={(e) => updateField('valorCabeca', e.target.value)} />
        <Input className="full" label="Destino / comprador" value={form.destino} onChange={(e) => updateField('destino', e.target.value)} />
        <Input as="textarea" className="full" label="Observação" value={form.observacao} onChange={(e) => updateField('observacao', e.target.value)} />
      </div>
      {error ? <p className="err">{error}</p> : null}
    </Modal>
  );
}
