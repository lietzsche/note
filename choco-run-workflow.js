// run-workflow-fixed.js
require('dotenv').config();
const cron = require("node-cron");

const OWNER = "rightstack";
const REPO = "playwright-test-choco";
const WORKFLOW_FILE = "playwright.yml"; // 또는 숫자 ID로 교체 가능
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

//통신 오류 로그
// 공용 fetch wrapper
async function safeFetch(url, init = {}, retries = 3, timeoutMs = 30000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`https://api.github.com${url}`, {
        ...init,
        headers: {
          "Accept": "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "run-workflow-script",
          "Authorization": `Bearer ${GITHUB_TOKEN}`,
          ...(init.headers || {})
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} - ${await res.text()}`);
      }
      return res;

    } catch (err) {
      clearTimeout(timeout);
      console.error(`⚠️ Fetch attempt ${attempt + 1} failed: ${err.message}`);

      if (attempt < retries) {
        const delay = 1000 * Math.pow(2, attempt); // 지수 백오프
        console.log(`⏳ Retrying in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw new Error(`❌ All ${retries + 1} fetch attempts failed: ${err.message}`);
      }
    }
  }
}


async function gh(path, init={}) {
  if (!GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is not set");
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "run-workflow-script",
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
      ...(init.headers||{})
    }
  });
  return res;
}

async function getDefaultBranch() {
  const res = await gh(`/repos/${OWNER}/${REPO}`);
  if (!res.ok) throw new Error(`Repo fetch failed: ${res.status} ${await res.text()}`);
  const repo = await res.json();
  return repo.default_branch || "main";
}

async function triggerWorkflow(feature = "choco", tags = "") {
  const ref = await getDefaultBranch(); // 필요하면 "main" 고정
  const url = `/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`;

  const body = {
    ref,
    inputs: { env: "qa", feature, tags },
  };

  const res = await gh(url, { method: "POST", body: JSON.stringify(body) });

  if (res.status === 204) {
    console.log("✅ Workflow triggered successfully");
  } else {
    const text = await res.text();
    console.error(`❌ Failed: ${res.status} ${text}`);
  }
}

async function getLatestRunId(workflowFile, branch, feature) {
  const res = await gh(`/repos/${OWNER}/${REPO}/actions/workflows/${workflowFile}/runs?branch=${branch}&event=workflow_dispatch&per_page=10`);
  if (!res.ok) throw new Error(`Failed to fetch runs: ${res.status} ${await res.text()}`);
  const data = await res.json();

  // feature 포함 + 진행 중인 run 먼저 찾기
  const run = data.workflow_runs.find(r =>
      r.name.includes(feature) &&
      (r.status === "queued" || r.status === "in_progress" || r.status === "completed")
  );

  return run?.id;
}

async function waitForRunCompletion(runId) {
  while (true) {
    const res = await safeFetch(`/repos/${OWNER}/${REPO}/actions/runs/${runId}`);
    if (!res.ok) throw new Error(`Failed to fetch run status: ${res.status} ${await res.text()}`);
    const run = await res.json();
    console.log(`🔄 Status: ${run.status}, Conclusion: ${run.conclusion}`);

    if (run.status === "completed") {
      return run.conclusion; // success, failure, cancelled 등
    }

    await new Promise(r => setTimeout(r, 300000)); // 5분 대기
  }
}

async function runFeaturesSequentially(features) {
  const branch = await getDefaultBranch();

  for (const feature of features) {
    console.log(`▶ Triggering workflow for ${feature}...`);
    await triggerWorkflow(feature);
    await new Promise(r => setTimeout(r, 5000)); // ★ 추가: 5초 기다리기

    const runId = await getLatestRunId(WORKFLOW_FILE, branch, feature);
    console.log(`⏳ Waiting for ${feature} run to complete...`);

    const result = await waitForRunCompletion(runId);
    console.log(`✅ ${feature} finished with result: ${result}`);

    console.log(`➡ Moving on to next feature regardless of result.`);
  }
}

const runAllFeatures = () =>
    runFeaturesSequentially(["choco", "choco-class", "choco-pop", "daldal-math", "daldal-read"])
        .catch(err => console.error("❌ Error:", err.message));

// 매일 오전 7시 설정
// cron.schedule("30 6 * * *", runAllFeatures)
runAllFeatures()