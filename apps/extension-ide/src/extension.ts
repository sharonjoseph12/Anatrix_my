import * as vscode from 'vscode';
import { TelemetryBuffer } from './buffer';
import { DeviceTracker } from './device';
import { Uploader } from './uploader';

export async function activate(context: vscode.ExtensionContext) {
  const deviceTracker = new DeviceTracker(context);
  const telemetryBuffer = new TelemetryBuffer(context);
  const uploader = new Uploader(telemetryBuffer, deviceTracker);

  console.log('Antarix IDE Telemetry extension is now active.');

  context.subscriptions.push(
    vscode.commands.registerCommand('antarix.enable', async () => {
      await vscode.workspace.getConfiguration('antarix').update('telemetryEnabled', true, true);
      vscode.window.showInformationMessage('Antarix Telemetry Enabled');
    }),
    vscode.commands.registerCommand('antarix.disable', async () => {
      await vscode.workspace.getConfiguration('antarix').update('telemetryEnabled', false, true);
      vscode.window.showInformationMessage('Antarix Telemetry Disabled');
    }),
    vscode.commands.registerCommand('antarix.flushBuffer', async () => {
      await uploader.flush();
      vscode.window.showInformationMessage('Antarix Telemetry Buffer Flushed');
    }),
    vscode.commands.registerCommand('antarix.revokeDevice', async () => {
      await deviceTracker.revoke();
      vscode.window.showWarningMessage('Antarix Device Revoked');
    })
  );

  // Initialize listeners here
}

export function deactivate() {}
