Toast — a brief confirmation after an action ("Saved", "Up to date").

```jsx
<Toast message={toast} /> // toast is a string or null; clear it on a ~2.8s timer
```

One at a time, bottom-center. Leading accent dot. Don't use for errors that need a decision — those stay inline.
