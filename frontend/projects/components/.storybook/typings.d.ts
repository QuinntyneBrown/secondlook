// Prose imports resolved by the `asset/source` rule in main.ts.
declare module '*.md' {
  const content: string;
  export default content;
}
