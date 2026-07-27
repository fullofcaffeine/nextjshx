package nextjs.raw.components;

@:genes.compilerInternal
@:genes.semanticOnly
typedef FormComponentProps = nextjs.raw.components.FormProps.FormPropsFields<String>;

/** Faithful default-import component binding for `next/form`. */
@:jsRequire("next/form", "default")
@:genes.jsxComponentProps("nextjs.raw.components.Form.FormComponentProps")
extern class Form {}
