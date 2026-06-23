import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridas');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export default async function handler(req, res) {
  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { email, password } = req.body;

  // Validar datos
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }

  try {
    // Debug: verificar que las variables existan
    console.log('[create-admin-user] URL:', supabaseUrl ? '✓ OK' : '✗ FALTA');
    console.log('[create-admin-user] Service Key:', supabaseServiceKey ? `✓ OK (${supabaseServiceKey.substring(0, 10)}...)` : '✗ FALTA');
    
    // Crear usuario en Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password: password,
      email_confirm: true, // Confirmar email automáticamente
    });

    if (error) {
      console.error('[create-admin-user] Error de Supabase:', error);
      return res.status(400).json({ error: error.message });
    }

    console.log('[create-admin-user] Usuario creado exitosamente:', data.user.email);
    return res.status(200).json({
      success: true,
      message: 'Usuario creado exitosamente en Auth',
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
  } catch (err) {
    console.error('[create-admin-user] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
