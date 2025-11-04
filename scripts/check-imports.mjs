import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const directoriesToScan = ['app', 'components', 'lib', 'src', 'utils', 'validators'];
const allowedExtensions = ['.js', '.jsx', '.ts', '.tsx'];
let errorCount = 0;

function resolveAlias(importPath) {
    if (importPath.startsWith('@/')) {
        return path.resolve(projectRoot, importPath.substring(2));
    }
    return null;
}

async function checkFile(filePath) {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const importRegex = /from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        if (importPath.startsWith('.')) {
            const absoluteImportPath = path.resolve(path.dirname(filePath), importPath);
            await verifyPath(absoluteImportPath, filePath, importPath);
        } else if (importPath.startsWith('@/')) {
            const absoluteImportPath = resolveAlias(importPath);
            if (absoluteImportPath) {
                await verifyPath(absoluteImportPath, filePath, importPath);
            }
        }
    }
}

async function verifyPath(absolutePath, referencingFile, originalPath) {
    let resolvedPath = '';
    const potentialPaths = [absolutePath];
    if (!path.extname(absolutePath)) {
        allowedExtensions.forEach(ext => {
            potentialPaths.push(`${absolutePath}${ext}`);
            potentialPaths.push(path.join(absolutePath, `index${ext}`));
        });
    }

    let found = false;
    for (const p of potentialPaths) {
        if (await fileExists(p)) {
            resolvedPath = p;
            found = true;
            break;
        }
    }

    if (!found) {
        console.error(`❌ Error in ${path.relative(projectRoot, referencingFile)}:`);
        console.error(`   Import not found: "${originalPath}"`);
        console.error(`   (Tried: ${potentialPaths.map(p => path.relative(projectRoot, p)).join(', ')})`);
        errorCount++;
    }
}

async function fileExists(filePath) {
    try {
        await fs.promises.access(filePath, fs.constants.F_OK);
        const realPath = await fs.promises.realpath(filePath);
        if (realPath.replace(/\\/g, '/') !== filePath.replace(/\\/g, '/')) {
            console.error(`❌ Case sensitivity error in path: ${filePath}`);
            console.error(`   (Resolved to: ${realPath})`);
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

async function scanDirectory(directory) {
    try {
        const entries = await fs.promises.readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                await scanDirectory(fullPath);
            } else if (allowedExtensions.includes(path.extname(entry.name))) {
                await checkFile(fullPath);
            }
        }
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error(`Error scanning directory ${directory}:`, error);
        }
    }
}

async function main() {
    console.log('🔍 Starting import validation...');
    const scans = directoriesToScan.map(dir => scanDirectory(path.join(projectRoot, dir)));
    await Promise.all(scans);

    if (errorCount > 0) {
        console.error(`\n🚨 Found ${errorCount} import-related error(s). Please fix them before committing.`);
        process.exit(1);
    } else {
        console.log('\n✅ All imports seem correct.');
    }
}

main();
