import * as vscode from 'vscode';
import { TelemetryBuffer } from './buffer';
import { DeviceTracker } from './device';

export class Uploader {
  constructor(
    private buffer: TelemetryBuffer,
    private deviceTracker: DeviceTracker
  ) {}

  public async flush(): Promise<void> {
    const sessions = this.buffer.get();
    if (sessions.length === 0) return;

    try {
      const config = vscode.workspace.getConfiguration('antarix');
      const apiUrl = config.get<string>('apiUrl', 'http://localhost:3000/api/signals/ide/upload');
      const apiKey = config.get<string>('apiKey');

      if (!apiKey) {
        vscode.window.showErrorMessage('Antarix API key is missing. Telemetry not uploaded.');
        return;
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({ sessions })
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      await this.buffer.clear();
      console.log(`Uploaded ${sessions.length} sessions`);
    } catch (err: any) {
      console.error('Antarix telemetry upload error:', err.message);
    }
  }
}
