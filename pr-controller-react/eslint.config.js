// Adherence lint — vendored from the Wabi-Sabi design system
// (design/.upstream/wabi-sabi-foundation/_adherence.oxlintrc.json). Enforces token
// hygiene (no raw hex / px, design-system fonts only) + per-component prop & tone
// contracts. ESLint flat config: the shipped config is oxlint-named, but oxlint 1.70
// does not implement no-restricted-syntax, which ESLint supports natively. The
// import-from-barrel rule is deferred until a design-system/index.js barrel exists.
//
// LOCAL rule (NOT from the vendored DS adherence config — PRESERVE on a design re-sync):
// `local/no-controller-prop` BLOCKS (error) threading a controller / state-management
// god-object through JSX props (the dc.html anti-pattern). Kept a hard error, separate
// from the warn-level adherence selectors below.
const noControllerProp = {
  meta: {
    type: "problem",
    docs: { description: "Forbid threading a controller/state-management god-object through JSX props (the dc.html anti-pattern)." },
    schema: [],
    messages: {
      controllerProp:
        "Don't thread a controller / state-management object through props (the dc.html god-object anti-pattern). Use normal React patterns and pass each component the specific data + onX props it needs — Context is an escape hatch for deep trees only.",
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        const name = node.name && node.name.name;
        if (name === "controller" || name === "dc") {
          context.report({ node, messageId: "controllerProp" });
        }
      },
    };
  },
};

export default [
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { local: { rules: { "no-controller-prop": noControllerProp } } },
    rules: {
      "local/no-controller-prop": "error",
      "no-restricted-syntax": ["warn",{"selector":"Literal[value=/#[0-9a-fA-F]{3,8}\\b/]","message":"Raw hex color — use a design-system color token via var()."},{"selector":"Literal[value=/\\b\\d+px\\b/]","message":"Raw px value — use a design-system spacing token via var()."},{"selector":"Literal[value=/font-family\\s*:\\s*(?!['\\\"]?(?:Hanken Grotesk|IBM Plex Mono|Newsreader))/i]","message":"Font not provided by the design system. Available: Hanken Grotesk, IBM Plex Mono, Newsreader."},{"selector":"JSXOpeningElement[name.name='Badge'] > JSXAttribute > JSXIdentifier[name!=/^(?:tone|dot|mono|children|key|ref|className|style|children)$/]","message":"<Badge> doesn't accept that prop. Declared props: tone, dot, mono, children."},{"selector":"JSXOpeningElement[name.name='Badge'] > JSXAttribute[name.name='tone'] > Literal[value!=/^(?:neutral|active|urgent|praise|outline)$/]","message":"<Badge> tone must be one of 'neutral' | 'active' | 'urgent' | 'praise' | 'outline'."},{"selector":"JSXOpeningElement[name.name='Button'] > JSXAttribute > JSXIdentifier[name!=/^(?:variant|onClick|disabled|children|key|ref|className|style|children)$/]","message":"<Button> doesn't accept that prop. Declared props: variant, onClick, disabled, children."},{"selector":"JSXOpeningElement[name.name='Button'] > JSXAttribute[name.name='variant'] > Literal[value!=/^(?:primary|outline|ghost)$/]","message":"<Button> variant must be one of 'primary' | 'outline' | 'ghost'."},{"selector":"JSXOpeningElement[name.name='Callout'] > JSXAttribute > JSXIdentifier[name!=/^(?:tone|eyebrow|dot|pulse|children|key|ref|className|style|children)$/]","message":"<Callout> doesn't accept that prop. Declared props: tone, eyebrow, dot, pulse, children."},{"selector":"JSXOpeningElement[name.name='Callout'] > JSXAttribute[name.name='tone'] > Literal[value!=/^(?:urgent|active|neutral)$/]","message":"<Callout> tone must be one of 'urgent' | 'active' | 'neutral'."},{"selector":"JSXOpeningElement[name.name='Confirmation'] > JSXAttribute > JSXIdentifier[name!=/^(?:text|fg|onUndo|key|ref|className|style|children)$/]","message":"<Confirmation> doesn't accept that prop. Declared props: text, fg, onUndo."},{"selector":"JSXOpeningElement[name.name='DispositionTag'] > JSXAttribute > JSXIdentifier[name!=/^(?:tone|children|key|ref|className|style|children)$/]","message":"<DispositionTag> doesn't accept that prop. Declared props: tone, children."},{"selector":"JSXOpeningElement[name.name='DispositionTag'] > JSXAttribute[name.name='tone'] > Literal[value!=/^(?:urgent|active|neutral|praise|error|pending)$/]","message":"<DispositionTag> tone must be one of 'urgent' | 'active' | 'neutral' | 'praise' | 'error' | 'pending'."},{"selector":"JSXOpeningElement[name.name='EmptyState'] > JSXAttribute > JSXIdentifier[name!=/^(?:label|key|ref|className|style|children)$/]","message":"<EmptyState> doesn't accept that prop. Declared props: label."},{"selector":"JSXOpeningElement[name.name='OrganicLoader'] > JSXAttribute > JSXIdentifier[name!=/^(?:variant|label|size|tone|key|ref|className|style|children|aria-hidden)$/]","message":"<OrganicLoader> doesn't accept that prop. Declared props: variant, label, size, tone."},{"selector":"JSXOpeningElement[name.name='ScopeBadge'] > JSXAttribute > JSXIdentifier[name!=/^(?:scope|count|onToggle|allLabel|scopedLabel|key|ref|className|style|children)$/]","message":"<ScopeBadge> doesn't accept that prop. Declared props: scope, count, onToggle, allLabel, scopedLabel."},{"selector":"JSXOpeningElement[name.name='ScopeBadge'] > JSXAttribute[name.name='scope'] > Literal[value!=/^(?:all|scoped)$/]","message":"<ScopeBadge> scope must be one of 'all' | 'scoped'."},{"selector":"JSXOpeningElement[name.name='Skeleton'] > JSXAttribute > JSXIdentifier[name!=/^(?:caption|count|key|ref|className|style|children)$/]","message":"<Skeleton> doesn't accept that prop. Declared props: caption, count."},{"selector":"JSXOpeningElement[name.name='TabItem'] > JSXAttribute > JSXIdentifier[name!=/^(?:key|label|count|emphasize|key|ref|className|style|children)$/]","message":"<TabItem> doesn't accept that prop. Declared props: key, label, count, emphasize."},{"selector":"JSXOpeningElement[name.name='TextButton'] > JSXAttribute > JSXIdentifier[name!=/^(?:onClick|tone|underline|children|key|ref|className|style|children)$/]","message":"<TextButton> doesn't accept that prop. Declared props: onClick, tone, underline, children."},{"selector":"JSXOpeningElement[name.name='TextButton'] > JSXAttribute[name.name='tone'] > Literal[value!=/^(?:accent|muted)$/]","message":"<TextButton> tone must be one of 'accent' | 'muted'."},{"selector":"JSXOpeningElement[name.name='ThemeOption'] > JSXAttribute > JSXIdentifier[name!=/^(?:value|label|key|ref|className|style|children)$/]","message":"<ThemeOption> doesn't accept that prop. Declared props: value, label."},{"selector":"JSXOpeningElement[name.name='Toast'] > JSXAttribute > JSXIdentifier[name!=/^(?:message|key|ref|className|style|children)$/]","message":"<Toast> doesn't accept that prop. Declared props: message."}],
    },
  },
];
