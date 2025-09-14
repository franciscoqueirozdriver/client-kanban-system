import { NextResponse } from 'next/server';
import { getUserByEmail, setResetToken } from '@/lib/auth/sheetsUsers';

export async function POST(req) {
  try {
    const { email, secretWord } = await req.json();

    if (!email || !secretWord) {
      return NextResponse.json({ error: 'E-mail e palavra secreta são obrigatórios.' }, { status: 400 });
    }

    const user = await getUserByEmail(email.toLowerCase());

    if (!user) {
      // Generic error to prevent user enumeration
      return NextResponse.json({ error: 'Palavra secreta inválida.' }, { status: 401 });
    }

    // IMPORTANT: This assumes the 'Secret_Word' column exists in the spreadsheet.
    // The comparison should be case-sensitive.
    if (user.Secret_Word !== secretWord) {
      return NextResponse.json({ error: 'Palavra secreta inválida.' }, { status: 401 });
    }

    // The secret word is correct. Generate a single-use token for setting the password.
    // We can reuse the "reset password" token logic for this.
    const token = await setResetToken(email);

    return NextResponse.json({ ok: true, token });

  } catch (error) {
    console.error('[API /verify-secret] Error:', error);
    return NextResponse.json({ error: 'Ocorreu um erro interno.' }, { status: 500 });
  }
}
