// Express-based runner that materializes Cucumber features/steps and executes them with Playwright.
const express = require('express');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 3000;
const TMP_BASE = process.env.RUNNER_TMP_BASE || path.join(os.tmpdir());

const app = express();
app.use(express.json({ limit: '5mb' }));

async function readRunReport(runDir) {
  if (!runDir) {
    return null;
  }

  try {
    const reportPath = path.join(runDir, 'report.json');
    const reportContent = await fs.readFile(reportPath, 'utf8');
    return JSON.parse(reportContent);
  } catch (err) {
    return null;
  }
}

function normalizeContent(text) {
  if (typeof text !== 'string') {
    return text;
  }

  let normalized = text.replace(/\r\n/g, '\n');

  if (!normalized.includes('\n') && normalized.includes('\\n')) {
    normalized = normalized.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
  }

  if (!normalized.includes('\t') && normalized.includes('\\t')) {
    normalized = normalized.replace(/\\t/g, '\t');
  }

  return normalized;
}

function validatePayload(body) {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be a JSON object.');
  }

  const { features, steps } = body;
  if (!Array.isArray(features) || features.length === 0) {
    throw new Error('Payload requires a non-empty "features" array.');
  }

  for (const item of features) {
    if (!item || typeof item.content !== 'string') {
      throw new Error('Each feature must include string "content".');
    }
  }

  if (steps) {
    if (!Array.isArray(steps)) {
      throw new Error('"steps" must be an array when provided.');
    }
    for (const step of steps) {
      if (!step || typeof step.content !== 'string') {
        throw new Error('Each step definition must include string "content".');
      }
    }
  }
}

async function materializeRunDir(body) {
  const runId = crypto.randomUUID();
  const runDir = path.join(TMP_BASE, `run-${runId}`);
  const featureDir = path.join(runDir, 'features');
  const stepDir = path.join(featureDir, 'step_definitions');

  await fs.mkdir(stepDir, { recursive: true });

  await Promise.all(
    body.features.map((item, index) => {
      const fileName = item.name || `feature-${index + 1}.feature`;
      return fs.writeFile(
        path.join(featureDir, fileName),
        normalizeContent(item.content),
        'utf8'
      );
    })
  );

  if (body.steps) {
    await Promise.all(
      body.steps.map((item, index) => {
        const fileName = item.name || `steps-${index + 1}.ts`;
        return fs.writeFile(
          path.join(stepDir, fileName),
          normalizeContent(item.content),
          'utf8'
        );
      })
    );
  }

  return { runDir, featureDir };
}

function runCucumber(opts) {
  let cucumberCliPath;
  try {
    const cucumberPkgPath = require.resolve('@cucumber/cucumber/package.json');
    cucumberCliPath = path.join(path.dirname(cucumberPkgPath), 'bin', 'cucumber.js');
  } catch (err) {
    throw new Error(
      'Cannot resolve @cucumber/cucumber CLI. Ensure dependencies are installed.'
    );
  }

  const args = ['--config', 'cucumber.js', 'features'];

  const env = {
    ...process.env,
    RUN_TMP_DIR: opts.runDir,
    NODE_PATH: [
      path.join(__dirname, 'node_modules'),
      process.env.NODE_PATH,
    ]
      .filter(Boolean)
      .join(path.delimiter),
  };

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cucumberCliPath, ...args], {
      cwd: opts.runDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject(Object.assign(new Error('Cucumber run failed'), { stdout, stderr, code }));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

async function seedSupportFiles(runDir) {
  const worldSourcePath = path.join(__dirname, 'world.ts');
  const cucumberConfigPath = path.join(__dirname, 'cucumber.js');
  const tsconfigPath = path.join(__dirname, 'tsconfig.json');
  const worldDest = path.join(runDir, 'world.ts');
  const featureWorldDest = path.join(runDir, 'features', 'world.ts');
  const cucumberDest = path.join(runDir, 'cucumber.js');
  const tsconfigDest = path.join(runDir, 'tsconfig.json');

  await Promise.all([
    fs.copyFile(worldSourcePath, worldDest),
    fs.copyFile(cucumberConfigPath, cucumberDest),
    fs.copyFile(tsconfigPath, tsconfigDest),
  ]);

  const featureDir = path.join(runDir, 'features');
  await fs.mkdir(featureDir, { recursive: true });
  await fs.writeFile(
    featureWorldDest,
    "export * from '../world';\n",
    'utf8'
  );
}

app.post('/run', async (req, res) => {
  try {
    validatePayload(req.body);
  } catch (err) {
    res.status(400).json({ error: err.message });
    return;
  }

  let context;
  let report = null;
  try {
    context = await materializeRunDir(req.body);
    await seedSupportFiles(context.runDir);
    const result = await runCucumber(context);
    report = await readRunReport(context.runDir);

    res.json({
      stdout: result.stdout,
      stderr: result.stderr,
      report,
    });
  } catch (err) {
    if (!report) {
      report = await readRunReport(context?.runDir);
    }

    res.status(500).json({
      error: err.message,
      stdout: err.stdout,
      stderr: err.stderr,
      report,
    });
  } finally {
    if (context?.runDir) {
      try {
        await fs.rm(context.runDir, { recursive: true, force: true });
      } catch (cleanupError) {
        // eslint-disable-next-line no-console
        console.warn(`Failed to remove run directory ${context.runDir}:`, cleanupError);
      }
    }
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`QA Runner listening on port ${PORT}`);
});
