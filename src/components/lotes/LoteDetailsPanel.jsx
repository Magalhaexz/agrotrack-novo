import Button from '../ui/Button';
import LoteAnimaisTab from './LoteAnimaisTab';
import LoteFinanceiroTab from './LoteFinanceiroTab';
import LoteHistoricoTab from './LoteHistoricoTab';
import LoteNutricaoTab from './LoteNutricaoTab';
import LoteOverviewTab from './LoteOverviewTab';
import LotePastagensTab from './LotePastagensTab';
import LotePesagensTab from './LotePesagensTab';
import LoteRetiradasTab from './LoteRetiradasTab';
import LoteSanitarioTab from './LoteSanitarioTab';
import LoteAcoesMenu from './LoteAcoesMenu';
import { LOTE_TABS } from './constants';

export default function LoteDetailsPanel({
  lote,
  resumo,
  activeTab,
  onChangeTab,
  onBack,
  canMove,
  canEdit,
  canEditPesagem,
  onEditar,
  onAjusteLotacao,
  onVenda,
  onMortePerda,
  onTransferenciaSaida,
  onNovaPesagem,
  onFinalizar,
  onTrocarPasto,
  onGerarRelatorio,
  animais,
  pesagens,
  retiradas,
  sanitarios,
  financeiros,
  historico,
  historicoPastos,
  loadingHistoricoPastos,
  consumoNutricao,
  consumoAlerta,
  onDeleteHistoricoConsumo,
}) {
  function hasPermission(permissao) {
    if (permissao === 'lotes:editar') return canEdit;
    if (permissao === 'animais:movimentar') return canMove;
    return true;
  }
  return (
    <div className="rebanho-page">
      <div className="rebanho-header page-header">
        <div>
          <h1>{lote.nome}</h1>
          <p>
            Fazenda {lote.fazendaNome || 'não vinculada'}
            {' '}
            • Pasto {lote.pastagemNome || '—'}
            {' '}
            • Categoria {lote.categoriaAnimal || '—'}
            {' '}
            • Raça {lote.raca || '—'}
            {' '}
            • Status {lote.status}
          </p>
        </div>
        <div className="lote-actions page-actions action-row">
          <Button variant="ghost" onClick={onBack}>Voltar para lotes</Button>
          <Button variant="outline" onClick={onGerarRelatorio}>Gerar relatório do lote</Button>
          <Button variant="outline" onClick={onNovaPesagem} disabled={!canEditPesagem || lote.bloqueado}>Nova pesagem</Button>
        </div>
        <LoteAcoesMenu
          lote={lote}
          hasPermission={hasPermission}
          handlers={{
            onEditar,
            onAjusteLotacao,
            onVenda,
            onMortePerda,
            onTransferenciaSaida,
            onTrocarPasto,
            onFinalizar,
          }}
        />
      </div>

      <div className="tabs-row tabs-row-scroll tab-bar">
        {LOTE_TABS.map((tab) => (
          <button
            type="button"
            key={tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => onChangeTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'visao_geral' ? <LoteOverviewTab lote={lote} resumo={resumo} /> : null}
      {activeTab === 'animais' ? <LoteAnimaisTab animais={animais} /> : null}
      {activeTab === 'pastagem' ? (
        <LotePastagensTab
          lote={lote}
          historico={historicoPastos}
          loadingHistorico={loadingHistoricoPastos}
          canMove={canEdit && !lote.bloqueado}
          onMoverPasto={onTrocarPasto}
        />
      ) : null}
      {activeTab === 'pesagens' ? <LotePesagensTab pesagens={pesagens} onNovaPesagem={onNovaPesagem} canEditPesagem={canEditPesagem && !lote.bloqueado} /> : null}
      {activeTab === 'retiradas' ? <LoteRetiradasTab retiradas={retiradas} onNovaRetirada={onVenda} canMove={canMove && !lote.bloqueado} /> : null}
      {activeTab === 'nutricao' ? <LoteNutricaoTab lote={lote} consumo={consumoNutricao} alertaConsumo={consumoAlerta} /> : null}
      {activeTab === 'sanitario' ? <LoteSanitarioTab itens={sanitarios} /> : null}
      {activeTab === 'financeiro' ? <LoteFinanceiroTab movimentos={financeiros} resumo={resumo} /> : null}
      {activeTab === 'historico' ? <LoteHistoricoTab historico={historico} onDeleteConsumo={onDeleteHistoricoConsumo} /> : null}
    </div>
  );
}
