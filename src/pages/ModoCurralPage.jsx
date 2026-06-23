import { Scale, MapPinned, Receipt, ClipboardPlus, ListChecks } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import PageHeader from '../components/PageHeader';
import ConnectionIndicator from '../components/ConnectionIndicator';
import { useAuth } from '../auth/useAuth';
import { useOfflineQueueStatus } from '../hooks/useOfflineQueueStatus';
import { useRegistroRapido } from '../hooks/useRegistroRapido';
import RegistroRapidoModais from '../components/curral/RegistroRapidoModais';
import { construirResumoModoCurral, obterMensagemEstadoVazio } from '../domain/modoCurral';

const ACOES = [
  {
    id: 'pesagem',
    label: 'Registrar pesagem',
    description: 'Peso médio do lote, em poucos toques.',
    icon: Scale,
    permissao: 'pesagens:editar',
  },
  {
    id: 'movimentacao',
    label: 'Mover lote de pasto',
    description: 'Troca de pasto com data e motivo.',
    icon: MapPinned,
    permissao: 'lotes:editar',
  },
  {
    id: 'despesa',
    label: 'Lançar despesa',
    description: 'Gasto rápido do dia a dia da fazenda.',
    icon: Receipt,
    permissao: 'financeiro:editar',
  },
  {
    id: 'ocorrencia',
    label: 'Registrar ocorrência',
    description: 'Manejo, sanidade, mortalidade e outros.',
    icon: ClipboardPlus,
    permissao: 'sanitario:editar',
  },
];

export default function ModoCurralPage({ db, setDb, session, onNavigate }) {
  const { hasPermission } = useAuth();
  const status = useOfflineQueueStatus(session, setDb);
  const { modalAberto, abrirModal, fecharModal, registrar } = useRegistroRapido(session, status);

  const fazendas = Array.isArray(db?.fazendas) ? db.fazendas : [];
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const pastagens = Array.isArray(db?.pastagens) ? db.pastagens : [];

  const resumo = construirResumoModoCurral(db);
  const mensagemEstadoVazio = obterMensagemEstadoVazio(resumo, status.online);

  return (
    <div className="page page--modo-curral">
      <PageHeader
        title="Modo Curral"
        subtitle="Registre manejos rápidos no campo, com poucos cliques."
      />

      <Card>
        <div className="action-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <ConnectionIndicator online={status.online} pendentes={status.pendentes} />
          <div className="action-row" style={{ gap: 8 }}>
            <Button variant="outline" onClick={() => onNavigate?.('sincronizacao')}>
              Ver pendências
            </Button>
            <Button onClick={() => status.sincronizarAgora()} loading={status.sincronizando}>
              Tentar sincronizar agora
            </Button>
          </div>
        </div>
        {status.comErro > 0 ? (
          <p className="ui-input-hint" style={{ marginTop: 10 }}>
            Alguns registros ainda não foram enviados. Toque em "Ver pendências" para revisar.
          </p>
        ) : null}
      </Card>

      {mensagemEstadoVazio ? (
        <div className="empty-state">
          <p>{mensagemEstadoVazio}</p>
        </div>
      ) : (
        <>
          <div className="modo-curral-grid">
            {ACOES.map((acao) => {
              const Icon = acao.icon;
              const podeUsar = hasPermission(acao.permissao);
              return (
                <button
                  key={acao.id}
                  type="button"
                  className="modo-curral-card"
                  onClick={() => abrirModal(acao.id)}
                  disabled={!podeUsar}
                >
                  <span className="modo-curral-card__icon" aria-hidden="true">
                    <Icon size={26} />
                  </span>
                  <span className="modo-curral-card__label">{acao.label}</span>
                  <span className="modo-curral-card__desc">{acao.description}</span>
                </button>
              );
            })}
            <button
              type="button"
              className="modo-curral-card modo-curral-card--secondary"
              onClick={() => onNavigate?.('sincronizacao')}
            >
              <span className="modo-curral-card__icon" aria-hidden="true">
                <ListChecks size={26} />
              </span>
              <span className="modo-curral-card__label">Ver pendências</span>
              <span className="modo-curral-card__desc">
                {status.pendentes > 0 ? `${status.pendentes} aguardando sincronização` : 'Nada pendente agora'}
              </span>
            </button>
          </div>

          {!resumo.temPasto ? (
            <p className="ui-input-hint">Cadastre pastos para movimentar lotes no campo.</p>
          ) : null}
        </>
      )}

      <RegistroRapidoModais
        modalAberto={modalAberto}
        fazendas={fazendas}
        lotes={lotes}
        pastagens={pastagens}
        onClose={fecharModal}
        registrar={registrar}
      />
    </div>
  );
}
