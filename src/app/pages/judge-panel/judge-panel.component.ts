import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../services/auth.service';
import { TournamentService } from '../../services/tournament.service';
import {
  RankedParticipant,
  SpecialAward,
  Tournament,
  UserProfile,
} from '../../models/fishpoint.models';

@Component({
  selector: 'app-judge-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatToolbarModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
  ],
  templateUrl: './judge-panel.component.html',
  styleUrl: './judge-panel.component.scss',
})
export class JudgePanelComponent implements OnInit {
  slug = '';
  profile: UserProfile | null = null;
  tournament: Tournament | null = null;
  awards: SpecialAward[] = [];
  allParticipants: RankedParticipant[] = [];
  allowedParticipants: RankedParticipant[] = [];

  selectedParticipantId = '';
  weight: number | null = null;
  selectedAwardId: string | null = null;
  selectedPhoto: File | null = null;

  saving = false;
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private auth: AuthService,
    private tournamentService: TournamentService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
  ) {}

  get currentSelectedParticipant(): RankedParticipant | undefined {
    return this.allowedParticipants.find((p) => p.id === this.selectedParticipantId);
  }

  async ngOnInit(): Promise<void> {
    this.slug = this.route.snapshot.paramMap.get('slug') || '';
    this.profile = await this.auth.initSession();
    await this.loadTournamentData();
  }

  async loadTournamentData(): Promise<void> {
    if (!this.slug) return;
    try {
      const data = await this.tournamentService.getTournamentFullData(this.slug);
      this.tournament = data.tournament;
      this.awards = data.awards;
      this.allParticipants = data.leaderboard.sort(
        (a, b) => (a.pesquil ?? 9999) - (b.pesquil ?? 9999),
      );

      if (this.profile?.role === 'judge' && this.profile.assigned_zone) {
        this.allowedParticipants = this.allParticipants.filter(
          (p) => p.zone === this.profile?.assigned_zone,
        );
      } else {
        this.allowedParticipants = [...this.allParticipants];
      }
    } finally {
      this.cdr.detectChanges();
    }
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedPhoto = input.files[0];
    }
  }

  async submitCatch(): Promise<void> {
    if (!this.tournament || !this.selectedParticipantId || !this.weight || this.weight <= 0) {
      this.errorMessage = 'Selecciona un participante e introduce un peso válido.';
      this.cdr.detectChanges();
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    try {
      await this.tournamentService.addCatch({
        tournamentId: this.tournament.id,
        participantId: this.selectedParticipantId,
        weight: Number(this.weight),
        specialAwardId: this.selectedAwardId,
        photoFile: this.selectedPhoto,
      });

      this.snackBar.open('Pesaje registrado correctamente', 'OK', { duration: 3000 });
      this.weight = null;
      this.selectedAwardId = null;
      this.selectedPhoto = null;
      await this.loadTournamentData();
    } catch (err: any) {
      this.errorMessage = err.message || 'No se pudo registrar la captura.';
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  async deleteCatch(catchId: string): Promise<void> {
    if (!confirm('¿Seguro que quieres eliminar esta captura?')) return;
    try {
      await this.tournamentService.deleteCatch(catchId);
      this.snackBar.open('Captura eliminada', 'OK', { duration: 2500 });
      await this.loadTournamentData();
    } catch (err: any) {
      this.snackBar.open(err.message || 'Error al eliminar', 'Cerrar', { duration: 4000 });
    }
  }

  logout(): void {
    this.auth.logout();
  }
}
