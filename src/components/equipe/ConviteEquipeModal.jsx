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
 *
 * P1-11: quando a conta tem mais de uma fazenda, exige escolher a fazenda à
 * qual o convite (e o acesso resultante) fica vinculado — RLS/servidor
 * nunca aceitam fazenda vinda só do cliente sem um convite correspondente,
 * mas a UI já evita mandar um convite sem fazenda definida nesse caso.
 */
export default function ConviteEquipeModal({ open, onClose, onInvite, fazendas = [] }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ nome: '', email: '', perfil: 'visualizador', fazenda_id: '', notes: '' });
  const exigeFazenda = fazendas.length > 1;

  function fecharEReiniciar() {
    setForm({ nome: '', email: '', perfil: 'visualizador', fazenda_id: '', notes: '' });
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
          if (exigeFazenda && !form.fazenda_id) {
            showToast({ type: 'error', message: 'Escolha a fazenda à qual este membro terá acesso.' });
            return;
          }
          const fazendaId = form.fazenda_id || (fazendas.length === 1 ? fazendas[0].id : null);
          onInvite?.({ ...form, nome: form.nome.trim(), email: form.email.trim(), fazenda_id: fazendaId });
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
        {exigeFazenda ? (
          <label className="ui-input-wrap">
            <span className="ui-input-label">Fazenda</span>
            <select className="ui-input" value={form.fazenda_id} onChange={(e) => setForm((prev) => ({ ...prev, fazenda_id: e.target.value }))}>
              <option value="">Selecione a fazenda</option>
              {fazendas.map((fazenda) => (
                <option key={fazenda.id} value={fazenda.id}>{fazenda.nome}</option>
              ))}
            </select>
          </label>
        ) : null}
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
