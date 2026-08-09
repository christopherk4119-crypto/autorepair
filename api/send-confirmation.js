module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!process.env.RESEND_API_KEY) {
    res.status(500).json({ error: 'Email service is not configured (missing RESEND_API_KEY).' });
    return;
  }

  const { to, customerName, service, date, time } = req.body || {};

  if (!to || !service || !date || !time) {
    res.status(400).json({ error: 'Missing required fields (to, service, date, time).' });
    return;
  }

  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.CONFIRMATION_FROM_EMAIL || 'Auto Repair Xperts <onboarding@resend.dev>',
        to: [to],
        subject: `Appointment Confirmed — ${service}`,
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;background:#0A0A0A;color:#FFFFFF;padding:32px;border-radius:8px;">
            <h1 style="color:#C8102E;font-size:22px;margin:0 0 16px;">Your appointment is confirmed</h1>
            <p style="color:#AAAAAA;font-size:15px;line-height:1.6;">Hi ${customerName || 'there'},</p>
            <p style="color:#AAAAAA;font-size:15px;line-height:1.6;">Your <strong style="color:#FFFFFF;">${service}</strong> appointment has been confirmed for:</p>
            <p style="font-size:20px;font-weight:bold;color:#FFFFFF;margin:16px 0;">${formattedDate} at ${time}</p>
            <p style="color:#AAAAAA;font-size:14px;line-height:1.6;">817 Sagehill Grove NW & 1115 48 Ave SE #4, Calgary, AB</p>
            <p style="color:#AAAAAA;font-size:14px;line-height:1.6;">Questions or need to reschedule? Call us at (587) 435-4463.</p>
            <p style="color:#666666;font-size:13px;margin-top:32px;">— Auto Repair Xperts Inc.</p>
          </div>
        `
      })
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error('Resend error:', errText);
      res.status(502).json({ error: 'Failed to send email' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
