import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { UNIDADES_ESTOQUE } from '../utils/constantes';

const CATEGORIAS_ESTOQUE = ['insumo', 'sanitário', 'ração', 'mineral', 'outros'];

const FORM_VAZIO = {
  produto: '',
  categoria: 'insumo',
  unidade: 'kg',
  quantidade_atual: '',
  quantidade_minima: '',
  valor_unitario: '',
  origem: 'manual',
  numero_nf: '',
  data_entrada: '',
  data_validade: '',
  alerta_dias_antes: 30,
};

const VALIDACOES_NUMERICAS = [
  { campo: 'Quantidade atual', key: 'quantidade_atual' },
  { campo: 'Quantidade mínima', key: 'quantidade_minima' },
  { campo: 'Valor unitário', key: 'valor_unitario' },
  { campo: 'Alerta de validade (dias)', key: 'alerta_dias_antes' },
];

function normalizarInitialData(data) {
  if (!data) return FORM_VAZIO;
  return {
    produto: data.produto || '',
    categoria: data.categoria || 'insumo',
    unidade: data.unidade || 'kg',
    quantidade_atual: data.quantidade_atual ?? '',
    quantidade_minima: data.quantidade_minima ?? '',
    valor_unitario: data.valor_unitario ?? '',
    origem: data.origem || 'manual',
    numero_nf: data.numero_nf || '',
    data_entrada: data.data_entrada || '',
    data_validade: data.data_validade || '',
    alerta_dias_antes: data.alerta_dias_antes ?? 30,
  };
}

function validarForm(form) {
  if (!form.produto.trim()) return 'Informe o nome do produto.';

  const campoInvalido = VALIDACOES_NUMERICAS.find(
    (item) => Number(form[item.key] || 0) <= 0
  );
  if (campoInvalido) return `${campoInvalido.campo} deve ser maior que zero.`;

  return null;
}

export default function EstoqueForm({ initialData, onSave, onCancel }) {
  const [form, setForm] = useState(() => normalizarInitialData(initialData));
  const [erro, setErro] = useState('');

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
      produto: form.produto.trim(),
      categoria: form.categoria,
      unidade: form.unidade,
      quantidade_atual: Number(form.quantidade_atual || 0),
      quantidade_minima: Number(form.quantidade_minima || 0),
      valor_unitario: Number(form.valor_unitario || 0),
      origem: form.origem,
      numero_nf: form.numero_nf.trim(),
      data_entrada: form.data_entrada,
      data_validade: form.data_validade,
      alerta_dias_antes: Number(form.alerta_dias_antes || 0),
    });
  }

  const titulo = initialData ? 'Editar item de estoque' : 'Novo item de estoque';

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      <Button onClick={handleSubmit}>Salvar item</Button>
    </div>
  );

  return (
    <Modal open onClose={onCancel} title={titulo} footer={footer}>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>

        <label>
          Produto
          <input
            className="ui-input"
            name="produto"
            value={form.produto}
            onChange={handleChange}
            placeholder="Ex: Núcleo proteico 40%"
          />
        </label>

        <div className="grid-2">
          <label>
            Categoria
            <select className="ui-input" name="categoria" value={form.categoria} onChange={handleChange}>
              {CATEGORIAS_ESTOQUE.map((cat) => (
                <option key={cat} value={cat}>{cat[0].toUpperCase() + cat.slice(1)}</option>
              ))}
            </select>
          </label>

          <label>
            Unidade
            <select className="ui-input" name="unidade" value={form.unidade} onChange={handleChange}>
              {UNIDADES_ESTOQUE.map((unidade) => (
                <option key={unidade} value={unidade === 'unidade' ? 'un' : unidade}>
                  {unidade}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid-3">
          <label>
            Qtd atual
            <input
              className="ui-input"
              name="quantidade_atual"
              type="number"
              step="0.01"
              min={0}
              value={form.quantidade_atual}
              onChange={handleChange}
            />
          </label>

          <label>
            Qtd mínima
            <input
              className="ui-input"
              name="quantidade_minima"
              type="number"
              step="0.01"
              min={0}
              value={form.quantidade_minima}
              onChange={handleChange}
            />
          </label>

          <label>
            Valor unitário (R$)
            <input
              className="ui-input"
              name="valor_unitario"
              type="number"
              step="0.01"
              min={0}
              value={form.valor_unitario}
              onChange={handleChange}
            />
          </label>
        </div>

        <div className="grid-2">
          <label>
            Origem
            <select className="ui-input" name="origem" value={form.origem} onChange={handleChange}>
              <option value="manual">Manual</option>
              <option value="NF-e">NF-e</option>
            </select>
          </label>

          <label>
            Número da NF
            <input
              className="ui-input"
              name="numero_nf"
              value={form.numero_nf}
              onChange={handleChange}
              placeholder="Opcional"
            />
          </label>
        </div>

        <div className="grid-2">
          <label>
            Data de validade
            <input
              className="ui-input"
              name="data_validade"
              type="date"
              value={form.data_validade}
              onChange={handleChange}
            />
          </label>

          <label>
            Avisar quantos dias antes
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
        </div>

        <label>
          Data de entrada
          <input
            className="ui-input"
            name="data_entrada"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={form.data_entrada}
            onChange={handleChange}
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
