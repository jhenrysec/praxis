# Rule: React and TypeScript

Applies to: **/*.tsx, **/*.ts, **/lab-ui/**

When working on React/TypeScript files:
- All components: TypeScript, named exports, props interface above component
- No `any` types — use proper types or `unknown` with narrowing
- Loading and error states: every component that fetches data must handle both
- Color values: use Tailwind lab-* classes, not hardcoded hex (exception: dynamic values from data)
- Font: JetBrains Mono for code/labels, Rajdhani for headings — import from Google Fonts
- Run `npm run build` after any component change — fix all TypeScript errors before done
- Zustand stores: typed with interface, all mutations in the store (not inline in components)
- API calls: via `src/api/labApi.ts` client — never fetch() directly in components

---

# Rule: Go Source Files

Applies to: **/*.go

When working on Go files:
- Standard library only unless external package is explicitly justified in a comment
- Error wrapping: `fmt.Errorf("context: %w", err)` — never discard errors
- Run `go vet ./...` and `go build ./...` after edits
- CLI tools: use `flag` package or `cobra` if already in the module
- ANSI TUI pattern (established in existing toolkit suite): keep consistent with existing modules
- All exported functions and types must have godoc comments
