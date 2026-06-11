import { handleWebhookRequest } from './_asaas.js';

export default async function handler(req, res) {
  const result = await handleWebhookRequest(req);
  return res.status(result.status).json(result.payload);
}
