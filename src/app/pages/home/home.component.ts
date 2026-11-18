import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TournamentService } from '../../services/tournament.service'; // o '../../services/tournament.service' según tu archivo
import { Tournament } from '../../models/fishpoint.models';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  loading = true;
  activeTournaments: Tournament[] = [];
  finishedTournaments: Tournament[] = [];
  currentYear = new Date().getFullYear();

  constructor(
    private tournamentService: TournamentService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const all = await this.tournamentService.getAllTournaments();
      this.activeTournaments = all.filter((t) => t.status === 'activo');
      this.finishedTournaments = all.filter((t) => t.status === 'finalizado');
    } catch (error) {
      console.error('Error cargando concursos desde Supabase:', error);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }
}
