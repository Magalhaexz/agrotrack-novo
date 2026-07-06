import { Fragment, useMemo, useState, useCallback } from 'react';
import SanitarioForm from '../components/SanitarioForm';
import { formatarData } from '../utils/formatters';
import { gerarNovoId } from '../utils/id';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import { useToast } from '../hooks/useToast'; // Importar useToast
import { useAuth } from '../auth/useAuth';
import { construirAgendaSanitaria } from '../domain/agendaSanitaria';
import {
  createOperationalRecord,
  deleteOperationalRecord,
  persistCollectionMutation,
  updateOperationalRecord,
} from '../services/operationalPersistence';

const AGENDA_SECOES = [
  { chave: 'vencidos', titulo: 'Vencidos', badge: 'badge-r' },
  { chave: 'vencendoHoje', titulo: 'Vencendo hoje', badge: 'badge-a' },
  { chave: 'proximos7Dias', titulo: 'Próximos 7 dias', badge: 'badge-a' },
  { chave: 'proximos30Dias', titulo: 'Próximos 30 dias', badge: 'badge-n' },
  { chave: 'emCarencia', titulo: 'Em carência', badge: 'badge-a' },
  { chave: 'realizados', titulo: 'Realizados recentemente', badge: 'badge-g' },
];

export default function SanitarioPage({ db, setDb, onConfirmAction, navigationIntent = null }) {
  const { hasPermission, session } = useAuth();
  const { showToast } = useToast(); // Hook para exibir toasts
  const mensagemSemPermissao = 'Você não tem permissão para executar esta ação.';
  const abrirManejoPorIntent = navigationIntent?.page === 'sanitario' && navigationIntent?.action === 'novo';
  const [abrirForm, setAbrirForm] = useState(abrirManejoPorIntent);
  const [itemEditando, setItemEditando] = useState(null);
  const [iatf, setIatf] = useState({ nome: '', fazenda_id: db?.fazendas?.[0]?.id ? String(db.fazendas[0].id) : '', lote_id: db?.lotes?.[0]?.id ? String(db.lotes[0].id) : '', data_inicial: new Date().toISOString().slice(0,10), obs: '', status: 'Planejado', retirada_dias: 8, hormonal_dias: 9, inseminacao_dias: 10, diagnostico_dias: 40, repasse_dias: 55 });

  // Memoizar mapas para otimizar lookups
  const lotesMap = useMemo(() => {
    const map = new Map();
    (db?.lotes || []).forEach(l => map.set(l.id, l));
    return map;
  }, [db?.lotes]);

  const funcionariosMap = useMemo(() => {
    const map = new Map();
    (db?.funcionarios || []).forEach(f => map.set(f.id, f));
    return map;
  }, [db?.funcionarios]);

  const sanitario = useMemo(() => (Array.isArray(db?.sanitario) ? db.sanitario : []), [db]);

  // Agenda Sanitária (Sprint 10) — visão bucketizada por janela de
  // vencimento sobre os mesmos registros de `db.sanitario`, sem recalcular
  // nada que a tabela abaixo já não mostre.
  const agendaSanitaria = useMemo(() => construirAgendaSanitaria(db), [db]);

  const dadosTabela = useMemo(() => {
    return [...sanitario]
      .map((item) => {
        const lote = lotesMap.get(item.lote_id);
        const funcionario = funcionariosMap.get(item.funcionario_responsavel_id);

        return {
          ...item,
          loteNome: lote?.nome || '—',
          funcionarioNome: funcionario?.nome || '—',
          status: obterStatus(item.proxima, item.alerta_dias_antes),
        };
      })
      .sort((a, b) => {
        const dataA = a.proxima || a.data_aplic;
        const dataB = b.proxima || b.data_aplic;
        // Tratar datas nulas para ordenação
        if (!dataA && !dataB) return 0;
        if (!dataA) return 1; // Coloca itens sem data no final
        if (!dataB) return -1; // Coloca itens sem data no final
        return new Date(dataA).getTime() - new Date(dataB).getTime();
      });
  }, [sanitario, lotesMap, funcionariosMap]);

  // Agrupamento APENAS visual: registros com o mesmo metadata.grupo_manejo_id
  // formam um manejo composto. Registros sem grupo (legados/individuais)
  // continuam aparecendo normalmente. Edição/exclusão seguem por registro.
  const linhasRenderizadas = useMemo(() => {
    const grupos = new Map();
    const ordem = [];
    dadosTabela.forEach((row) => {
      const grupoId = row?.metadata?.grupo_manejo_id || null;
      if (grupoId) {
        if (!grupos.has(grupoId)) {
          grupos.set(grupoId, []);
          ordem.push({ tipo: 'grupo', key: grupoId });
        }
        grupos.get(grupoId).push(row);
      } else {
        ordem.push({ tipo: 'single', row });
      }
    });
    return ordem.map((entry) => {
      if (entry.tipo === 'single') return { kind: 'single', row: entry.row };
      const rows = grupos.get(entry.key) || [];
      // Grupo de 1 procedimento volta a ser linha individual.
      if (rows.length <= 1) return { kind: 'single', row: rows[0] };
      return { kind: 'group', grupoId: entry.key, rows };
    });
  }, [dadosTabela]);

  const resumo = useMemo(() => {
    const total = sanitario.length;
    const totalAtendidos = sanitario.reduce(
      (acc, item) => acc + Number(item.qtd || 0),
      0
    );

    const vencidos = sanitario.filter(
      (item) => obterStatus(item.proxima, item.alerta_dias_antes) === 'vencido'
    ).length;

    return {
      total,
      totalAtendidos,
      vencidos,
    };
  }, [sanitario]);

  const abrirNovo = useCallback(() => {
    if (!hasPermission('sanitario:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    setItemEditando(null);
    setAbrirForm(true);
  }, [hasPermission, showToast]);

  const editarItem = useCallback((item) => {
    if (!hasPermission('sanitario:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    setItemEditando(item);
    setAbrirForm(true);
  }, [hasPermission, showToast]);

  const excluirItem = useCallback(async (id) => {
    if (!hasPermission('sanitario:excluir')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    const confirmado = typeof onConfirmAction === 'function'
      ? await onConfirmAction({
          title: 'Excluir manejo sanitário',
          message: 'Deseja excluir este manejo sanitário? Esta ação é irreversível.',
          tone: 'danger',
        })
      : window.confirm('Deseja excluir este manejo sanitário? Esta ação é irreversível.');

    if (!confirmado) {
      showToast({ type: 'info', message: 'Exclusão cancelada.' });
      return;
    }

    const current = (db?.sanitario || []).find((s) => s.id === id);
    const mutations = [deleteOperationalRecord('sanitario', id, session)];
    if (current?.rotina_automatica_id) {
      mutations.push(deleteOperationalRecord('rotinas', current.rotina_automatica_id, session));
    }
    const persistedBatch = await persistCollectionMutation(mutations);
    if (!persistedBatch.persisted) {
      showToast({ type: 'warning', message: 'Não foi possível confirmar a exclusão agora.' });
      return;
    }

    setDb((prev) => {
      const item = prev.sanitario.find((s) => s.id === id);

      let novasRotinas = prev.rotinas || [];
      if (item?.rotina_automatica_id) {
        novasRotinas = novasRotinas.filter(
          (r) => r.id !== item.rotina_automatica_id
        );
      }

      return {
        ...prev,
        sanitario: prev.sanitario.filter((s) => s.id !== id),
        rotinas: novasRotinas,
      };
    });
    showToast({ type: 'success', message: 'Manejo sanitário excluído com sucesso!' });
  }, [db?.sanitario, hasPermission, onConfirmAction, session, setDb, showToast]);

  // Normaliza o payload do formulário (que envia `procedimentos`) e também o
  // payload legado/IATF (que envia tipo/desc no topo) numa lista de procedimentos.
  function normalizarProcedimentos(dados) {
    if (Array.isArray(dados?.procedimentos) && dados.procedimentos.length) {
      return dados.procedimentos;
    }
    return [{
      tipo: dados?.tipo || 'outro',
      item_estoque_id: dados?.item_estoque_id ?? dados?.metadata?.item_estoque_id ?? null,
      desc: dados?.desc || '',
    }];
  }

  function montarRegistroSanitario(base, metadataBase, proc, grupoId) {
    return {
      ...base,
      tipo: proc.tipo,
      desc: proc.desc || normalizarTipo(proc.tipo),
      metadata: {
        ...(metadataBase && typeof metadataBase === 'object' ? metadataBase : {}),
        item_estoque_id: proc.item_estoque_id ? Number(proc.item_estoque_id) : null,
        ...(grupoId ? { grupo_manejo_id: grupoId } : {}),
      },
    };
  }

  async function salvarItem(dados) {
    if (!hasPermission('sanitario:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }

    const rotinasAtuais = Array.isArray(db?.rotinas) ? db.rotinas : [];
    const sanitariosAtuais = Array.isArray(db?.sanitario) ? db.sanitario : [];
    const procedimentos = normalizarProcedimentos(dados);
    const metadataBase = dados?.metadataBase ?? dados?.metadata ?? {};
    const base = {
      lote_id: dados.lote_id,
      data_aplic: dados.data_aplic,
      proxima: dados.proxima ?? null,
      alerta_dias_antes: dados.alerta_dias_antes,
      data_fim_carencia: dados.data_fim_carencia ?? null,
      qtd: dados.qtd,
      obs: dados.obs,
      funcionario_responsavel_id: dados.funcionario_responsavel_id ?? null,
    };
    const shouldManageAutomaticRoutine = Boolean(base.proxima && base.funcionario_responsavel_id);

    // ── Edição: atualiza o registro único (edição do grupo inteiro é pendência) ──
    if (itemEditando) {
      const grupoExistente = itemEditando?.metadata?.grupo_manejo_id || null;
      const registro = montarRegistroSanitario(base, metadataBase, procedimentos[0], grupoExistente);
      const mutations = [];
      let rotinaAutomaticaIdFinal = itemEditando.rotina_automatica_id || null;
      let tarefaAutomaticaFinal = null;

      if (shouldManageAutomaticRoutine) {
        tarefaAutomaticaFinal = montarTarefaAutomatica({ ...base, tipo: registro.tipo, desc: registro.desc }, itemEditando.id);
        if (rotinaAutomaticaIdFinal) {
          mutations.push(updateOperationalRecord('rotinas', rotinaAutomaticaIdFinal, tarefaAutomaticaFinal, session));
        } else {
          const createdRotina = await createOperationalRecord('rotinas', tarefaAutomaticaFinal, session);
          if (!createdRotina.persisted) {
            showToast({ type: 'warning', message: createdRotina.error || 'Não foi possível salvar a tarefa automática.' });
            return;
          }
          rotinaAutomaticaIdFinal = createdRotina.data?.id ?? gerarNovoId(rotinasAtuais);
          mutations.push(Promise.resolve(createdRotina));
        }
      } else if (rotinaAutomaticaIdFinal) {
        mutations.push(deleteOperationalRecord('rotinas', rotinaAutomaticaIdFinal, session));
        rotinaAutomaticaIdFinal = null;
      }

      mutations.push(updateOperationalRecord('sanitario', itemEditando.id, {
        ...registro,
        rotina_automatica_id: rotinaAutomaticaIdFinal,
      }, session));

      const persistedBatch = await persistCollectionMutation(mutations);
      if (!persistedBatch.persisted) {
        showToast({ type: 'warning', message: 'Não foi possível confirmar o salvamento agora.' });
        return;
      }

      setDb((prev) => {
        const currentRotinas = prev.rotinas || [];
        let novasRotinas = [...currentRotinas];
        if (shouldManageAutomaticRoutine) {
          const tarefaAutomatica = tarefaAutomaticaFinal;
          if (itemEditando.rotina_automatica_id) {
            novasRotinas = novasRotinas.map((r) => (r.id === itemEditando.rotina_automatica_id ? { ...r, ...tarefaAutomatica } : r));
          } else {
            novasRotinas.push({ ...tarefaAutomatica, id: rotinaAutomaticaIdFinal });
          }
        } else if (itemEditando.rotina_automatica_id) {
          novasRotinas = novasRotinas.filter((r) => r.id !== itemEditando.rotina_automatica_id);
        }
        return {
          ...prev,
          sanitario: (prev.sanitario || []).map((s) => (
            s.id === itemEditando.id ? { ...s, ...registro, rotina_automatica_id: rotinaAutomaticaIdFinal } : s
          )),
          rotinas: novasRotinas,
        };
      });

      showToast({ type: 'success', message: 'Manejo sanitário atualizado com sucesso!' });
      setAbrirForm(false);
      setItemEditando(null);
      return;
    }

    // ── Criação: um registro por procedimento, ligados por grupo_manejo_id ──
    const grupoId = procedimentos.length > 1
      ? `manejo-${Date.now()}-${Math.random().toString(16).slice(2)}`
      : null;
    const criados = [];
    const falhas = [];

    for (const proc of procedimentos) {
      const registro = montarRegistroSanitario(base, metadataBase, proc, grupoId);
      const created = await createOperationalRecord('sanitario', registro, session);
      if (!created.persisted) {
        console.error('[HERDON_SANITARIO_SAVE_ERROR]', { action: 'create', tipo: registro.tipo, error: created.error });
        falhas.push({ tipo: registro.tipo, error: created.error });
        continue;
      }
      const novoId = created.data?.id ?? gerarNovoId([...sanitariosAtuais, ...criados]);
      criados.push({ ...registro, ...(created.data || {}), id: novoId, rotina_automatica_id: null });
    }

    if (!criados.length) {
      showToast({ type: 'error', message: falhas[0]?.error || 'Não foi possível salvar um dos procedimentos do manejo.' });
      return;
    }

    // Tarefa automática: uma por manejo (não uma por procedimento), ligada ao 1º registro.
    let novaRotina = null;
    if (shouldManageAutomaticRoutine) {
      const primeiro = criados[0];
      const descCombinada = criados.map((r) => r.desc).join(' + ');
      const tarefa = montarTarefaAutomatica({ ...base, tipo: criados[0].tipo, desc: descCombinada }, primeiro.id);
      const createdRotina = await createOperationalRecord('rotinas', tarefa, session);
      if (createdRotina.persisted) {
        const rotinaId = createdRotina.data?.id ?? gerarNovoId(rotinasAtuais);
        novaRotina = { ...tarefa, id: rotinaId };
        await updateOperationalRecord('sanitario', primeiro.id, { rotina_automatica_id: rotinaId }, session);
        primeiro.rotina_automatica_id = rotinaId;
      }
    }

    setDb((prev) => ({
      ...prev,
      sanitario: [...(prev.sanitario || []), ...criados],
      rotinas: novaRotina ? [...(prev.rotinas || []), novaRotina] : (prev.rotinas || []),
    }));

    if (falhas.length) {
      showToast({ type: 'warning', message: `Parte do manejo foi salva, mas ${falhas.length} procedimento(s) falharam.` });
    } else {
      showToast({
        type: 'success',
        message: criados.length > 1
          ? `Manejo com ${criados.length} procedimentos salvo com sucesso!`
          : 'Manejo sanitário criado com sucesso!',
      });
    }
    setAbrirForm(false);
    setItemEditando(null);
  }


  const iatfAgenda = useMemo(() => {
    if (!iatf.data_inicial) return [];
    const base = new Date(`${iatf.data_inicial}T00:00:00`);
    const add = (dias, label) => ({ label, data: new Date(base.getTime() + Number(dias || 0) * 86400000).toISOString().slice(0, 10), dias: Number(dias || 0) });
    return [
      add(0, 'Início do protocolo'),
      add(iatf.retirada_dias, 'Retirada do dispositivo'),
      add(iatf.hormonal_dias, 'Aplicação hormonal'),
      add(iatf.inseminacao_dias, 'Inseminação'),
      add(iatf.diagnostico_dias, 'Diagnóstico de gestação'),
      add(iatf.repasse_dias, 'Repasse/Revisão'),
    ];
  }, [iatf]);
  const proximaAcaoIatf = useMemo(
    () => iatfAgenda.find((item) => new Date(`${item.data}T00:00:00`) >= new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00`)) || null,
    [iatfAgenda]
  );

  async function salvarIatf() {
    if (!hasPermission('sanitario:editar')) { showToast({ type: 'error', message: mensagemSemPermissao }); return; }
    if (!iatf.nome.trim() || !iatf.data_inicial) { showToast({ type: 'warning', message: 'Informe nome do protocolo e data inicial.' }); return; }
    const proxima = iatfAgenda.find((item) => new Date(`${item.data}T00:00:00`) >= new Date(new Date().toISOString().slice(0,10)+'T00:00:00')) || iatfAgenda[0];
    const fazendaNome = (db?.fazendas || []).find((f) => String(f.id) === String(iatf.fazenda_id))?.nome || 'Sem fazenda';
    const offsets = `Offset dias: retirada=${Number(iatf.retirada_dias || 0)}, hormonal=${Number(iatf.hormonal_dias || 0)}, inseminação=${Number(iatf.inseminacao_dias || 0)}, diagnóstico=${Number(iatf.diagnostico_dias || 0)}, repasse=${Number(iatf.repasse_dias || 0)}`;
    const agendaSerializada = iatfAgenda.map((evento) => `Dia ${evento.dias} ${evento.label}: ${evento.data}`).join(' | ');
    const dados = {
      tipo: 'IATF',
      desc: iatf.nome,
      lote_id: iatf.lote_id ? Number(iatf.lote_id) : null,
      data_aplic: iatf.data_inicial,
      proxima: proxima?.data || iatf.data_inicial,
      alerta_dias_antes: 2,
      qtd: 0,
      obs: `Status: ${iatf.status} | Protocolo IATF | Fazenda: ${fazendaNome} | ${offsets} | Agenda: ${agendaSerializada} | ${iatf.obs || 'Sem observação'}`,
      funcionario_responsavel_id: null,
    };
    await salvarItem(dados);
  }

  return (
    <div className="page page--sanitario page--kpi-compact">
      <PageHeader
        title="Sanitário / Manejo"
        subtitle="Controle de vacinas, medicações e manejos com status e responsáveis."
        actions={<Button className="sanitario-cta" disabled={!hasPermission('sanitario:editar')} onClick={abrirNovo}>Registrar manejo</Button>}
      />

      <div className="summary-cards-grid sanitario-summary-grid">
        <Card title="Total de Manejos" className="sanitario-summary-card">
          <strong>{resumo.total}</strong>
        </Card>
        <Card title="Animais Atendidos" className="sanitario-summary-card">
          <strong>{resumo.totalAtendidos}</strong>
        </Card>
        <Card title="Manejos Vencidos" className="sanitario-summary-card sanitario-summary-card--alert">
          <strong>{resumo.vencidos}</strong>
        </Card>
      </div>

      <Card title="Agenda Sanitária" subtitle="Vacinas, vermífugos, reaplicações e carência — vencidos, vencendo e já feitos.">
        <div className="sanitario-agenda-grid">
          {AGENDA_SECOES.map((secao) => {
            const itens = agendaSanitaria[secao.chave] || [];
            return (
              <div key={secao.chave} className="sanitario-agenda-section">
                <div className="sanitario-agenda-section-title">
                  <span>{secao.titulo}</span>
                  <span className={`badge ${secao.badge}`}>{itens.length}</span>
                </div>
                {itens.length === 0 ? (
                  <span className="sanitario-agenda-empty">Nada por aqui.</span>
                ) : (
                  itens.slice(0, 5).map((item) => (
                    <div key={`${secao.chave}-${item.id}`} className="sanitario-agenda-item">
                      <strong>{item.produto}</strong>
                      <small>
                        {item.loteNome}
                        {item.dataPrevista ? ` · ${formatarData(item.dataPrevista)}` : ''}
                      </small>
                      {item.acaoSugerida ? <small>{item.acaoSugerida}</small> : null}
                    </div>
                  ))
                )}
                {itens.length > 5 ? (
                  <small className="sanitario-agenda-empty">+{itens.length - 5} mais</small>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Planejamento IATF / Reprodução" subtitle="Programe o protocolo com datas automáticas ajustáveis por dias de offset.">
        <div className="sanitario-iatf-layout">
          <section className="section-card sanitario-iatf-section">
            <div className="section-header"><h4>Dados do protocolo</h4></div>
            <div className="form-grid two">
              <label className="ui-input-wrap">
                <span className="ui-input-label">Fazenda</span>
                <select className="ui-input" value={iatf.fazenda_id} onChange={(e) => setIatf((p) => ({ ...p, fazenda_id: e.target.value }))}>{(db?.fazendas || []).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</select>
              </label>
              <label className="ui-input-wrap">
                <span className="ui-input-label">Lote</span>
                <select className="ui-input" value={iatf.lote_id} onChange={(e) => setIatf((p) => ({ ...p, lote_id: e.target.value }))}><option value="">Grupo/Lote</option>{(db?.lotes || []).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}</select>
              </label>
              <label className="ui-input-wrap">
                <span className="ui-input-label">Nome do protocolo</span>
                <input className="ui-input" value={iatf.nome} onChange={(e) => setIatf((p) => ({ ...p, nome: e.target.value }))} placeholder="Ex.: IATF Primavera - Lote 3" />
              </label>
              <label className="ui-input-wrap">
                <span className="ui-input-label">Data de início</span>
                <input className="ui-input" type="date" value={iatf.data_inicial} onChange={(e) => setIatf((p) => ({ ...p, data_inicial: e.target.value }))} />
              </label>
              <label className="ui-input-wrap">
                <span className="ui-input-label">Status</span>
                <select className="ui-input" value={iatf.status} onChange={(e) => setIatf((p) => ({ ...p, status: e.target.value }))}><option>Planejado</option><option>Em andamento</option><option>Concluído</option><option>Cancelado</option></select>
              </label>
              <label className="ui-input-wrap">
                <span className="ui-input-label">Observação</span>
                <input className="ui-input" value={iatf.obs} onChange={(e) => setIatf((p) => ({ ...p, obs: e.target.value }))} placeholder="Detalhes do protocolo e equipe" />
              </label>
            </div>
          </section>

          <section className="section-card sanitario-iatf-section">
            <div className="section-header"><h4>Dias do protocolo</h4></div>
            <div className="form-grid two sanitario-iatf-days-grid">
              <label className="ui-input-wrap">
                <span className="ui-input-label">Dia retirada do dispositivo (D+)</span>
                <input className="ui-input" type="number" value={iatf.retirada_dias} onChange={(e) => setIatf((p) => ({ ...p, retirada_dias: e.target.value }))} />
              </label>
              <label className="ui-input-wrap">
                <span className="ui-input-label">Dia aplicação hormonal (D+)</span>
                <input className="ui-input" type="number" value={iatf.hormonal_dias} onChange={(e) => setIatf((p) => ({ ...p, hormonal_dias: e.target.value }))} />
              </label>
              <label className="ui-input-wrap">
                <span className="ui-input-label">Dia inseminação (D+)</span>
                <input className="ui-input" type="number" value={iatf.inseminacao_dias} onChange={(e) => setIatf((p) => ({ ...p, inseminacao_dias: e.target.value }))} />
              </label>
              <label className="ui-input-wrap">
                <span className="ui-input-label">Dia diagnóstico (D+)</span>
                <input className="ui-input" type="number" value={iatf.diagnostico_dias} onChange={(e) => setIatf((p) => ({ ...p, diagnostico_dias: e.target.value }))} />
              </label>
              <label className="ui-input-wrap">
                <span className="ui-input-label">Dia repasse/revisão (D+)</span>
                <input className="ui-input" type="number" value={iatf.repasse_dias} onChange={(e) => setIatf((p) => ({ ...p, repasse_dias: e.target.value }))} />
              </label>
            </div>
          </section>
        </div>
        <div className="sanitario-iatf-preview">
          <div className="sanitario-iatf-preview-head">
            <strong>Prévia do cronograma</strong>
            <span className="badge badge-n">{iatfAgenda.length} etapas</span>
          </div>
          <div className="sanitario-iatf-next">
            <span className="sanitario-iatf-next-label">Próxima ação</span>
            <strong>{proximaAcaoIatf?.label || 'Sem ação futura'}</strong>
            <span className="sanitario-iatf-next-date">{proximaAcaoIatf ? formatarData(proximaAcaoIatf.data) : '—'}</span>
          </div>
          <div className="sanitario-iatf-timeline">
            {iatfAgenda.map((e) => (
              <div key={e.label} className={`sanitario-iatf-event ${proximaAcaoIatf?.label === e.label ? 'is-next' : ''}`}>
                <span className="sanitario-iatf-event-day">D+{e.dias}</span>
                <div>
                  <strong>{e.label}</strong>
                  <small>{formatarData(e.data)}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 10 }}><Button disabled={!hasPermission('sanitario:editar')} onClick={salvarIatf}>Salvar protocolo IATF</Button></div>
      </Card>


      <div className="ui-card no-padding sanitario-table-shell">
        <div className="table-responsive">
          {dadosTabela.length === 0 ? (
            <EmptyState
              title="Você ainda não registrou nenhum manejo sanitário."
              subtitle="Registre vacinas, medicações e manejos sanitários para acompanhar a rotina."
              action={
                <Button disabled={!hasPermission('sanitario:editar')} onClick={abrirNovo}>
                  Registrar manejo
                </Button>
              }
            />
          ) : (
            <table className="dashboard-table herdon-table herdon-table--sanitario">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Descrição</th>
                  <th>Lote</th>
                  <th>Data Aplicação</th>
                  <th>Próxima Data</th>
                  <th>Responsável</th>
                  <th>Qtd.</th>
                  <th>Status</th>
                  <th>Observação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {linhasRenderizadas.map((entry) => {
                  const renderRow = (item, rowClass = '') => (
                    <tr key={item.id} className={rowClass}>
                      <td>{normalizarTipo(item.tipo)}</td>
                      <td>{item.desc}</td>
                      <td>{item.loteNome}</td>
                      <td>{formatarData(item.data_aplic)}</td>
                      <td>{item.proxima ? formatarData(item.proxima) : '—'}</td>
                      <td>{item.funcionarioNome || '—'}</td>
                      <td className="cell-number">{item.qtd}</td>
                      <td className="cell-chip">{renderStatus(item.status)}</td>
                      <td>{item.obs || '—'}</td>
                      <td className="cell-actions">
                        <div className="row-actions row-actions--tight sanitario-table-actions">
                          <button
                            className="action-btn"
                            disabled={!hasPermission('sanitario:editar')}
                            onClick={() => editarItem(item)}
                          >
                            Editar
                          </button>
                          <button
                            className="action-btn action-btn-danger"
                            disabled={!hasPermission('sanitario:excluir')}
                            onClick={() => excluirItem(item.id)}
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );

                  if (entry.kind === 'single') {
                    return renderRow(entry.row);
                  }

                  const cabeca = entry.rows[0];
                  return (
                    <Fragment key={`grupo-${entry.grupoId}`}>
                      <tr className="sanitario-grupo-head">
                        <td colSpan={10}>
                          <span className="sanitario-grupo-badge">Manejo composto</span>
                          {' '}
                          <strong>{cabeca.loteNome}</strong>
                          {' · '}{formatarData(cabeca.data_aplic)}
                          {' · '}{cabeca.qtd} cabeças
                          {' · '}{entry.rows.length} procedimentos
                        </td>
                      </tr>
                      {entry.rows.map((item) => renderRow(item, 'sanitario-grupo-item'))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {abrirForm && (
        <SanitarioForm
          initialData={itemEditando}
          lotes={db?.lotes || []}
          funcionarios={db?.funcionarios || []}
          estoque={db?.estoque || []}
          onSave={salvarItem}
          onCancel={() => {
            setAbrirForm(false);
            setItemEditando(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * Monta um objeto de tarefa automática para ser inserido nas rotinas.
 * @param {object} dados - Dados do manejo sanitário.
 * @param {number} sanitarioId - ID do manejo sanitário de origem.
 * @returns {object} Objeto de tarefa.
 */
function montarTarefaAutomatica(dados, sanitarioId) {
  return {
    funcionario_id: Number(dados.funcionario_responsavel_id),
    lote_id: dados.lote_id ? Number(dados.lote_id) : null, // Usar null para opcional
    tarefa: `${normalizarTipo(dados.tipo)}: ${dados.desc}`,
    setor: 'Sanitário',
    obs: `Tarefa automática criada a partir do manejo sanitário${dados.obs ? ` • ${dados.obs}` : ''}`,
    recorrente: false,
    data: dados.proxima,
    status: 'pendente',
    // Campos de recorrência não aplicáveis para tarefas automáticas de sanitário
    recorrencia_tipo: '',
    dias_semana: [],
    data_inicio: '',
    data_fim: '',
    concluido_datas: [],
    origem_sistema: 'sanitario',
    origem_sanitario_id: sanitarioId,
  };
}

/**
 * Normaliza o tipo de manejo sanitário para exibição.
 * @param {string} tipo - O tipo de manejo.
 * @returns {string} O tipo normalizado.
 */
function normalizarTipo(tipo) {
  const mapa = {
    vacina: 'Vacina',
    vermifugo: 'Vermífugo',
    medicamento: 'Medicamento',
    exame: 'Exame',
    outro: 'Outro',
  };

  return mapa[tipo] || tipo || '—';
}

/**
 * Obtém o status de um manejo sanitário com base na próxima data e alerta.
 * @param {string} dataProxima - A próxima data de aplicação (ISO string).
 * @param {number} alertaDiasAntes - Número de dias para alertar antes da data.
 * @returns {string} O status ('vencido', 'proximo', 'em-dia', 'sem-data').
 */
function obterStatus(dataProxima, alertaDiasAntes = 0) {
  if (!dataProxima) return 'sem-data';

  const hoje = new Date();
  const proxima = new Date(dataProxima);

  hoje.setHours(0, 0, 0, 0);
  proxima.setHours(0, 0, 0, 0);

  const diffDias = Math.round((proxima.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDias < 0) return 'vencido';
  if (diffDias <= Number(alertaDiasAntes || 0)) return 'proximo';
  return 'em-dia';
}

/**
 * Renderiza um badge de status para o manejo sanitário.
 * @param {string} status - O status do manejo.
 * @returns {JSX.Element} O elemento badge.
 */
function renderStatus(status) {
  if (status === 'vencido') {
    return <span className="badge badge-r">Vencido</span>;
  }

  if (status === 'proximo') {
    return <span className="badge badge-a">Próximo</span>;
  }

  if (status === 'em-dia') {
    return <span className="badge badge-g">Em dia</span>;
  }

  return <span className="badge badge-n">Sem data</span>;
}
