import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Resend email function
async function sendEmail({ to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: '3rd Brain <reminders@3rdbrain.app>',
      to,
      subject,
      html,
    }),
  })
  
  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Resend error: ${error}`)
  }
  return res.json()
}

// Beautiful dark email template
function emailTemplate(title, deadline, hoursLeft) {
  const formattedDate = new Date(deadline).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reminder from 3rd Brain</title>
</head>
<body style="margin:0; padding:0; background:#0a0a0a; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a; padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="400" cellpadding="0" cellspacing="0" style="background:#111; border-radius:16px; border:1px solid #1a1a1a; overflow:hidden;">
          <tr>
            <td style="padding:32px; text-align:center;">
              <div style="font-size:32px; margin-bottom:16px;">🧠</div>
              <h1 style="margin:0 0 8px 0; font-size:20px; font-weight:700; color:#fff; letter-spacing:-0.5px;">3rd Brain</h1>
              <p style="margin:0; font-size:13px; color:#666;">Your mind's second pair of eyes</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;">
              <div style="background:#1a1535; border:1px solid #534AB720; border-radius:12px; padding:20px; margin-bottom:20px;">
                <p style="margin:0 0 8px 0; font-size:11px; color:#7F77DD; text-transform:uppercase; letter-spacing:0.08em; font-weight:600;">⏰ Reminder</p>
                <h2 style="margin:0 0 12px 0; font-size:18px; font-weight:600; color:#AFA9EC;">${title}</h2>
                <p style="margin:0; font-size:14px; color:#888;">${formattedDate}</p>
              </div>
              
              <p style="margin:0 0 16px 0; font-size:13px; color:#999; line-height:1.6;">
                ${hoursLeft === 1 
                  ? "This is happening in <strong style='color:#F0997B;'>1 hour</strong>. Take a deep breath—you've got this." 
                  : "This is happening <strong style='color:#FAC775;'>tomorrow</strong>. Prepare well and trust your preparation."}
              </p>
              
              <a href="http://localhost:3000" style="display:block; background:linear-gradient(135deg,#7F77DD 0%,#6B63C5 100%); color:#fff; text-decoration:none; padding:14px; border-radius:10px; font-size:14px; font-weight:600; text-align:center;">Open 3rd Brain →</a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px; text-align:center;">
              <p style="margin:0; font-size:11px; color:#444;">You're receiving this because you set a reminder in 3rd Brain.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}

export async function GET(req) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const results = { sent_24h: 0, sent_1h: 0, errors: [] }

    // Find reminders needing 24h notice (not sent yet, deadline is 23-25h away)
    const { data: reminders24h } = await supabase
      .from('reminders')
      .select('*')
      .eq('reminder_24h_sent', false)
      .gte('deadline', new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString())
      .lte('deadline', new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString())

    // Send 24h reminders
    for (const r of reminders24h || []) {
      try {
        await sendEmail({
          to: r.email,
          subject: `⏰ Tomorrow: ${r.title}`,
          html: emailTemplate(r.title, r.deadline, 24),
        })
        
        await supabase.from('reminders').update({ reminder_24h_sent: true }).eq('id', r.id)
        results.sent_24h++
      } catch (err) {
        results.errors.push(`24h ${r.id}: ${err.message}`)
      }
    }

    // Find reminders needing 1h notice (not sent yet, deadline is 0.5-1.5h away)
    const { data: reminders1h } = await supabase
      .from('reminders')
      .select('*')
      .eq('reminder_1h_sent', false)
      .gte('deadline', new Date(now.getTime() + 30 * 60 * 1000).toISOString())
      .lte('deadline', new Date(now.getTime() + 90 * 60 * 1000).toISOString())

    // Send 1h reminders
    for (const r of reminders1h || []) {
      try {
        await sendEmail({
          to: r.email,
          subject: `🔥 In 1 hour: ${r.title}`,
          html: emailTemplate(r.title, r.deadline, 1),
        })
        
        await supabase.from('reminders').update({ reminder_1h_sent: true }).eq('id', r.id)
        results.sent_1h++
      } catch (err) {
        results.errors.push(`1h ${r.id}: ${err.message}`)
      }
    }

    return Response.json(results)
  } catch (err) {
    console.error('Cron error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}