# Guia do Criador Piloto — HERDON

**Sprint 19 · Beta Piloto Controlado**
**Audiência:** você, Herdon, ao conversar com o criador piloto

---

## Antes de começar

### Pré-requisito: criar acesso no banco

O piloto acessa o sistema com conta normal. Para liberar o plano completo, o admin (você) deve inserir uma linha em `customer_subscriptions` após o criador se cadastrar.

Ver `supabase/sql/grant_pilot_access.sql` para o script pronto.

**Fluxo:**
1. Criador se cadastra na URL de produção
2. Criador te envia o e-mail de cadastro
3. Você busca o `user_id` no painel Supabase (Auth > Users)
4. Você executa o SQL de concessão com o UUID correto
5. Criador faz logout e login novamente → plano Fundador ativo

---

## O que o criador piloto pode fazer

### Fluxo recomendado (Golden Path)

```
1. Criar fazenda
2. Cadastrar pastos da fazenda
3. Criar lote → vincular ao pasto
4. Cadastrar animais no lote
5. Registrar pesagens
6. Lançar despesas e receitas
7. Conferir Resultado dos Lotes
8. Explorar Simulador de Decisão
9. Explorar Indicadores
```

### Módulos disponíveis

O plano Fundador libera **todos os módulos**, incluindo:
- Pastos, Indicadores, Simulador de Decisão, Dashboard Premium
- Fluxo de Caixa, Rateio de Custos, Relatórios Gerenciais

---

## Canal de feedback

### Como o criador piloto deve reportar

**E-mail:** herdonapp@gmail.com

**Assunto dos e-mails:**

| Tipo | Assunto |
|------|---------|
| Bug | `HERDON — Bug: [descrição curta]` |
| Dúvida | `HERDON — Dúvida: [tema]` |
| Sugestão | `HERDON — Sugestão: [tema]` |
| Elogio | `HERDON — Feedback: [o que gostou]` |

**Prazo de resposta:** até 48h úteis.

### O que pedir no relato de bug

Solicitar ao criador:
1. O que estava fazendo quando o problema ocorreu
2. O que esperava acontecer
3. O que aconteceu de fato (mensagem de erro, tela parada, etc.)
4. Dispositivo e navegador (se possível, uma captura de tela)

### SuportePage interna

O app já tem uma página de suporte em `/suporte` com o e-mail configurado. O criador pode acessá-la pelo menu lateral.

---

## O que comunicar ao criador piloto

### Mensagem inicial sugerida

> Olá! Obrigado por participar do beta piloto do HERDON.
>
> Seu acesso está liberado com o plano completo por 30 dias. Você pode explorar todas as funcionalidades do sistema.
>
> Para qualquer dúvida ou problema, me manda um e-mail em herdonapp@gmail.com com o assunto "HERDON — [tipo]: [tema]".
>
> O sistema ainda está em beta, então erros podem acontecer. Seu feedback é essencial para melhorarmos antes do lançamento.

### O que NÃO prometer ao piloto

- Que dados serão migrados automaticamente para a versão final
- Que o sistema não terá instabilidade (é beta)
- Preços ou planos comerciais definitivos

---

## Acompanhamento do piloto

### Verificar periodicamente via Supabase

```sql
-- Últimas 20 fazendas criadas pelo piloto
SELECT nome, created_at FROM fazendas
WHERE owner_user_id = '<uuid-do-piloto>'
ORDER BY created_at DESC LIMIT 20;

-- Lotes ativos do piloto
SELECT nome, status, sistema FROM lotes
WHERE owner_user_id = '<uuid-do-piloto>';

-- Pastos criados
SELECT nome, status FROM pastagens
WHERE owner_user_id = '<uuid-do-piloto>';
```

### Revogar acesso (se necessário)

```sql
UPDATE customer_subscriptions
SET status = 'canceled', updated_at = now()
WHERE owner_user_id = '<uuid-do-piloto>';
```

---

## Limites do beta piloto

| Item | Situação |
|------|---------|
| Cobrança | Nenhuma — `billing_provider = 'manual'` |
| Asaas | Desativado para o piloto |
| Duração | 30 dias (expira em `current_period_end`) |
| Número de pilotos | 1 criador real nesta fase |
| Plano | Fundador (acesso completo) |
| Revogação | Manual via SQL acima |
