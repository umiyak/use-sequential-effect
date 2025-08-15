# useSequentialEffect

A useEffect wrapper for running effects sequentially, including those with asynchronous operations.

## Install

```bash
npm install @umiyak/use-sequential-effect
```

## Usage

```tsx
useSequentialEffect(async () => {
  const audioContext = new AudioContext({ sampleRate });
  
  await someAsyncSetup();

  return async () => {
    await audioContext.close();
  };
}, [sampleRate]);
```

### Features

1. Sequential Execution: Runs the effect's setup and cleanup in order.
2. Guaranteed Cleanup: Starts the next effect only after the asynchronous cleanup is completed.
3. Latest Effect Priority: If a new effect is registered, any pending older effects that haven't started yet are skipped.

### Trade-offs

- Performance: Since each effect runs sequentially, performance may be lower compared to running multiple effects concurrently.

## License

MIT