module.exports = {
  default: {
    requireModule: ['ts-node/register/transpile-only'],
    require: [
      'world.ts',
      'features/**/*.ts',
      'features/**/*.js',
    ],
    format: ['progress', 'json:report.json'],
    publishQuiet: true,
    paths: [],
  },
};

