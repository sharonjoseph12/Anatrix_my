import * as vscode from 'vscode';

export interface IDESession {
  id?: string;
  device_id: string;
  student_id: string; // From config / globalState?
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  editor: "vscode" | "cursor";
  project_hash: string;
  language: string;
  keystroke_entropy_bpm: number;
  debug_session_duration_seconds: number;
  debug_step_ratio: number;
  ast_refactor_distance: number;
  time_in_file_seconds: number;
  test_run_count: number;
  error_resolution_latency_ms: number;
  raw_partial_capture: boolean;
}

export class TelemetryBuffer {
  private static readonly BUFFER_KEY = 'antarix.telemetryBuffer';

  constructor(private context: vscode.ExtensionContext) {}

  public async push(session: IDESession): Promise<void> {
    const buffer = this.get();
    buffer.push(session);
    await this.context.globalState.update(TelemetryBuffer.BUFFER_KEY, buffer);
  }

  public get(): IDESession[] {
    return this.context.globalState.get<IDESession[]>(TelemetryBuffer.BUFFER_KEY) || [];
  }

  public async clear(): Promise<void> {
    await this.context.globalState.update(TelemetryBuffer.BUFFER_KEY, []);
  }
}
