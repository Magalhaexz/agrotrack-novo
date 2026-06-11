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

const getTodayIso = () => new Date().toISOString().slice(0, 10);
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

function getProdutosNutricionais(db) {
  return (db?.estoque || []).filter(
    (item) => String(item?.categoria || '').toLowerCase().includes('nutrição')
      || String(item?.metadata?.modulo || '').toLowerCase() === 'nutricao'
  );
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

function normalizeConsumptionSelection(db, form, fallbackRecord = null) {
  const produtos = getProdutosNutricionais(db);
  const dietas = getDietasNormalizadas(db);
  const origem = String(form?.origem || fallbackRecord?.origem_tipo || (fallbackRecord?.dieta_nome ? 'dieta' : 'produto')).toLowerCase();

  if (origem === 'dieta') {
    const dieta =
      dietas.find((item) => Number(item.id) === Number(form?.ref_id))
      || dietas.find((item) => Number(item.id) === Number(fallbackRecord?.dieta_id))
      || dietas.find((item) => String(item.nome || '').toLowerCase() === String(fallbackRecord?.dieta_nome || '').toLowerCase())
      || null;

    const produtoId = dieta?.itens?.[0]?.item_estoque_id ?? fallbackRecord?.item_estoque_id ?? null;
    const produto =
      produtos.find((item) => Number(item.id) === Number(produtoId))
      || produtos.find((item) => String(item.produto || '').toLowerCase() === String(fallbackRecord?.produto_nome || '').toLowerCase())
      || null;

    return {
      origem: 'dieta',
      dieta,
      produto,
      refId: dieta?.id ?? form?.ref_id ?? fallbackRecord?.dieta_id ?? '',
      unidadePadrao: produto?.unidade_medida || produto?.unidade || 'kg',
    };
  }

  const produto =
    produtos.find((item) => Number(item.id) === Number(form?.ref_id))
    || produtos.find((item) => Number(item.id) === Number(fallbackRecord?.item_estoque_id))
    || produtos.find((item) => String(item.produto || '').toLowerCase() === String(fallbackRecord?.produto_nome || '').toLowerCase())
    || null;

  return {
    origem: 'produto',
    dieta: null,
    produto,
    refId: produto?.id ?? form?.ref_id ?? fallbackRecord?.item_estoque_id ?? '',
    unidadePadrao: produto?.unidade_medida || produto?.unidade || 'kg',
  };
}

function buildConsumptionInitialData(db, record = null) {
  if (!record) {
    return {
      data: getTodayIso(),
      lote_id: '',
      origem: 'produto',
      ref_id: '',
      quantidade: '',
      unidade: 'kg',
      obs: '',
    };
  }

  const selection = normalizeConsumptionSelection(
    db,
    {
      origem: record?.origem_tipo || (record?.dieta_nome ? 'dieta' : 'produto'),
      ref_id: record?.dieta_id || record?.item_estoque_id || '',
    },
    record
  );

  return {
    data: record?.data || getTodayIso(),
    lote_id: record?.lote_id ?? '',
    origem: selection.origem,
    ref_id: selection.refId,
    quantidade: record?.qtd_total ?? record?.quantidade ?? '',
    unidade: record?.unidade || selection.unidadePadrao || 'kg',
    obs: record?.obs || '',
  };
}

function getConsumptionCost(quantity, produto) {
  return Number(quantity || 0) * Number(produto?.valor_unitario || produto?.custo_unitario || produto?.preco_unitario || 0);
}

function applyConsumptionChange(prev, existingRecord, nextValues) {
  const currentSelection = normalizeConsumptionSelection(prev, {}, existingRecord);
  const nextSelection = normalizeConsumptionSelection(prev, nextValues, existingRecord);
  const currentQty = Number(existingRecord?.qtd_total || existingRecord?.quantidade || 0);
  const nextQty = Number(nextValues?.quantidade || 0);
  const currentCost = getConsumptionCost(currentQty, currentSelection.produto);
  const nextCost = getConsumptionCost(nextQty, nextSelection.produto);

  const restoredStockId = currentSelection.produto?.id != null ? Number(currentSelection.produto.id) : null;
  const consumedStockId = nextSelection.produto?.id != null ? Number(nextSelection.produto.id) : null;

  const estoqueAtualizado = (prev.estoque || []).map((item) => {
    const itemId = Number(item.id);
    let saldo = Number(item.quantidade_atual || 0);
    let touched = false;

    if (restoredStockId !== null && itemId === restoredStockId) {
      saldo += currentQty;
      touched = true;
    }

    if (consumedStockId !== null && itemId === consumedStockId) {
      saldo -= nextQty;
      touched = true;
    }

    return touched ? { ...item, quantidade_atual: saldo } : item;
  });

  const consumoAtualizado = {
    ...existingRecord,
    data: nextValues.data,
    lote_id: nextValues.lote_id,
    origem_tipo: nextSelection.origem,
    item_estoque_id: consumedStockId,
    dieta_id: nextSelection.dieta?.id ?? null,
    produto_nome: nextSelection.produto?.produto || existingRecord?.produto_nome || null,
    dieta_nome: nextSelection.dieta?.nome || null,
    qtd_total: nextQty,
    unidade: nextValues.unidade || nextSelection.unidadePadrao || 'kg',
    custo_total: nextCost,
    obs: nextValues.obs || '',
  };

  const consumoId = Number(existingRecord?.id);
  const movimentacoesFinanceiras = Array.isArray(prev.movimentacoes_financeiras) ? prev.movimentacoes_financeiras : [];
  const financeIndex = movimentacoesFinanceiras.findIndex(
    (mov) => String(mov?.origem_tipo || '') === 'consumo_suplementacao' && Number(mov?.origem_id) === consumoId
  );
  const descricaoFinanceira = `Consumo nutricional - ${nextSelection.produto?.produto || nextSelection.dieta?.nome || 'Item'}`;
  const movimentoFinanceiroBase = {
    tipo: 'despesa',
    categoria: 'nutricao',
    subcategoria: 'alimentacao',
    lote_id: nextValues.lote_id ? Number(nextValues.lote_id) : null,
    valor: nextCost,
    data: nextValues.data,
    descricao: descricaoFinanceira,
    origem_tipo: 'consumo_suplementacao',
    origem_id: consumoId,
  };

  const movimentacoesFinanceirasAtualizadas = financeIndex >= 0
    ? movimentacoesFinanceiras.map((mov, index) => (index === financeIndex ? { ...mov, ...movimentoFinanceiroBase } : mov))
    : [
        ...movimentacoesFinanceiras,
        {
          id: gerarNovoId(movimentacoesFinanceiras),
          ...movimentoFinanceiroBase,
        },
      ];

  return {
    estoqueAtualizado,
    consumoAtualizado,
    movimentacoesFinanceirasAtualizadas,
    currentSelection,
    nextSelection,
    currentQty,
    nextQty,
    currentCost,
    nextCost,
  };
}

export default function SuplementacaoPage({ db, setDb }) {
  const { showToast } = useToast();
  const { hasPermission } = useAuth();
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

function ProdutoNutricionalModal({ db, setDb, onClose, showToast, initialData = null }) {
  const [form, setForm] = useState(() => getProdutoEditData(initialData));
  const [erro, setErro] = useState('');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setForm(getProdutoEditData(initialData));
    setErro('');
  }, [initialData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const totalEstoque = Number(form.quantidade_embalagens || 0) * Number(form.conteudo_por_embalagem || 0);
  const custoTotal = totalEstoque * Number(form.valor_unitario || 0);
  const isEdit = Boolean(initialData?.id);

  function salvar() {
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

    const payload = {
      produto: String(form.produto || '').trim(),
      nome: String(form.produto || '').trim(),
      categoria: 'Nutrição / Alimentação',
      subcategoria: form.subcategoria,
      unidade_medida: form.unidade_medida,
      unidade: form.unidade_medida,
      quantidade_atual: totalEstoque,
      quantidade: totalEstoque,
      valor_unitario: Number(form.valor_unitario || 0),
      custo_unitario: Number(form.valor_unitario || 0),
      preco_unitario: Number(form.valor_unitario || 0),
      fornecedor: form.fornecedor,
      validade: form.validade || null,
      data_validade: form.validade || null,
      obs: form.obs,
      observacoes: form.obs,
      metadata: {
        ...(initialData?.metadata || {}),
        modulo: 'nutricao',
        tipo_embalagem: form.tipo_embalagem,
        conteudo_por_embalagem: Number(form.conteudo_por_embalagem || 0),
        unidade_conteudo: form.unidade_conteudo,
        custo_total: custoTotal,
      },
    };

    const existente = isEdit
      ? initialData
      : (db.estoque || []).find((item) => String(item.produto || item.nome || '').toLowerCase() === String(form.produto || '').trim().toLowerCase());

    setDb((prev) => ({
      ...prev,
      estoque: existente
        ? (prev.estoque || []).map((item) => (
            Number(item.id) === Number(existente.id)
              ? { ...item, ...payload, quantidade_atual: isEdit ? totalEstoque : Number(item.quantidade_atual || 0) + totalEstoque }
              : item
          ))
        : [
            ...(prev.estoque || []),
            { id: gerarNovoId(prev.estoque || []), ...payload },
          ],
    }));

    showToast({
      type: 'success',
      message: isEdit ? 'Produto nutricional atualizado com sucesso.' : (existente ? 'Produto vinculado e estoque atualizado.' : 'Produto nutricional cadastrado.'),
    });
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Editar produto nutricional' : 'Cadastrar produto nutricional'}
      footer={<Button onClick={salvar}>{isEdit ? 'Salvar alterações' : 'Salvar produto'}</Button>}
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
          <select className="ui-input" value={form.item_estoque_id} onChange={(e) => setForm((p) => ({ ...p, item_estoque_id: e.target.value }))}>
            <option value="">Selecione</option>
            {produtos.map((produto) => <option key={produto.id} value={produto.id}>{produto.produto}</option>)}
          </select>
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
      {erro ? <p style={{ margin: 0, color: 'var(--color-danger)', fontSize: '0.85rem' }}>{erro}</p> : null}
    </Modal>
  );
}

function ConsumoModal({ db, setDb, onClose, showToast, initialData = null }) {
  const [form, setForm] = useState(() => buildConsumptionInitialData(db, initialData));
  const [erro, setErro] = useState('');

  const currentSelection = useMemo(
    () => normalizeConsumptionSelection(db, {}, initialData),
    [db, initialData]
  );

  const previewSelection = useMemo(
    () => normalizeConsumptionSelection(db, form, initialData),
    [db, form, initialData]
  );

  const custoEstimado = useMemo(
    () => getConsumptionCost(form.quantidade, previewSelection.produto),
    [form.quantidade, previewSelection.produto]
  );

  function validar() {
    if (!form.data) return 'Informe a data.';
    if (!form.lote_id && form.lote_id !== '') {
      return 'Informe o lote.';
    }
    if (!form.ref_id) return 'Selecione o produto ou dieta.';
    if (Number(form.quantidade || 0) <= 0) return 'Informe a quantidade consumida.';
    return null;
  }

  function salvar() {
    const erroValidacao = validar();
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    if (!previewSelection.produto) {
      setErro(previewSelection.origem === 'dieta'
        ? 'A dieta vinculada não possui produto nutricional válido.'
        : 'O produto selecionado não foi encontrado.');
      return;
    }

    const sameProduct = Boolean(
      initialData?.id
      && currentSelection.produto
      && previewSelection.produto
      && Number(currentSelection.produto.id) === Number(previewSelection.produto.id)
    );
    const saldoDisponivel = Number(previewSelection.produto.quantidade_atual || 0) + (sameProduct ? Number(initialData?.qtd_total || 0) : 0);
    const quantidadeConsumida = Number(form.quantidade || 0);
    if (quantidadeConsumida > saldoDisponivel && !window.confirm('Consumo maior que estoque disponível. Deseja continuar com saldo negativo?')) {
      return;
    }

    const payloadBase = {
      data: form.data,
      lote_id: form.lote_id ? Number(form.lote_id) : null,
      origem_tipo: previewSelection.origem,
      ref_id: previewSelection.refId,
      quantidade: quantidadeConsumida,
      unidade: form.unidade || previewSelection.unidadePadrao || 'kg',
      obs: form.obs || '',
    };

    setDb((prev) => {
      const existingRecord = initialData
        || (prev.consumo_suplementacao || []).find((item) => Number(item.id) === Number(initialData?.id))
        || null;

      if (existingRecord) {
        const result = applyConsumptionChange(prev, existingRecord, payloadBase);
        return {
          ...prev,
          estoque: result.estoqueAtualizado,
          consumo_suplementacao: (prev.consumo_suplementacao || []).map((item) => (
            Number(item.id) === Number(existingRecord.id) ? result.consumoAtualizado : item
          )),
          movimentacoes_financeiras: result.movimentacoesFinanceirasAtualizadas,
        };
      }

      const consumoId = gerarNovoId(prev.consumo_suplementacao || []);
      const novoConsumo = {
        id: consumoId,
        data: payloadBase.data,
        lote_id: payloadBase.lote_id,
        origem_tipo: payloadBase.origem_tipo,
        item_estoque_id: previewSelection.produto?.id ?? null,
        dieta_id: previewSelection.dieta?.id ?? null,
        produto_nome: previewSelection.produto?.produto || null,
        dieta_nome: previewSelection.dieta?.nome || null,
        qtd_total: payloadBase.quantidade,
        unidade: payloadBase.unidade,
        custo_total: custoEstimado,
        obs: payloadBase.obs,
      };

      const estoqueAtualizado = (prev.estoque || []).map((item) => (
        Number(item.id) === Number(previewSelection.produto.id)
          ? { ...item, quantidade_atual: Number(item.quantidade_atual || 0) - payloadBase.quantidade }
          : item
      ));

      const movimentacoesFinanceiras = [
        ...(prev.movimentacoes_financeiras || []),
        {
          id: gerarNovoId(prev.movimentacoes_financeiras || []),
          tipo: 'despesa',
          categoria: 'nutricao',
          subcategoria: 'alimentacao',
          lote_id: payloadBase.lote_id,
          valor: custoEstimado,
          data: payloadBase.data,
          descricao: `Consumo nutricional - ${previewSelection.produto?.produto || previewSelection.dieta?.nome || 'Item'}`,
          origem_tipo: 'consumo_suplementacao',
          origem_id: consumoId,
        },
      ];

      return {
        ...prev,
        estoque: estoqueAtualizado,
        consumo_suplementacao: [...(prev.consumo_suplementacao || []), novoConsumo],
        movimentacoes_financeiras: movimentacoesFinanceiras,
      };
    });

    showToast({
      type: 'success',
      message: initialData ? 'Consumo atualizado com sucesso.' : 'Consumo registrado com baixa de estoque e custo financeiro.',
    });
    onClose();
  }

  const isEdit = Boolean(initialData?.id);

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Editar consumo diário' : 'Registrar consumo diário'}
      footer={<Button onClick={salvar}>{isEdit ? 'Salvar alterações' : 'Salvar consumo'}</Button>}
    >
      <div className="form-grid two">
        <Input label="Data" type="date" value={form.data} onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))} />
        <label className="ui-input-wrap">
          <span className="ui-input-label">Lote</span>
          <select className="ui-input" value={form.lote_id} onChange={(e) => setForm((p) => ({ ...p, lote_id: e.target.value }))}>
            <option value="">Sem lote</option>
            {(db.lotes || []).map((lote) => <option key={lote.id} value={lote.id}>{lote.nome}</option>)}
          </select>
        </label>
        <label className="ui-input-wrap">
          <span className="ui-input-label">Produto ou dieta</span>
          <select className="ui-input" value={form.origem} onChange={(e) => setForm((p) => ({ ...p, origem: e.target.value, ref_id: '' }))}>
            <option value="produto">Produto</option>
            <option value="dieta">Dieta</option>
          </select>
        </label>
        <label className="ui-input-wrap">
          <span className="ui-input-label">Seleção</span>
          <select className="ui-input" value={form.ref_id} onChange={(e) => setForm((p) => ({ ...p, ref_id: e.target.value }))}>
            <option value="">Selecione</option>
            {(form.origem === 'produto' ? getProdutosNutricionais(db) : getDietasNormalizadas(db)).map((item) => (
              <option key={item.id} value={item.id}>{item.produto || item.nome}</option>
            ))}
            {form.ref_id && !previewSelection.produto ? (
              <option value={form.ref_id}>
                {form.origem === 'produto' ? 'Produto vinculado não encontrado' : 'Dieta vinculada não encontrada'}
              </option>
            ) : null}
          </select>
        </label>
        <Input label="Quantidade consumida" type="number" value={form.quantidade} onChange={(e) => setForm((p) => ({ ...p, quantidade: e.target.value }))} />
        <label className="ui-input-wrap">
          <span className="ui-input-label">Unidade</span>
          <select className="ui-input" value={form.unidade} onChange={(e) => setForm((p) => ({ ...p, unidade: e.target.value }))}>
            <option>kg</option>
            <option>g</option>
            <option>litro</option>
            <option>unidade</option>
          </select>
        </label>
        <Input label="Observação" value={form.obs} onChange={(e) => setForm((p) => ({ ...p, obs: e.target.value }))} />
      </div>
      <p>
        Produto base:
        {' '}
        <strong>{previewSelection.produto?.produto || currentSelection.produto?.produto || '—'}</strong>
      </p>
      <p>
        Custo estimado:
        {' '}
        <strong>R$ {formatNumber(custoEstimado, 2)}</strong>
      </p>
      {erro ? <p style={{ margin: 0, color: 'var(--color-danger)', fontSize: '0.85rem' }}>{erro}</p> : null}
    </Modal>
  );
}
