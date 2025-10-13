import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const frontRoot = path.resolve(__dirname, '..')
const publicDir = path.join(frontRoot, 'public')
const qaRunnerRoot = path.resolve(
    frontRoot,
    '..',
    process.env.QA_RUNNER_ROOT ?? 'qa-runner'
)
const nodeModulesRoot = path.join(qaRunnerRoot, 'node_modules')
async function ensureNodeModulesExists() {
    try {
        await fs.access(nodeModulesRoot)
    } catch {
        throw new Error(
            `[collect-qa-types] Could not locate node_modules at ${nodeModulesRoot}. Did you install qa-runner dependencies?`
        )
    }
}
const typeRoots = [
    path.join(nodeModulesRoot, '@cucumber'),
    path.join(nodeModulesRoot, '@playwright'),
    path.join(nodeModulesRoot, 'playwright'),
    path.join(nodeModulesRoot, 'playwright-core'),
]
async function collectDeclarationFiles(rootDir, files) {
    const entries = await fs.readdir(rootDir, { withFileTypes: true })
    for (const entry of entries) {
        // Skip hidden directories like .cache
        if (entry.name.startsWith('.')) {
            continue
        }
        const absolutePath = path.join(rootDir, entry.name)
        if (entry.isDirectory()) {
            await collectDeclarationFiles(absolutePath, files)
        } else if (entry.isFile() && entry.name.endsWith('.d.ts')) {
            const relativePath = path
                .relative(nodeModulesRoot, absolutePath)
                .split(path.sep)
                .join('/')
            const uri = `file:///node_modules/${relativePath}`
            const content = await fs.readFile(absolutePath, 'utf8')
            files[uri] = content
        }
    }
}
async function buildBundle() {
    await ensureNodeModulesExists()
    const files = {}
    for (const root of typeRoots) {
        try {
            const stats = await fs.stat(root)
            if (!stats.isDirectory()) {
                continue
            }
        } catch {
            // Allow missing roots silently; some packages (like playwright-core) might not be installed
            continue
        }
        await collectDeclarationFiles(root, files)
    }
    if (!Object.keys(files).length) {
        throw new Error(
            `[collect-qa-types] No declaration files found under ${typeRoots.join(
                ', '
            )}`
        )
    }
    await fs.mkdir(publicDir, { recursive: true })
    const outputPath = path.join(publicDir, 'qa-type-definitions.json')
    const payload = JSON.stringify({ files })
    await fs.writeFile(outputPath, payload, 'utf8')
    console.log(
        `[collect-qa-types] Bundled ${Object.keys(files).length} declarations into ${path.relative(
            frontRoot,
            outputPath
        )}`
    )
}
buildBundle().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
})