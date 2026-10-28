// Run by the husky pre-commit hook (frontend/.husky/pre-commit) on staged files under frontend/.
export default {
  '*.{ts,html}': ['eslint --fix', 'prettier --write'],
  '*.{scss,css,json,md,mjs,js}': 'prettier --write',
};
