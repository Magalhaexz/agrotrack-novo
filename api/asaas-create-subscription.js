import { handleCreateSubscriptionRequest } from './_asaas.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(204).end();
  }

  const result = await handleCreateSubscriptionRequest(req);
  return res.status(result.status).json(result.payload);
}
