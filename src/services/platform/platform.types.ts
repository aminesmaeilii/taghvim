export interface PlatformAdapter {
  readonly isDesktop: boolean;
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
}
