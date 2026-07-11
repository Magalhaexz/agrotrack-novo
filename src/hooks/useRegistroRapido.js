import { useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { useToast } from './useToast';
import { adicionarOperacaoOffline, getFriendlyPendingMessage } from '../services/offlineQueue';

const PERMISSAO_POR_TIPO = {
  pesagem_lote: 'pesagens:editar',
  pesagem_animal: 'pesagens:editar',
  movimentacao_pasto: 'lotes:editar',
  despesa_simples: 'financeiro:editar',
  ocorrencia_manejo: 'sanitario:editar',
};

/**
 * Lógica de "registrar offline" usada pela tela de Sincronização. Não duplica
 * a fila offline em si (`adicionarOperacaoOffline` continua sendo a única
 * fonte de verdade, em `services/offlineQueue.js`).
 */
export function useRegistroRapido(session, status) {
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const [modalAberto, setModalAberto] = useState(null);

  function registrar(tipoOperacao, payload, mensagemSucesso) {
    const permissaoNecessaria = PERMISSAO_POR_TIPO[tipoOperacao];
    if (permissaoNecessaria && !hasPermission(permissaoNecessaria)) {
      showToast({ type: 'error', message: 'Você não tem permissão para executar esta ação.' });
      return;
    }

    const resultado = adicionarOperacaoOffline(tipoOperacao, payload, session);
    if (!resultado.ok) {
      showToast({ type: 'error', message: resultado.error || 'Não foi possível salvar este registro neste aparelho.' });
      return;
    }

    setModalAberto(null);
    status?.atualizarResumo?.();

    if (resultado.duplicado) {
      showToast({ type: 'info', message: 'Este registro já estava aguardando sincronização.' });
      return;
    }

    showToast({
      type: 'success',
      message: status?.online ? `${mensagemSucesso} Sincronizando agora.` : getFriendlyPendingMessage(),
    });
  }

  return {
    modalAberto,
    abrirModal: setModalAberto,
    fecharModal: () => setModalAberto(null),
    registrar,
    hasPermission,
  };
}
