import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { ReportsService, AppStatus } from '../services/reports.service';
import { interval, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, NgClass],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private reportsService = inject(ReportsService);

  status = signal<AppStatus | null>(null);
  loading = signal(true);
  runningDaily = signal(false);
  runningHourly = signal(false);
  lastMessage = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  private refreshSub?: Subscription;

  readonly isRunning = computed(() => this.status()?.running ?? false);
  readonly isOnline = computed(() => this.status()?.online ?? false);
  readonly hasAuth = computed(() => this.status()?.googleAuth ?? false);

  ngOnInit(): void {
    this.loadStatus();
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

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
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

  runDaily(): void {
    if (this.runningDaily() || this.isRunning()) return;
    this.runningDaily.set(true);
    this.lastMessage.set(null);
    this.reportsService.runDaily().subscribe({
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

  refresh(): void {
    this.loading.set(true);
    this.loadStatus();
  }
}
