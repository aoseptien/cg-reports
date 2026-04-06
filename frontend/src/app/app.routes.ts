import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  {
    path: 'schedule',
    loadComponent: () =>
      import('./schedule/schedule.component').then(m => m.ScheduleComponent),
  },
  {
    path: 'history',
    loadComponent: () =>
      import('./history/history.component').then(m => m.HistoryComponent),
  },
  { path: '**', redirectTo: '' },
];
