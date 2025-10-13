FROM mcr.microsoft.com/playwright:v1.41.2-jammy

WORKDIR /app

COPY runner.js world.ts cucumber.js tsconfig.json ./

RUN npm init -y \
  && npm install --save \
    express \
    @cucumber/cucumber \
    ts-node \
    typescript \
    @playwright/test \
  && npx playwright install --with-deps

EXPOSE 3000

ENV PORT=3000

CMD ["node", "runner.js"]
