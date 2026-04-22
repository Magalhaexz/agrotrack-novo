import { useMemo, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import logoAgrotrack from '../assets/logo_app1.png';
import { supabase } from '../lib/supabase';
// import { useToast } from '../hooks/useToast'; // Assumindo que useToast está disponível
import '../styles/login.css';

/**
 * Calcula a força de uma senha com base em critérios específicos.
 * @param {string} senha - A senha a ser avaliada.
 * @returns {{label: string, color: string}} Um objeto com o rótulo e a cor da força da senha.
 */
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

/**
 * Componente da página de Login, Cadastro e Recuperação de Senha.
 * Gerencia a autenticação de usuários via Supabase.
 */
export default function LoginPage() {
  // const { showToast } = useToast(); // Se usar useToast

  const [modo, setModo] = useState('login');
  const [etapaRecuperacao, setEtapaRecuperacao] = useState(1);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [mensagem, setMensagem] = useState(''); // Para mensagens de sucesso
  const [erro, setErro] = useState(''); // Para mensagens de erro
  const [carregando, setCarregando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);

  const forcaSenha = useMemo(() => calcularForcaSenha(novaSenha), [novaSenha]);

  /**
   * Lida com o envio do formulário de login ou cadastro.
   * @param {Event} e - O evento de envio do formulário.
   */
  async function handleSubmit(e) {
    e.preventDefault();

    if (carregando) return;

    setErro('');
    setMensagem('');
    setCarregando(true);

    try {
      if (!email.trim() || !senha.trim()) {
        setErro('Preencha e-mail e senha.');
        // showToast({ type: 'error', message: 'Preencha e-mail e senha.' });
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
          // showToast({ type: 'success', message: 'Conta criada e login realizado com sucesso.' });
          return;
        }

        setMensagem(
          'Cadastro realizado com sucesso. Agora entre com seu e-mail e senha.'
        );
        // showToast({ type: 'success', message: 'Cadastro realizado com sucesso. Agora entre com seu e-mail e senha.' });
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
        // showToast({ type: 'error', message: 'Login não concluído. Verifique se a confirmação de e-mail está ativada no Supabase.' });
      }
    } catch (err) {
      console.error('Erro de autenticação:', err);
      setErro(err?.message || 'Erro ao autenticar.');
      // showToast({ type: 'error', message: err?.message || 'Erro ao autenticar.' });
    } finally {
      setCarregando(false);
    }
  }

  /**
   * Envia um link de recuperação de senha para o e-mail do usuário.
   * @param {Event} e - O evento de envio do formulário.
   */
  async function enviarRecuperacaoSenha(e) {
    e.preventDefault();
    if (carregando) return;

    setCarregando(true);
    setErro('');
    setMensagem('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin, // Redireciona para a URL atual após o clique no link do e-mail
      });
      if (error) throw error;

      setEtapaRecuperacao(2);
      setMensagem('Link de recuperação enviado. Confira sua caixa de entrada.');
      // showToast({ type: 'success', message: 'Link de recuperação enviado. Confira sua caixa de entrada.' });
    } catch (err) {
      setErro(err?.message || 'Não foi possível enviar o link de recuperação.');
      // showToast({ type: 'error', message: err?.message || 'Não foi possível enviar o link de recuperação.' });
    } finally {
      setCarregando(false);
    }
  }

  /**
   * Redefine a senha do usuário após a confirmação via e-mail.
   * @param {Event} e - O evento de envio do formulário.
   */
  async function redefinirSenha(e) {
    e.preventDefault();
    if (carregando) return;

    setCarregando(true);
    setErro('');
    setMensagem('');

    try {
      if (novaSenha.length < 8) {
        setErro('A nova senha precisa ter pelo menos 8 caracteres.');
        // showToast({ type: 'error', message: 'A nova senha precisa ter pelo menos 8 caracteres.' });
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) throw error;

      setEtapaRecuperacao(3);
      setMensagem('Senha atualizada com sucesso. Você já pode entrar no sistema.');
      // showToast({ type: 'success', message: 'Senha atualizada com sucesso. Você já pode entrar no sistema.' });
      setModo('login');
      setSenha('');
      setNovaSenha('');
    } catch (err) {
      setErro(err?.message || 'Não foi possível redefinir a senha.');
      // showToast({ type: 'error', message: err?.message || 'Não foi possível redefinir a senha.' });
    } finally {
      setCarregando(false);
    }
  }

  /**
   * Lida com o login via Google OAuth.
   */
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
      // Supabase redirecionará o usuário, então não há mais lógica aqui
    } catch (err) {
      console.error('Erro ao entrar com Google:', err);
      setErro(err?.message || 'Erro ao entrar com Google.');
      // showToast({ type: 'error', message: err?.message || 'Erro ao entrar com Google.' });
    } finally {
      setCarregando(false); // Garante que o estado de carregamento seja resetado em caso de erro antes do redirecionamento
    }
  }

  return (
    <div className="login-page">
      <div className="login-brand-side">
        <div className="login-brand-shell">
          <div className="login-brand-mark">
            <img src={logoAgrotrack} alt="HERDON" loading="lazy" />
          </div>
          <div className="login-brand-logo">HER<span>DON</span></div>
          <div className="login-brand-sub">Gestão Inteligente. Resultados Reais.</div>

          <div className="login-benefits">
            <div className="login-benefit-card">Controle total do rebanho</div>
            <div className="login-benefit-card">Indicadores em tempo real</div>
            <div className="login-benefit-card">Financeiro por lote</div>
          </div>
        </div>
      </div>

      <div className="login-form-side">
        <div className="login-mobile-brand">
          <div className="login-brand-mark">
            <img src={logoAgrotrack} alt="HERDON" loading="lazy" />
          </div>
          <div className="login-brand-logo">HER<span>DON</span></div>
        </div>

        <div className="login-header">
          <h2 className="login-title">
            {modo === 'login' ? 'Entrar' : modo === 'cadastro' ? 'Criar conta' : `Recuperar senha (etapa ${etapaRecuperacao}/3)`}
          </h2>
          <p className="login-subtitle">Acesse a plataforma HERDON para gestão inteligente.</p>
        </div>

        {(modo === 'login' || modo === 'cadastro') && (
          <form onSubmit={handleSubmit} className="login-form">
            {modo === 'cadastro' ? (
              <>
                <label htmlFor="nome">Nome</label>
                <input
                  id="nome"
                  className="login-input"
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
              className="login-input"
              type="email"
              placeholder="voce@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label htmlFor="senha">Senha</label>
            <div className="login-password-wrap">
              <input
                id="senha"
                className="login-input"
                type={mostrarSenha ? 'text' : 'password'}
                placeholder="Sua senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
              <button type="button" className="login-password-toggle" onClick={() => setMostrarSenha((prev) => !prev)}>
                {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {erro && <div className="login-error">{erro}</div>}
            {mensagem && <div className="login-success">{mensagem}</div>}

            <button type="submit" className="login-btn" disabled={carregando}>
              {carregando
                ? 'Carregando...'
                : modo === 'login'
                ? 'Entrar'
                : 'Criar conta'}
            </button>

            <button
              type="button"
              className="login-btn login-btn-google" // Usando classe CSS
              onClick={loginComGoogle}
              disabled={carregando}
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
                  className="login-input"
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
                <p className="login-info-text">
                  Após abrir o link recebido no e-mail, defina a nova senha abaixo.
                </p>
                <label htmlFor="nova-senha">Nova senha</label>
                <div className="login-password-wrap">
                  <input
                    id="nova-senha"
                    className="login-input"
                    type={mostrarNovaSenha ? 'text' : 'password'}
                    placeholder="Digite a nova senha"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                  />
                  <button type="button" className="login-password-toggle" onClick={() => setMostrarNovaSenha((prev) => !prev)}>
                    {mostrarNovaSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="password-strength" style={{ color: forcaSenha.color }}> {/* Mantido inline para cor dinâmica */}
                  Força da senha: {forcaSenha.label}
                </div>
                <button type="submit" className="login-btn" disabled={carregando}>
                  Redefinir senha
                </button>
              </form>
            )}

            {etapaRecuperacao === 3 && (
              <p className="login-info-text">Processo concluído. Faça login com a nova senha.</p>
            )}
          </div>
        )}

        {/* Mensagens de erro/sucesso globais, se não usar toast */}
        {erro && <div className="login-error">{erro}</div>}
        {mensagem && <div className="login-success">{mensagem}</div>}

        <div className="login-links">
          {modo === 'login' ? 'Ainda não tem conta?' : 'Já tem conta?'}{' '}
          <button
            type="button"
            onClick={() => {
              if (carregando) return;
              setModo((prev) => (prev === 'login' ? 'cadastro' : 'login'));
              setErro('');
              setMensagem('');
            }}
            className="login-link-btn"
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
            className="login-link-btn"
          >
            Esqueci minha senha
          </button>
        </div>
      </div>
    </div>
  );
}
