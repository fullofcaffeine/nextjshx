import { useSortable } from "@dnd-kit/react/sortable";

export type SortableRowProps = {
  readonly id: string;
  readonly index: number;
  readonly label: string;
};

/** Native-TSX parity control for the public package Hook and ref contract. */
export function SortableRow(props: SortableRowProps) {
  const sortable = useSortable({ id: props.id, index: props.index });

  return (
    <li ref={sortable.ref}>
      <button
        ref={sortable.handleRef}
        type="button"
        aria-label={"Reorder " + props.label}
      >
        Move
      </button>
      <span>{props.label}</span>
    </li>
  );
}
