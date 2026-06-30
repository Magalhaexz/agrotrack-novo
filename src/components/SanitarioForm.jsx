import { useEffect, useMemo, useState } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';

const TIPOS_MANEJO = [
  { value: 'vacina', label: 'Vacina' },
  { value: 'vermifugo', label: 'Vermífugo' },
  { value: 'medicamento', label: 'Medicamento' },
  { value: 'exame', label: 'Exame' },
  { value: 'outro', label: 'Outro' },
];

const FORM_VAZIO = {
  lote_id: '',
  tipo: 'vacina',
  item_estoque_id: '',
  desc: '',
  data_aplic: '',
  proxima: '',
  alerta_dias_antes: 30,
  qtd: '',
  obs: '',
  funcionario_responsavel_id: '',
};

// Palavras que identificam um item de estoque como produto sanitário/saúde animal.
const PALAVRAS_SANITARIAS = [
  'vacina', 'vermif', 'vermíf', 'medicament', 'medicação', 'medicacao', 'remédio', 'remedio',
  'sanit', 'saúde', 'saude', 'antibiot', 'anti-inflam', 'antiinflam', 'carrapatic',
  'mosquic', 'bernic', 'hormô', 'hormo', 'soro', 'antiparasit', 'farmac', 'fármac',
];

function normalizarInitialData(data) {
  if (!data) return FORM_VAZIO;
  return {
    lote_id: data.lote_id ?? '',
    tipo: data.tipo || 'vacina',
    item_estoque_id: data.item_estoque_id ?? data.metadata?.item_estoque_id ?? '',
    desc: data.desc || '',
    data_aplic: data.data_aplic || '',
    proxima: data.proxima || '',
    alerta_dias_antes: data.alerta_dias_antes ?? 30,
    qtd: data.qtd ?? '',
    obs: data.obs || '',
    funcionario_responsavel_id: data.funcionario_responsavel_id ?? '',
  };
}

function validarForm(form) {
  if (!form.lote_id) return 'Selecione o lote.';
  if (!form.desc.trim()) return 'Informe a descrição do manejo sanitário.';
  if (!form.data_aplic) return 'Informe a data de aplicação.';
  if (!form.qtd) return 'Informe a quantidade atendida.';
  if (Number(form.qtd || 0) <= 0) return 'Quantidade atendida deve ser maior que zero.';
  if (Number(form.alerta_dias_antes || 0) <= 0) return 'Aviso de dias antes deve ser maior que zero.';
  return null;
}

export default function SanitarioForm({
  initialData,
  lotes = [],
  funcionarios = [],
  estoque = [],
  onSave,
  onCancel,
}) {
  const [form, setForm] = useState(() => normalizarInitialData(initialData));
  const [erro, setErro] = useState('');

  // Produtos cadastrados no estoque que servem para manejo sanitário (vacina,
  // vermífugo, medicamento...). Se nada casar com as palavras sanitárias mas
  // houver estoque, mostra todos para o produtor não ficar sem opção.
  const produtosSanitarios = useMemo(() => {
    const lista = Array.isArray(estoque) ? estoque : [];
    const relevantes = lista.filter((item) => {
      const cat = String(item?.categoria || '').toLowerCase();
      const sub = String(item?.subcategoria || '').toLowerCase();
      const nome = String(item?.produto || item?.nome || '').toLowerCase();
      return PALAVRAS_SANITARIAS.some((palavra) => cat.includes(palavra) || sub.includes(palavra) || nome.includes(palavra));
    });
    if (!relevantes.length && lista.length) return lista;
    return relevantes;
  }, [estoque]);
  const semProdutos = produtosSanitarios.length === 0;

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

  function handleProdutoChange(e) {
    const id = e.target.value;
    const produto = produtosSanitarios.find((item) => String(item.id) === String(id));
    setForm((prev) => ({
      ...prev,
      item_estoque_id: id,
      // Preenche a descrição com o nome do produto (continua editável).
      desc: produto ? (produto.produto || produto.nome || prev.desc) : prev.desc,
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const erroValidacao = validarForm(form);

    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    setErro('');
    // sanitario não tem coluna para produto; guardamos o vínculo em metadata,
    // preservando metadados existentes ao editar.
    const metadataBase = initialData?.metadata && typeof initialData.metadata === 'object'
      ? initialData.metadata
      : {};
    onSave?.({
      lote_id: Number(form.lote_id),
      tipo: form.tipo,
      desc: form.desc.trim(),
      data_aplic: form.data_aplic,
      proxima: form.proxima || null, // Usar null para data opcional
      alerta_dias_antes: Number(form.alerta_dias_antes || 0),
      qtd: Number(form.qtd || 0),
      obs: form.obs.trim(),
      funcionario_responsavel_id: form.funcionario_responsavel_id
        ? Number(form.funcionario_responsavel_id)
        : null, // Usar null para responsável opcional
      metadata: {
        ...metadataBase,
        item_estoque_id: form.item_estoque_id ? Number(form.item_estoque_id) : null,
      },
    });
  }

  const titulo = initialData ? 'Editar manejo sanitário' : 'Novo manejo sanitário';

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      <Button onClick={handleSubmit}>Salvar manejo</Button>
    </div>
  );

  return (
    <Modal open onClose={onCancel} title={titulo} footer={footer}>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>

        <label className="ui-input-wrap">
          <span className="ui-input-label">Lote</span>
          <select className="ui-input" name="lote_id" value={form.lote_id} onChange={handleChange}>
            <option value="">Selecione</option>
            {lotes.map((lote) => (
              <option key={lote.id} value={lote.id}>{lote.nome}</option>
            ))}
          </select>
        </label>

        <div className="grid-2">
          <label className="ui-input-wrap">
            <span className="ui-input-label">Tipo</span>
            <select className="ui-input" name="tipo" value={form.tipo} onChange={handleChange}>
              {TIPOS_MANEJO.map((tipo) => (
                <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
              ))}
            </select>
          </label>

          <label className="ui-input-wrap">
            <span className="ui-input-label">Quantidade atendida</span>
            <input
              className="ui-input"
              name="qtd"
              type="number"
              min={0}
              value={form.qtd}
              onChange={handleChange}
              placeholder="Ex: 120"
            />
          </label>
        </div>

        <label className="ui-input-wrap">
          <span className="ui-input-label">Produto / vacina (do estoque, opcional)</span>
          <select
            className="ui-input"
            name="item_estoque_id"
            value={form.item_estoque_id}
            onChange={handleProdutoChange}
            disabled={semProdutos}
          >
            <option value="">{semProdutos ? 'Nenhum produto sanitário cadastrado' : 'Selecione um produto do estoque'}</option>
            {produtosSanitarios.map((item) => (
              <option key={item.id} value={item.id}>
                {item.produto || item.nome || 'Produto sem nome'}
                {item.subcategoria ? ` · ${item.subcategoria}` : ''}
              </option>
            ))}
          </select>
          {semProdutos ? (
            <small style={{ color: 'var(--color-warning, #b45309)', fontSize: '0.78rem' }}>
              Nenhum produto sanitário cadastrado. Cadastre vacinas, vermífugos ou medicamentos no estoque para vinculá-los ao manejo.
            </small>
          ) : null}
        </label>

        <label className="ui-input-wrap">
          <span className="ui-input-label">Descrição</span>
          <input
            className="ui-input"
            name="desc"
            value={form.desc}
            onChange={handleChange}
            placeholder="Ex: Vacina contra aftosa"
          />
        </label>

        <div className="grid-2">
          <label className="ui-input-wrap">
            <span className="ui-input-label">Data de aplicação</span>
            <input
              className="ui-input"
              name="data_aplic"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={form.data_aplic}
              onChange={handleChange}
            />
          </label>

          <label className="ui-input-wrap">
            <span className="ui-input-label">Próxima dose / revisão (opcional)</span>
            <input
              className="ui-input"
              name="proxima"
              type="date"
              value={form.proxima}
              onChange={handleChange}
            />
          </label>
        </div>

        <div className="grid-2">
          <label className="ui-input-wrap">
            <span className="ui-input-label">Avisar quantos dias antes</span>
            <input
              className="ui-input"
              name="alerta_dias_antes"
              type="number"
              min={0}
              value={form.alerta_dias_antes}
              onChange={handleChange}
              placeholder="Ex: 15"
            />
          </label>

          <label className="ui-input-wrap">
            <span className="ui-input-label">Responsável pela próxima tarefa (opcional)</span>
            <select
              className="ui-input"
              name="funcionario_responsavel_id"
              value={form.funcionario_responsavel_id}
              onChange={handleChange}
            >
              <option value="">Sem responsável</option>
              {funcionarios.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome} — {f.funcao}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="ui-input-wrap">
          <span className="ui-input-label">Observação</span>
          <input
            className="ui-input"
            name="obs"
            value={form.obs}
            onChange={handleChange}
            placeholder="Ex: reforço em 90 dias"
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
