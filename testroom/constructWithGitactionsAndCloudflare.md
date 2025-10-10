# QA 자동화 시스템 구조 개요 (Runner: VM ↔ GitHub Actions 템플릿)

## 1️⃣ 개요

이 시스템은 **Spring Boot 백엔드**와 **테스트 실행 환경**을 분리하여, 대규모 Playwright + Cucumber 기반 QA 테스트를 효율적으로 관리하고 실행하는 구조로 설계되었다. 기본 설계는 Node.js Runner VM을 사용하지만, **GitHub Actions(템플릿 레포 기반)으로 Runner를 대체**할 수도 있다.

```
[사용자] → [Spring Boot 서버] → [Node.js Runner VM] → [Playwright + Cucumber]
                                          └─(대체)→ [GitHub Actions Runner(템플릿 레포)]
```

Spring Boot는 중앙 통제 및 보고 역할을, Runner는 실제 테스트 실행을 담당한다.

---

## 2️⃣ 구성 요소별 역할

| 구성 요소                     | 역할                               | 기술 스택                              |
| ------------------------- | -------------------------------- | ---------------------------------- |
| **Spring Boot (백엔드)**     | 테스트 관리, 시나리오 저장, 실행 요청, 결과 수집    | Java 17 / Spring Boot / JPA        |
| **Node.js Runner (VM)**   | Playwright+Cucumber 테스트 실제 실행    | Node.js / Playwright / Cucumber    |
| **GitHub Actions Runner** | (대체안) 템플릿 레포 기반으로 워크플로 잡이 테스트 실행 | GitHub Actions / Node / Playwright |
| **Frontend (UI)**         | 테스트 실행 제어 및 보고서 시각화              | React + TypeScript                 |
| **DB**                    | 실행 이력, 시나리오, 결과 저장               | PostgreSQL                         |
| **Storage (선택)**          | HTML 리포트, 스크린샷, 비디오 저장           | AWS S3 or GCS                      |

---

## 3️⃣ 실행 흐름 요약 (VM 기반)

### Step 1 — Spring Boot → Runner 실행 요청

사용자가 UI에서 실행을 요청하면 Spring Boot는 Runner VM에 REST API 호출로 실행을 명령한다.

```json
POST http://runner-vm:4000/run
{
  "service": "aiclass",
  "feature": "Feature: aiclass 진입...",
  "steps": [{"fileName": "aiclassSteps.ts", "content": "When('...')"}],
  "config": {
    "baseUrl": "https://stage.m-teacher.co.kr",
    "executionMode": "PARALLEL"
  }
}
```

### Step 2 — Runner VM 내부 동작

1. `/tmp/run-UUID/` 생성 후 Feature, Step, Config 파일 저장
2. `npx cucumber-js` 실행으로 테스트 수행
3. HTML/JSON 리포트 및 스크린샷, 비디오 생성

```
/tmp/run-20251010-1234/
├── report.json
├── report.html
├── video.mp4
└── screenshots/
```

### Step 3 — Runner → Spring 결과 보고

```json
POST http://spring-server:8080/api/results
{
  "runId": "20251010-1234",
  "status": "PASSED",
  "duration": 6320,
  "reportUrl": "http://runner-vm/reports/20251010-1234/report.html"
}
```

Spring은 이 데이터를 DB에 저장하고, WebSocket으로 Frontend에 실시간 전송한다.

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

### 전송형 구조 (초기)

* Spring이 매 실행마다 Feature, Step, Config 전체를 Runner에 전송
* 단순하지만 대용량 테스트에서는 느림

### 버전 캐시형 구조 (중간 단계)

* Runner가 Feature/Step/Config 버전을 캐시하여 필요할 때만 갱신
* Spring은 버전 ID만 전달 → 속도 향상, 트래픽 감소

### 레포지토리 기반 구조 (고도화)

* Runner가 GitHub private repo를 직접 pull
* Spring은 단순히 “이 시나리오 실행” 명령만 보냄
* 실행 환경과 코드 동기화를 Git 수준에서 관리

---

## 5️⃣ 병렬/직렬 실행 및 환경 설정

| 설정 항목         | 설명                              |
| ------------- | ------------------------------- |
| **Base URL**  | 서비스별 환경 주소 (stage, dev, prod 등) |
| **공통 코드 설정**  | 로그인, wait 함수 등 모든 시나리오 공용 코드    |
| **실행 모드**     | PARALLEL(병렬) / SERIAL(직렬)       |
| **보고서 저장 위치** | Runner 내부, 또는 S3 업로드 경로 지정      |

---

## 6️⃣ VM 분리의 이점

| 항목    | 설명                                    |
| ----- | ------------------------------------- |
| ✅ 안정성 | Runner VM이 다운되어도 Spring Boot는 영향받지 않음 |
| ✅ 확장성 | 여러 Runner VM 병렬 배포로 대규모 테스트 가능        |
| ✅ 보안성 | 테스트 실행 환경을 외부와 분리                     |
| ✅ 효율성 | Runner VM은 캐시, 브라우저 세션, 의존성 미리 유지 가능  |

---

## 7️⃣ 결론 (VM 기준)

> **Spring Boot는 “지휘자”**, **Node.js Runner는 “연주자”**.
> Spring은 Feature/Step 관리와 실행 지시, Runner는 실제 Playwright 실행을 담당한다.
> 보고서 및 로그는 Runner에서 생성되어 Spring에 전달되며, 사용자는 이를 UI에서 실시간으로 확인할 수 있다.

---

# 8️⃣ GitHub Actions 기반 Runner 대체안 (템플릿 레포)

Node.js Runner VM 없이 **GitHub Actions + 템플릿 레포**를 Runner처럼 사용 가능하다. 즉, GitHub에 **빈 저장소**를 하나 만들고 아래 템플릿을 넣은 뒤, Spring이 `repository_dispatch`로 **잡을 트리거**하고, 잡 종료 시 **Spring 콜백**을 받는다.

### 8.1 아키텍처

```
[사용자] → [Spring Boot]
   ├─(repository_dispatch)→ [GitHub Actions(Job) ← 템플릿 레포]
   └←────────────(REST callback / HMAC)────────────┘
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

Spring이 GitHub API에 디스패치:

```json
POST https://api.github.com/repos/{org}/{repo}/dispatches
{
  "event_type": "qa_run_request",
  "client_payload": {
    "runId": "20251010-1234",
    "service": "aiclass",
    "config": { "baseUrl": "https://stage.m-teacher.co.kr", "executionMode": "PARALLEL" },
    "ref": "refs/tags/qa-v1.2.3"
    // 전송형 유지 시: "feature", "steps"(대용량이면 URL만)
  }
}
```

### 8.4 워크플로 핵심 단계(요지)

* **checkout → node setup → 캐시 복원 → npm ci → playwright install**
* (전송형일 때) **payload의 feature/steps 파일화**
* `npx cucumber-js` 실행 → **report.html/json** 생성
* **Artifacts 업로드**(또는 S3)
* **Spring 콜백**(`/api/results`, HMAC 서명)

### 8.5 장단점

**장점**

* 확장성/편의: 병렬 매트릭스, 아티팩트/로그 관리, 스케줄 실행 용이
* 비밀/권한: GitHub Secrets + OIDC로 S3 업로드, 권한 위임 간편
* 운영부담 축소: VM 패치/브라우저 관리 감소 (Playwright 전용 액션 활용)

**주의/한계**

* 내부망 접근: 사내 스테이징이면 **Self-Hosted Runner** 필요
* 콜드 스타트/캐시: 호스트 러너는 비영구 FS → `actions/cache`로 보완
* 사용량/제한: 동시성/시간 제한 고려(대량/장시간 시 비용/제약 검토)

### 8.6 길이 제한 이슈 회피(중요)

* `repository_dispatch`/`workflow_dispatch` **입력 길이 제한**이 존재 →
  **레포 기반(템플릿)**으로 운영하면 payload는 `runId/ref/baseUrl` 같은 **짧은 식별자만** 전달하여 사실상 무관.
* 전송형을 유지해야 한다면: (1) **S3/GCS에 JSON 업로드 후 URL+해시** 전달, (2) **임시 브랜치에 커밋하고 ref만** 전달, (3) **DocString**은 65KB 내에서만.

### 8.7 Self-Hosted Runner 필요 조건

* 사내망/보호망에서만 접근 가능한 **stage/dev**를 테스트해야 함
* 동일 워크플로에서 `runs-on: [self-hosted, linux, qa]` 라벨로 특정 러너 지정
* 러너 머신에 **브라우저 프리워밍, npm 캐시**를 유지해 VM 캐시 이점 재현

### 8.8 마이그레이션 체크리스트

* [ ] 템플릿 레포 생성 및 워크플로(`qa.yml`) 커밋
* [ ] GitHub Secrets: `SPRING_RESULT_URL`, `SPRING_SIGNING_SECRET` (옵션: `AWS_ROLE_ARN`, `REPORT_BUCKET`)
* [ ] Spring: `repository_dispatch` 호출 구현, `runId`, `ref`, `baseUrl`, `executionMode` 전달
* [ ] Spring: `/api/results` 콜백 수신 + **HMAC 검증** + DB/WebSocket 브로드캐스트
* [ ] (내부망) Self-Hosted Runner 설치 및 라벨링
* [ ] (성능) `actions/cache`로 `node_modules`, `~/.cache/ms-playwright` 캐시
* [ ] (리포트) Artifacts 또는 S3 업로드 경로 UI 연동

### 8.9 선택지 비교 요약

| 요구사항/속성    | Node.js Runner VM | GitHub Actions 템플릿 레포           |
| ---------- | ----------------- | ------------------------------- |
| 운영/유지보수    | 직접 OS/브라우저/의존성 관리 | 관리 부담 적음(호스트) / 사내는 Self-hosted |
| 내부망 접근     | 용이                | Self-hosted 필요                  |
| 캐시/워밍업     | 상시 가능             | 캐시 액션으로 보완                      |
| 페이로드 길이 제한 | 무관                | 레포 기반이면 사실상 무관                  |
| 리포팅/아티팩트   | 직접 저장/전송          | 내장 업로드/보관/만료 관리                 |
| 병렬/매트릭스    | 스스로 구현 필요         | 기본 제공                           |

---

## 9️⃣ 결론 (통합)

* 기존 **VM 기반** 아키텍처는 그대로 유지 가능하며, 운영 상황에 따라 **GitHub Actions(템플릿 레포)** 를 **Runner 대체안**으로 선택할 수 있다.
* 공개/외부 접근 서비스 중심, 배치/병렬/리포팅 편의가 중요하면 **Actions**가 유리.
* 사내망/상태 캐시가 핵심이면 **Self-Hosted Actions Runner** 또는 **기존 VM**을 유지/병행하는 **하이브리드**가 최선이다.
* 입력 길이 제한은 **레포 기반(템플릿)** 운용으로 사실상 해소된다(전송형은 URL/해시 또는 ref 전달로 우회).

---

# 🔟 Cloudflare 기반 지휘자(오케스트레이터) 대체안

**요지:** Spring Boot가 맡던 "지휘자" 역할을 **Cloudflare**의 서버리스 구성으로 대체 가능.

* 테스트 실행(연주)은 여전히 **GitHub Actions 템플릿 레포**(또는 기존 VM)가 담당.
* Cloudflare는 **API 게이트웨이, 실행 트리거, 결과 집계/저장, 실시간 전송**을 맡는다.

## 10.1 구성 매핑

| Spring 역할     | Cloudflare 대체                             | 설명                                                             |
| ------------- | ----------------------------------------- | -------------------------------------------------------------- |
| REST API 서버   | **Workers / Pages Functions**             | 실행 요청/결과 수신 엔드포인트 제공, GitHub API 호출로 `repository_dispatch` 트리거 |
| 인증/서명         | **Workers Secrets / Zero Trust 정책**       | HMAC 서명 검증, IP/토큰/MTLS 등 보강                                    |
| DB (실행 이력/결과) | **D1(SQLite) / Hyperdrive(+외부 Postgres)** | 가볍게는 D1로 시작, 기존 RDB 보존 시 Hyperdrive로 안전 프록시                    |
| 파일/리포트 저장     | **R2(S3 호환)**                             | report.html / 스크린샷 / 비디오 저장, 사전서명 URL 제공                       |
| 큐/비동기         | **Queues**                                | 대량 실행 요청 버퍼링, 재시도/백오프                                          |
| 세션/락/상태       | **Durable Objects**                       | runId 단위 동시성 제어, 진행률/상태 캐시, 브로드캐스트 허브                          |
| 실시간 업데이트      | **WebSockets(Workers+DO)** 또는 **SSE**     | Actions 콜백 수신→ DO를 통해 UI로 푸시(프런트는 Cloudflare Pages 호스팅 가능)     |

> **실행 러너는 그대로**: GitHub Actions(호스트/셀프호스트) 또는 기존 Node.js Runner VM을 유지/병행.

## 10.2 플로우(Cloudflare ↔ Actions)

```
[사용자] → [UI(Cloudflare Pages)] → [Workers API]
  ① 실행요청 POST           ② repository_dispatch (GitHub API)
                                         ↓
                                [GitHub Actions Job]
                                         ↓ (완료/중간) 콜백
                            [Workers API] → [Durable Object]
                                         ↓
                             [D1/R2 저장]  &  [UI로 WebSocket/SSE]
```

### 10.2.1 실행 트리거 (Workers → GitHub)

* Workers가 GitHub App 또는 PAT로 `POST /repos/:owner/:repo/dispatches`
* payload는 **짧은 식별자** 중심(`runId`, `ref`, `baseUrl`, `executionMode`)
* 전송형이 필요하면: JSON은 **R2에 저장 후 URL+해시만 전달**

### 10.2.2 결과 수신 (Actions → Workers)

* Actions가 **HMAC 서명** 헤더로 결과 콜백
* Workers가 서명 검증 → **D1**에 메타 저장, **R2**에 리포트 업로드 경로 유지
* **Durable Object**가 runId 룸에 실시간 브로드캐스트(프런트는 즉시 반영)

## 10.3 장단점

**장점**

* 서버 운영 제거(무패치/무관리), 전 세계 엣지에서 빠른 API 응답
* R2/D1/Queues/DO 조합으로 **저비용·고가용** 지휘자 구현
* GitHub Actions·VM 등 다양한 러너와 **느슨한 결합**

**주의/한계**

* Workers는 **브라우저 실행 불가** → 러너 역할은 **반드시 외부**(Actions/VM)
* 사내망 대상 테스트는 **Self-hosted Actions Runner** 또는 **Cloudflare Tunnel** 등 별도 네트워크 경로 필요
* 워크로드 특성상 **요청/실행 시간/페이로드** 한도를 고려(대용량은 R2로 오프로드)

## 10.4 최소 구현 체크리스트

* [ ] **Workers 엔드포인트**: `/runs`(트리거), `/results`(콜백), `/ws`(실시간)
* [ ] **Secrets**: `GITHUB_APP_JWT/PAT`, `HMAC_SECRET`, (옵션) `R2_BUCKET`
* [ ] **D1 스키마**: `runs(id, service, status, duration, report_url, created_at, ...)`
* [ ] **R2 저장 전략**: `reports/{runId}/report.html`, `screenshots/`, `videos/`
* [ ] **Durable Object**: `RunRoom`(runId별 구독/브로드캐스트)
* [ ] **Queues(옵션)**: 대량 실행 시 큐 생산(Workers) → 소비(Workers/CRON)로 스로틀링
* [ ] **UI 연동**: Pages에서 WebSocket/SSE로 진행률 표시, Report 링크 노출(Artifacts 또는 R2)

## 10.5 선택지 비교 (Spring vs Cloudflare)

| 항목      | Spring Boot        | Cloudflare(Workers 등)           |
| ------- | ------------------ | ------------------------------- |
| 운영/배포   | JVM 앱 배포/운영 필요     | 서버리스(무관리), 전 세계 엣지              |
| 상태/락    | DB+애플리케이션 구현       | Durable Objects로 간결             |
| DB/스토리지 | 자체 RDB/S3 연동       | D1/R2 네이티브, 외부 RDB는 Hyperdrive  |
| 실시간     | WebSocket 서버 직접 운영 | Edge WebSocket/SSE + DO         |
| 러너와 연동  | REST로 자유롭게         | REST 동일(주로 GitHub API)          |
| 사내망 접근  | VPC 내 배치 용이        | Tunnel 또는 Self-hosted Runner 필요 |

## 10.6 결론

* **가능**: Spring "지휘자"를 **Cloudflare 서버리스 스택**으로 대체할 수 있다.
* 권장 구도: Cloudflare는 **지휘자(컨트롤 플레인)**, 실행은 **GitHub Actions/VM(데이터 플레인)**.
* 사내망/보안 요건에 맞춰 **Self-hosted Runner** 또는 **Cloudflare Tunnel**을 병행하면 완결성이 높다.
