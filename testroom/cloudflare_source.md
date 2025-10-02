### CLOUDFLARE 작성된 소스
## mteacher-auto-qa
```
// CF Workers (Modules) 버전 — 간단히 "한 번 깨울 때 전부 디스패치"
async function runAll(env) {
  const OWNER = "rightstack";
  const REPO = "testroom-scenario-mteacher";
  const WORKFLOW_FILE = "playwright.yml"; // 숫자 ID도 가능
  const FEATURES = ["mteacher", "makex", "aiclass", "digitalmap", "topicmatrix"];

  async function gh(path, init = {}) {
    if (!env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is not set");
    const res = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers: {
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "run-workflow-worker",
        "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
        ...(init.headers || {}),
      },
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
    const ref = await getDefaultBranch(); // 필요시 "main" 고정 가능
    const url = `/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`;
    const body = { ref, inputs: { env: "qa", feature, tags } };

    const res = await gh(url, { method: "POST", body: JSON.stringify(body) });
    if (res.status === 204) {
      console.log(`✅ triggered: ${feature}`);
    } else {
      console.error(`❌ trigger failed (${feature}): ${res.status} ${await res.text()}`);
    }
  }

  // 아주 단순하게 모두 쏘기 (필요하면 아래를 Promise.all(...)로 바꿔도 됨)
  for (const feature of FEATURES) {
    await triggerWorkflow(feature);
    await new Promise(r => setTimeout(r, 1000)); // (선택) 1초 텀
  }
}

export default {
  async scheduled(_event, env) {
    await runAll(env);
  },
  // 수동 테스트: https://<your>.workers.dev/run
  async fetch(req, env) {
    if (new URL(req.url).pathname === "/run") {
      await runAll(env);
      return new Response("Triggered");
    }
    return new Response("OK");
  }
};

```

## choco-auto-qa

```
export default {
  async scheduled(_event, env) {
    const OWNER = "rightstack";
    const REPO = "playwright-test-choco";
    const WORKFLOW_FILE = "playwright.yml";

    // ---- 설정 ----
    const WINDOW_START_KST = (env.WINDOW_START_KST || "06:30").trim(); // "HH:mm"
    const WINDOW_DURATION_MIN = parseInt(env.WINDOW_DURATION_MIN || "120", 10);
    const FEATURES = ["daldal-math", "daldal-read", "choco-pop", "choco"];
    const DISPATCH_COOLDOWN_MS = 10 * 60 * 1000; // 디스패치 후 10분 안에 재발사 금지

    // ---- 시간 도우미 ----
    const nowUtc = () => new Date();
    const toKst = d => new Date(d.getTime() + 9 * 3600 * 1000);
    const fromKst = d => new Date(d.getTime() - 9 * 3600 * 1000);
    const ymd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    function todayWindowUtcRange() {
      const nowKst = toKst(nowUtc());
      const [hh, mm] = WINDOW_START_KST.split(":").map(Number);
      const startKst = new Date(nowKst.getFullYear(), nowKst.getMonth(), nowKst.getDate(), hh, mm, 0, 0);
      const endKst = new Date(startKst.getTime() + WINDOW_DURATION_MIN * 60 * 1000);
      return { startUtc: fromKst(startKst), endUtc: fromKst(endKst), dayKey: ymd(startKst) };
    }

    // ---- GitHub API ----
    async function gh(path, init = {}) {
      return fetch(`https://api.github.com${path}`, {
        ...init,
        headers: {
          "Accept": "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "choco-worker",
          "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
          ...(init.headers || {}),
        },
      });
    }
    async function getDefaultBranch() {
      const r = await gh(`/repos/${OWNER}/${REPO}`);
      if (!r.ok) throw new Error(`Repo fetch failed: ${r.status} ${await r.text()}`);
      const repo = await r.json();
      return repo.default_branch || "main";
    }
    async function listRuns(params) {
      const q = new URLSearchParams(params).toString();
      const r = await gh(`/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}/runs?${q}`);
      if (!r.ok) throw new Error(`Runs fetch failed: ${r.status} ${await r.text()}`);
      return r.json();
    }
    async function getRun(runId) {
      const r = await gh(`/repos/${OWNER}/${REPO}/actions/runs/${runId}`);
      if (!r.ok) throw new Error(`Run fetch failed: ${r.status} ${await r.text()}`);
      return r.json();
    }
    async function trigger(feature, tags = "") {
      const ref = await getDefaultBranch();
      const body = { ref, inputs: { env: "qa", feature, tags } };
      const r = await gh(`/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (r.status === 204) { console.log(`✅ dispatch: ${feature}`); return true; }
      console.error(`❌ dispatch fail ${feature}: ${r.status} ${await r.text()}`); return false;
    }

    // feature 이름 무시하고, dispatchedAt + run_number 기준으로 runId 찾기
    async function findRunId(branch, dispatchedAtISO) {
      let data = await listRuns({ branch, event: "workflow_dispatch", per_page: 50 });
      if (!data.workflow_runs) return null;

      const since = dispatchedAtISO ? new Date(dispatchedAtISO).getTime() - 30 * 1000 : 0;

      let runs = data.workflow_runs.filter(r =>
        new Date(r.created_at).getTime() >= since
      );

      if (runs.length > 0) {
        runs.sort((a, b) => b.run_number - a.run_number);
        return runs[0].id;
      }
      return null;
    }

    async function hasActiveRun(branch) {
      for (const status of ["queued", "in_progress"]) {
        const data = await listRuns({ branch, event: "workflow_dispatch", status, per_page: 50 });
        if ((data.workflow_runs || []).length > 0) return true;
      }
      return false;
    }

    // ---- KV 상태 ----
    async function load(dayKey) {
      const raw = await env.STATE.get(dayKey);
      return raw ? JSON.parse(raw) : null;
    }
    async function save(dayKey, s) {
      await env.STATE.put(dayKey, JSON.stringify(s), { expirationTtl: 7 * 24 * 60 * 60 });
    }
    async function init(dayKey, startKstISO) {
      const s = { idx: 0, runId: null, dispatchedAt: null, done: false, startedAt: startKstISO };
      await save(dayKey, s); return s;
    }

    // ---- 메인 ----
    const { startUtc, endUtc, dayKey } = todayWindowUtcRange();
    const now = nowUtc();
    if (!(now >= startUtc && now <= endUtc)) { console.log("⏹️ out of window"); return; }

    let state = await load(dayKey);
    if (!state) state = await init(dayKey, toKst(startUtc).toISOString());
    if (state.done) { console.log("✅ already done"); return; }

    const branch = await getDefaultBranch();

    // A) 현재 실행 중인 run이 있으면 상태 갱신
    if (state.runId) {
      const run = await getRun(state.runId);
      console.log(`🔄 status: ${run.status} (${run.conclusion || ""})`);

      if (run.status === "completed" && run.conclusion) {
        state.idx += 1;
        state.runId = null;
        state.dispatchedAt = null;
        if (state.idx >= FEATURES.length) {
          state.done = true;
          await save(dayKey, state);
          console.log("🎉 all features completed");
          return;
        }
      } else {
        await save(dayKey, state);
        return;
      }
    }

    // B) runId가 없는 상태에서 runId 복구 시도
    if (!state.runId && state.dispatchedAt) {
      const within = Date.now() - new Date(state.dispatchedAt).getTime() < DISPATCH_COOLDOWN_MS;
      if (within) {
        if (!state.runId) {
          const id = await findRunId(branch, state.dispatchedAt);
          if (id) { state.runId = id; console.log(`🔗 rescued runId: ${id}`); }
        }
        await save(dayKey, state);
        return;
      } else {
        state.dispatchedAt = null;
        await save(dayKey, state);
      }
    }

    // C) 새 feature 디스패치
    if (!state.runId && !state.dispatchedAt) {
      const f = FEATURES[state.idx];

      if (await hasActiveRun(branch)) {
        console.log(`⏸️ already active run exists. skipping dispatch`);
        await save(dayKey, state);
        return;
      }

      const ok = await trigger(f);
      if (ok) {
        state.dispatchedAt = new Date().toISOString();
        const id = await findRunId(branch, state.dispatchedAt);
        if (id) { state.runId = id; console.log(`🔗 runId=${id}`); }
        await save(dayKey, state);
      }
    }
  },

  async fetch() { return new Response("OK"); },
};

```