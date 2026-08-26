import { normalizeRecipient } from '../../utils/phoneNumber.js';

export async function handleWhatsApp(request, response) {
  const { to, country, name, program, goal } = request.body || {};

  if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID || !process.env.WHATSAPP_TEMPLATE_NAME) {
    return response.status(503).json({ message: 'WhatsApp is not configured on Vercel.' });
  }

  if (!to || !name) {
    return response.status(400).json({ message: 'WhatsApp recipient and lead name are required.' });
  }

  let normalizedRecipient;
  try {
    normalizedRecipient = normalizeRecipient(to, country, process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91');
  } catch (error) {
    return response.status(400).json({ message: error.message });
  }

  try {
    const graphResponse = await fetch(`https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || 'v20.0'}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalizedRecipient,
        type: 'template',
        template: {
          name: process.env.WHATSAPP_TEMPLATE_NAME,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en_US' },
          components: [{
            type: 'body',
            parameters: [
              { type: 'text', text: name },
              { type: 'text', text: program || 'our programs' },
              { type: 'text', text: goal || 'your educational goals' }
            ]
          }]
        }
      })
    });

    const result = await graphResponse.json().catch(() => ({}));
    if (!graphResponse.ok) {
      const metaError = result.error;
      const message = metaError?.code === 131030
        ? `Recipient ${normalizedRecipient} is not in the WhatsApp test allowlist. Add it in Meta WhatsApp API Setup or move the app to production.`
        : metaError?.message || 'WhatsApp Cloud API request failed.';
      return response.status(graphResponse.status).json({ message, code: metaError?.code, type: metaError?.type, recipient: normalizedRecipient });
    }

    return response.json({ success: true, messageId: result.messages?.[0]?.id, provider: 'whatsapp-cloud-api' });
  } catch (error) {
    console.error('WhatsApp API error:', error);
    return response.status(502).json({ message: `WhatsApp request could not be completed for ${normalizedRecipient}: ${error.message}`, recipient: normalizedRecipient });
  }
}
