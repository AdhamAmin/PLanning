/**
 * EmailJS integration — sends credential emails to newly added users.
 * Uses the official @emailjs/browser SDK for correct auth & CORS handling.
 *
 * ERROR "The recipients address is empty" (422) means your EmailJS template's
 * "To Email" field in the dashboard is empty or uses a different variable name.
 *
 * FIX: Go to EmailJS Dashboard → Email Templates → template_2it85rp
 *      Set the "To Email" field to:  {{to_email}}
 */
import emailjs from '@emailjs/browser';

const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const SITE_URL    = import.meta.env.VITE_LIVE_WEBSITE_URL || window.location.origin;

export const sendCredentialsEmail = async ({ username, id, email, role }) => {
  if (!PUBLIC_KEY || !SERVICE_ID || !TEMPLATE_ID) {
    console.warn('[EmailJS] Missing env vars:', { PUBLIC_KEY: !!PUBLIC_KEY, SERVICE_ID: !!SERVICE_ID, TEMPLATE_ID: !!TEMPLATE_ID });
    return { success: false, method: 'none', error: 'Missing env vars' };
  }

  if (!email || !email.includes('@')) {
    console.warn('[EmailJS] Invalid or missing email address:', email);
    return { success: false, method: 'none', error: 'Invalid email address' };
  }

  // Send the recipient email under every common variable name so the template matches
  // regardless of which variable name is configured in EmailJS dashboard
  const templateParams = {
    // ── Recipient (try all common names) ──
    to_email:        email,
    to:              email,
    email:           email,
    recipient_email: email,
    user_email:      email,

    // ── Sender info ──
    from_name:   'DrWEEE Flow',
    reply_to:    'noreply@drweee.app',

    // ── Content ──
    to_name:     username,
    employee_id: id,
    user_role:   role,
    site_url:    SITE_URL,
    login_url:   `${SITE_URL}/login`,
    message:     `مرحباً ${username}،\n\nتم تسجيلك في نظام DrWEEE Flow.\n\nبيانات الدخول:\nاسم المستخدم: ${username}\nرقم الموظف: ${id}\nالوظيفة: ${role}\n\nرابط الدخول: ${SITE_URL}`,
  };

  console.log('[EmailJS] Attempting to send to:', email);

  try {
    const res = await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
    console.log('[EmailJS] Response:', res.status, res.text);

    if (res.status === 200 || res.text === 'OK') {
      console.log('[EmailJS] ✅ Email sent successfully to', email);
      return { success: true, method: 'emailjs' };
    }

    throw new Error(`EmailJS responded: ${res.status} — ${res.text}`);
  } catch (err) {
    const errMsg = err?.text || err?.message || String(err);
    console.error('[EmailJS] ❌ Send failed:', errMsg);

    // Provide actionable guidance in console
    if (errMsg.includes('recipients') || errMsg.includes('empty')) {
      console.error(
        '[EmailJS] ⚠️  FIX REQUIRED: Open your EmailJS template (template_2it85rp) and set\n' +
        '  the "To Email" field to: {{to_email}}\n' +
        '  Dashboard → Email Templates → Edit → To Email field'
      );
    }

    return { success: false, method: 'failed', error: errMsg };
  }
};
