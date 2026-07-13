import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { AlertTriangle, FileText, MessageCircle, Plus, X } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { perfilPodeGerenciarAcessos } from '../auth/perfis';
import { supabase } from '../lib/supabase'; // Assumindo que supabase está configurado
import { useAuth } from '../auth/useAuth';
import { useToast } from '../hooks/useToast'; // Importa o hook de toast
import { normalizeBackupPayload } from '../utils/backupValidation';
import { resumirProblemasIntegridade } from '../domain/integridadeDados';
import {
  createAuditEvent,
  deleteOwnerScopedCollection,
  upsertOperationalRecord,
} from '../services/operationalPersistence';
import {
  fetchTelegramConnection,
  generateTelegramCode,
  updateTelegramPreferences,
  disconnectTelegram,
} from '../services/telegramConnection';
import '../styles/configuracoes.css';

import { hojeLocalISO } from '../domain/dataCivil.js';
/** Mascara o chat_id do Telegram para exibição (Sprint 20) — mantém só os últimos 4 dígitos. */
function mascararChatId(chatId) {
  const texto = String(chatId || '');
  if (texto.length <= 4) return texto || '—';
  return `${'•'.repeat(texto.length - 4)}${texto.slice(-4)}`;
}

const TABS = [
  { id: 'geral', label: 'Geral' },
  { id: 'notificacoes', label: 'Notificações' },
  { id: 'integracoes', label: 'Integrações' },
  { id: 'dados', label: 'Dados e Segurança' },
];

/**
 * Página de Configurações da aplicação.
 * Permite gerenciar parâmetros globais, preferências de notificação,
 * acessos de usuários e operações de dados (exportar/importar/limpar).
 *
 * @param {object} props - As propriedades do componente.
 * @param {object} props.db - O objeto do banco de dados.
 * @param {function} props.setDb - Função para atualizar o banco de dados.
 * @param {function} [props.onConfirmAction] - Função para exibir um modal de confirmação customizado.
 */
export default function ConfiguracoesPage({ db, setDb, onConfirmAction, onNavigate = null }) {
  const { perfil, user, session, hasPermission } = useAuth();
  const { showToast } = useToast(); // Hook para exibir toasts
  const [tab, setTab] = useState('geral');
  const [confirmText, setConfirmText] = useState('');
  const fileInputRef = useRef(null);

  const configGeral = db?.configuracoes?.geral || {};
  const configNotificacoes = db?.configuracoes?.notificacoes || {};

  const [geral, setGeral] = useState({
    nome_sistema: configGeral.nome_sistema || 'HERDON',
    moeda: configGeral.moeda || 'BRL',
    formato_data: configGeral.formato_data || 'DD/MM/AAAA',
    unidade_peso: configGeral.unidade_peso || 'kg',
    rendimento_carcaca_padrao: configGeral.rendimento_carcaca_padrao ?? 52,
    preco_arroba_padrao: configGeral.preco_arroba_padrao ?? 290,
  });

  const [notificacoes, setNotificacoes] = useState({
    estoque_critico: configNotificacoes.estoque_critico ?? true,
    sanitario_vencido: configNotificacoes.sanitario_vencido ?? true,
    pesagem_atrasada: configNotificacoes.pesagem_atrasada ?? true,
    lote_data_saida: configNotificacoes.lote_data_saida ?? true,
    dias_antecedencia: configNotificacoes.dias_antecedencia ?? 3,
  });
  const [telegramConnection, setTelegramConnection] = useState(null);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramCode, setTelegramCode] = useState(null);
  const [telegramUrl, setTelegramUrl] = useState(null);

  useEffect(() => {
    let ativo = true;
    fetchTelegramConnection(session).then(({ connection }) => {
      if (ativo) setTelegramConnection(connection);
    });
    return () => { ativo = false; };
  }, [session]);

  // Enquanto há um código pendente, consulta a conexão a cada poucos
  // segundos para refletir a confirmação assim que o webhook do Telegram
  // processar a mensagem do usuário — sem exigir F5.
  useEffect(() => {
    if (!telegramCode || telegramConnection?.is_active) return undefined;
    const intervalId = setInterval(() => {
      fetchTelegramConnection(session).then(({ connection }) => {
        if (connection?.is_active) {
          setTelegramConnection(connection);
          setTelegramCode(null);
          setTelegramUrl(null);
        }
      });
    }, 4000);
    return () => clearInterval(intervalId);
  }, [telegramCode, telegramConnection, session]);

  function abrirTelegram() {
    if (!telegramUrl) return;
    window.open(telegramUrl, '_blank', 'noopener,noreferrer');
  }

  async function gerarCodigoTelegram() {
    setTelegramLoading(true);
    const result = await generateTelegramCode(session);
    setTelegramLoading(false);
    if (!result.ok) {
      showToast({ type: 'error', message: result.message });
      return;
    }
    setTelegramCode(result.code);
    setTelegramUrl(result.telegramUrl || null);
  }

  async function salvarPreferenciaTelegram(patch) {
    if (!telegramConnection?.id) return;
    const { connection, error } = await updateTelegramPreferences(telegramConnection.id, patch);
    if (error) {
      showToast({ type: 'warning', message: 'Não foi possível salvar a preferência agora.' });
      return;
    }
    setTelegramConnection(connection);
  }

  async function desconectarTelegram() {
    if (!telegramConnection?.id) return;
    const confirmado = onConfirmAction
      ? await onConfirmAction({ title: 'Desconectar Telegram', message: 'Você deixará de receber relatórios e alertas pelo Telegram. Deseja continuar?', tone: 'danger' })
      : window.confirm('Desconectar o Telegram?');
    if (!confirmado) return;

    const { connection, error } = await disconnectTelegram(telegramConnection.id);
    if (error) {
      showToast({ type: 'warning', message: 'Não foi possível desconectar agora.' });
      return;
    }
    setTelegramConnection(connection);
    setTelegramCode(null);
    setTelegramUrl(null);
    showToast({ type: 'success', message: 'Telegram desconectado.' });
  }

  // Gestão de equipe/acessos mudou para a página dedicada "Equipe e Acessos"
  // (Sprint 6, src/pages/EquipePage.jsx) — aqui fica só o atalho abaixo.
  const podeGerenciarAcessos = perfilPodeGerenciarAcessos(perfil);
  const mensagemSemPermissao = 'Você não tem permissão para executar esta ação.';

  function validarPermissao(permissao) {
    if (hasPermission(permissao)) return true;
    showToast({ type: 'error', message: mensagemSemPermissao });
    return false;
  }

  function registrarEventoAuditoria(evento) {
    void createAuditEvent({
      ...evento,
      usuario_id: user?.id || null,
    }, session).then((result) => {
      if (!result?.persisted && import.meta.env.DEV) {
        if (import.meta.env.DEV) {
          console.warn('[HERDON_AUDITORIA_FALLBACK]', result?.error || 'Falha ao persistir auditoria.');
        }
      }
    });
  }


  async function salvarGeral() {
    if (!validarPermissao('configuracoes:editar')) return;
    if (!geral.nome_sistema.trim()) {
      showToast({ type: 'error', message: 'Nome do sistema/empresa é obrigatório.' });
      return;
    }

    const geralPayload = {
      ...geral,
      rendimento_carcaca_padrao: Number(geral.rendimento_carcaca_padrao || 0),
      preco_arroba_padrao: Number(geral.preco_arroba_padrao || 0),
    };
    const persisted = await upsertOperationalRecord('configuracoes', {
      id: db?.configuracoes?.id,
      owner_user_id: user?.id || null,
      geral: geralPayload,
      notificacoes: db?.configuracoes?.notificacoes || {},
    }, user ? { user } : null);
    if (!persisted.persisted) {
      showToast({ type: 'warning', message: 'Não foi possível confirmar as alterações agora.' });
      return;
    }
    setDb((prev) => ({
      ...prev,
      configuracoes: {
        ...prev.configuracoes,
        ...(persisted.data || {}),
        geral: geralPayload,
      },
    }));
    registrarEventoAuditoria({
      acao: 'configuracoes_gerais_salvas',
      entidade: 'configuracoes',
      entidade_id: persisted.data?.id ?? db?.configuracoes?.id ?? null,
      criticidade: 'media',
      detalhes: { persistido: persisted.persisted },
    });

    if (persisted.persisted) {
      showToast({ type: 'success', message: 'Configurações gerais salvas com sucesso.' });
    }
  }

  async function salvarNotificacoes() {
    if (!validarPermissao('configuracoes:editar')) return;
    if (Number(notificacoes.dias_antecedencia) < 0) {
      showToast({ type: 'error', message: 'Dias de antecedência deve ser maior ou igual a zero.' });
      return;
    }

    const notificacoesPayload = {
      ...notificacoes,
      dias_antecedencia: Number(notificacoes.dias_antecedencia || 0),
    };
    const persisted = await upsertOperationalRecord('configuracoes', {
      id: db?.configuracoes?.id,
      owner_user_id: user?.id || null,
      geral: db?.configuracoes?.geral || {},
      notificacoes: notificacoesPayload,
    }, user ? { user } : null);
    if (!persisted.persisted) {
      showToast({ type: 'warning', message: 'Não foi possível confirmar as alterações agora.' });
      return;
    }
    setDb((prev) => ({
      ...prev,
      configuracoes: {
        ...prev.configuracoes,
        ...(persisted.data || {}),
        notificacoes: notificacoesPayload,
      },
    }));
    registrarEventoAuditoria({
      acao: 'configuracoes_notificacoes_salvas',
      entidade: 'configuracoes',
      entidade_id: persisted.data?.id ?? db?.configuracoes?.id ?? null,
      criticidade: 'media',
      detalhes: { persistido: persisted.persisted },
    });

    if (persisted.persisted) {
      showToast({ type: 'success', message: 'Preferências de notificação salvas com sucesso.' });
    }
  }

  function exportarDados() {
    const payload = {
      app: 'Herdon',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: db,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `herdon-backup-${hojeLocalISO()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast({ type: 'success', message: 'Backup exportado com sucesso.' });
  }

  async function importarDados(event) {
    if (!validarPermissao('dados:importar')) {
      event.target.value = '';
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        const normalized = normalizeBackupPayload(parsed, { currentUserId: user?.id || null });

        if (!normalized.ok) {
          registrarEventoAuditoria({
            acao: 'backup_importado_invalido',
            entidade: 'backup',
            criticidade: 'alta',
            detalhes: { motivo: 'payload_invalido' },
          });
          showToast({ type: 'error', message: 'Arquivo de backup inválido. Verifique o arquivo e tente novamente.' });
          return;
        }

        const confirmarImportacao = onConfirmAction
          ? await onConfirmAction({
              title: 'Importar backup validado',
              message: 'O backup será aplicado localmente. Deseja continuar?',
              tone: 'danger',
            })
          : window.confirm('O backup será aplicado localmente. Deseja continuar?');

        if (!confirmarImportacao) {
          showToast({ type: 'info', message: 'Importação cancelada.' });
          return;
        }

        setDb(normalized.data);

        const houveImportacaoParcial = normalized.summary.invalidRecords > 0
          || normalized.summary.skippedByOwner > 0
          || normalized.summary.nonArrayCollections > 0
          || normalized.summary.unknownTopLevelKeys > 0;

        if (houveImportacaoParcial) {
          registrarEventoAuditoria({
            acao: 'backup_importado_parcial',
            entidade: 'backup',
            criticidade: 'media',
            detalhes: normalized.summary,
          });
          showToast({
            type: 'warning',
            message: 'Arquivo verificado. Alguns registros foram ignorados.',
          });
          return;
        }

        registrarEventoAuditoria({
          acao: 'backup_importado_local',
          entidade: 'backup',
          criticidade: 'media',
          detalhes: normalized.summary,
        });
        showToast({ type: 'warning', message: 'Arquivo verificado. Confirme a importação para continuar.' });
      } catch {
        registrarEventoAuditoria({
          acao: 'backup_importado_invalido',
          entidade: 'backup',
          criticidade: 'alta',
          detalhes: { motivo: 'json_invalido' },
        });
        showToast({ type: 'error', message: 'Arquivo de backup inválido. Verifique o arquivo e tente novamente.' });
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Limpa o input de arquivo
  }

  async function limparDadosDemo() {
    if (!validarPermissao('dados:limpar')) return;
    const ok = onConfirmAction
      ? await onConfirmAction({ title: 'Limpar dados operacionais', message: 'Remover os dados operacionais deste ambiente?', tone: 'danger' })
      : window.confirm('Remover os dados operacionais deste ambiente?');

    if (!ok) return;

    const confirmarLocal = onConfirmAction
      ? await onConfirmAction({
          title: 'Confirmar limpeza local',
          message: 'Esta limpeza afeta os dados operacionais deste ambiente. Deseja continuar?',
          tone: 'danger',
        })
      : window.confirm('Esta limpeza afeta apenas os dados locais em memória. Deseja continuar?');

    if (!confirmarLocal) return;

    setDb((prev) => ({
      ...prev,
      lotes: [],
      animais: [],
      custos: [],
      estoque: [],
      sanitario: [],
      rotinas: [],
      tarefas: [],
      pesagens: [],
      movimentacoes_animais: [],
      movimentacoes_estoque: [],
      movimentacoes_financeiras: [],
      // Manter configurações e usuários
    }));

    const colecoesLimpeza = [
      'lotes',
      'animais',
      'custos',
      'estoque',
      'sanitario',
      'rotinas',
      'tarefas',
      'pesagens',
      'movimentacoes_animais',
      'movimentacoes_estoque',
      'movimentacoes_financeiras',
      'suplementacao',
      'dietas',
      'consumo_suplementacao',
      'eventos_operacionais',
    ];
    const resultadosLimpeza = await Promise.all(
      colecoesLimpeza.map((table) => deleteOwnerScopedCollection(table, session))
    );
    const houveFalhaPersistencia = resultadosLimpeza.some((item) => !item?.persisted);
    registrarEventoAuditoria({
      acao: 'limpeza_dados_operacionais',
      entidade: 'dados',
      criticidade: 'alta',
      detalhes: {
        escopo: 'dados_operacionais',
        tabelas: colecoesLimpeza,
        persistido: !houveFalhaPersistencia,
      },
    });

    if (houveFalhaPersistencia) {
      showToast({ type: 'warning', message: 'Dados removidos. Parte da limpeza ainda precisa de atenção.' });
      return;
    }
    showToast({ type: 'success', message: 'Dados operacionais removidos com sucesso.' });
  }

  async function excluirConta() {
    if (confirmText !== 'CONFIRMAR') {
      showToast({ type: 'error', message: 'Digite CONFIRMAR para prosseguir.' });
      return;
    }

    const confirmado = onConfirmAction
      ? await onConfirmAction({
          title: 'Excluir conta',
          message: 'Esta ação é irreversível. Deseja realmente continuar?',
          tone: 'danger',
        })
      : window.confirm('Esta ação é irreversível. Deseja realmente continuar?');

    if (!confirmado) return;

    // Simulação de exclusão de conta no backend/auth
    await supabase.auth.signOut(); // Desloga o usuário localmente
    showToast({ type: 'success', message: 'Conta encerrada com sucesso.' });
    // Em um ambiente real, aqui você chamaria uma API para excluir a conta do usuário no backend.
  }

  return (
    <div className="config-page">
      <header>
        <h1>Configurações</h1>
        <p>Parâmetros globais, notificações e segurança dos dados.</p>
      </header>

      {(() => {
        const integridade = resumirProblemasIntegridade(db);
        if (!integridade.temProblemas) return null;
        const partes = Object.entries(integridade.porTabela)
          .filter(([, n]) => n > 0)
          .map(([tabela, n]) => `${n} em ${tabela}`);
        return (
          <div className="config-integridade-aviso" role="status">
            <AlertTriangle size={18} aria-hidden="true" />
            <div>
              <strong>{integridade.mensagem}</strong>
              <span>{partes.join(' · ')}. Use o seletor “Todas as fazendas” para localizá-los e reatribuir a fazenda correta.</span>
            </div>
          </div>
        );
      })()}

      {podeGerenciarAcessos ? (
        <Card title="Equipe e acessos" subtitle="Convide pessoas, altere papéis e gerencie quem acessa sua conta HERDON.">
          <Button variant="outline" icon={<Plus size={14} />} onClick={() => onNavigate?.('equipeAcessos')}>
            Abrir Equipe e Acessos
          </Button>
        </Card>
      ) : null}

      <div className="config-tabs">
        {TABS.map((item) => (
          <button key={item.id} type="button" className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'geral' ? (
        <Card title="Geral">
          <div className="config-grid">
            <label className="ui-input-wrap">
              <span className="ui-input-label">Nome do sistema / empresa</span>
              <input className="ui-input" value={geral.nome_sistema} onChange={(e) => setGeral((prev) => ({ ...prev, nome_sistema: e.target.value }))} />
            </label>
            <label className="ui-input-wrap">
              <span className="ui-input-label">Moeda padrão</span>
              <select className="ui-input" value={geral.moeda} onChange={(e) => setGeral((prev) => ({ ...prev, moeda: e.target.value }))}>
                <option value="BRL">R$ BRL</option>
                <option value="USD">$ USD</option>
              </select>
            </label>
            <label className="ui-input-wrap">
              <span className="ui-input-label">Formato de data</span>
              <select className="ui-input" value={geral.formato_data} onChange={(e) => setGeral((prev) => ({ ...prev, formato_data: e.target.value }))}>
                <option value="DD/MM/AAAA">DD/MM/AAAA</option>
                <option value="AAAA-MM-DD">AAAA-MM-DD</option>
              </select>
            </label>
            <label className="ui-input-wrap">
              <span className="ui-input-label">Unidade de peso padrão</span>
              <select className="ui-input" value={geral.unidade_peso} onChange={(e) => setGeral((prev) => ({ ...prev, unidade_peso: e.target.value }))}>
                <option value="kg">kg</option>
                <option value="arroba">@</option>
              </select>
            </label>
            <label className="ui-input-wrap">
              <span className="ui-input-label">Rendimento de carcaça padrão (%)</span>
              <input className="ui-input" type="number" min="0" max="100" value={geral.rendimento_carcaca_padrao} onChange={(e) => setGeral((prev) => ({ ...prev, rendimento_carcaca_padrao: e.target.value }))} />
            </label>
            <label className="ui-input-wrap">
              <span className="ui-input-label">Preço da arroba padrão (R$)</span>
              <input className="ui-input" type="number" min="0" step="0.01" value={geral.preco_arroba_padrao} onChange={(e) => setGeral((prev) => ({ ...prev, preco_arroba_padrao: e.target.value }))} />
            </label>
            </div>
          <div className="config-actions"><Button onClick={salvarGeral}>Salvar configurações gerais</Button></div>
        </Card>
      ) : null}

      {tab === 'notificacoes' ? (
        <Card title="Notificações">
          <div className="config-grid">
            <SwitchRow label="Alertas de estoque crítico" checked={notificacoes.estoque_critico} onChange={(value) => setNotificacoes((prev) => ({ ...prev, estoque_critico: value }))} />
            <SwitchRow label="Alertas de vacinas/manejos vencidos" checked={notificacoes.sanitario_vencido} onChange={(value) => setNotificacoes((prev) => ({ ...prev, sanitario_vencido: value }))} />
            <SwitchRow label="Alertas de pesagem atrasada" checked={notificacoes.pesagem_atrasada} onChange={(value) => setNotificacoes((prev) => ({ ...prev, pesagem_atrasada: value }))} />
            <SwitchRow label="Alertas de lote na data de saída prevista" checked={notificacoes.lote_data_saida} onChange={(value) => setNotificacoes((prev) => ({ ...prev, lote_data_saida: value }))} />
            <label className="ui-input-wrap">
              <span className="ui-input-label">Quantos dias antes avisar</span>
              <input className="ui-input" type="number" min="0" value={notificacoes.dias_antecedencia} onChange={(e) => setNotificacoes((prev) => ({ ...prev, dias_antecedencia: e.target.value }))} />
            </label>
          </div>
          <div className="config-actions"><Button onClick={salvarNotificacoes}>Salvar preferências de notificação</Button></div>
        </Card>
      ) : null}

      {tab === 'integracoes' ? (
        <Card title="Telegram" subtitle="Receba o relatório diário e alertas do HERDON direto no seu Telegram.">
          {telegramConnection?.is_active ? (
            <div className="config-data-stack">
              <p>
                Conectado como <strong>{telegramConnection.telegram_username ? `@${telegramConnection.telegram_username}` : telegramConnection.telegram_first_name || 'usuário do Telegram'}</strong>.
              </p>
              <p className="config-meta-text">
                Chat: {mascararChatId(telegramConnection.telegram_chat_id)}
                {telegramConnection.created_at ? ` · conectado em ${new Date(telegramConnection.created_at).toLocaleDateString('pt-BR')}` : ''}
              </p>
              <div className="config-grid">
                <SwitchRow label="Receber relatório diário" checked={telegramConnection.daily_report_enabled} onChange={(value) => salvarPreferenciaTelegram({ daily_report_enabled: value })} />
                <SwitchRow label="Alertas de pagamentos" checked={telegramConnection.alert_payments_enabled} onChange={(value) => salvarPreferenciaTelegram({ alert_payments_enabled: value })} />
                <SwitchRow label="Alertas de estoque" checked={telegramConnection.alert_stock_enabled} onChange={(value) => salvarPreferenciaTelegram({ alert_stock_enabled: value })} />
                <SwitchRow label="Alertas de tarefas" checked={telegramConnection.alert_tasks_enabled} onChange={(value) => salvarPreferenciaTelegram({ alert_tasks_enabled: value })} />
                <SwitchRow label="Alertas de sanidade" checked={telegramConnection.alert_health_enabled} onChange={(value) => salvarPreferenciaTelegram({ alert_health_enabled: value })} />
                <label className="ui-input-wrap">
                  <span className="ui-input-label">Horário do relatório diário</span>
                  <input className="ui-input" type="time" value={String(telegramConnection.report_time || '07:00:00').slice(0, 5)} onChange={(e) => salvarPreferenciaTelegram({ report_time: e.target.value })} />
                </label>
              </div>
              <div className="config-actions">
                <Button variant="outline" onClick={desconectarTelegram}>Desconectar Telegram</Button>
              </div>
            </div>
          ) : (
            <div className="config-data-stack">
              <p>Conecte seu Telegram para receber o relatório diário e alertas importantes do HERDON.</p>
              {telegramCode ? (
                <div className="telegram-connect-panel">
                  <div className="config-panel-intro">
                    <span className="config-panel-kicker">Código gerado</span>
                    <p>
                      Abra o bot do HERDON no Telegram e envie: <strong>{telegramCode}</strong>
                      <br />
                      {telegramUrl
                        ? 'Ou use o botão/QR Code ao lado — eles já levam o código embutido.'
                        : 'Envie exatamente esse código para o bot do HERDON no Telegram.'}
                      <br />
                      O código expira em 15 minutos. A tela atualiza sozinha assim que o Telegram confirmar.
                    </p>
                    {telegramUrl ? (
                      <div className="config-actions">
                        <Button icon={<MessageCircle size={14} />} onClick={abrirTelegram}>Abrir no Telegram</Button>
                      </div>
                    ) : null}
                  </div>
                  {telegramUrl ? (
                    <div className="telegram-qrcode" aria-label="QR Code para conectar o Telegram">
                      <QRCodeSVG value={telegramUrl} size={152} bgColor="#ffffff" fgColor="#0a0f0d" />
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="config-actions">
                <Button icon={<MessageCircle size={14} />} loading={telegramLoading} onClick={gerarCodigoTelegram}>
                  {telegramCode ? 'Gerar novo código' : 'Conectar Telegram'}
                </Button>
              </div>
            </div>
          )}
        </Card>
      ) : null}

      {tab === 'dados' ? (
        <Card title="Dados e Segurança">
          <div className="config-data-stack">
            <div className="config-actions-wrap config-actions-wrap--data">
              <div className="config-panel-intro">
                <span className="config-panel-kicker">Backup e manutenção</span>
                <p>Exporte, importe e limpe dados operacionais com uma hierarquia visual mais clara e segura.</p>
              </div>
              <div className="config-action-cluster">
                <Button icon={<FileText size={14} />} onClick={exportarDados}>Exportar todos os dados</Button>
                <Button icon={<FileText size={14} />} variant="outline" onClick={() => fileInputRef.current?.click()}>Importar dados</Button>
                <input ref={fileInputRef} type="file" accept="application/json" onChange={importarDados} hidden />
            <Button icon={<X size={14} />} variant="outline" onClick={limparDadosDemo}>Limpar dados</Button>
              </div>
            </div>

            <div className="danger-zone danger-zone--settings">
              <div className="danger-zone-head">
                <h4><AlertTriangle size={14} /> Zona de perigo</h4>
                <span className="danger-zone-chip">Acao irreversivel</span>
              </div>
              <p>Para excluir conta, digite <strong>CONFIRMAR</strong>.</p>
              <div className="danger-zone-controls">
                <input className="ui-input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="Digite CONFIRMAR" />
                <Button variant="danger" onClick={excluirConta}>Excluir conta</Button>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

    </div>
  );
}

/**
 * Componente de linha com um switch (checkbox).
 * @param {object} props - As propriedades do componente.
 * @param {string} props.label - O texto do label.
 * @param {boolean} props.checked - O estado do switch.
 * @param {function} props.onChange - Callback para quando o switch muda de estado.
 */
function SwitchRow({ label, checked, onChange }) {
  return (
    <label className="switch-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
