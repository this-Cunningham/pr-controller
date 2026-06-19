JiraBanner — appears on a PR card when a compliance check fails for a missing ticket.

```jsx
{pr.jira && <JiraBanner pr={pr} controller={dash} />}
```

Pending shows a `◆` note + an uppercase ticket input + "Set ticket"; once set it collapses to a linked confirmation. The input is uppercased on submit.
