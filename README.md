# useSequentialEffect

A React hook that runs useEffect callbacks sequentially.

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

- Sequential Execution: Executes effect setup and cleanup in order.
- Guaranteed Cleanup: Ensures the next effect starts only after asynchronous cleanup completes.
- Latest Effect Priority: Skips pending older effects when a new one is registered.

### Trade-offs

- **Performance**: Sequential execution lowers overall throughput compared to concurrent execution.
- **Responsiveness**: Since new effects wait for cleanup completion, UI updates may feel delayed.

## License

MIT