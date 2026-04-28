import { useMemo, useState } from 'react';
import CustoForm from '../components/CustoForm';
import { formatarNumero, formatarData } from '../utils/formatters';
import { gerarNovoId } from '../utils/id'; // Importa a função de gerar ID
import { useAuth } from '../auth/useAuth';
import { useToast } from '../hooks/useToast';
import {
  createOperationalRecord,
  deleteOperationalRecord,
  updateOperationalRecord,
} from '../services/operationalPersistence';

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function upsertMovimentacaoFinanceiraDeCusto(movimentacoes, custo) {
  const lista = Array.isArray(movimentacoes) ? [...movimentacoes] : [];
  const idx = lista.findIndex(
    (item) => item?.origem === 'custo' && Number(item?.origem_id) === Number(custo.id)
  );

  const payload = {
    tipo: 'despesa',
    categoria: custo.cat || 'outros',
    data: custo.data,
    valor: toNumber(custo.val),
    lote_id: custo.lote_id ? Number(custo.lote_id) : null,
    descricao: custo.desc || '',
    observacao: custo.desc || '',
    origem: 'custo',
    origem_id: custo.id,
  };

  if (idx >= 0) {
    lista[idx] = { ...lista[idx], ...payload };
    return lista;
  }

  return [
    ...lista,
    {
      id: gerarNovoId(lista),
      ...payload,
    },
  ];
}

/**
 * Página de Custos Operacionais.
 * Permite o lançamento, acompanhamento e gerenciamento de custos por lote.
 * Exibe um resumo dos custos e uma tabela detalhada com opções de edição e exclusão.
 *
 * @param {object} props - As propriedades do componente.
 * @param {object} props.db - O objeto do banco de dados.
 * @param {function} props.setDb - Função para atualizar o banco de dados.
 * @param {function} [props.onConfirmAction] - Função para exibir um modal de confirmação customizado.
 */
export default function CustosPage({ db, setDb, onConfirmAction }) {
  const { hasPermission, session } = useAuth();
  const { showToast } = useToast();
  const [abrirForm, setAbrirForm] = useState(false);
  const [custoEditando, setCustoEditando] = useState(null);
  const mensagemSemPermissao = 'Você não tem permissão para executar esta ação.';

  const lotes = db?.lotes || [];
  const custos = db?.custos || [];

  // Otimização: Criar um mapa de lotes para busca eficiente (O(1))
  const lotesMap = useMemo(() => {
    return new Map(lotes.map((l) => [l.id, l]));
  }, [lotes]);

  const dadosTabela = useMemo(() => {
    return [...custos]
      .map((custo) => {
        const lote = lotesMap.get(custo.lote_id); // Usar o mapa para buscar o lote
        return {
          ...custo,
          loteNome: lote?.nome || '—',
        };
      })
      .sort((a, b) => new Date(b.data) - new Date(a.data));
  }, [custos, lotesMap]); // Depende de custos e do mapa de lotes

  const resumo = useMemo(() => {
    const total = custos.reduce((acc, item) => acc + Number(item.val || 0), 0);

    const porCategoria = custos.reduce((acc, item) => {
      const categoria = item.cat || 'outros';
      acc[categoria] = (acc[categoria] || 0) + Number(item.val || 0);
      return acc;
    }, {});

    // Retorna a categoria com maior valor, ou null se não houver custos
    const categoriaTop =
      Object.entries(porCategoria).sort((a, b) => b[1] - a[1])[0] || null;

    return {
      total,
      quantidade: custos.length,
      categoriaTop,
    };
  }, [custos]);

  /**
   * Abre o formulário para adicionar um novo custo.
   */
  function abrirNovo() {
    if (!hasPermission('custos:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    setCustoEditando(null);
    setAbrirForm(true);
  }

  /**
   * Abre o formulário para editar um custo existente.
   * @param {object} custo - O objeto do custo a ser editado.
   */
  function editarCusto(custo) {
    if (!hasPermission('custos:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    setCustoEditando(custo);
    setAbrirForm(true);
  }

  /**
   * Exclui um custo após confirmação.
   * @param {number} id - O ID do custo a ser excluído.
   */
  async function excluirCusto(id) {
    if (!hasPermission('custos:excluir')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    const confirmado = typeof onConfirmAction === 'function'
      ? await onConfirmAction({
          title: 'Excluir custo',
          message: 'Deseja excluir este custo?',
          tone: 'danger',
        })
      : window.confirm('Deseja excluir este custo?');
    if (!confirmado) return;

    const movFinanceira = (db?.movimentacoes_financeiras || []).find(
      (mov) => mov?.origem === 'custo' && Number(mov?.origem_id) === Number(id)
    );
    const custoPersist = await deleteOperationalRecord('custos', id, session);
    let movPersist = { persisted: true };
    if (movFinanceira?.id) {
      movPersist = await deleteOperationalRecord('movimentacoes_financeiras', movFinanceira.id, session);
    }

    setDb((prev) => ({
      ...prev,
      custos: prev.custos.filter((c) => c.id !== id),
      movimentacoes_financeiras: (prev.movimentacoes_financeiras || []).filter(
        (mov) => !(mov?.origem === 'custo' && Number(mov?.origem_id) === Number(id))
      ),
    }));
    if (!custoPersist.persisted || !movPersist.persisted) {
      showToast({ type: 'warning', message: 'Exclusão aplicada apenas localmente.' });
    }
  }

  /**
   * Salva um novo custo ou atualiza um existente.
   * @param {object} dados - Os dados do custo a serem salvos.
   */
  async function salvarCusto(dados) {
    if (!hasPermission('custos:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    if (custoEditando) {
      const custoPersist = await updateOperationalRecord('custos', custoEditando.id, dados, session);
      const custoFinal = { ...custoEditando, ...(custoPersist.data || dados) };
      const ledgerPayload = upsertMovimentacaoFinanceiraDeCusto(
        db?.movimentacoes_financeiras,
        custoFinal
      ).find((mov) => mov?.origem === 'custo' && Number(mov?.origem_id) === Number(custoFinal.id));
      let ledgerPersist = { persisted: true, data: null };
      if (ledgerPayload) {
        const existente = (db?.movimentacoes_financeiras || []).find(
          (mov) => mov?.origem === 'custo' && Number(mov?.origem_id) === Number(custoFinal.id)
        );
        ledgerPersist = existente?.id
          ? await updateOperationalRecord('movimentacoes_financeiras', existente.id, ledgerPayload, session)
          : await createOperationalRecord('movimentacoes_financeiras', ledgerPayload, session);
      }
      setDb((prev) => ({
        ...prev,
        custos: prev.custos.map((c) =>
          c.id === custoEditando.id ? { ...c, ...(custoPersist.data || dados) } : c
        ),
        movimentacoes_financeiras: (() => {
          const atualizadas = upsertMovimentacaoFinanceiraDeCusto(
            prev.movimentacoes_financeiras,
            custoFinal
          );
          if (!ledgerPersist?.data) return atualizadas;
          const idx = atualizadas.findIndex((mov) => mov?.origem === 'custo' && Number(mov?.origem_id) === Number(custoFinal.id));
          if (idx < 0) return [...atualizadas, ledgerPersist.data];
          atualizadas[idx] = { ...atualizadas[idx], ...ledgerPersist.data };
          return atualizadas;
        })(),
      }));
      if (!custoPersist.persisted || !ledgerPersist.persisted) {
        showToast({ type: 'warning', message: 'Alteração salva apenas localmente.' });
      }
    } else {
      const custoPersist = await createOperationalRecord('custos', dados, session);
      setDb((prev) => {
        const novoCusto = {
          id: custoPersist.data?.id || gerarNovoId(prev.custos), // Usa a função gerarNovoId
          ...(custoPersist.data || dados),
        };
        const movsUpsert = upsertMovimentacaoFinanceiraDeCusto(
          prev.movimentacoes_financeiras,
          novoCusto
        );
        const movDoCusto = movsUpsert.find((mov) => mov?.origem === 'custo' && Number(mov?.origem_id) === Number(novoCusto.id));
        if (movDoCusto) {
          void createOperationalRecord('movimentacoes_financeiras', movDoCusto, session);
        }

        return {
          ...prev,
          custos: [...prev.custos, novoCusto],
          movimentacoes_financeiras: movsUpsert,
        };
      });
      if (!custoPersist.persisted) {
        showToast({ type: 'warning', message: 'Cadastro salvo apenas localmente.' });
      }
    }

    setAbrirForm(false);
    setCustoEditando(null);
  }

  return (
    <div className="page">
      <div className="page-header page-topbar">
        <div>
          <h1>Custos Operacionais</h1>
          <p>Lançamento e acompanhamento dos custos por lote.</p>
        </div>

        <div className="page-topbar-actions">
          <button className="primary-btn" onClick={abrirNovo}>
            + Novo custo
          </button>
        </div>
      </div>

      <div className="kpi-grid-3">
        <div className="kpi-card">
          <div className="kpi-label">Total lançado</div>
          <div className="kpi-value">R$ {formatarNumero(resumo.total)}</div>
          <div className="kpi-sub">somando todos os custos</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Lançamentos</div>
          <div className="kpi-value">{resumo.quantidade}</div>
          <div className="kpi-sub">registros cadastrados</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Maior categoria</div>
          <div className="kpi-value kpi-value--large"> {/* Adicionada classe para o tamanho da fonte */}
            {resumo.categoriaTop ? normalizarCategoria(resumo.categoriaTop[0]) : '—'}
          </div>
          <div className="kpi-sub">
            {resumo.categoriaTop
              ? `R$ ${formatarNumero(resumo.categoriaTop[1])}`
              : 'sem dados'}
          </div>
        </div>
      </div>

      <div className="fazendas-card">
        <div className="fazendas-card-header">
          <span className="fazendas-card-title">Lista de custos</span>
        </div>

        <div className="fazendas-table-wrap">
          {dadosTabela.length === 0 ? (
            <div className="empty-box">
              <strong>Nenhum custo cadastrado.</strong>
              <span>Use o botão “Novo custo” para começar.</span>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Lote</th>
                  <th>Categoria</th>
                  <th>Descrição</th>
                  <th>Valor</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {dadosTabela.map((custo) => (
                  <tr key={custo.id}>
                    <td>{formatarData(custo.data)}</td>
                    <td className="text-h">{custo.loteNome}</td>
                    <td>
                      <span className="badge b-blue">
                        {normalizarCategoria(custo.cat)}
                      </span>
                    </td>
                    <td>{custo.desc}</td>
                    <td>R$ {formatarNumero(custo.val)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="action-btn"
                          onClick={() => editarCusto(custo)}
                        >
                          Editar
                        </button>
                        <button
                          className="action-btn action-btn-danger"
                          onClick={() => excluirCusto(custo.id)}
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
        <CustoForm
          initialData={custoEditando}
          lotes={lotes}
          onSave={salvarCusto}
          onCancel={() => {
            setAbrirForm(false);
            setCustoEditando(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * Normaliza o nome da categoria para exibição.
 * @param {string} cat - A categoria do custo.
 * @returns {string} O nome da categoria formatado.
 */
function normalizarCategoria(cat) {
  if (!cat) return '—';

  const mapa = {
    alimentacao: 'Alimentação',
    sanitário: 'Sanitário',
    'mão de obra': 'Mão de obra',
    combustível: 'Combustível',
    manutenção: 'Manutenção',
    administrativo: 'Administrativo',
    outros: 'Outros',
  };

  // Retorna o valor mapeado ou o próprio valor se não encontrado
  return mapa[cat] || cat.charAt(0).toUpperCase() + cat.slice(1); // Capitaliza se não mapeado
}
