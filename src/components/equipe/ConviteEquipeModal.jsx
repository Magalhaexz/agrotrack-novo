import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useToast } from '../../hooks/useToast';

const PAPEIS_CONVITE = [
  { value: 'gerente', label: 'Gerente' },
  { value: 'operador', label: 'Operador' },
  { value: 'visualizador', label: 'Visualizador' },
];

/**
 * Modal de convite de membro (Sprint 6). Proprietário informa e-mail e
 * papel; a página (`EquipePage`) decide onde persistir (tabela `invites`
 * quando disponível). Sem envio de e-mail real nesta sprint — ver
 * docs/EQUIPE_PERMISSOES_HERDON.md.
 */
export default function ConviteEquipeModal({ open, onClose, onInvite }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ nome: '', email: '', perfil: 'visualizador', notes: '' });

  function fecharEReiniciar() {
    setForm({ nome: '', email: '', perfil: 'visualizador', notes: '' });
    onClose?.();
  }

  return (
    <Modal open={open} onClose={fecharEReiniciar} title="Convidar membro" subtitle="Informe e-mail e papel — o convite fica pendente até o cadastro.">
      <form
        className="equipe-convite-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.nome.trim() || !form.email.trim()) {
            showToast({ type: 'error', message: 'Informe nome e e-mail do membro.' });
            return;
          }
          onInvite?.({ ...form, nome: form.nome.trim(), email: form.email.trim() });
        }}
      >
        <label className="ui-input-wrap">
          <span className="ui-input-label">Nome</span>
          <input className="ui-input" value={form.nome} onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))} />
        </label>
        <label className="ui-input-wrap">
          <span className="ui-input-label">E-mail</span>
          <input className="ui-input" type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
        </label>
        <label className="ui-input-wrap">
          <span className="ui-input-label">Papel</span>
          <select className="ui-input" value={form.perfil} onChange={(e) => setForm((prev) => ({ ...prev, perfil: e.target.value }))}>
            {PAPEIS_CONVITE.map((papel) => (
              <option key={papel.value} value={papel.value}>{papel.label}</option>
            ))}
          </select>
        </label>
        <label className="ui-input-wrap">
          <span className="ui-input-label">Observação interna (opcional)</span>
          <input className="ui-input" value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />
        </label>
        <div className="equipe-convite-form__acoes">
          <Button type="button" variant="ghost" onClick={fecharEReiniciar}>Cancelar</Button>
          <Button type="submit">Convidar</Button>
        </div>
      </form>
    </Modal>
  );
}
