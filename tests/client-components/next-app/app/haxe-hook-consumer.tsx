"use client";

import { useSemanticCounter } from "./_nextjshx/hook/4d8dcc73935a/useSemanticCounter";
import { useSelection } from "./_nextjshx/hook/a04911485bc8/useSelection";
import { useTodoQuery } from "./_nextjshx/hook/c82d49c13609/useTodoQuery";
import HaxeCounter from "./_nextjshx/client/608bef9587b3/InteractiveCounter";

export function HaxeHookConsumer(props: { initial: number }) {
  const counter = useSemanticCounter(props.initial);
  const selection = useSelection(["tide", "signal"]);
  const query = useTodoQuery();
  return (
    <section>
      <button type="button" onClick={counter.increment}>
        {counter.value} / {counter.doubled}
      </button>
      <button type="button" onClick={() => selection.select(1)}>
        {selection.items.length} typed choices
      </button>
      <button type="button" onClick={query.showActive}>
        {query.view} query view
      </button>
      <HaxeCounter
        label="Haxe component consumed from TSX"
        initialCount={props.initial}
        tone="signal"
        details={{
          enabled: true,
          hints: ["native", "typed"],
          note: null,
          ratio: 1,
          status: undefined,
        }}
      >
        <span>Native TSX child</span>
      </HaxeCounter>
    </section>
  );
}
