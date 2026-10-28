// Every scenario runs `mount` (one render of N copies). List a scenario here
// to also measure re-rendering one instance N times, with or without
// destroying it in between.
export const DefaultRenderTypes = ['mount'];
export const AllRenderTypes = ['mount', 'virtual-rerender', 'virtual-rerender-with-unmount'];

export const scenarioRenderTypes = {
  Button: AllRenderTypes,
  Day: AllRenderTypes,
  ThemeProvider: AllRenderTypes,
};
