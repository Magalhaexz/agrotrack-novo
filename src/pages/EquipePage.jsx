import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import BloqueadoPorPermissao from '../components/BloqueadoPorPermissao';
import MembroEquipeCard from '../components/equipe/MembroEquipeCard';
import ConviteEquipeModal from '../components/equipe/ConviteEquipeModal';
import PermissoesPerfilResumo from '../components/equipe/PermissoesPerfilResumo';
import { useAuth } from '../auth/useAuth';
import { useToast } from '../hooks/useToast';
import { obterLabelPerfil, perfilPodeGerenciarAcessos } from '../auth/perfis';
import { contarUsuariosDoPlano, podeAlterarPapel, podeRemoverAcesso, separarProprietarioEMembros } from '../domain/equipe';
import {
  createInvite,
  deleteInvite,
  isAccessModuleUnavailable,
  listInvites,
  listProfiles,
  updateInvite,
  updateProfilePerfil,
  updateProfileStatus,
} from '../services/userAccess';
import { canInviteUser, getSubscriptionLimitMessage } from '../services/subscriptions';
import { createAuditEvent } from '../services/operationalPersistence';
import '../styles/equipe.css';

function mensagemErroSegura(error, fallbackMessage) {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('jwt') || message.includes('token') || message.includes('permission') || message.includes('rls') || message.includes('auth') || message.includes('failed to fetch')) {
    return fallbackMessage;
  }
  return error?.message || fallbackMessage;
}

/**
 * Página "Equipe" (Sprint 6): quem acessa a conta HERDON, com que papel, e
 * ações de convidar/alterar papel/remover acesso. Substitui a antiga aba
 * "Usuários e Acessos" de Configurações — mesma base (`services/userAccess.js`,
 * tabelas `profiles`/`invites`), agora em página própria e com as
 * salvaguardas de `domain/equipe.js` (não remover o único proprietário, não
 * rebaixar o próprio papel até ficar sem admin, etc.).
 */
export default function EquipePage({ db = null, onConfirmAction, subscription = null, onNavigate = null }) {
  const { perfil, user, session } = useAuth();
  const { showToast } = useToast();
  const podeGerenciar = perfilPodeGerenciarAcessos(perfil);

  const [profilesRows, setProfilesRows] = useState([]);
  const [invitesRows, setInvitesRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [moduloDisponivel, setModuloDisponivel] = useState(true);
  const [openInvite, setOpenInvite] = useState(false);

  function registrarAuditoria(evento) {
    void createAuditEvent({ ...evento, usuario_id: user?.id || null }, session);
  }

  const carregar = useCallback(async () => {
    if (!podeGerenciar) return;
    setLoading(true);
    const [profilesResponse, invitesResponse] = await Promise.all([listProfiles(), listInvites()]);

    if (profilesResponse.error || invitesResponse.error) {
      const erro = profilesResponse.error || invitesResponse.error;
      if (!isAccessModuleUnavailable(erro)) {
        showToast({ type: 'error', message: erro.message || 'Não foi possível carregar a equipe agora.' });
      }
      setModuloDisponivel(false);
      setProfilesRows([]);
      setInvitesRows([]);
      setLoading(false);
      return;
    }

    setProfilesRows(profilesResponse.data || []);
    setInvitesRows(invitesResponse.data || []);
    setModuloDisponivel(true);
    setLoading(false);
  }, [podeGerenciar, showToast]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void carregar();
  }, [carregar]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const { proprietario, membros } = useMemo(() => separarProprietarioEMembros(profilesRows), [profilesRows]);
  const membrosAtivos = useMemo(() => membros.filter((m) => String(m?.status || 'ativo').toLowerCase() !== 'removido'), [membros]);
  const membrosRemovidos = useMemo(() => membros.filter((m) => String(m?.status || 'ativo').toLowerCase() === 'removido'), [membros]);
  const invitesPendentes = useMemo(
    () => invitesRows.filter((invite) => ['pendente', 'enviado'].includes(String(invite?.status || '').toLowerCase())),
    [invitesRows]
  );
  const totalUsuariosPlano = useMemo(
    () => contarUsuariosDoPlano({ profiles: profilesRows, invites: invitesRows }),
    [profilesRows, invitesRows]
  );
  const limiteUsuarios = useMemo(() => canInviteUser(subscription, totalUsuariosPlano), [subscription, totalUsuariosPlano]);

  async function alterarPapel(membro, novoPerfil) {
    if (novoPerfil === membro.perfil) return;
    const resultado = podeAlterarPapel({ atorPerfil: perfil, membros: profilesRows, membroId: membro.id, novoPerfil, atorId: user?.id });
    if (!resultado.permitido) {
      showToast({ type: 'warning', message: resultado.motivo });
      return;
    }
    const confirmar = onConfirmAction
      ? await onConfirmAction({ title: 'Alterar papel', message: `Alterar o papel de ${membro.nome || membro.email} para ${obterLabelPerfil(novoPerfil)}?`, tone: 'warning' })
      : window.confirm('Alterar o papel deste usuário pode limitar o acesso dele ao sistema. Deseja continuar?');
    if (!confirmar) return;

    const { error } = await updateProfilePerfil(membro.id, novoPerfil);
    if (error) {
      showToast({ type: 'error', message: mensagemErroSegura(error, 'Não foi possível alterar o papel agora.') });
      return;
    }
    registrarAuditoria({
      acao: 'equipe_papel_atualizado',
      entidade: 'profiles',
      entidade_id: membro.id,
      criticidade: 'alta',
      detalhes: { perfil_anterior: membro.perfil, perfil_novo: novoPerfil },
    });
    showToast({ type: 'success', message: 'Papel atualizado com sucesso.' });
    await carregar();
  }

  async function removerAcesso(membro) {
    const resultado = podeRemoverAcesso({ atorPerfil: perfil, membros: profilesRows, membroId: membro.id, atorId: user?.id });
    if (!resultado.permitido) {
      showToast({ type: 'warning', message: resultado.motivo });
      return;
    }
    const confirmar = onConfirmAction
      ? await onConfirmAction({ title: 'Remover acesso', message: `Remover o acesso de ${membro.nome || membro.email}? Ele deixará de acessar sua conta HERDON.`, tone: 'danger' })
      : window.confirm('Remover o acesso deste usuário?');
    if (!confirmar) return;

    const { error } = await updateProfileStatus(membro.id, 'removido');
    if (error) {
      showToast({ type: 'error', message: mensagemErroSegura(error, 'Não foi possível remover o acesso agora.') });
      return;
    }
    registrarAuditoria({
      acao: 'equipe_acesso_removido',
      entidade: 'profiles',
      entidade_id: membro.id,
      criticidade: 'alta',
      detalhes: { nome: membro.nome, email: membro.email },
    });
    showToast({ type: 'success', message: 'Acesso removido.' });
    await carregar();
  }

  async function cancelarConvite(invite) {
    const confirmar = onConfirmAction
      ? await onConfirmAction({ title: 'Cancelar convite', message: `Deseja cancelar o convite de ${invite.email}?`, tone: 'danger' })
      : window.confirm(`Deseja cancelar o convite de ${invite.email}?`);
    if (!confirmar) return;

    let response = await updateInvite(invite.id, { status: 'cancelado', canceled_at: new Date().toISOString() });
    if (response.error) {
      response = await updateInvite(invite.id, { status: 'cancelado' });
    }
    if (response.error) {
      showToast({ type: 'error', message: mensagemErroSegura(response.error, 'Não foi possível cancelar o convite agora.') });
      return;
    }
    registrarAuditoria({ acao: 'convite_cancelado', entidade: 'invites', entidade_id: invite.id, criticidade: 'media', detalhes: { email: invite.email } });
    showToast({ type: 'success', message: 'Convite cancelado.' });
    await carregar();
  }

  async function removerConvitePendente(invite) {
    const confirmar = onConfirmAction
      ? await onConfirmAction({ title: 'Remover convite pendente', message: `Remover convite pendente de ${invite.email}?`, tone: 'danger' })
      : window.confirm(`Remover convite pendente de ${invite.email}?`);
    if (!confirmar) return;

    const { error } = await deleteInvite(invite.id);
    if (error) {
      showToast({ type: 'error', message: mensagemErroSegura(error, 'Não foi possível remover o convite agora.') });
      return;
    }
    registrarAuditoria({ acao: 'convite_removido', entidade: 'invites', entidade_id: invite.id, criticidade: 'media', detalhes: { email: invite.email } });
    showToast({ type: 'success', message: 'Convite pendente removido.' });
    await carregar();
  }

  async function enviarConvite(payload) {
    if (!limiteUsuarios.allowed) {
      showToast({ type: 'warning', message: getSubscriptionLimitMessage('users', limiteUsuarios) || 'Regularize sua assinatura para convidar mais pessoas.' });
      setOpenInvite(false);
      onNavigate?.('minhaAssinatura', { action: 'upgrade', motivo: 'limite_usuarios' });
      return;
    }

    const { error } = await createInvite({
      email: payload.email,
      nome: payload.nome,
      perfil: payload.perfil,
      fazenda_id: payload.fazenda_id || null,
      status: 'pendente',
      notes: payload.notes || null,
      created_by: user?.id || null,
      owner_user_id: user?.id || null,
    });

    if (error) {
      showToast({ type: 'error', message: mensagemErroSegura(error, 'Não foi possível criar o convite agora.') });
      return;
    }
    registrarAuditoria({ acao: 'convite_criado', entidade: 'invites', criticidade: 'alta', detalhes: { email: payload.email, perfil: payload.perfil } });
    showToast({ type: 'success', message: 'Convite criado. O papel será aplicado automaticamente no cadastro.' });
    setOpenInvite(false);
    await carregar();
  }

  function abrirConvite() {
    if (!limiteUsuarios.allowed) {
      showToast({ type: 'warning', message: getSubscriptionLimitMessage('users', limiteUsuarios) || 'Regularize sua assinatura para convidar mais pessoas.' });
      onNavigate?.('minhaAssinatura', { action: 'upgrade', motivo: 'limite_usuarios' });
      return;
    }
    setOpenInvite(true);
  }

  if (!podeGerenciar) {
    return (
      <div className="page equipe-page">
        <PageHeader title="Equipe" subtitle="Gerencie quem acessa sua conta HERDON." />
        <BloqueadoPorPermissao mensagem="Você não tem permissão para acessar esta página." />
      </div>
    );
  }

  return (
    <div className="page equipe-page">
      <PageHeader
        title="Equipe"
        subtitle="Gerencie quem acessa sua conta HERDON."
        actions={(
          <Button icon={<Plus size={14} />} onClick={abrirConvite}>
            Convidar membro
          </Button>
        )}
      />

      <p className="equipe-uso-plano">
        Usuários: {totalUsuariosPlano}
        {limiteUsuarios.limit != null ? `/${limiteUsuarios.limit}` : ' (ilimitado)'}
        {!limiteUsuarios.allowed ? ' — limite do plano atingido.' : ''}
      </p>

      <PermissoesPerfilResumo />

      <Card title="Proprietário" subtitle="Dono da conta — acesso total, não pode ser removido.">
        {proprietario ? (
          <MembroEquipeCard membro={proprietario} isProprietario isSelf={String(proprietario.id) === String(user?.id)} />
        ) : (
          <EmptyState compact title="Proprietário não encontrado." />
        )}
      </Card>

      <Card
        title="Membros da equipe"
        subtitle="Pessoas com acesso à sua conta HERDON, além do proprietário."
        action={<Button variant="outline" size="sm" onClick={carregar} loading={loading}>Atualizar</Button>}
      >
        {!moduloDisponivel ? (
          <EmptyState compact title="Não foi possível carregar a equipe agora." subtitle="Tente atualizar a lista em instantes." />
        ) : membrosAtivos.length === 0 ? (
          <EmptyState compact title="Você ainda não tem outros membros na equipe." subtitle="Convide um gerente, operador ou visualizador para ajudar na operação." />
        ) : (
          <div className="equipe-lista">
            {membrosAtivos.map((membro) => (
              <MembroEquipeCard
                key={membro.id}
                membro={membro}
                isSelf={String(membro.id) === String(user?.id)}
                onAlterarPapel={(novoPerfil) => alterarPapel(membro, novoPerfil)}
                onRemover={() => removerAcesso(membro)}
              />
            ))}
          </div>
        )}

        {membrosRemovidos.length > 0 ? (
          <>
            <p className="equipe-secao-titulo">Acessos removidos</p>
            <div className="equipe-lista">
              {membrosRemovidos.map((membro) => (
                <MembroEquipeCard key={membro.id} membro={membro} />
              ))}
            </div>
          </>
        ) : null}
      </Card>

      <Card title="Convites pendentes" subtitle="Aguardando aceite — o papel é aplicado automaticamente no cadastro.">
        {invitesPendentes.length === 0 ? (
          <EmptyState compact title="Nenhum convite pendente." />
        ) : (
          <div className="equipe-lista">
            {invitesPendentes.map((invite) => (
              <div key={invite.id} className="equipe-convite-row">
                <div className="equipe-convite-row__info">
                  <strong>{invite.nome || 'Convite sem nome'}</strong>
                  <span>{invite.email} — {obterLabelPerfil(invite.perfil)}</span>
                </div>
                <div className="equipe-convite-row__acoes">
                  <Button size="sm" variant="outline" onClick={() => cancelarConvite(invite)}>Cancelar convite</Button>
                  <Button size="sm" variant="danger" onClick={() => removerConvitePendente(invite)}>Remover</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ConviteEquipeModal open={openInvite} onClose={() => setOpenInvite(false)} onInvite={enviarConvite} fazendas={db?.fazendas || []} />
    </div>
  );
}
