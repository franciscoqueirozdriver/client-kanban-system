/**
 * Checks if a user has a specific permission for a given route.
 * This function includes hardcoded security rules as a defense-in-depth measure.
 *
 * @param {object} session - The NextAuth session object, containing user details.
 * @param {string} rotaPath - The path of the route being checked (e.g., '/clientes').
 * @param {string} acao - The action being performed (e.g., 'excluir', 'enviar_spotter').
 * @returns {boolean} - True if the user has permission, false otherwise.
 */
export function temPermissao(session, rotaPath, acao) {
  const role = session?.user?.role;
  const permissoes = session?.user?.permissoes;

  if (!role || !permissoes) {
    return false;
  }

  // Hardcoded Rule 1: Only admin can perform 'excluir' action.
  if (acao === 'excluir' && role !== 'admin') {
    return false;
  }

  // Find the permission object for the given route path.
  const rotaPermissao = permissoes[rotaPath];

  if (!rotaPermissao) {
    // If there's no specific permission entry for this route, deny by default.
    return false;
  }

  // Check the specific action's flag.
  // The permission flag must be explicitly TRUE.
  // A missing flag (undefined) is treated as FALSE (fail-safe).
  const temAcao = rotaPermissao[acao] === true;

  return temAcao;
}
