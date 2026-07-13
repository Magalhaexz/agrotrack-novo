import { useMemo, useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import { filterLotesAtivosPorFazenda } from '../../domain/offlineCaptureLogic';
import { hojeLocalISO } from '../../domain/dataCivil.js';
import {
  MOTIVOS_MOVIMENTACAO_PASTO,
  filterPastagensPorFazenda,
  isMesmoPastoAtual,
  validarMovimentacaoPastoForm,
} from '../../components/lotes/movimentacaoPastoLogic';

const today = hojeLocalISO();

function emptyForm() {
  return {
    fazendaId: '',
    loteId: '',
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

export default function RegistrarMovimentacaoPastoOfflineModal({ open, fazendas = [], lotes = [], pastagens = [], onClose, onSubmit }) {
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');

  const lotesDaFazenda = useMemo(
    () => filterLotesAtivosPorFazenda(lotes, form.fazendaId),
    [lotes, form.fazendaId]
  );
  const loteSelecionado = useMemo(
    () => lotesDaFazenda.find((lote) => String(lote.id) === String(form.loteId)) || null,
    [lotesDaFazenda, form.loteId]
  );
  const pastagensDaFazenda = useMemo(
    () => filterPastagensPorFazenda(pastagens, form.fazendaId),
    [pastagens, form.fazendaId]
  );
  const pastoAtualNome = useMemo(() => {
    if (!loteSelecionado?.pastagem_id) return 'Sem pasto vinculado';
    return pastagensDaFazenda.find((p) => String(p.id) === String(loteSelecionado.pastagem_id))?.nome || '—';
  }, [loteSelecionado, pastagensDaFazenda]);

  const mesmoPastoAtual = isMesmoPastoAtual(loteSelecionado, form.pastagemDestinoId);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSave() {
    setError('');
    if (form.motivo === 'outro' && !form.motivoOutro.trim()) {
      setError('Descreva o motivo selecionado em "Outro".');
      return;
    }
    const motivoFinal = resolveMotivoLabel(form);
    const validation = validarMovimentacaoPastoForm({ ...form, motivo: motivoFinal }, loteSelecionado);
    if (validation) {
      setError(validation);
      return;
    }

    onSubmit({
      loteId: Number(form.loteId),
      pastagemDestinoId: form.pastagemDestinoId,
      dataMovimentacao: form.dataMovimentacao,
      quantidadeCabecas: form.quantidadeCabecas === '' ? null : Number(form.quantidadeCabecas),
      motivo: motivoFinal || null,
      observacoes: form.observacoes.trim() || null,
      pastagemOrigemEsperada: loteSelecionado?.pastagem_id ?? null,
    });
    setForm(emptyForm());
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mover lote de pasto"
      subtitle="Funciona sem internet — fica salvo neste aparelho até sincronizar."
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar movimentação</Button>
        </>
      )}
    >
      <div className="form-grid two">
        <Input as="select" label="Fazenda" value={form.fazendaId} onChange={(e) => { updateField('fazendaId', e.target.value); updateField('loteId', ''); updateField('pastagemDestinoId', ''); }}>
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

        {form.loteId ? (
          <div className="ui-input-wrap">
            <label className="ui-input-label">Pasto atual</label>
            <div className="ui-input-shell" style={{ minHeight: 48 }}>
              <span className="ui-input-affix">{pastoAtualNome}</span>
            </div>
          </div>
        ) : null}

        <Input as="select" label="Pasto de destino" value={form.pastagemDestinoId} onChange={(e) => updateField('pastagemDestinoId', e.target.value)}>
          <option value="">Selecione</option>
          {pastagensDaFazenda.map((pastagem) => (
            <option key={pastagem.id} value={pastagem.id}>{pastagem.nome}</option>
          ))}
        </Input>
        <Input type="date" label="Data da movimentação" value={form.dataMovimentacao} onChange={(e) => updateField('dataMovimentacao', e.target.value)} />
        <Input type="number" label="Quantidade de cabeças (opcional)" value={form.quantidadeCabecas} onChange={(e) => updateField('quantidadeCabecas', e.target.value)} />

        <Input as="select" label="Motivo" value={form.motivo} onChange={(e) => updateField('motivo', e.target.value)}>
          <option value="">Selecione</option>
          {MOTIVOS_MOVIMENTACAO_PASTO.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </Input>
        {form.motivo === 'outro' ? (
          <Input label="Descreva o motivo" value={form.motivoOutro} onChange={(e) => updateField('motivoOutro', e.target.value)} />
        ) : null}

        <Input className="full" as="textarea" label="Observações" value={form.observacoes} onChange={(e) => updateField('observacoes', e.target.value)} />
      </div>

      {mesmoPastoAtual ? (
        <p className="ui-input-hint">O pasto de destino é igual ao pasto atual. Informe um motivo para confirmar.</p>
      ) : null}
      {error ? <p className="err">{error}</p> : null}
    </Modal>
  );
}
