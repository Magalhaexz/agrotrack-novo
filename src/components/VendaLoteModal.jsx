import { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import ArrobaPreview from './ArrobaPreview';
import { formatarNumero } from '../utils/formatters';
import { TIPOS_SAIDA_ANIMAL } from '../utils/constantes';

const TIPOS_SAIDA = Object.entries(TIPOS_SAIDA_ANIMAL).map(([value, label]) => ({ value, label }));

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

const FORM_VAZIO = {
  tipo: 'venda',
  data: hojeISO(),
  qtd: '',
  peso_medio: '',
  rendimento_carcaca: 52,
  preco_arroba: '',
  destino: '',
  obs: '',
};

function validarForm(form, qtdAtual) {
  const qtd = Number(form.qtd || 0);
  const pesoMedio = Number(form.peso_medio || 0);
  const precoArroba = Number(form.preco_arroba || 0);
  const rendimento = Number(form.rendimento_carcaca || 0);

  if (!form.data) return 'Informe a data da saída.';
  if (qtd <= 0) return 'Informe uma quantidade válida de cabeças.';
  if (qtd > Number(qtdAtual || 0)) return `Quantidade não pode ser maior que o saldo atual (${qtdAtual}).`;
  if (pesoMedio <= 0) return 'Informe o peso médio da saída.';
  if (rendimento <= 0) return 'Informe o rendimento de carcaça.';
  if (form.tipo === 'venda' && precoArroba <= 0) return 'Informe o preço por arroba para venda.';

  return null;
}

export default function VendaLoteModal({
  lote,
  qtdAtual = 0,
  handleRegistrarSaidaAnimal,
  onClose,
}) {
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erro, setErro] = useState('');

  const arrobaViva = useMemo(() => {
    return Number(form.peso_medio || 0) / 15;
  }, [form.peso_medio]);

  const valorTotal = useMemo(() => {
    if (form.tipo !== 'venda') return 0;
    const preco = Number(form.preco_arroba || 0);
    const qtd = Number(form.qtd || 0);
    return arrobaViva * preco * qtd;
  }, [arrobaViva, form.preco_arroba, form.qtd, form.tipo]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErro(''); // Limpa erros anteriores

    const erroValidacao = validarForm(form, qtdAtual);
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    setSalvando(true);
    try {
      await Promise.resolve(handleRegistrarSaidaAnimal({
        loteId: lote.id,
        qtd: Number(form.qtd),
        pesoMedio: Number(form.peso_medio),
        valorTotal: form.tipo === 'venda' ? valorTotal : 0,
        data: form.data,
        comprador: form.destino.trim(),
        tipo: form.tipo,
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

  const titulo = `Registrar saída — ${lote?.nome || 'Lote'}`;

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      <Button variant="ghost" onClick={onClose}>Cancelar</Button>
      <Button onClick={handleSubmit} disabled={salvando}>
        {salvando ? 'Salvando...' : 'Confirmar saída'}
      </Button>
    </div>
  );

  return (
    <Modal open onClose={onClose} title={titulo} footer={footer}>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>

        <div className="grid-2">
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
          <span className="ui-input-label">Rendimento de carcaça (%)</span>
          <input
            className="ui-input"
            name="rendimento_carcaca"
            type="number"
            step="0.1"
            min={0}
            max={100} // Adicionado max para rendimento
            value={form.rendimento_carcaca}
            onChange={handleChange}
          />
        </label>

        <div className="grid-2">
          <label className="ui-input-wrap">
            <span className="ui-input-label">Quantidade de cabeças</span>
            <input
              className="ui-input"
              name="qtd"
              type="number"
              min={1}
              max={Number(qtdAtual || 0)}
              value={form.qtd}
              onChange={handleChange}
              placeholder={`Máximo: ${qtdAtual}`}
            />
          </label>

          <label className="ui-input-wrap">
            <span className="ui-input-label">Peso médio na saída (kg)</span>
            <input
              className="ui-input"
              name="peso_medio"
              type="number"
              step="0.01"
              min={0}
              value={form.peso_medio}
              onChange={handleChange}
            />
          </label>
        </div>

        <ArrobaPreview
          peso={form.peso_medio}
          rendimento={form.rendimento_carcaca}
          precoPorArroba={form.preco_arroba}
        />

        <div className="grid-2">
          <label className="ui-input-wrap">
            <span className="ui-input-label">@ viva</span>
            <input
              className="ui-input"
              value={formatarNumero(arrobaViva)}
              readOnly
              style={{ opacity: 0.75 }}
            />
          </label>

          {form.tipo === 'venda' ? (
            <label className="ui-input-wrap">
              <span className="ui-input-label">Preço por @ (R$)</span>
              <input
                className="ui-input"
                name="preco_arroba"
                type="number"
                step="0.01"
                min={0}
                value={form.preco_arroba}
                onChange={handleChange}
              />
            </label>
          ) : (
            <label className="ui-input-wrap">
              <span className="ui-input-label">Preço por @ (R$)</span>
              <input
                className="ui-input"
                value="—"
                readOnly
                style={{ opacity: 0.75 }}
              />
            </label>
          )}
        </div>

        <label className="ui-input-wrap">
          <span className="ui-input-label">Valor total estimado (R$)</span>
          <input
            className="ui-input"
            value={form.tipo === 'venda' ? formatarNumero(valorTotal) : '—'}
            readOnly
            style={{ opacity: 0.75 }}
          />
        </label>

        <label className="ui-input-wrap">
          <span className="ui-input-label">Comprador/destino</span>
          <input
            className="ui-input"
            name="destino"
            value={form.destino}
            onChange={handleChange}
            placeholder="Ex: Frigorífico XPTO / Fazenda destino"
          />
        </label>

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