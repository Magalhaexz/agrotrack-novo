import { useMemo, useState } from 'react';
import PesagemForm from '../components/PesagemForm';
import { formatarNumero, formatarData } from '../utils/formatters';
import { gerarNovoId } from '../utils/id';
import { useToast } from '../hooks/useToast'; // Assuming useToast is available
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

  const pesagensLote = (nextPesagens || []).filter(
    (item) => Number(item?.lote_id) === normalizedLoteId
  );
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
    if (Number(lote?.id) !== normalizedLoteId) {
      return lote;
    }

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

export default function PesagensPage({ db, setDb, onConfirmAction, navigationIntent = null }) {
  const { hasPermission, session } = useAuth();
  const { showToast } = useToast(); // Initialize toast hook
  const mensagemSemPermissao = 'Você não tem permissão para executar esta ação.';

  const shouldStartWithNewPesagem = navigationIntent?.page === 'pesagens' && navigationIntent?.action === 'novo';
  const [abrirForm, setAbrirForm] = useState(shouldStartWithNewPesagem);
  const [pesagemEditando, setPesagemEditando] = useState(null);

  const lotes = db?.lotes || [];
  const pesagens = db?.pesagens || [];

  // Optimize lotes lookup
  const lotesMap = useMemo(() => {
    const map = new Map();
    lotes.forEach(l => map.set(l.id, l));
    return map;
  }, [lotes]);

  const dadosTabela = useMemo(() => {
    const pesagensPorLote = new Map(); // Map<lote_id, Array<pesagem>>

    // Group pesagens by lote_id
    pesagens.forEach(p => {
      if (!pesagensPorLote.has(p.lote_id)) {
        pesagensPorLote.set(p.lote_id, []);
      }
      pesagensPorLote.get(p.lote_id).push(p);
    });

    const result = [];
    pesagensPorLote.forEach((lotePesagens) => {
      // Sort weighings for the current lot by date to calculate variation
      lotePesagens.sort((a, b) => new Date(a.data) - new Date(b.data));

      for (let i = 0; i < lotePesagens.length; i++) {
        const pesagem = lotePesagens[i];
        const lote = lotesMap.get(pesagem.lote_id);
        let variacao = null;

        if (i > 0) {
          variacao = Number(pesagem.peso_medio) - Number(lotePesagens[i - 1].peso_medio);
        }

        result.push({
          ...pesagem,
          loteNome: lote?.nome || '—',
          variacao,
        });
      }
    });

    // Final sort for display (most recent first)
    return result.sort((a, b) => new Date(b.data) - new Date(a.data));
  }, [pesagens, lotesMap]);

  const resumo = useMemo(() => {
    const totalPesagens = pesagens.length;
    const lotesComPesagem = new Set();
    let ultimaData = '';
    let latestTimestamp = 0;
    let totalPesoMedio = 0;

    pesagens.forEach((p) => {
      lotesComPesagem.add(p.lote_id);
      totalPesoMedio += Number(p.peso_medio || 0);
      const currentTimestamp = new Date(p.data).getTime();
      if (currentTimestamp > latestTimestamp) {
        latestTimestamp = currentTimestamp;
        ultimaData = p.data;
      }
    });

    const pesoMedioGeral = totalPesagens ? totalPesoMedio / totalPesagens : 0;

    return {
      totalPesagens,
      lotesComPesagem: lotesComPesagem.size,
      ultimaData,
      pesoMedioGeral,
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

    const pesagemAlvo = pesagens.find((item) => item.id === id) || null;
    const persistedDelete = await deleteOperationalRecord('pesagens', id, session);

    setDb((prev) => {
      const pesagensAtuais = Array.isArray(prev?.pesagens) ? prev.pesagens : [];
      const pesagemRemovida = pesagensAtuais.find((p) => p.id === id);
      const pesagensRestantes = pesagensAtuais.filter((p) => p.id !== id);

      if (!pesagemRemovida?.lote_id) {
        return {
          ...prev,
          pesagens: pesagensRestantes,
        };
      }

      return recalculateLoteFromPesagens(prev, pesagemRemovida.lote_id, pesagensRestantes);
    });
    if (pesagemAlvo?.lote_id) {
      const novoLote = recalculateLoteFromPesagens(db, pesagemAlvo.lote_id, pesagens.filter((p) => p.id !== id))
        ?.lotes?.find((item) => Number(item.id) === Number(pesagemAlvo.lote_id));
      if (novoLote) {
        const lotePersist = await updateOperationalRecord('lotes', novoLote.id, {
          p_at: novoLote.p_at,
          peso_atual: novoLote.peso_atual,
          peso_medio_atual: novoLote.peso_medio_atual,
          ultima_pesagem: novoLote.ultima_pesagem,
        }, session);
        if (!persistedDelete.persisted || !lotePersist.persisted) {
          showToast({ type: 'warning', message: 'Exclusão salva parcialmente apenas no modo local.' });
        }
      }
    }
    showToast({ type: 'success', message: 'Pesagem excluída com sucesso!' });
  }

  async function salvarPesagem(dados) {
    if (!hasPermission('pesagens:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    if (pesagemEditando) {
      const pesagemPersistida = await updateOperationalRecord('pesagens', pesagemEditando.id, dados, session);
      setDb((prev) => {
        const pesagensAtuais = Array.isArray(prev?.pesagens) ? prev.pesagens : [];
        const pesagensAtualizadas = pesagensAtuais.map((p) =>
          p.id === pesagemEditando.id ? { ...p, ...(pesagemPersistida.data || dados) } : p
        );
        return recalculateLoteFromPesagens(prev, dados.lote_id, pesagensAtualizadas);
      });
      const loteRecalculado = recalculateLoteFromPesagens(db, dados.lote_id, pesagens.map((p) => (
        p.id === pesagemEditando.id ? { ...p, ...(pesagemPersistida.data || dados) } : p
      )))?.lotes?.find((item) => Number(item.id) === Number(dados.lote_id));
      if (loteRecalculado) {
        const lotePersist = await updateOperationalRecord('lotes', loteRecalculado.id, {
          p_at: loteRecalculado.p_at,
          peso_atual: loteRecalculado.peso_atual,
          peso_medio_atual: loteRecalculado.peso_medio_atual,
          ultima_pesagem: loteRecalculado.ultima_pesagem,
        }, session);
        if (!pesagemPersistida.persisted || !lotePersist.persisted) {
          showToast({ type: 'warning', message: 'Alteração salva parcialmente apenas no modo local.' });
        }
      }
      showToast({ type: 'success', message: 'Pesagem atualizada com sucesso!' });
    } else {
      const pesagemPersistida = await createOperationalRecord('pesagens', dados, session);
      const novoId = gerarNovoId(pesagens);
      const novaPesagem = pesagemPersistida.data || {
        id: novoId,
        ...dados,
      };

      setDb((prev) => {
        const pesagensAtuais = Array.isArray(prev?.pesagens) ? prev.pesagens : [];
        const pesagensAtualizadas = [
          ...pesagensAtuais,
          novaPesagem,
        ];
        return recalculateLoteFromPesagens(prev, dados.lote_id, pesagensAtualizadas);
      });
      const loteRecalculado = recalculateLoteFromPesagens(db, dados.lote_id, [...pesagens, novaPesagem])
        ?.lotes?.find((item) => Number(item.id) === Number(dados.lote_id));
      if (loteRecalculado) {
        const persistLote = updateOperationalRecord('lotes', loteRecalculado.id, {
          p_at: loteRecalculado.p_at,
          peso_atual: loteRecalculado.peso_atual,
          peso_medio_atual: loteRecalculado.peso_medio_atual,
          ultima_pesagem: loteRecalculado.ultima_pesagem,
        }, session);
        const persistedBatch = await persistCollectionMutation([Promise.resolve(pesagemPersistida), persistLote]);
        if (!persistedBatch.persisted) {
          showToast({ type: 'warning', message: 'Cadastro salvo parcialmente apenas no modo local.' });
        }
      }
      showToast({ type: 'success', message: 'Pesagem registrada com sucesso!' });
    }

    setAbrirForm(false);
    setPesagemEditando(null);
  }

  return (
    <div className="page">
      <div className="page-header page-topbar">
        <div>
          <h1>Pesagens</h1>
          <p>Registro e acompanhamento do peso médio dos lotes.</p>
        </div>

        <div className="page-topbar-actions">
          <button className="primary-btn" onClick={abrirNovaPesagem}>
            + Nova pesagem
          </button>
        </div>
      </div>

      <div className="kpi-grid-3">
        <div className="kpi-card">
          <div className="kpi-label">Pesagens</div>
          <div className="kpi-value">{resumo.totalPesagens}</div>
          <div className="kpi-sub">registros cadastrados</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Lotes com pesagem</div>
          <div className="kpi-value">{resumo.lotesComPesagem}</div>
          <div className="kpi-sub">lotes acompanhados</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Peso médio geral</div>
          <div className="kpi-value">
            {formatarNumero(resumo.pesoMedioGeral)} kg
          </div>
          <div className="kpi-sub">
            última data: {formatarData(resumo.ultimaData)}
          </div>
        </div>
      </div>

      <div className="fazendas-card">
        <div className="fazendas-card-header">
          <span className="fazendas-card-title">Histórico de pesagens</span>
        </div>

        <div className="fazendas-table-wrap">
          {dadosTabela.length === 0 ? (
            <div className="empty-box">
              <strong>Nenhuma pesagem cadastrada.</strong>
              <span>Use o botão “Nova pesagem” para registrar o primeiro peso.</span>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Data</th>
                  <th>Peso médio</th>
                  <th>Variação</th>
                  <th>Observação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {dadosTabela.map((item) => (
                  <tr key={item.id}>
                    <td className="text-h">{item.loteNome}</td>
                    <td>{formatarData(item.data)}</td>
                    <td>{formatarNumero(item.peso_medio)} kg</td>
                    <td>{renderVariacao(item.variacao)}</td>
                    <td>{item.observacao || '—'}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="action-btn"
                          onClick={() => editarPesagem(item)}
                        >
                          Editar
                        </button>
                        <button
                          className="action-btn action-btn-danger"
                          onClick={() => excluirPesagem(item.id)}
                        >
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
          lotes={lotes}
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

function renderVariacao(variacao) {
  if (variacao === null || variacao === undefined) return '—';

  if (variacao > 0) {
    return <span className="badge badge-g">+{formatarNumero(variacao)} kg</span>;
  }

  if (variacao < 0) {
    return <span className="badge badge-r">{formatarNumero(variacao)} kg</span>;
  }

  return <span className="badge badge-a">0,00 kg</span>;
}
