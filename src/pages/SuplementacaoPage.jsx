import { useEffect, useMemo, useState } from 'react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import SuplementacaoConsumoModal from '../components/SuplementacaoConsumoModal';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../auth/useAuth';
import { gerarNovoId } from '../utils/id';
import { formatNumber } from '../utils/calculations';
import { createOperationalRecord, updateOperationalRecord } from '../services/operationalPersistence';

function getActiveFarmId(fazendaSelecionada) {
  const direct = fazendaSelecionada?.id ?? fazendaSelecionada?.fazenda_id ?? fazendaSelecionada?.fazendaSelecionadaId ?? null;
  const value = Number(direct);
  return Number.isFinite(value) && value > 0 ? value : null;
}

const CATEGORIAS_NUTRICIONAIS = [
  'Ração',
  'Sal mineral',
  'Sal proteinado',
  'Proteinado',
  'Suplemento',
  'Volumoso',
  'Concentrado',
  'Núcleo',
  'Dieta pronta',
  'Outro produto nutricional',
];

function getDietasNormalizadas(db) {
  return Array.isArray(db?.dietas) ? db.dietas : [];
}

// Palavras que identificam um item de estoque como produto nutricional/suplemento.
// Antes só "nutrição" era aceito, então produtos cadastrados no Estoque com
// categorias como "Ração", "Sal mineral" ou "Suplemento" não eram puxados.
const PALAVRAS_NUTRICIONAIS = [
  'nutri', 'ração', 'racao', 'mineral', 'suplement', 'alimenta', 'sal',
  'proteic', 'energ', 'aditivo', 'núcleo', 'nucleo', 'concentrado', 'insumo',
];

function getProdutosNutricionais(db) {
  return (db?.estoque || []).filter((item) => {
    if (String(item?.metadata?.modulo || '').toLowerCase() === 'nutricao') return true;
    const cat = String(item?.categoria || '').toLowerCase();
    const sub = String(item?.subcategoria || '').toLowerCase();
    return PALAVRAS_NUTRICIONAIS.some((palavra) => cat.includes(palavra) || sub.includes(palavra));
  });
}

function getProdutoEditData(item) {
  const conteudo = Number(item?.metadata?.conteudo_por_embalagem || 0);
  const quantidadeAtual = Number(item?.quantidade_atual || item?.quantidade || 0);
  const quantidadeEmbalagens = conteudo > 0 ? quantidadeAtual / conteudo : quantidadeAtual;

  return {
    produto: item?.produto || item?.nome || '',
    subcategoria: item?.subcategoria || 'Ração',
    unidade_medida: item?.unidade_medida || item?.unidade || 'kg',
    quantidade_embalagens: quantidadeEmbalagens ? String(quantidadeEmbalagens) : '',
    tipo_embalagem: item?.metadata?.tipo_embalagem || 'saco',
    conteudo_por_embalagem: conteudo ? String(conteudo) : '',
    unidade_conteudo: item?.metadata?.unidade_conteudo || 'kg',
    valor_unitario: item?.valor_unitario ?? item?.custo_unitario ?? item?.preco_unitario ?? '',
    fornecedor: item?.fornecedor || '',
    validade: item?.validade || item?.data_validade || '',
    obs: item?.obs || item?.observacoes || '',
  };
}

function getDietaEditData(dieta) {
  const primeiroItem = Array.isArray(dieta?.itens) ? dieta.itens[0] : null;

  return {
    nome: dieta?.nome || '',
    lote_id: dieta?.lote_id ?? '',
    item_estoque_id: primeiroItem?.item_estoque_id ?? '',
    qtd_cab_dia: primeiroItem?.qtd_cab_dia ?? '',
    tipo_consumo: dieta?.tipo_consumo || 'kg/cabeça/dia',
    obs: dieta?.obs || '',
  };
}

export default function SuplementacaoPage({ db, setDb, session, fazendaSelecionada = null }) {
  const { showToast } = useToast();
  const { hasPermission } = useAuth();
  const activeFarmId = useMemo(() => getActiveFarmId(fazendaSelecionada), [fazendaSelecionada]);
  const [aba, setAba] = useState('produtos');
  const [openProduto, setOpenProduto] = useState(false);
  const [openDieta, setOpenDieta] = useState(false);
  const [openConsumo, setOpenConsumo] = useState(false);
  const [produtoEmEdicao, setProdutoEmEdicao] = useState(null);
  const [dietaEmEdicao, setDietaEmEdicao] = useState(null);
  const [consumoEmEdicao, setConsumoEmEdicao] = useState(null);

  const lotesAtivos = useMemo(() => (db.lotes || []).filter((lote) => lote.status === 'ativo'), [db.lotes]);
  const produtos = useMemo(() => getProdutosNutricionais(db), [db]);
  const dietas = useMemo(() => getDietasNormalizadas(db), [db]);
  const consumo = useMemo(() => (db.consumo_suplementacao || []), [db]);

  const planejamento = useMemo(() => lotesAtivos.map((lote) => {
    const dieta = dietas.find((d) => Number(d.lote_id) === Number(lote.id));
    const cabecas = (db.animais || [])
      .filter((animal) => Number(animal.lote_id) === Number(lote.id))
      .reduce((soma, animal) => soma + Number(animal.qtd || 0), 0);
    const previsto = (dieta?.itens || []).reduce(
      (soma, item) => soma + Number(item.qtd_cab_dia || 0) * cabecas,
      0
    );
    const realizados = consumo.filter((registro) => Number(registro.lote_id) === Number(lote.id));
    const realizado = realizados.length
      ? realizados.reduce((soma, registro) => soma + Number(registro.qtd_total || 0), 0) / realizados.length
      : 0;

    return {
      lote,
      cabecas,
      dieta,
      previsto,
      realizado,
      diff: realizado - previsto,
      custo: (dieta?.itens || []).reduce((acc, item) => {
        const produto = produtos.find((p) => Number(p.id) === Number(item.item_estoque_id));
        return acc + (Number(item.qtd_cab_dia || 0) * cabecas * Number(produto?.valor_unitario || 0));
      }, 0),
    };
  }), [lotesAtivos, dietas, db.animais, consumo, produtos]);

  return (
    <div className="page suplementacao-page">
      <header className="page-header">
        <div>
          <h1>Nutrição / Suplementação</h1>
          <p>Produtos nutricionais, dietas e consumo diário integrados ao estoque e financeiro.</p>
        </div>
        <div className="page-actions">
          <Button
            onClick={() => {
              setProdutoEmEdicao(null);
              setOpenProduto(true);
            }}
            disabled={!hasPermission('estoque:editar')}
          >
            Cadastrar produto nutricional
          </Button>
          <Button variant="outline" onClick={() => setOpenConsumo(true)} disabled={!hasPermission('estoque:editar')}>
            Registrar consumo
          </Button>
        </div>
      </header>

      <div className="segmented-control tab-bar">
        <button className={`segment ${aba === 'produtos' ? 'active' : ''}`} onClick={() => setAba('produtos')} type="button">Produtos nutricionais</button>
        <button className={`segment ${aba === 'dietas' ? 'active' : ''}`} onClick={() => setAba('dietas')} type="button">Dietas</button>
        <button className={`segment ${aba === 'consumo' ? 'active' : ''}`} onClick={() => setAba('consumo')} type="button">Consumo diário</button>
        <button className={`segment ${aba === 'planejamento' ? 'active' : ''}`} onClick={() => setAba('planejamento')} type="button">Planejamento por lote</button>
        <button className={`segment ${aba === 'historico' ? 'active' : ''}`} onClick={() => setAba('historico')} type="button">Histórico</button>
      </div>

      {aba === 'produtos' ? (
        <Card title="Produtos nutricionais">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th>Estoque</th>
                  <th>Unidade</th>
                  <th>Custo unitário</th>
                  <th>Fornecedor</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {produtos.length ? produtos.map((produto) => (
                  <tr key={produto.id}>
                    <td>{produto.produto}</td>
                    <td><Badge variant="info">{produto.subcategoria || 'Nutrição'}</Badge></td>
                    <td>{formatNumber(produto.quantidade_atual || 0, 2)}</td>
                    <td>{produto.unidade_medida || 'kg'}</td>
                    <td>R$ {formatNumber(produto.valor_unitario || 0, 2)}</td>
                    <td>{produto.fornecedor || '-'}</td>
                    <td>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setProdutoEmEdicao(produto);
                          setOpenProduto(true);
                        }}
                        disabled={!hasPermission('estoque:editar')}
                      >
                        Editar
                      </Button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="7" className="empty-state-td">
                      <strong>Nenhum produto nutricional cadastrado.</strong>
                      <div>Cadastre rações, suplementos, sal mineral ou dietas para vincular ao estoque.</div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setProdutoEmEdicao(null);
                          setOpenProduto(true);
                        }}
                      >
                        Cadastrar produto nutricional
                      </Button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {aba === 'dietas' ? (
        <Card title="Dietas">
          <Button
            size="sm"
            onClick={() => {
              setDietaEmEdicao(null);
              setOpenDieta(true);
            }}
          >
            Criar dieta
          </Button>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Lote</th>
                  <th>Tipo de consumo</th>
                  <th>Qtd/cab/dia</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {dietas.length ? dietas.map((dieta) => (
                  <tr key={dieta.id}>
                    <td>{dieta.nome}</td>
                    <td>{(db.lotes || []).find((lote) => Number(lote.id) === Number(dieta.lote_id))?.nome || 'Sem lote'}</td>
                    <td>{dieta.tipo_consumo || 'kg/cabeça/dia'}</td>
                    <td>{formatNumber((dieta.itens || [])[0]?.qtd_cab_dia || 0, 3)}</td>
                    <td>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setDietaEmEdicao(dieta);
                          setOpenDieta(true);
                        }}
                        disabled={!hasPermission('estoque:editar')}
                      >
                        Editar
                      </Button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" className="empty-state-td">Nenhuma dieta cadastrada.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {aba === 'consumo' ? (
        <Card title="Consumo diário">
          <p>Registre por lote, produto ou dieta e gere baixa de estoque + custo financeiro.</p>
          <Button
            onClick={() => {
              setConsumoEmEdicao(null);
              setOpenConsumo(true);
            }}
          >
            Registrar consumo diário
          </Button>
        </Card>
      ) : null}

      {aba === 'planejamento' ? (
        <Card title="Planejamento por lote">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Cabeças</th>
                  <th>Dieta</th>
                  <th>Previsto/dia</th>
                  <th>Realizado/dia</th>
                  <th>Diferença</th>
                  <th>Custo estimado/dia</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {planejamento.map((linha) => (
                  <tr key={linha.lote.id}>
                    <td>{linha.lote.nome}</td>
                    <td>{linha.cabecas}</td>
                    <td>{linha.dieta?.nome || 'Sem dieta'}</td>
                    <td>{formatNumber(linha.previsto, 2)} kg</td>
                    <td>{formatNumber(linha.realizado, 2)} kg</td>
                    <td>{formatNumber(linha.diff, 2)} kg</td>
                    <td>R$ {formatNumber(linha.custo, 2)}</td>
                    <td>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setDietaEmEdicao(linha.dieta || null);
                          setOpenDieta(true);
                        }}
                      >
                        {linha.dieta ? 'Editar dieta' : 'Criar dieta'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {aba === 'historico' ? (
        <Card title="Histórico">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Lote</th>
                  <th>Produto/Dieta</th>
                  <th>Quantidade</th>
                  <th>Custo</th>
                  <th>Responsável</th>
                  <th>Observação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {consumo.length ? consumo.map((registro) => (
                  <tr key={registro.id}>
                    <td>{registro.data || '-'}</td>
                    <td>{(db.lotes || []).find((lote) => Number(lote.id) === Number(registro.lote_id))?.nome || '-'}</td>
                    <td>{registro.produto_nome || registro.dieta_nome || 'Consumo nutricional'}</td>
                    <td>{formatNumber(registro.qtd_total || 0, 2)} {registro.unidade || 'kg'}</td>
                    <td>R$ {formatNumber(registro.custo_total || 0, 2)}</td>
                    <td>{registro.responsavel || '-'}</td>
                    <td>{registro.obs || '-'}</td>
                    <td>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setConsumoEmEdicao(registro);
                          setOpenConsumo(true);
                        }}
                        disabled={!hasPermission('estoque:editar')}
                      >
                        Editar
                      </Button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="8" className="empty-state-td">Nenhum consumo registrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {openProduto ? (
        <ProdutoNutricionalModal
          key={produtoEmEdicao?.id ?? 'novo-produto'}
          db={db}
          setDb={setDb}
          session={session}
          activeFarmId={activeFarmId}
          initialData={produtoEmEdicao}
          onClose={() => {
            setOpenProduto(false);
            setProdutoEmEdicao(null);
          }}
          showToast={showToast}
        />
      ) : null}

      {openDieta ? (
        <DietaModal
          key={dietaEmEdicao?.id ?? 'nova-dieta'}
          db={db}
          setDb={setDb}
          initialData={dietaEmEdicao}
          onClose={() => {
            setOpenDieta(false);
            setDietaEmEdicao(null);
          }}
          showToast={showToast}
        />
      ) : null}

      {openConsumo ? (
        <SuplementacaoConsumoModal
          key={consumoEmEdicao?.id ?? 'novo-consumo'}
          db={db}
          setDb={setDb}
          session={session}
          activeFarmId={activeFarmId}
          initialData={consumoEmEdicao}
          onClose={() => {
            setOpenConsumo(false);
            setConsumoEmEdicao(null);
          }}
          showToast={showToast}
        />
      ) : null}
    </div>
  );
}

function ProdutoNutricionalModal({ db, setDb, session, activeFarmId, onClose, showToast, initialData = null }) {
  const [form, setForm] = useState(() => getProdutoEditData(initialData));
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setForm(getProdutoEditData(initialData));
    setErro('');
  }, [initialData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const totalEstoque = Number(form.quantidade_embalagens || 0) * Number(form.conteudo_por_embalagem || 0);
  const custoTotal = totalEstoque * Number(form.valor_unitario || 0);
  const isEdit = Boolean(initialData?.id);

  async function salvar() {
    if (!String(form.produto || '').trim()) {
      setErro('Informe o nome do produto.');
      return;
    }
    if (Number(form.quantidade_embalagens || 0) <= 0) {
      setErro('Informe a quantidade em estoque.');
      return;
    }
    if (Number(form.conteudo_por_embalagem || 0) <= 0) {
      setErro('Informe o conteúdo por embalagem.');
      return;
    }
    if (Number(form.valor_unitario || 0) < 0) {
      setErro('Informe um custo unitário válido.');
      return;
    }

    const existente = isEdit
      ? initialData
      : (db.estoque || []).find((item) => String(item.produto || item.nome || '').toLowerCase() === String(form.produto || '').trim().toLowerCase());

    const quantidadeFinal = existente && !isEdit ? Number(existente.quantidade_atual || 0) + totalEstoque : totalEstoque;

    const payload = {
      produto: String(form.produto || '').trim(),
      nome: String(form.produto || '').trim(),
      categoria: 'Nutrição / Alimentação',
      subcategoria: form.subcategoria,
      unidade_medida: form.unidade_medida,
      unidade: form.unidade_medida,
      fazenda_id: existente?.fazenda_id ?? activeFarmId,
      quantidade_atual: quantidadeFinal,
      quantidade: quantidadeFinal,
      valor_unitario: Number(form.valor_unitario || 0),
      custo_unitario: Number(form.valor_unitario || 0),
      preco_unitario: Number(form.valor_unitario || 0),
      fornecedor: form.fornecedor,
      validade: form.validade || null,
      data_validade: form.validade || null,
      obs: form.obs,
      observacoes: form.obs,
      metadata: {
        ...(existente?.metadata || {}),
        modulo: 'nutricao',
        tipo_embalagem: form.tipo_embalagem,
        conteudo_por_embalagem: Number(form.conteudo_por_embalagem || 0),
        unidade_conteudo: form.unidade_conteudo,
        custo_total: custoTotal,
      },
    };

    setSalvando(true);
    const persisted = existente
      ? await updateOperationalRecord('estoque', Number(existente.id), payload, session)
      : await createOperationalRecord('estoque', payload, session);
    setSalvando(false);

    if (!persisted?.persisted) {
      setErro('Não foi possível salvar a suplementação. Verifique os dados e tente novamente.');
      showToast({ type: 'warning', message: persisted?.error || 'Não foi possível salvar a suplementação. Verifique os dados e tente novamente.' });
      return;
    }

    const registroFinal = persisted.data || { id: existente?.id ?? gerarNovoId(db.estoque || []), ...payload };

    setDb((prev) => ({
      ...prev,
      estoque: existente
        ? (prev.estoque || []).map((item) => (
            Number(item.id) === Number(existente.id) ? { ...item, ...registroFinal } : item
          ))
        : [...(prev.estoque || []), registroFinal],
    }));

    showToast({
      type: 'success',
      message: 'Suplementação registrada com sucesso.',
    });
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Editar produto nutricional' : 'Cadastrar produto nutricional'}
      footer={<Button onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : (isEdit ? 'Salvar alterações' : 'Salvar produto')}</Button>}
      size="lg"
    >
      <div className="form-grid two">
        <Input label="Nome do produto" value={form.produto} onChange={(e) => setForm((p) => ({ ...p, produto: e.target.value }))} />
        <label className="ui-input-wrap">
          <span className="ui-input-label">Categoria</span>
          <select className="ui-input" value={form.subcategoria} onChange={(e) => setForm((p) => ({ ...p, subcategoria: e.target.value }))}>
            {CATEGORIAS_NUTRICIONAIS.map((categoria) => <option key={categoria}>{categoria}</option>)}
          </select>
        </label>
        <label className="ui-input-wrap">
          <span className="ui-input-label">Unidade de controle</span>
          <select className="ui-input" value={form.unidade_medida} onChange={(e) => setForm((p) => ({ ...p, unidade_medida: e.target.value }))}>
            <option>kg</option>
            <option>g</option>
            <option>tonelada</option>
            <option>saco</option>
            <option>unidade</option>
            <option>litro</option>
          </select>
        </label>
        <Input label="Quantidade em estoque (embalagens)" type="number" value={form.quantidade_embalagens} onChange={(e) => setForm((p) => ({ ...p, quantidade_embalagens: e.target.value }))} />
        <label className="ui-input-wrap">
          <span className="ui-input-label">Tipo de embalagem</span>
          <select className="ui-input" value={form.tipo_embalagem} onChange={(e) => setForm((p) => ({ ...p, tipo_embalagem: e.target.value }))}>
            <option>saco</option>
            <option>bag</option>
            <option>unidade</option>
            <option>tonelada</option>
            <option>outro</option>
          </select>
        </label>
        <Input label="Conteúdo por embalagem" type="number" value={form.conteudo_por_embalagem} onChange={(e) => setForm((p) => ({ ...p, conteudo_por_embalagem: e.target.value }))} />
        <label className="ui-input-wrap">
          <span className="ui-input-label">Unidade do conteúdo</span>
          <select className="ui-input" value={form.unidade_conteudo} onChange={(e) => setForm((p) => ({ ...p, unidade_conteudo: e.target.value }))}>
            <option>kg</option>
            <option>g</option>
            <option>L</option>
            <option>ml</option>
            <option>unidade</option>
          </select>
        </label>
        <Input label="Custo unitário" type="number" value={form.valor_unitario} onChange={(e) => setForm((p) => ({ ...p, valor_unitario: e.target.value }))} />
        <Input label="Fornecedor" value={form.fornecedor} onChange={(e) => setForm((p) => ({ ...p, fornecedor: e.target.value }))} />
        <Input label="Validade" type="date" value={form.validade} onChange={(e) => setForm((p) => ({ ...p, validade: e.target.value }))} />
        <Input label="Observação" value={form.obs} onChange={(e) => setForm((p) => ({ ...p, obs: e.target.value }))} />
        {erro ? <p className="err" style={{ gridColumn: '1 / -1' }}>{erro}</p> : null}
      </div>
      <p>
        Total calculado:
        {' '}
        <strong>{formatNumber(totalEstoque, 2)} {form.unidade_conteudo}</strong>
        {' '}
        |
        {' '}
        Custo total:
        {' '}
        <strong>R$ {formatNumber(custoTotal, 2)}</strong>
      </p>
    </Modal>
  );
}

function DietaModal({ db, setDb, onClose, showToast, initialData = null }) {
  const produtos = getProdutosNutricionais(db);
  const lotes = (db.lotes || []).filter((lote) => lote.status === 'ativo');
  const [form, setForm] = useState(() => getDietaEditData(initialData));
  const [erro, setErro] = useState('');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setForm(getDietaEditData(initialData));
    setErro('');
  }, [initialData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const isEdit = Boolean(initialData?.id);

  function salvar() {
    if (!String(form.nome || '').trim()) {
      setErro('Informe o nome da dieta.');
      return;
    }
    if (!form.item_estoque_id) {
      setErro('Selecione o produto nutricional.');
      return;
    }
    if (Number(form.qtd_cab_dia || 0) <= 0) {
      setErro('Informe a quantidade por cabeça/dia.');
      return;
    }

    const payload = {
      nome: String(form.nome || '').trim(),
      lote_id: form.lote_id ? Number(form.lote_id) : null,
      tipo_consumo: form.tipo_consumo,
      obs: form.obs,
      itens: [
        {
          item_estoque_id: Number(form.item_estoque_id),
          qtd_cab_dia: Number(form.qtd_cab_dia || 0),
        },
      ],
    };

    setDb((prev) => ({
      ...prev,
      dietas: isEdit
        ? (prev.dietas || []).map((dieta) => (
            Number(dieta.id) === Number(initialData.id)
              ? { ...dieta, ...payload, id: dieta.id }
              : dieta
          ))
        : [
            ...(prev.dietas || []),
            { id: gerarNovoId(prev.dietas || []), ...payload },
          ],
    }));

    showToast({
      type: 'success',
      message: isEdit ? 'Dieta atualizada com sucesso.' : 'Dieta criada com sucesso.',
    });
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Editar dieta' : 'Criar dieta'}
      footer={<Button onClick={salvar}>{isEdit ? 'Salvar alterações' : 'Salvar dieta'}</Button>}
    >
      <div className="form-grid two">
        <Input label="Nome da dieta" value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} />
        <label className="ui-input-wrap">
          <span className="ui-input-label">Lote vinculado (opcional)</span>
          <select className="ui-input" value={form.lote_id} onChange={(e) => setForm((p) => ({ ...p, lote_id: e.target.value }))}>
            <option value="">Sem lote</option>
            {lotes.map((lote) => <option key={lote.id} value={lote.id}>{lote.nome}</option>)}
          </select>
        </label>
        <label className="ui-input-wrap">
          <span className="ui-input-label">Produto nutricional</span>
          <select className="ui-input" value={form.item_estoque_id} onChange={(e) => setForm((p) => ({ ...p, item_estoque_id: e.target.value }))} disabled={produtos.length === 0}>
            <option value="">{produtos.length === 0 ? 'Nenhum produto cadastrado' : 'Selecione'}</option>
            {produtos.map((produto) => (
              <option key={produto.id} value={produto.id}>
                {produto.produto || produto.nome || 'Produto sem nome'}
                {produto.subcategoria ? ` · ${produto.subcategoria}` : ''}
              </option>
            ))}
          </select>
          {produtos.length === 0 ? (
            <span className="ui-input-hint">
              Nenhum produto cadastrado. Cadastre um suplemento no estoque para vinculá-lo ao lote.
            </span>
          ) : null}
        </label>
        <Input label="Quantidade por cabeça/dia" type="number" value={form.qtd_cab_dia} onChange={(e) => setForm((p) => ({ ...p, qtd_cab_dia: e.target.value }))} />
        <label className="ui-input-wrap">
          <span className="ui-input-label">Tipo de consumo</span>
          <select className="ui-input" value={form.tipo_consumo} onChange={(e) => setForm((p) => ({ ...p, tipo_consumo: e.target.value }))}>
            <option>kg/cabeça/dia</option>
            <option>% do peso vivo</option>
            <option>unidade/cabeça/dia</option>
          </select>
        </label>
        <Input label="Observação" value={form.obs} onChange={(e) => setForm((p) => ({ ...p, obs: e.target.value }))} />
      </div>
      <p style={{ margin: '12px 0 0', color: 'var(--color-warning, #c48f00)', fontSize: '0.85rem' }}>
        Dietas ficam salvas apenas neste dispositivo por enquanto — não sincronizam com a nuvem nem aparecem em outro aparelho.
      </p>
      {erro ? <p style={{ margin: 0, color: 'var(--color-danger)', fontSize: '0.85rem' }}>{erro}</p> : null}
    </Modal>
  );
}
