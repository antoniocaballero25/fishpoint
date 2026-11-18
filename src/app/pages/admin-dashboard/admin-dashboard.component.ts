import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../services/auth.service';
import { TournamentService } from '../../services/tournament.service';
import { ExcelService } from '../../services/excel';
import {
  RankedParticipant,
  SpecialAward,
  Tournament,
  UserProfile,
} from '../../models/fishpoint.models';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatToolbarModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTabsModule,
    MatSnackBarModule,
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent implements OnInit {
  tournaments: Tournament[] = [];
  selectedTournament: Tournament | null = null;
  participants: RankedParticipant[] = [];
  judges: UserProfile[] = [];
  awards: SpecialAward[] = [];

  newPartName = '';
  newPartPesquil: number | null = null;
  newPartZone: string | null = null;

  newJudgeUser = '';
  newJudgePass = '';
  newJudgeZone: string | null = null;

  newAwardName = '';
  newAwardBg = '#D35400';
  newAwardColor = '#FFFFFF';

  constructor(
    private tournamentService: TournamentService,
    private excelService: ExcelService,
    private auth: AuthService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadTournaments();
  }

  async loadTournaments(): Promise<void> {
    try {
      this.tournaments = await this.tournamentService.getAllTournaments();
      if (this.tournaments.length > 0 && !this.selectedTournament) {
        await this.selectTournament(this.tournaments[0]);
      }
    } finally {
      this.cdr.detectChanges();
    }
  }

  async selectTournament(t: Tournament): Promise<void> {
    this.selectedTournament = { ...t };
    const [full, judgesList] = await Promise.all([
      this.tournamentService.getTournamentFullData(t.slug),
      this.tournamentService.getJudgesByTournament(t.id),
    ]);
    this.participants = full.leaderboard;
    this.awards = full.awards;
    this.judges = judgesList;
    this.cdr.detectChanges();
  }

  async toggleStatus(t: Tournament): Promise<void> {
    const nextStatus = t.status === 'activo' ? 'finalizado' : 'activo';
    await this.tournamentService.updateTournament(t.id, { status: nextStatus });
    this.snackBar.open(`Concurso marcado como ${nextStatus}`, 'OK', { duration: 2500 });
    await this.loadTournaments();
  }

  async deleteTournament(t: Tournament): Promise<void> {
    if (!confirm(`¿Seguro que deseas ELIMINAR por completo "${t.name}" y todos sus datos?`)) return;
    await this.tournamentService.deleteTournament(t.id);
    if (this.selectedTournament?.id === t.id) {
      this.selectedTournament = null;
    }
    this.snackBar.open('Concurso eliminado', 'OK', { duration: 3000 });
    await this.loadTournaments();
  }

  async addParticipant(): Promise<void> {
    if (!this.selectedTournament || !this.newPartName.trim()) return;
    await this.tournamentService.upsertParticipant({
      tournament_id: this.selectedTournament.id,
      names: this.newPartName.trim(),
      pesquil: this.newPartPesquil,
      zone: this.newPartZone,
    });
    this.newPartName = '';
    this.newPartPesquil = null;
    await this.selectTournament(this.selectedTournament);
  }

  async importMoreExcel(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!this.selectedTournament || !input.files?.length) return;
    const rows = await this.excelService.parseParticipantsFile(input.files[0]);
    await this.tournamentService.insertParticipantsBulk(this.selectedTournament.id, rows);
    this.snackBar.open(`${rows.length} participantes importados`, 'OK', { duration: 3000 });
    await this.selectTournament(this.selectedTournament);
  }

  async saveParticipantRow(p: RankedParticipant): Promise<void> {
    if (!this.selectedTournament) return;
    await this.tournamentService.upsertParticipant({
      id: p.id,
      tournament_id: this.selectedTournament.id,
      names: p.names,
      pesquil: p.pesquil,
      zone: p.zone,
    });
    this.snackBar.open('Participante actualizado', 'OK', { duration: 2000 });
  }

  async removeParticipant(id: string): Promise<void> {
    if (!this.selectedTournament || !confirm('¿Eliminar este participante?')) return;
    await this.tournamentService.deleteParticipant(id);
    await this.selectTournament(this.selectedTournament);
  }

  async addJudge(): Promise<void> {
    if (!this.selectedTournament || !this.newJudgeUser.trim() || this.newJudgePass.length < 6) {
      this.snackBar.open('Usuario obligatorio y contraseña mínimo 6 caracteres', 'Cerrar', {
        duration: 3500,
      });
      return;
    }
    try {
      await this.tournamentService.createJudge(
        this.newJudgeUser,
        this.newJudgePass,
        this.selectedTournament.id,
        this.newJudgeZone,
      );
      this.newJudgeUser = '';
      this.newJudgePass = '';
      this.snackBar.open('Juez creado', 'OK', { duration: 2500 });
      await this.selectTournament(this.selectedTournament);
    } catch (err: any) {
      this.snackBar.open(err.message, 'Cerrar', { duration: 4000 });
    }
  }

  async resetPassword(judge: UserProfile): Promise<void> {
    const newPass = prompt(`Nueva contraseña para ${judge.username} (mínimo 6 caracteres):`);
    if (!newPass || newPass.length < 6) return;
    await this.tournamentService.resetJudgePassword(judge.id, newPass);
    this.snackBar.open('Contraseña actualizada correctamente', 'OK', { duration: 3000 });
  }

  async removeJudge(judgeId: string): Promise<void> {
    if (!this.selectedTournament || !confirm('¿Eliminar esta cuenta de juez?')) return;
    await this.tournamentService.deleteJudge(judgeId);
    await this.selectTournament(this.selectedTournament);
  }

  async addAward(): Promise<void> {
    if (!this.selectedTournament || !this.newAwardName.trim()) return;
    await this.tournamentService.addSpecialAward({
      tournament_id: this.selectedTournament.id,
      name: this.newAwardName.trim(),
      bg_color: this.newAwardBg,
      text_color: this.newAwardColor,
      sort_order: this.awards.length,
    });
    this.newAwardName = '';
    await this.selectTournament(this.selectedTournament);
  }

  async removeAward(id: string): Promise<void> {
    if (!this.selectedTournament) return;
    await this.tournamentService.deleteSpecialAward(id);
    await this.selectTournament(this.selectedTournament);
  }

  async saveTournamentDetails(): Promise<void> {
    if (!this.selectedTournament) return;
    await this.tournamentService.updateTournament(this.selectedTournament.id, {
      name: this.selectedTournament.name,
      min_weight: Number(this.selectedTournament.min_weight),
    });
    this.snackBar.open('Datos guardados', 'OK', { duration: 2500 });
    await this.loadTournaments();
  }

  async replaceLogo(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!this.selectedTournament || !input.files?.length) return;
    const url = await this.tournamentService.uploadOptimizedImage(
      input.files[0],
      `logos/${this.selectedTournament.slug}`,
      600,
    );
    await this.tournamentService.updateTournament(this.selectedTournament.id, { logo_url: url });
    this.selectedTournament.logo_url = url;
    this.snackBar.open('Logo actualizado', 'OK', { duration: 2500 });
  }

  async addMoreBanners(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!this.selectedTournament || !input.files?.length) return;
    const newUrls = [...this.selectedTournament.sponsor_banners];
    for (const f of Array.from(input.files)) {
      const url = await this.tournamentService.uploadOptimizedImage(
        f,
        `sponsors/${this.selectedTournament.slug}`,
        1200,
      );
      newUrls.push(url);
    }
    await this.tournamentService.updateTournament(this.selectedTournament.id, {
      sponsor_banners: newUrls,
    });
    this.selectedTournament.sponsor_banners = newUrls;
    this.snackBar.open('Banners añadidos al carrusel', 'OK', { duration: 2500 });
  }

  async removeBanner(index: number): Promise<void> {
    if (!this.selectedTournament) return;
    const updated = this.selectedTournament.sponsor_banners.filter((_, i) => i !== index);
    await this.tournamentService.updateTournament(this.selectedTournament.id, {
      sponsor_banners: updated,
    });
    this.selectedTournament.sponsor_banners = updated;
  }

  logout(): void {
    this.auth.logout();
  }
}
