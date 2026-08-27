import { formatSendGridError, sendWithSendGrid } from '../../utils/sendgridMail.js';

export async function handleEmail(request, response) {
  response.setHeader('Access-Control-Allow-Origin', request.headers.origin || '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (request.method === 'OPTIONS') {
    return response.status(204).end();
  }

  const { to, subject, html, text, replyTo } = request.body || {};

  try {
    const result = await sendWithSendGrid({
      apiKey: process.env.SENDGRID_API_KEY,
      to,
      subject,
      html,
      text,
      fromEmail: process.env.FROM_EMAIL || 'leads@myraacademy.com',
      replyToEmail: replyTo || process.env.REPLY_TO_EMAIL || process.env.FROM_EMAIL || 'leads@myraacademy.com'
    });

    return response.json(result);
  } catch (error) {
    const message = formatSendGridError(error);
    console.error('SendGrid email error:', message);
    return response.status(error.statusCode || (error.code >= 400 && error.code < 600 ? error.code : 502)).json({ message });
  }
}
