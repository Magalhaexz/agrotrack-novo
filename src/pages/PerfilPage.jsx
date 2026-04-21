import { useEffect, useMemo, useState } from 'react';
<<<<<<< HEAD
import { FileText, LogOut } from 'lucide-react'; // Importar LogOut
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import UserAvatar from '../components/UserAvatar'; // Assumindo que UserAvatar é um componente existente
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast'; // Importar useToast
import '../styles/perfil.css';

// Helper function para calcular a força da senha
function calcularForcaSenha(senha) {
  let score = 0;
  if (senha.length >= 8) score += 1;
  if (/[A-Z]/.test(senha) && /[a-z]/.test(senha)) score += 1;
  if (/\d/.test(senha)) score += 1;
  if (/[^\w\s]/.test(senha)) score += 1;

  if (score <= 1) return { score, label: 'Fraca', color: 'var(--color-danger)', percent: 33 };
  if (score <= 3) return { score, label: 'Média', color: 'var(--color-warning)', percent: 66 };
  return { score, label: 'Forte', color: 'var(--color-success)', percent: 100 };
}

export default function PerfilPage({ db, usuarioLogado, atualizarUsuario, onConfirmAction, onSignOut }) {
  const { showToast } = useToast(); // Usar o hook de toast

  const [usuarioLocal, setUsuarioLocal] = useState({
    id: usuarioLogado?.id || '',
    nome: usuarioLogado?.user_metadata?.nome || '',
    email: usuarioLogado?.email || '',
    perfil: usuarioLogado?.user_metadata?.perfil || '',
    foto_url: usuarioLogado?.user_metadata?.avatar_url ?? null,
    telefone: usuarioLogado?.user_metadata?.telefone || '',
    cargo: usuarioLogado?.user_metadata?.cargo || '',
  });

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

  const [preferencias, setPreferencias] = useState({
    tema_escuro: true, // Assumindo que o tema escuro é o padrão ou vem de algum lugar
    notificacoes_email: usuarioLogado?.user_metadata?.notificacoes_email ?? true,
    fazenda_padrao_id: usuarioLogado?.user_metadata?.fazenda_padrao_id || db?.fazendas?.[0]?.id || '',
  });

  // Sincroniza o estado local do usuário com o `usuarioLogado` prop
  useEffect(() => {
    if (!usuarioLogado) return;
    setUsuarioLocal({
      id: usuarioLogado.id || '',
      nome: usuarioLogado.user_metadata?.nome || '',
      email: usuarioLogado.email || '',
      perfil: usuarioLogado.user_metadata?.perfil || '',
      foto_url: usuarioLogado.user_metadata?.avatar_url ?? null,
      telefone: usuarioLogado.user_metadata?.telefone || '',
      cargo: usuarioLogado.user_metadata?.cargo || '',
    });
    setPreferencias((prev) => ({
      ...prev,
      notificacoes_email: usuarioLogado.user_metadata?.notificacoes_email ?? true,
      fazenda_padrao_id: usuarioLogado.user_metadata?.fazenda_padrao_id || db?.fazendas?.[0]?.id || '',
    }));
  }, [usuarioLogado, db.fazendas]); // Adicionado db.fazendas como dependência para o default da fazenda

  const forcaSenha = useMemo(() => calcularForcaSenha(novaSenha), [novaSenha]);

  function handleFotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast({ type: 'error', message: 'Imagem muito grande. Máximo 2MB.' });
      return;
    }

    if (!file.type.startsWith('image/')) {
      showToast({ type: 'error', message: 'Selecione uma imagem válida.' });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setUsuarioLocal((prev) => ({
        ...prev,
        foto_url: String(reader.result || ''),
      }));
    };
    reader.readAsDataURL(file);
  }

  async function salvarDadosPessoais() {
    if (!usuarioLocal.nome.trim()) {
      showToast({ type: 'error', message: 'Nome completo é obrigatório.' });
      return;
    }

    const payload = {
      nome: usuarioLocal.nome.trim(),
      telefone: usuarioLocal.telefone,
      cargo: usuarioLocal.cargo,
      avatar_url: usuarioLocal.foto_url,
      // perfil: usuarioLocal.perfil, // Perfil geralmente não é alterado pelo próprio usuário
    };

    const { error } = await supabase.auth.updateUser({ data: payload });

    if (error) {
      showToast({ type: 'error', message: `Erro ao salvar perfil: ${error.message}` });
      return;
    }

    // Atualiza o contexto/estado global do usuário
    atualizarUsuario?.({
      ...usuarioLogado, // Mantém outras propriedades do usuarioLogado
      user_metadata: {
        ...usuarioLogado?.user_metadata,
        ...payload,
      },
    });
    showToast({ type: 'success', message: 'Perfil salvo com sucesso!' });
  }

  async function alterarSenha() {
    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      showToast({ type: 'error', message: 'Preencha todos os campos de senha.' });
      return;
    }

    if (novaSenha !== confirmarSenha) {
      showToast({ type: 'error', message: 'A confirmação de senha não confere.' });
      return;
    }

    if (forcaSenha.score < 2) { // Score 2 = Média
      showToast({ type: 'warning', message: 'A nova senha está fraca. Use letras maiúsculas, minúsculas, números e símbolos.' });
      return;
    }

    // Supabase não exige a senha atual para `updateUser` se o usuário estiver logado.
    // Se a lógica de backend exigir, isso precisaria ser tratado de outra forma (ex: função Edge).
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    if (error) {
      showToast({ type: 'error', message: `Erro ao alterar senha: ${error.message}` });
      return;
    }

    setSenhaAtual('');
    setNovaSenha('');
    setConfirmarSenha('');
    showToast({ type: 'success', message: 'Senha alterada com sucesso.' });
  }

  async function salvarPreferencias() {
    const { error } = await supabase.auth.updateUser({
      data: {
        notificacoes_email: preferencias.notificacoes_email,
        fazenda_padrao_id: preferencias.fazenda_padrao_id ? Number(preferencias.fazenda_padrao_id) : null,
        tema: preferencias.tema_escuro ? 'escuro' : 'claro', // Salvar o tema real
      },
    });

    if (error) {
      showToast({ type: 'error', message: `Erro ao salvar preferências: ${error.message}` });
      return;
    }

    // Atualiza o contexto/estado global do usuário
    atualizarUsuario?.({
      ...usuarioLogado,
      user_metadata: {
        ...usuarioLogado?.user_metadata,
        notificacoes_email: preferencias.notificacoes_email,
        fazenda_padrao_id: preferencias.fazenda_padrao_id ? Number(preferencias.fazenda_padrao_id) : null,
        tema: preferencias.tema_escuro ? 'escuro' : 'claro',
      },
    });
    showToast({ type: 'success', message: 'Preferências salvas com sucesso.' });
  }

  async function sairDaConta() {
    const confirmado = onConfirmAction
      ? await onConfirmAction({ title: 'Sair da conta', message: 'Deseja sair da conta agora?', tone: 'danger' })
      : window.confirm('Deseja sair da conta agora?');

    if (!confirmado) return;

    if (onSignOut) {
      await onSignOut();
      return;
    }

    await supabase.auth.signOut();
  }

  // Mover estilos para CSS ou usar classes
  const avatarUploadButtonStyle = {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'var(--color-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: '2px solid var(--color-bg)',
    color: '#000',
  };

  return (
    <div className="perfil-page">
      <header className="page-header"> {/* Usar classe page-header para consistência */}
        <h1>Meu Perfil</h1>
        <p>Gerencie seus dados, segurança e preferências da conta.</p>
      </header>

      <Card title="Dados pessoais">
        <div className="perfil-grid">
          <div className="perfil-avatar-box">
            <div style={{ position: 'relative', width: 96, margin: '0 auto 16px' }}>
              <UserAvatar usuario={usuarioLocal} size={96} />
              <label
                htmlFor="foto-upload"
                className="avatar-upload-button" // Usar classe CSS
                style={avatarUploadButtonStyle} // Manter inline para demonstração, mas idealmente mover para CSS
              >
                <FileText size={14} />
              </label>
              <input id="foto-upload" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFotoUpload} />
            </div>
          </div>
          <div className="perfil-form-grid">
            <label className="ui-input-wrap">
              <span className="ui-input-label">Nome completo *</span>
              <input className="ui-input" value={usuarioLocal.nome} onChange={(e) => setUsuarioLocal((prev) => ({ ...prev, nome: e.target.value }))} />
            </label>
            <label className="ui-input-wrap">
              <span className="ui-input-label">E-mail</span>
              <input className="ui-input" value={usuarioLocal.email} readOnly />
            </label>
            <label className="ui-input-wrap">
              <span className="ui-input-label">Telefone</span>
              <input className="ui-input" value={usuarioLocal.telefone} onChange={(e) => setUsuarioLocal((prev) => ({ ...prev, telefone: e.target.value }))} />
            </label>
            <label className="ui-input-wrap">
              <span className="ui-input-label">Cargo / função</span>
              <input className="ui-input" value={usuarioLocal.cargo} onChange={(e) => setUsuarioLocal((prev) => ({ ...prev, cargo: e.target.value }))} />
            </label>
          </div>
        </div>
        <div className="perfil-actions"><Button onClick={salvarDadosPessoais}>Salvar alterações</Button></div>
      </Card>

      <Card title="Segurança" subtitle="Altere sua senha com validação de força">
        <div className="perfil-form-grid">
          <label className="ui-input-wrap">
            <span className="ui-input-label">Senha atual</span>
            <input className="ui-input" type="password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} />
          </label>
          <label className="ui-input-wrap">
            <span className="ui-input-label">Nova senha</span>
            <input className="ui-input" type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
          </label>
          <label className="ui-input-wrap">
            <span className="ui-input-label">Confirmar nova senha</span>
            <input className="ui-input" type="password" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} />
          </label>
        </div>
        <div className="password-meter">
          <div className="password-meter-track"><span style={{ width: `${forcaSenha.percent}%`, background: forcaSenha.color }} /></div>
          <small>Força da senha: {forcaSenha.label}</small>
        </div>
        <div className="perfil-actions"><Button variant="outline" onClick={alterarSenha}>Alterar senha</Button></div>
      </Card>

      <Card title="Preferências">
        <div className="perfil-form-grid">
          <label className="switch-row">
            <span>Tema escuro (padrão)</span>
            <input type="checkbox" checked={preferencias.tema_escuro} onChange={(e) => setPreferencias((prev) => ({ ...prev, tema_escuro: e.target.checked }))} />
          </label>
          <label className="switch-row">
            <span>Notificações por e-mail</span>
            <input type="checkbox" checked={preferencias.notificacoes_email} onChange={(e) => setPreferencias((prev) => ({ ...prev, notificacoes_email: e.target.checked }))} />
          </label>
          <label className="ui-input-wrap">
            <span className="ui-input-label">Fazenda padrão</span>
            <select className="ui-input" value={String(preferencias.fazenda_padrao_id || '')} onChange={(e) => setPreferencias((prev) => ({ ...prev, fazenda_padrao_id: e.target.value }))}>
              <option value="">Nenhuma</option> {/* Adicionar opção "Nenhuma" */}
              {(db.fazendas || []).map((f) => <option key={f.id} value={String(f.id)}>{f.nome}</option>)}
            </select>
          </label>
        </div>
        <div className="perfil-actions"><Button variant="outline" onClick={salvarPreferencias}>Salvar preferências</Button></div>
      </Card>

      <Card title="Sessão">
        <Button variant="danger" icon={<LogOut size={14} />} onClick={sairDaConta}>Sair da conta</Button>
      </Card>
    </div>
  );
}
jsx
import { useEffect, useMemo, useState } from 'react';
import { FileText, LogOut } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import UserAvatar from '../components/UserAvatar';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast'; // Importar useToast
import '../styles/perfil.css';

// Helper function para calcular a força da senha
function calcularForcaSenha(senha) {
  let score = 0;
  if (senha.length >= 8) score += 1;
  if (/[A-Z]/.test(senha) && /[a-z]/.test(senha)) score += 1;
  if (/\d/.test(senha)) score += 1;
  if (/[^\w\s]/.test(senha)) score += 1;

  if (score <= 1) return { score, label: 'Fraca', color: 'var(--color-danger)', percent: 33 };
  if (score <= 3) return { score, label: 'Média', color: 'var(--color-warning)', percent: 66 };
  return { score, label: 'Forte', color: 'var(--color-success)', percent: 100 };
}

export default function PerfilPage({ db, usuarioLogado, atualizarUsuario, onConfirmAction, onSignOut }) {
  const { showToast } = useToast(); // Usar o hook de toast

  const [usuarioLocal, setUsuarioLocal] = useState({
    id: usuarioLogado?.id || '',
    nome: usuarioLogado?.user_metadata?.nome || '',
    email: usuarioLogado?.email || '',
    perfil: usuarioLogado?.user_metadata?.perfil || '',
    foto_url: usuarioLogado?.user_metadata?.avatar_url ?? null,
    telefone: usuarioLogado?.user_metadata?.telefone || '',
    cargo: usuarioLogado?.user_metadata?.cargo || '',
=======
import { FileText, LogOut } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import UserAvatar from '../components/ui/UserAvatar';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/useAuth';
import '../styles/perfil.css';

export default function PerfilPage({ db, onConfirmAction, usuarioLogado, atualizarUsuario, onSignOut }) {
  const { user } = useAuth();
  const nomeInicial = usuarioLogado?.nome || user?.user_metadata?.name || user?.user_metadata?.nome || user?.email?.split('@')[0] || 'Usuário';

  const [usuarioLocal, setUsuarioLocal] = useState({
    id: usuarioLogado?.id || user?.id || null,
    nome: nomeInicial,
    email: usuarioLogado?.email || user?.email || '',
    perfil: usuarioLogado?.perfil || user?.user_metadata?.perfil || 'visualizador',
    foto_url: usuarioLogado?.foto_url || user?.user_metadata?.avatar_url || null,
    telefone: user?.user_metadata?.telefone || '',
    cargo: user?.user_metadata?.cargo || '',
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  });

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

  const [preferencias, setPreferencias] = useState({
<<<<<<< HEAD
    tema_escuro: true, // Assumindo que o tema escuro é o padrão ou vem de algum lugar
    notificacoes_email: usuarioLogado?.user_metadata?.notificacoes_email ?? true,
    fazenda_padrao_id: usuarioLogado?.user_metadata?.fazenda_padrao_id || db?.fazendas?.[0]?.id || '',
  });

  // Sincroniza o estado local do usuário com o `usuarioLogado` prop
  useEffect(() => {
    if (!usuarioLogado) return;
    setUsuarioLocal({
      id: usuarioLogado.id || '',
      nome: usuarioLogado.user_metadata?.nome || '',
      email: usuarioLogado.email || '',
      perfil: usuarioLogado.user_metadata?.perfil || '',
      foto_url: usuarioLogado.user_metadata?.avatar_url ?? null,
      telefone: usuarioLogado.user_metadata?.telefone || '',
      cargo: usuarioLogado.user_metadata?.cargo || '',
    });
    setPreferencias((prev) => ({
      ...prev,
      notificacoes_email: usuarioLogado.user_metadata?.notificacoes_email ?? true,
      fazenda_padrao_id: usuarioLogado.user_metadata?.fazenda_padrao_id || db?.fazendas?.[0]?.id || '',
    }));
  }, [usuarioLogado, db.fazendas]); // Adicionado db.fazendas como dependência para o default da fazenda
=======
    tema_escuro: true,
    notificacoes_email: user?.user_metadata?.notificacoes_email ?? true,
    fazenda_padrao_id: user?.user_metadata?.fazenda_padrao_id || db?.fazendas?.[0]?.id || '',
  });

  useEffect(() => {
    if (!usuarioLogado) return;
    setUsuarioLocal((prev) => ({
      ...prev,
      id: usuarioLogado?.id || prev.id,
      nome: usuarioLogado?.nome || prev.nome,
      email: usuarioLogado?.email || prev.email,
      perfil: usuarioLogado?.perfil || prev.perfil,
      foto_url: usuarioLogado?.foto_url ?? prev.foto_url,
    }));
  }, [usuarioLogado]);
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d

  const forcaSenha = useMemo(() => calcularForcaSenha(novaSenha), [novaSenha]);

  function handleFotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
<<<<<<< HEAD
      showToast({ type: 'error', message: 'Imagem muito grande. Máximo 2MB.' });
=======
      window.alert('Imagem muito grande. Máximo 2MB.');
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
      return;
    }

    if (!file.type.startsWith('image/')) {
<<<<<<< HEAD
      showToast({ type: 'error', message: 'Selecione uma imagem válida.' });
=======
      window.alert('Selecione uma imagem válida.');
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setUsuarioLocal((prev) => ({
        ...prev,
        foto_url: String(reader.result || ''),
      }));
    };
    reader.readAsDataURL(file);
  }

  async function salvarDadosPessoais() {
    if (!usuarioLocal.nome.trim()) {
<<<<<<< HEAD
      showToast({ type: 'error', message: 'Nome completo é obrigatório.' });
=======
      window.alert('Nome completo é obrigatório.');
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
      return;
    }

    const payload = {
<<<<<<< HEAD
=======
      name: usuarioLocal.nome.trim(),
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
      nome: usuarioLocal.nome.trim(),
      telefone: usuarioLocal.telefone,
      cargo: usuarioLocal.cargo,
      avatar_url: usuarioLocal.foto_url,
<<<<<<< HEAD
      // perfil: usuarioLocal.perfil, // Perfil geralmente não é alterado pelo próprio usuário
=======
      perfil: usuarioLocal.perfil,
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
    };

    const { error } = await supabase.auth.updateUser({ data: payload });

    if (error) {
<<<<<<< HEAD
      showToast({ type: 'error', message: `Erro ao salvar perfil: ${error.message}` });
      return;
    }

    // Atualiza o contexto/estado global do usuário
    atualizarUsuario?.({
      ...usuarioLogado, // Mantém outras propriedades do usuarioLogado
      user_metadata: {
        ...usuarioLogado?.user_metadata,
        ...payload,
      },
    });
    showToast({ type: 'success', message: 'Perfil salvo com sucesso!' });
=======
      window.alert(`Erro ao salvar perfil: ${error.message}`);
      return;
    }

    const usuarioAtualizado = {
      id: usuarioLocal.id,
      nome: usuarioLocal.nome.trim(),
      email: usuarioLocal.email,
      perfil: usuarioLocal.perfil,
      foto_url: usuarioLocal.foto_url ?? null,
    };

    atualizarUsuario?.(usuarioAtualizado);
    window.alert('Perfil salvo com sucesso!');
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  }

  async function alterarSenha() {
    if (!senhaAtual || !novaSenha || !confirmarSenha) {
<<<<<<< HEAD
      showToast({ type: 'error', message: 'Preencha todos os campos de senha.' });
=======
      window.alert('Preencha todos os campos de senha.');
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
      return;
    }

    if (novaSenha !== confirmarSenha) {
<<<<<<< HEAD
      showToast({ type: 'error', message: 'A confirmação de senha não confere.' });
      return;
    }

    if (forcaSenha.score < 2) { // Score 2 = Média
      showToast({ type: 'warning', message: 'A nova senha está fraca. Use letras maiúsculas, minúsculas, números e símbolos.' });
      return;
    }

    // Supabase não exige a senha atual para `updateUser` se o usuário estiver logado.
    // Se a lógica de backend exigir, isso precisaria ser tratado de outra forma (ex: função Edge).
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    if (error) {
      showToast({ type: 'error', message: `Erro ao alterar senha: ${error.message}` });
=======
      window.alert('A confirmação de senha não confere.');
      return;
    }

    if (forcaSenha.score < 2) {
      window.alert('A nova senha está fraca. Use letras maiúsculas, minúsculas, números e símbolos.');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    if (error) {
      window.alert(`Erro ao alterar senha: ${error.message}`);
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
      return;
    }

    setSenhaAtual('');
    setNovaSenha('');
    setConfirmarSenha('');
<<<<<<< HEAD
    showToast({ type: 'success', message: 'Senha alterada com sucesso.' });
=======
    window.alert('Senha alterada com sucesso.');
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  }

  async function salvarPreferencias() {
    const { error } = await supabase.auth.updateUser({
      data: {
        notificacoes_email: preferencias.notificacoes_email,
        fazenda_padrao_id: preferencias.fazenda_padrao_id ? Number(preferencias.fazenda_padrao_id) : null,
<<<<<<< HEAD
        tema: preferencias.tema_escuro ? 'escuro' : 'claro', // Salvar o tema real
=======
        tema: 'escuro',
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
      },
    });

    if (error) {
<<<<<<< HEAD
      showToast({ type: 'error', message: `Erro ao salvar preferências: ${error.message}` });
      return;
    }

    // Atualiza o contexto/estado global do usuário
    atualizarUsuario?.({
      ...usuarioLogado,
      user_metadata: {
        ...usuarioLogado?.user_metadata,
        notificacoes_email: preferencias.notificacoes_email,
        fazenda_padrao_id: preferencias.fazenda_padrao_id ? Number(preferencias.fazenda_padrao_id) : null,
        tema: preferencias.tema_escuro ? 'escuro' : 'claro',
      },
    });
    showToast({ type: 'success', message: 'Preferências salvas com sucesso.' });
=======
      window.alert(`Erro ao salvar preferências: ${error.message}`);
      return;
    }

    window.alert('Preferências salvas com sucesso.');
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  }

  async function sairDaConta() {
    const confirmado = onConfirmAction
      ? await onConfirmAction({ title: 'Sair da conta', message: 'Deseja sair da conta agora?', tone: 'danger' })
      : window.confirm('Deseja sair da conta agora?');

    if (!confirmado) return;

    if (onSignOut) {
      await onSignOut();
      return;
    }

    await supabase.auth.signOut();
  }

<<<<<<< HEAD
  // Mover estilos para CSS ou usar classes
  const avatarUploadButtonStyle = {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'var(--color-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: '2px solid var(--color-bg)',
    color: '#000',
  };

  return (
    <div className="perfil-page">
      <header className="page-header"> {/* Usar classe page-header para consistência */}
=======
  return (
    <div className="perfil-page">
      <header>
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
        <h1>Meu Perfil</h1>
        <p>Gerencie seus dados, segurança e preferências da conta.</p>
      </header>

      <Card title="Dados pessoais">
        <div className="perfil-grid">
          <div className="perfil-avatar-box">
            <div style={{ position: 'relative', width: 96, margin: '0 auto 16px' }}>
              <UserAvatar usuario={usuarioLocal} size={96} />
              <label
                htmlFor="foto-upload"
<<<<<<< HEAD
                className="avatar-upload-button" // Usar classe CSS
                style={avatarUploadButtonStyle} // Manter inline para demonstração, mas idealmente mover para CSS
=======
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  border: '2px solid var(--color-bg)',
                  color: '#000',
                }}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
              >
                <FileText size={14} />
              </label>
              <input id="foto-upload" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFotoUpload} />
            </div>
          </div>
          <div className="perfil-form-grid">
<<<<<<< HEAD
            <label className="ui-input-wrap">
              <span className="ui-input-label">Nome completo *</span>
              <input className="ui-input" value={usuarioLocal.nome} onChange={(e) => setUsuarioLocal((prev) => ({ ...prev, nome: e.target.value }))} />
            </label>
            <label className="ui-input-wrap">
              <span className="ui-input-label">E-mail</span>
              <input className="ui-input" value={usuarioLocal.email} readOnly />
            </label>
            <label className="ui-input-wrap">
              <span className="ui-input-label">Telefone</span>
              <input className="ui-input" value={usuarioLocal.telefone} onChange={(e) => setUsuarioLocal((prev) => ({ ...prev, telefone: e.target.value }))} />
            </label>
            <label className="ui-input-wrap">
              <span className="ui-input-label">Cargo / função</span>
              <input className="ui-input" value={usuarioLocal.cargo} onChange={(e) => setUsuarioLocal((prev) => ({ ...prev, cargo: e.target.value }))} />
=======
            <label>Nome completo *
              <input value={usuarioLocal.nome} onChange={(e) => setUsuarioLocal((prev) => ({ ...prev, nome: e.target.value }))} />
            </label>
            <label>E-mail
              <input value={usuarioLocal.email} readOnly />
            </label>
            <label>Telefone
              <input value={usuarioLocal.telefone} onChange={(e) => setUsuarioLocal((prev) => ({ ...prev, telefone: e.target.value }))} />
            </label>
            <label>Cargo / função
              <input value={usuarioLocal.cargo} onChange={(e) => setUsuarioLocal((prev) => ({ ...prev, cargo: e.target.value }))} />
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
            </label>
          </div>
        </div>
        <div className="perfil-actions"><Button onClick={salvarDadosPessoais}>Salvar alterações</Button></div>
      </Card>

      <Card title="Segurança" subtitle="Altere sua senha com validação de força">
        <div className="perfil-form-grid">
<<<<<<< HEAD
          <label className="ui-input-wrap">
            <span className="ui-input-label">Senha atual</span>
            <input className="ui-input" type="password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} />
          </label>
          <label className="ui-input-wrap">
            <span className="ui-input-label">Nova senha</span>
            <input className="ui-input" type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
          </label>
          <label className="ui-input-wrap">
            <span className="ui-input-label">Confirmar nova senha</span>
            <input className="ui-input" type="password" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} />
=======
          <label>Senha atual
            <input type="password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} />
          </label>
          <label>Nova senha
            <input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
          </label>
          <label>Confirmar nova senha
            <input type="password" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} />
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
          </label>
        </div>
        <div className="password-meter">
          <div className="password-meter-track"><span style={{ width: `${forcaSenha.percent}%`, background: forcaSenha.color }} /></div>
          <small>Força da senha: {forcaSenha.label}</small>
        </div>
        <div className="perfil-actions"><Button variant="outline" onClick={alterarSenha}>Alterar senha</Button></div>
      </Card>

      <Card title="Preferências">
        <div className="perfil-form-grid">
          <label className="switch-row">
            <span>Tema escuro (padrão)</span>
            <input type="checkbox" checked={preferencias.tema_escuro} onChange={(e) => setPreferencias((prev) => ({ ...prev, tema_escuro: e.target.checked }))} />
          </label>
          <label className="switch-row">
            <span>Notificações por e-mail</span>
            <input type="checkbox" checked={preferencias.notificacoes_email} onChange={(e) => setPreferencias((prev) => ({ ...prev, notificacoes_email: e.target.checked }))} />
          </label>
<<<<<<< HEAD
          <label className="ui-input-wrap">
            <span className="ui-input-label">Fazenda padrão</span>
            <select className="ui-input" value={String(preferencias.fazenda_padrao_id || '')} onChange={(e) => setPreferencias((prev) => ({ ...prev, fazenda_padrao_id: e.target.value }))}>
              <option value="">Nenhuma</option> {/* Adicionar opção "Nenhuma" */}
=======
          <label>Fazenda padrão
            <select value={String(preferencias.fazenda_padrao_id || '')} onChange={(e) => setPreferencias((prev) => ({ ...prev, fazenda_padrao_id: e.target.value }))}>
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
              {(db.fazendas || []).map((f) => <option key={f.id} value={String(f.id)}>{f.nome}</option>)}
            </select>
          </label>
        </div>
        <div className="perfil-actions"><Button variant="outline" onClick={salvarPreferencias}>Salvar preferências</Button></div>
      </Card>

      <Card title="Sessão">
        <Button variant="danger" icon={<LogOut size={14} />} onClick={sairDaConta}>Sair da conta</Button>
      </Card>
    </div>
  );
}

<<<<<<< HEAD
=======
function calcularForcaSenha(senha) {
  let score = 0;
  if (senha.length >= 8) score += 1;
  if (/[A-Z]/.test(senha) && /[a-z]/.test(senha)) score += 1;
  if (/\d/.test(senha)) score += 1;
  if (/[^\w\s]/.test(senha)) score += 1;

  if (score <= 1) return { score, label: 'Fraca', color: 'var(--color-danger)', percent: 33 };
  if (score <= 3) return { score, label: 'Média', color: 'var(--color-warning)', percent: 66 };
  return { score, label: 'Forte', color: 'var(--color-success)', percent: 100 };
}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
