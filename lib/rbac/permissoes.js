import { getSheetData } from "../googleSheets.js";

/**
 * Constrói o objeto de permissões para um usuário com base em seu e-mail.
 *
 * A lógica de permissões funciona em camadas:
 * 1. Busca as permissões padrão para a role do usuário na aba 'Roles_Default'.
 * 2. Busca as rotas ativas na aba 'Rotas'.
 * 3. Busca permissões específicas (overrides) para a role na aba 'Permissoes'.
 * 4. Combina tudo, dando precedência às permissões específicas sobre as padrão.
 *
 * @param {string} email O e-mail do usuário.
 * @returns {Promise<Object>} Um objeto onde as chaves são os caminhos das rotas (e.g., '/clientes')
 * e os valores são objetos com as permissões booleanas (e.g., { visualizar: true, editar: false }).
 * Retorna um objeto vazio se o usuário ou a role não forem encontrados ou não tiverem permissões.
 */
export async function getPermissoesDoUsuario(email) {
  if (!email) {
    console.error("[getPermissoesDoUsuario] Email não fornecido.");
    return {};
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // 1. Buscar dados das planilhas em paralelo para otimização
    const [usuariosData, permissoesData, rolesDefaultData, rotasData] = await Promise.all([
      getSheetData("Usuarios"),
      getSheetData("Permissoes"),
      getSheetData("Roles_Default"),
      getSheetData("Rotas"),
    ]);

    // 2. Encontrar o usuário e sua role
    const usuario = usuariosData.rows.find(
      (u) => u.Email && u.Email.trim().toLowerCase() === normalizedEmail
    );

    if (!usuario || !usuario.Role) {
      console.warn(`[getPermissoesDoUsuario] Usuário ou role não encontrado para o email: ${email}`);
      return {};
    }
    const userRole = usuario.Role.trim();

    // 3. Mapear códigos de rota para caminhos (paths)
    const rotasMap = rotasData.rows
      .filter(r => r.Ativa === 'TRUE') // Considerar apenas rotas ativas
      .reduce((map, rota) => {
        if (rota.Rota_Codigo && rota.Rota_Path) {
          map[rota.Rota_Codigo.trim()] = rota.Rota_Path.trim();
        }
        return map;
      }, {});

    // 4. Construir o objeto final de permissões
    const permissoesFinais = {};

    // 4.1. Aplicar permissões padrão da role
    rolesDefaultData.rows
      .filter((perm) => perm.role && perm.role.trim() === userRole)
      .forEach((perm) => {
        const rotaCodigo = perm.rota ? perm.rota.trim() : null;
        const rotaPath = rotasMap[rotaCodigo];
        if (rotaPath) {
          permissoesFinais[rotaPath] = {
            visualizar: perm.visualizar === "TRUE",
            editar: perm.editar === "TRUE",
            excluir: perm.excluir === "TRUE",
            exportar: perm.exportar === "TRUE",
            enviar_crm: perm.enviar_crm === "TRUE",
            gerar_pdf: perm.gerar_pdf === "TRUE",
            enriquecer: perm.enriquecer === "TRUE",
            consultar_perdcomp: perm.consultar_perdcomp === "TRUE",
          };
        }
      });

    // 4.2. Sobrepor com permissões específicas (overrides)
    permissoesData.rows
      .filter((perm) => perm.role && perm.role.trim() === userRole && perm.ativo === "TRUE")
      .forEach((perm) => {
        const rotaCodigo = perm.rota ? perm.rota.trim() : null;
        const rotaPath = rotasMap[rotaCodigo];
        if (rotaPath) {
          // Garante que o objeto de rota exista antes de atribuir
          if (!permissoesFinais[rotaPath]) {
            permissoesFinais[rotaPath] = {};
          }
          // Atualiza apenas as permissões definidas nesta linha de override
          Object.keys(perm).forEach(key => {
            const permissoesChaves = ['visualizar', 'editar', 'excluir', 'exportar', 'enviar_crm', 'gerar_pdf', 'enriquecer', 'consultar_perdcomp'];
            if (permissoesChaves.includes(key) && perm[key] !== '') { // Verifica se a permissão está definida
                 permissoesFinais[rotaPath][key] = perm[key] === "TRUE";
            }
          });
        }
      });

    console.log(`[getPermissoesDoUsuario] Permissões calculadas para ${email} (Role: ${userRole})`);
    return permissoesFinais;

  } catch (error) {
    console.error(`[getPermissoesDoUsuario] Erro ao buscar permissões para ${email}:`, error);
    // Em caso de erro, retorna um objeto de permissões vazio por segurança
    return {};
  }
}
