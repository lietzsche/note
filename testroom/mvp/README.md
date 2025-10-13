# QA Runner 사용 안내

이 프로젝트는 Playwright와 Cucumber 기반의 QA 테스트를 HTTP API 형태로 실행하는 러너를 제공합니다. Docker 컨테이너로 실행하는 방법과 로컬에서 직접 실행하는 방법을 모두 설명합니다.

## 사전 준비

- Docker 환경 (선호)
- 또는 Node.js 18 이상과 npm, Playwright 실행에 필요한 브라우저 의존성

## Docker로 실행하기

1. 이미지 빌드

   ```bash
   docker build -t qa-runner .
   ```

2. 컨테이너 실행

   ```bash
   docker run --rm -p 3000:3000 qa-runner
   ```

3. 다른 터미널에서 테스트 실행 요청 예시 (`features`와 `steps` 배열을 원하는 시나리오로 교체)

   ```bash
   curl -X POST http://localhost:3000/run ^
     -H "Content-Type: application/json" ^
     -d "{
       \"features\": [
         {
           \"name\": \"example.feature\",
           \"content\": \"Feature: Example\\n  Scenario: Visit Playwright\\n    Given I open playwright homepage\\n    Then the title should contain Playwright\"
         }
       ],
       \"steps\": [
         {
           \"name\": \"example.steps.ts\",
           \"content\": \"import { Given, Then } from '@cucumber/cucumber';\\nimport { expect } from '@playwright/test';\\n\\nGiven('I open playwright homepage', async function () {\\n  await this.page.goto('https://playwright.dev');\\n});\\n\\nThen('the title should contain Playwright', async function () {\\n  await expect(this.page).toHaveTitle(/Playwright/);\\n});\"
         }
       ]
     }"
   ```
   Windows PowerShell에서는 위 예시처럼 `^`로 줄바꿈을, WSL 또는 macOS 터미널에서는 `\`로 줄바꿈을 사용하세요.
   > ⚠️ PowerShell에서 JSON 문자열을 작성할 때는 `@" ... "@` 형태의 더블 쿼트 here-string이나 `ConvertTo-Json`을 사용하는 것이 안전합니다. 싱글 쿼트 here-string(`'@ ... '@`)을 사용하면 개행이 `\n` 문자 그대로 전달되어 테스트 파일이 한 줄로 생성되고 TypeScript 파싱 오류가 발생할 수 있습니다.

4. 응답으로 실행 로그(`stdout`, `stderr`)와 `report` JSON이 반환됩니다. 컨테이너 내부에는 `/tmp/run-UUID` 경로에 생성된 실행 결과가 남습니다.

## 로컬에서 실행하기

1. 의존성 설치

   ```bash
   npm init -y
   npm install express @cucumber/cucumber ts-node typescript @playwright/test
   npx playwright install --with-deps
   ```

2. 러너 실행

   ```bash
   node runner.js
   ```

3. 위 Docker 섹션과 동일한 방식으로 `POST /run` 요청을 보내 테스트를 실행합니다. 필요 시 `PORT`, `RUNNER_TMP_BASE`, `CUCUMBER_TIMEOUT_MS`, `PLAYWRIGHT_HEADLESS` 등의 환경 변수를 조정할 수 있습니다.

## 주요 파일

- `runner.js`: Express 기반 `/run` API 서버
- `world.ts`: Playwright 환경을 초기화하는 Cucumber 월드 정의
- `cucumber.js`: Cucumber 실행 설정
- `Dockerfile`: Playwright가 포함된 런타임 이미지 정의

## 문제 해결 팁

- Playwright 브라우저 설치가 누락되면 `npx playwright install --with-deps`를 다시 실행하세요.
- 테스트 코드에서 비동기 작업은 반드시 `await`를 사용하여 종료 시점을 보장하세요.
- `/run` 요청 본문은 JSON이어야 하며 `features` 배열에 최소 하나의 `.feature` 콘텐츠가 포함되어야 합니다.
