import { useEffect, useMemo, useState } from 'react';
import { FileText, LogOut } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import UserAvatar from '../components/ui/UserAvatar';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/useAuth';
import '../styles/perfil.css';

export default function PerfilPage({ db, onConfirmAction, usuarioLogado, atualizarUsuario }) {
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
  });

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

  const [preferencias, setPreferencias] = useState({
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

  const forcaSenha = useMemo(() => calcularForcaSenha(novaSenha), [novaSenha]);

  function handleFotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      window.alert('Imagem muito grande. Máximo 2MB.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      window.alert('Selecione uma imagem válida.');
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
      window.alert('Nome completo é obrigatório.');
      return;
    }

    const payload = {
      name: usuarioLocal.nome.trim(),
      nome: usuarioLocal.nome.trim(),
      telefone: usuarioLocal.telefone,
      cargo: usuarioLocal.cargo,
      avatar_url: usuarioLocal.foto_url,
      perfil: usuarioLocal.perfil,
    };

    const { error } = await supabase.auth.updateUser({ data: payload });

    if (error) {
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
  }

  async function alterarSenha() {
    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      window.alert('Preencha todos os campos de senha.');
      return;
    }

    if (novaSenha !== confirmarSenha) {
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
      return;
    }

    setSenhaAtual('');
    setNovaSenha('');
    setConfirmarSenha('');
    window.alert('Senha alterada com sucesso.');
  }

  async function salvarPreferencias() {
    const { error } = await supabase.auth.updateUser({
      data: {
        notificacoes_email: preferencias.notificacoes_email,
        fazenda_padrao_id: preferencias.fazenda_padrao_id ? Number(preferencias.fazenda_padrao_id) : null,
        tema: 'escuro',
      },
    });

    if (error) {
      window.alert(`Erro ao salvar preferências: ${error.message}`);
      return;
    }

    window.alert('Preferências salvas com sucesso.');
  }

  async function sairDaConta() {
    const confirmado = onConfirmAction
      ? await onConfirmAction({ title: 'Sair da conta', message: 'Deseja sair da conta agora?', tone: 'danger' })
      : window.confirm('Deseja sair da conta agora?');

    if (!confirmado) return;

    await supabase.auth.signOut();
  }

  return (
    <div className="perfil-page">
      <header>
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
              >
                <FileText size={14} />
              </label>
              <input id="foto-upload" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFotoUpload} />
            </div>
          </div>
          <div className="perfil-form-grid">
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
            </label>
          </div>
        </div>
        <div className="perfil-actions"><Button onClick={salvarDadosPessoais}>Salvar alterações</Button></div>
      </Card>

      <Card title="Segurança" subtitle="Altere sua senha com validação de força">
        <div className="perfil-form-grid">
          <label>Senha atual
            <input type="password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} />
          </label>
          <label>Nova senha
            <input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
          </label>
          <label>Confirmar nova senha
            <input type="password" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} />
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
          <label>Fazenda padrão
            <select value={String(preferencias.fazenda_padrao_id || '')} onChange={(e) => setPreferencias((prev) => ({ ...prev, fazenda_padrao_id: e.target.value }))}>
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
