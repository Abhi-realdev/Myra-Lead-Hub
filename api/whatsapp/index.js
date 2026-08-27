import { handleWhatsApp } from '../_lib/whatsapp.js';

export default async function handler(request, response) {
  if (request.method === 'GET') {
    return response.json({
      configured: Boolean(
        process.env.WHATSAPP_ACCESS_TOKEN &&
        process.env.WHATSAPP_PHONE_NUMBER_ID &&
        process.env.WHATSAPP_TEMPLATE_NAME
      ),
      phoneNumberIdConfigured: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID),
      templateConfigured: Boolean(process.env.WHATSAPP_TEMPLATE_NAME),
      templateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en_US',
      defaultCountryCode: process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91'
    });
  }

  return handleWhatsApp(request, response);
}
