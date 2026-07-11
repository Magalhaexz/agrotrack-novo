import { useMemo, useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import {
  MOTIVOS_MOVIMENTACAO_PASTO,
  filterPastagensPorFazenda,
  isMesmoPastoAtual,
  validarMovimentacaoPastoForm,
} from './movimentacaoPastoLogic';
import { useSubmitOnce } from '../../hooks/useSubmitOnce.js';

const today = new Date().toISOString().slice(0, 10);

function emptyForm() {
  return {
    pastagemDestinoId: '',
    dataMovimentacao: today,
    quantidadeCabecas: '',
    motivo: '',
    motivoOutro: '',
    observacoes: '',
  };
}

function resolveMotivoLabel(form) {
  if (form.motivo === 'outro') return form.motivoOutro.trim();
  return MOTIVOS_MOVIMENTACAO_PASTO.find((item) => item.value === form.motivo)?.label || '';
}

export default function MoverPastoModal({ open, lote, pastagens, onClose, onSubmit }) {
  const { executar, isSubmitting } = useSubmitOnce();
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');

  const pastagensDaFazenda = useMemo(
    () => filterPastagensPorFazenda(pastagens, lote?.faz_id),
    [pastagens, lote?.faz_id]
  );

  const mesmoPastoAtual = isMesmoPastoAtual(lote, form.pastagemDestinoId);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setError('');

    if (form.motivo === 'outro' && !form.motivoOutro.trim()) {
      setError('Descreva o motivo selecionado em "Outro".');
      return;
    }

    const motivoFinal = resolveMotivoLabel(form);
    const validation = validarMovimentacaoPastoForm({ ...form, motivo: motivoFinal }, lote);
    if (validation) {
      setError(validation);
      return;
    }

    try {
      await executar(() => onSubmit({
        loteId: lote.id,
        pastagemDestinoId: form.pastagemDestinoId,
        dataMovimentacao: form.dataMovimentacao,
        quantidadeCabecas: form.quantidadeCabecas === '' ? null : Number(form.quantidadeCabecas),
        motivo: motivoFinal || null,
        observacoes: form.observacoes.trim() || null,
      }));
    } catch (err) {
      setError(err?.message || 'Não foi possível salvar agora. Tente novamente.');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mover lote de pasto"
      subtitle={`Lote ${lote?.nome || ''}`}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button onClick={handleSave} loading={isSubmitting} loadingLabel="Salvando...">Confirmar movimentação</Button>
        </>
      )}
    >
      <div className="form-grid two">
        <div className="ui-input-wrap">
          <label className="ui-input-label">Pasto atual</label>
          <div className="ui-input-shell" style={{ minHeight: 48 }}>
            <span className="ui-input-affix">{lote?.pastagemNome || 'Sem pasto vinculado'}</span>
          </div>
        </div>

        {pastagensDaFazenda.length > 0 ? (
          <Input
            as="select"
            label="Pasto de destino"
            value={form.pastagemDestinoId}
            onChange={(e) => updateField('pastagemDestinoId', e.target.value)}
          >
            <option value="">Selecione</option>
            {pastagensDaFazenda.map((pastagem) => (
              <option key={pastagem.id} value={pastagem.id}>{pastagem.nome}</option>
            ))}
          </Input>
        ) : (
          <div className="ui-input-wrap">
            <label className="ui-input-label">Pasto de destino</label>
            <span className="ui-input-hint">Nenhum pasto cadastrado para esta fazenda.</span>
          </div>
        )}

        <Input
          type="date"
          label="Data da movimentação"
          value={form.dataMovimentacao}
          onChange={(e) => updateField('dataMovimentacao', e.target.value)}
        />
        <Input
          type="number"
          label="Quantidade de cabeças (opcional)"
          value={form.quantidadeCabecas}
          onChange={(e) => updateField('quantidadeCabecas', e.target.value)}
        />

        <Input as="select" label="Motivo" value={form.motivo} onChange={(e) => updateField('motivo', e.target.value)}>
          <option value="">Selecione</option>
          {MOTIVOS_MOVIMENTACAO_PASTO.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </Input>
        {form.motivo === 'outro' ? (
          <Input
            label="Descreva o motivo"
            value={form.motivoOutro}
            onChange={(e) => updateField('motivoOutro', e.target.value)}
          />
        ) : null}

        <Input
          className="full"
          as="textarea"
          label="Observações"
          value={form.observacoes}
          onChange={(e) => updateField('observacoes', e.target.value)}
        />
      </div>

      {mesmoPastoAtual ? (
        <p className="ui-input-hint">O pasto de destino é igual ao pasto atual. Informe um motivo para confirmar.</p>
      ) : null}
      {error ? <p className="err">{error}</p> : null}
    </Modal>
  );
}
