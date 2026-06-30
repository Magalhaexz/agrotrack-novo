import { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

const FORM_VAZIO = {
  lote_id: '',
  item_estoque_id: '',
  modo: 'por_cabeca',
  consumo_por_cabeca_dia: '',
  consumo_total_dia: '',
  obs: '',
};

function normalizarInitialData(data) {
  if (!data) return FORM_VAZIO;
  return {
    lote_id: data.lote_id ?? '',
    item_estoque_id: data.item_estoque_id ?? '',
    modo: data.modo || 'por_cabeca',
    consumo_por_cabeca_dia: data.consumo_por_cabeca_dia ?? '',
    consumo_total_dia: data.consumo_total_dia ?? '',
    obs: data.obs || '',
  };
}

function validarForm(form) {
  if (!form.lote_id) return 'Selecione o lote.';
  if (!form.item_estoque_id) return 'Selecione o item do estoque.';

  if (form.modo === 'por_cabeca') {
    if (!Number(form.consumo_por_cabeca_dia || 0)) return 'Informe o consumo por cabeça/dia.';
    if (Number(form.consumo_por_cabeca_dia || 0) <= 0) return 'Consumo por cabeça/dia deve ser maior que zero.';
  } else {
    if (!Number(form.consumo_total_dia || 0)) return 'Informe o consumo total do lote/dia.';
    if (Number(form.consumo_total_dia || 0) <= 0) return 'Consumo total do lote/dia deve ser maior que zero.';
  }

  return null;
}

export default function SuplementacaoForm({ lotes = [], estoque = [], onSave, onCancel, initialData = null }) {
  const [form, setForm] = useState(() => normalizarInitialData(initialData));
  const [erro, setErro] = useState('');

  // Puxa os produtos cadastrados no estoque relacionados a nutrição/suplementação.
  // Antes o filtro exigia categoria exata ('insumo'/'ração'/'mineral'/'outros'),
  // o que excluía produtos cadastrados com categorias como "Nutrição / Alimentação".
  const itensDisponiveis = useMemo(() => {
    const lista = Array.isArray(estoque) ? estoque : [];
    const PALAVRAS_NUTRI = [
      'insumo', 'ração', 'racao', 'mineral', 'suplement', 'nutri', 'alimenta',
      'sal', 'proteic', 'energ', 'aditivo', 'núcleo', 'nucleo', 'concentrado', 'outros',
    ];
    const relevantes = lista.filter((item) => {
      const cat = String(item?.categoria || '').toLowerCase();
      const sub = String(item?.subcategoria || '').toLowerCase();
      return PALAVRAS_NUTRI.some((palavra) => cat.includes(palavra) || sub.includes(palavra));
    });
    // O produtor precisa sempre enxergar o que cadastrou: se o filtro por
    // categoria não encontrar nada mas houver itens no estoque, mostra todos.
    if (!relevantes.length && lista.length) return lista;
    return relevantes;
  }, [estoque]);
  const semProdutos = itensDisponiveis.length === 0;

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setForm(normalizarInitialData(initialData));
    setErro('');
  }, [initialData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const erroValidacao = validarForm(form);

    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    setErro('');
    onSave?.({
      lote_id: Number(form.lote_id),
      item_estoque_id: Number(form.item_estoque_id),
      modo: form.modo,
      consumo_por_cabeca_dia: Number(form.consumo_por_cabeca_dia || 0),
      consumo_total_dia: Number(form.consumo_total_dia || 0),
      obs: form.obs.trim(),
    });
  }

  const titulo = initialData ? 'Editar suplementação' : 'Nova suplementação';

  const footer = (
    <div className="action-row" style={{ justifyContent: 'flex-end' }}>
      <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      <Button onClick={handleSubmit}>Salvar suplementação</Button>
    </div>
  );

  return (
    <Modal open onClose={onCancel} title={titulo} footer={footer}>
      <form onSubmit={handleSubmit} className="form-section" style={{ display: 'grid', gap: 14 }}>
        <div className="grid-2">
          <label className="ui-input-wrap">
            <span className="ui-input-label">Lote</span>
            <select className="ui-input" name="lote_id" value={form.lote_id} onChange={handleChange}>
              <option value="">Selecione</option>
              {lotes.map((lote) => (
                <option key={lote.id} value={lote.id}>{lote.nome}</option>
              ))}
            </select>
          </label>

          <label className="ui-input-wrap">
            <span className="ui-input-label">Dieta / produto</span>
            <select className="ui-input" name="item_estoque_id" value={form.item_estoque_id} onChange={handleChange} disabled={semProdutos}>
              <option value="">{semProdutos ? 'Nenhum produto cadastrado' : 'Selecione'}</option>
              {itensDisponiveis.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.produto || item.nome || 'Produto sem nome'}
                  {item.subcategoria ? ` · ${item.subcategoria}` : ''}
                </option>
              ))}
            </select>
            {semProdutos ? (
              <small style={{ color: 'var(--color-warning, #b45309)', fontSize: '0.78rem' }}>
                Nenhum produto cadastrado. Cadastre um suplemento no estoque para vinculá-lo ao lote.
              </small>
            ) : null}
          </label>
        </div>

        <label className="ui-input-wrap">
          <span className="ui-input-label">Modo de consumo</span>
          <select className="ui-input" name="modo" value={form.modo} onChange={handleChange}>
            <option value="por_cabeca">Por cabeça / dia</option>
            <option value="total_lote">Total do lote / dia</option>
          </select>
        </label>

        {form.modo === 'por_cabeca' ? (
          <label className="ui-input-wrap">
            <span className="ui-input-label">Consumo por cabeça / dia</span>
            <input
              className="ui-input"
              name="consumo_por_cabeca_dia"
              type="number"
              step="0.001"
              min={0}
              value={form.consumo_por_cabeca_dia}
              onChange={handleChange}
              placeholder="Ex: 0.500"
            />
          </label>
        ) : (
          <label className="ui-input-wrap">
            <span className="ui-input-label">Consumo total do lote / dia</span>
            <input
              className="ui-input"
              name="consumo_total_dia"
              type="number"
              step="0.001"
              min={0}
              value={form.consumo_total_dia}
              onChange={handleChange}
              placeholder="Ex: 48"
            />
          </label>
        )}

        <label className="ui-input-wrap">
          <span className="ui-input-label">Observação</span>
          <input
            className="ui-input"
            name="obs"
            value={form.obs}
            onChange={handleChange}
            placeholder="Opcional"
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
