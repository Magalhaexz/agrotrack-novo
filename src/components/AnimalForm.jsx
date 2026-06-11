import { useEffect, useMemo, useState } from 'react';
import ArrobaPreview from './ArrobaPreview';
import Button from './ui/Button';
import Modal from './ui/Modal';
import { parseNumeroEntrada } from '../utils/formatters';

const FORM_VAZIO = {
  tipo_registro: 'grupo',
  fazenda_id: '',
  lote_id: '',
  data_referencia: '',
  data_nascimento: '',
  identificacao: '',
  categoria: '',
  raca: '',
  sexo: '',
  origem: '',
  qtd: '',
  p_ini: '',
  p_at: '',
  dias: '',
  consumo: '',
  status: 'ativo',
  observacao: '',
  rendimento_carcaca: 52,
  preco_arroba: '',
};

function normalizarInitialData(data) {
  if (!data) return FORM_VAZIO;
  return {
    ...FORM_VAZIO,
    tipo_registro: data.tipo_registro || (Number(data.qtd || 0) === 1 && (data.identificacao || data.nome) ? 'individual' : 'grupo'),
    fazenda_id: data.fazenda_id ?? data.faz_id ?? data?.metadata?.fazenda_id ?? '',
    lote_id: data.lote_id ?? '',
    data_referencia: data.data_referencia || data.data_entrada || '',
    data_nascimento: data.data_nascimento || data?.metadata?.data_nascimento || '',
    identificacao: data.identificacao || data.nome || '',
    categoria: data.categoria || data.categoria_animal || data?.metadata?.categoria || '',
    raca: data.raca || data.gen || data.raca_animal || data?.metadata?.raca || '',
    sexo: data.sexo === 'femea' ? 'femea' : (data.sexo || ''),
    origem: data.origem || data?.metadata?.origem || '',
    qtd: data.qtd ?? '',
    p_ini: data.p_ini ?? '',
    p_at: data.p_at ?? '',
    dias: data.dias ?? '',
    consumo: data.consumo ?? '',
    status: data.status || 'ativo',
    observacao: data.observacao || data.obs || '',
    rendimento_carcaca: data.rendimento_carcaca ?? 52,
    preco_arroba: data.preco_arroba ?? '',
  };
}

function obterNumero(form, key) {
  const numero = parseNumeroEntrada(form[key]);
  return Number.isFinite(numero) ? numero : null;
}

function validarForm(form) {
  if (!String(form.fazenda_id || '').trim()) return 'Selecione a fazenda.';

  if (form.tipo_registro === 'individual') {
    if (!form.identificacao.trim()) return 'Informe a identificação / brinco / código.';
    return null;
  }

  if (!form.identificacao.trim()) return 'Informe o nome do lote ou grupo.';
  if (obterNumero(form, 'qtd') === null || obterNumero(form, 'qtd') <= 0) return 'Informe a quantidade de cabeças.';
  if (!String(form.data_referencia || '').trim()) return 'Informe a data de entrada.';
  return null;
}

function getFilteredLotes(lotes = [], fazendaId = '') {
  if (!String(fazendaId || '').trim()) return lotes;
  return lotes.filter((lote) => {
    const loteFazendaId = lote?.faz_id ?? lote?.fazenda_id ?? lote?.metadata?.fazenda_id ?? null;
    return !loteFazendaId || String(loteFazendaId) === String(fazendaId);
  });
}

export default function AnimalForm({ initialData, lotes = [], fazendas = [], onSave, onCancel }) {
  const [form, setForm] = useState(() => normalizarInitialData(initialData));
  const [erro, setErro] = useState('');
  const lotesVisiveis = useMemo(() => getFilteredLotes(lotes, form.fazenda_id), [lotes, form.fazenda_id]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setForm(normalizarInitialData(initialData));
    setErro('');
  }, [initialData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => {
      if (name === 'tipo_registro') {
        if (value === 'individual') {
          return {
            ...prev,
            tipo_registro: value,
            qtd: '1',
          };
        }
        return {
          ...prev,
          tipo_registro: value,
        };
      }

      if (name === 'fazenda_id') {
        return {
          ...prev,
          fazenda_id: value,
          lote_id: '',
        };
      }

      return { ...prev, [name]: value };
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    const erroValidacao = validarForm(form);
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    setErro('');
    const identificacao = form.identificacao.trim();
    const fazendaId = String(form.fazenda_id || '').trim() ? Number(form.fazenda_id) : null;
    const loteId = String(form.lote_id || '').trim() ? Number(form.lote_id) : null;
    const dataReferencia = String(form.data_referencia || '').trim() || null;
    const dataNascimento = String(form.data_nascimento || '').trim() || null;
    const qtd = form.tipo_registro === 'individual' ? 1 : Number(obterNumero(form, 'qtd') || 0);
    const pIni = obterNumero(form, 'p_ini');
    const pAt = obterNumero(form, 'p_at');
    const dias = obterNumero(form, 'dias');
    const consumo = obterNumero(form, 'consumo');
    const rendimentoCarcaca = obterNumero(form, 'rendimento_carcaca');
    const precoArroba = obterNumero(form, 'preco_arroba');

    onSave?.({
      tipo_registro: form.tipo_registro,
      fazenda_id: fazendaId,
      lote_id: loteId,
      data_referencia: dataReferencia,
      data_nascimento: dataNascimento,
      identificacao,
      nome: identificacao,
      categoria: form.categoria.trim(),
      raca: form.raca.trim(),
      sexo: form.sexo === 'femea' ? 'femea' : form.sexo || '',
      origem: form.origem.trim(),
      qtd,
      p_ini: pIni,
      p_at: pAt,
      dias,
      consumo,
      status: form.status || 'ativo',
      observacao: form.observacao.trim(),
      rendimento_carcaca: rendimentoCarcaca,
      preco_arroba: form.preco_arroba === '' ? null : precoArroba,
      metadata: {
        fazenda_id: fazendaId,
        data_nascimento: dataNascimento,
        categoria: form.categoria.trim() || null,
        raca: form.raca.trim() || null,
        sexo: form.sexo || null,
        origem: form.origem.trim() || null,
        identificacao,
        data_referencia: dataReferencia,
      },
    });
  }

  const titulo = initialData ? 'Editar animal' : 'Novo cadastro de animal';
  const identificacaoLabel = form.tipo_registro === 'individual'
    ? 'Identificação / brinco / nome'
    : 'Nome do lote / grupo';
  const dataReferenciaLabel = form.tipo_registro === 'grupo'
    ? 'Data de entrada'
    : 'Data de entrada / referência';

  const footer = (
    <div className="modal-footer action-row" style={{ width: '100%' }}>
      <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      <Button onClick={handleSubmit}>Salvar</Button>
    </div>
  );

  return (
    <Modal
      open
      onClose={onCancel}
      title={titulo}
      subtitle="Preencha os dados essenciais e deixe o restante para edição posterior."
      footer={footer}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="animal-form form-section">
        <section className="animal-form-section section-card">
          <div className="animal-form-section-head section-header"><h4>Tipo de cadastro</h4></div>
          <label className="animal-form-field">
            <span className="animal-form-label">Modo</span>
            <select className="ui-input" name="tipo_registro" value={form.tipo_registro} onChange={handleChange}>
              <option value="grupo">Grupo de animais</option>
              <option value="individual">Animal individual</option>
            </select>
          </label>
        </section>

        <section className="animal-form-section section-card">
          <div className="animal-form-section-head section-header"><h4>Identificação</h4></div>
          <div className="animal-form-grid animal-form-grid--2">
            <label className="animal-form-field">
              <span className="animal-form-label">Fazenda</span>
              <select className="ui-input" name="fazenda_id" value={form.fazenda_id} onChange={handleChange}>
                <option value="">Selecione</option>
                {fazendas.map((fazenda) => (
                  <option key={fazenda.id} value={fazenda.id}>{fazenda.nome}</option>
                ))}
              </select>
            </label>

            <label className="animal-form-field">
              <span className="animal-form-label">Lote vinculado (opcional)</span>
              <select className="ui-input" name="lote_id" value={form.lote_id} onChange={handleChange}>
                <option value="">Selecione</option>
                {lotesVisiveis.map((lote) => (
                  <option key={lote.id} value={lote.id}>{lote.nome}</option>
                ))}
                {form.lote_id && !lotesVisiveis.some((item) => String(item.id) === String(form.lote_id)) ? (
                  <option value={form.lote_id}>Lote vinculado não encontrado</option>
                ) : null}
              </select>
            </label>

            <label className="animal-form-field">
              <span className="animal-form-label">Sexo</span>
              <select className="ui-input" name="sexo" value={form.sexo} onChange={handleChange}>
                <option value="">Não informado</option>
                <option value="macho">Macho</option>
                <option value="femea">Fêmea</option>
              </select>
            </label>

            <label className="animal-form-field">
              <span className="animal-form-label">{dataReferenciaLabel}</span>
              <input className="ui-input" type="date" name="data_referencia" value={form.data_referencia} onChange={handleChange} />
            </label>

            <label className="animal-form-field full">
              <span className="animal-form-label">{identificacaoLabel}</span>
              <input
                className="ui-input"
                name="identificacao"
                value={form.identificacao}
                onChange={handleChange}
                placeholder={form.tipo_registro === 'individual' ? 'Ex.: BR-0241' : 'Ex.: Grupo Primavera'}
              />
            </label>
          </div>
        </section>

        <section className="animal-form-section section-card">
          <div className="animal-form-section-head section-header"><h4>Dados operacionais</h4></div>
          <div className="animal-form-grid animal-form-grid--2">
            <label className="animal-form-field">
              <span className="animal-form-label">Categoria</span>
              <input
                className="ui-input"
                name="categoria"
                value={form.categoria}
                onChange={handleChange}
                placeholder="Ex.: Bezerros, Garrotes"
              />
            </label>

            <label className="animal-form-field">
              <span className="animal-form-label">Raça</span>
              <input
                className="ui-input"
                name="raca"
                value={form.raca}
                onChange={handleChange}
                placeholder="Ex.: Nelore, Brangus"
              />
            </label>

            <label className="animal-form-field">
              <span className="animal-form-label">Quantidade (cabeças)</span>
              <input
                className="ui-input"
                type="text"
                inputMode="numeric"
                name="qtd"
                value={form.qtd}
                onChange={handleChange}
                placeholder="Ex.: 80"
                disabled={form.tipo_registro === 'individual'}
              />
            </label>

            <label className="animal-form-field">
              <span className="animal-form-label">Peso inicial (kg)</span>
              <input
                className="ui-input"
                type="text"
                inputMode="decimal"
                name="p_ini"
                value={form.p_ini}
                onChange={handleChange}
                placeholder="Ex.: 320,5"
              />
            </label>

            <label className="animal-form-field">
              <span className="animal-form-label">Peso atual (kg)</span>
              <input
                className="ui-input"
                type="text"
                inputMode="decimal"
                name="p_at"
                value={form.p_at}
                onChange={handleChange}
                placeholder="Ex.: 440,5"
              />
            </label>

            <label className="animal-form-field">
              <span className="animal-form-label">Data de nascimento</span>
              <input className="ui-input" type="date" name="data_nascimento" value={form.data_nascimento} onChange={handleChange} />
            </label>

            <label className="animal-form-field">
              <span className="animal-form-label">Origem</span>
              <input className="ui-input" name="origem" value={form.origem} onChange={handleChange} placeholder="Ex.: Compra, nascimento próprio" />
            </label>

            <label className="animal-form-field">
              <span className="animal-form-label">Dias no lote</span>
              <input className="ui-input" type="text" inputMode="numeric" name="dias" value={form.dias} onChange={handleChange} placeholder="Ex.: 120" />
            </label>

            <label className="animal-form-field">
              <span className="animal-form-label">Consumo (kg/dia)</span>
              <input className="ui-input" type="text" inputMode="decimal" name="consumo" value={form.consumo} onChange={handleChange} placeholder="Ex.: 12,5" />
            </label>

            <label className="animal-form-field">
              <span className="animal-form-label">Rendimento de carcaça (%)</span>
              <input className="ui-input" type="text" inputMode="decimal" name="rendimento_carcaca" value={form.rendimento_carcaca} onChange={handleChange} placeholder="Ex.: 52" />
            </label>

            <label className="animal-form-field">
              <span className="animal-form-label">Preço por @ (opcional)</span>
              <input className="ui-input" type="text" inputMode="decimal" name="preco_arroba" value={form.preco_arroba} onChange={handleChange} placeholder="Ex.: 290" />
            </label>

            <label className="animal-form-field full">
              <span className="animal-form-label">Observações</span>
              <input className="ui-input" name="observacao" value={form.observacao} onChange={handleChange} placeholder="Ex.: observação operacional" />
            </label>
          </div>
        </section>

        <ArrobaPreview
          peso={form.p_at || form.p_ini}
          rendimento={form.rendimento_carcaca}
          precoPorArroba={form.preco_arroba}
        />

        {erro ? (
          <p style={{ margin: 0, color: 'var(--color-danger)', fontSize: '0.85rem' }}>
            {erro}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
