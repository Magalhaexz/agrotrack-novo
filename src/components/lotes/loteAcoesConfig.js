import { Settings, ClipboardList, DollarSign, AlertTriangle, Truck, MapPinned, CheckCircle2 } from 'lucide-react';

// Fonte única do menu de ações do lote (Parte 2 do sprint de fechamento) —
// usada por LoteCard (listagem), LoteDetailsPanel (detalhe) e qualquer outro
// consumidor futuro, via LoteAcoesMenu. Elimina listas duplicadas e rótulos
// divergentes entre telas (ex.: bug 1.4 — "Trocar lote" era na verdade
// finalizar, corrigido só em um lugar antes desta config existir).
//
// `permissao`: checada com hasPermission(perm).
// `bloqueadoPor`: recebe o lote e devolve true quando a ação deve ficar
// desabilitada além da permissão (lote encerrado/vendido).
// `handlerKey`: chave no objeto `handlers` passado a <LoteAcoesMenu>.
export const LOTE_ACOES = [
  {
    id: 'editar',
    label: 'Editar',
    icon: Settings,
    variant: 'ghost',
    permissao: 'lotes:editar',
    handlerKey: 'onEditar',
    bloqueadoPor: (lote) => Boolean(lote?.bloqueado),
  },
  {
    id: 'ajusteLotacao',
    label: 'Ajuste de lotação',
    icon: ClipboardList,
    variant: 'outline',
    permissao: 'lotes:editar',
    handlerKey: 'onAjusteLotacao',
    bloqueadoPor: (lote) => Boolean(lote?.bloqueado),
  },
  {
    id: 'venda',
    label: 'Venda',
    icon: DollarSign,
    variant: 'warning',
    permissao: 'animais:movimentar',
    handlerKey: 'onVenda',
    bloqueadoPor: (lote) => Boolean(lote?.bloqueado),
  },
  {
    id: 'mortePerda',
    label: 'Morte/perda',
    icon: AlertTriangle,
    variant: 'warning',
    permissao: 'animais:movimentar',
    handlerKey: 'onMortePerda',
    bloqueadoPor: (lote) => Boolean(lote?.bloqueado),
  },
  {
    id: 'transferenciaSaida',
    label: 'Transferência de saída',
    icon: Truck,
    variant: 'warning',
    permissao: 'animais:movimentar',
    handlerKey: 'onTransferenciaSaida',
    bloqueadoPor: (lote) => Boolean(lote?.bloqueado),
  },
  {
    id: 'trocarPasto',
    label: 'Trocar lote de pasto',
    icon: MapPinned,
    variant: 'outline',
    permissao: 'lotes:editar',
    handlerKey: 'onTrocarPasto',
    bloqueadoPor: (lote) => Boolean(lote?.bloqueado),
  },
  {
    id: 'finalizar',
    label: 'Finalizar lote',
    icon: CheckCircle2,
    variant: 'danger',
    permissao: 'lotes:editar',
    handlerKey: 'onFinalizar',
    bloqueadoPor: (lote) => Boolean(lote?.bloqueado),
  },
];
