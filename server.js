import 'dotenv/config';
import express from 'express';
import sgMail from '@sendgrid/mail';
import { normalizeRecipient } from './utils/phoneNumber.js';

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
app.use(express.json({ limit: '1mb' }));

app.get('/api/whatsapp/health', (request, response) => {
  response.json({
    configured: Boolean(whatsappAccessToken && whatsappPhoneNumberId && whatsappTemplateName),
    phoneNumberIdConfigured: Boolean(whatsappPhoneNumberId),
    templateConfigured: Boolean(whatsappTemplateName),
    templateLanguage: whatsappTemplateLanguage,
    defaultCountryCode: whatsappDefaultCountryCode
  });
});

app.post('/api/email', async (request, response) => {
  const { to, subject, html, text, replyTo } = request.body;

  if (!process.env.SENDGRID_API_KEY) {
    return response.status(503).json({ message: 'SENDGRID_API_KEY is not configured on the server.' });
  }

  if (!to || !subject || !html) {
    return response.status(400).json({ message: 'Email recipient, subject, and HTML content are required.' });
  }

  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  try {
    const [result] = await sgMail.send({
      to,
      from: { email: fromEmail, name: "Myra's Academy" },
      replyTo: { email: replyTo || replyToEmail, name: "Myra's Academy" },
      subject,
      text: text || html.replace(/<[^>]+>/g, ' '),
      html
    });

    return response.json({
      success: true,
      messageId: result.headers['x-message-id'] || `sg_${Date.now()}`,
      provider: 'sendgrid'
    });
  } catch (error) {
    const message = error.response?.body?.errors?.map(item => item.message).join(', ') || error.message;
    console.error('SendGrid email error:', message);
    return response.status(error.code >= 400 && error.code < 600 ? error.code : 502).json({ message });
  }
});

app.listen(port, () => {
  console.log(`Email API listening on http://localhost:${port}`);
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
    const graphResponse = await fetch(`https://graph.facebook.com/${whatsappApiVersion}/${whatsappPhoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${whatsappAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalizedRecipient,
        type: 'template',
        template: {
          name: whatsappTemplateName,
          language: { code: whatsappTemplateLanguage },
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
        ? `Recipient ${normalizedRecipient} is not in the WhatsApp test allowlist. Add this number in Meta WhatsApp API Setup, or move the app to production after business verification and user opt-in.`
        : metaError?.message || 'WhatsApp Cloud API request failed.';
      console.error('WhatsApp Cloud API rejected message:', {
        status: graphResponse.status,
        recipient: normalizedRecipient,
        code: metaError?.code,
        type: metaError?.type,
        message
      });
      return response.status(graphResponse.status).json({
        message,
        code: metaError?.code,
        type: metaError?.type,
        recipient: normalizedRecipient
      });
    }

    return response.json({
      success: true,
      messageId: result.messages?.[0]?.id,
      provider: 'whatsapp-cloud-api'
    });
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