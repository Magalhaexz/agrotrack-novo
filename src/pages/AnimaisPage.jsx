import { useMemo, useState } from 'react';
import { Leaf, Plus, Scale, Users } from 'lucide-react';
import AnimalForm from '../components/AnimalForm';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { TIPOS_SAIDA_ANIMAL } from '../utils/constantes';
import { formatarData, formatarNumero } from '../utils/formatters';
import { gerarNovoId } from '../utils/id';

export default function AnimaisPage({ db, setDb, onConfirmAction }) {
  const [abrirForm, setAbrirForm] = useState(false);
  const [animalEditando, setAnimalEditando] = useState(null);

  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const animais = Array.isArray(db?.animais) ? db.animais : [];
  const movimentacoesAnimais = Array.isArray(db?.movimentacoes_animais) ? db.movimentacoes_animais : [];

  const lotesMap = useMemo(() => new Map(lotes.map((lote) => [Number(lote.id), lote])), [lotes]);

  const dadosTabela = useMemo(() => {
    return animais.map((animal) => {
      const lote = lotesMap.get(Number(animal.lote_id));
      const gmd = Number(animal.dias || 0) > 0
        ? (Number(animal.p_at || 0) - Number(animal.p_ini || 0)) / Number(animal.dias || 1)
        : 0;

      return {
        ...animal,
        loteNome: lote?.nome || '-',
        gmd,
      };
    });
  }, [animais, lotesMap]);

  const resumo = useMemo(() => {
    const totalCabecas = animais.reduce((acc, item) => acc + Number(item.qtd || 0), 0);
    const consumoTotal = animais.reduce((acc, item) => acc + Number(item.qtd || 0) * Number(item.consumo || 0), 0);
    const pesoAtualMedio = totalCabecas
      ? animais.reduce((acc, item) => acc + Number(item.p_at || 0) * Number(item.qtd || 0), 0) / totalCabecas
      : 0;

    const lotesCobertos = new Set(animais.map((animal) => Number(animal.lote_id)).filter(Boolean)).size;

    return {
      totalCabecas,
      consumoTotal,
      pesoAtualMedio,
      lotesCobertos,
    };
  }, [animais]);

  const destaqueAdicionar = useMemo(() => {
    if (!dadosTabela.length) {
      return {
        titulo: 'Cadastre o primeiro grupo de animais',
        descricao: 'Crie grupos por lote com quantidade, peso inicial, peso atual e consumo para alimentar os indicadores do sistema.',
      };
    }

    return {
      titulo: 'Adicionar grupo ficou visivel e centralizado',
      descricao: 'Use o CTA principal para registrar rapidamente novos grupos e manter o rebanho atualizado.',
    };
  }, [dadosTabela.length]);

  const historicoSaidas = useMemo(() => {
    const tiposSaida = Object.keys(TIPOS_SAIDA_ANIMAL);
    return movimentacoesAnimais
      .filter((movimentacao) => tiposSaida.includes(movimentacao.tipo))
      .map((movimentacao) => ({
        ...movimentacao,
        loteNome: lotesMap.get(Number(movimentacao.lote_id))?.nome || '-',
      }))
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [lotesMap, movimentacoesAnimais]);

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

    if (!confirmado) {
      return;
    }

    setDb((prev) => ({
      ...prev,
      animais: (prev.animais || []).filter((animal) => animal.id !== id),
    }));
  }

  function salvarAnimal(dados) {
    if (animalEditando) {
      setDb((prev) => ({
        ...prev,
        animais: (prev.animais || []).map((animal) => (
          animal.id === animalEditando.id ? { ...animal, ...dados } : animal
        )),
      }));
    } else {
      setDb((prev) => ({
        ...prev,
        animais: [
          ...(prev.animais || []),
          {
            id: gerarNovoId(prev.animais || []),
            ...dados,
          },
        ],
      }));
    }

    setAbrirForm(false);
    setAnimalEditando(null);
  }

  return (
    <div className="page animais-page">
      <section className="animais-hero">
        <div className="animais-hero-copy">
          <span className="animais-hero-kicker">Fluxo operacional essencial</span>
          <h1>Animais</h1>
          <p>Controle grupos por lote, acompanhe peso e consumo, e mantenha o fluxo de cadastro sempre acessivel com um CTA principal claro.</p>
        </div>

        <div className="animais-hero-cta-card">
          <div>
            <strong>{destaqueAdicionar.titulo}</strong>
            <p>{destaqueAdicionar.descricao}</p>
          </div>
          <Button icon={<Plus size={16} />} onClick={abrirNovo}>Adicionar grupo de animais</Button>
        </div>
      </section>

      <div className="dashboard-grid dashboard-grid--kpi-main">
        <Card title="Cabecas">
          <div className="animais-kpi-value">{resumo.totalCabecas}</div>
          <p className="animais-kpi-sub">Somando todos os grupos cadastrados</p>
        </Card>
        <Card title="Consumo diario">
          <div className="animais-kpi-value">{formatarNumero(resumo.consumoTotal)} kg</div>
          <p className="animais-kpi-sub">Estimativa com base nos grupos ativos</p>
        </Card>
        <Card title="Peso medio atual">
          <div className="animais-kpi-value">{formatarNumero(resumo.pesoAtualMedio)} kg</div>
          <p className="animais-kpi-sub">Media ponderada pelo tamanho dos grupos</p>
        </Card>
      </div>

      <section className="animais-workspace-shell">
        <div className="animais-content-grid">
          <Card
            className="animais-list-card"
            title="Lista de animais"
            subtitle="Edite ou exclua registros mantendo o cadastro rapido sempre ao lado do historico atual."
            action={<Button size="sm" icon={<Plus size={14} />} onClick={abrirNovo}>Adicionar</Button>}
          >
            {dadosTabela.length === 0 ? (
              <div className="animais-empty-state">
                <strong>Nenhum registro de animais.</strong>
                <span>Use o botao destacado acima para cadastrar o primeiro grupo do rebanho.</span>
                <Button variant="outline" onClick={abrirNovo}>Cadastrar primeiro grupo</Button>
              </div>
            ) : (
              <div className="table-responsive animais-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Lote</th>
                      <th>Sexo</th>
                      <th>Genetica</th>
                      <th>Qtd</th>
                      <th>Peso inicial</th>
                      <th>Peso atual</th>
                      <th>Dias</th>
                      <th>GMD</th>
                      <th>Consumo</th>
                      <th>Acoes</th>
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
                          <span className="animais-gmd-chip">{formatarNumero(animal.gmd)} kg/dia</span>
                        </td>
                        <td>{formatarNumero(animal.consumo)} kg</td>
                        <td>
                          <div className="row-actions">
                            <button className="action-btn" onClick={() => editarAnimal(animal)}>Editar</button>
                            <button className="action-btn action-btn-danger" onClick={() => excluirAnimal(animal.id)}>Excluir</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="animais-add-panel" title="Cadastro rapido" subtitle="Fluxo lateral para registrar um novo grupo sem perder a leitura da listagem.">
            <div className="animais-add-panel-body">
              <div className="animais-side-metrics">
                <div className="animais-side-metric">
                  <span>Lotes cobertos</span>
                  <strong>{resumo.lotesCobertos}</strong>
                </div>
                <div className="animais-side-metric">
                  <span>Peso medio</span>
                  <strong>{formatarNumero(resumo.pesoAtualMedio)} kg</strong>
                </div>
              </div>

              <div className="animais-add-point">
                <Users size={18} />
                <div>
                  <strong>Grupos organizados por lote</strong>
                  <span>Sexo, genetica, quantidade e dias no lote em um unico fluxo.</span>
                </div>
              </div>
              <div className="animais-add-point">
                <Scale size={18} />
                <div>
                  <strong>Peso e rendimento no mesmo cadastro</strong>
                  <span>Facilita previsao de arroba e acompanhamento zootecnico.</span>
                </div>
              </div>
              <div className="animais-add-point">
                <Leaf size={18} />
                <div>
                  <strong>Consumo sempre a vista</strong>
                  <span>Ajuda a cruzar dados com suplementacao e desempenho.</span>
                </div>
              </div>
              <Button fullWidth icon={<Plus size={16} />} onClick={abrirNovo}>Novo grupo agora</Button>
            </div>
          </Card>
        </div>
      </section>

      <Card className="animais-history-card" title="Historico de saidas" subtitle="Venda, morte, descarte e transferencia continuam centralizados nesta area.">
        {historicoSaidas.length === 0 ? (
          <div className="animais-empty-state compact">
            <strong>Nenhuma saida registrada.</strong>
            <span>As movimentacoes de venda, morte, descarte e transferencia aparecerao aqui.</span>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Lote</th>
                  <th>Tipo</th>
                  <th>Quantidade</th>
                  <th>Peso medio</th>
                  <th>Valor total</th>
                  <th>Comprador/destino</th>
                </tr>
              </thead>
              <tbody>
                {historicoSaidas.map((movimentacao) => (
                  <tr key={movimentacao.id}>
                    <td>{formatarData(movimentacao.data)}</td>
                    <td className="text-h">{movimentacao.loteNome}</td>
                    <td><span className="badge b-blue">{normalizarSaida(movimentacao.tipo)}</span></td>
                    <td>{movimentacao.qtd}</td>
                    <td>{formatarNumero(movimentacao.peso_medio)} kg</td>
                    <td>{Number(movimentacao.valor_total || 0) > 0 ? `R$ ${formatarNumero(movimentacao.valor_total)}` : '-'}</td>
                    <td>{movimentacao.comprador_fornecedor || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {abrirForm ? (
        <AnimalForm
          initialData={animalEditando}
          lotes={lotes}
          onSave={salvarAnimal}
          onCancel={() => {
            setAbrirForm(false);
            setAnimalEditando(null);
          }}
        />
      ) : null}
    </div>
  );
}

function normalizarSaida(tipo) {
  return TIPOS_SAIDA_ANIMAL[tipo] || tipo || '-';
}
