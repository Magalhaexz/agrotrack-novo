# Legal e Compliance — Checklist HERDON

> Sprint 4 · Etapa 9 · Gerado em 2026-06-15  
> Status: **Nenhum item legal implementado no produto.** Todos os itens abaixo são pendências.

---

## Situação atual

Nenhuma página de política de privacidade, termos de uso ou processo LGPD foi encontrada no código do app (`src/pages/`). O app coleta dados pessoais (nome, email, CPF para Asaas, dados de propriedade rural) sem qualquer divulgação ou consentimento formalizado.

**Classificação de risco:** 🔴 Alto — uso com produtor real não deve ocorrer sem ao menos política de privacidade e termos de uso.

---

## 1. Documentos legais mínimos

| # | Documento | Onde publicar | Status |
|---|-----------|--------------|--------|
| 1.1 | Política de Privacidade | URL pública (`/privacidade`) | ❌ Não existe |
| 1.2 | Termos de Uso | URL pública (`/termos`) | ❌ Não existe |
| 1.3 | Política de Cobrança / Assinatura | URL pública ou dentro de `/termos` | ❌ Não existe |

---

## 2. LGPD — Dados coletados

| Dado | Tabela(s) | Finalidade | Retenção |
|------|-----------|-----------|---------|
| Email do usuário | `profiles`, `invites` | Autenticação, notificações | Enquanto conta ativa |
| Nome completo | `profiles` | Exibição, documentos | Enquanto conta ativa |
| Telefone (opcional) | `profiles` | Contato | Enquanto conta ativa |
| Foto (URL, opcional) | `profiles` | Avatar | Enquanto conta ativa |
| CPF/CNPJ | Asaas (externo) | Cobrança recorrente | Controlado pelo Asaas |
| Dados da fazenda (nome, localização) | `fazendas` | Core do produto | Enquanto conta ativa |
| Dados de animais/lotes | `animais`, `lotes`, `pesagens` | Core do produto | Enquanto conta ativa |
| Movimentações financeiras | `movimentacoes_financeiras` | Core do produto | Enquanto conta ativa |
| Eventos de billing | `billing_events`, `customer_subscriptions` | Cobrança/auditoria | Período legal obrigatório |

**Dados sensíveis de terceiros:**
- Dados dos funcionários convidados (nome, email, perfil)
- Dados dos animais podem ter valor econômico significativo

---

## 3. Consentimento e avisos

| # | Item | Status |
|---|------|--------|
| 3.1 | Checkbox de aceite de termos na criação de conta | ❌ Não implementado |
| 3.2 | Link para política de privacidade na tela de cadastro | ❌ Não implementado |
| 3.3 | Link para termos de uso na tela de cadastro | ❌ Não implementado |
| 3.4 | Aviso de cookies (se aplicável) | ❌ Não verificado |
| 3.5 | Data do aceite armazenada no banco | ❌ Não implementado |

---

## 4. Direitos do titular (LGPD Art. 18)

| # | Direito | Processo | Status |
|---|---------|---------|--------|
| 4.1 | Acesso aos próprios dados | Usuário pode ver seus dados no `/perfil` | 🟡 Parcial |
| 4.2 | Correção de dados inexatos | Formulário de edição em `/perfil` | 🟡 Parcial |
| 4.3 | Exclusão de dados | **Não implementado** — sem botão "Excluir conta" | ❌ Ausente |
| 4.4 | Portabilidade de dados | **Não implementado** — sem exportação | ❌ Ausente |
| 4.5 | Revogação de consentimento | **Não implementado** | ❌ Ausente |
| 4.6 | Informação sobre compartilhamento | **Não documentado** (dados vão para Asaas) | ❌ Ausente |

---

## 5. Terceiros com acesso a dados

| Terceiro | Dados compartilhados | Finalidade | Base legal |
|----------|---------------------|-----------|-----------|
| **Supabase** (EUA) | Todos os dados do app | Armazenamento | Contratual |
| **Asaas** (BR) | Nome, email, CPF/CNPJ | Cobrança | Contratual / cobrança |
| **Vercel** (EUA) | Logs de acesso, IP | Hospedagem | Contratual |

⚠️ Supabase e Vercel são empresas americanas. Se armazenam dados pessoais de brasileiros, há requisito de adequação LGPD para transferência internacional.

---

## 6. Cobrança — obrigações específicas

| # | Item | Status |
|---|------|--------|
| 6.1 | Usuário informado sobre valor e ciclo da assinatura antes de pagar | ⚠️ Verificar tela de checkout |
| 6.2 | Política de cancelamento clara (prazo, reembolso) | ❌ Não documentada |
| 6.3 | Confirmação de cobrança por email (feita pelo Asaas) | ✅ Asaas envia automaticamente |
| 6.4 | Recibo de pagamento disponível | ✅ Via Asaas |
| 6.5 | Processo de cancelamento acessível ao usuário | ❌ Não implementado no app |

---

## 7. Ações recomendadas — ordem de prioridade

| Prioridade | Ação | Bloqueador? |
|-----------|------|------------|
| 🔴 P1 | Redigir e publicar Política de Privacidade | Sim — sem isso não usar com usuários reais |
| 🔴 P1 | Redigir e publicar Termos de Uso | Sim — sem isso não usar com usuários reais |
| 🔴 P1 | Adicionar aceite de termos no cadastro (checkbox) | Sim — evidência de consentimento |
| 🟡 P2 | Implementar exclusão de conta | Direito LGPD |
| 🟡 P2 | Documentar política de cancelamento | Proteção ao consumidor |
| 🟡 P2 | Revisar tela de checkout — garantir transparência de valores | Proteção ao consumidor |
| 🔵 P3 | Implementar exportação de dados | Direito LGPD |
| 🔵 P3 | Adicionar política de retenção de dados | Boa prática |

---

## 8. Critério go/no-go para uso com produtor real

**Mínimo necessário:**
- [ ] Política de Privacidade publicada e linkada no cadastro
- [ ] Termos de Uso publicados e linkados no cadastro
- [ ] Checkbox de aceite no cadastro
- [ ] Processo de cancelamento documentado

Sem esses 4 itens: **no-go** para teste com produtor real não-interno.
