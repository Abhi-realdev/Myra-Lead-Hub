import { normalizeRecipient } from '../../utils/phoneNumber.js';
import { sendWhatsAppTemplateMessage } from '../../utils/whatsappCloud.js';

export async function handleWhatsApp(request, response) {
  response.setHeader('Access-Control-Allow-Origin', request.headers.origin || '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (request.method === 'OPTIONS') {
    return response.status(204).end();
  }

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
    const result = await sendWhatsAppTemplateMessage({
      apiVersion: process.env.WHATSAPP_API_VERSION || 'v20.0',
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
      templateName: process.env.WHATSAPP_TEMPLATE_NAME,
      templateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en_US',
      wabaId: process.env.WHATSAPP_WABA_ID,
      to: normalizedRecipient,
      name,
      program,
      goal
    });

    if (!result.ok) {
      console.error('WhatsApp Cloud API rejected message:', result.body);
      return response.status(result.status).json(result.body);
    }

    return response.json(result.body);
  } catch (error) {
    console.error('WhatsApp API error:', error);
    return response.status(502).json({ message: `WhatsApp request could not be completed for ${normalizedRecipient}: ${error.message}`, recipient: normalizedRecipient });
  }
}
