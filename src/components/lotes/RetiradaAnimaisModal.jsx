import { useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import { RETIRADA_TIPOS, REDIRECIONAMENTO_TIPOS } from './constants';
import { useSubmitOnce } from '../../hooks/useSubmitOnce.js';

import { hojeLocalISO } from '../../domain/dataCivil.js';
const today = hojeLocalISO();

// Bug 2.2: os botões "Venda parcial"/"Morte/perda"/"Saída do lote" (LoteDetailsPanel)
// abrem este modal com uma prop `modo`, mas o tipo inicial ficava sempre fixo em
// "venda" — "Registrar morte" nunca pré-selecionava o tipo correto. LotesPage já
// remonta o modal (key muda com `retiradaModo`), então basta mapear modo→tipo aqui.
const TIPO_POR_MODO = {
  sale_partial: 'venda',
  death_loss: 'morte',
  exit: 'transferencia_saida',
};
const TITULO_POR_MODO = {
  sale_partial: 'Registrar venda',
  death_loss: 'Registrar morte/perda',
  exit: 'Registrar saída do lote',
};

const TIPOS_REDIRECIONAMENTO = new Set(REDIRECIONAMENTO_TIPOS.map((t) => t.value));

/**
 * Seção 3 do sprint de fechamento — formulário reduzido: Tipo/Data/Quantidade
 * sempre visíveis. Peso médio aparece para venda/morte/transferência (precisa
 * dele para recalcular o peso do lote remanescente). Valor total/comprador só
 * para venda (é o que gera a receita real no financeiro). "Trocar lote de
 * pasto" e "Finalizar lote" aparecem no MESMO dropdown de tipo (por pedido do
 * sprint), mas nunca viram uma retirada — ao confirmar, chamam
 * `onRedirecionar(tipo)` para o pai abrir o fluxo próprio (nunca tratadas
 * como simples redução de quantidade).
 */
export default function RetiradaAnimaisModal({ open, lote, onClose, onSubmit, onRedirecionar, maxCabecas, modo = 'sale_partial' }) {
  const { executar, isSubmitting } = useSubmitOnce();
  const [form, setForm] = useState({
    tipo: TIPO_POR_MODO[modo] || 'venda',
    data: today,
    quantidade: '',
    pesoMedio: '',
    valorTotal: '',
    destino: '',
  });
  const [error, setError] = useState('');

  const ehRedirecionamento = TIPOS_REDIRECIONAMENTO.has(form.tipo);
  const ehVenda = form.tipo === 'venda';

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    setError('');

    if (ehRedirecionamento) {
      try {
        await executar(() => onRedirecionar?.(form.tipo));
      } catch (err) {
        setError(err?.message || 'Não foi possível abrir esse fluxo agora. Tente novamente.');
      }
      return;
    }

    const qtd = Number(form.quantidade || 0);
    const peso = Number(form.pesoMedio || 0);
    if (!form.data) return setError('Informe a data da retirada.');
    if (!qtd || qtd <= 0) return setError('Informe a quantidade de cabeças.');
    if (qtd > Number(maxCabecas || 0)) return setError('A retirada não pode superar o total do lote.');
    if (!peso || peso <= 0) return setError('Informe o peso médio.');
    if (ehVenda && Number(form.valorTotal || 0) <= 0) return setError('Informe o valor total da venda.');

    try {
      await executar(() => onSubmit({
        loteId: lote.id,
        tipoSaida: form.tipo,
        data: form.data,
        qtd,
        pesoMedio: peso,
        valorTotal: ehVenda ? Number(form.valorTotal || 0) : 0,
        comprador: ehVenda ? form.destino : '',
      }));
    } catch (err) {
      setError(err?.message || 'Não foi possível salvar agora. Tente novamente.');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={TITULO_POR_MODO[modo] || 'Retirada de animais'}
      subtitle={`Lote ${lote?.nome || ''}`}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button onClick={handleSubmit} loading={isSubmitting} loadingLabel="Salvando...">
            {ehRedirecionamento ? 'Continuar' : 'Salvar retirada'}
          </Button>
        </>
      )}
    >
      <div className="form-grid two">
        <Input as="select" label="Tipo" value={form.tipo} onChange={(e) => updateField('tipo', e.target.value)}>
          <optgroup label="Retirada de animais">
            {RETIRADA_TIPOS.map((tipo) => (
              <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
            ))}
          </optgroup>
          <optgroup label="Outras ações do lote">
            {REDIRECIONAMENTO_TIPOS.map((tipo) => (
              <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
            ))}
          </optgroup>
        </Input>
        <Input type="date" label="Data" value={form.data} onChange={(e) => updateField('data', e.target.value)} />

        {!ehRedirecionamento ? (
          <>
            <Input type="number" label="Quantidade de cabeças" value={form.quantidade} onChange={(e) => updateField('quantidade', e.target.value)} />
            <Input type="number" label="Peso médio (kg)" value={form.pesoMedio} onChange={(e) => updateField('pesoMedio', e.target.value)} />
          </>
        ) : null}

        {ehVenda ? (
          <>
            <Input type="number" label="Valor total (R$)" value={form.valorTotal} onChange={(e) => updateField('valorTotal', e.target.value)} />
            <Input className="full" label="Comprador" value={form.destino} onChange={(e) => updateField('destino', e.target.value)} />
          </>
        ) : null}
      </div>
      {ehRedirecionamento ? (
        <p className="ui-input-hint">
          Esta ação abre o fluxo próprio — não reduz a quantidade do lote como uma retirada.
        </p>
      ) : null}
      {error ? <p className="err">{error}</p> : null}
    </Modal>
  );
}
