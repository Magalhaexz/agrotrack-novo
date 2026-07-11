import { useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import { useSubmitOnce } from '../../hooks/useSubmitOnce.js';

const today = new Date().toISOString().slice(0, 10);

/**
 * Ajuste de lotação: correção ADMINISTRATIVA da contagem de cabeças (não é
 * venda/morte/transferência — sem efeito financeiro, sem alterar peso médio).
 * A validação de negócio (qtd inválida, sem alteração, motivo vazio) fica em
 * `buildAjusteLotacaoPatch` (lotesLogic.js); aqui só coleta e mostra o erro.
 */
export default function AjusteLotacaoModal({ open, lote, onClose, onSubmit }) {
  const { executar, isSubmitting } = useSubmitOnce();
  const [novaQtd, setNovaQtd] = useState(String(lote?.qtd ?? ''));
  const [motivo, setMotivo] = useState('');
  const [data, setData] = useState(today);
  const [error, setError] = useState('');

  async function handleSave() {
    setError('');
    try {
      await executar(() => onSubmit({
        loteId: lote?.id,
        novaQtd: novaQtd === '' ? null : Number(novaQtd),
        motivo,
        data,
      }));
    } catch (err) {
      setError(err?.message || 'Não foi possível salvar agora. Tente novamente.');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ajuste de lotação"
      subtitle={`Lote ${lote?.nome || ''} — atual: ${lote?.qtd ?? 0} cabeças`}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button onClick={handleSave} loading={isSubmitting} loadingLabel="Salvando...">Confirmar ajuste</Button>
        </>
      )}
    >
      <div className="form-grid two">
        <Input
          type="number"
          label="Quantidade correta de cabeças"
          value={novaQtd}
          onChange={(e) => setNovaQtd(e.target.value)}
        />
        <Input type="date" label="Data" value={data} onChange={(e) => setData(e.target.value)} />
        <Input
          className="full"
          as="textarea"
          label="Motivo do ajuste"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ex.: recontagem física, animal não registrado no cadastro"
        />
      </div>
      <p className="ui-input-hint">
        Este ajuste corrige a contagem do lote — não gera venda, morte ou movimentação financeira.
      </p>
      {error ? <p className="err">{error}</p> : null}
    </Modal>
  );
}
