import RegistrarPesagemOfflineModal from '../offline/RegistrarPesagemOfflineModal';
import RegistrarMovimentacaoPastoOfflineModal from '../offline/RegistrarMovimentacaoPastoOfflineModal';
import RegistrarDespesaOfflineModal from '../offline/RegistrarDespesaOfflineModal';
import RegistrarOcorrenciaOfflineModal from '../offline/RegistrarOcorrenciaOfflineModal';

const MENSAGENS_SUCESSO = {
  pesagem_lote: 'Pesagem registrada.',
  movimentacao_pasto: 'Movimentação registrada.',
  despesa_simples: 'Despesa registrada.',
  ocorrencia_manejo: 'Ocorrência registrada.',
};

/**
 * Agrupa os 4 modais de registro rápido (já existentes desde o Modo Campo
 * Offline) para serem reaproveitados pela tela de Sincronização, sem duplicar
 * formulário, validação ou regra de negócio.
 */
export default function RegistroRapidoModais({ modalAberto, fazendas = [], lotes = [], pastagens = [], onClose, registrar }) {
  return (
    <>
      <RegistrarPesagemOfflineModal
        open={modalAberto === 'pesagem'}
        fazendas={fazendas}
        lotes={lotes}
        onClose={onClose}
        onSubmit={(payload) => registrar('pesagem_lote', payload, MENSAGENS_SUCESSO.pesagem_lote)}
      />
      <RegistrarMovimentacaoPastoOfflineModal
        open={modalAberto === 'movimentacao'}
        fazendas={fazendas}
        lotes={lotes}
        pastagens={pastagens}
        onClose={onClose}
        onSubmit={(payload) => registrar('movimentacao_pasto', payload, MENSAGENS_SUCESSO.movimentacao_pasto)}
      />
      <RegistrarDespesaOfflineModal
        open={modalAberto === 'despesa'}
        fazendas={fazendas}
        onClose={onClose}
        onSubmit={(payload) => registrar('despesa_simples', payload, MENSAGENS_SUCESSO.despesa_simples)}
      />
      <RegistrarOcorrenciaOfflineModal
        open={modalAberto === 'ocorrencia'}
        fazendas={fazendas}
        lotes={lotes}
        onClose={onClose}
        onSubmit={(payload) => registrar('ocorrencia_manejo', payload, MENSAGENS_SUCESSO.ocorrencia_manejo)}
      />
    </>
  );
}
