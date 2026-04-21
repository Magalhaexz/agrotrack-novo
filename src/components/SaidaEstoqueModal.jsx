import { useMemo, useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { formatarNumero } from '../utils/formatters';
import { TIPOS_MOVIMENTACAO_ESTOQUE } from '../utils/constantes';

const TIPOS_SAIDA = Object.entries(TIPOS_MOVIMENTACAO_ESTOQUE)
  .filter(([value]) => value !== 'entrada')
  .map(([value, label]) => ({ value, label }));

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

const FORM_VAZIO = {
  item_id: '',
  lote_id: '',
  quantidade: '',
  tipo: 'consumo',
  data: hojeISO(),
  obs: '',
};

function normalizarInitialForm(itens, itemInicialId) {
  const initialItemId = itemInicialId ? String(itemInicialId) : (itens[0]?.id ? String(itens[0].id) : '');
  return { ...FORM_VAZIO, item_id: initialItemId };
}

export default function SaidaEstoqueModal({
  itens = [],
  lotes = [],
  itemInicialId = '',
  handleRegistrarSaidaEstoque,
  onClose,
}) {
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState(() => normalizarInitialForm(itens, itemInicialId));
  const [erro, setErro] = useState('');

  // Atualiza o formulário se itemInicialId ou itens mudarem
  useEffect(() => {
    setForm(normalizarInitialForm(itens, itemInicialId));
    setErro('');
  }, [itens, itemInicialId]);

  const lotesAtivos = lotes.filter((lote) => lote.status === 'ativo');

  const itemSelecionado = useMemo(
    () => itens.find((item) => String(item.id) === String(form.item_id)),
    [itens, form.item_id]
  );

  const saldoAtual = Number(itemSelecionado?.quantidade_atual || 0);
  const unidade = itemSelecionado?.unidade || 'un';

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErro(''); // Limpa erros anteriores

    const quantidade = Number(form.quantidade || 0);

    if (!form.item_id) {
      setErro('Selecione o item de estoque.');
      return;
    }

    if (quantidade <= 0) {
      setErro('Informe uma quantidade válida.');
      return;
    }

    if (quantidade > saldoAtual) {
      setErro(`Saldo insuficiente. Disponível: ${formatarNumero(saldoAtual)} ${unidade}`);
      return;
    }

    setSalvando(true);
    try {
      await Promise.resolve(handleRegistrarSaidaEstoque({
        itemId: Number(form.item_id),
        loteId: form.lote_id ? Number(form.lote_id) : null, // Usar null para "Sem lote"
        quantidade,
        tipo: form.tipo,
        data: form.data,
        obs: form.obs.trim(),
      }));
      // alert('Saída registrada com sucesso'); // Evitar alert nativo
      onClose();
    } catch (error) {
      console.error('Erro ao registrar saída:', error);
      setErro('Erro ao registrar saída. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Registrar saída / consumo"
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Confirmar saída'}
          </Button>
        </div>
      )}
    >
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
        <label className="ui-input-wrap">
          <span className="ui-input-label">Item</span>
          <select
            className="ui-input"
            name="item_id"
            value={form.item_id}
            onChange={handleChange}
          >
            <option value="">Selecione</option>
            {itens.map((item) => (
              <option key={item.id} value={item.id}>
                {item.produto} (Saldo: {formatarNumero(item.quantidade_atual)} {item.unidade})
              </option>
            ))}
          </select>
        </label>

        <div className="grid-2">
          <label className="ui-input-wrap">
            <span className="ui-input-label">Lote vinculado (opcional)</span>
            <select
              className="ui-input"
              name="lote_id"
              value={form.lote_id}
              onChange={handleChange}
            >
              <option value="">Sem lote</option>
              {lotesAtivos.map((lote) => (
                <option key={lote.id} value={lote.id}>
                  {lote.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="ui-input-wrap">
            <span className="ui-input-label">Tipo de saída</span>
            <select
              className="ui-input"
              name="tipo"
              value={form.tipo}
              onChange={handleChange}
            >
              {TIPOS_SAIDA.map((tipo) => (
                <option key={tipo.value} value={tipo.value}>
                  {tipo.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid-2">
          <label className="ui-input-wrap">
            <span className="ui-input-label">Quantidade</span>
            <input
              className="ui-input"
              name="quantidade"
              type="number"
              step="0.01"
              max={saldoAtual}
              min={0}
              value={form.quantidade}
              onChange={handleChange}
            />
          </label>

          <label className="ui-input-wrap">
            <span className="ui-input-label">Data</span>
            <input
              className="ui-input"
              name="data"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={form.data}
              onChange={handleChange}
            />
          </label>
        </div>

        <label className="ui-input-wrap">
          <span className="ui-input-label">Observações</span>
          <textarea
            className="ui-input"
            name="obs"
            value={form.obs}
            onChange={handleChange}
            style={{ minHeight: 90, resize: 'vertical' }}
          />
        </label>

        {erro && (
          <p style={{ margin: 0, color: 'var(--color-danger)', fontSize: '0.85rem' }}>
            {erro}
          </p>
        )}
      </form>
    </Modal>
  );
}