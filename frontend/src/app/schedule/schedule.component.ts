import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ReportsService, SchedulerConfig } from '../services/reports.service';

interface DayOption {
  value: number;
  label: string;
  shortLabel: string;
}

@Component({
  selector: 'app-schedule',
  imports: [FormsModule, DatePipe],
  templateUrl: './schedule.component.html',
  styleUrl: './schedule.component.scss',
})
export class ScheduleComponent implements OnInit {
  private reportsService = inject(ReportsService);

  loading = signal(true);
  saving = signal(false);
  message = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  enabled = signal(false);
  workDays = signal<Set<number>>(new Set([1, 2, 3, 4, 5]));
  holidays = signal<string[]>([]);
  dailyHour = signal(9);
  hourlyHours = signal<Set<number>>(new Set([13, 14, 15, 16, 17]));
  newHoliday = signal('');

  // Next runs from API
  nextDailyRun = signal<string | null>(null);
  nextHourlyRun = signal<string | null>(null);

  readonly dayOptions: DayOption[] = [
    { value: 0, label: 'Sunday', shortLabel: 'Sun' },
    { value: 1, label: 'Monday', shortLabel: 'Mon' },
    { value: 2, label: 'Tuesday', shortLabel: 'Tue' },
    { value: 3, label: 'Wednesday', shortLabel: 'Wed' },
    { value: 4, label: 'Thursday', shortLabel: 'Thu' },
    { value: 5, label: 'Friday', shortLabel: 'Fri' },
    { value: 6, label: 'Saturday', shortLabel: 'Sat' },
  ];

  readonly hourOptions = Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: this.formatHour(i),
  }));

  readonly allHours = Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: this.formatHour(i),
  }));

  readonly sortedHolidays = computed(() =>
    [...this.holidays()].sort((a, b) => a.localeCompare(b))
  );

  readonly sortedHourlyHours = computed(() =>
    [...this.hourlyHours()].sort((a, b) => a - b)
  );

  ngOnInit(): void {
    this.loadScheduler();
  }

  private loadScheduler(): void {
    this.reportsService.getScheduler().subscribe({
      next: config => {
        this.applyConfig(config);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private applyConfig(config: SchedulerConfig): void {
    this.enabled.set(config.enabled);
    this.workDays.set(new Set(config.workDays));
    this.holidays.set(config.holidays ?? []);
    this.dailyHour.set(config.dailyHour ?? 9);
    this.hourlyHours.set(new Set(config.hourlyHours ?? [13, 14, 15, 16, 17]));
    this.nextDailyRun.set(config.nextDailyRun ?? null);
    this.nextHourlyRun.set(config.nextHourlyRun ?? null);
  }

  toggleEnabled(): void {
    this.enabled.update(v => !v);
  }

  toggleDay(day: number): void {
    this.workDays.update(days => {
      const next = new Set(days);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  isDaySelected(day: number): boolean {
    return this.workDays().has(day);
  }

  toggleHourlyHour(hour: number): void {
    this.hourlyHours.update(hours => {
      const next = new Set(hours);
      if (next.has(hour)) next.delete(hour);
      else next.add(hour);
      return next;
    });
  }

  isHourSelected(hour: number): boolean {
    return this.hourlyHours().has(hour);
  }

  addHoliday(): void {
    const date = this.newHoliday().trim();
    if (!date) return;
    if (this.holidays().includes(date)) {
      this.newHoliday.set('');
      return;
    }
    this.holidays.update(h => [...h, date]);
    this.newHoliday.set('');
  }

  removeHoliday(date: string): void {
    this.holidays.update(h => h.filter(d => d !== date));
  }

  setNewHoliday(value: string): void {
    this.newHoliday.set(value);
  }

  setDailyHour(value: number): void {
    this.dailyHour.set(Number(value));
  }

  save(): void {
    this.saving.set(true);
    this.message.set(null);

    const config: Partial<SchedulerConfig> = {
      enabled: this.enabled(),
      workDays: [...this.workDays()].sort(),
      holidays: this.holidays(),
      dailyHour: this.dailyHour(),
      hourlyHours: [...this.hourlyHours()].sort(),
    };

    this.reportsService.updateScheduler(config).subscribe({
      next: updated => {
        this.applyConfig(updated);
        this.saving.set(false);
        this.message.set({ type: 'success', text: 'Scheduler configuration saved successfully.' });
        setTimeout(() => this.message.set(null), 5000);
      },
      error: err => {
        this.saving.set(false);
        this.message.set({
          type: 'error',
          text: err?.error?.message || 'Failed to save configuration.',
        });
        setTimeout(() => this.message.set(null), 6000);
      },
    });
  }

  formatHour(h: number): string {
    if (h === 0) return '12:00 AM';
    if (h === 12) return '12:00 PM';
    return h < 12 ? `${h}:00 AM` : `${h - 12}:00 PM`;
  }

  formatHolidayDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
}
