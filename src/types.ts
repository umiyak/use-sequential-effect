export type Cleanup = () => void | Promise<void>;
export type Effect = () => undefined | Cleanup | Promise<undefined | Cleanup>;
