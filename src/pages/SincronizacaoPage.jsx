import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import PageHeader from '../components/PageHeader';
import ConnectionIndicator from '../components/ConnectionIndicator';
import { useAuth } from '../auth/useAuth';
import { useToast } from '../hooks/useToast';
import { useOfflineQueueStatus } from '../hooks/useOfflineQueueStatus';
import { useRegistroRapido } from '../hooks/useRegistroRapido';
import { getFriendlyPendingMessage } from '../services/offlineQueue';
import { formatDate } from '../utils/calculations';
import RegistroRapidoModais from '../components/curral/RegistroRapidoModais';

const TIPO_LABELS = {
  pesagem_lote: 'Pesagem de lote',
  pesagem_animal: 'Pesagem individual',
  movimentacao_pasto: 'Movimentação de pasto',
  despesa_simples: 'Despesa',
  ocorrencia_manejo: 'Ocorrência/manejo',
};

const STATUS_LABELS = {
  pendente: 'Aguardando sincronização',
  sincronizado: 'Sincronizado',
  erro: 'Não foi possível sincronizar ainda',
};

function resumoItem(item) {
  const tipoLabel = TIPO_LABELS[item.tipo_operacao] || item.tipo_operacao;
  const data = item.payload?.data || item.payload?.dataMovimentacao || '';
  return `${tipoLabel}${data ? ` · ${formatDate(data)}` : ''}`;
}

export default function SincronizacaoPage({ db, setDb, session }) {
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const status = useOfflineQueueStatus(session, setDb);
  const { modalAberto, abrirModal, fecharModal, registrar } = useRegistroRapido(session, status);

  const fazendas = Array.isArray(db?.fazendas) ? db.fazendas : [];
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const pastagens = Array.isArray(db?.pastagens) ? db.pastagens : [];

  async function handleSincronizarItem(idLocal) {
    const resultado = await status.sincronizarItemAgora(idLocal);
    if (resultado?.semSessao) {
      showToast({ type: 'warning', message: 'Entre na sua conta para sincronizar os registros salvos neste aparelho.' });
      return;
    }
    if (resultado?.offline) {
      showToast({ type: 'warning', message: 'Sem internet agora. Vamos tentar novamente quando a conexão voltar.' });
      return;
    }
    if (resultado.ok) {
      showToast({ type: 'success', message: 'Registro sincronizado com sucesso.' });
      return;
    }
    showToast({ type: 'warning', message: getFriendlyPendingMessage() });
  }

  async function handleSincronizarAgora() {
    const resultado = await status.sincronizarAgora();
    if (resultado?.semSessao) {
      showToast({ type: 'warning', message: 'Entre na sua conta para sincronizar os registros salvos neste aparelho.' });
      return;
    }
    if (resultado?.offline) {
      showToast({ type: 'warning', message: 'Sem internet agora. Vamos tentar novamente quando a conexão voltar.' });
      return;
    }
    if (resultado.sincronizados > 0 && resultado.comErro === 0) {
      showToast({
        type: 'success',
        message: resultado.sincronizados === 1 ? 'Registro sincronizado com sucesso.' : `${resultado.sincronizados} registros sincronizados com sucesso.`,
      });
      return;
    }
    if (resultado.sincronizados > 0 && resultado.comErro > 0) {
      showToast({ type: 'info', message: `${resultado.sincronizados} sincronizado(s). Ainda há registros pendentes — veja a lista abaixo.` });
      return;
    }
    if (resultado.comErro > 0) {
      showToast({ type: 'warning', message: getFriendlyPendingMessage() });
      return;
    }
    showToast({ type: 'success', message: 'Nada para sincronizar agora.' });
  }

  return (
    <div className="page">
      <PageHeader
        title="Sincronização"
        subtitle="Quando estiver sem internet, alguns registros ficam salvos neste aparelho e serão enviados quando a conexão voltar."
      />

      <Card>
        <div className="action-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <ConnectionIndicator online={status.online} pendentes={status.pendentes} />
          <Button onClick={handleSincronizarAgora} loading={status.sincronizando}>
            Tentar sincronizar agora
          </Button>
        </div>
      </Card>

      <div className="report-kpi-grid">
        <article className="metric-tile">
          <span className="metric-tile__label">Aguardando envio</span>
          <strong className="metric-tile__value">{status.pendentes}</strong>
        </article>
        <article className="metric-tile metric-tile--success">
          <span className="metric-tile__label">Sincronizados</span>
          <strong className="metric-tile__value">{status.sincronizados}</strong>
        </article>
        <article className={`metric-tile ${status.comErro > 0 ? 'metric-tile--warning' : ''}`}>
          <span className="metric-tile__label">Não foi possível enviar</span>
          <strong className="metric-tile__value">{status.comErro}</strong>
        </article>
      </div>

      <Card title="Registrar offline" subtitle="Funciona com ou sem internet. O registro some da lista assim que sincronizar.">
        <div className="dashboard-action-grid dashboard-action-grid--quick">
          <Button variant="outline" onClick={() => abrirModal('pesagem')} disabled={!hasPermission('pesagens:editar')}>Registrar pesagem</Button>
          <Button variant="outline" onClick={() => abrirModal('movimentacao')} disabled={!hasPermission('lotes:editar')}>Mover lote de pasto</Button>
          <Button variant="outline" onClick={() => abrirModal('despesa')} disabled={!hasPermission('financeiro:editar')}>Lançar despesa</Button>
          <Button variant="outline" onClick={() => abrirModal('ocorrencia')} disabled={!hasPermission('sanitario:editar')}>Registrar ocorrência</Button>
        </div>
      </Card>

      <Card title="Registros deste aparelho" subtitle="Histórico de tudo que foi salvo aqui, sincronizado ou não.">
        {status.itens.length === 0 ? (
          <div className="empty-state">
            <p>Nenhum registro salvo neste aparelho ainda.</p>
            <span>Os registros aparecem aqui quando você usar o modo offline, mesmo sem internet.</span>
          </div>
        ) : (
          <div className="dashboard-list">
            {status.itens.map((item) => (
              <article key={item.id_local} className="dashboard-list-item">
                <div className="dashboard-list-copy">
                  <strong>{resumoItem(item)}</strong>
                  <p>{item.status === 'erro' ? (item.erro || STATUS_LABELS.erro) : STATUS_LABELS[item.status]}</p>
                </div>
                <div className="row-actions action-row">
                  <Badge variant={item.status === 'sincronizado' ? 'success' : item.status === 'erro' ? 'danger' : 'warning'}>
                    {item.status === 'sincronizado' ? 'Sincronizado' : item.status === 'erro' ? 'Erro' : 'Pendente'}
                  </Badge>
                  {item.status !== 'sincronizado' ? (
                    <button type="button" className="action-btn" onClick={() => handleSincronizarItem(item.id_local)}>
                      Tentar novamente
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>

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
