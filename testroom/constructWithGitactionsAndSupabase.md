# QA 자동화 시스템 구조 개요 (Runner: VM ↔ GitHub Actions 템플릿)

## 1️⃣ 개요

이 시스템은 **Spring Boot(또는 Supabase) 지휘자(컨트롤 플레인)**와 **테스트 실행 환경(데이터 플레인)**을 분리하여, 대규모 **Playwright + Cucumber** 기반 QA 테스트를 효율적으로 관리·확장하도록 설계했다. 기본 설계는 Node.js Runner VM을 사용하지만, **GitHub Actions(템플릿 레포)로 Runner를 대체**하거나, 지휘자 자체도 **Supabase**로 대체할 수 있다.

```
[사용자] → [지휘자: Spring Boot or Supabase] → [Node.js Runner VM] → [Playwright + Cucumber]
                                                       └─(대체)→ [GitHub Actions Runner(템플릿 레포)]
```

지휘자는 중앙 통제/권한/저장/실시간을 담당하고, Runner는 실제 테스트 실행을 담당한다.

---

## 2️⃣ 구성 요소별 역할

| 구성 요소                     | 역할                               | 기술 스택                                                           |
| ------------------------- | -------------------------------- | --------------------------------------------------------------- |
| **지휘자(컨트롤 플레인)**          | 테스트 관리, 시나리오 저장, 실행 요청, 결과 수집/중계 | Spring Boot **또는** Supabase(Edge Functions/PG/Storage/Realtime) |
| **Node.js Runner (VM)**   | Playwright+Cucumber 테스트 실제 실행    | Node.js / Playwright / Cucumber                                 |
| **GitHub Actions Runner** | (대체안) 템플릿 레포 기반으로 워크플로 잡이 테스트 실행 | GitHub Actions / Node / Playwright                              |
| **Frontend (UI)**         | 실행 제어 및 보고서 시각화                  | React + TypeScript                                              |
| **DB**                    | 실행 이력, 시나리오, 결과 저장               | PostgreSQL (자체 또는 Supabase PG)                                  |
| **Storage (선택)**          | HTML 리포트, 스크린샷, 비디오 저장           | AWS S3, GCS, 또는 Supabase Storage                                |

---

## 3️⃣ 실행 흐름 요약 (VM 기반)

### Step 1 — 지휘자 → Runner 실행 요청

사용자가 UI에서 실행을 누르면 지휘자가 Runner VM에 REST API 호출로 실행을 명령한다.

```json
POST http://runner-vm:4000/run
{
  "service": "aiclass",
  "feature": "Feature: aiclass 진입...",
  "steps": [{"fileName": "aiclassSteps.ts", "content": "When('...')"}],
  "config": { "baseUrl": "https://stage.m-teacher.co.kr", "executionMode": "PARALLEL" }
}
```

### Step 2 — Runner VM 내부 동작

1. `/tmp/run-UUID/` 생성 후 Feature/Step/Config 저장
2. `npx cucumber-js` 실행
3. HTML/JSON 리포트·스크린샷·비디오 생성

```
/tmp/run-20251010-1234/
├── report.json
├── report.html
├── video.mp4
└── screenshots/
```

### Step 3 — Runner → 지휘자 결과 보고

```json
POST http://orchestrator/api/results
{
  "runId": "20251010-1234",
  "status": "PASSED",
  "duration": 6320,
  "reportUrl": "http://runner-vm/reports/20251010-1234/report.html"
}
```

지휘자는 DB에 저장하고, WebSocket/Realtime으로 Frontend에 실시간 전송한다.

### Step 4 — UI 표시 및 리포트 관리

* 결과 요약, 통계, 개별 리포트 링크 제공
* 실패 케이스는 스크린샷 및 로그 자동 첨부

```
✔ aiclass 진입 성공 (PASS)
🕒 Duration: 6.3s
📄 Report: [HTML 보기]
```

---

## 4️⃣ 확장 및 성능 전략 (VM 기준)

**전송형 구조(초기)**: 매 실행마다 Feature/Step/Config 전체 전송 → 단순하나 대규모에서 느림
**버전 캐시형(중간)**: Runner가 버전 캐시. 지휘자는 버전 ID만 전달 → 속도/트래픽 개선
**레포 기반(고도화)**: Runner가 GitHub private repo를 직접 pull. 지휘자는 “이 시나리오 실행” 신호만

---

## 5️⃣ 병렬/직렬 실행 및 환경 설정

| 설정           | 설명                                              |
| ------------ | ----------------------------------------------- |
| **Base URL** | 서비스별 환경 주소(stage/dev/prod)                      |
| **공통 코드**    | 로그인, wait 등 공통 유틸                               |
| **실행 모드**    | PARALLEL / SERIAL                               |
| **보고서 저장**   | Runner 내부, Actions Artifacts, 혹은 S3/Storage 업로드 |

---

## 6️⃣ VM 분리의 이점

| 항목    | 설명                        |
| ----- | ------------------------- |
| ✅ 안정성 | Runner가 다운되어도 지휘자는 영향 최소화 |
| ✅ 확장성 | 여러 Runner VM 병렬 배포 가능     |
| ✅ 보안성 | 실행 환경을 외부와 분리             |
| ✅ 효율성 | 브라우저/의존성/세션 캐시로 속도 향상     |

---

## 7️⃣ 결론 (VM 기준)

**지휘자 = “지휘자”**, **Runner = “연주자”**. 지휘자는 시나리오/실행 지시·수집, Runner는 실제 Playwright 실행. 보고서/로그는 Runner에서 생성되어 지휘자로 전달, UI는 실시간 표시.

---

# 8️⃣ GitHub Actions 기반 Runner 대체안 (템플릿 레포)

Node.js Runner VM 없이 **GitHub Actions + 템플릿 레포**를 Runner처럼 사용. 지휘자가 `repository_dispatch`로 **잡 트리거**, 잡 종료 시 **지휘자 콜백**을 받는다.

### 8.1 아키텍처

```
[사용자] → [지휘자]
   ├─(repository_dispatch)→ [GitHub Actions(Job) ← 템플릿 레포]
   └←────────(REST callback / HMAC)────────┘
```

### 8.2 템플릿 레포 최소 골격

```
qa-runner-template/
├─ .github/workflows/qa.yml
├─ package.json
├─ cucumber.config.ts            # (선택)
├─ playwright.config.ts          # 공통 브라우저 옵션
├─ src/
│  ├─ world.ts                   # World(페이지/컨텍스트 주입)
│  ├─ steps/commons.ts           # 공통 스텝/훅
│  └─ features/                  # (레포 기반 실행 시) 시나리오
└─ README.md
```

### 8.3 트리거 페이로드(예시)

```json
POST https://api.github.com/repos/{org}/{repo}/dispatches
{
  "event_type": "qa_run_request",
  "client_payload": {
    "runId": "20251010-1234",
    "service": "aiclass",
    "config": { "baseUrl": "https://stage.m-teacher.co.kr", "executionMode": "PARALLEL" },
    "ref": "refs/tags/qa-v1.2.3"
  }
}
```

### 8.4 워크플로 핵심 단계(요지)

* checkout → setup-node → 캐시 복원 → `npm ci` → `playwright install`
* (전송형) payload의 feature/steps 파일화
* `npx cucumber-js` 실행 → report.html/json 생성
* **Artifacts 업로드**(또는 S3/Storage)
* **지휘자 콜백**(`/api/results`, HMAC 서명)

### 8.5 장단점(요약)

| 구분     | 장점                          | 주의/한계                              |
| ------ | --------------------------- | ---------------------------------- |
| 호스트 러너 | 병렬/매트릭스, 아티팩트/로그 관리, 운영부담 ↓ | 콜드스타트, 비영구 FS → `actions/cache` 필요 |
| 내부망    | —                           | **Self-Hosted Runner** 필요          |
| 페이로드   | 레포 기반이면 길이 제한 사실상 무관        | 전송형이면 URL+해시, ref 전달로 우회           |

### 8.6 Self-Hosted Runner 체크

* 사내망/보호망 대상이면 필수
* 라벨 예: `runs-on: [self-hosted, linux, qa]`
* 브라우저 프리워밍·npm 캐시 유지로 성능 확보

### 8.7 마이그레이션 체크리스트

* [ ] 템플릿 레포 생성/워크플로 커밋
* [ ] Secrets: `RESULT_URL`, `HMAC_SECRET`, (옵션) `AWS_ROLE_ARN`, `REPORT_BUCKET`
* [ ] 지휘자: `repository_dispatch` 호출 구현
* [ ] 지휘자: `/api/results` 콜백 수신 + HMAC 검증 + DB/실시간 브로드캐스트
* [ ] (내부망) Self-Hosted Runner 설치/라벨링
* [ ] (성능) `actions/cache`로 `node_modules`, `~/.cache/ms-playwright` 캐시
* [ ] (리포트) Artifacts 또는 S3/Storage 경로 UI 연동

---

## 9️⃣ 결론 (통합)

* **VM 기반** 아키텍처를 유지하면서, 필요 시 **GitHub Actions(템플릿 레포)**를 **Runner 대체안**으로 선택 가능
* 공개/외부 접근 서비스·배치/병렬/리포팅 편의가 중요하면 Actions 유리
* 사내망/상태 캐시가 핵심이면 Self-Hosted Actions Runner 또는 기존 VM 유지/병행(하이브리드)

---

# 🔟 Supabase 지휘자(오케스트레이터) 대체안

> **요지:** Spring Boot가 맡던 "지휘자" 역할을 **Supabase**로 대체. 실행(연주)은 여전히 **GitHub Actions(템플릿 레포)** 또는 **기존 VM**.

## 10.1 역할 매핑

| Spring 역할   | Supabase 대체                       | 설명                                    |
| ----------- | --------------------------------- | ------------------------------------- |
| REST API 서버 | **Edge Functions**                | `/runs`(트리거), `/results`(콜백). Deno/TS |
| 인증/서명       | **Secrets + HMAC**                | Edge Function에서 HMAC 검증               |
| DB(이력/결과)   | **Postgres**                      | RLS로 멀티테넌시 격리                         |
| 파일/리포트 저장   | **Storage**                       | report.html/스크린샷/비디오 + 사전서명 URL       |
| 실시간 푸시      | **Realtime**                      | runId 채널 실시간 업데이트                     |
| 스케줄/백오프     | **pg_cron / Scheduled Functions** | 재시도·타임아웃 정리                           |
| 락/상태        | **Advisory Lock or 상태머신 컬럼**      | runId 동시성 제어                          |

## 10.2 플로우(Supabase ↔ Actions/VM)

```
[사용자] → [UI] → [Edge Function: /runs]
   ① /runs → GitHub API(repository_dispatch)
   ② Actions Job 실행(템플릿)
   ③ 완료 시 Actions → [Edge Function: /results] 콜백(HMAC)
   ④ DB 저장 + Storage 경로 기록 + Realtime 브로드캐스트
```

**Payload 전략**

* **레포 기반 권장:** `runId/ref/baseUrl/executionMode` 등 짧은 식별자만 전달
* 전송형 필요 시: **Storage에 JSON 업로드 후 URL+해시**만 전달

## 10.3 DB 스키마(요지)

```sql
create table runs (
  id text primary key,
  service text not null,
  status text check (status in ('QUEUED','RUNNING','PASSED','FAILED','CANCELLED')) default 'QUEUED',
  execution_mode text check (execution_mode in ('PARALLEL','SERIAL')) default 'PARALLEL',
  base_url text,
  ref text,
  report_url text,
  duration_ms int,
  created_at timestamptz default now(),
  finished_at timestamptz,
  tenant_id uuid not null
);

alter table runs enable row level security;

create policy tenant_isolation on runs
  for all using (auth.uid() is not null and exists(
    select 1 from tenant_members tm where tm.tenant_id = runs.tenant_id and tm.user_id = auth.uid()
  ));

create table run_events (
  id bigserial primary key,
  run_id text references runs(id) on delete cascade,
  level text check (level in ('INFO','WARN','ERROR')) default 'INFO',
  message text,
  created_at timestamptz default now()
);
```

## 10.4 Edge Functions 개요

**/runs**: 입력 `{ runId, service, baseUrl, executionMode, ref }` → `runs` upsert(QUEUED) → GitHub `repository_dispatch` → `status=RUNNING`

**/results**: Actions 콜백 `{ runId, status, duration, reportUrl }` + 헤더 `x-signature: sha256=...`(HMAC) → 시그니처 검증 → `runs` 업데이트·`run_events` 기록 → Realtime 반영

## 10.5 GitHub Actions 템플릿 콜백(요지)

* `checkout → setup-node → cache → npm ci → playwright install → npx cucumber-js`
* 보고서 업로드: Supabase Storage(사전서명) 또는 Actions Artifacts
* 콜백: `curl -X POST https://<project>.functions.supabase.co/results` (+ HMAC)

## 10.6 UI 연동

* **Supabase Realtime**로 `runs`/`run_events` 구독하여 상태·로그 실시간 표시
* `report_url` 버튼으로 report.html 링크 노출(만료가능한 사전서명 URL)

## 10.7 장단점

**장점**: 서버 운영 제거, 인증·DB·스토리지·실시간 **원스톱**, 빠른 부트스트랩
**한계**: 브라우저 실행은 외부 러너 필수, 대용량은 Storage 경유, 내부망은 Self-hosted Runner 필요

## 10.8 마이그레이션 체크리스트

* [ ] Supabase 프로젝트/테넌트 모델·RLS
* [ ] 테이블(`runs`, `run_events`…), Storage 버킷(`reports`)
* [ ] Edge Functions: `/runs`, `/results`, 공용 유틸(HMAC, GitHub API)
* [ ] Secrets: `HMAC_SECRET`, `GH_OWNER/REPO`, `GITHUB_APP` 또는 `PAT`
* [ ] 템플릿 레포/워크플로: 캐시, 업로드, 콜백 스크립트
* [ ] UI: Supabase JS, Realtime 구독, 보고서 링크
* [ ] (옵션) pg_cron/Scheduled Functions로 재시도·타임아웃 청소

---

## 11️⃣ 선택지 비교 요약

| 요구/속성    | Node.js Runner VM | GitHub Actions 템플릿 레포          | 지휘자: Spring Boot | 지휘자: Supabase                   |
| -------- | ----------------- | ------------------------------ | ---------------- | ------------------------------- |
| 운영/유지    | OS/브라우저/의존성 직접 관리 | 운영부담 적음(호스트) / 사내는 Self-hosted | JVM 앱 운영 필요      | 서버리스(무관리)                       |
| 내부망 접근   | 용이                | Self-hosted 필요                 | 용이               | Tunnel 또는 Self-hosted Runner 필요 |
| 캐시/워밍업   | 상시 가능             | `actions/cache`로 보완            | 앱단 캐시 구현         | Storage/Realtime, 앱 상태는 DB로 관리  |
| 페이로드 길이  | 무관                | 레포 기반이면 사실상 무관                 | 무관               | Storage 경유 권장                   |
| 리포팅/아티팩트 | 직접 저장/전송          | 내장 업로드/만료                      | 직접 연동 필요         | Storage 사전서명으로 간단               |
| 병렬/매트릭스  | 자체 구현             | 기본 제공                          | 자체 구현            | Realtime/DB 중심으로 단순             |

---

### 최종 결론

* 실행 러너는 **Actions/VM** 중 환경에 맞게 선택·병행
* 지휘자는 **Spring Boot** 또는 **Supabase**로 대체 가능. **Supabase**는 Edge Functions + PG + Storage + Realtime 조합으로 **서버 운영 없이** 지휘 기능을 완결적으로 제공한다.
