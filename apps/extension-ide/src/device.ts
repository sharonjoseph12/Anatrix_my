import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';

export class DeviceTracker {
  private static readonly DEVICE_ID_KEY = 'antarix.deviceId';

  constructor(private context: vscode.ExtensionContext) {}

  public async getDeviceId(): Promise<string> {
    let id = await this.context.globalState.get<string>(DeviceTracker.DEVICE_ID_KEY);
    if (!id) {
      id = uuidv4();
      await this.context.globalState.update(DeviceTracker.DEVICE_ID_KEY, id);
    }
    return id;
  }

  public async revoke(): Promise<void> {
    await this.context.globalState.update(DeviceTracker.DEVICE_ID_KEY, undefined);
    // Inform backend? The uploader can handle sending a revoke event.
  }
}
