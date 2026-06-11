import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSubscriptionAccessState,
  canAccessModule,
  canCreateAnimal,
  canCreateFarm,
  canInviteUser,
  getCurrentSubscription,
  getPlanLimits,
  getSubscriptionDisplayCopy,
  getSubscriptionStatusLabel,
  hasActiveSubscription,
} from '../src/services/subscriptions.js';

test('plan limits are calculated correctly', () => {
  const fundador = getPlanLimits('fundador');
  const essencial = getPlanLimits('essencial');
  const pro = getPlanLimits('pro');
  const premium = getPlanLimits('premium');
  const enterprise = getPlanLimits('enterprise');

  assert.equal(fundador.planName, 'FUNDADOR');
  assert.equal(fundador.limits.farms, 50);
  assert.equal(fundador.limits.animals, 10000);
  assert.equal(fundador.limits.users, 50);

  assert.equal(essencial.planName, 'ESSENCIAL');
  assert.equal(essencial.limits.farms, 1);
  assert.equal(essencial.limits.animals, 300);
  assert.equal(essencial.limits.users, 2);

  assert.equal(pro.limits.farms, 3);
  assert.equal(pro.limits.animals, 1000);
  assert.equal(pro.limits.users, 5);

  assert.equal(premium.limits.farms, 10);
  assert.equal(premium.limits.animals, 3000);
  assert.equal(premium.limits.users, 10);

  assert.equal(enterprise.limits.farms, null);
  assert.equal(enterprise.limits.animals, null);
  assert.equal(enterprise.limits.users, null);
});

test('active subscription allows access', () => {
  const subscription = { plan_code: 'pro', status: 'active' };
  assert.equal(hasActiveSubscription(subscription), true);
  assert.equal(canAccessModule(subscription, 'financeiro'), true);
  assert.equal(buildSubscriptionAccessState(subscription).blocked, false);
});

test('trialing subscription allows access', () => {
  const subscription = { plan_code: 'essencial', status: 'trialing' };
  assert.equal(hasActiveSubscription(subscription), true);
  assert.equal(canAccessModule(subscription, 'fazendas'), true);
  assert.equal(buildSubscriptionAccessState(subscription).warning, false);
});

test('internal_test subscription allows access', () => {
  const subscription = { plan_code: 'premium', status: 'internal_test' };
  const access = buildSubscriptionAccessState(subscription);

  assert.equal(hasActiveSubscription(subscription), true);
  assert.equal(access.canEnterApp, true);
  assert.equal(access.blocked, false);
  assert.equal(getSubscriptionStatusLabel(subscription.status), 'Acesso de teste ativo');
  assert.equal(access.message, 'Acesso de teste ativo.');
});

test('past_due shows warning behavior', () => {
  const subscription = { plan_code: 'pro', status: 'past_due' };
  const access = buildSubscriptionAccessState(subscription);

  assert.equal(access.canEnterApp, true);
  assert.equal(access.warning, true);
  assert.equal(access.blocked, false);
  assert.match(access.message, /pendente/i);
  assert.equal(canAccessModule(subscription, 'financeiro'), true);
});

test('canceled and blocked subscriptions block access unless override is enabled', () => {
  const canceled = { plan_code: 'premium', status: 'canceled' };
  const blocked = { plan_code: 'premium', status: 'blocked' };
  const override = { plan_code: 'premium', status: 'blocked', override: true };

  assert.equal(buildSubscriptionAccessState(canceled).blocked, true);
  assert.equal(buildSubscriptionAccessState(blocked).blocked, true);
  assert.equal(canAccessModule(canceled, 'pastagens'), false);
  assert.equal(canAccessModule(blocked, 'pastagens'), false);
  assert.equal(buildSubscriptionAccessState(override).blocked, false);
  assert.equal(canAccessModule(override, 'pastagens'), true);
});

test('plan limits are enforced for farms, animals and users', () => {
  const essencial = { plan_code: 'essencial', status: 'active' };

  assert.equal(canCreateFarm(essencial, 0).allowed, true);
  assert.equal(canCreateFarm(essencial, 1).allowed, false);

  assert.equal(canCreateAnimal(essencial, 299, 1).allowed, true);
  assert.equal(canCreateAnimal(essencial, 299, 2).allowed, false);

  assert.equal(canInviteUser(essencial, 1).allowed, true);
  assert.equal(canInviteUser(essencial, 2).allowed, false);
});

test('helpers are safe when no subscription exists', () => {
  const access = buildSubscriptionAccessState(null);

  assert.equal(getCurrentSubscription({}), null);
  assert.equal(hasActiveSubscription(null), true);
  assert.equal(access.canEnterApp, true);
  assert.equal(access.blocked, false);
  assert.equal(canAccessModule(null, 'financeiro'), true);
  assert.equal(canCreateFarm(null, 999).allowed, true);
});

test('active and internal_test subscriptions do not surface regularize CTA', () => {
  const active = getSubscriptionDisplayCopy({ plan_code: 'pro', status: 'active' });
  const trialing = getSubscriptionDisplayCopy({ plan_code: 'pro', status: 'trialing' });
  const internalTest = getSubscriptionDisplayCopy({ plan_code: 'pro', status: 'internal_test' });
  const pastDue = getSubscriptionDisplayCopy({ plan_code: 'pro', status: 'past_due' });
  const canceled = getSubscriptionDisplayCopy({ plan_code: 'pro', status: 'canceled' });
  const blocked = getSubscriptionDisplayCopy({ plan_code: 'pro', status: 'blocked' });

  assert.notEqual(active.primaryLabel, 'Regularizar assinatura');
  assert.notEqual(trialing.primaryLabel, 'Regularizar assinatura');
  assert.notEqual(internalTest.primaryLabel, 'Regularizar assinatura');
  assert.equal(active.helperText, 'Checkout em preparação');
  assert.equal(internalTest.message, 'Acesso de teste ativo.');
  assert.equal(pastDue.primaryLabel, 'Regularizar assinatura');
  assert.equal(canceled.primaryLabel, 'Regularizar assinatura');
  assert.equal(blocked.primaryLabel, 'Regularizar assinatura');
});
