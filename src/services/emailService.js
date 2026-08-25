/**
 * SendGrid Email Service
 * Handles sending emails and managing templates
 */

const EMAIL_API_URL = import.meta.env.VITE_EMAIL_API_URL || '/api/email';
const FROM_EMAIL = import.meta.env.VITE_FROM_EMAIL || 'leads@myraacademy.com';

/**
 * Send email via SendGrid API
 * @param {Object} options - Email options
 * @returns {Promise<Object>} Send result
 */
export async function sendEmail({ to, subject, html, text, replyTo }) {
  try {
    const response = await fetch(EMAIL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ to, subject, html, text: text || stripHtml(html), replyTo })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Email service error: ${response.status}`);
    }

    return response.json();

  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Email service is unavailable. Start the API server and try again.');
    }
    throw error;
  }
}

/**
 * Send welcome email to new lead
 * @param {Object} lead - Lead object
 * @returns {Promise<Object>} Send result
 */
export async function sendWelcomeEmail(lead) {
  const subject = 'Connect with Myra\'s Academy';
  
  const html = generateWelcomeEmailHTML(lead);
  const text = generateWelcomeEmailText(lead);

  return sendEmail({
    to: lead.email,
    subject,
    html,
    text,
    replyTo: import.meta.env.VITE_REPLY_TO_EMAIL || FROM_EMAIL
  });
}

/**
 * Generate HTML email template for welcome email
 */
function generateWelcomeEmailHTML(lead) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Myra's Academy</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      margin: 0;
      padding: 0;
      background-color: #f8fafc;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #1E3A8A 0%, #1e40af 100%);
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .header p {
      color: rgba(255, 255, 255, 0.9);
      margin: 10px 0 0 0;
      font-size: 16px;
    }
    .content {
      padding: 40px 30px;
    }
    .content h2 {
      color: #1E3A8A;
      font-size: 22px;
      margin: 0 0 20px 0;
    }
    .content p {
      margin: 0 0 15px 0;
      font-size: 16px;
      color: #475569;
    }
    .highlight-box {
      background-color: #f1f5f9;
      border-left: 4px solid #F97316;
      padding: 20px;
      margin: 25px 0;
      border-radius: 4px;
    }
    .highlight-box p {
      margin: 5px 0;
      font-size: 15px;
    }
    .highlight-box strong {
      color: #1E3A8A;
    }
    .cta-button {
      display: inline-block;
      padding: 14px 32px;
      background-color: #F97316;
      color: #ffffff;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
    }
    .footer {
      background-color: #f8fafc;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    .footer p {
      margin: 5px 0;
      font-size: 14px;
      color: #64748b;
    }
    .footer a {
      color: #1E3A8A;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Myra's Academy</h1>
      <p>Empowering Future Leaders</p>
    </div>
    
    <div class="content">
      <h2>Hello ${lead.name}! 👋</h2>
      
      <p>Greetings from Myra's Academy!</p>
      
      <p>We're excited to connect with you and share more information about our programs and opportunities.</p>
      
      ${lead.program || lead.goal ? `
      <div class="highlight-box">
        ${lead.program ? `<p><strong>Program Interest:</strong> ${lead.program}</p>` : ''}
        ${lead.goal ? `<p><strong>Your Goal:</strong> ${lead.goal}</p>` : ''}
        ${lead.grade ? `<p><strong>Grade/Class:</strong> ${lead.grade}</p>` : ''}
      </div>
      ` : ''}
      
      <p>We would love to discuss how we can help you achieve your educational goals. Our team is here to answer any questions you may have.</p>
      
      ${lead.preferredTime ? `
      <p>We noticed you prefer to be contacted during: <strong>${lead.preferredTime}</strong>. We'll make sure to reach out at a convenient time for you.</p>
      ` : ''}
      
      <p>Please feel free to reply to this email or call us at your convenience. We're here to help!</p>
      
      <a href="https://www.myraacademy.com" class="cta-button">Visit Our Website</a>
      
      <p style="margin-top: 30px;">Best regards,<br><strong>Myra's Academy Team</strong></p>
    </div>
    
    <div class="footer">
      <p><strong>Myra's Academy</strong></p>
      <p>Email: <a href="mailto:${import.meta.env.VITE_REPLY_TO_EMAIL || FROM_EMAIL}">${import.meta.env.VITE_REPLY_TO_EMAIL || FROM_EMAIL}</a></p>
      <p><a href="https://www.myraacademy.com">www.myraacademy.com</a></p>
      <p style="margin-top: 20px; font-size: 12px;">
        This email was sent because you expressed interest in Myra's Academy programs.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text email for welcome email
 */
function generateWelcomeEmailText(lead) {
  let text = `Hello ${lead.name}!\n\n`;
  text += `Greetings from Myra's Academy!\n\n`;
  text += `We're excited to connect with you and share more information about our programs and opportunities.\n\n`;
  
  if (lead.program) {
    text += `Program Interest: ${lead.program}\n`;
  }
  if (lead.goal) {
    text += `Your Goal: ${lead.goal}\n`;
  }
  if (lead.grade) {
    text += `Grade/Class: ${lead.grade}\n`;
  }
  if (lead.program || lead.goal || lead.grade) {
    text += `\n`;
  }
  
  text += `We would love to discuss how we can help you achieve your educational goals. Our team is here to answer any questions you may have.\n\n`;
  
  if (lead.preferredTime) {
    text += `We noticed you prefer to be contacted during: ${lead.preferredTime}. We'll make sure to reach out at a convenient time for you.\n\n`;
  }
  
  text += `Please feel free to reply to this email or call us at your convenience. We're here to help!\n\n`;
  text += `Visit our website: https://www.myraacademy.com\n\n`;
  text += `Best regards,\n`;
  text += `Myra's Academy Team\n\n`;
  text += `---\n`;
  text += `Myra's Academy\n`;
  text += `Email: ${import.meta.env.VITE_REPLY_TO_EMAIL || FROM_EMAIL}\n`;
  text += `Website: www.myraacademy.com\n\n`;
  text += `This email was sent because you expressed interest in Myra's Academy programs.`;
  
  return text;
}

/**
 * Strip HTML tags for plain text version
 */
function stripHtml(html) {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gi, '')
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Test SendGrid configuration
 */
export async function testSendGridConnection() {
  try {
    const testEmail = {
      to: FROM_EMAIL, // Send test to yourself
      subject: 'SendGrid Test - Myra\'s Academy',
      html: '<h1>Test Email</h1><p>SendGrid is configured correctly!</p>',
      text: 'Test Email - SendGrid is configured correctly!'
    };
    
    await sendEmail(testEmail);
    return { success: true, message: 'SendGrid connection successful' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}
