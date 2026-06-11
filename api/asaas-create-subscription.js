import { handleCreateSubscriptionRequest } from './_asaas.js';

export default async function handler(req, res) {
  const result = await handleCreateSubscriptionRequest(req);
  return res.status(result.status).json(result.payload);
}
