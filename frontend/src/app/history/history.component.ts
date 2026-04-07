import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportsService, HistoryEntry } from '../services/reports.service';

type FilterType = 'all' | 'daily' | 'hourly';

@Component({
  selector: 'app-history',
  imports: [DatePipe, FormsModule],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent implements OnInit {
  private reportsService = inject(ReportsService);

  history = signal<HistoryEntry[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  filter = signal<FilterType>('all');
  expandedId = signal<string | null>(null);
  selectedIds = signal<Set<string>>(new Set());
  deleting = signal(false);

  readonly filtered = computed(() => {
    const f = this.filter();
    const all = this.history();
    if (f === 'all') return all;
    return all.filter(e => e.type === f);
  });

  readonly dailyCount = computed(() => this.history().filter(e => e.type === 'daily').length);
  readonly hourlyCount = computed(() => this.history().filter(e => e.type === 'hourly').length);
  readonly successCount = computed(() => this.history().filter(e => e.status === 'success').length);
  readonly errorCount = computed(() => this.history().filter(e => e.status === 'error').length);
  readonly runningCount = computed(() => this.history().filter(e => e.status === 'running').length);
  readonly selectedCount = computed(() => this.selectedIds().size);

  readonly allFilteredSelected = computed(() => {
    const ids = this.selectedIds();
    const list = this.filtered();
    return list.length > 0 && list.every(e => ids.has(e.id));
  });

  ngOnInit(): void {
    this.loadHistory();
  }

  loadHistory(): void {
    this.loading.set(true);
    this.error.set(null);
    this.selectedIds.set(new Set());
    this.reportsService.getHistory().subscribe({
      next: data => {
        const sorted = [...data].sort((a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
        );
        this.history.set(sorted);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err?.error?.message || 'Failed to load history.');
        this.loading.set(false);
      },
    });
  }

  setFilter(f: FilterType): void {
    this.filter.set(f);
    this.selectedIds.set(new Set());
  }

  toggleExpand(id: string): void {
    this.expandedId.update(current => (current === id ? null : id));
  }

  isExpanded(id: string): boolean {
    return this.expandedId() === id;
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelect(id: string, event?: Event): void {
    event?.stopPropagation();
    const current = new Set(this.selectedIds());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.selectedIds.set(current);
  }

  toggleSelectAll(): void {
    const list = this.filtered();
    if (this.allFilteredSelected()) {
      this.selectedIds.set(new Set());
    } else {
      this.selectedIds.set(new Set(list.map(e => e.id)));
    }
  }

  deleteSelected(): void {
    const ids = [...this.selectedIds()];
    if (!ids.length) return;
    this.deleting.set(true);
    this.reportsService.deleteHistoryEntries(ids).subscribe({
      next: () => {
        this.deleting.set(false);
        this.loadHistory();
      },
      error: () => this.deleting.set(false),
    });
  }

  deleteAll(): void {
    this.deleting.set(true);
    this.reportsService.deleteAllHistory().subscribe({
      next: () => {
        this.deleting.set(false);
        this.loadHistory();
      },
      error: () => this.deleting.set(false),
    });
  }

  formatDuration(ms: number | null): string {
    if (ms === null || ms === undefined) return '—';
    if (ms < 1000) return `${ms}ms`;
    const secs = Math.floor(ms / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return remSecs > 0 ? `${mins}m ${remSecs}s` : `${mins}m`;
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'success': return '✅ Success';
      case 'error': return '❌ Error';
      case 'running': return '🔄 Running';
      default: return status;
    }
  }

  statusBadgeClass(status: string): string {
    switch (status) {
      case 'success': return 'badge badge-success';
      case 'error': return 'badge badge-error';
      case 'running': return 'badge badge-running';
      default: return 'badge badge-neutral';
    }
  }

  typeIcon(type: string): string {
    return type === 'daily' ? '📊' : '⏰';
  }

  typeLabel(type: string): string {
    return type === 'daily' ? 'Daily' : 'Hourly';
  }
}
