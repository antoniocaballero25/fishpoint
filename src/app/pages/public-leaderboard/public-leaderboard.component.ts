import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RealtimeChannel } from '@supabase/supabase-js';
import { TournamentService } from '../../services/tournament.service';
import { SupabaseService } from '../../services/supabase.service';
import {
  CatchRecord,
  RankedParticipant,
  SpecialAward,
  Tournament,
} from '../../models/fishpoint.models';
import {
  ParticipantDetailsDialogComponent,
  ParticipantDialogData,
} from '../../components/participant-details-dialog/participant-details-dialog.component';

export interface AwardWithWinner extends SpecialAward {
  winner?: {
    participant: RankedParticipant;
    catchItem: CatchRecord;
  };
}

@Component({
  selector: 'app-public-leaderboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatCardModule,
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatDialogModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './public-leaderboard.component.html',
  styleUrl: './public-leaderboard.component.scss',
})
export class PublicLeaderboardComponent implements OnInit, OnDestroy {
  loading = true;
  tournament: Tournament | null = null;
  awards: SpecialAward[] = [];
  fullLeaderboard: RankedParticipant[] = [];
  filteredLeaderboard: RankedParticipant[] = [];
  awardsWithWinners: AwardWithWinner[] = [];

  selectedZone = 'GENERAL';
  fishColumnIndices: number[] = [0, 1, 2, 3, 4];
  displayedColumns: string[] = [];

  currentBannerIndex = 0;
  bannerTimer: any;
  realtimeChannel: RealtimeChannel | null = null;
  currentYear = new Date().getFullYear();

  constructor(
    private route: ActivatedRoute,
    private tournamentService: TournamentService,
    private supabase: SupabaseService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }

    await this.loadData(slug);

    if (this.tournament) {
      this.startBannerRotation();
      this.subscribeToRealtime(this.tournament.id, slug);
    }
  }

  ngOnDestroy(): void {
    if (this.bannerTimer) clearInterval(this.bannerTimer);
    if (this.realtimeChannel) {
      this.supabase.client.removeChannel(this.realtimeChannel);
    }
  }

  async loadData(slug: string): Promise<void> {
    try {
      const data = await this.tournamentService.getTournamentFullData(slug);
      this.tournament = data.tournament;
      this.awards = data.awards;
      this.fullLeaderboard = data.leaderboard;

      const numFishCols = this.tournament.max_fishes ?? 5;
      this.fishColumnIndices = Array.from({ length: numFishCols }, (_, i) => i);

      const fishCols = this.fishColumnIndices.map((i) => `p${i + 1}`);
      if (this.tournament.max_fishes === null) {
        this.displayedColumns = ['pos', 'names', 'pesquil', ...fishCols, 'pieces', 'totalWeight'];
      } else {
        this.displayedColumns = ['pos', 'names', 'pesquil', ...fishCols, 'totalWeight'];
      }

      this.applyZoneFilter();
      this.computeAwardsWinners(data.catches);
    } catch (err) {
      console.error('Error cargando el concurso:', err);
      this.tournament = null;
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  subscribeToRealtime(tournamentId: string, slug: string): void {
    this.realtimeChannel = this.supabase.client
      .channel(`public-tournament-${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'catches',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => this.loadData(slug),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'participants',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => this.loadData(slug),
      )
      .subscribe();
  }

  selectZone(zone: string): void {
    this.selectedZone = zone;
    this.applyZoneFilter();
    this.cdr.detectChanges();
  }

  applyZoneFilter(): void {
    if (this.selectedZone === 'GENERAL') {
      this.filteredLeaderboard = [...this.fullLeaderboard];
    } else {
      this.filteredLeaderboard = this.fullLeaderboard.filter((p) => p.zone === this.selectedZone);
    }
  }

  computeAwardsWinners(catches: CatchRecord[]): void {
    this.awardsWithWinners = this.awards.map((award) => {
      const matchingCatches = catches
        .filter((c) => c.special_award_id === award.id)
        .sort((a, b) => Number(b.weight) - Number(a.weight));

      if (matchingCatches.length === 0) {
        return { ...award };
      }

      const topCatch = matchingCatches[0];
      const participant = this.fullLeaderboard.find((p) => p.id === topCatch.participant_id);

      if (!participant) {
        return { ...award };
      }

      return {
        ...award,
        winner: {
          participant,
          catchItem: topCatch,
        },
      };
    });
  }

  startBannerRotation(): void {
    if (!this.tournament || this.tournament.sponsor_banners.length <= 1) return;
    this.bannerTimer = setInterval(() => {
      if (!this.tournament) return;
      this.currentBannerIndex =
        (this.currentBannerIndex + 1) % this.tournament.sponsor_banners.length;
      this.cdr.detectChanges();
    }, 2800);
  }

  getMedal(index: number): string {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `${index + 1}`;
  }

  getAwardBg(awardId: string | null): string {
    if (!awardId) return '#e8f5e9';
    const found = this.awards.find((a) => a.id === awardId);
    return found ? found.bg_color : '#e8f5e9';
  }

  getAwardColor(awardId: string | null): string {
    if (!awardId) return '#2e7d32';
    const found = this.awards.find((a) => a.id === awardId);
    return found ? found.text_color : '#2e7d32';
  }

  openParticipantDetails(participant: RankedParticipant): void {
    this.dialog.open(ParticipantDetailsDialogComponent, {
      width: '500px',
      maxWidth: '95vw',
      data: {
        participant,
        awards: this.awards,
        onlyCatchId: null,
        awardBanner: null,
      } satisfies ParticipantDialogData,
    });
  }

  openAwardDetails(award: AwardWithWinner): void {
    if (!award.winner) return;
    this.dialog.open(ParticipantDetailsDialogComponent, {
      width: '500px',
      maxWidth: '95vw',
      data: {
        participant: award.winner.participant,
        awards: this.awards,
        onlyCatchId: award.winner.catchItem.id,
        awardBanner: award,
      } satisfies ParticipantDialogData,
    });
  }
}
