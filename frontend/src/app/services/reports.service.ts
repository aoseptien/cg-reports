import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AppStatus {
  online: boolean;
  googleAuth: boolean;
  scheduler: boolean;
  running: boolean;
  lastDaily: string | null;
  lastHourly: string | null;
}

export interface HistoryEntry {
  id: string;
  type: 'daily' | 'hourly';
  status: 'success' | 'error' | 'running';
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  filesGenerated: number | null;
  coordinatorCount: number | null;
  error: string | null;
}

export interface SchedulerConfig {
  enabled: boolean;
  workDays: number[];       // 0=Sun, 1=Mon, ..., 6=Sat
  holidays: string[];       // ISO date strings e.g. "2024-12-25"
  dailyHour: number;        // 0–23
  hourlyHours: number[];    // e.g. [13, 14, 15, 16, 17]
  nextDailyRun: string | null;
  nextHourlyRun: string | null;
}

export interface RunResult {
  success: boolean;
  message: string;
  jobId?: string;
}

const API = 'http://localhost:3000/api';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private http = inject(HttpClient);

  getStatus(): Observable<AppStatus> {
    return this.http.get<AppStatus>(`${API}/status`);
  }

  runDaily(): Observable<RunResult> {
    return this.http.post<RunResult>(`${API}/run/daily`, {});
  }

  runHourly(): Observable<RunResult> {
    return this.http.post<RunResult>(`${API}/run/hourly`, {});
  }

  getHistory(): Observable<HistoryEntry[]> {
    return this.http.get<HistoryEntry[]>(`${API}/history`);
  }

  getScheduler(): Observable<SchedulerConfig> {
    return this.http.get<SchedulerConfig>(`${API}/scheduler`);
  }

  updateScheduler(config: Partial<SchedulerConfig>): Observable<SchedulerConfig> {
    return this.http.put<SchedulerConfig>(`${API}/scheduler`, config);
  }
}
