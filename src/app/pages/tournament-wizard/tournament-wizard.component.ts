import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TournamentService } from '../../services/tournament.service';
import { ExcelService } from '../../services/excel';
import {
  ExcelParticipantInput,
  ModalityType,
  NewAwardInput,
  NewJudgeInput,
} from '../../models/fishpoint.models';

@Component({
  selector: 'app-tournament-wizard',
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
    MatRadioModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
  ],
  templateUrl: './tournament-wizard.component.html',
  styleUrl: './tournament-wizard.component.scss',
})
export class TournamentWizardComponent {
  modality: ModalityType = 'carpa';
  hasZones = false;
  zones: string[] = [];
  newZoneName = '';

  fishLimitMode: 'limited' | 'all' = 'limited';
  maxFishes = 5;
  minWeight = 2.0;

  name = '';
  slug = '';
  location = '';
  startDate = '';
  endDate = '';

  logoFile: File | null = null;
  sponsorFiles: File[] = [];

  newAwardName = '';
  newAwardBg = '#D35400';
  newAwardColor = '#FFFFFF';
  awards: NewAwardInput[] = [];

  parsedParticipants: ExcelParticipantInput[] = [];

  judgeCount = 0;
  judges: NewJudgeInput[] = [];

  creating = false;

  constructor(
    private tournamentService: TournamentService,
    private excelService: ExcelService,
    private snackBar: MatSnackBar,
    private router: Router,
  ) {}

  addZone(): void {
    const clean = this.newZoneName.trim();
    if (!clean || this.zones.includes(clean)) return;
    this.zones.push(clean);
    this.newZoneName = '';
  }

  removeZone(index: number): void {
    this.zones.splice(index, 1);
  }

  autoGenerateSlug(): void {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.logoFile = input.files[0];
    }
  }

  onSponsorsSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.sponsorFiles = Array.from(input.files);
    }
  }

  addAward(): void {
    const clean = this.newAwardName.trim();
    if (!clean) return;
    this.awards.push({
      name: clean,
      bg_color: this.newAwardBg,
      text_color: this.newAwardColor,
    });
    this.newAwardName = '';
  }

  removeAward(index: number): void {
    this.awards.splice(index, 1);
  }

  async onExcelSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    try {
      this.parsedParticipants = await this.excelService.parseParticipantsFile(input.files[0]);
      this.snackBar.open(`${this.parsedParticipants.length} participantes cargados`, 'OK', {
        duration: 3000,
      });
    } catch {
      this.snackBar.open('Error leyendo el archivo Excel', 'Cerrar', { duration: 4000 });
    }
  }

  syncJudgesArray(): void {
    const count = Math.max(0, Math.min(30, Number(this.judgeCount) || 0));
    while (this.judges.length < count) {
      this.judges.push({ username: '', password: '', assigned_zone: null });
    }
    if (this.judges.length > count) {
      this.judges.length = count;
    }
  }

  async createTournament(): Promise<void> {
    if (!this.name.trim() || !this.slug.trim()) {
      this.snackBar.open('Debes indicar el nombre y el enlace web del concurso.', 'Cerrar', {
        duration: 4000,
      });
      return;
    }

    if (this.hasZones && this.zones.length === 0) {
      this.snackBar.open(
        'Has marcado concurso por zonas pero no has añadido ninguna zona.',
        'Cerrar',
        { duration: 4000 },
      );
      return;
    }

    for (const j of this.judges) {
      if (!j.username.trim() || j.password.length < 6) {
        this.snackBar.open(
          'Cada juez debe tener un usuario y una contraseña de al menos 6 caracteres.',
          'Cerrar',
          { duration: 4000 },
        );
        return;
      }
    }

    this.creating = true;

    try {
      const cleanSlug = this.slug
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]+/g, '-');

      await this.tournamentService.createTournamentWizard({
        tournament: {
          slug: cleanSlug,
          name: this.name.trim(),
          modality: this.modality,
          location: this.location.trim() || null,
          start_date: this.startDate || null,
          end_date: this.endDate || null,
          status: 'activo',
          has_zones: this.hasZones,
          zones: this.hasZones ? this.zones : [],
          max_fishes: this.fishLimitMode === 'limited' ? Number(this.maxFishes) : null,
          min_weight: Number(this.minWeight) || 0,
        },
        logoFile: this.logoFile,
        sponsorFiles: this.sponsorFiles,
        awards: this.awards,
        participants: this.parsedParticipants,
        judges: this.judges,
      });

      this.snackBar.open('¡Concurso creado y publicado correctamente!', 'OK', { duration: 4000 });
      this.router.navigate(['/admin']);
    } catch (err: any) {
      this.snackBar.open(err.message || 'Error al crear el concurso', 'Cerrar', { duration: 5000 });
    } finally {
      this.creating = false;
    }
  }
}
