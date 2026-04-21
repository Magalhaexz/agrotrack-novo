import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import FazendaForm from '../components/FazendaForm';
import { gerarNovoId } from '../utils/id';

export default function FazendasPage({ db, setDb, onConfirmAction, onNavigate }) {
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState(null);

  const fazendas = Array.isArray(db?.fazendas) ? db.fazendas : [];
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const funcionarios = Array.isArray(db?.funcionarios) ? db.funcionarios : [];

  const cards = useMemo(() => {
    return fazendas.map((fazenda) => {
      const lotesAtivos = lotes.filter((l) => Number(l.faz_id) === Number(fazenda.id) && (l.status || 'ativo') === 'ativo').length;
      const colaboradores = funcionarios.filter((f) => Number(f.fazenda_id) === Number(fazenda.id)).length;
      return { ...fazenda, lotesAtivos, colaboradores };
    });
  }, [fazendas, lotes, funcionarios]);

  function abrirCadastro() {
    setEditando(null);
    setAberto(true);
  }

  function salvarFazenda(dados) {
    if (editando) {
      setDb((prev) => ({
        ...prev,
        fazendas: (prev.fazendas || []).map((f) =>
          Number(f.id) === Number(editando.id) ? { ...f, ...dados } : f
        ),
      }));
    } else {
      setDb((prev) => ({
        ...prev,
        fazendas: [
          ...(prev.fazendas || []),
          {
            id: gerarNovoId(prev.fazendas || []),
            ...dados,
            created_at: new Date().toISOString(),
          },
        ],
      }));
    }

    setAberto(false);
    setEditando(null);
  }

  async function alternarStatus(fazenda) {
    const novoStatus = (fazenda.status || 'ativa') === 'ativa' ? 'inativa' : 'ativa';
    const confirmado = typeof onConfirmAction === 'function'
      ? await onConfirmAction({
          title: `${novoStatus === 'ativa' ? 'Ativar' : 'Desativar'} fazenda`,
          message: `Deseja ${novoStatus === 'ativa' ? 'ativar' : 'desativar'} ${fazenda.nome}?`,
          tone: 'warning',
        })
      : true;

    if (!confirmado) return;

    setDb((prev) => ({
      ...prev,
      fazendas: (prev.fazendas || []).map((f) =>
        Number(f.id) === Number(fazenda.id) ? { ...f, status: novoStatus } : f
      ),
    }));
  }

  return (
    <div className="page">
      <PageHeader
        title="Minhas Fazendas"
        subtitle="Cadastro e controle completo das propriedades"
        actions={<Button onClick={abrirCadastro}>+ Cadastrar Fazenda</Button>}
      />

      {cards.length === 0 ? (
        <div className="ui-card"><strong>Nenhuma fazenda cadastrada</strong></div>
      ) : (
        <div className="grid-3">
          {cards.map((fazenda) => (
            <article key={fazenda.id} className="ui-card" style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>{fazenda.nome}</h3>
                <Badge variant={(fazenda.status || 'ativa') === 'ativa' ? 'success' : 'warning'}>
                  {(fazenda.status || 'ativa') === 'ativa' ? 'Ativa' : 'Inativa'}
                </Badge>
              </div>

              <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>{fazenda.cidade} / {fazenda.estado}</p>
              <p style={{ margin: 0 }}>Área total: <strong>{fazenda.area_total_ha || 0} ha</strong> · Pastagem: <strong>{fazenda.area_pastagem_ha || 0} ha</strong></p>
              <p style={{ margin: 0 }}>Capacidade: <strong>{fazenda.capacidade_ua || 0} UA</strong></p>
              <p style={{ margin: 0 }}>Produção: <Badge variant="info">{fazenda.tipo_producao || '—'}</Badge></p>
              <p style={{ margin: 0 }}>Lotes ativos: <strong>{fazenda.lotesAtivos}</strong> · Funcionários: <strong>{fazenda.colaboradores}</strong></p>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button size="sm" variant="outline" onClick={() => { setEditando(fazenda); setAberto(true); }}>
                  Editar
                </Button>
                <Button size="sm" variant="secondary" onClick={() => onNavigate?.('lotes')}>
                  Ver Lotes
                </Button>
                <Button size="sm" variant="ghost" onClick={() => alternarStatus(fazenda)}>
                  {(fazenda.status || 'ativa') === 'ativa' ? 'Desativar' : 'Ativar'}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <FazendaForm
        key={editando?.id || 'novo'}
        open={aberto}
        initialData={editando}
        onSave={salvarFazenda}
        onCancel={() => {
          setAberto(false);
          setEditando(null);
        }}
      />
    </div>
  );
}
