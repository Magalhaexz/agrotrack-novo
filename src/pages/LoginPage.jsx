import { useMemo, useState } from 'react';
import logoAgrotrack from '../assets/logo_app1.png';
import { supabase } from '../lib/supabase';
import '../styles/login.css';

function calcularForcaSenha(senha) {
  let pontos = 0;
  if (senha.length >= 8) pontos += 1;
  if (/[A-Z]/.test(senha) && /[a-z]/.test(senha)) pontos += 1;
  if (/\d/.test(senha)) pontos += 1;
  if (/[^\w\s]/.test(senha)) pontos += 1;

  if (pontos <= 1) return { label: 'Fraca', color: 'var(--color-danger)' };
  if (pontos <= 3) return { label: 'Média', color: 'var(--color-warning)' };
  return { label: 'Forte', color: 'var(--color-success)' };
}

export default function LoginPage() {
  const [modo, setModo] = useState('login');
  const [etapaRecuperacao, setEtapaRecuperacao] = useState(1);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const forcaSenha = useMemo(() => calcularForcaSenha(novaSenha), [novaSenha]);

  async function handleSubmit(e) {
    e.preventDefault();

    if (carregando) return;

    setErro('');
    setMensagem('');
    setCarregando(true);

    try {
      if (!email.trim() || !senha.trim()) {
        setErro('Preencha e-mail e senha.');
        return;
      }

      if (modo === 'cadastro') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: senha,
          options: {
            data: {
              nome: nome || '',
              perfil: 'visualizador',
            },
          },
        });

        if (error) throw error;

        if (data?.session) {
          setMensagem('Conta criada e login realizado com sucesso.');
          return;
        }

        setMensagem(
          'Cadastro realizado com sucesso. Agora entre com seu e-mail e senha.'
        );
        setModo('login');
        setSenha('');
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      });

      if (error) throw error;

      if (!data?.session) {
        setErro(
          'Login não concluído. Verifique se a confirmação de e-mail está ativada no Supabase.'
        );
      }
    } catch (err) {
      console.error('Erro de autenticação:', err);
      setErro(err?.message || 'Erro ao autenticar.');
    } finally {
      setCarregando(false);
    }
  }

  async function enviarRecuperacaoSenha(e) {
    e.preventDefault();
    if (carregando) return;

    setCarregando(true);
    setErro('');
    setMensagem('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      if (error) throw error;

      setEtapaRecuperacao(2);
      setMensagem('Link de recuperação enviado. Confira sua caixa de entrada.');
    } catch (err) {
      setErro(err?.message || 'Não foi possível enviar o link de recuperação.');
    } finally {
      setCarregando(false);
    }
  }

  async function redefinirSenha(e) {
    e.preventDefault();
    if (carregando) return;

    setCarregando(true);
    setErro('');
    setMensagem('');

    try {
      if (novaSenha.length < 8) {
        setErro('A nova senha precisa ter pelo menos 8 caracteres.');
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) throw error;

      setEtapaRecuperacao(3);
      setMensagem('Senha atualizada com sucesso. Você já pode entrar no sistema.');
      setModo('login');
      setSenha('');
      setNovaSenha('');
    } catch (err) {
      setErro(err?.message || 'Não foi possível redefinir a senha.');
    } finally {
      setCarregando(false);
    }
  }

  async function loginComGoogle() {
    if (carregando) return;

    setErro('');
    setMensagem('');
    setCarregando(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) throw error;
    } catch (err) {
      console.error('Erro ao entrar com Google:', err);
      setErro(err?.message || 'Erro ao entrar com Google.');
      setCarregando(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div
          className="login-brand"
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          <img
            src={logoAgrotrack}
            alt="AgroTrack"
            loading="lazy"
            style={{
              width: '340px',
              maxWidth: '88%',
              height: 'auto',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </div>

        <div className="login-header">
          <h2>
            {modo === 'login'
              ? 'Entrar'
              : modo === 'cadastro'
              ? 'Criar conta'
              : `Recuperar senha (etapa ${etapaRecuperacao}/3)`}
          </h2>
        </div>

        {(modo === 'login' || modo === 'cadastro') && (
          <form onSubmit={handleSubmit} className="login-form">
            {modo === 'cadastro' ? (
              <>
                <label htmlFor="nome">Nome</label>
                <input
                  id="nome"
                  type="text"
                  placeholder="Seu nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </>
            ) : null}

            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              placeholder="voce@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label htmlFor="senha">Senha</label>
            <input
              id="senha"
              type="password"
              placeholder="Sua senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />

            {erro ? <div className="login-error">{erro}</div> : null}
            {mensagem ? <div className="login-success">{mensagem}</div> : null}

            <button type="submit" className="login-btn" disabled={carregando}>
              {carregando
                ? 'Carregando...'
                : modo === 'login'
                ? 'Entrar'
                : 'Criar conta'}
            </button>

            <button
              type="button"
              className="login-btn"
              onClick={loginComGoogle}
              disabled={carregando}
              style={{
                background: 'var(--color-surface-2)',
                color: 'var(--color-text)',
                marginTop: 10,
                opacity: carregando ? 0.7 : 1,
              }}
            >
              Entrar com Google
            </button>
          </form>
        )}

        {modo === 'recuperar' && (
          <div className="login-form">
            {etapaRecuperacao === 1 && (
              <form onSubmit={enviarRecuperacaoSenha} className="login-form">
                <label htmlFor="email-recuperacao">E-mail</label>
                <input
                  id="email-recuperacao"
                  type="email"
                  placeholder="voce@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button type="submit" className="login-btn" disabled={carregando}>
                  Enviar link
                </button>
              </form>
            )}

            {etapaRecuperacao === 2 && (
              <form onSubmit={redefinirSenha} className="login-form">
                <p style={{ fontSize: 13, opacity: 0.85 }}>
                  Após abrir o link recebido no e-mail, defina a nova senha abaixo.
                </p>
                <label htmlFor="nova-senha">Nova senha</label>
                <input
                  id="nova-senha"
                  type="password"
                  placeholder="Digite a nova senha"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                />
                <div style={{ fontSize: 12, color: forcaSenha.color }}>
                  Força da senha: {forcaSenha.label}
                </div>
                <button type="submit" className="login-btn" disabled={carregando}>
                  Redefinir senha
                </button>
              </form>
            )}

            {etapaRecuperacao === 3 && (
              <p style={{ fontSize: 14 }}>Processo concluído. Faça login com a nova senha.</p>
            )}
          </div>
        )}

        {erro ? <div className="login-error">{erro}</div> : null}
        {mensagem ? <div className="login-success">{mensagem}</div> : null}

        <div style={{ marginTop: 18, textAlign: 'center', fontSize: 14, opacity: 0.9 }}>
          {modo === 'login' ? 'Ainda não tem conta?' : 'Já tem conta?'}{' '}
          <button
            type="button"
            onClick={() => {
              if (carregando) return;
              setModo((prev) => (prev === 'login' ? 'cadastro' : 'login'));
              setErro('');
              setMensagem('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-primary)',
              fontWeight: 700,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {modo === 'login' ? 'Criar conta' : 'Entrar'}
          </button>
          {' · '}
          <button
            type="button"
            onClick={() => {
              if (carregando) return;
              setModo('recuperar');
              setEtapaRecuperacao(1);
              setErro('');
              setMensagem('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-primary)',
              fontWeight: 700,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Esqueci minha senha
          </button>
        </div>
      </div>
    </div>
  );
}
