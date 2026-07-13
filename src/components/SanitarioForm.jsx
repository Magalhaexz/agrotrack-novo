import { useEffect, useMemo, useState } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';

import { hojeLocalISO } from '../domain/dataCivil.js';
const TIPOS_MANEJO = [
  { value: 'vacina', label: 'Vacina' },
  { value: 'vermifugo', label: 'Vermífugo' },
  { value: 'medicamento', label: 'Medicamento' },
  { value: 'exame', label: 'Exame' },
  { value: 'outro', label: 'Outro' },
];

const FORM_VAZIO = {
  lote_id: '',
  data_aplic: '',
  proxima: '',
  alerta_dias_antes: 30,
  data_fim_carencia: '',
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

// Palavras para priorizar produtos por tipo de procedimento.
const PALAVRAS_POR_TIPO = {
  vacina: ['vacina'],
  vermifugo: ['vermif', 'vermíf', 'antiparasit'],
  medicamento: ['medicament', 'antibiot', 'anti-inflam', 'antiinflam', 'remédio', 'remedio', 'soro', 'farmac', 'fármac'],
  exame: ['exame'],
  outro: [],
};

function novoProcedimento(overrides = {}) {
  return { tipo: 'vacina', item_estoque_id: '', quantidade_utilizada: '', desc: '', ...overrides };
}

function procedimentosFromInitial(data) {
  if (data && (data.tipo || data.desc || data.metadata?.item_estoque_id)) {
    return [novoProcedimento({
      tipo: data.tipo || 'vacina',
      item_estoque_id: data.item_estoque_id ?? data.metadata?.item_estoque_id ?? '',
      quantidade_utilizada: data.metadata?.quantidade_utilizada ?? '',
      desc: data.desc || '',
    })];
  }
  return [novoProcedimento()];
}

function sharedFromInitial(data) {
  if (!data) return FORM_VAZIO;
  return {
    lote_id: data.lote_id ?? '',
    data_aplic: data.data_aplic || '',
    proxima: data.proxima || '',
    alerta_dias_antes: data.alerta_dias_antes ?? 30,
    data_fim_carencia: data.data_fim_carencia || '',
    qtd: data.qtd ?? '',
    obs: data.obs || '',
    funcionario_responsavel_id: data.funcionario_responsavel_id ?? '',
  };
}

function validarForm(form, procedimentos) {
  if (!form.lote_id) return 'Selecione o lote.';
  if (!form.data_aplic) return 'Informe a data de aplicação.';
  if (!form.qtd) return 'Informe a quantidade atendida.';
  if (Number(form.qtd || 0) <= 0) return 'Quantidade atendida deve ser maior que zero.';
  if (Number(form.alerta_dias_antes || 0) <= 0) return 'Aviso de dias antes deve ser maior que zero.';
  if (!procedimentos.length) return 'Adicione pelo menos um procedimento.';
  if (procedimentos.some((proc) => !proc.tipo)) return 'Selecione o tipo do procedimento.';
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
  const [form, setForm] = useState(() => sharedFromInitial(initialData));
  const [procedimentos, setProcedimentos] = useState(() => procedimentosFromInitial(initialData));
  const [erro, setErro] = useState('');

  // Produtos do estoque relevantes para manejo sanitário. Se nada casar com as
  // palavras sanitárias mas houver estoque, mostra todos (não trava o produtor).
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

  // Produtos priorizados pelo tipo do procedimento (com fallback para todos).
  const produtosParaTipo = (tipo) => {
    const palavras = PALAVRAS_POR_TIPO[tipo] || [];
    if (!palavras.length) return produtosSanitarios;
    const filtrados = produtosSanitarios.filter((item) => {
      const hay = `${item?.categoria || ''} ${item?.subcategoria || ''} ${item?.produto || item?.nome || ''}`.toLowerCase();
      return palavras.some((palavra) => hay.includes(palavra));
    });
    return filtrados.length ? filtrados : produtosSanitarios;
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setForm(sharedFromInitial(initialData));
    setProcedimentos(procedimentosFromInitial(initialData));
    setErro('');
  }, [initialData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function atualizarProcedimento(index, patch) {
    setProcedimentos((prev) => prev.map((proc, idx) => (idx === index ? { ...proc, ...patch } : proc)));
  }

  function selecionarProduto(index, id) {
    const produto = produtosSanitarios.find((item) => String(item.id) === String(id));
    setProcedimentos((prev) => prev.map((proc, idx) => {
      if (idx !== index) return proc;
      return {
        ...proc,
        item_estoque_id: id,
        // Preenche a descrição com o nome do produto (continua editável).
        desc: produto ? (produto.produto || produto.nome || proc.desc) : proc.desc,
      };
    }));
  }

  function adicionarProcedimento() {
    setProcedimentos((prev) => [...prev, novoProcedimento()]);
  }

  function removerProcedimento(index) {
    setProcedimentos((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== index)));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const erroValidacao = validarForm(form, procedimentos);
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }
    setErro('');
    const metadataBase = initialData?.metadata && typeof initialData.metadata === 'object'
      ? initialData.metadata
      : {};
    onSave?.({
      lote_id: Number(form.lote_id),
      data_aplic: form.data_aplic,
      proxima: form.proxima || null,
      alerta_dias_antes: Number(form.alerta_dias_antes || 0),
      data_fim_carencia: form.data_fim_carencia || null,
      qtd: Number(form.qtd || 0),
      obs: form.obs.trim(),
      funcionario_responsavel_id: form.funcionario_responsavel_id
        ? Number(form.funcionario_responsavel_id)
        : null,
      metadataBase,
      procedimentos: procedimentos.map((proc) => ({
        tipo: proc.tipo,
        item_estoque_id: proc.item_estoque_id ? Number(proc.item_estoque_id) : null,
        quantidade_utilizada: proc.item_estoque_id && Number(proc.quantidade_utilizada) > 0
          ? Number(proc.quantidade_utilizada)
          : null,
        desc: String(proc.desc || '').trim(),
      })),
    });
  }

  const isEdit = Boolean(initialData);
  const titulo = isEdit ? 'Editar manejo sanitário' : 'Novo manejo sanitário';

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
          <label className="ui-input-wrap">
            <span className="ui-input-label">Data de aplicação</span>
            <input
              className="ui-input"
              name="data_aplic"
              type="date"
              max={hojeLocalISO()}
              value={form.data_aplic}
              onChange={handleChange}
            />
          </label>
        </div>

        <section className="sanitario-procedimentos">
          <div className="sanitario-procedimentos__head">
            <span className="ui-input-label">Procedimentos realizados</span>
            {isEdit ? (
              <small style={{ color: 'var(--color-text-secondary)' }}>Na edição, ajuste este procedimento.</small>
            ) : null}
          </div>

          {procedimentos.map((proc, index) => {
            const produtosTipo = produtosParaTipo(proc.tipo);
            const semProdutosTipo = produtosTipo.length === 0;
            return (
              <div key={index} className="sanitario-procedimento">
                <label className="ui-input-wrap">
                  <span className="ui-input-label">Tipo</span>
                  <select
                    className="ui-input"
                    value={proc.tipo}
                    onChange={(e) => atualizarProcedimento(index, { tipo: e.target.value })}
                  >
                    {TIPOS_MANEJO.map((tipo) => (
                      <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                    ))}
                  </select>
                </label>

                <label className="ui-input-wrap">
                  <span className="ui-input-label">Produto (do estoque, opcional)</span>
                  <select
                    className="ui-input"
                    value={proc.item_estoque_id}
                    onChange={(e) => selecionarProduto(index, e.target.value)}
                    disabled={semProdutosTipo}
                  >
                    <option value="">{semProdutosTipo ? 'Nenhum produto cadastrado' : 'Selecione (opcional)'}</option>
                    {produtosTipo.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.produto || item.nome || 'Produto sem nome'}
                        {item.subcategoria ? ` · ${item.subcategoria}` : ''}
                      </option>
                    ))}
                  </select>
                </label>

                {proc.item_estoque_id ? (() => {
                  const produtoSelecionado = produtosSanitarios.find((item) => String(item.id) === String(proc.item_estoque_id));
                  const saldoProduto = Number(produtoSelecionado?.quantidade_atual ?? produtoSelecionado?.quantidade ?? 0);
                  const quantidadeInformada = Number(proc.quantidade_utilizada || 0);
                  const saldoInsuficiente = quantidadeInformada > 0 && quantidadeInformada > saldoProduto;
                  return (
                    <label className="ui-input-wrap">
                      <span className="ui-input-label">Quantidade utilizada</span>
                      <input
                        className="ui-input"
                        type="number"
                        min={0}
                        step="0.01"
                        value={proc.quantidade_utilizada}
                        onChange={(e) => atualizarProcedimento(index, { quantidade_utilizada: e.target.value })}
                        placeholder={`Ex: 1 (saldo atual: ${saldoProduto})`}
                      />
                      {quantidadeInformada > 0 ? (
                        <small style={{ color: saldoInsuficiente ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                          {saldoInsuficiente
                            ? 'Estoque insuficiente para esta aplicação.'
                            : 'Ao salvar, esta quantidade será baixada do estoque.'}
                        </small>
                      ) : null}
                    </label>
                  );
                })() : null}

                <label className="ui-input-wrap">
                  <span className="ui-input-label">Descrição (opcional)</span>
                  <input
                    className="ui-input"
                    value={proc.desc}
                    onChange={(e) => atualizarProcedimento(index, { desc: e.target.value })}
                    placeholder="Ex: Vacina contra aftosa"
                  />
                </label>

                {procedimentos.length > 1 ? (
                  <button
                    type="button"
                    className="action-btn action-btn-danger sanitario-procedimento__remover"
                    onClick={() => removerProcedimento(index)}
                  >
                    Remover
                  </button>
                ) : null}
              </div>
            );
          })}

          {semProdutos ? (
            <small style={{ color: 'var(--color-warning, #b45309)', fontSize: '0.78rem' }}>
              Nenhum produto sanitário cadastrado. Cadastre vacinas, vermífugos ou medicamentos no estoque para vinculá-los ao manejo.
            </small>
          ) : null}

          <div>
            <Button variant="ghost" onClick={adicionarProcedimento}>+ Adicionar procedimento</Button>
          </div>
        </section>

        <div className="grid-2">
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
            <span className="ui-input-label">Fim da carência (opcional)</span>
            <input
              className="ui-input"
              name="data_fim_carencia"
              type="date"
              value={form.data_fim_carencia}
              onChange={handleChange}
            />
          </label>
        </div>

        <div className="grid-2">
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

          <label className="ui-input-wrap">
            <span className="ui-input-label">Observação geral</span>
            <input
              className="ui-input"
              name="obs"
              value={form.obs}
              onChange={handleChange}
              placeholder="Ex: reforço em 90 dias"
            />
          </label>
        </div>

        {erro && (
          <p style={{ margin: 0, color: 'var(--color-danger)', fontSize: '0.85rem' }}>
            {erro}
          </p>
        )}

      </form>
    </Modal>
  );
}
