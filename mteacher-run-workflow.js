require('dotenv').config();
const cron = require("node-cron");

const OWNER = "rightstack";
const REPO = "testroom-scenario-mteacher";
const WORKFLOW_FILE = "playwright.yml"; // 또는 숫자 ID로 교체 가능
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

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

async function triggerWorkflow(feature = "mteacher", tags = "") {
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

const runAllFeatures = () => ["mteacher", "makex", "aiclass", "digitalmap", "topicmatrix"]
    .forEach(feature =>
        triggerWorkflow(feature)
            .catch(err => console.error("❌ Error:", err.message)));

// 매일 오전 7시 설정
cron.schedule("0 6 * * *", runAllFeatures)