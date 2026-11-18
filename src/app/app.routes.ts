import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';
import { AdminDashboardComponent } from './pages/admin-dashboard/admin-dashboard.component';
import { TournamentWizardComponent } from './pages/tournament-wizard/tournament-wizard.component';
import { PublicLeaderboardComponent } from './pages/public-leaderboard/public-leaderboard.component';
import { JudgePanelComponent } from './pages/judge-panel/judge-panel.component';
import { judgeOrAdminGuard, superAdminGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'admin', component: AdminDashboardComponent, canActivate: [superAdminGuard] },
  { path: 'admin/nuevo', component: TournamentWizardComponent, canActivate: [superAdminGuard] },
  { path: ':slug/juez', component: JudgePanelComponent, canActivate: [judgeOrAdminGuard] },
  { path: ':slug', component: PublicLeaderboardComponent },
  { path: '**', redirectTo: '' },
];
