import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';

// Next resolves extensionless authored imports; this isolated Node fixture does the same.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL) {
      const source = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(source)) return nextResolve(source.href, context);
    }

    return nextResolve(specifier, context);
  },
});
