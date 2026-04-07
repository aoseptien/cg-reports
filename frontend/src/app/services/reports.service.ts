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

export interface CoordinatorsData {
  coordinators: string[];
  absentAllDay: string[];   // faltó todo el día → excluida de hourly Y daily
  leftEarly: string[];      // se fue a mitad → excluida de hourly, aparece en daily
}

// In dev (ng serve on :4200) the proxy forwards /api → localhost:3000
// In production (served from node on :3000) /api is on the same origin
const API = window.location.port === '4200' ? 'http://localhost:3000/api' : '/api';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private http = inject(HttpClient);

  getStatus(): Observable<AppStatus> {
    return this.http.get<AppStatus>(`${API}/status`);
  }

  runDaily(date?: string): Observable<RunResult> {
    return this.http.post<RunResult>(`${API}/run/daily`, { date: date || '' });
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

  getLogs(n = 80): Observable<{ ts: string; level: string; message: string }[]> {
    return this.http.get<{ ts: string; level: string; message: string }[]>(`${API}/logs?n=${n}`);
  }

  clearLogs(): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${API}/logs`);
  }

  stopReport(): Observable<{ success: boolean; stopped: string[] }> {
    return this.http.post<{ success: boolean; stopped: string[] }>(`${API}/run/stop`, {});
  }

  getCoordinators(): Observable<CoordinatorsData> {
    return this.http.get<CoordinatorsData>(`${API}/coordinators`);
  }

  saveAttendance(absentAllDay: string[], leftEarly: string[]): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(`${API}/coordinators/attendance`, { absentAllDay, leftEarly });
  }

  deleteHistoryEntries(ids: string[]): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${API}/history/delete`, { ids });
  }

  deleteAllHistory(): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${API}/history/delete`, {});
  }
}
