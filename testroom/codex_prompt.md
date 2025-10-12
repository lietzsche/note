🧭 Codex 요청 순서 가이드: Spring + React + Node Runner 기반 QA 자동화 시스템

이 문서는 Codex를 이용해 Spring Boot 서버, React UI, Node.js Runner (Docker) 로 구성된 QA 자동화 시스템을 단계적으로 구현하기 위한 요청 순서를 정리한 것이다. 각 단계의 프롬프트를 Codex에 순서대로 입력하면 전체 시스템이 완성된다.


---

1️⃣ Runner Docker 환경 구축 (Playwright + Cucumber)

프롬프트 예시:

> 목표: Node.js 기반 QA Runner를 Docker 컨테이너로 구성한다. Playwright와 Cucumber를 설치하고, /run API를 통해 테스트 요청을 받아 /tmp/run-UUID/ 경로에서 feature/step을 실행한다. 필요사항:

Dockerfile (Playwright 설치 포함)

runner.js (Express 기반 API)

world.ts (Playwright 환경 초기화)

cucumber.js (require 설정) 출력: 위 파일 4개를 포함한 완전한 예시.




결과: Codex는 runner.js, world.ts, cucumber.js, Dockerfile을 자동 생성.


---

2️⃣ Spring Boot → Runner 통신 구조 구현

프롬프트 예시:

> 목표: Spring Boot 서버가 POST /api/run 요청을 받아, Runner VM의 /run 엔드포인트로 JSON을 전송하도록 한다. 필요사항:

DTO: RunRequest, RunResponse

Controller: RunController.java

Service: RunService.java (WebClient 사용)

application.yml에 RUNNER_URL 설정 출력: 전체 코드 예시.




결과: Codex가 Runner 실행 요청용 REST API와 통신 로직을 생성.


---

3️⃣ Runner → Spring 결과 보고 API (Callback)

프롬프트 예시:

> 목표: Runner가 테스트 완료 후 결과를 Spring Boot로 전송한다. 필요사항:

Spring: POST /api/results 엔드포인트 (ResultController.java)

Entity: TestResult (status, duration, reportUrl 등)

Repository + JPA 설정 포함 출력: 결과 저장 + 로그 출력 코드 포함 예시.





---

4️⃣ React UI — 시나리오 작성 / 실행 요청

프롬프트 예시:

> 목표: React에서 Feature와 Step 코드를 작성해 Spring으로 전송하는 UI를 만든다. 필요사항:

Monaco Editor 기반 코드 편집기 (ScenarioEditor.tsx)

POST /api/scenarios 호출 코드 포함

자동완성 및 자동 import 기능 (Given/When/Then)

저장 버튼 및 실행 버튼 구현 출력: 완성된 React 컴포넌트 코드.





---

5️⃣ Runner에서 import 자동 설치 기능 추가

프롬프트 예시:

> 목표: Runner가 전달받은 Step 코드 내 import 문을 자동 분석하여, 누락된 npm 패키지를 설치하도록 한다. 필요사항:

runner.js 내 로직 추가 (정규식으로 import 추출 → npm install)

캐시 디렉토리 활용 (/opt/node_cache) 출력: 수정된 runner.js 전체 예시.





---

6️⃣ world.ts 및 cucumber.js 자동 구성 템플릿 생성

프롬프트 예시:

> 목표: Runner가 실행 시 자동으로 cucumber.js와 world.ts 파일을 생성하도록 한다. 필요사항:

/tmp/run-UUID 생성 시 템플릿 복사 로직 추가

world.ts: Playwright 브라우저 초기화 및 CustomWorld 정의 포함

cucumber.js: ts-node/register, require 설정 포함 출력: runner.js 내부 파일 생성 로직 포함된 전체 예시.





---

7️⃣ Spring + Runner 통합 docker-compose 구성

프롬프트 예시:

> 목표: Spring Boot 서버와 Runner 컨테이너를 함께 띄워서 통신 가능하도록 설정한다. 필요사항:

docker-compose.yml 생성 (spring:8080, runner:4000)

Spring의 RUNNER_URL을 환경변수로 전달

Runner는 자동 기동 후 대기 상태 유지 출력: docker-compose.yml 예시.





---

8️⃣ 결과 실시간 표시 (WebSocket)

프롬프트 예시:

> 목표: Spring이 Runner 결과를 수신하면 React로 실시간 전송되도록 한다. 필요사항:

Spring: WebSocketConfig + MessageBroker 설정

React: WebSocket 연결(useEffect) 및 실행 상태 업데이트 출력: Spring + React 코드 예시.





---

9️⃣ 고도화 (캐시형 Runner 및 Git 연동)

프롬프트 예시:

> 목표: Runner가 Feature/Step/Config를 캐시하거나 GitHub repo에서 직접 pull하도록 개선한다. 필요사항:

캐시 버전 관리 로직

Git pull 옵션 출력: 예시 코드 + 설계 구조.





---

✅ 전체 흐름 요약

단계	내용	핵심 산출물

1	Runner Docker 구성	runner.js, Dockerfile
2	Spring → Runner 실행 요청	RunController.java
3	Runner → Spring 결과 보고	ResultController.java
4	React UI 시나리오 작성	ScenarioEditor.tsx
5	npm 자동 설치	runner.js 수정
6	world.ts 템플릿 구성	world.ts, cucumber.js
7	Docker Compose 통합	docker-compose.yml
8	실시간 결과 표시	WebSocket 연결
9	고도화(Git, 캐시)	확장 구조



---

이 순서대로 Codex에 요청하면, 전체 QA 자동화 시스템을 점진적으로 구축 가능하다.

> 💬 팁: 각 단계 완료 후 Runner와 Spring, React를 통합 테스트하면서 실제 JSON 전송이 동작하는지 확인해가며 진행할 것.



