import { useMemo, useState } from 'react';
import AnimalForm from '../components/AnimalForm';
import { formatarNumero, formatarData } from '../utils/formatters';
import { gerarNovoId } from '../utils/id';
import { TIPOS_SAIDA_ANIMAL } from '../utils/constantes';

/**
 * Componente para a página de gestão de animais.
 * Exibe a lista de grupos de animais, um resumo de KPIs e o histórico de saídas.
 * Permite adicionar, editar e excluir registros de animais.
 *
 * @param {object} props - As propriedades do componente.
 * @param {object} props.db - O objeto do banco de dados.
 * @param {function} props.setDb - Função para atualizar o banco de dados.
 * @param {function} [props.onConfirmAction] - Função para exibir um modal de confirmação customizado.
 */
export default function AnimaisPage({ db, setDb, onConfirmAction }) {
  const [abrirForm, setAbrirForm] = useState(false);
  const [animalEditando, setAnimalEditando] = useState(null);

  const lotes = db?.lotes || [];
  const animais = db?.animais || [];
  const movimentacoesAnimais = db?.movimentacoes_animais || [];

  // Cria um mapa de lotes para buscas eficientes por ID
  const lotesMap = useMemo(() => {
    return new Map(lotes.map(lote => [lote.id, lote]));
  }, [lotes]);

  const dadosTabela = useMemo(() => {
    return animais.map((animal) => {
      const lote = lotesMap.get(animal.lote_id); // Busca otimizada
      const gmd =
        Number(animal.dias || 0) > 0
          ? (Number(animal.p_at || 0) - Number(animal.p_ini || 0)) / Number(animal.dias || 1)
          : 0;

      return {
        ...animal,
        loteNome: lote?.nome || '—',
        gmd,
      };
    });
  }, [animais, lotesMap]); // Depende de lotesMap

  const resumo = useMemo(() => {
    const totalCabecas = animais.reduce((acc, item) => acc + Number(item.qtd || 0), 0);

    const consumoTotal = animais.reduce(
      (acc, item) => acc + Number(item.qtd || 0) * Number(item.consumo || 0),
      0
    );

    const pesoAtualMedio = totalCabecas
      ? animais.reduce(
          (acc, item) =>
            acc + Number(item.p_at || 0) * Number(item.qtd || 0),
          0
        ) / totalCabecas
      : 0;

    return {
      totalCabecas,
      consumoTotal,
      pesoAtualMedio,
    };
  }, [animais]);

  const historicoSaidas = useMemo(() => {
    const tiposSaida = Object.keys(TIPOS_SAIDA_ANIMAL);

    return movimentacoesAnimais
      .filter((mov) => tiposSaida.includes(mov.tipo))
      .map((mov) => {
        const lote = lotesMap.get(mov.lote_id); // Busca otimizada
        return {
          ...mov,
          loteNome: lote?.nome || '—',
        };
      })
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()); // Usar getTime() para comparação robusta
  }, [movimentacoesAnimais, lotesMap]); // Depende de lotesMap

  function abrirNovo() {
    setAnimalEditando(null);
    setAbrirForm(true);
  }

  function editarAnimal(animal) {
    setAnimalEditando(animal);
    setAbrirForm(true);
  }

  async function excluirAnimal(id) {
    const confirmado = typeof onConfirmAction === 'function'
      ? await onConfirmAction({
          title: 'Excluir registro de animais',
          message: 'Deseja excluir este registro de animais?',
          tone: 'danger',
        })
      : window.confirm('Deseja excluir este registro de animais?');
    if (!confirmado) return;

    setDb((prev) => ({
      ...prev,
      animais: prev.animais.filter((a) => a.id !== id),
    }));
  }

  function salvarAnimal(dados) {
    if (animalEditando) {
      setDb((prev) => ({
        ...prev,
        animais: prev.animais.map((a) =>
          a.id === animalEditando.id ? { ...a, ...dados } : a
        ),
      }));
    } else {
      setDb((prev) => ({
        ...prev,
        animais: [
          ...prev.animais,
          {
            id: gerarNovoId(prev.animais),
            ...dados,
          },
        ],
      }));
    }

    setAbrirForm(false);
    setAnimalEditando(null);
  }

  return (
    <div className="page">
      <div className="page-header page-topbar">
        <div>
          <h1>Animais</h1>
          <p>Controle por lote, sexo, genética, peso e consumo.</p>
        </div>

        <div className="page-topbar-actions">
          <button className="primary-btn" onClick={abrirNovo}>
            + Novo grupo
          </button>
        </div>
      </div>

      <div className="kpi-grid-3">
        <div className="kpi-card">
          <div className="kpi-label">Cabeças</div>
          <div className="kpi-value">{resumo.totalCabecas}</div>
          <div className="kpi-sub">somando todos os grupos</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Consumo total</div>
          <div className="kpi-value">{formatarNumero(resumo.consumoTotal)} kg</div>
          <div className="kpi-sub">consumo diário estimado</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Peso atual médio</div>
          <div className="kpi-value">{formatarNumero(resumo.pesoAtualMedio)} kg</div>
          <div className="kpi-sub">média entre os registros</div>
        </div>
      </div>

      <div className="fazendas-card">
        <div className="fazendas-card-header">
          <span className="fazendas-card-title">Lista de animais</span>
        </div>

        <div className="fazendas-table-wrap">
          {dadosTabela.length === 0 ? (
            <div className="empty-box">
              <strong>Nenhum registro de animais.</strong>
              <span>Use o botão “Novo grupo” para começar.</span>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Sexo</th>
                  <th>Genética</th>
                  <th>Qtd</th>
                  <th>Peso inicial</th>
                  <th>Peso atual</th>
                  <th>Dias</th>
                  <th>GMD</th>
                  <th>Consumo</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {dadosTabela.map((animal) => (
                  <tr key={animal.id}>
                    <td className="text-h">{animal.loteNome}</td>
                    <td>{animal.sexo}</td>
                    <td>{animal.gen}</td>
                    <td>{animal.qtd}</td>
                    <td>{formatarNumero(animal.p_ini)} kg</td>
                    <td>{formatarNumero(animal.p_at)} kg</td>
                    <td>{animal.dias}</td>
                    <td>
                      <span className="badge b-green">
                        {formatarNumero(animal.gmd)} kg/dia
                      </span>
                    </td>
                    <td>{formatarNumero(animal.consumo)} kg</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="action-btn"
                          onClick={() => editarAnimal(animal)}
                        >
                          Editar
                        </button>
                        <button
                          className="action-btn action-btn-danger"
                          onClick={() => excluirAnimal(animal.id)}
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
        <AnimalForm
          initialData={animalEditando}
          lotes={lotes}
          onSave={salvarAnimal}
          onCancel={() => {
            setAbrirForm(false);
            setAnimalEditando(null);
          }}
        />
      )}

      <div className="fazendas-card" style={{ marginTop: 24 }}>
        <div className="fazendas-card-header">
          <span className="fazendas-card-title">Histórico de saídas</span>
        </div>

        <div className="fazendas-table-wrap">
          {historicoSaidas.length === 0 ? (
            <div className="empty-box">
              <strong>Nenhuma saída registrada.</strong>
              <span>As saídas de venda, morte, descarte e transferência aparecerão aqui.</span>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Lote</th>
                  <th>Tipo</th>
                  <th>Quantidade</th>
                  <th>Peso médio</th>
                  <th>Valor total</th>
                  <th>Comprador/destino</th>
                </tr>
              </thead>
              <tbody>
                {historicoSaidas.map((mov) => (
                  <tr key={mov.id}>
                    <td>{formatarData(mov.data)}</td>
                    <td className="text-h">{mov.loteNome}</td>
                    <td>
                      <span className="badge b-blue">{normalizarSaida(mov.tipo)}</span>
                    </td>
                    <td>{mov.qtd}</td>
                    <td>{formatarNumero(mov.peso_medio)} kg</td>
                    <td>
                      {Number(mov.valor_total || 0) > 0
                        ? `R$ ${formatarNumero(mov.valor_total)}`
                        : '—'}
                    </td>
                    <td>{mov.comprador_fornecedor || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Normaliza o tipo de saída de animal para uma string mais legível.
 * @param {string} tipo - O tipo de saída (ex: 'venda', 'morte').
 * @returns {string} O label correspondente ou o próprio tipo se não encontrado.
 */
function normalizarSaida(tipo) {
  return TIPOS_SAIDA_ANIMAL[tipo] || tipo || '—';
}
