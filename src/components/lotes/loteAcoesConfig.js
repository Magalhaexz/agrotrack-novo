import { Settings, ClipboardList, DollarSign, AlertTriangle, Truck, MapPinned, CheckCircle2, Weight } from 'lucide-react';

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
// `grupo` (Sprint Visual 5): só agrupa visualmente o mesmo menu — 'comum'
// (editar/ajustar), 'movimentacao' (venda/morte/transferência/pasto) e
// 'encerramento' (ação destrutiva, sempre isolada por último).
export const LOTE_ACOES = [
  {
    // Sprint Visual 6: reaproveita integralmente o fluxo já existente de
    // cadastro de pesagem (Pesagens > Nova pesagem, navigationIntent com
    // loteId) — nenhum fluxo novo, só um atalho a partir do menu compacto
    // de Lotes, onde essa ação nunca tinha ficado disponível.
    id: 'novaPesagem',
    label: 'Registrar pesagem',
    icon: Weight,
    variant: 'outline',
    permissao: 'pesagens:editar',
    handlerKey: 'onNovaPesagem',
    grupo: 'comum',
    bloqueadoPor: (lote) => Boolean(lote?.bloqueado),
  },
  {
    id: 'editar',
    label: 'Editar',
    icon: Settings,
    variant: 'ghost',
    permissao: 'lotes:editar',
    handlerKey: 'onEditar',
    grupo: 'comum',
    bloqueadoPor: (lote) => Boolean(lote?.bloqueado),
  },
  {
    id: 'ajusteLotacao',
    label: 'Ajuste de lotação',
    icon: ClipboardList,
    variant: 'outline',
    permissao: 'lotes:editar',
    handlerKey: 'onAjusteLotacao',
    grupo: 'comum',
    bloqueadoPor: (lote) => Boolean(lote?.bloqueado),
  },
  {
    id: 'venda',
    label: 'Venda',
    icon: DollarSign,
    variant: 'warning',
    permissao: 'animais:movimentar',
    handlerKey: 'onVenda',
    grupo: 'movimentacao',
    bloqueadoPor: (lote) => Boolean(lote?.bloqueado),
  },
  {
    id: 'mortePerda',
    label: 'Morte/perda',
    icon: AlertTriangle,
    variant: 'warning',
    permissao: 'animais:movimentar',
    handlerKey: 'onMortePerda',
    grupo: 'movimentacao',
    bloqueadoPor: (lote) => Boolean(lote?.bloqueado),
  },
  {
    id: 'transferenciaSaida',
    label: 'Transferência de saída',
    icon: Truck,
    variant: 'warning',
    permissao: 'animais:movimentar',
    handlerKey: 'onTransferenciaSaida',
    grupo: 'movimentacao',
    bloqueadoPor: (lote) => Boolean(lote?.bloqueado),
  },
  {
    id: 'trocarPasto',
    label: 'Trocar lote de pasto',
    icon: MapPinned,
    variant: 'outline',
    permissao: 'lotes:editar',
    handlerKey: 'onTrocarPasto',
    grupo: 'movimentacao',
    bloqueadoPor: (lote) => Boolean(lote?.bloqueado),
  },
  {
    id: 'finalizar',
    label: 'Finalizar lote',
    icon: CheckCircle2,
    variant: 'danger',
    permissao: 'lotes:editar',
    handlerKey: 'onFinalizar',
    grupo: 'encerramento',
    bloqueadoPor: (lote) => Boolean(lote?.bloqueado),
  },
];

export const LOTE_ACOES_GRUPOS = [
  { id: 'comum', label: null },
  { id: 'movimentacao', label: 'Movimentações' },
  { id: 'encerramento', label: null },
];
