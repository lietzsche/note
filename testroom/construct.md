## QA 자동화 시스템 구조 개요

### 1️⃣ 개요

이 시스템은 **Spring Boot 백엔드**와 **Node.js Runner VM**을 분리하여, 대규모 Playwright + Cucumber 기반 QA 테스트를 효율적으로 관리하고 실행하는 구조로 설계되었다.

```
[사용자] → [Spring Boot 서버] → [Node.js Runner VM] → [Playwright + Cucumber]
```

Spring Boot는 중앙 통제 및 보고 역할을, Node.js Runner는 실제 테스트 실행을 담당한다.

---

## 2️⃣ 구성 요소별 역할

| 구성 요소                   | 역할                            | 기술 스택                           |
| ----------------------- | ----------------------------- | ------------------------------- |
| **Spring Boot (백엔드)**   | 테스트 관리, 시나리오 저장, 실행 요청, 결과 수집 | Java 17 / Spring Boot / JPA     |
| **Node.js Runner (VM)** | Playwright+Cucumber 테스트 실제 실행 | Node.js / Playwright / Cucumber |
| **Frontend (UI)**       | 테스트 실행 제어 및 보고서 시각화           | React + TypeScript              |
| **DB**                  | 실행 이력, 시나리오, 결과 저장            | PostgreSQL                      |
| **Storage (선택)**        | HTML 리포트, 스크린샷, 비디오 저장        | AWS S3 or GCS                   |

---

## 3️⃣ 실행 흐름 요약

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

---

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

---

### Step 3 — Runner → Spring 결과 보고

Runner는 테스트 완료 후 결과를 Spring 서버에 다시 전달한다.

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

---

### Step 4 — UI 표시 및 리포트 관리

* 결과 요약, 통계, 개별 리포트 링크 제공
* 실패 케이스는 스크린샷 및 로그 자동 첨부

```
✔ aiclass 진입 성공 (PASS)
🕒 Duration: 6.3s
📄 Report: [HTML 보기]
```

---

## 4️⃣ 확장 및 성능 전략

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

## 7️⃣ 결론

> **Spring Boot는 “지휘자”**, **Node.js Runner는 “연주자”**.
>
> Spring은 Feature/Step 관리와 실행 지시, Runner는 실제 Playwright 실행을 담당한다.
>
> 보고서 및 로그는 Runner에서 생성되어 Spring에 전달되며, 사용자는 이를 UI에서 실시간으로 확인할 수 있다.
