# Contributing to SKILL.md

Thanks for your interest in improving the SKILL.md format.

## Process

1. **Open an issue first** — discuss the change before writing the spec.
2. **PR against `main`** — keep changes atomic and well-justified.
3. **Maintain backward compatibility** — additive only within v1.x.

## What we accept

- ✅ Bug fixes (typos, broken examples)
- ✅ Clarifications (reword for precision)
- ✅ Additive optional fields (new YAML keys)
- ✅ New examples
- ✅ Better error/edge case descriptions

## What requires major version bump

- ❌ Breaking changes to required YAML fields
- ❌ Changes to body section semantics
- ❌ Removing fields

## Style

- Use clear, precise language (this spec will be implemented by machines)
- One sentence per line where possible (easier to diff)
- Examples must conform to the spec themselves
- Add a justification comment in the PR for non-obvious changes

## Release process

- MAJOR bump (1.0 → 2.0): breaking change
- MINOR bump (1.0 → 1.1): additive change
- PATCH bump (1.0 → 1.0.1): clarification/typo

Tools implementing v1.0 MUST accept v1.x files (forward compat for additive fields).

## Community

- GitHub Discussions: open
- Discord: (planned)
- Office hours: (planned)

## License

By contributing, you agree to release your contributions under CC0 (public domain).
