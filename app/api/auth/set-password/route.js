import { NextResponse } from 'next/server';
import { resetPassword } from '@/lib/auth/sheetsUsers'; // This function will be slightly modified

export async function POST(req) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ error: 'Token e nova senha são obrigatórios.' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'A senha deve ter no mínimo 8 caracteres.' }, { status: 400 });
    }

    // The resetPassword function will handle token validation, expiry, and hashing.
    // I will modify it to also check if the current password hash is empty.
    await resetPassword(token, password, { requireEmptyPassword: true });

    return NextResponse.json({ ok: true, message: 'Senha criada com sucesso.' });

  } catch (error) {
    console.error('[API /set-password] Error:', error);
    // Send back specific error messages from the library if they exist
    return NextResponse.json({ error: error.message || 'Ocorreu um erro interno.' }, { status: 400 });
  }
}
