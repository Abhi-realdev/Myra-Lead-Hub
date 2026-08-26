export default async function handler(request, response) {
  if (request.method === 'GET') {
    const { 'hub.mode': mode, 'hub.verify_token': verifyToken, 'hub.challenge': challenge } = request.query;

    if (mode === 'subscribe' && process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN && verifyToken === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      return response.status(200).send(challenge);
    }

    return response.sendStatus(403);
  }

  if (request.method === 'POST') {
    if (request.body?.object !== 'whatsapp_business_account') {
      return response.sendStatus(404);
    }

    for (const entry of request.body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        for (const status of value.statuses || []) {
          console.log('WhatsApp message status:', {
            messageId: status.id,
            recipient: status.recipient_id,
            status: status.status,
            timestamp: status.timestamp,
            errors: status.errors || []
          });
        }

        for (const message of value.messages || []) {
          console.log('WhatsApp inbound message:', {
            messageId: message.id,
            from: message.from,
            type: message.type,
            text: message.text?.body || null,
            timestamp: message.timestamp
          });
        }
      }
    }

    return response.sendStatus(200);
  }

  return response.status(405).json({ message: 'Method not allowed.' });
}
