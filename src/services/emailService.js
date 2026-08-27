const EMAIL_API_URL = import.meta.env.VITE_EMAIL_API_URL || '/api/email';
const FROM_EMAIL = import.meta.env.VITE_FROM_EMAIL || 'leads@myraacademy.com';
const REPLY_TO_EMAIL = import.meta.env.VITE_REPLY_TO_EMAIL || FROM_EMAIL;

export async function sendEmail({ to, subject, html, text, replyTo }) {
  try {
    const response = await fetch(EMAIL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: String(to || '').trim(),
        subject,
        html,
        text: text || stripHtml(html),
        replyTo: replyTo || REPLY_TO_EMAIL
      })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.message || `Email service error: ${response.status}`);
    }

    return result;
  } catch (error) {
    if (error instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(error.message)) {
      throw new Error('Email service is unavailable. Start the API with npm run dev (or npm run api) and try again.');
    }
    throw error;
  }
}

export async function sendWelcomeEmail(lead) {
  if (!lead?.email) {
    throw new Error('Lead does not have an email address');
  }

  return sendEmail({
    to: lead.email,
    subject: 'Welcome to the Future of Technology!',
    html: generateWelcomeEmailHTML(lead),
    text: generateWelcomeEmailText(lead),
    replyTo: REPLY_TO_EMAIL
  });
}

function generateWelcomeEmailHTML(lead) {
  const name = lead.name || 'there';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to the Future of Technology!</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1e293b;">
  <div style="max-width:600px;margin:0 auto;background-color:#ffffff;">
    <div style="background:linear-gradient(135deg,#1E3A8A 0%,#1e40af 100%);padding:36px 28px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:26px;">Welcome to the Future of Technology!</h1>
      <p style="color:rgba(255,255,255,0.92);margin:10px 0 0 0;font-size:16px;">Myra Academy</p>
    </div>
    <div style="padding:36px 28px;">
      <p style="margin:0 0 16px 0;font-size:16px;color:#334155;">Hello ${name},</p>
      <p style="margin:0 0 16px 0;font-size:16px;color:#475569;">Thank you for your interest in our Robotics, Electronics &amp; AI/ML programs. 🤖⚡🧠</p>
      <p style="margin:0 0 16px 0;font-size:16px;color:#475569;">We have successfully received your details. Our team will connect with you shortly to understand your interests and help you choose the right learning path.</p>
      ${lead.program || lead.goal || lead.grade ? `
      <div style="background-color:#f1f5f9;border-left:4px solid #F97316;padding:16px 18px;margin:20px 0;border-radius:4px;">
        ${lead.program ? `<p style="margin:4px 0;font-size:15px;"><strong>Program interest:</strong> ${lead.program}</p>` : ''}
        ${lead.goal ? `<p style="margin:4px 0;font-size:15px;"><strong>Your goal:</strong> ${lead.goal}</p>` : ''}
        ${lead.grade ? `<p style="margin:4px 0;font-size:15px;"><strong>Grade/class:</strong> ${lead.grade}</p>` : ''}
      </div>
      ` : ''}
      <p style="margin:20px 0 8px 0;font-size:16px;color:#1E3A8A;"><strong>✨ What you can explore:</strong></p>
      <ul style="margin:0 0 20px 18px;padding:0;color:#475569;font-size:16px;line-height:1.7;">
        <li>🤖 Robotics &amp; Automation</li>
        <li>⚡ Electronics &amp; Embedded Systems</li>
        <li>🧠 Artificial Intelligence &amp; Machine Learning</li>
        <li>💻 Hands-on Projects &amp; Innovation</li>
      </ul>
      <p style="margin:0 0 16px 0;font-size:16px;color:#475569;">Get ready to Build. Create. Innovate. 🚀</p>
      <p style="margin:0 0 24px 0;font-size:16px;color:#475569;">📞 Our team will contact you soon.</p>
      <a href="https://www.myraacademy.com" style="display:inline-block;padding:14px 28px;background-color:#F97316;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Visit Our Website</a>
      <p style="margin:28px 0 0 0;font-size:16px;color:#334155;">Team Myra Academy</p>
    </div>
    <div style="background-color:#f8fafc;padding:24px 28px;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="margin:0;font-size:14px;color:#64748b;">Reply to this email or write to <a href="mailto:${REPLY_TO_EMAIL}" style="color:#1E3A8A;text-decoration:none;">${REPLY_TO_EMAIL}</a></p>
      <p style="margin:8px 0 0 0;font-size:14px;"><a href="https://www.myraacademy.com" style="color:#1E3A8A;text-decoration:none;">www.myraacademy.com</a></p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function generateWelcomeEmailText(lead) {
  const name = lead.name || 'there';
  const lines = [
    `Hello ${name},`,
    '',
    'Welcome to the Future of Technology!',
    '',
    'Thank you for your interest in our Robotics, Electronics & AI/ML programs.',
    '',
    'We have successfully received your details. Our team will connect with you shortly to understand your interests and help you choose the right learning path.',
    ''
  ];

  if (lead.program) lines.push(`Program interest: ${lead.program}`);
  if (lead.goal) lines.push(`Your goal: ${lead.goal}`);
  if (lead.grade) lines.push(`Grade/class: ${lead.grade}`);
  if (lead.program || lead.goal || lead.grade) lines.push('');

  lines.push(
    'What you can explore:',
    '• Robotics & Automation',
    '• Electronics & Embedded Systems',
    '• Artificial Intelligence & Machine Learning',
    '• Hands-on Projects & Innovation',
    '',
    'Get ready to Build. Create. Innovate.',
    '',
    'Our team will contact you soon.',
    '',
    'Team Myra Academy',
    'www.myraacademy.com'
  );

  return lines.join('\n');
}

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gi, '')
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function testSendGridConnection() {
  try {
    await sendEmail({
      to: FROM_EMAIL,
      subject: 'SendGrid Test - Myra Academy',
      html: '<h1>Test Email</h1><p>SendGrid is configured correctly!</p>',
      text: 'Test Email - SendGrid is configured correctly!'
    });
    return { success: true, message: 'SendGrid connection successful' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}
