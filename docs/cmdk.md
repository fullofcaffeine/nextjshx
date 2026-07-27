# Typed command surfaces with cmdk

NextJsHx uses `cmdk` as the headless interaction engine for searchable command
surfaces while keeping application commands closed and exhaustive in Haxe. The
package owns filtering, keyboard traversal, selection, and its Radix-backed
dialog behavior. The Haxe application owns command identity, payloads, URL and
navigation intents, and the decision to open or close the controlled dialog.

This integration was added while building the flagship Field Ledger Todo app.
The application already had typed URL-backed discovery, typed route hrefs, and
focusable create/search controls, but no keyboard-first way to compose those
intents. Sending cmdk's search `String` directly into application dispatch
would have made every command stringly typed. The reviewed boundary instead
uses cmdk only to select an item and lets Haxe dispatch a closed command.

## Reviewed package contract

The runtime is exactly `cmdk` `1.1.1`, MIT licensed. Its published package
metadata identifies <https://github.com/pacocoursey/cmdk>; that project now
resolves to the maintained <https://github.com/dip/cmdk> repository. The root
lock records integrity
`sha512-Vsv7kFaXm+ptHDMZ7izaRsP70GgrW9NBNGswt9OZaVBLlE0SNpDq8eu/VGXyF9r7M0azK3Wy7OlYXsuyYLFzHg==`.
The reviewed ESM declaration is `dist/index.d.ts`, with SHA-256
`bb703864a1bc9ca5ac3589ffd83785f6dc86f7f6c485c97d7ffd53438777cb9e`.
Its unpacked npm payload is 81,852 bytes; the production application build is
the separate authority for shipped client chunks.

NextJsHx deliberately supports only these named component exports:

- `Command`, used as cmdk's compound root by the source-owned shadcn layer;
- `CommandRoot`;
- `CommandDialog`;
- `CommandInput`;
- `CommandList`;
- `CommandItem`;
- `CommandGroup`;
- `CommandEmpty`; and
- `CommandSeparator`.

The exact version, declaration, exports, owned source, and evidence files live
in [`config/package-integrations.json`](../config/package-integrations.json).
`npm run integrations:check` fails closed when any reviewed part drifts.

## Ownership layers

| Layer | Source | Responsibility |
| --- | --- | --- |
| Package runtime | `cmdk` 1.1.1 | Search, ordered keyboard selection, list/group semantics, and Radix-backed dialog behavior |
| Faithful raw Haxe layer | `src/nextjs/raw/integrations/cmdk/Command.hx` | Exact supported public props, callback arguments, and direct package imports |
| Source-owned shadcn layer | `examples/showcase-ui/src/components/ui/command.tsx` | Editable visual structure, opt-in Mod+K shortcut, and deterministic post-close focus policy |
| Haxe UI facade | `examples/showcase-ui/haxe/showcase/ui/Command.hx` | HXX identities for the source-owned components with exact local extension props |
| Application semantic layer | `TodoCommandCenter.hx` | Closed commands, checked Todo payloads, exhaustive intent dispatch, typed hrefs, and URL-state operations |

The source-owned TSX is intentional: shadcn components belong to the
application and remain editable in their normal ecosystem language. Haxe
consumes those components through exact externs, so existing TSX and Haxe HXX
can use one component implementation and one React identity.

## Closed application commands

cmdk calls `onSelect` with an item value string because that is its faithful
host contract. Application code must not switch on that string. Field Ledger
captures the already-checked command when it creates each item and ignores the
host search value:

```haxe
private enum abstract TodoCommand(String) {
	final FocusCreate = "focus-create";
	final StatusOpen = "status-open";
	final ViewBoard = "view-board";
}

final commandLabel = label(command);
final commandDescription = description(command);
final commandKeywords = [commandLabel, commandDescription].concat(keywords(command));
final select = function(_value:String):Void {
	execute(command, props);
};

<UiCommandItem
	value={value(command)}
	keywords={commandKeywords}
	onSelect={select}
>
	{commandLabel}
</UiCommandItem>
```

`execute` exhaustively handles `TodoCommand` and calls existing typed APIs such
as `selectStatus(TodoStatusFilter.Open)` and `selectView(TodoView.Board)`. Adding
a command without updating the dispatcher is therefore a Haxe error. Opening a
visible Todo uses a separate function whose parameter is the closed `Todo`
model and whose destination is produced by `TodoDetailPage.href({id: todo.id})`.
Because an explicit cmdk value replaces text-derived search, the checked label
and description are always included in the search corpus before domain aliases;
every visible command therefore remains searchable by the words users see.

The rejected alternative is string dispatch:

```haxe
// Rejected: cmdk text is not an application command identity.
<UiCommandItem onSelect={value -> dispatchByString(value)} />
```

That form can represent misspelled, stale, or payload-free commands and turns
an exhaustive Haxe decision into a runtime convention.

## HXX checks before TypeScript

The raw and source-owned component identities declare exact props. Haxe checks
the HXX source span before generated TSX exists:

```haxe
<UiCommandDialog
	open={commandOpen.value}
	onOpenChange={next -> commandOpen.set(next)}
	modKShortcut
	returnFocusId="todo-command-trigger"
>
	<UiCommandInput placeholder="Search commands…" autoFocus />
	<UiCommandList label="Available commands">{items}</UiCommandList>
</UiCommandDialog>
```

The focused negative suite proves, among other cases, that these mistakes fail
in Haxe rather than relying on TypeScript:

```haxe
<UiCommandItem onSelect={function(_value:Int):Void {}} />
<UiCommandItem keywords={[1, 2]} />
<UiCommandDialog modKShortcut="yes" />
```

The expected types are respectively `String -> Void`, `Array<String>`, and
`Bool`. Strict TypeScript and Next builds remain independent parity evidence;
they are not the primary HXX checker.

## Keyboard, focus, and accessibility policy

cmdk deliberately does not install a global shortcut. The source-owned dialog
offers an explicit `modKShortcut` policy so the application owns the global
Control/Command+K listener, prevents the browser default only for that chord,
and cleans the listener up with React's effect lifecycle.

Field Ledger also renders a visible “Open command desk” button with
`aria-haspopup="dialog"`; the shortcut is an accelerator, not the only way to
discover the feature. The dialog has an application-specific accessible
label, its result list has its own label, and the search input receives initial
focus. Radix/cmdk own dialog containment and Escape dismissal. On dismissal,
the source wrapper restores the visible trigger. Commands whose intent is to
continue in the page may instead name an existing focus target, such as the
create title or URL-backed search input.

Focus target IDs are an intentionally small source-owned extension, not a cmdk
claim. The browser lookup is nullable, so a missing target safely performs no
focus operation. Semantic application code should use closed focus identities
instead of repeating arbitrary IDs.

The dialog is a Client Component. Server Components may render the containing
client boundary but must not import or call cmdk directly. A controlled dialog
starts closed during server rendering, so hydration does not publish an open
portal that disagrees with the client.

## Output and runtime evidence

Run the package and HXX contracts with:

```sh
npm run integrations:check
npm run test:integrations
npm run test:showcase-ui
```

The Todo evidence additionally requires escape-free Haxe source, canonical
direct imports, strict generated TypeScript, a real Next production build, and
Playwright against `next start`. The browser flow covers the visible trigger,
input focus, Escape and shortcut dismissal, trigger restoration, a URL-backed
view command, create/search focus transfer, typed Todo navigation, and desktop
and mobile viewport containment. Official React lint covers the source-owned
Hook implementation, including its effect dependencies and callback captures.

Before the chart workstream, the pinned production build placed the command,
drag-and-drop, and URL-state surfaces in one 210,583-byte raw / 67,114-byte gzip
client chunk. That measurement remains the pre-chart baseline, not cmdk's
incremental cost. The current flagship gate measures the union of chunks that
contain stable command and planning signatures, so it continues to work if
Next later splits those features. The Recharts reference records the current
combined measurement and incremental difference.

## Limits and upgrade policy

This layer does not infer commands from labels, generate application actions
from arbitrary strings, infer an exhaustive dependency list, or promise that a
large result set is virtualized. Applications with a materially larger command
catalogue should measure filtering and rendering and introduce an explicit
windowing design if required.

On upgrade:

1. change the exact npm dependency and lockfile;
2. review the selected public declaration and upstream runtime notes;
3. update only the supported props and exports justified by that review;
4. refresh integrity and declaration digest;
5. run Haxe positives and exact negatives, strict TypeScript, official React
   lint, the Next production build, and keyboard/focus Playwright; and
6. record bundle and behavior changes instead of changing the inventory only
   to make its drift gate pass.

See [Typed npm package integrations](package-integrations.md) for the general
adoption policy and [Radix and shadcn composition](radix-shadcn.md) for the
source-owned component boundary.
