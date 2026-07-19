import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = traverseModule.default ?? traverseModule;

export function parseModule(code) {
  return parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
}

export function unresolvedReferences(code, wantedName) {
  const ast = parseModule(code);
  const references = [];

  traverse(ast, {
    ReferencedIdentifier(path) {
      if (path.node.name === wantedName && !path.scope.getBinding(wantedName)) {
        references.push(path.node);
      }
    },
  });

  return references;
}

export function selfReferentialBindings(code, wantedName) {
  const ast = parseModule(code);
  const bindings = [];

  traverse(ast, {
    VariableDeclarator(path) {
      const id = path.get('id');
      const init = path.get('init');
      if (!id.isIdentifier({ name: wantedName })) return;
      if (!init.node || !init.isIdentifier({ name: wantedName })) return;
      // A true TDZ self-reference: the initializer identifier resolves to the
      // binding introduced by this very declarator.
      const binding = init.scope.getBinding(wantedName);
      if (binding && binding.path.node === path.node) {
        bindings.push(path.node);
      }
    },
  });

  return bindings;
}
