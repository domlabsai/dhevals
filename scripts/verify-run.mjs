import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))

export function verifyRunArtifact({ artifactPath, suitePath, reportPath = null, outputPath = null }) {
  const args = [
    'run', '--python', '3.12', '--project', 'packages/dhevals_core', 'dhevals-verify',
    '--artifact', artifactPath,
    '--suite', suitePath,
  ]
  if (reportPath) args.push('--report', reportPath)
  if (outputPath) args.push('--output', outputPath)
  const command = spawnSync('uv', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' })
  process.stdout.write(command.stdout || '')
  process.stderr.write(command.stderr || '')
  return command.status ?? 1
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const options = parseArgs(process.argv.slice(2))
  if (!options.artifactPath || !options.suitePath) {
    console.error('Usage: npm run verify:run -- --artifact <run.json> --suite <suite.json> [--report <report.json>]')
    process.exit(2)
  }
  if (!existsSync(resolve(root, options.artifactPath)) || !existsSync(resolve(root, options.suitePath))) process.exit(2)
  process.exit(verifyRunArtifact(options))
}

function parseArgs(argv) {
  const options = {}
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (!argument.startsWith('--')) continue
    const name = argument.slice(2)
    if (name === 'artifact') options.artifactPath = argv[index + 1]
    if (name === 'suite') options.suitePath = argv[index + 1]
    if (name === 'report') options.reportPath = argv[index + 1]
    if (name === 'output') options.outputPath = argv[index + 1]
    index += 1
  }
  return {
    artifactPath: options.artifactPath,
    suitePath: options.suitePath,
    reportPath: options.reportPath || null,
    outputPath: options.outputPath || null,
  }
}
