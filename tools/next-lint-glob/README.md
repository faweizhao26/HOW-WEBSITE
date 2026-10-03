# Next Lint Directory Scanner

This private package replaces the `fast-glob` dependency used by
`@next/eslint-plugin-next` 16.3.8. The upstream plugin pins fast-glob 3.3.1,
which pulls in the currently vulnerable micromatch/braces chain.

The package is named `next-lint-glob`, not the upstream fast-glob package.
Its compatibility version 3.3.1 allows npm to deduplicate the plugin's pinned
dependency into the root local file dependency, without an override or an
invalid dependency tree. Commit this directory together with the lockfile.

Only the plugin's `globSync(string, { onlyDirectories: true })` usage is
supported. tinyglobby handles pattern parsing and directory scanning; the
wrapper preserves absolute/relative paths, nonrecursive exact paths, and
fast-glob's directory formatting. Unsupported APIs fail explicitly.

`tests/lint-glob.test.mjs` exercises the actual Next helper and ESLint rules,
including brace patterns, Windows separators, multiple roots, and omission of
files. Run `npm ci`, `npm test`, and `npm ls fast-glob --all` when changing it.
Remove the local replacement when a compatible upstream Next lint plugin no
longer depends on the vulnerable chain, then recheck those tests and audit.
