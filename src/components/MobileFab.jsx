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
      <button
        type="button"
        className="mobile-fab sem-impressao"
        onClick={() => setOpen(true)}
        aria-label="Abrir menu de ações rápidas" // Mais descritivo
        aria-haspopup="dialog" // Indica que o botão abre um diálogo
        aria-expanded={open} // Indica se o diálogo está aberto
      >
        <Plus size={20} aria-hidden="true" /> {/* Ícone decorativo */}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Ações rápidas"
        subtitle="Atalhos da página"
        // Adicionar role="menu" ou role="listbox" se os botões funcionarem como itens de menu/seleção
        // Por enquanto, div com botões é ok, mas dependendo da interação, pode ser melhor.
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