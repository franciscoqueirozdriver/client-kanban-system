require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

// --- Main Execution ---
async function applyRbacPolicy() {
  console.log('Iniciando a aplicação da política de RBAC na planilha...');

  // Dynamic imports for ESM modules
  const { getSheetData, appendSheetData, updateRowByIndex, appendMissingColumns } = await import('../lib/googleSheets.js');

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      columns_added: [],
      routes_added: [],
      permissions_inserted: 0,
      permissions_updated: 0,
    },
    details: {
      updates: [],
    },
  };

  // --- Policy Definition ---
  const policy = {
    admin: {
      dashboard: { visualizar: true, editar: true, excluir: true, exportar: true, enviar_crm: true, gerar_pdf: true, enriquecer: true, consultar_perdcomp: true, enviar_spotter: true },
      clientes: { visualizar: true, editar: true, excluir: true, exportar: true, enviar_crm: true, gerar_pdf: true, enriquecer: true, consultar_perdcomp: true, enviar_spotter: true },
      kanban: { visualizar: true, editar: true, excluir: true, exportar: true, enviar_crm: true, gerar_pdf: true, enriquecer: true, consultar_perdcomp: true, enviar_spotter: true },
      perdcomp: { visualizar: true, editar: true, excluir: true, exportar: true, enviar_crm: true, gerar_pdf: true, enriquecer: true, consultar_perdcomp: true, enviar_spotter: true },
      reports: { visualizar: true, editar: true, excluir: true, exportar: true, enviar_crm: true, gerar_pdf: true, enriquecer: true, consultar_perdcomp: true, enviar_spotter: true },
      settings: { visualizar: true, editar: true, excluir: true, exportar: true, enviar_crm: true, gerar_pdf: true, enriquecer: true, consultar_perdcomp: true, enviar_spotter: true },
      concorrentes: { visualizar: true, editar: true, excluir: true, exportar: true, enviar_crm: true, gerar_pdf: true, enriquecer: true, consultar_perdcomp: true, enviar_spotter: true },
    },
    Closer: {
      perdcomp: { visualizar: true, consultar_perdcomp: true, excluir: false, enviar_spotter: false },
      concorrentes: { visualizar: true, editar: true, excluir: false, enviar_spotter: false },
      clientes: { visualizar: true, editar: true, enriquecer: true, excluir: false, enviar_spotter: false },
      dashboard: { visualizar: true, excluir: false, enviar_spotter: false },
    },
    SDR: {
      kanban: { visualizar: true, editar: true, exportar: true, excluir: false, enviar_spotter: true },
      dashboard: { visualizar: true, excluir: false, enviar_spotter: false },
    },
    BDR: {
      clientes: { visualizar: true, editar: true, exportar: true, excluir: false, enviar_spotter: true },
      dashboard: { visualizar: true, excluir: false, enviar_spotter: false },
    },
  };

  try {
    // 1. Ensure Schema is Correct
    console.log('Verificando esquema da planilha...');
    const addedCols = await appendMissingColumns('Permissoes', ['enviar_spotter']);
    if (addedCols.length > 0) {
      report.summary.columns_added = addedCols;
      console.log(` -> Coluna(s) adicionada(s) em 'Permissoes': ${addedCols.join(', ')}`);
    }

    // 2. Ensure 'concorrentes' route exists
    const { rows: rotasRows, headers: rotasHeaders } = await getSheetData('Rotas');
    const concorrentesRoute = rotasRows.find(r => r.Rota_Codigo === 'concorrentes');
    if (!concorrentesRoute) {
      const newRouteRow = {
        Rota_Codigo: 'concorrentes',
        Rota_Path: '/concorrentes',
        Descricao: 'Gestão/Pesquisa de Concorrentes',
        Ativa: 'TRUE',
      };
      await appendSheetData('Rotas', [rotasHeaders.map(h => newRouteRow[h] || '')]);
      report.summary.routes_added.push(newRouteRow);
      console.log(" -> Rota 'concorrentes' adicionada.");
    }

    // 3. Apply Policy
    console.log('Aplicando políticas de permissão...');
    const { rows: currentPerms, headers: permsHeaders } = await getSheetData('Permissoes');

    for (const role in policy) {
      for (const rota in policy[role]) {
        const permissions = policy[role][rota];
        const existingPerm = currentPerms.find(p => p.role === role && p.rota === rota && p.tipo === 'rota');

        if (existingPerm) {
          // Update existing permission
          const updates = {};
          let hasUpdate = false;
          const original = {};

          // Rule: only admin can delete
          if (existingPerm.excluir !== permissions.excluir.toString().toUpperCase()) {
             updates.excluir = permissions.excluir.toString().toUpperCase();
             original.excluir = existingPerm.excluir;
             hasUpdate = true;
          }
          // Rule: set enviar_spotter
          if (existingPerm.enviar_spotter !== permissions.enviar_spotter.toString().toUpperCase()) {
            updates.enviar_spotter = permissions.enviar_spotter.toString().toUpperCase();
            original.enviar_spotter = existingPerm.enviar_spotter;
            hasUpdate = true;
          }

          if (hasUpdate) {
            await updateRowByIndex({ sheetName: 'Permissoes', rowIndex: existingPerm._rowNumber, updates });
            report.summary.permissions_updated++;
            report.details.updates.push({ role, rota, before: original, after: updates });
            console.log(`  -> Permissão ATUALIZADA para Role: ${role}, Rota: ${rota}`);
          }
        } else {
          // Insert new permission
          const newPerm = {
            tipo: 'rota',
            rota: rota,
            role: role,
            visualizar: 'FALSE',
            editar: 'FALSE',
            excluir: 'FALSE',
            exportar: 'FALSE',
            enviar_crm: 'FALSE',
            gerar_pdf: 'FALSE',
            enriquecer: 'FALSE',
            consultar_perdcomp: 'FALSE',
            enviar_spotter: 'FALSE',
            ativo: 'TRUE',
            ...permissions, // Override defaults with policy
          };

          // Convert boolean to uppercase string
          Object.keys(newPerm).forEach(key => {
              if (typeof newPerm[key] === 'boolean') {
                  newPerm[key] = newPerm[key].toString().toUpperCase();
              }
          });

          const newRowArray = permsHeaders.map(h => newPerm[h] || '');
          await appendSheetData('Permissoes', [newRowArray]);
          report.summary.permissions_inserted++;
          console.log(`  -> Permissão INSERIDA para Role: ${role}, Rota: ${rota}`);
        }
      }
    }

    // 4. Generate Report
    console.log('Gerando relatório...');
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const reportDir = path.join(__dirname, '..', 'docs', 'rbac');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    // JSON Report
    const jsonReportPath = path.join(reportDir, `rbac_apply_${timestamp}.json`);
    fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));
    console.log(`Relatório JSON salvo em: ${jsonReportPath}`);

    // MD Report
    const mdReportPath = path.join(reportDir, `rbac_apply_${timestamp}.md`);
    let mdContent = `# Relatório de Aplicação de Política RBAC\n\n`;
    mdContent += `**Data:** ${report.timestamp}\n\n`;
    mdContent += `## Resumo\n`;
    mdContent += `- Colunas Adicionadas: ${report.summary.columns_added.join(', ') || 'Nenhuma'}\n`;
    mdContent += `- Rotas Adicionadas: ${report.summary.routes_added.length > 0 ? report.summary.routes_added[0].Rota_Codigo : 'Nenhuma'}\n`;
    mdContent += `- Permissões Inseridas: ${report.summary.permissions_inserted}\n`;
    mdContent += `- Permissões Atualizadas: ${report.summary.permissions_updated}\n\n`;
    mdContent += `## Detalhes das Atualizações\n`;
    if(report.details.updates.length === 0) {
        mdContent += "Nenhuma permissão existente foi atualizada.\n";
    } else {
        report.details.updates.forEach(u => {
            mdContent += `### Role: ${u.role}, Rota: ${u.rota}\n`;
            mdContent += '```json\n';
            mdContent += JSON.stringify({ antes: u.before, depois: u.after }, null, 2);
            mdContent += '\n```\n\n';
        });
    }
    fs.writeFileSync(mdReportPath, mdContent);
    console.log(`Relatório Markdown salvo em: ${mdReportPath}`);

    console.log('Aplicação da política de RBAC concluída com sucesso!');

  } catch (error) {
    console.error('Falha ao aplicar a política de RBAC:', error);
    process.exit(1);
  }
}

applyRbacPolicy();
