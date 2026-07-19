import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const mitosis = require('@builder.io/mitosis');

export const { componentToQwik, componentToReact, parseJsx } = mitosis;
