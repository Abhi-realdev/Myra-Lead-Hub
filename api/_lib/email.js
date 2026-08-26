import sgMail from '@sendgrid/mail';

export async function handleEmail(request, response) {
  const { to, subject, html, text, replyTo } = request.body || {};

  if (!process.env.SENDGRID_API_KEY) {
    return response.status(503).json({ message: 'SENDGRID_API_KEY is not configured on Vercel.' });
  }

  if (!to || !subject || !html) {
    return response.status(400).json({ message: 'Email recipient, subject, and HTML content are required.' });
  }

  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  try {
    const [result] = await sgMail.send({
      to,
      from: { email: process.env.FROM_EMAIL || 'leads@myraacademy.com', name: "Myra's Academy" },
      replyTo: { email: replyTo || process.env.REPLY_TO_EMAIL || process.env.FROM_EMAIL || 'leads@myraacademy.com', name: "Myra's Academy" },
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
    return response.status(502).json({ message });
  }
}
