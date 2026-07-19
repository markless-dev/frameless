import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { componentToReact, componentToSolid, parseJsx } = require('@builder.io/mitosis');

export function compileFixture(source) {
  const component = parseJsx(source);

  return {
    react: componentToReact()({ component }),
    solid: componentToSolid()({ component }),
  };
}
