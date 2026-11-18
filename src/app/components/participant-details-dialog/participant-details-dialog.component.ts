import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CatchRecord, RankedParticipant, SpecialAward } from '../../models/fishpoint.models';

export interface AwardBannerInfo {
  name: string;
  bg_color: string;
  text_color: string;
}

export interface ParticipantDialogData {
  participant: RankedParticipant;
  awards: SpecialAward[];
  onlyCatchId: string | null;
  awardBanner: AwardBannerInfo | null;
}

@Component({
  selector: 'app-participant-details-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, MatButtonModule],
  templateUrl: './participant-details-dialog.component.html',
  styleUrl: './participant-details-dialog.component.scss',
})
export class ParticipantDetailsDialogComponent {
  visibleCatches: CatchRecord[] = [];

  constructor(@Inject(MAT_DIALOG_DATA) public data: ParticipantDialogData) {
    const all: CatchRecord[] = data.participant.allCatches || [];
    this.visibleCatches = data.onlyCatchId ? all.filter((c) => c.id === data.onlyCatchId) : all;
  }
}
