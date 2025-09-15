import bcryptjs from 'bcryptjs';
import { getSheetData, updateRowByIndex } from '@/lib/googleSheets';

const USERS_SHEET_NAME = 'Usuarios';

/**
 * Fetches a user by email from the 'Usuarios' sheet.
 * Bypasses cache to ensure fresh data for authentication.
 * @param {string} email The user's email.
 * @returns {Promise<Object|null>} The user object or null if not found.
 */
export async function getUserByEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();
  try {
    const { rows } = await getSheetData(USERS_SHEET_NAME, 'A:ZZ', process.env.SPREADSHEET_ID, true);
    const user = rows.find(u => u.Email && u.Email.trim().toLowerCase() === normalizedEmail);

    if (!user) return null;

    // Normalize data types
    user.Ativo = user.Ativo === 'TRUE';
    user.Tentativas_Login = parseInt(user.Tentativas_Login, 10) || 0;

    return user;
  } catch (error) {
    console.error(`[sheetsUsers] Error fetching user by email (${email}):`, error);
    throw new Error('Failed to access user data.');
  }
}

/**
 * Updates metadata for a user given their row index in the sheet.
 * @param {number} rowIndex The user's row number in the sheet.
 * @param {object} patch An object with the fields and values to update.
 * @returns {Promise<void>}
 */
export async function updateUserMeta(rowIndex, patch) {
  if (!rowIndex) throw new Error("Row index is required for updateUserMeta.");

  const updates = {
    ...patch,
    Atualizado_Em: new Date().toISOString(),
  };

  try {
    await updateRowByIndex({
      sheetName: USERS_SHEET_NAME,
      rowIndex,
      updates,
    });
  } catch (error) {
    console.error(`[sheetsUsers] Error updating user meta for row ${rowIndex}:`, error);
    throw new Error(`Failed to update user meta.`);
  }
}

/**
 * Sets or updates a user's password hash by their email.
 * @param {string} email The user's email.
 * @param {string} newPassword The new plain text password.
 * @returns {Promise<void>}
 */
export async function setPasswordByEmail(email, newPassword) {
    const user = await getUserByEmail(email);
    if (!user) {
        throw new Error("User not found to set password.");
    }

    const hash = await bcryptjs.hash(newPassword, 12);
    await updateUserMeta(user._rowNumber, { Hash_Senha: hash });
}
