import Button from '../ui/Button';
import LoteAnimaisTab from './LoteAnimaisTab';
import LoteFinanceiroTab from './LoteFinanceiroTab';
import LoteHistoricoTab from './LoteHistoricoTab';
import LoteNutricaoTab from './LoteNutricaoTab';
import LoteOverviewTab from './LoteOverviewTab';
import LotePesagensTab from './LotePesagensTab';
import LoteRetiradasTab from './LoteRetiradasTab';
import LoteSanitarioTab from './LoteSanitarioTab';
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
  onNovaRetirada,
  onNovaPesagem,
  onEncerrar,
  animais,
  pesagens,
  retiradas,
  sanitarios,
  financeiros,
  historico,
  consumoNutricao,
}) {
  return (
    <div className="rebanho-page">
      <div className="rebanho-header page-header">
        <div>
          <h1>{lote.nome}</h1>
          <p>Fazenda {lote.fazendaNome || 'não vinculada'} • Status {lote.status}</p>
        </div>
        <div className="lote-actions page-actions action-row">
          <Button variant="ghost" onClick={onBack}>Voltar para lotes</Button>
          <Button variant="outline" onClick={onNovaPesagem} disabled={!canEditPesagem || lote.bloqueado}>Nova pesagem</Button>
          <Button variant="warning" onClick={onNovaRetirada} disabled={!canMove || lote.bloqueado}>Retirada</Button>
          <Button variant="danger" onClick={onEncerrar} disabled={!canEdit || lote.bloqueado}>Encerrar lote</Button>
        </div>
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
      {activeTab === 'pesagens' ? <LotePesagensTab pesagens={pesagens} onNovaPesagem={onNovaPesagem} canEditPesagem={canEditPesagem && !lote.bloqueado} /> : null}
      {activeTab === 'retiradas' ? <LoteRetiradasTab retiradas={retiradas} onNovaRetirada={onNovaRetirada} canMove={canMove && !lote.bloqueado} /> : null}
      {activeTab === 'nutricao' ? <LoteNutricaoTab lote={lote} consumo={consumoNutricao} /> : null}
      {activeTab === 'sanitario' ? <LoteSanitarioTab itens={sanitarios} /> : null}
      {activeTab === 'financeiro' ? <LoteFinanceiroTab movimentos={financeiros} resumo={resumo} /> : null}
      {activeTab === 'historico' ? <LoteHistoricoTab historico={historico} /> : null}
    </div>
  );
}
