export interface VmLease {
  id: string;
  release(): Promise<void>;
}

export class VmPool {
  async acquire(): Promise<VmLease> {
    throw new Error("Firecracker VM allocation is not implemented yet");
  }
}
