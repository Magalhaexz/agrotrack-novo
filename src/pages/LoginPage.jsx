import { useState } from 'react';
import logoAgrotrack from '../assets/logo_app1.png';
import { supabase } from '../lib/supabase';
import '../styles/login.css';

export default function LoginPage() {
  const [modo, setModo] = useState('login');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

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
          <h2>{modo === 'login' ? 'Entrar' : 'Criar conta'}</h2>
          <span>
            {modo === 'login'
              ? 'Acesse o painel da fazenda'
              : 'Crie sua conta para começar'}
          </span>
        </div>

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

          {mensagem ? (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                background: 'rgba(80,180,80,0.12)',
                border: '1px solid rgba(80,180,80,0.24)',
                fontSize: 14,
              }}
            >
              {mensagem}
            </div>
          ) : null}

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
              background: '#fff',
              color: '#111',
              marginTop: 10,
              opacity: carregando ? 0.7 : 1,
            }}
          >
            Entrar com Google
          </button>
        </form>

        <div
          style={{
            marginTop: 18,
            textAlign: 'center',
            fontSize: 14,
            opacity: 0.9,
          }}
        >
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
              color: '#8eea73',
              fontWeight: 700,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {modo === 'login' ? 'Criar conta' : 'Entrar'}
          </button>
        </div>
      </div>
    </div>
  );
}