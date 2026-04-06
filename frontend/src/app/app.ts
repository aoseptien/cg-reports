import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { ReportsService, AppStatus } from './services/reports.service';
import { interval, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit, OnDestroy {
  private reportsService = inject(ReportsService);

  status = signal<AppStatus | null>(null);
  private statusSub?: Subscription;

  readonly navLinks = [
    { path: '/', label: 'Dashboard', icon: '📊', exact: true },
    { path: '/schedule', label: 'Schedule', icon: '📅', exact: false },
    { path: '/history', label: 'History', icon: '📋', exact: false },
  ];

  ngOnInit(): void {
    this.loadStatus();
    // Refresh status every 15 seconds
    this.statusSub = interval(15000).pipe(
      switchMap(() => this.reportsService.getStatus())
    ).subscribe(s => this.status.set(s));
  }

  ngOnDestroy(): void {
    this.statusSub?.unsubscribe();
  }

  private loadStatus(): void {
    this.reportsService.getStatus().subscribe({
      next: s => this.status.set(s),
      error: () => this.status.set(null)
    });
  }
}
