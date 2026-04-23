import { useMemo, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
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
  if (pontos <= 3) return { label: 'Media', color: 'var(--color-warning)' };
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
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);

  const forcaSenha = useMemo(() => calcularForcaSenha(novaSenha), [novaSenha]);

  const tituloAtual =
    modo === 'login'
      ? 'Entrar'
      : modo === 'cadastro'
        ? 'Criar conta'
        : `Recuperar senha (${etapaRecuperacao}/3)`;

  const subtituloAtual =
    modo === 'login'
      ? 'Acesse sua operacao com uma leitura clara, rapida e segura.'
      : modo === 'cadastro'
        ? 'Configure seu acesso e comece a centralizar rebanho, estoque e rotina.'
        : 'Recupere o acesso sem perder o contexto da operacao.';

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
          'Login nao concluido. Verifique se a confirmacao de e-mail esta ativada no Supabase.'
        );
      }
    } catch (err) {
      console.error('Erro de autenticacao:', err);
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
      setMensagem('Link de recuperacao enviado. Confira sua caixa de entrada.');
    } catch (err) {
      setErro(err?.message || 'Nao foi possivel enviar o link de recuperacao.');
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
      setMensagem('Senha atualizada com sucesso. Voce ja pode entrar no sistema.');
      setModo('login');
      setSenha('');
      setNovaSenha('');
    } catch (err) {
      setErro(err?.message || 'Nao foi possivel redefinir a senha.');
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
    } finally {
      setCarregando(false);
    }
  }

  function alternarModoConta() {
    if (carregando) return;
    setModo((prev) => (prev === 'login' ? 'cadastro' : 'login'));
    setErro('');
    setMensagem('');
  }

  function abrirRecuperacao() {
    if (carregando) return;
    setModo('recuperar');
    setEtapaRecuperacao(1);
    setErro('');
    setMensagem('');
  }

  function voltarParaLogin() {
    if (carregando) return;
    setModo('login');
    setEtapaRecuperacao(1);
    setErro('');
    setMensagem('');
    setNovaSenha('');
  }

  return (
    <div className="login-page">
      <div className="login-page-glow login-page-glow-left" />
      <div className="login-page-glow login-page-glow-right" />

      <section className="login-brand-side">
        <div className="login-brand-shell">
          <div className="login-brand-header">
            <div className="login-brand-mark">
              <img src={logoAgrotrack} alt="HERDON" loading="lazy" />
            </div>
            <div className="login-brand-copy">
              <div className="login-brand-logo">HERDON</div>
              <div className="login-brand-sub">
                Gestao premium para acompanhar desempenho, rotina e resultado.
              </div>
            </div>
          </div>

          <div className="login-brand-content">
            <span className="login-brand-kicker">Plataforma de monitoramento</span>
            <h1 className="login-brand-title">
              A operacao do rebanho com mais clareza, ritmo e leitura executiva.
            </h1>
            <p className="login-brand-description">
              Centralize rebanho, pesagens, manejo, estoque e financeiro em uma
              experiencia mais limpa, segura e pronta para decisao diaria.
            </p>
          </div>

          <div className="login-benefits">
            <div className="login-benefit-card">
              <strong>Monitoramento acionavel</strong>
              <span>Indicadores organizados para agir rapido no lote certo.</span>
            </div>
            <div className="login-benefit-card">
              <strong>Rotina sem ruído</strong>
              <span>Pesagens, tarefas e manejo com leitura mais objetiva.</span>
            </div>
            <div className="login-benefit-card">
              <strong>Gestao com contexto</strong>
              <span>Financeiro, estoque e agenda conectados ao desempenho.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="login-form-side">
        <div className="login-form-shell">
          <div className="login-mobile-brand">
            <div className="login-brand-mark">
              <img src={logoAgrotrack} alt="HERDON" loading="lazy" />
            </div>
            <div className="login-brand-logo">HERDON</div>
          </div>

          <div className="login-card">
            <div className="login-card-topline">
              <span className="login-card-kicker">Acesso seguro</span>
              <span className="login-card-chip">
                {modo === 'cadastro' ? 'Novo acesso' : modo === 'recuperar' ? 'Recuperacao' : 'Login'}
              </span>
            </div>

            <div className="login-header">
              <h2 className="login-title">{tituloAtual}</h2>
              <p className="login-subtitle">{subtituloAtual}</p>
            </div>

            {(erro || mensagem) && (
              <div className="login-feedback-stack">
                {erro ? <div className="login-error">{erro}</div> : null}
                {mensagem ? <div className="login-success">{mensagem}</div> : null}
              </div>
            )}

            {(modo === 'login' || modo === 'cadastro') && (
              <>
                <form onSubmit={handleSubmit} className="login-form">
                  {modo === 'cadastro' ? (
                    <div className="login-field">
                      <label htmlFor="nome" className="login-label">
                        Nome
                      </label>
                      <input
                        id="nome"
                        className="login-input"
                        type="text"
                        placeholder="Seu nome"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                      />
                    </div>
                  ) : null}

                  <div className="login-field">
                    <label htmlFor="email" className="login-label">
                      E-mail
                    </label>
                    <input
                      id="email"
                      className="login-input"
                      type="email"
                      placeholder="voce@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div className="login-field">
                    <label htmlFor="senha" className="login-label">
                      Senha
                    </label>
                    <div className="login-password-wrap">
                      <input
                        id="senha"
                        className="login-input"
                        type={mostrarSenha ? 'text' : 'password'}
                        placeholder="Sua senha"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                      />
                      <button
                        type="button"
                        className="login-password-toggle"
                        onClick={() => setMostrarSenha((prev) => !prev)}
                        aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="login-actions">
                    <button type="submit" className="login-btn login-btn-primary" disabled={carregando}>
                      {carregando
                        ? 'Carregando...'
                        : modo === 'login'
                          ? 'Entrar'
                          : 'Criar conta'}
                    </button>

                    <button
                      type="button"
                      className="login-btn login-btn-google"
                      onClick={loginComGoogle}
                      disabled={carregando}
                    >
                      Entrar com Google
                    </button>
                  </div>
                </form>

                <div className="login-divider">
                  <span>Atalhos de acesso</span>
                </div>

                <div className="login-links-card">
                  <div className="login-links-row">
                    <span>{modo === 'login' ? 'Ainda nao tem conta?' : 'Ja tem conta?'}</span>
                    <button
                      type="button"
                      onClick={alternarModoConta}
                      className="login-link-btn"
                    >
                      {modo === 'login' ? 'Criar conta' : 'Entrar'}
                    </button>
                  </div>

                  <div className="login-links-row">
                    <span>Precisa recuperar o acesso?</span>
                    <button
                      type="button"
                      onClick={abrirRecuperacao}
                      className="login-link-btn"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                </div>
              </>
            )}

            {modo === 'recuperar' && (
              <>
                {etapaRecuperacao === 1 && (
                  <form onSubmit={enviarRecuperacaoSenha} className="login-form">
                    <div className="login-field">
                      <label htmlFor="email-recuperacao" className="login-label">
                        E-mail
                      </label>
                      <input
                        id="email-recuperacao"
                        className="login-input"
                        type="email"
                        placeholder="voce@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>

                    <div className="login-actions">
                      <button type="submit" className="login-btn login-btn-primary" disabled={carregando}>
                        Enviar link
                      </button>
                    </div>
                  </form>
                )}

                {etapaRecuperacao === 2 && (
                  <form onSubmit={redefinirSenha} className="login-form">
                    <p className="login-info-text">
                      Depois de abrir o link recebido no e-mail, defina abaixo a nova senha.
                    </p>

                    <div className="login-field">
                      <label htmlFor="nova-senha" className="login-label">
                        Nova senha
                      </label>
                      <div className="login-password-wrap">
                        <input
                          id="nova-senha"
                          className="login-input"
                          type={mostrarNovaSenha ? 'text' : 'password'}
                          placeholder="Digite a nova senha"
                          value={novaSenha}
                          onChange={(e) => setNovaSenha(e.target.value)}
                        />
                        <button
                          type="button"
                          className="login-password-toggle"
                          onClick={() => setMostrarNovaSenha((prev) => !prev)}
                          aria-label={mostrarNovaSenha ? 'Ocultar nova senha' : 'Mostrar nova senha'}
                        >
                          {mostrarNovaSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="password-strength" style={{ color: forcaSenha.color }}>
                      Forca da senha: {forcaSenha.label}
                    </div>

                    <div className="login-actions">
                      <button type="submit" className="login-btn login-btn-primary" disabled={carregando}>
                        Redefinir senha
                      </button>
                    </div>
                  </form>
                )}

                {etapaRecuperacao === 3 && (
                  <p className="login-info-text">
                    Processo concluido. Volte ao login e entre com a nova senha.
                  </p>
                )}

                <div className="login-divider">
                  <span>Navegacao</span>
                </div>

                <div className="login-links-card">
                  <div className="login-links-row">
                    <span>Ja esta pronto para entrar?</span>
                    <button type="button" onClick={voltarParaLogin} className="login-link-btn">
                      Voltar ao login
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className="login-card-foot">
              HERDON centraliza o essencial da operacao sem tirar velocidade do dia a dia.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
