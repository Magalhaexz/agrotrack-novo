import { useMemo, useState } from 'react';
import PesagemForm from '../components/PesagemForm';
import { formatarNumero, formatarData } from '../utils/formatters';
import { gerarNovoId } from '../utils/id';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../auth/useAuth';
import {
  createOperationalRecord,
  deleteOperationalRecord,
  persistCollectionMutation,
  updateOperationalRecord,
} from '../services/operationalPersistence';

function toFiniteNumber(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function resolveTipoPesagem(item) {
  if (item?.tipo === 'animal' || item?.origem === 'animal') return 'animal';
  return 'lote';
}

function resolveLatestPesagem(pesagens) {
  return [...(pesagens || [])]
    .filter((item) => item?.data)
    .sort((a, b) => {
      const timeA = new Date(a.data).getTime();
      const timeB = new Date(b.data).getTime();
      if (timeA !== timeB) return timeB - timeA;
      return toFiniteNumber(b.id) - toFiniteNumber(a.id);
    })[0] || null;
}

function recalculateLoteFromPesagens(prevDb, loteId, nextPesagens) {
  const lotes = Array.isArray(prevDb?.lotes) ? prevDb.lotes : [];
  const animais = Array.isArray(prevDb?.animais) ? prevDb.animais : [];
  const normalizedLoteId = Number(loteId);

  const pesagensLote = (nextPesagens || []).filter((item) => (
    resolveTipoPesagem(item) === 'lote' && Number(item?.lote_id) === normalizedLoteId
  ));
  const latestPesagem = resolveLatestPesagem(pesagensLote);

  const fallbackPesoFromAnimais = (() => {
    const grupos = animais.filter((item) => Number(item?.lote_id) === normalizedLoteId);
    const qtd = grupos.reduce((sum, item) => sum + toFiniteNumber(item?.qtd), 0);
    if (qtd <= 0) return 0;
    const pesoTotal = grupos.reduce(
      (sum, item) => sum + toFiniteNumber(item?.p_at) * toFiniteNumber(item?.qtd),
      0
    );
    return qtd > 0 ? pesoTotal / qtd : 0;
  })();

  const nextPesoAtual = latestPesagem
    ? toFiniteNumber(latestPesagem.peso_medio, fallbackPesoFromAnimais)
    : fallbackPesoFromAnimais;
  const nextUltimaPesagem = latestPesagem?.data || null;

  const nextLotes = lotes.map((lote) => {
    if (Number(lote?.id) !== normalizedLoteId) return lote;
    return {
      ...lote,
      p_at: nextPesoAtual,
      peso_atual: nextPesoAtual,
      peso_medio_atual: nextPesoAtual,
      ultima_pesagem: nextUltimaPesagem,
    };
  });

  return {
    ...prevDb,
    pesagens: nextPesagens,
    lotes: nextLotes,
  };
}

function shouldUpdateLote(record) {
  return resolveTipoPesagem(record) === 'lote' && Number(record?.lote_id) > 0;
}

export default function PesagensPage({ db, setDb, onConfirmAction, navigationIntent = null }) {
  const { hasPermission, session } = useAuth();
  const { showToast } = useToast();
  const mensagemSemPermissao = 'Voce nao tem permissao para executar esta acao.';

  const shouldStartWithNewPesagem = navigationIntent?.page === 'pesagens' && navigationIntent?.action === 'novo';
  const [abrirForm, setAbrirForm] = useState(shouldStartWithNewPesagem);
  const [pesagemEditando, setPesagemEditando] = useState(null);

  const lotes = db?.lotes;
  const animais = db?.animais;
  const pesagens = db?.pesagens;

  const lotesMap = useMemo(() => {
    const map = new Map();
    (lotes || []).forEach((lote) => map.set(Number(lote.id), lote));
    return map;
  }, [lotes]);

  const animaisMap = useMemo(() => {
    const map = new Map();
    (animais || []).forEach((animal) => map.set(Number(animal.id), animal));
    return map;
  }, [animais]);

  const dadosTabela = useMemo(() => {
    const pesagensPorLote = new Map();
    (pesagens || []).forEach((pesagem) => {
      if (resolveTipoPesagem(pesagem) !== 'lote') return;
      const loteId = Number(pesagem.lote_id);
      if (!pesagensPorLote.has(loteId)) pesagensPorLote.set(loteId, []);
      pesagensPorLote.get(loteId).push(pesagem);
    });

    const variacaoPorPesagem = new Map();
    pesagensPorLote.forEach((lotePesagens) => {
      lotePesagens.sort((a, b) => new Date(a.data) - new Date(b.data));
      for (let i = 0; i < lotePesagens.length; i += 1) {
        const atual = lotePesagens[i];
        const anterior = i > 0 ? lotePesagens[i - 1] : null;
        const variacao = anterior ? Number(atual.peso_medio) - Number(anterior.peso_medio) : null;
        variacaoPorPesagem.set(atual.id, variacao);
      }
    });

    return [...(pesagens || [])]
      .map((pesagem) => {
        const tipo = resolveTipoPesagem(pesagem);
        const animal = animaisMap.get(Number(pesagem.animal_id));
        return {
          ...pesagem,
          tipo,
          loteNome: lotesMap.get(Number(pesagem.lote_id))?.nome || '—',
          animalNome: animal?.identificacao || animal?.nome || null,
          variacao: tipo === 'lote' ? variacaoPorPesagem.get(pesagem.id) ?? null : null,
        };
      })
      .sort((a, b) => new Date(b.data) - new Date(a.data));
  }, [pesagens, lotesMap, animaisMap]);

  const resumo = useMemo(() => {
    const basePesagens = pesagens || [];
    const totalPesagens = basePesagens.length;
    const lotesComPesagem = new Set();
    let ultimaData = '';
    let latestTimestamp = 0;
    let totalPesoMedio = 0;
    let totalPesagensAnimal = 0;

    basePesagens.forEach((pesagem) => {
      lotesComPesagem.add(pesagem.lote_id);
      totalPesoMedio += Number(pesagem.peso_medio || 0);
      if (resolveTipoPesagem(pesagem) === 'animal') totalPesagensAnimal += 1;
      const currentTimestamp = new Date(pesagem.data).getTime();
      if (currentTimestamp > latestTimestamp) {
        latestTimestamp = currentTimestamp;
        ultimaData = pesagem.data;
      }
    });

    return {
      totalPesagens,
      totalPesagensAnimal,
      totalPesagensLote: totalPesagens - totalPesagensAnimal,
      lotesComPesagem: lotesComPesagem.size,
      ultimaData,
      pesoMedioGeral: totalPesagens ? totalPesoMedio / totalPesagens : 0,
    };
  }, [pesagens]);

  function abrirNovaPesagem() {
    if (!hasPermission('pesagens:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    setPesagemEditando(null);
    setAbrirForm(true);
  }

  function editarPesagem(item) {
    if (!hasPermission('pesagens:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    setPesagemEditando(item);
    setAbrirForm(true);
  }

  async function excluirPesagem(id) {
    if (!hasPermission('pesagens:excluir')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    const confirmado = typeof onConfirmAction === 'function'
      ? await onConfirmAction({
          title: 'Excluir pesagem',
          message: 'Deseja excluir esta pesagem?',
          tone: 'danger',
        })
      : window.confirm('Deseja excluir esta pesagem?');
    if (!confirmado) return;

    const pesagemAlvo = (pesagens || []).find((item) => item.id === id) || null;
    const persistedDelete = await deleteOperationalRecord('pesagens', id, session);

    setDb((prev) => {
      const pesagensAtuais = Array.isArray(prev?.pesagens) ? prev.pesagens : [];
      const pesagemRemovida = pesagensAtuais.find((item) => item.id === id);
      const pesagensRestantes = pesagensAtuais.filter((item) => item.id !== id);

      if (!shouldUpdateLote(pesagemRemovida)) {
        return { ...prev, pesagens: pesagensRestantes };
      }
      return recalculateLoteFromPesagens(prev, pesagemRemovida.lote_id, pesagensRestantes);
    });

    if (shouldUpdateLote(pesagemAlvo)) {
      const novoLote = recalculateLoteFromPesagens(
        db,
        pesagemAlvo.lote_id,
        (pesagens || []).filter((item) => item.id !== id)
      )?.lotes?.find((item) => Number(item.id) === Number(pesagemAlvo.lote_id));

      if (novoLote) {
        const lotePersist = await updateOperationalRecord('lotes', novoLote.id, {
          p_at: novoLote.p_at,
          peso_atual: novoLote.peso_atual,
          peso_medio_atual: novoLote.peso_medio_atual,
          ultima_pesagem: novoLote.ultima_pesagem,
        }, session);
        if (!persistedDelete.persisted || !lotePersist.persisted) {
          showToast({ type: 'warning', message: 'Exclusao salva parcialmente apenas no modo local.' });
        }
      }
    }

    showToast({ type: 'success', message: 'Pesagem excluida com sucesso!' });
  }

  async function salvarPesagem(dados) {
    if (!hasPermission('pesagens:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }

    if (pesagemEditando) {
      const pesagemPersistida = await updateOperationalRecord('pesagens', pesagemEditando.id, dados, session);
      const registroAtualizado = { ...pesagemEditando, ...(pesagemPersistida.data || dados) };

      setDb((prev) => {
        const pesagensAtuais = Array.isArray(prev?.pesagens) ? prev.pesagens : [];
        const pesagensAtualizadas = pesagensAtuais.map((item) => (
          item.id === pesagemEditando.id ? registroAtualizado : item
        ));

        const loteAnterior = shouldUpdateLote(pesagemEditando) ? pesagemEditando.lote_id : null;
        const loteNovo = shouldUpdateLote(registroAtualizado) ? registroAtualizado.lote_id : null;

        let nextState = { ...prev, pesagens: pesagensAtualizadas };
        if (loteAnterior) nextState = recalculateLoteFromPesagens(nextState, loteAnterior, pesagensAtualizadas);
        if (loteNovo && Number(loteNovo) !== Number(loteAnterior)) {
          nextState = recalculateLoteFromPesagens(nextState, loteNovo, pesagensAtualizadas);
        }
        if (loteNovo && Number(loteNovo) === Number(loteAnterior)) {
          nextState = recalculateLoteFromPesagens(nextState, loteNovo, pesagensAtualizadas);
        }
        return nextState;
      });

      const promises = [Promise.resolve(pesagemPersistida)];
      if (shouldUpdateLote(registroAtualizado)) {
        const loteRecalculado = recalculateLoteFromPesagens(
          db,
          registroAtualizado.lote_id,
          (pesagens || []).map((item) => (item.id === pesagemEditando.id ? registroAtualizado : item))
        )?.lotes?.find((item) => Number(item.id) === Number(registroAtualizado.lote_id));

        if (loteRecalculado) {
          promises.push(updateOperationalRecord('lotes', loteRecalculado.id, {
            p_at: loteRecalculado.p_at,
            peso_atual: loteRecalculado.peso_atual,
            peso_medio_atual: loteRecalculado.peso_medio_atual,
            ultima_pesagem: loteRecalculado.ultima_pesagem,
          }, session));
        }
      }

      const persistedBatch = await persistCollectionMutation(promises);
      if (!persistedBatch.persisted) {
        showToast({ type: 'warning', message: 'Alteracao salva parcialmente apenas no modo local.' });
      }
      showToast({ type: 'success', message: 'Pesagem atualizada com sucesso!' });
    } else {
      const pesagemPersistida = await createOperationalRecord('pesagens', dados, session);
      const novaPesagem = pesagemPersistida.data || { id: gerarNovoId(pesagens || []), ...dados };

      setDb((prev) => {
        const pesagensAtuais = Array.isArray(prev?.pesagens) ? prev.pesagens : [];
        const pesagensAtualizadas = [...pesagensAtuais, novaPesagem];
        if (!shouldUpdateLote(novaPesagem)) return { ...prev, pesagens: pesagensAtualizadas };
        return recalculateLoteFromPesagens(prev, novaPesagem.lote_id, pesagensAtualizadas);
      });

      const promises = [Promise.resolve(pesagemPersistida)];
      if (shouldUpdateLote(novaPesagem)) {
        const loteRecalculado = recalculateLoteFromPesagens(db, novaPesagem.lote_id, [...(pesagens || []), novaPesagem])
          ?.lotes?.find((item) => Number(item.id) === Number(novaPesagem.lote_id));
        if (loteRecalculado) {
          promises.push(updateOperationalRecord('lotes', loteRecalculado.id, {
            p_at: loteRecalculado.p_at,
            peso_atual: loteRecalculado.peso_atual,
            peso_medio_atual: loteRecalculado.peso_medio_atual,
            ultima_pesagem: loteRecalculado.ultima_pesagem,
          }, session));
        }
      }

      const persistedBatch = await persistCollectionMutation(promises);
      if (!persistedBatch.persisted) {
        showToast({ type: 'warning', message: 'Cadastro salvo parcialmente apenas no modo local.' });
      }
      showToast({ type: 'success', message: 'Pesagem registrada com sucesso!' });
    }

    setAbrirForm(false);
    setPesagemEditando(null);
  }

  return (
    <div className="page page--pesagens page--kpi-compact">
      <div className="page-header page-topbar herdon-page-topbar herdon-page-topbar--compact">
        <div>
          <h1>Pesagens</h1>
          <p>Registro e acompanhamento de pesagens por lote e por animal.</p>
        </div>

        <div className="page-topbar-actions">
          <button className="primary-btn" onClick={abrirNovaPesagem}>
            + Nova pesagem
          </button>
        </div>
      </div>

      <div className="kpi-grid-3 kpi-grid-3--compact">
        <div className="kpi-card kpi-card--compact">
          <div className="kpi-label">Pesagens</div>
          <div className="kpi-value">{resumo.totalPesagens}</div>
          <div className="kpi-sub">lote: {resumo.totalPesagensLote} | animal: {resumo.totalPesagensAnimal}</div>
        </div>

        <div className="kpi-card kpi-card--compact">
          <div className="kpi-label">Lotes com pesagem</div>
          <div className="kpi-value">{resumo.lotesComPesagem}</div>
          <div className="kpi-sub">lotes acompanhados</div>
        </div>

        <div className="kpi-card kpi-card--compact">
          <div className="kpi-label">Peso medio geral</div>
          <div className="kpi-value">{formatarNumero(resumo.pesoMedioGeral)} kg</div>
          <div className="kpi-sub">ultima data: {formatarData(resumo.ultimaData)}</div>
        </div>
      </div>

      <div className="fazendas-card">
        <div className="fazendas-card-header">
          <span className="fazendas-card-title">Historico de pesagens</span>
        </div>

        <div className="fazendas-table-wrap">
          {dadosTabela.length === 0 ? (
            <div className="empty-box">
              <strong>Nenhuma pesagem cadastrada.</strong>
              <span>
                {(animais || []).length === 0
                  ? 'Voce pode registrar uma pesagem por lote ou cadastrar um animal para acompanhar individualmente.'
                  : 'Use o botao "Nova pesagem" para registrar o primeiro peso.'}
              </span>
            </div>
          ) : (
            <table className="data-table herdon-table herdon-table--pesagens">
              <thead>
                <tr>
                  <th>Origem</th>
                  <th>Referencia</th>
                  <th>Lote</th>
                  <th>Data</th>
                  <th>Peso medio</th>
                  <th>Variacao</th>
                  <th>Observacao</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {dadosTabela.map((item) => (
                  <tr key={item.id}>
                    <td className="cell-chip">
                      <span className={`badge ${item.tipo === 'animal' ? 'badge-info' : 'badge-g'}`}>
                        {item.tipo === 'animal' ? 'Animal' : 'Lote'}
                      </span>
                    </td>
                    <td className="text-h">{item.tipo === 'animal' ? (item.animalNome || 'Animal sem identificacao') : item.loteNome}</td>
                    <td>{item.loteNome}</td>
                    <td>{formatarData(item.data)}</td>
                    <td>{formatarNumero(item.peso_medio)} kg</td>
                    <td className="cell-chip">{renderVariacao(item.variacao, item.tipo)}</td>
                    <td>{item.observacao || '—'}</td>
                    <td className="cell-actions">
                      <div className="row-actions row-actions--tight">
                        <button className="action-btn" onClick={() => editarPesagem(item)}>
                          Editar
                        </button>
                        <button className="action-btn action-btn-danger" onClick={() => excluirPesagem(item.id)}>
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {abrirForm && (
        <PesagemForm
          initialData={pesagemEditando}
          lotes={lotes || []}
          animais={animais || []}
          onSave={salvarPesagem}
          onCancel={() => {
            setAbrirForm(false);
            setPesagemEditando(null);
          }}
        />
      )}
    </div>
  );
}

function renderVariacao(variacao, tipo) {
  if (tipo === 'animal') return <span className="badge badge-neutral">Nao se aplica</span>;
  if (variacao === null || variacao === undefined) return '—';
  if (variacao > 0) return <span className="badge badge-g">+{formatarNumero(variacao)} kg</span>;
  if (variacao < 0) return <span className="badge badge-r">{formatarNumero(variacao)} kg</span>;
  return <span className="badge badge-a">0,00 kg</span>;
}
