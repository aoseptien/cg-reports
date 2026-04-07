import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  AfterViewChecked,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, NgClass } from '@angular/common';
import { ReportsService, AppStatus, CoordinatorsData } from '../services/reports.service';
import { interval, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, NgClass, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('logBody') private logBody!: ElementRef<HTMLDivElement>;
  private reportsService = inject(ReportsService);
  private shouldScrollLog = false;

  status = signal<AppStatus | null>(null);
  loading = signal(true);
  runningDaily = signal(false);
  runningHourly = signal(false);
  lastMessage = signal<{ type: 'success' | 'error'; text: string } | null>(null);
  dailyReportDate = signal<string>(this.getYesterdayDate());
  dateMode = signal<'today' | 'yesterday' | 'custom'>('yesterday');

  // Live log
  logs = signal<{ ts: string; level: string; message: string }[]>([]);
  logCopied = signal(false);
  logCleared = signal(false);
  private logSub?: Subscription;

  // Attendance panel
  // Estado por coordinadora: 'present' | 'leftEarly' | 'absentAllDay'
  coordinators = signal<string[]>([]);
  coordinatorStatus = signal<Record<string, 'present' | 'leftEarly' | 'absentAllDay'>>({});
  attendanceOpen = signal(false);
  attendanceLoading = signal(false);
  attendanceSaving = signal(false);

  private refreshSub?: Subscription;

  readonly isRunning = computed(() => this.status()?.running ?? false);
  readonly isOnline = computed(() => this.status()?.online ?? false);
  readonly hasAuth = computed(() => this.status()?.googleAuth ?? false);

  ngOnInit(): void {
    this.loadStatus();
    this.loadLogs();
    // Poll logs every 2 seconds
    this.logSub = interval(2000)
      .pipe(switchMap(() => this.reportsService.getLogs()))
      .subscribe({ next: logs => { this.logs.set(logs); this.shouldScrollLog = true; } });
    // Auto-refresh every 10 seconds
    this.refreshSub = interval(10000)
      .pipe(switchMap(() => this.reportsService.getStatus()))
      .subscribe({
        next: s => {
          this.status.set(s);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollLog && this.logBody?.nativeElement) {
      const el = this.logBody.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.shouldScrollLog = false;
    }
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
    this.logSub?.unsubscribe();
  }

  private loadStatus(): void {
    this.reportsService.getStatus().subscribe({
      next: s => {
        this.status.set(s);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  getYesterdayDate(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }

  setDateMode(mode: 'today' | 'yesterday' | 'custom'): void {
    this.dateMode.set(mode);
    if (mode === 'today') this.dailyReportDate.set(this.getTodayDate());
    if (mode === 'yesterday') this.dailyReportDate.set(this.getYesterdayDate());
  }

  formatSelectedDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  runDaily(): void {
    if (this.runningDaily() || this.isRunning()) return;
    this.runningDaily.set(true);
    this.lastMessage.set(null);
    this.reportsService.runDaily(this.dailyReportDate()).subscribe({
      next: result => {
        this.runningDaily.set(false);
        this.lastMessage.set({
          type: 'success',
          text: result.message || 'Daily report started successfully.',
        });
        this.loadStatus();
        setTimeout(() => this.lastMessage.set(null), 6000);
      },
      error: err => {
        this.runningDaily.set(false);
        this.lastMessage.set({
          type: 'error',
          text: err?.error?.message || 'Failed to start daily report.',
        });
        setTimeout(() => this.lastMessage.set(null), 6000);
      },
    });
  }

  runHourly(): void {
    if (this.runningHourly() || this.isRunning()) return;
    this.runningHourly.set(true);
    this.lastMessage.set(null);
    this.reportsService.runHourly().subscribe({
      next: result => {
        this.runningHourly.set(false);
        this.lastMessage.set({
          type: 'success',
          text: result.message || 'Hourly report started successfully.',
        });
        this.loadStatus();
        setTimeout(() => this.lastMessage.set(null), 6000);
      },
      error: err => {
        this.runningHourly.set(false);
        this.lastMessage.set({
          type: 'error',
          text: err?.error?.message || 'Failed to start hourly report.',
        });
        setTimeout(() => this.lastMessage.set(null), 6000);
      },
    });
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays}d ago`;
  }

  stopReport(): void {
    this.reportsService.stopReport().subscribe({
      next: () => {
        this.runningDaily.set(false);
        this.runningHourly.set(false);
        this.loadStatus();
        this.lastMessage.set({ type: 'success', text: 'Report stopped.' });
        setTimeout(() => this.lastMessage.set(null), 4000);
      },
    });
  }

  refresh(): void {
    this.loading.set(true);
    this.loadStatus();
  }

  private loadLogs(): void {
    this.reportsService.getLogs().subscribe({ next: logs => this.logs.set(logs) });
  }

  logClass(level: string): string {
    if (level === 'ERROR') return 'log-error';
    if (level === 'WARN') return 'log-warn';
    if (level.includes('✅')) return 'log-success';
    return 'log-info';
  }

  copyLog(): void {
    const text = this.logs()
      .map(e => `[${this.formatLogTime(e.ts)}] ${e.level.padEnd(5)} ${e.message}`)
      .join('\n');
    navigator.clipboard.writeText(text).then(() => {
      this.logCopied.set(true);
      setTimeout(() => this.logCopied.set(false), 2500);
    });
  }

  clearLog(): void {
    this.reportsService.clearLogs().subscribe({
      next: () => {
        this.logs.set([]);
        this.logCleared.set(true);
        setTimeout(() => this.logCleared.set(false), 2000);
      },
    });
  }

  formatLogTime(ts: string): string {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  // ── Attendance ──────────────────────────────────────────────────────

  toggleAttendancePanel(): void {
    const opening = !this.attendanceOpen();
    this.attendanceOpen.set(opening);
    if (opening && this.coordinators().length === 0) {
      this.loadCoordinators();
    }
  }

  loadCoordinators(): void {
    this.attendanceLoading.set(true);
    this.reportsService.getCoordinators().subscribe({
      next: (data: CoordinatorsData) => {
        this.coordinators.set(data.coordinators);
        const statusMap: Record<string, 'present' | 'leftEarly' | 'absentAllDay'> = {};
        for (const name of data.coordinators) {
          if (data.absentAllDay.includes(name)) statusMap[name] = 'absentAllDay';
          else if (data.leftEarly.includes(name)) statusMap[name] = 'leftEarly';
          else statusMap[name] = 'present';
        }
        this.coordinatorStatus.set(statusMap);
        this.attendanceLoading.set(false);
      },
      error: () => this.attendanceLoading.set(false),
    });
  }

  getStatus(name: string): 'present' | 'leftEarly' | 'absentAllDay' {
    return this.coordinatorStatus()[name] ?? 'present';
  }

  setStatus(name: string, status: 'present' | 'leftEarly' | 'absentAllDay'): void {
    this.coordinatorStatus.set({ ...this.coordinatorStatus(), [name]: status });
  }

  resetAllPresent(): void {
    const updated: Record<string, 'present' | 'leftEarly' | 'absentAllDay'> = {};
    for (const name of this.coordinators()) updated[name] = 'present';
    this.coordinatorStatus.set(updated);
  }

  presentCount(): number {
    return this.coordinators().filter(n => this.getStatus(n) === 'present').length;
  }

  leftEarlyCount(): number {
    return this.coordinators().filter(n => this.getStatus(n) === 'leftEarly').length;
  }

  absentAllDayCount(): number {
    return this.coordinators().filter(n => this.getStatus(n) === 'absentAllDay').length;
  }

  saveAttendance(): void {
    this.attendanceSaving.set(true);
    const absentAllDay = this.coordinators().filter(n => this.getStatus(n) === 'absentAllDay');
    const leftEarly = this.coordinators().filter(n => this.getStatus(n) === 'leftEarly');
    this.reportsService.saveAttendance(absentAllDay, leftEarly).subscribe({
      next: () => {
        this.attendanceSaving.set(false);
        const parts: string[] = [];
        if (this.presentCount()) parts.push(`${this.presentCount()} present`);
        if (this.leftEarlyCount()) parts.push(`${this.leftEarlyCount()} left early`);
        if (this.absentAllDayCount()) parts.push(`${this.absentAllDayCount()} absent`);
        this.lastMessage.set({ type: 'success', text: `Attendance saved: ${parts.join(', ')}.` });
        setTimeout(() => this.lastMessage.set(null), 5000);
      },
      error: () => {
        this.attendanceSaving.set(false);
        this.lastMessage.set({ type: 'error', text: 'Failed to save attendance.' });
        setTimeout(() => this.lastMessage.set(null), 5000);
      },
    });
  }
}
