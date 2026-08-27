import sgMail from '@sendgrid/mail';

export function formatSendGridError(error) {
  const items = error.response?.body?.errors;
  if (Array.isArray(items) && items.length) {
    return items.map(item => item.message).join(', ');
  }

  return error.message || 'SendGrid request failed.';
}

export async function sendWithSendGrid({
  apiKey,
  to,
  subject,
  html,
  text,
  fromEmail,
  fromName = "Myra's Academy",
  replyToEmail,
  replyToName = "Myra's Academy"
}) {
  const key = String(apiKey || '').trim();
  if (!key) {
    const error = new Error('SENDGRID_API_KEY is not configured on the server.');
    error.statusCode = 503;
    throw error;
  }

  if (!to || !subject || !html) {
    const error = new Error('Email recipient, subject, and HTML content are required.');
    error.statusCode = 400;
    throw error;
  }

  sgMail.setApiKey(key);

  const [result] = await sgMail.send({
    to: String(to).trim(),
    from: { email: fromEmail, name: fromName },
    replyTo: { email: replyToEmail || fromEmail, name: replyToName },
    subject,
    text: text || html.replace(/<[^>]+>/g, ' '),
    html
  });

  return {
    success: true,
    messageId: result.headers['x-message-id'] || `sg_${Date.now()}`,
    provider: 'sendgrid'
  };
}
