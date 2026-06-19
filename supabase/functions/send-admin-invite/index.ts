import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

// Cambiá este email por uno de tu dominio verificado en Resend
// Para pruebas podés usar: onboarding@resend.dev
const FROM_EMAIL = 'Edit Master <noreply@editmaster.com>';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  if (!RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'RESEND_API_KEY no configurado' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { email, nombre, secciones, adminUrl } = await req.json();

  if (!email) {
    return new Response(
      JSON.stringify({ error: 'Email requerido' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const seccionesHtml = secciones?.length
    ? `<ul style="padding-left:20px;color:#cdd6f4;">${secciones.map((s: string) => `<li>${s}</li>`).join('')}</ul>`
    : '<p style="color:#cdd6f4;">Dashboard</p>';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#0f0f1a;color:#e2e8f0;font-family:sans-serif;margin:0;padding:0;">
  <div style="max-width:560px;margin:40px auto;background:#1a1a2e;border-radius:16px;border:1px solid rgba(177,197,255,0.15);overflow:hidden;">

    <div style="background:linear-gradient(135deg,#b1c5ff,#0055cc);padding:32px 40px;">
      <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#fff;opacity:0.8;">EDIT MASTER</p>
      <h1 style="margin:8px 0 0;font-size:26px;font-weight:800;color:#fff;">Acceso al panel de administración</h1>
    </div>

    <div style="padding:32px 40px;">
      <p style="font-size:16px;line-height:1.6;">Hola <strong>${nombre || email}</strong>,</p>
      <p style="font-size:15px;line-height:1.6;color:#a0aec0;">
        El super admin te otorgó acceso al panel de administración de <strong style="color:#b1c5ff;">Edit Master</strong>.
      </p>

      <div style="background:#0f0f1a;border-radius:12px;padding:20px 24px;margin:24px 0;border:1px solid rgba(177,197,255,0.1);">
        <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#b1c5ff;">Secciones habilitadas</p>
        ${seccionesHtml}
      </div>

      <p style="font-size:15px;color:#a0aec0;">Podés ingresar con tu email y contraseña en:</p>

      <div style="text-align:center;margin:28px 0;">
        <a href="${adminUrl}" style="display:inline-block;background:linear-gradient(135deg,#b1c5ff,#0055cc);color:#fff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:1px;">
          Acceder al panel →
        </a>
      </div>

      <p style="font-size:13px;color:#666;margin-top:32px;border-top:1px solid rgba(255,255,255,0.05);padding-top:20px;">
        Si no tenés cuenta aún, registrate en el sitio con este mismo email.
        Si recibiste este mensaje por error, podés ignorarlo.
      </p>
    </div>
  </div>
</body>
</html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [email],
      subject: '🎬 Acceso al panel de administración — Edit Master',
      html,
    }),
  });

  const data = await res.json();

  return new Response(JSON.stringify(data), {
    status: res.ok ? 200 : 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
