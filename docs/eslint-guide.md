# 📋 ESLint & Prettier Configuration

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Setup ESLint & Husky
chmod +x setup-lint.sh
./setup-lint.sh

# Check for issues
npm run lint

# Auto-fix issues
npm run lint:fix

# Format code
npm run format
```

## 📝 Key Rules

### TypeScript Rules
- **No any**: `@typescript-eslint/no-explicit-any: warn`
- **Unused variables**: Must prefix with `_` to ignore
- **Naming conventions**:
  - Classes: `PascalCase`
  - Interfaces: `PascalCase` (no `I` prefix)
  - Enums: `PascalCase`

### Import Rules
- **Order**: builtin → external → internal → parent → sibling
- **Alphabetical**: Within each group
- **No duplicates**: Each module imported once
- **No cycles**: Circular dependencies not allowed

### Code Quality
- **Max line length**: 120 characters
- **Max file length**: 400 lines
- **Max function length**: 80 lines
- **Max complexity**: 15 (cyclomatic)
- **Max depth**: 4 levels

### Best Practices
- **No console**: Except `warn`, `error`, `info`
- **No debugger**: Not allowed in code
- **Prefer const**: Use `const` over `let` when possible
- **Strict equality**: Always use `===` and `!==`
- **Curly braces**: Required for all blocks

## 🎨 Prettier Settings

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "semi": true
}
```

## 🔧 VS Code Integration

### Required Extensions
- ESLint: `dbaeumer.vscode-eslint`
- Prettier: `esbenp.prettier-vscode`

### Auto-fix on Save
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```

## 🐕 Git Hooks

### Pre-commit
- Runs `lint-staged` on staged files
- Auto-fixes fixable issues
- Blocks commit if unfixable issues exist

### Setup
```bash
npx husky install
```

## 🎯 Custom Rules

### Disable a Rule
```javascript
// eslint-disable-next-line rule-name
const example = 'This line ignores the rule';

/* eslint-disable rule-name */
// Multiple lines ignoring the rule
/* eslint-enable rule-name */
```

### File-level Disable
```javascript
/* eslint-disable @typescript-eslint/no-explicit-any */
```

### Inline Configuration
```javascript
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _unusedVar = 'Prefixed with _ to indicate intentionally unused';
```

## 📊 Coverage Requirements

Jest coverage thresholds:
- Branches: 60%
- Functions: 60%
- Lines: 60%
- Statements: 60%

## 🔍 Common Issues & Solutions

### Issue: Import order errors
**Solution**: Run `npm run lint:fix` to auto-sort imports

### Issue: Line too long
**Solution**: Break into multiple lines or extract to variable

### Issue: Function too complex
**Solution**: Extract helper functions or use early returns

### Issue: Prettier conflicts
**Solution**: Prettier rules take precedence, run `npm run format`

## 📚 Resources

- [ESLint Rules](https://eslint.org/docs/rules/)
- [TypeScript ESLint](https://typescript-eslint.io/rules/)
- [Prettier Options](https://prettier.io/docs/en/options.html)
- [Husky Documentation](https://typicode.github.io/husky/)
