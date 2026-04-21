import { useRef, useState } from 'react';
import { AlertTriangle, FileText, Plus, X } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/useAuth';
import '../styles/configuracoes.css';

const TABS = [
  { id: 'geral', label: 'Geral' },
  { id: 'notificacoes', label: 'Notificações' },
  { id: 'acessos', label: 'Usuários e Acessos' },
  { id: 'dados', label: 'Dados e Segurança' },
];

export default function ConfiguracoesPage({ db, setDb, onConfirmAction }) {
  const { perfil } = useAuth();
  const [tab, setTab] = useState('geral');
  const [openInvite, setOpenInvite] = useState(false);
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

  function salvarGeral() {
    if (!geral.nome_sistema.trim()) {
      window.alert('Nome do sistema/empresa é obrigatório.');
      return;
    }

    setDb((prev) => ({
      ...prev,
      configuracoes: {
        ...prev.configuracoes,
        geral: {
          ...geral,
          rendimento_carcaca_padrao: Number(geral.rendimento_carcaca_padrao || 0),
          preco_arroba_padrao: Number(geral.preco_arroba_padrao || 0),
        },
      },
    }));

    window.alert('Configurações gerais salvas com sucesso.');
  }

  function salvarNotificacoes() {
    if (Number(notificacoes.dias_antecedencia) < 0) {
      window.alert('Dias de antecedência deve ser maior ou igual a zero.');
      return;
    }

    setDb((prev) => ({
      ...prev,
      configuracoes: {
        ...prev.configuracoes,
        notificacoes: {
          ...notificacoes,
          dias_antecedencia: Number(notificacoes.dias_antecedencia || 0),
        },
      },
    }));

    window.alert('Preferências de notificação salvas com sucesso.');
  }

  function exportarDados() {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `herdon-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    window.alert('Backup exportado com sucesso.');
  }

  function importarDados(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (!parsed || typeof parsed !== 'object') throw new Error('Arquivo inválido');
        setDb(parsed);
        window.alert('Dados importados com sucesso.');
      } catch (error) {
        window.alert(`Erro ao importar dados: ${error.message}`);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  async function limparDadosDemo() {
    const ok = onConfirmAction
      ? await onConfirmAction({ title: 'Limpar demonstração', message: 'Remover dados fictícios do ambiente?', tone: 'danger' })
      : window.confirm('Remover dados fictícios do ambiente?');

    if (!ok) return;

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
    }));

    window.alert('Dados de demonstração removidos.');
  }

  async function excluirConta() {
    if (confirmText !== 'CONFIRMAR') {
      window.alert('Digite CONFIRMAR para prosseguir.');
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

    await supabase.auth.signOut();
    window.alert('Conta encerrada no app local. (Fluxo remoto deve ser conectado ao backend).');
  }

  return (
    <div className="config-page">
      <header>
        <h1>Configurações</h1>
        <p>Parâmetros globais, notificações e segurança dos dados.</p>
      </header>

      <div className="config-tabs">
        {TABS.filter((item) => (item.id === 'acessos' ? perfil === 'proprietario' : true)).map((item) => (
          <button key={item.id} type="button" className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'geral' ? (
        <Card title="Geral">
          <div className="config-grid">
            <label>Nome do sistema / empresa
              <input value={geral.nome_sistema} onChange={(e) => setGeral((prev) => ({ ...prev, nome_sistema: e.target.value }))} />
            </label>
            <label>Moeda padrão
              <select value={geral.moeda} onChange={(e) => setGeral((prev) => ({ ...prev, moeda: e.target.value }))}>
                <option value="BRL">R$ BRL</option>
                <option value="USD">$ USD</option>
              </select>
            </label>
            <label>Formato de data
              <select value={geral.formato_data} onChange={(e) => setGeral((prev) => ({ ...prev, formato_data: e.target.value }))}>
                <option value="DD/MM/AAAA">DD/MM/AAAA</option>
                <option value="AAAA-MM-DD">AAAA-MM-DD</option>
              </select>
            </label>
            <label>Unidade de peso padrão
              <select value={geral.unidade_peso} onChange={(e) => setGeral((prev) => ({ ...prev, unidade_peso: e.target.value }))}>
                <option value="kg">kg</option>
                <option value="arroba">@</option>
              </select>
            </label>
            <label>Rendimento de carcaça padrão (%)
              <input type="number" min="0" max="100" value={geral.rendimento_carcaca_padrao} onChange={(e) => setGeral((prev) => ({ ...prev, rendimento_carcaca_padrao: e.target.value }))} />
            </label>
            <label>Preço da arroba padrão (R$)
              <input type="number" min="0" step="0.01" value={geral.preco_arroba_padrao} onChange={(e) => setGeral((prev) => ({ ...prev, preco_arroba_padrao: e.target.value }))} />
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
            <label>Quantos dias antes avisar
              <input type="number" min="0" value={notificacoes.dias_antecedencia} onChange={(e) => setNotificacoes((prev) => ({ ...prev, dias_antecedencia: e.target.value }))} />
            </label>
          </div>
          <div className="config-actions"><Button onClick={salvarNotificacoes}>Salvar preferências de notificação</Button></div>
        </Card>
      ) : null}

      {tab === 'acessos' && perfil === 'proprietario' ? (
        <Card
          title="Usuários e Acessos"
          action={<Button size="sm" icon={<Plus size={14} />} onClick={() => setOpenInvite(true)}>+ Convidar usuário</Button>}
        >
          <div className="table-responsive">
            <table className="dashboard-table">
              <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th>Ações</th></tr></thead>
              <tbody>
                {(db.usuarios || []).map((item) => (
                  <tr key={item.id}>
                    <td>{item.nome}</td>
                    <td>{item.email}</td>
                    <td>
                      <select
                        value={item.perfil}
                        onChange={(e) => {
                          const novoPerfil = e.target.value;
                          setDb((prev) => ({
                            ...prev,
                            usuarios: (prev.usuarios || []).map((u) => (u.id === item.id ? { ...u, perfil: novoPerfil } : u)),
                          }));
                        }}
                      >
                        <option value="proprietario">Proprietário</option>
                        <option value="gerente">Gerente</option>
                        <option value="operador">Operador</option>
                        <option value="visualizador">Visualizador</option>
                      </select>
                    </td>
                    <td>
                      <select
                        value={item.status}
                        onChange={(e) => {
                          const novoStatus = e.target.value;
                          setDb((prev) => ({
                            ...prev,
                            usuarios: (prev.usuarios || []).map((u) => (u.id === item.id ? { ...u, status: novoStatus } : u)),
                          }));
                        }}
                      >
                        <option value="ativo">Ativo</option>
                        <option value="inativo">Inativo</option>
                      </select>
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setDb((prev) => ({ ...prev, usuarios: (prev.usuarios || []).filter((u) => u.id !== item.id) }))}
                      >
                        Remover
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {tab === 'dados' ? (
        <Card title="Dados e Segurança">
          <div className="config-actions-wrap">
            <Button icon={<FileText size={14} />} onClick={exportarDados}>Exportar todos os dados</Button>
            <Button icon={<FileText size={14} />} variant="outline" onClick={() => fileInputRef.current?.click()}>Importar dados</Button>
            <input ref={fileInputRef} type="file" accept="application/json" onChange={importarDados} hidden />
            <Button icon={<X size={14} />} variant="outline" onClick={limparDadosDemo}>Limpar dados de demonstração</Button>
          </div>

          <div className="danger-zone">
            <h4><AlertTriangle size={14} /> Zona de perigo</h4>
            <p>Para excluir conta, digite <strong>CONFIRMAR</strong>.</p>
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="Digite CONFIRMAR" />
            <Button variant="danger" onClick={excluirConta}>Excluir conta</Button>
          </div>
        </Card>
      ) : null}

      <Modal open={openInvite} onClose={() => setOpenInvite(false)} title="Convidar usuário">
        <InviteForm
          onClose={() => setOpenInvite(false)}
          onInvite={(payload) => {
            setDb((prev) => ({
              ...prev,
              usuarios: [...(prev.usuarios || []), { ...payload, id: nextId(prev.usuarios || []) }],
            }));
            window.alert('Usuário convidado com sucesso.');
            setOpenInvite(false);
          }}
        />
      </Modal>
    </div>
  );
}

function InviteForm({ onInvite, onClose }) {
  const [form, setForm] = useState({ nome: '', email: '', perfil: 'visualizador', status: 'ativo' });

  return (
    <form
      className="config-grid"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.nome.trim() || !form.email.trim()) {
          window.alert('Informe nome e e-mail do usuário.');
          return;
        }
        onInvite({ ...form, nome: form.nome.trim(), email: form.email.trim() });
      }}
    >
      <label>Nome
        <input value={form.nome} onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))} />
      </label>
      <label>E-mail
        <input type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
      </label>
      <label>Perfil
        <select value={form.perfil} onChange={(e) => setForm((prev) => ({ ...prev, perfil: e.target.value }))}>
          <option value="proprietario">Proprietário</option>
          <option value="gerente">Gerente</option>
          <option value="operador">Operador</option>
          <option value="visualizador">Visualizador</option>
        </select>
      </label>
      <div className="config-actions">
        <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button type="submit">Convidar</Button>
      </div>
    </form>
  );
}

function SwitchRow({ label, checked, onChange }) {
  return (
    <label className="switch-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function nextId(items) {
  return items.reduce((max, item) => Math.max(max, Number(item.id || 0)), 0) + 1;
}
