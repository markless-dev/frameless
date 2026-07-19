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
      if (path.get('id').isIdentifier({ name: wantedName })) {
        const binding = path.scope.getBinding(wantedName);
        if (
          binding &&
          binding.path.node === path.get('id').node &&
          binding.referencePaths.some((reference) => reference.findParent((parent) => parent === path))
        ) {
          bindings.push(path.node);
        }
      }
    },
  });

  return bindings;
}
