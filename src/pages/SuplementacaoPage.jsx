import { useCallback, useMemo, useState } from 'react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
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
    (i) => String(i?.categoria || '').toLowerCase().includes('nutrição')
      || String(i?.metadata?.modulo || '').toLowerCase() === 'nutricao',
  );
}

function getBadgeStatusProduto(produto) {
  const qtd = Number(produto?.quantidade_atual || 0);
  if (qtd <= 0) return { label: 'vencido', variant: 'danger' };
  if (qtd < 10) return { label: 'crítico', variant: 'warning' };
  return { label: 'ok', variant: 'success' };
}

export default function SuplementacaoPage({ db, setDb }) {
  const { showToast } = useToast();
  const { hasPermission } = useAuth();
  const [aba, setAba] = useState('produtos');
  const [openProduto, setOpenProduto] = useState(false);
  const [openDieta, setOpenDieta] = useState(false);
  const [openConsumo, setOpenConsumo] = useState(false);

  const lotesAtivos = useMemo(() => (db.lotes || []).filter((l) => l.status === 'ativo'), [db.lotes]);
  const produtos = useMemo(() => getProdutosNutricionais(db), [db]);
  const dietas = useMemo(() => getDietasNormalizadas(db), [db]);
  const consumo = useMemo(() => (db.consumo_suplementacao || []), [db]);

  const planejamento = useMemo(() => lotesAtivos.map((lote) => {
    const dieta = dietas.find((d) => Number(d.lote_id) === Number(lote.id));
    const cabecas = (db.animais || [])
      .filter((a) => Number(a.lote_id) === Number(lote.id))
      .reduce((s, a) => s + Number(a.qtd || 0), 0);

    const previsto = (dieta?.itens || []).reduce(
      (s, i) => s + Number(i.qtd_cab_dia || 0) * cabecas,
      0,
    );

    const realizados = consumo.filter((c) => Number(c.lote_id) === Number(lote.id));
    const realizado = realizados.length
      ? realizados.reduce((s, c) => s + Number(c.qtd_total || 0), 0) / realizados.length
      : 0;

    const custo = (dieta?.itens || []).reduce((acc, item) => {
      const produto = produtos.find((p) => Number(p.id) === Number(item.item_estoque_id));
      return acc + (Number(item.qtd_cab_dia || 0) * cabecas * Number(produto?.valor_unitario || 0));
    }, 0);

    return {
      lote,
      cabecas,
      dieta,
      previsto,
      realizado,
      diff: realizado - previsto,
      custo,
    };
  }), [lotesAtivos, dietas, db.animais, consumo, produtos]);

  const kpis = useMemo(() => {
    const totalProdutos = produtos.length;
    const totalDietas = dietas.length;
    const totalConsumo = consumo.length;
    const custoTotal = consumo.reduce((acc, item) => acc + Number(item?.custo_total || 0), 0);
    return {
      totalProdutos,
      totalDietas,
      totalConsumo,
      custoTotal,
    };
  }, [produtos, dietas, consumo]);

  return (
    <div className="page suplementacao-page page--suplementacao">
      <header className="page-header">
        <div>
          <h1>Nutrição / Suplementação</h1>
          <p>Produtos nutricionais, dietas e consumo diário com visual mais claro e responsivo.</p>
        </div>
        <div className="page-actions">
          <Button onClick={() => setOpenProduto(true)} disabled={!hasPermission('estoque:editar')}>
            Cadastrar produto nutricional
          </Button>
          <Button variant="outline" onClick={() => setOpenConsumo(true)} disabled={!hasPermission('estoque:editar')}>
            Registrar consumo
          </Button>
        </div>
      </header>

      <section className="dashboard-grid dashboard-grid--kpi-main suplementacao-kpi-grid">
        <Card className="kpi-card" title="Produtos nutricionais">{kpis.totalProdutos}</Card>
        <Card className="kpi-card" title="Dietas cadastradas">{kpis.totalDietas}</Card>
        <Card className="kpi-card" title="Registros de consumo">{kpis.totalConsumo}</Card>
        <Card className="kpi-card" title="Custo registrado">R$ {formatNumber(kpis.custoTotal, 2)}</Card>
      </section>

      <div className="segmented-control tab-bar">
        <button className={`segment ${aba === 'produtos' ? 'active' : ''}`} onClick={() => setAba('produtos')} type="button">Produtos nutricionais</button>
        <button className={`segment ${aba === 'dietas' ? 'active' : ''}`} onClick={() => setAba('dietas')} type="button">Dietas</button>
        <button className={`segment ${aba === 'consumo' ? 'active' : ''}`} onClick={() => setAba('consumo')} type="button">Consumo diário</button>
        <button className={`segment ${aba === 'planejamento' ? 'active' : ''}`} onClick={() => setAba('planejamento')} type="button">Planejamento por lote</button>
        <button className={`segment ${aba === 'historico' ? 'active' : ''}`} onClick={() => setAba('historico')} type="button">Histórico</button>
      </div>

      {aba === 'produtos' && (
        <Card title="Produtos nutricionais" subtitle="Cadastre rações, suplementos e insumos alimentares para controle de estoque e custo.">
          <div className="responsive-table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th>Estoque</th>
                  <th>Unidade</th>
                  <th>Custo unitário</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {produtos.length > 0 ? produtos.map((p) => {
                  const status = getBadgeStatusProduto(p);
                  return (
                    <tr key={p.id}>
                      <td>{p.produto}</td>
                      <td>{p.subcategoria || 'Nutrição'}</td>
                      <td>{formatNumber(p.quantidade_atual || 0, 2)}</td>
                      <td>{p.unidade_medida || p.unidade || 'kg'}</td>
                      <td>R$ {formatNumber(p.valor_unitario || 0, 2)}</td>
                      <td><Badge variant={status.variant}>{status.label}</Badge></td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">
                        <strong>Nenhum produto nutricional cadastrado.</strong>
                        <span>Cadastre rações, suplementos, sal mineral ou dietas para vincular ao estoque.</span>
                        <Button size="sm" onClick={() => setOpenProduto(true)}>Cadastrar produto nutricional</Button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {aba === 'dietas' && (
        <Card
          title="Dietas"
          subtitle="Organize dietas por lote com consumo padrão para planejamento diário."
          action={<Button size="sm" onClick={() => setOpenDieta(true)}>Criar dieta</Button>}
        >
          <div className="responsive-table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Lote</th>
                  <th>Tipo de consumo</th>
                  <th>Consumo padrão</th>
                </tr>
              </thead>
              <tbody>
                {dietas.length > 0 ? dietas.map((d) => (
                  <tr key={d.id}>
                    <td>{d.nome}</td>
                    <td>{(db.lotes || []).find((l) => Number(l.id) === Number(d.lote_id))?.nome || 'Sem lote'}</td>
                    <td>{d.tipo_consumo || 'kg/cabeça/dia'}</td>
                    <td>{formatNumber((d.itens || [])[0]?.qtd_cab_dia || 0, 3)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4}>
                      <div className="empty-state">
                        <strong>Nenhuma dieta cadastrada.</strong>
                        <span>Crie dietas para vincular lotes e padronizar consumo nutricional.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {aba === 'consumo' && (
        <Card title="Consumo diário" subtitle="Registre consumo por lote e acompanhe impacto em estoque e custo.">
          <div className="action-row">
            <Button onClick={() => setOpenConsumo(true)}>Registrar consumo diário</Button>
          </div>
        </Card>
      )}

      {aba === 'planejamento' && (
        <Card title="Planejamento por lote" subtitle="Compare consumo previsto e realizado para ajustes operacionais.">
          <div className="responsive-table-wrap">
            <table className="dashboard-table">
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
                {planejamento.length > 0 ? planejamento.map((r) => (
                  <tr key={r.lote.id}>
                    <td>{r.lote.nome}</td>
                    <td>{r.cabecas}</td>
                    <td>{r.dieta?.nome || 'Sem dieta'}</td>
                    <td>{formatNumber(r.previsto, 2)} kg</td>
                    <td>{formatNumber(r.realizado, 2)} kg</td>
                    <td>{formatNumber(r.diff, 2)} kg</td>
                    <td>R$ {formatNumber(r.custo, 2)}</td>
                    <td>
                      <button className="action-btn" onClick={() => setOpenDieta(true)} type="button">
                        {r.dieta ? 'Vincular dieta' : 'Criar'}
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty-state">
                        <strong>Nenhum lote ativo para planejamento.</strong>
                        <span>Crie dietas e vincule aos lotes ativos para iniciar o acompanhamento.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {aba === 'historico' && (
        <Card title="Histórico" subtitle="Registros de consumo por lote, produto ou dieta.">
          <div className="responsive-table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Lote</th>
                  <th>Produto/Dieta</th>
                  <th>Quantidade</th>
                  <th>Custo</th>
                  <th>Responsável</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {consumo.length > 0 ? consumo.map((c) => (
                  <tr key={c.id}>
                    <td>{c.data}</td>
                    <td>{(db.lotes || []).find((l) => Number(l.id) === Number(c.lote_id))?.nome || '-'}</td>
                    <td>{c.produto_nome || c.dieta_nome || 'Consumo nutricional'}</td>
                    <td>{formatNumber(c.qtd_total || 0, 2)} {c.unidade || 'kg'}</td>
                    <td>R$ {formatNumber(c.custo_total || 0, 2)}</td>
                    <td>{c.responsavel || '-'}</td>
                    <td>{c.obs || '-'}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-state">
                        <strong>Nenhum consumo registrado.</strong>
                        <span>Registre o primeiro consumo para preencher o histórico do módulo.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {openProduto && <ProdutoNutricionalModal db={db} setDb={setDb} onClose={() => setOpenProduto(false)} showToast={showToast} />}
      {openDieta && <DietaModal db={db} setDb={setDb} onClose={() => setOpenDieta(false)} showToast={showToast} />}
      {openConsumo && <ConsumoModal db={db} setDb={setDb} onClose={() => setOpenConsumo(false)} showToast={showToast} />}
    </div>
  );
}

function ProdutoNutricionalModal({ db, setDb, onClose, showToast }) {
  const [form, setForm] = useState({
    produto: '',
    subcategoria: 'Ração',
    unidade_medida: 'kg',
    quantidade_embalagens: '',
    tipo_embalagem: 'saco',
    conteudo_por_embalagem: '',
    unidade_conteudo: 'kg',
    valor_unitario: '',
    fornecedor: '',
    validade: '',
    obs: '',
  });

  const totalEstoque = Number(form.quantidade_embalagens || 0) * Number(form.conteudo_por_embalagem || 0);
  const custoTotal = totalEstoque * Number(form.valor_unitario || 0);

  function salvar() {
    if (!form.produto.trim()) return;
    const existente = (db.estoque || [])
      .find((i) => String(i.produto || '').toLowerCase() === form.produto.trim().toLowerCase());

    setDb((prev) => ({
      ...prev,
      estoque: existente
        ? prev.estoque.map((item) => (
          Number(item.id) === Number(existente.id)
            ? {
                ...item,
                quantidade_atual: Number(item.quantidade_atual || 0) + totalEstoque,
                valor_unitario: Number(form.valor_unitario || item.valor_unitario || 0),
                categoria: 'Nutrição / Alimentação',
                subcategoria: form.subcategoria,
                fornecedor: form.fornecedor || item.fornecedor,
                validade: form.validade || item.validade,
                metadata: { ...(item.metadata || {}), modulo: 'nutricao' },
              }
            : item
        ))
        : [
            ...(prev.estoque || []),
            {
              id: gerarNovoId(prev.estoque || []),
              produto: form.produto.trim(),
              categoria: 'Nutrição / Alimentação',
              subcategoria: form.subcategoria,
              unidade_medida: form.unidade_medida,
              quantidade_atual: totalEstoque,
              valor_unitario: Number(form.valor_unitario || 0),
              fornecedor: form.fornecedor,
              validade: form.validade,
              obs: form.obs,
              metadata: {
                modulo: 'nutricao',
                tipo_embalagem: form.tipo_embalagem,
                conteudo_por_embalagem: Number(form.conteudo_por_embalagem || 0),
                unidade_conteudo: form.unidade_conteudo,
                custo_total: custoTotal,
              },
            },
          ],
    }));

    showToast({ type: 'success', message: existente ? 'Produto vinculado e estoque atualizado.' : 'Produto nutricional cadastrado.' });
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Cadastrar produto nutricional"
      footer={<Button onClick={salvar}>Salvar produto</Button>}
      size="lg"
    >
      <div className="form-grid two">
        <Input label="Nome do produto" value={form.produto} onChange={(e) => setForm((p) => ({ ...p, produto: e.target.value }))} />
        <label className="ui-input-wrap">
          <span className="ui-input-label">Categoria</span>
          <select className="ui-input" value={form.subcategoria} onChange={(e) => setForm((p) => ({ ...p, subcategoria: e.target.value }))}>
            {CATEGORIAS_NUTRICIONAIS.map((c) => <option key={c}>{c}</option>)}
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
      </div>
      <p>
        Total calculado: <strong>{formatNumber(totalEstoque, 2)} {form.unidade_conteudo}</strong>
        {' | '}
        Custo total: <strong>R$ {formatNumber(custoTotal, 2)}</strong>
      </p>
    </Modal>
  );
}

function DietaModal({ db, setDb, onClose, showToast }) {
  const produtos = getProdutosNutricionais(db);
  const lotes = (db.lotes || []).filter((l) => l.status === 'ativo');
  const [form, setForm] = useState({
    nome: '',
    lote_id: '',
    item_estoque_id: '',
    qtd_cab_dia: '',
    tipo_consumo: 'kg/cabeça/dia',
    obs: '',
  });

  function salvar() {
    if (!form.nome || !form.item_estoque_id) return;
    setDb((prev) => ({
      ...prev,
      dietas: [
        ...(prev.dietas || []),
        {
          id: gerarNovoId(prev.dietas || []),
          nome: form.nome,
          lote_id: Number(form.lote_id) || null,
          tipo_consumo: form.tipo_consumo,
          obs: form.obs,
          itens: [{
            item_estoque_id: Number(form.item_estoque_id),
            qtd_cab_dia: Number(form.qtd_cab_dia || 0),
          }],
        },
      ],
    }));
    showToast({ type: 'success', message: 'Dieta criada.' });
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Criar dieta" footer={<Button onClick={salvar}>Salvar dieta</Button>}>
      <div className="form-grid two">
        <Input label="Nome da dieta" value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} />
        <label className="ui-input-wrap">
          <span className="ui-input-label">Lote vinculado (opcional)</span>
          <select className="ui-input" value={form.lote_id} onChange={(e) => setForm((p) => ({ ...p, lote_id: e.target.value }))}>
            <option value="">Sem lote</option>
            {lotes.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        </label>
        <label className="ui-input-wrap">
          <span className="ui-input-label">Produto nutricional</span>
          <select className="ui-input" value={form.item_estoque_id} onChange={(e) => setForm((p) => ({ ...p, item_estoque_id: e.target.value }))}>
            <option value="">Selecione</option>
            {produtos.map((p) => <option key={p.id} value={p.id}>{p.produto}</option>)}
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
    </Modal>
  );
}

function ConsumoModal({ db, setDb, onClose, showToast }) {
  const lotes = (db.lotes || []).filter((l) => l.status === 'ativo');
  const produtos = getProdutosNutricionais(db);
  const dietas = getDietasNormalizadas(db);

  const [form, setForm] = useState({
    data: getTodayIso(),
    lote_id: '',
    origem: 'produto',
    ref_id: '',
    quantidade: '',
    unidade: 'kg',
    obs: '',
  });

  const custoEstimado = useMemo(() => {
    if (form.origem === 'produto') {
      const p = produtos.find((i) => Number(i.id) === Number(form.ref_id));
      return Number(form.quantidade || 0) * Number(p?.valor_unitario || 0);
    }

    const d = dietas.find((i) => Number(i.id) === Number(form.ref_id));
    const item = produtos.find((p) => Number(p.id) === Number((d?.itens || [])[0]?.item_estoque_id));
    return Number(form.quantidade || 0) * Number(item?.valor_unitario || 0);
  }, [form, produtos, dietas]);

  const submit = useCallback(() => {
    const produto = form.origem === 'produto' ? produtos.find((p) => Number(p.id) === Number(form.ref_id)) : null;
    const dieta = form.origem === 'dieta' ? dietas.find((d) => Number(d.id) === Number(form.ref_id)) : null;
    const produtoDaDieta = dieta ? produtos.find((p) => Number(p.id) === Number((dieta.itens || [])[0]?.item_estoque_id)) : null;
    const item = produto || produtoDaDieta;
    if (!item) return;

    const qtd = Number(form.quantidade || 0);
    const saldo = Number(item.quantidade_atual || 0);
    if (qtd > saldo && !window.confirm('Consumo maior que estoque disponível. Deseja continuar com saldo negativo?')) return;

    setDb((prev) => {
      const estoque = (prev.estoque || []).map((e) => (Number(e.id) === Number(item.id)
        ? { ...e, quantidade_atual: Number(e.quantidade_atual || 0) - qtd }
        : e));

      const consumoId = gerarNovoId(prev.consumo_suplementacao || []);
      const movFinId = gerarNovoId(prev.movimentacoes_financeiras || []);

      return {
        ...prev,
        estoque,
        consumo_suplementacao: [
          ...(prev.consumo_suplementacao || []),
          {
            id: consumoId,
            data: form.data,
            lote_id: Number(form.lote_id),
            produto_nome: item.produto,
            dieta_nome: dieta?.nome || null,
            qtd_total: qtd,
            unidade: form.unidade,
            custo_total: custoEstimado,
            obs: form.obs,
          },
        ],
        movimentacoes_financeiras: [
          ...(prev.movimentacoes_financeiras || []),
          {
            id: movFinId,
            tipo: 'despesa',
            categoria: 'nutricao',
            subcategoria: 'alimentacao',
            lote_id: Number(form.lote_id),
            valor: custoEstimado,
            data: form.data,
            descricao: `Consumo nutricional - ${item.produto}`,
            origem_tipo: 'consumo_suplementacao',
            origem_id: consumoId,
          },
        ],
      };
    });

    showToast({ type: 'success', message: 'Consumo registrado com baixa de estoque e custo financeiro.' });
    onClose();
  }, [form, produtos, dietas, setDb, showToast, onClose, custoEstimado]);

  return (
    <Modal open onClose={onClose} title="Registrar consumo diário" footer={<Button onClick={submit}>Salvar consumo</Button>}>
      <div className="form-grid two">
        <Input label="Data" type="date" value={form.data} onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))} />
        <label className="ui-input-wrap">
          <span className="ui-input-label">Lote</span>
          <select className="ui-input" value={form.lote_id} onChange={(e) => setForm((p) => ({ ...p, lote_id: e.target.value }))}>
            <option value="">Selecione</option>
            {lotes.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
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
            {(form.origem === 'produto' ? produtos : dietas).map((i) => <option key={i.id} value={i.id}>{i.produto || i.nome}</option>)}
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
      <p>Custo estimado: <strong>R$ {formatNumber(custoEstimado, 2)}</strong></p>
    </Modal>
  );
}
