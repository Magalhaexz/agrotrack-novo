import { useMemo, useState } from 'react';
import AnimalForm from '../components/AnimalForm';

export default function AnimaisPage({ db, setDb }) {
  const [abrirForm, setAbrirForm] = useState(false);
  const [animalEditando, setAnimalEditando] = useState(null);

  const lotes = db?.lotes || [];
  const animais = db?.animais || [];

  const dadosTabela = useMemo(() => {
    return animais.map((animal) => {
      const lote = lotes.find((l) => l.id === animal.lote_id);

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
  }, [animais, lotes]);

  const resumo = useMemo(() => {
    const totalCabecas = animais.reduce((acc, item) => acc + Number(item.qtd || 0), 0);

    const consumoTotal = animais.reduce(
      (acc, item) => acc + Number(item.qtd || 0) * Number(item.consumo || 0),
      0
    );

    const pesoAtualMedio =
      animais.length > 0
        ? animais.reduce((acc, item) => acc + Number(item.p_at || 0), 0) / animais.length
        : 0;

    return {
      totalCabecas,
      consumoTotal,
      pesoAtualMedio,
    };
  }, [animais]);

  function abrirNovo() {
    setAnimalEditando(null);
    setAbrirForm(true);
  }

  function editarAnimal(animal) {
    setAnimalEditando(animal);
    setAbrirForm(true);
  }

  function excluirAnimal(id) {
    if (!window.confirm('Deseja excluir este registro de animais?')) return;

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
    </div>
  );
}

function gerarNovoId(lista) {
  if (!lista.length) return 1;
  return Math.max(...lista.map((item) => item.id)) + 1;
}

function formatarNumero(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}