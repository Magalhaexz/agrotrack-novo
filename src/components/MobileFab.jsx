import { useState } from 'react';
import { Plus } from 'lucide-react';
import Button from './ui/Button';
import Modal from './ui/Modal';

const acoesPorPagina = {
  lotes: ['Nova Pesagem', 'Registrar Movimentação', 'Novo Lote'],
  estoque: ['Nova Entrada', 'Registrar Saída', 'Novo Item'],
  financeiro: ['Nova Receita', 'Nova Despesa', 'Fluxo de Caixa'],
};

export default function MobileFab({ page, onAction }) {
  const acoes = acoesPorPagina[page] || [];
  const [open, setOpen] = useState(false);

  if (!acoes.length) return null;

  return (
    <>
      <button type="button" className="mobile-fab sem-impressao" onClick={() => setOpen(true)} aria-label="Ações rápidas">
        <Plus size={20} />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Ações rápidas"
        subtitle="Atalhos da página"
      >
        <div style={{ display: 'grid', gap: 10 }}>
          {acoes.map((acao) => (
            <Button
              key={acao}
              variant="outline"
              onClick={() => {
                onAction?.(acao);
                setOpen(false);
              }}
            >
              {acao}
            </Button>
          ))}
        </div>
      </Modal>
    </>
  );
}
