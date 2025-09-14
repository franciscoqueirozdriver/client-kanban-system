import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getSheetData, appendSheetData, updateRowByIndex } from '../googleSheets.js';

const USERS_SHEET_NAME = 'Usuarios';

/**
 * Busca um usuário na planilha pelo endereço de e-mail.
 * @param {string} email - O e-mail (já normalizado) do usuário a ser encontrado.
 * @returns {Promise<Object|null>} O objeto do usuário se encontrado, caso contrário null.
 */
export async function getUserByEmail(email) {
  try {
    // Bust cache to ensure fresh user data for authentication
    const { rows } = await getSheetData(USERS_SHEET_NAME, 'A:ZZ', process.env.SPREADSHEET_ID, true);
    const user = rows.find(u => u.Email && u.Email.trim().toLowerCase() === email);
    return user || null;
  } catch (error) {
    console.error(`[sheetsUsers] Erro ao buscar usuário por e-mail (${email}):`, error);
    throw new Error('Falha ao acessar os dados de usuários.');
  }
}

/**
 * Cria um novo usuário na planilha.
 * @param {Object} userData - Dados do usuário.
 * @param {string} userData.nome - Nome do usuário.
 * @param {string} userData.email - E-mail do usuário.
 * @param {string} userData.senhaPlano - Senha em texto plano.
 * @param {string} userData.role - Role do usuário.
 * @returns {Promise<Object>} O objeto do usuário recém-criado.
 */
export async function createUser({ nome, email, senhaPlano, role }) {
  const { headers } = await getSheetData(USERS_SHEET_NAME);

  const hashedPassword = await bcrypt.hash(senhaPlano, 12);
  const now = new Date().toISOString();

  // Formato USR-AAAA-NNNN (onde NNNN é um trecho de UUID para garantir unicidade)
  const year = new Date().getFullYear();
  const uniquePart = uuidv4().split('-')[0].substring(0, 4).toUpperCase();
  const usuarioId = `USR-${year}-${uniquePart}`;

  const newUser = {
    Usuario_ID: usuarioId,
    Nome: nome,
    Email: email.trim().toLowerCase(),
    Hash_Senha: hashedPassword,
    Role: role,
    Ativo: 'TRUE',
    Tentativas_Login: 0,
    Bloqueado_Ate: '',
    Ultimo_Login: '',
    Criado_Em: now,
    Atualizado_Em: now,
    Token_Reset: '',
    Expira_Reset: ''
  };

  // Converte o objeto do novo usuário em uma array na ordem correta dos cabeçalhos
  const newRow = headers.map(header => newUser[header] || '');

  try {
    await appendSheetData(USERS_SHEET_NAME, [newRow]);
    return newUser;
  } catch (error) {
    console.error('[sheetsUsers] Erro ao criar novo usuário:', error);
    throw new Error('Falha ao criar novo usuário.');
  }
}

/**
 * Atualiza os dados de um usuário na planilha, buscando-o pelo e-mail.
 * @param {string} email - O e-mail do usuário a ser atualizado.
 * @param {Object} partial - Um objeto com os campos e valores a serem atualizados.
 * @returns {Promise<void>}
 */
export async function updateUserByEmail(email, partial) {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const { rows } = await getSheetData(USERS_SHEET_NAME);
    const userRow = rows.find(u => u.Email && u.Email.trim().toLowerCase() === normalizedEmail);

    if (!userRow) {
      throw new Error(`Usuário com e-mail ${email} não encontrado para atualização.`);
    }

    const rowIndex = userRow._rowNumber;
    const updates = {
      ...partial,
      Atualizado_Em: new Date().toISOString(),
    };

    await updateRowByIndex({
      sheetName: USERS_SHEET_NAME,
      rowIndex,
      updates,
    });
  } catch (error) {
    console.error(`[sheetsUsers] Erro ao atualizar usuário (${email}):`, error);
    throw new Error(`Falha ao atualizar o usuário ${email}.`);
  }
}

/**
 * Define um token de reset de senha para um usuário.
 * (Implementação futura conforme o plano)
 * @param {string} email - O e-mail do usuário.
 * @returns {Promise<string>} O token gerado.
 */
export async function setResetToken(email) {
    const token = uuidv4();
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 60 minutos a partir de agora

    await updateUserByEmail(email, {
        Token_Reset: token,
        Expira_Reset: expires,
    });

    return token;
}

/**
 * Reseta a senha de um usuário usando um token válido.
 * (Implementação futura conforme o plano)
 * @param {string} token - O token de reset.
 * @param {string} novaSenha - A nova senha em texto plano.
 * @returns {Promise<void>}
 */
export async function resetPassword(token, novaSenha, options = { requireEmptyPassword: false }) {
    const { rows } = await getSheetData(USERS_SHEET_NAME);
    const user = rows.find(u => u.Token_Reset === token);

    if (!user) {
        throw new Error("Token inválido ou expirado.");
    }

    const now = new Date();
    const expires = new Date(user.Expira_Reset);

    if (now > expires) {
        throw new Error("Token expirado.");
    }

    // New security check for the "set password" flow
    if (options.requireEmptyPassword && user.Hash_Senha) {
        throw new Error("Este usuário já possui uma senha. Use o fluxo de recuperação de senha.");
    }

    const hashedPassword = await bcrypt.hash(novaSenha, 12);
    await updateUserByEmail(user.Email, {
        Hash_Senha: hashedPassword,
        Token_Reset: '',
        Expira_Reset: '',
        Tentativas_Login: 0,
        Bloqueado_Ate: '',
    });
}
