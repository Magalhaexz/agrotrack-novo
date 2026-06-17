import { useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../auth/useAuth';
import { useToast } from '../hooks/useToast';
import { gerarNovoId } from '../utils/id';
import { calcularProjecaoCenario } from '../domain/simuladorCenarios';
import { calcularCenarioPecuaria } from '../domain/projecaoCenario';
import {
  createOperationalRecord,
  updateOperationalRecord,
} from '../services/operationalPersistence';

function nowDate() {
  return new Date().toISOString().slice(0, 10);
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value, digits = 2, suffix = '') {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Sem dados suficientes';
  return `${number.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}${suffix}`;
}

function formatCurrency(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Sem dados suficientes';
  return `R$ ${number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function emptyScenario() {
  const inicio = nowDate();
  return {
    nome: '',
    periodo_inicio: inicio,
    periodo_fim: inicio,
    observacoes: '',
    status: 'rascunho',
    compras_simuladas: 0,
    vendas_simuladas: 0,
    mortalidade_pct: 0,
    natalidade_pct: 0,
    valor_medio_venda: 0,
    custo_medio_compra: 0,
    capacidade_suporte_ua: 0,
    area_pastagem_ha: 0,
  };
}

function emptyDecisao() {
  return {
    cabecas: 100,
    pesoInicialKg: 300,
    precoCompraArroba: 200,
    rendimentoCarcaca: 52,
    diasConfinamento: 90,
    gmdKgDia: 1.2,
    custoDiarioCabeca: 15,
    precoVendaArroba: 270,
    custoFrete: 0,
    outrosCustos: 0,
  };
}

export default function CenariosPage({ db, setDb, session }) {
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState(emptyScenario());
  const [editando, setEditando] = useState(null);
  const [cenarioSelecionadoId, setCenarioSelecionadoId] = useState(null);
  const [decisao, setDecisao] = useState(emptyDecisao());

  const mensagemSemPermissao = 'Você não tem permissão para executar esta ação.';
  const cenarios = useMemo(() => (Array.isArray(db?.cenarios) ? db.cenarios : []), [db]);
  const cenarioSelecionado = useMemo(
    () => cenarios.find((item) => Number(item.id) === Number(cenarioSelecionadoId)) || null,
    [cenarios, cenarioSelecionadoId]
  );

  const comparativo = useMemo(() => {
    const base = cenarioSelecionado || form;
    return calcularProjecaoCenario(
      db,
      String(base?.periodo_inicio || nowDate()),
      String(base?.periodo_fim || nowDate()),
      base
    );
  }, [db, cenarioSelecionado, form]);

  function resetForm() {
    setForm(emptyScenario());
    setEditando(null);
  }

  function preencherForm(cenario) {
    setForm({
      nome: cenario?.nome || '',
      periodo_inicio: cenario?.periodo_inicio || nowDate(),
      periodo_fim: cenario?.periodo_fim || nowDate(),
      observacoes: cenario?.observacoes || '',
      status: cenario?.status || 'rascunho',
      compras_simuladas: toNumber(cenario?.compras_simuladas),
      vendas_simuladas: toNumber(cenario?.vendas_simuladas),
      mortalidade_pct: toNumber(cenario?.mortalidade_pct),
      natalidade_pct: toNumber(cenario?.natalidade_pct),
      valor_medio_venda: toNumber(cenario?.valor_medio_venda),
      custo_medio_compra: toNumber(cenario?.custo_medio_compra),
      capacidade_suporte_ua: toNumber(cenario?.capacidade_suporte_ua),
      area_pastagem_ha: toNumber(cenario?.area_pastagem_ha),
    });
    setEditando(cenario);
  }

  async function salvarCenario() {
    if (!hasPermission('cenarios:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    if (!String(form.nome || '').trim()) {
      showToast({ type: 'warning', message: 'Informe o nome do cenário.' });
      return;
    }

    const payload = {
      ...form,
      nome: String(form.nome || '').trim(),
      periodo_inicio: String(form.periodo_inicio || nowDate()),
      periodo_fim: String(form.periodo_fim || nowDate()),
      observacoes: String(form.observacoes || '').trim(),
      status: String(form.status || 'rascunho'),
      compras_simuladas: toNumber(form.compras_simuladas),
      vendas_simuladas: toNumber(form.vendas_simuladas),
      mortalidade_pct: toNumber(form.mortalidade_pct),
      natalidade_pct: toNumber(form.natalidade_pct),
      valor_medio_venda: toNumber(form.valor_medio_venda),
      custo_medio_compra: toNumber(form.custo_medio_compra),
      capacidade_suporte_ua: toNumber(form.capacidade_suporte_ua),
      area_pastagem_ha: toNumber(form.area_pastagem_ha),
    };

    if (editando) {
      const persisted = await updateOperationalRecord('cenarios', editando.id, payload, session);
      setDb((prev) => ({
        ...prev,
        cenarios: (prev.cenarios || []).map((item) => (
          item.id === editando.id ? { ...item, ...(persisted.data || payload) } : item
        )),
      }));
      showToast({ type: 'success', message: 'Cenário atualizado.' });
      setCenarioSelecionadoId(editando.id);
    } else {
      const persisted = await createOperationalRecord('cenarios', payload, session);
      const novo = persisted.data || { id: gerarNovoId(cenarios), ...payload };
      setDb((prev) => ({
        ...prev,
        cenarios: [...(prev.cenarios || []), novo],
      }));
      showToast({ type: 'success', message: 'Cenário criado.' });
      setCenarioSelecionadoId(novo.id);
    }
    resetForm();
  }

  async function arquivarCenario(cenario) {
    if (!hasPermission('cenarios:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    const patch = { status: 'arquivado' };
    const persisted = await updateOperationalRecord('cenarios', cenario.id, patch, session);
    setDb((prev) => ({
      ...prev,
      cenarios: (prev.cenarios || []).map((item) => (
        item.id === cenario.id ? { ...item, ...(persisted.data || patch) } : item
      )),
    }));
    showToast({ type: 'success', message: 'Cenário arquivado.' });
  }

  const resultadoDecisao = useMemo(() => calcularCenarioPecuaria(decisao), [decisao]);

  const p = comparativo?.projecao || {};
  const b = comparativo?.baseline || {};

  return (
    <div className="page">
      <PageHeader title="Simulador de Decisão" subtitle="Simule compra, manutenção ou venda de lote sem alterar dados operacionais." />

      <Card title={editando ? 'Editar cenário' : 'Novo cenário'}>
        <div className="form-grid two">
          <Input className="full" label="Nome do cenário" value={form.nome} onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))} />
          <Input label="Período inicial" type="date" value={form.periodo_inicio} onChange={(e) => setForm((prev) => ({ ...prev, periodo_inicio: e.target.value }))} />
          <Input label="Período final" type="date" value={form.periodo_fim} onChange={(e) => setForm((prev) => ({ ...prev, periodo_fim: e.target.value }))} />
          <Input as="select" label="Status" value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
            <option value="rascunho">Rascunho</option>
            <option value="ativo">Ativo</option>
            <option value="arquivado">Arquivado</option>
          </Input>
          <Input label="Compras de animais" type="number" value={form.compras_simuladas} onChange={(e) => setForm((prev) => ({ ...prev, compras_simuladas: e.target.value }))} />
          <Input label="Vendas de animais" type="number" value={form.vendas_simuladas} onChange={(e) => setForm((prev) => ({ ...prev, vendas_simuladas: e.target.value }))} />
          <Input label="Mortalidade, %" type="number" value={form.mortalidade_pct} onChange={(e) => setForm((prev) => ({ ...prev, mortalidade_pct: e.target.value }))} />
          <Input label="Natalidade, %" type="number" value={form.natalidade_pct} onChange={(e) => setForm((prev) => ({ ...prev, natalidade_pct: e.target.value }))} />
          <Input label="Valor médio de venda, R$" type="number" value={form.valor_medio_venda} onChange={(e) => setForm((prev) => ({ ...prev, valor_medio_venda: e.target.value }))} />
          <Input label="Custo médio de compra, R$" type="number" value={form.custo_medio_compra} onChange={(e) => setForm((prev) => ({ ...prev, custo_medio_compra: e.target.value }))} />
          <Input label="Capacidade de suporte, UA" type="number" value={form.capacidade_suporte_ua} onChange={(e) => setForm((prev) => ({ ...prev, capacidade_suporte_ua: e.target.value }))} />
          <Input label="Área de pastagem, ha" type="number" value={form.area_pastagem_ha} onChange={(e) => setForm((prev) => ({ ...prev, area_pastagem_ha: e.target.value }))} />
          <Input className="full" as="textarea" label="Observações" value={form.observacoes} onChange={(e) => setForm((prev) => ({ ...prev, observacoes: e.target.value }))} />
        </div>
        <div className="action-row" style={{ marginTop: 12 }}>
          <Button onClick={salvarCenario}>Salvar cenário</Button>
          {editando ? <Button variant="ghost" onClick={resetForm}>Cancelar edição</Button> : null}
        </div>
      </Card>

      <Card title="Cenários salvos">
        {!cenarios.length ? (
          <div className="empty-state">
            <strong>Nenhum cenário simulado ainda.</strong>
            <span>Crie um cenário para simular se vale a pena comprar, manter ou vender o lote.</span>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Período</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {cenarios.map((cenario) => (
                  <tr key={cenario.id}>
                    <td>{cenario.nome}</td>
                    <td>{cenario.periodo_inicio} até {cenario.periodo_fim}</td>
                    <td>{cenario.status || 'rascunho'}</td>
                    <td>
                      <div className="row-actions action-row">
                        <button type="button" className="action-btn" onClick={() => setCenarioSelecionadoId(cenario.id)}>Comparar</button>
                        <button type="button" className="action-btn" onClick={() => preencherForm(cenario)}>Editar</button>
                        {String(cenario.status) !== 'arquivado' ? (
                          <button type="button" className="action-btn action-btn-danger" onClick={() => arquivarCenario(cenario)}>Arquivar</button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Comparativo: baseline x projetado">
        <div className="metrics-2col">
          <p>Estoque atual: <strong>{formatNumber(b.estoque_atual, 2)}</strong></p>
          <p>Estoque final projetado: <strong>{formatNumber(p.estoque_final_projetado, 2)}</strong></p>
          <p>Variação do rebanho: <strong>{formatNumber(p.variacao_rebanho, 2)}</strong></p>
          <p>Receita projetada: <strong>{formatCurrency(p.receita_projetada)}</strong></p>
          <p>Custo projetado: <strong>{formatCurrency(p.custo_projetado)}</strong></p>
          <p>Margem bruta projetada: <strong>{formatCurrency(p.margem_bruta_projetada)}</strong></p>
          <p>UA projetada: <strong>{formatNumber(p.ua_projetada, 2)}</strong></p>
          <p>Saldo de capacidade, UA: <strong>{formatNumber(p.saldo_ua_projetado, 2)}</strong></p>
          <p>Status: <strong>{p.status_capacidade === 'superlotado' ? 'Superlotado' : p.status_capacidade === 'dentro_da_capacidade' ? 'Dentro da capacidade' : 'Sem dados suficientes'}</strong></p>
        </div>
      </Card>

      <Card title="Decisão: vale a pena comprar este lote?">
        <div className="form-grid two">
          <Input label="Cabeças" type="number" value={decisao.cabecas} onChange={(e) => setDecisao((prev) => ({ ...prev, cabecas: e.target.value }))} />
          <Input label="Peso inicial, kg" type="number" value={decisao.pesoInicialKg} onChange={(e) => setDecisao((prev) => ({ ...prev, pesoInicialKg: e.target.value }))} />
          <Input label="Preço de compra, R$/@" type="number" value={decisao.precoCompraArroba} onChange={(e) => setDecisao((prev) => ({ ...prev, precoCompraArroba: e.target.value }))} />
          <Input label="Rendimento de carcaça, %" type="number" value={decisao.rendimentoCarcaca} onChange={(e) => setDecisao((prev) => ({ ...prev, rendimentoCarcaca: e.target.value }))} />
          <Input label="Dias de confinamento" type="number" value={decisao.diasConfinamento} onChange={(e) => setDecisao((prev) => ({ ...prev, diasConfinamento: e.target.value }))} />
          <Input label="GMD esperado, kg/dia" type="number" value={decisao.gmdKgDia} onChange={(e) => setDecisao((prev) => ({ ...prev, gmdKgDia: e.target.value }))} />
          <Input label="Custo diário/cabeça, R$" type="number" value={decisao.custoDiarioCabeca} onChange={(e) => setDecisao((prev) => ({ ...prev, custoDiarioCabeca: e.target.value }))} />
          <Input label="Preço de venda, R$/@ carcaça" type="number" value={decisao.precoVendaArroba} onChange={(e) => setDecisao((prev) => ({ ...prev, precoVendaArroba: e.target.value }))} />
          <Input label="Custo de frete, R$" type="number" value={decisao.custoFrete} onChange={(e) => setDecisao((prev) => ({ ...prev, custoFrete: e.target.value }))} />
          <Input label="Outros custos fixos, R$" type="number" value={decisao.outrosCustos} onChange={(e) => setDecisao((prev) => ({ ...prev, outrosCustos: e.target.value }))} />
        </div>
        <div className="metrics-2col" style={{ marginTop: 16 }}>
          <p>Peso final esperado: <strong>{formatNumber(resultadoDecisao.pesoFinalKg, 1)} kg</strong></p>
          <p>Arrobas carcaça compra: <strong>{formatNumber(resultadoDecisao.arrobasCarcacaCompra, 2)} @/cab</strong></p>
          <p>Arrobas carcaça venda: <strong>{formatNumber(resultadoDecisao.arrobasCarcacaVenda, 2)} @/cab</strong></p>
          <p>Custo de compra: <strong>{formatCurrency(resultadoDecisao.custoCompra)}</strong></p>
          <p>Custo diário total: <strong>{formatCurrency(resultadoDecisao.custoDiario)}</strong></p>
          <p>Custo total: <strong>{formatCurrency(resultadoDecisao.custoTotal)}</strong></p>
          <p>Receita projetada: <strong>{formatCurrency(resultadoDecisao.receitaProjetada)}</strong></p>
          <p>Margem bruta: <strong>{formatCurrency(resultadoDecisao.margemBruta)}</strong></p>
          <p>Lucro/@ carcaça: <strong>{formatCurrency(resultadoDecisao.lucroPorArroba)}</strong></p>
          <p>Lucro/cabeça: <strong>{formatCurrency(resultadoDecisao.lucroPorCabeca)}</strong></p>
          <p>ROI: <strong>{formatNumber(resultadoDecisao.roiPct, 2)} %</strong></p>
          <p>Break-even de venda: <strong>{formatCurrency(resultadoDecisao.breakEvenArroba)} /@</strong></p>
          <p>Viável: <strong style={{ color: resultadoDecisao.viavel ? 'var(--color-success, #16a34a)' : 'var(--color-danger, #dc2626)' }}>
            {resultadoDecisao.viavel ? 'SIM' : 'NÃO'}
          </strong></p>
        </div>
      </Card>
    </div>
  );
}
