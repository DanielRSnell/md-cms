import nodemailer from 'nodemailer';

const transport = process.env.SMTP_HOST ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
}) : null;

export async function sendMagicLink(email, token) {
  if (!transport) return;
  
  const magicLink = `${process.env.BASE_URL}/auth/verify/${token}`;
  
  await transport.sendMail({
    from: process.env.SMTP_USER,
    to: email,
    subject: 'Your Magic Link',
    text: `Click here to login: ${magicLink}`,
    html: `<a href="${magicLink}">Click here to login</a>`
  });
}
