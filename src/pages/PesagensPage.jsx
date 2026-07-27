import { useMemo, useState } from 'react';
import { AlertTriangle, Plus, Scale } from 'lucide-react';
import PesagemForm from '../components/PesagemForm';
import PesoChart from '../components/PesoChart';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/EmptyState';
import { formatarNumero, formatarData } from '../utils/formatters';
import { calcularGmdLote, gmdMedioDosLotes } from '../domain/gmd.js';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../auth/useAuth';
import { daysBetween, toDateKey } from '../domain/calcHelpers.js';
import { isModoConsolidado, construirMapaFazendas } from '../domain/escopoFazenda';
import {
  resolveTipoPesagem,
  calcularPesoMedioIndividual,
} from '../domain/pesagensLote.js';
import {
  registrarPesagemIndividualTransacional,
  excluirPesagemIndividualTransacional,
} from '../services/pesagemIndividualTransacional.js';
import '../styles/pesagens.css';

function normalizeIdKey(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function idsMatch(left, right) {
  const leftKey = normalizeIdKey(left);
  const rightKey = normalizeIdKey(right);
  return Boolean(leftKey && rightKey && leftKey === rightKey);
}

export default function PesagensPage({ db, setDb, onConfirmAction, navigationIntent = null, onNavigate, fazendaSelecionada = null }) {
  const { hasPermission, session, user } = useAuth();
  const { showToast } = useToast();
  const mensagemSemPermissao = 'Você não tem permissão para executar esta ação.';

  const shouldStartWithNewPesagem = navigationIntent?.page === 'pesagens' && navigationIntent?.action === 'novo';
  const [abrirForm, setAbrirForm] = useState(shouldStartWithNewPesagem);
  // Sprint Visual 6: quando a ação "Registrar pesagem" vem de Lotes
  // (navigationIntent.loteId), o lote já chega pré-selecionado no formulário
  // — mesmo fluxo/validações de sempre, só evita o pecuarista escolher de
  // novo um lote que ele já tinha selecionado na tela anterior.
  const [pesagemEditando, setPesagemEditando] = useState(() => (
    shouldStartWithNewPesagem && navigationIntent?.loteId ? { lote_id: navigationIntent.loteId } : null
  ));
  const [resumoPesagem, setResumoPesagem] = useState(null);
  const [loteEvolucaoId, setLoteEvolucaoId] = useState('');
  const [detalhesAbertos, setDetalhesAbertos] = useState(() => new Set());

  function alternarDetalhes(id) {
    setDetalhesAbertos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const lotes = db?.lotes;
  const animais = db?.animais;
  const pesagens = db?.pesagens;
  const consolidado = isModoConsolidado(fazendaSelecionada);
  const fazendasMap = useMemo(() => construirMapaFazendas(db), [db]);

  const lotesMap = useMemo(() => {
    const map = new Map();
    (lotes || []).forEach((lote) => map.set(Number(lote.id), lote));
    return map;
  }, [lotes]);

  const animaisMap = useMemo(() => {
    const map = new Map();
    (animais || []).forEach((animal) => {
      const idKey = normalizeIdKey(animal?.id);
      const cloudKey = normalizeIdKey(animal?.cloud_id);
      const localKey = normalizeIdKey(animal?.metadata?.local_id);
      if (idKey) map.set(`id:${idKey}`, animal);
      if (cloudKey) map.set(`cloud:${cloudKey}`, animal);
      if (localKey) map.set(`local:${localKey}`, animal);
    });
    return map;
  }, [animais]);

  // Sprint Funcional 15: o Histórico mostra um evento de pesagem por linha
  // (tipo:'lote' — a média oficial), nunca um peso individual isolado. Pesos
  // por cabeça ficam disponíveis em "Ver detalhes" de cada linha. Dados de
  // antes desta sprint que só têm pesagens individuais (sem evento agregado
  // vinculado) são preservados como uma linha sintética por lote+data, para
  // que o histórico nunca "perca" um registro já existente.
  const dadosTabela = useMemo(() => {
    const todasPesagens = [...(pesagens || [])]
      .map((pesagem) => ({ ...pesagem, data: toDateKey(pesagem?.data) }))
      .filter((pesagem) => pesagem.data);

    const eventosLote = todasPesagens.filter((p) => resolveTipoPesagem(p) === 'lote');
    const individuaisPorLoteData = new Map();
    const individuaisPorPesagemPrincipal = new Map();
    todasPesagens.forEach((p) => {
      if (resolveTipoPesagem(p) !== 'animal') return;
      const chaveLoteData = `${Number(p.lote_id)}|${p.data}`;
      if (!individuaisPorLoteData.has(chaveLoteData)) individuaisPorLoteData.set(chaveLoteData, []);
      individuaisPorLoteData.get(chaveLoteData).push(p);

      const principalId = normalizeIdKey(p?.metadata?.pesagem_principal_id);
      if (principalId) {
        if (!individuaisPorPesagemPrincipal.has(principalId)) individuaisPorPesagemPrincipal.set(principalId, []);
        individuaisPorPesagemPrincipal.get(principalId).push(p);
      }
    });

    const chavesLoteDataComEvento = new Set(eventosLote.map((p) => `${Number(p.lote_id)}|${p.data}`));
    const eventosOrfaos = [];
    individuaisPorLoteData.forEach((individuais, chave) => {
      if (chavesLoteDataComEvento.has(chave)) return;
      const [loteIdStr, data] = chave.split('|');
      const { soma, quantidade, media } = calcularPesoMedioIndividual(individuais.map((p) => p.peso_medio));
      if (quantidade === 0) return;
      eventosOrfaos.push({
        id: `orfao-${chave}`,
        lote_id: Number(loteIdStr),
        data,
        peso_medio: media,
        observacao: null,
        metadata: { quantidade_efetiva: quantidade, soma_pesos: soma, origem_calculo: 'pesagem_individual_legado' },
        _orfao: true,
      });
    });

    const todosEventos = [...eventosLote, ...eventosOrfaos];

    const eventosPorLote = new Map();
    todosEventos.forEach((evento) => {
      const loteId = Number(evento.lote_id);
      if (!eventosPorLote.has(loteId)) eventosPorLote.set(loteId, []);
      eventosPorLote.get(loteId).push(evento);
    });

    const variacaoPorEvento = new Map();
    eventosPorLote.forEach((eventosDoLote) => {
      eventosDoLote.sort((a, b) => a.data.localeCompare(b.data));
      for (let i = 0; i < eventosDoLote.length; i += 1) {
        const atual = eventosDoLote[i];
        const anterior = i > 0 ? eventosDoLote[i - 1] : null;
        const variacao = anterior ? Number(atual.peso_medio) - Number(anterior.peso_medio) : null;
        variacaoPorEvento.set(atual.id, variacao);
      }
    });

    return todosEventos
      .map((evento) => {
        const loteDaPesagem = lotesMap.get(Number(evento.lote_id));
        const individuais = (
          individuaisPorPesagemPrincipal.get(normalizeIdKey(evento.id))
          || individuaisPorLoteData.get(`${Number(evento.lote_id)}|${evento.data}`)
          || []
        ).map((individual) => {
          const animalId = normalizeIdKey(individual?.animal_id);
          const cloudAnimalId = normalizeIdKey(individual?.metadata?.animal_cloud_id);
          const localAnimalId = normalizeIdKey(individual?.metadata?.animal_local_id);
          const animal = (
            (animalId ? animaisMap.get(`id:${animalId}`) : null)
            || (cloudAnimalId ? animaisMap.get(`cloud:${cloudAnimalId}`) : null)
            || (localAnimalId ? animaisMap.get(`local:${localAnimalId}`) : null)
            || null
          );
          const fallbackAnimalName = (
            individual?.metadata?.animal_identificacao
            || (individual?.metadata?.virtualIndex ? `Animal #${individual.metadata.virtualIndex}` : null)
            || (individual?.metadata?.index ? `Animal #${individual.metadata.index}` : null)
            || null
          );
          return {
            ...individual,
            animalNome: animal?.identificacao || animal?.nome || fallbackAnimalName || 'Animal',
          };
        });

        return {
          ...evento,
          tipo: 'lote',
          loteNome: loteDaPesagem?.nome || '—',
          fazendaNome: fazendasMap.get(Number(loteDaPesagem?.faz_id)) || 'Sem fazenda',
          cabecasLote: Number(evento?.metadata?.cabecas_totais_lote) || null,
          quantidadeEfetiva: (
            Number(evento?.metadata?.quantidade_efetiva)
            || Number(evento?.quantidade_pesada)
            || Number(evento?.metadata?.quantidade_pesada)
            || (individuais.length || null)
          ),
          somaPesos: Number(evento?.metadata?.soma_pesos) || null,
          individuais,
          variacao: variacaoPorEvento.get(evento.id) ?? null,
        };
      })
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [pesagens, lotesMap, animaisMap, fazendasMap]);

  const resumo = useMemo(() => {
    // "Total de pesagens" conta eventos de pesagem (um por lote+data), nunca
    // um peso individual isolado — cada linha do Histórico é um evento.
    const totalPesagens = dadosTabela.length;
    const lotesComPesagem = new Set();
    let ultimaData = '';
    let latestTimestamp = 0;
    let totalPesoMedio = 0;

    dadosTabela.forEach((evento) => {
      lotesComPesagem.add(evento.lote_id);
      totalPesoMedio += Number(evento.peso_medio || 0);
      const currentTimestamp = new Date(`${evento.data}T00:00:00`).getTime();
      if (currentTimestamp > latestTimestamp) {
        latestTimestamp = currentTimestamp;
        ultimaData = evento.data;
      }
    });

    // Fonte única (domain/gmd.js): GMD de vida por lote, média dos lotes com
    // dado suficiente. Lotes sem GMD calculável ficam de fora da média em vez
    // de entrar como 0 (o que puxava o indicador para baixo sem motivo real).
    const gmdMedio = gmdMedioDosLotes(lotes, pesagens || []);

    return {
      totalPesagens,
      lotesComPesagem: lotesComPesagem.size,
      ultimaData,
      pesoMedioGeral: totalPesagens ? totalPesoMedio / totalPesagens : 0,
      gmdMedio,
      gmdMedioDisponivel: Number.isFinite(gmdMedio),
    };
  }, [dadosTabela, pesagens, lotes]);

  // Evolução: gráfico + KPIs por lote (Sprint de unificação com
  // Acompanhamento de Peso — antes vivia numa página separada).
  const pesagensLoteEvolucao = useMemo(() => {
    if (!loteEvolucaoId) return [];
    return (pesagens || [])
      .filter((item) => resolveTipoPesagem(item) === 'lote' && Number(item?.lote_id) === Number(loteEvolucaoId))
      .map((item) => ({ ...item, data: toDateKey(item?.data) }))
      .filter((item) => item.data)
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [pesagens, loteEvolucaoId]);

  const resumoEvolucaoLote = useMemo(() => {
    const primeira = pesagensLoteEvolucao[0] || null;
    const ultima = pesagensLoteEvolucao.length > 1
      ? pesagensLoteEvolucao[pesagensLoteEvolucao.length - 1]
      : null;
    // Ganho/dias/GMD vêm da fonte única (domain/gmd.js) para bater com Lotes,
    // Resultados e Relatórios. A base é a ENTRADA do lote, então pode ser
    // anterior à primeira pesagem — por isso `baseOrigem` é exposto e a UI diz
    // de onde o cálculo partiu, em vez de deixar o número parecer inconsistente
    // com o card "Primeira pesagem" ao lado.
    const loteSelecionado = (lotes || []).find((item) => Number(item.id) === Number(loteEvolucaoId)) || null;
    const r = calcularGmdLote(loteSelecionado, pesagens || []);
    return {
      primeira,
      ultima,
      ganho: r.ganho,
      dias: r.dias,
      gmd: r.gmd,
      baseOrigem: r.base?.origem || null,
      baseData: r.base?.data || null,
    };
  }, [pesagensLoteEvolucao, lotes, loteEvolucaoId, pesagens]);

  const loteEvolucaoSelecionado = useMemo(
    () => (lotes || []).find((item) => Number(item.id) === Number(loteEvolucaoId)) || null,
    [lotes, loteEvolucaoId]
  );

  function abrirNovaPesagem() {
    if (!hasPermission('pesagens:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    setPesagemEditando(null);
    setAbaAtiva('nova');
  }

  function editarPesagem(item) {
    if (!hasPermission('pesagens:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    setPesagemEditando(item);
    setAbrirForm(true);
  }

  // `item` é uma linha de src/pages/PesagensPage.jsx::dadosTabela — um
  // evento de pesagem (tipo:'lote', real ou órfão sintetizado) com seus
  // pesos individuais já anexados em `item.individuais`. Linhas órfãs
  // (dados de antes desta sprint, sem `metadata.pesagem_principal_id`) nunca
  // chegam aqui — o botão fica desabilitado (ver `podeGerenciarEvento` no
  // render): não há como excluir com segurança um agrupamento que foi só
  // inferido por lote+data, sem risco de apagar peso de outro evento real
  // que por acaso caiu na mesma data.
  async function excluirPesagem(item) {
    if (!hasPermission('pesagens:excluir')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    if (item._orfao) return;

    const totalIndividuais = item.individuais?.length || 0;
    const mensagem = totalIndividuais
      ? `Deseja excluir esta pesagem e os ${totalIndividuais} peso(s) individual(is) vinculado(s)?`
      : 'Deseja excluir esta pesagem?';
    const confirmado = typeof onConfirmAction === 'function'
      ? await onConfirmAction({ title: 'Excluir pesagem', message: mensagem, tone: 'danger' })
      : window.confirm(mensagem);
    if (!confirmado) return;

    const resultado = await excluirPesagemIndividualTransacional(
      { pesagemPrincipalId: item.id },
      { session, userContext: { id: user?.id, email: user?.email } }
    );

    if (!resultado.ok) {
      showToast({ type: 'warning', message: resultado.erro || 'Não foi possível confirmar a exclusão agora.' });
      return;
    }

    setDb((prev) => resultado.aplicar(prev));
    showToast({ type: 'success', message: 'Pesagem excluída com sucesso!' });
  }

  // Revisão crítica pré-commit: toda a gravação (pesagem principal + pesos
  // individuais + animal virtual + recálculo do lote) passa por UMA ÚNICA
  // RPC transacional (registrar_pesagem_individual — ver
  // services/pesagemIndividualTransacional.js), não mais por várias chamadas
  // HTTP independentes. Nada no estado local muda antes da RPC confirmar.
  async function salvarPesagem(dados) {
    if (!hasPermission('pesagens:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }

    const registros = Array.isArray(dados?.registros) ? dados.registros : [];
    if (!registros.length) {
      showToast({ type: 'error', message: 'Nenhuma pesagem individual válida para salvar.' });
      return;
    }

    const loteId = Number(dados?.lote_id);
    const lote = (lotes || []).find((item) => Number(item?.id) === loteId);

    const resultado = await registrarPesagemIndividualTransacional(dados, {
      session,
      userContext: { id: user?.id, email: user?.email },
    });

    if (!resultado.ok) {
      showToast({ type: 'warning', message: resultado.erro || 'Não foi possível confirmar a pesagem agora.' });
      return;
    }

    setDb((prev) => resultado.aplicar(prev));

    const pesosSalvos = registros
      .map((registro) => Number(registro?.peso_medio))
      .filter((valor) => Number.isFinite(valor) && valor > 0);
    setResumoPesagem(pesosSalvos.length ? {
      loteNome: lote?.nome || '—',
      data: dados.data || null,
      totalPesados: resultado.quantidadeEfetiva,
      cabecasLote: Number(dados?.expectedHeadCount) || null,
      media: resultado.pesoMedio,
      maior: Math.max(...pesosSalvos),
      menor: Math.min(...pesosSalvos),
      variacao: Math.max(...pesosSalvos) - Math.min(...pesosSalvos),
    } : null);

    showToast({ type: 'success', message: 'Pesagem salva com sucesso.' });

    setAbrirForm(false);
    setPesagemEditando(null);
  }

  // Sprint 25: abrir direto no Histórico ao entrar pelo menu — só pula para
  // "Nova pesagem" quando o usuário veio de um atalho explícito (Ações
  // rápidas do Dashboard), nunca automaticamente.
  const [abaAtiva, setAbaAtiva] = useState(shouldStartWithNewPesagem ? 'nova' : 'historico');

  const alertas = useMemo(() => {
    const hoje = new Date();
    const diasSemPesagem = 30;
    const lotesSemPesagem = (lotes || []).filter((lote) => {
      const data = toDateKey(lote?.ultima_pesagem);
      if (!data) return true;
      return daysBetween(data, hoje.toISOString().slice(0, 10)) > diasSemPesagem;
    });
    const animaisSemPesagem = (animais || []).filter((animal) => !dadosTabela.some((evento) => (
      (evento.individuais || []).some((individual) => idsMatch(individual.animal_id, animal.id))
    )));
    return { lotesSemPesagem, animaisSemPesagem, diasSemPesagem };
  }, [lotes, animais, dadosTabela]);

  const contextoFazenda = consolidado ? 'Todas as fazendas' : (fazendaSelecionada?.nome || 'Nenhuma fazenda selecionada');

  return (
    <div className="page page--pesagens page--kpi-compact">
      <section className="animais-hero pesagens-hero pesagens-header">
        <div>
          <h1>Pesagens</h1>
          <p className="pesagens-header-context">
            {contextoFazenda}
            <span className="pesagens-header-context-dot" aria-hidden="true">·</span>
            {resumo.totalPesagens} {resumo.totalPesagens === 1 ? 'pesagem registrada' : 'pesagens registradas'}
          </p>
        </div>
        <div className="page-actions action-row">
          <Button
            icon={<Plus size={14} />}
            onClick={abrirNovaPesagem}
            disabled={!hasPermission('pesagens:editar')}
            title={!hasPermission('pesagens:editar') ? mensagemSemPermissao : undefined}
          >
            Cadastrar nova pesagem
          </Button>
        </div>
      </section>
      <div className="segmented-control tab-bar">
        <button type="button" className={`segment ${abaAtiva === 'nova' ? 'active' : ''}`} onClick={() => setAbaAtiva('nova')}>Nova pesagem</button>
        <button type="button" className={`segment ${abaAtiva === 'historico' ? 'active' : ''}`} onClick={() => setAbaAtiva('historico')}>Histórico</button>
        <button type="button" className={`segment ${abaAtiva === 'evolucao' ? 'active' : ''}`} onClick={() => setAbaAtiva('evolucao')}>Evolução</button>
        <button type="button" className={`segment ${abaAtiva === 'alertas' ? 'active' : ''}`} onClick={() => setAbaAtiva('alertas')}>Alertas</button>
      </div>

      <div className="dashboard-grid dashboard-grid--kpi-main">
        <div className="kpi-card kpi-card--compact">
          <div className="kpi-content">
            <div className="kpi-label">Última pesagem</div>
            <div className="kpi-value">{formatarData(resumo.ultimaData)}</div>
          </div>
        </div>
        <div className="kpi-card kpi-card--compact">
          <div className="kpi-content">
            <div className="kpi-label">Lotes sem pesagem recente</div>
            <div className={alertas.lotesSemPesagem.length > 0 ? 'kpi-val rd' : 'kpi-value'}>{alertas.lotesSemPesagem.length}</div>
          </div>
        </div>
        <div className="kpi-card kpi-card--compact">
          <div className="kpi-content">
            <div className="kpi-label">Total de pesagens</div>
            <div className="kpi-value">{resumo.totalPesagens}</div>
          </div>
        </div>
        <div className="kpi-card kpi-card--compact">
          <div className="kpi-content">
            <div className="kpi-label">GMD médio</div>
            {resumo.gmdMedioDisponivel ? (
              <div className="kpi-value">{formatarNumero(resumo.gmdMedio, 3)} kg/dia</div>
            ) : (
              <div className="kpi-hint" style={{ fontSize: '0.95rem', marginTop: 4 }}>Sem dados suficientes</div>
            )}
          </div>
        </div>
      </div>

      {resumoPesagem ? (
        <Card title="Resumo da pesagem" subtitle={`${resumoPesagem.loteNome} · ${formatarData(resumoPesagem.data)}`}>
          <div className="peso-summary-grid">
            <div className="peso-summary-card"><div className="peso-summary-value">{resumoPesagem.totalPesados}{resumoPesagem.cabecasLote ? ` de ${resumoPesagem.cabecasLote}` : ''}</div><div className="peso-summary-label">Cabeças pesadas</div></div>
            <div className="peso-summary-card"><div className="peso-summary-value">{formatarNumero(resumoPesagem.media)}</div><div className="peso-summary-label">Peso médio oficial</div></div>
            <div className="peso-summary-card"><div className="peso-summary-value">{formatarNumero(resumoPesagem.maior)}</div><div className="peso-summary-label">Maior peso</div></div>
            <div className="peso-summary-card"><div className="peso-summary-value">{formatarNumero(resumoPesagem.menor)}</div><div className="peso-summary-label">Menor peso</div></div>
            <div className="peso-summary-card"><div className="peso-summary-value">{formatarNumero(resumoPesagem.variacao)}</div><div className="peso-summary-label">Variação entre maior e menor peso</div></div>
          </div>
        </Card>
      ) : null}

      {abaAtiva === 'nova' && (lotes || []).length === 0 && (
        <EmptyState
          title="Nenhum lote disponível para pesagem."
          subtitle="Cadastre um lote antes de registrar pesagens."
          action={onNavigate ? <Button size="sm" onClick={() => onNavigate('lotes')}>Ir para Lotes</Button> : null}
        />
      )}

      {abaAtiva === 'historico' && (
        <div className="fazendas-card">
          {dadosTabela.length === 0 ? (
            <EmptyState
              title="Você ainda não registrou nenhuma pesagem."
              subtitle="Registre a primeira pesagem para acompanhar evolução, GMD e desempenho."
              action={<Button size="sm" onClick={abrirNovaPesagem}>Registrar pesagem</Button>}
            />
          ) : (
            <div className="pesagens-lista">
              {dadosTabela.map((item) => (
                <div key={item.id} className="pesagem-row">
                  <div className="pesagem-row-data">
                    <strong>{formatarData(item.data)}</strong>
                    <Badge variant={item.quantidadeEfetiva && item.cabecasLote && item.quantidadeEfetiva < item.cabecasLote ? 'warning' : 'neutral'}>
                      {item.quantidadeEfetiva ? `${item.quantidadeEfetiva}${item.cabecasLote ? ` de ${item.cabecasLote}` : ''} cabeça${item.quantidadeEfetiva === 1 ? '' : 's'}` : 'Sem detalhe individual'}
                    </Badge>
                  </div>

                  <div className="pesagem-row-main">
                    <div className="pesagem-row-lote">
                      <span className="pesagem-row-lote-nome">{item.loteNome}</span>
                      {consolidado ? <span className="pesagem-row-fazenda">{item.fazendaNome}</span> : null}
                    </div>
                  </div>

                  <div className="pesagem-row-peso">
                    <strong>{formatarNumero(item.peso_medio)} kg</strong>
                    {item.variacao !== null && item.variacao !== undefined ? (
                      <span className={`pesagem-row-variacao ${item.variacao >= 0 ? 'is-positive' : 'is-negative'}`}>
                        {item.variacao >= 0 ? '+' : ''}{formatarNumero(item.variacao)} kg
                      </span>
                    ) : null}
                  </div>

                  {item.observacao ? <p className="pesagem-row-obs">{item.observacao}</p> : null}

                  {item.individuais.length > 0 ? (
                    <div className="pesagem-row-detalhes-wrap">
                      <button type="button" className="action-btn" onClick={() => alternarDetalhes(item.id)}>
                        {detalhesAbertos.has(item.id) ? 'Ocultar pesos individuais' : `Ver detalhes (${item.individuais.length})`}
                      </button>
                      {detalhesAbertos.has(item.id) ? (
                        <ul className="pesagem-row-detalhes-lista">
                          {item.individuais.map((individual) => (
                            <li key={individual.id}>
                              <span>{individual.animalNome}</span>
                              <strong>{formatarNumero(individual.peso_medio)} kg</strong>
                            </li>
                          ))}
                          {item.cabecasLote && item.quantidadeEfetiva && item.cabecasLote > item.quantidadeEfetiva ? (
                            <li className="pesagem-row-detalhes-pendente">
                              {item.cabecasLote - item.quantidadeEfetiva} cabeça(s) não pesada(s) nesta data
                            </li>
                          ) : null}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}

                  {item._orfao ? (
                    <p className="pesagem-row-obs pesagem-row-orfao-aviso">
                      Registro anterior a esta versão do sistema, agrupado apenas por lote e data — edição e
                      exclusão ficam bloqueadas aqui para não arriscar misturar com outro evento real.
                    </p>
                  ) : null}

                  <div className="pesagem-row-actions row-actions row-actions--tight">
                    <button
                      className="action-btn"
                      onClick={() => editarPesagem(item)}
                      disabled={item._orfao || !hasPermission('pesagens:editar')}
                      title={item._orfao ? 'Registro legado sem pesagem principal — não pode ser editado aqui.' : undefined}
                    >
                      Editar
                    </button>
                    <button
                      className="action-btn action-btn-danger"
                      onClick={() => excluirPesagem(item)}
                      disabled={item._orfao || !hasPermission('pesagens:excluir')}
                      title={item._orfao ? 'Registro legado sem pesagem principal — não pode ser excluído aqui.' : undefined}
                    >
                      Cancelar registro
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {abaAtiva === 'evolucao' && (
        <div className="fazendas-card">
          <div className="form-grid two" style={{ marginBottom: 16 }}>
            <label className="ui-input-wrap">
              <span className="ui-input-label">Lote</span>
              <select className="ui-input" value={loteEvolucaoId} onChange={(e) => setLoteEvolucaoId(e.target.value)}>
                <option value="">Selecione um lote</option>
                {(lotes || []).map((lote) => <option key={lote.id} value={lote.id}>{lote.nome}</option>)}
              </select>
            </label>
          </div>

          {!loteEvolucaoId ? (
            <EmptyState
              title="Selecione um lote para ver a evolução de peso."
              subtitle="O gráfico compara o peso real com a meta de GMD do lote."
            />
          ) : pesagensLoteEvolucao.length < 2 ? (
            <EmptyState
              title="Sem dados suficientes para evolução."
              subtitle="Registre pelo menos duas pesagens deste lote para ver o gráfico e o GMD."
            />
          ) : (
            <>
              <div className="kpi-grid-3 kpi-grid-3--compact" style={{ marginBottom: 16 }}>
                <div className="kpi-card kpi-card--compact">
                  <div className="kpi-label">Primeira pesagem</div>
                  <div className="kpi-value">{formatarNumero(resumoEvolucaoLote.primeira?.peso_medio)} kg</div>
                  <div className="kpi-sub">{formatarData(resumoEvolucaoLote.primeira?.data)}</div>
                </div>
                <div className="kpi-card kpi-card--compact">
                  <div className="kpi-label">Última pesagem</div>
                  <div className="kpi-value">{formatarNumero(resumoEvolucaoLote.ultima?.peso_medio)} kg</div>
                  <div className="kpi-sub">{formatarData(resumoEvolucaoLote.ultima?.data)}</div>
                </div>
                <div className="kpi-card kpi-card--compact">
                  <div className="kpi-label">Ganho total</div>
                  <div className="kpi-value">
                    {resumoEvolucaoLote.ganho === null ? '—' : `${formatarNumero(resumoEvolucaoLote.ganho)} kg`}
                  </div>
                  <div className="kpi-sub">
                    {resumoEvolucaoLote.gmd === null
                      ? 'Sem dado suficiente para calcular o GMD'
                      : `${resumoEvolucaoLote.dias} dias · GMD ${formatarNumero(resumoEvolucaoLote.gmd, 3)} kg/dia · desde ${
                        resumoEvolucaoLote.baseOrigem === 'entrada_lote' ? 'a entrada do lote' : 'a 1ª pesagem'
                      }`}
                  </div>
                </div>
              </div>
              <PesoChart data={pesagensLoteEvolucao} metaGmd={loteEvolucaoSelecionado?.gmd_meta || 0} />
            </>
          )}
        </div>
      )}
      {abaAtiva === 'alertas' && (
        <div className="fazendas-card">
          {alertas.lotesSemPesagem.length === 0 && alertas.animaisSemPesagem.length === 0 ? (
            <EmptyState
              tone="success"
              title="Nenhum alerta de pesagem no momento."
              subtitle="Todos os lotes e animais têm pesagem recente registrada."
            />
          ) : (
            <div className="pesagens-alertas-grid">
              {alertas.lotesSemPesagem.length > 0 ? (
                <div className="pesagens-alerta-card">
                  <div className="pesagens-alerta-head">
                    <AlertTriangle size={16} aria-hidden="true" />
                    <strong>{alertas.lotesSemPesagem.length} {alertas.lotesSemPesagem.length === 1 ? 'lote' : 'lotes'} sem pesagem há mais de {alertas.diasSemPesagem} dias</strong>
                  </div>
                  <p className="pesagens-alerta-lista">
                    {alertas.lotesSemPesagem.map((lote) => lote.nome).join(', ')}
                  </p>
                </div>
              ) : null}
              {alertas.animaisSemPesagem.length > 0 ? (
                <div className="pesagens-alerta-card">
                  <div className="pesagens-alerta-head">
                    <AlertTriangle size={16} aria-hidden="true" />
                    <strong>{alertas.animaisSemPesagem.length} {alertas.animaisSemPesagem.length === 1 ? 'animal' : 'animais'} sem pesagem recente</strong>
                  </div>
                </div>
              ) : null}
            </div>
          )}
          <Button size="sm" onClick={abrirNovaPesagem} disabled={!hasPermission('pesagens:editar')} style={{ marginTop: 14 }}>
            Registrar pesagem
          </Button>
        </div>
      )}

      {(abrirForm || (abaAtiva === 'nova' && (lotes || []).length > 0)) && (
        <PesagemForm
          initialData={pesagemEditando}
          lotes={lotes || []}
          animais={animais || []}
          pesagens={pesagens || []}
          onSave={salvarPesagem}
          onConfirmAction={onConfirmAction}
          onCancel={() => {
            // A Sprint 25 passou a renderizar o formulário sempre que
            // abaAtiva === 'nova' (não só quando abrirForm=true) — sem
            // também trocar de aba aqui, Cancelar fechava abrirForm mas o
            // modal reaparecia na hora pela outra condição, prendendo o
            // usuário no formulário.
            setAbrirForm(false);
            setPesagemEditando(null);
            setAbaAtiva('historico');
          }}
        />
      )}
    </div>
  );

}
