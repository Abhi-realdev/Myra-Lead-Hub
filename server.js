import 'dotenv/config';
import express from 'express';
import { formatSendGridError, sendWithSendGrid } from './utils/sendgridMail.js';
import { normalizeRecipient } from './utils/phoneNumber.js';
import { listWhatsAppTemplates, sendWhatsAppTemplateMessage, submitLeadWelcomeTemplate } from './utils/whatsappCloud.js';

const app = express();
const port = process.env.PORT || 3001;
const fromEmail = process.env.FROM_EMAIL || 'leads@myraacademy.com';
const replyToEmail = process.env.REPLY_TO_EMAIL || fromEmail;
const whatsappApiVersion = process.env.WHATSAPP_API_VERSION || 'v20.0';
const whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const whatsappAccessToken = process.env.WHATSAPP_ACCESS_TOKEN;
const whatsappTemplateName = process.env.WHATSAPP_TEMPLATE_NAME;
const whatsappTemplateLanguage = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en_US';
const whatsappDefaultCountryCode = process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91';
const whatsappWebhookVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
const whatsappWabaId = process.env.WHATSAPP_WABA_ID;

app.use((request, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', request.headers.origin || '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (request.method === 'OPTIONS') {
    return response.sendStatus(204);
  }

  next();
});

app.use(express.json({ limit: '1mb' }));

app.get('/api/whatsapp/health', (request, response) => {
  response.json({
    configured: Boolean(whatsappAccessToken && whatsappPhoneNumberId && whatsappTemplateName),
    phoneNumberIdConfigured: Boolean(whatsappPhoneNumberId),
    templateConfigured: Boolean(whatsappTemplateName),
    templateLanguage: whatsappTemplateLanguage,
    wabaIdConfigured: Boolean(whatsappWabaId),
    defaultCountryCode: whatsappDefaultCountryCode
  });
});

app.get('/api/whatsapp/templates', async (request, response) => {
  if (!whatsappAccessToken || !whatsappPhoneNumberId) {
    return response.status(503).json({
      message: 'WhatsApp is not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.'
    });
  }

  const listing = await listWhatsAppTemplates({
    apiVersion: whatsappApiVersion,
    phoneNumberId: whatsappPhoneNumberId,
    accessToken: whatsappAccessToken,
    wabaId: whatsappWabaId
  });

  if (listing.error) {
    return response.status(502).json({
      message: listing.error,
      wabaId: listing.wabaId,
      templates: []
    });
  }

  return response.json({
    wabaId: listing.wabaId,
    templates: listing.templates.map(template => ({
      name: template.name,
      language: template.language,
      status: template.status,
      category: template.category,
      rejectedReason: template.rejected_reason || null
    }))
  });
});

app.post('/api/whatsapp/templates/lead-welcome', async (request, response) => {
  if (!whatsappAccessToken || !whatsappPhoneNumberId) {
    return response.status(503).json({
      message: 'WhatsApp is not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.'
    });
  }

  const result = await submitLeadWelcomeTemplate({
    apiVersion: whatsappApiVersion,
    phoneNumberId: whatsappPhoneNumberId,
    accessToken: whatsappAccessToken,
    wabaId: whatsappWabaId
  });

  return response.status(result.status).json(result.body);
});

app.post('/api/email', async (request, response) => {
  const { to, subject, html, text, replyTo } = request.body;

  try {
    const result = await sendWithSendGrid({
      apiKey: process.env.SENDGRID_API_KEY,
      to,
      subject,
      html,
      text,
      fromEmail,
      replyToEmail: replyTo || replyToEmail
    });

    return response.json(result);
  } catch (error) {
    const message = formatSendGridError(error);
    console.error('SendGrid email error:', message);
    return response.status(error.statusCode || (error.code >= 400 && error.code < 600 ? error.code : 502)).json({ message });
  }
});

app.post('/api/whatsapp', async (request, response) => {
  const { to, country, name, program, goal } = request.body;

  if (!whatsappAccessToken || !whatsappPhoneNumberId || !whatsappTemplateName) {
    return response.status(503).json({
      message: 'WhatsApp is not configured. Set WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, and WHATSAPP_TEMPLATE_NAME.'
    });
  }

  if (!to || !name) {
    return response.status(400).json({ message: 'WhatsApp recipient and lead name are required.' });
  }

  let normalizedRecipient;
  try {
    normalizedRecipient = normalizeRecipient(to, country, whatsappDefaultCountryCode);
  } catch (error) {
    return response.status(400).json({ message: error.message });
  }

  try {
    const result = await sendWhatsAppTemplateMessage({
      apiVersion: whatsappApiVersion,
      phoneNumberId: whatsappPhoneNumberId,
      accessToken: whatsappAccessToken,
      templateName: whatsappTemplateName,
      templateLanguage: whatsappTemplateLanguage,
      wabaId: whatsappWabaId,
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
    return response.status(502).json({
      message: `WhatsApp request could not be completed for ${normalizedRecipient}: ${error.message}`,
      recipient: normalizedRecipient
    });
  }
});

app.get('/api/whatsapp/webhook', (request, response) => {
  const { 'hub.mode': mode, 'hub.verify_token': verifyToken, 'hub.challenge': challenge } = request.query;

  if (mode === 'subscribe' && whatsappWebhookVerifyToken && verifyToken === whatsappWebhookVerifyToken) {
    return response.status(200).send(challenge);
  }

  return response.sendStatus(403);
});

app.post('/api/whatsapp/webhook', (request, response) => {
console.log('🔥 WHATSAPP WEBHOOK HIT');
console.log('Webhook headers:', request.headers);
console.log('Webhook body:', JSON.stringify(request.body, null, 2));
  if (request.body.object !== 'whatsapp_business_account') {
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
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});