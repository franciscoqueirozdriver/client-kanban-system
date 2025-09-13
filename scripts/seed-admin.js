// Use require for dotenv to load environment variables at the very beginning.
require('dotenv').config({ path: '.env.local' });

// We must use dynamic import() for ES Modules in a CommonJS file.
async function seedAdmin() {
  console.log("Iniciando script de seed do admin...");

  // Dynamically import the necessary ESM modules
  const { getSheetData } = await import('../lib/googleSheets.js');
  const { createUser } = await import('../lib/auth/sheetsUsers.js');

  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error("ERRO: As variáveis de ambiente ADMIN_EMAIL e ADMIN_PASSWORD não estão definidas.");
    process.exit(1);
  }

  try {
    console.log("Verificando a planilha 'Usuarios'...");
    const { rows } = await getSheetData("Usuarios");

    if (rows.length > 0) {
      console.log("A planilha 'Usuarios' já contém dados. O seed não é necessário.");
      return;
    }

    console.log("A planilha 'Usuarios' está vazia. Criando usuário admin...");

    await createUser({
      nome: "Administrador",
      email: ADMIN_EMAIL,
      senhaPlano: ADMIN_PASSWORD,
      role: "admin",
    });

    console.log("✅ Usuário admin criado com sucesso!");
    console.log(`   Email: ${ADMIN_EMAIL}`);

  } catch (error) {
    console.error("❌ Falha ao executar o script de seed:", error);
    process.exit(1);
  }
}

seedAdmin();
