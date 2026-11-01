const nodemailer = require('nodemailer');
const config = require('../config/env');
const university = require('../config/university');

// With SMTP settings mail is really sent; otherwise (development) it is printed to the console.
const transport = config.smtp.host
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    })
  : nodemailer.createTransport({ jsonTransport: true });

const isRealMail = Boolean(config.smtp.host);

/** Simple branded HTML email layout. */
function layout(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#f4f8f5;font-family:Segoe UI,Arial,sans-serif;color:#1b2a22">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #dce8e0">
    <tr><td style="background:#0a4029;padding:18px 24px;color:#fff;font-weight:700;font-size:18px">${university.shortName} Smart Campus</td></tr>
    <tr><td style="height:4px;background:linear-gradient(90deg,#16a34a 33%,#f5c518 33% 66%,#d62828 66%)"></td></tr>
    <tr><td style="padding:24px"><h2 style="margin:0 0 12px;color:#0a4029;font-size:20px">${title}</h2>${bodyHtml}</td></tr>
    <tr><td style="padding:16px 24px;font-size:12px;color:#7a8c82;border-top:1px solid #dce8e0">${university.name}<br>${university.address}</td></tr>
  </table></td></tr></table></body></html>`;
}

const button = (url, label) =>
  `<p style="margin:24px 0"><a href="${url}" style="background:#15803d;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${label}</a></p>
   <p style="font-size:12px;color:#7a8c82">Or open this link: <br><a href="${url}" style="color:#15803d">${url}</a></p>`;

/**
 * Sends an email. Failures are logged and never break the request that triggered them.
 * Returns true when the message was handed to the transport.
 */
async function sendMail({ to, subject, title, html, text }) {
  try {
    await transport.sendMail({ from: config.mailFrom, to, subject, text, html: layout(title || subject, html) });
    if (!isRealMail && !config.isTest) console.log(`[mail] to=${to} subject="${subject}"\n       ${text}`);
    return true;
  } catch (err) {
    console.error('Failed to send email:', err.message);
    return false;
  }
}

module.exports = { sendMail, button, isRealMail };
