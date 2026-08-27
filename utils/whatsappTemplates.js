export const LEAD_WELCOME_TEMPLATE_NAME = 'myra_academy_welcome';

export const LEAD_WELCOME_TEMPLATE = {
  name: LEAD_WELCOME_TEMPLATE_NAME,
  language: 'en_US',
  category: 'UTILITY',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: 'Welcome to the Future of Technology!'
    },
    {
      type: 'BODY',
      text: [
        'Thank you for your interest in our Robotics, Electronics & AI/ML programs. 🤖⚡🧠',
        '',
        'We have successfully received your details. Our team will connect with you shortly to understand your interests and help you choose the right learning path.',
        '',
        '✨ What you can explore:',
        '• 🤖 Robotics & Automation',
        '• ⚡ Electronics & Embedded Systems',
        '• 🧠 Artificial Intelligence & Machine Learning',
        '• 💻 Hands-on Projects & Innovation',
        '',
        'Get ready to Build. Create. Innovate. 🚀',
        '',
        'Our team will contact you soon.'
      ].join('\n')
    },
    {
      type: 'FOOTER',
      text: 'Team Myra Academy'
    }
  ]
};

export const TEMPLATES_WITHOUT_BODY_PARAMETERS = new Set([
  'hello_world',
  'myra_lead_welcome',
  LEAD_WELCOME_TEMPLATE_NAME
]);
