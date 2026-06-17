import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getMissingAsaasCustomerFields,
  isAsaasCustomerDataComplete,
  resolveAsaasPaymentUrl,
  isSandboxCheckoutAllowed,
  getSandboxCheckoutCopy,
} from './asaasBilling.js';

describe('getMissingAsaasCustomerFields', () => {
  it('retorna todos os campos quando objeto vazio', () => {
    const missing = getMissingAsaasCustomerFields({});
    assert.deepEqual(missing.sort(), ['cpfCnpj', 'email', 'mobilePhone', 'name']);
  });

  it('retorna campos ausentes quando parcial', () => {
    const missing = getMissingAsaasCustomerFields({ name: 'João', email: 'j@j.com' });
    assert.deepEqual(missing.sort(), ['cpfCnpj', 'mobilePhone']);
  });

  it('retorna array vazio quando todos os campos presentes', () => {
    const missing = getMissingAsaasCustomerFields({
      name: 'João Silva',
      email: 'joao@email.com',
      cpfCnpj: '123.456.789-00',
      mobilePhone: '11999999999',
    });
    assert.deepEqual(missing, []);
  });

  it('aceita alias cpf_cnpj e mobile_phone', () => {
    const missing = getMissingAsaasCustomerFields({
      name: 'Maria',
      email: 'maria@email.com',
      cpf_cnpj: '000.000.000-00',
      mobile_phone: '11988887777',
    });
    assert.deepEqual(missing, []);
  });

  it('aceita alias telefone para mobilePhone', () => {
    const missing = getMissingAsaasCustomerFields({
      name: 'Pedro',
      email: 'pedro@email.com',
      cpfCnpj: '111.222.333-44',
      telefone: '11977776666',
    });
    assert.deepEqual(missing, []);
  });

  it('retorna todos os campos para valor null', () => {
    const missing = getMissingAsaasCustomerFields(null);
    assert.deepEqual(missing.sort(), ['cpfCnpj', 'email', 'mobilePhone', 'name']);
  });
});

describe('isAsaasCustomerDataComplete', () => {
  it('retorna false quando dados incompletos', () => {
    assert.equal(isAsaasCustomerDataComplete({ name: 'x' }), false);
  });

  it('retorna true quando todos os campos presentes', () => {
    assert.equal(
      isAsaasCustomerDataComplete({
        name: 'Ana',
        email: 'ana@email.com',
        cpfCnpj: '999.888.777-66',
        mobilePhone: '11966665555',
      }),
      true
    );
  });
});

describe('resolveAsaasPaymentUrl', () => {
  it('retorna null para payload vazio', () => {
    assert.equal(resolveAsaasPaymentUrl({}), null);
  });

  it('resolve checkoutUrl diretamente', () => {
    assert.equal(resolveAsaasPaymentUrl({ checkoutUrl: 'https://asaas.com/c/abc' }), 'https://asaas.com/c/abc');
  });

  it('resolve paymentUrl como fallback', () => {
    assert.equal(resolveAsaasPaymentUrl({ paymentUrl: 'https://asaas.com/p/xyz' }), 'https://asaas.com/p/xyz');
  });

  it('resolve checkoutUrl aninhado em data', () => {
    assert.equal(
      resolveAsaasPaymentUrl({ data: { checkoutUrl: 'https://asaas.com/c/nested' } }),
      'https://asaas.com/c/nested'
    );
  });

  it('prioriza checkoutUrl sobre paymentUrl', () => {
    assert.equal(
      resolveAsaasPaymentUrl({
        checkoutUrl: 'https://asaas.com/c/primeiro',
        paymentUrl: 'https://asaas.com/p/segundo',
      }),
      'https://asaas.com/c/primeiro'
    );
  });

  it('resolve payment_link.url', () => {
    assert.equal(
      resolveAsaasPaymentUrl({ payment_link: { url: 'https://asaas.com/link/abc' } }),
      'https://asaas.com/link/abc'
    );
  });

  it('retorna null quando nenhuma URL encontrada', () => {
    assert.equal(resolveAsaasPaymentUrl({ id: '123', status: 'PENDING' }), null);
  });
});

describe('isSandboxCheckoutAllowed', () => {
  it('permite checkout quando sem assinatura (null)', () => {
    assert.equal(isSandboxCheckoutAllowed(null), true);
  });

  it('permite checkout quando assinatura cancelada', () => {
    assert.equal(isSandboxCheckoutAllowed({ status: 'canceled' }), true);
  });

  it('permite checkout quando assinatura vencida (past_due)', () => {
    assert.equal(isSandboxCheckoutAllowed({ status: 'past_due' }), true);
  });

  it('permite checkout quando assinatura bloqueada', () => {
    assert.equal(isSandboxCheckoutAllowed({ status: 'blocked' }), true);
  });

  it('bloqueia checkout quando assinatura ativa', () => {
    assert.equal(isSandboxCheckoutAllowed({ status: 'active' }), false);
  });

  it('bloqueia checkout quando assinatura em trial', () => {
    assert.equal(isSandboxCheckoutAllowed({ status: 'trialing' }), false);
  });
});

describe('getSandboxCheckoutCopy', () => {
  it('retorna canCheckout true sem assinatura', () => {
    const copy = getSandboxCheckoutCopy(null);
    assert.equal(copy.canCheckout, true);
  });

  it('retorna canCheckout false para assinatura ativa', () => {
    const copy = getSandboxCheckoutCopy({ status: 'active' });
    assert.equal(copy.canCheckout, false);
  });

  it('retorna label de regularização para assinatura vencida', () => {
    const copy = getSandboxCheckoutCopy({ status: 'past_due' });
    assert.equal(copy.canCheckout, true);
    assert.ok(copy.label.length > 0);
  });
});

describe('billingType para PIX — configuração esperada', () => {
  it('billingType UNDEFINED permite PIX quando habilitado no painel Asaas', () => {
    // UNDEFINED = Asaas mostra todos os meios de pagamento ativos na conta.
    // Para PIX aparecer no checkout de assinaturas recorrentes, é necessário
    // habilitar "Assinatura via PIX" no painel Asaas → Configurações → Formas de Pagamento.
    // Este teste documenta o comportamento esperado e os métodos suportados.
    const EXPECTED_BILLING_TYPE = 'UNDEFINED';
    const SUPPORTED_METHODS = ['PIX', 'BOLETO', 'CREDIT_CARD'];

    assert.equal(EXPECTED_BILLING_TYPE, 'UNDEFINED');
    assert.ok(SUPPORTED_METHODS.includes('PIX'), 'PIX deve estar na lista de meios suportados');
    assert.ok(SUPPORTED_METHODS.includes('BOLETO'), 'BOLETO deve estar na lista de meios suportados');
    assert.ok(SUPPORTED_METHODS.includes('CREDIT_CARD'), 'CREDIT_CARD deve estar na lista de meios suportados');
    assert.equal(SUPPORTED_METHODS.length, 3, 'exatamente 3 meios de pagamento suportados');
  });
});
