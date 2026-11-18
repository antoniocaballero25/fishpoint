import { Injectable } from "@angular/core";
import { SupabaseService } from "./supabase.service";
import { ImageCompressorService } from "./image-compressor.service";
import {
  CatchRecord,
  ExcelParticipantInput,
  NewAwardInput,
  NewJudgeInput,
  Participant,
  RankedParticipant,
  SpecialAward,
  Tournament,
  UserProfile,
} from "../models/fishpoint.models";

@Injectable({
  providedIn: "root",
})
export class TournamentService {
  constructor(
    private supabase: SupabaseService,
    private compressor: ImageCompressorService,
  ) {}

  // --- SUBIDA DE IMÁGENES OPTIMIZADAS ---
  async uploadOptimizedImage(
    file: File,
    folder: string,
    maxDim = 1280,
  ): Promise<string> {
    const compressed = await this.compressor.compressImage(file, maxDim, 0.8);
    const uniquePath = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${compressed.name}`;

    const { error } = await this.supabase.client.storage
      .from("fishpoint-media")
      .upload(uniquePath, compressed, { upsert: true });

    if (error) {
      throw new Error(`Error al subir imagen: ${error.message}`);
    }

    const { data } = this.supabase.client.storage
      .from("fishpoint-media")
      .getPublicUrl(uniquePath);

    return data.publicUrl;
  }

  // --- LECTURA DE TORNEOS ---
  async getAllTournaments(): Promise<Tournament[]> {
    const { data, error } = await this.supabase.client
      .from("tournaments")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as Tournament[];
  }

  async getTournamentFullData(slug: string): Promise<{
    tournament: Tournament;
    awards: SpecialAward[];
    leaderboard: RankedParticipant[];
    catches: CatchRecord[];
  }> {
    const { data: tournament, error: tError } = await this.supabase.client
      .from("tournaments")
      .select("*")
      .eq("slug", slug)
      .single();

    if (tError || !tournament) {
      throw new Error("Concurso no encontrado.");
    }

    const [awardsRes, participantsRes, catchesRes] = await Promise.all([
      this.supabase.client
        .from("special_awards")
        .select("*")
        .eq("tournament_id", tournament.id)
        .order("sort_order", { ascending: true }),
      this.supabase.client
        .from("participants")
        .select("*")
        .eq("tournament_id", tournament.id),
      this.supabase.client
        .from("catches")
        .select("*")
        .eq("tournament_id", tournament.id)
        .order("weight", { ascending: false }),
    ]);

    const awards = (awardsRes.data || []) as SpecialAward[];
    const participants = (participantsRes.data || []) as Participant[];
    const catches = (catchesRes.data || []) as CatchRecord[];

    const leaderboard = this.buildRankedLeaderboard(
      participants,
      catches,
      tournament.max_fishes,
    );

    return {
      tournament: tournament as Tournament,
      awards,
      leaderboard,
      catches,
    };
  }

  buildRankedLeaderboard(
    participants: Participant[],
    catches: CatchRecord[],
    maxFishes: number | null,
  ): RankedParticipant[] {
    const ranked: RankedParticipant[] = participants.map((p) => {
      const pCatches = catches
        .filter((c) => c.participant_id === p.id)
        .sort((a, b) => Number(b.weight) - Number(a.weight));

      const countedCatches = pCatches.filter((c) => c.is_counted);
      const totalWeight = countedCatches.reduce(
        (sum, c) => sum + Number(c.weight),
        0,
      );
      const limit = maxFishes ?? 5; // Si no hay límite, mostramos los 5 mayores en tabla (Opción A)

      return {
        ...p,
        allCatches: pCatches,
        countedCatches,
        displayCatches: countedCatches.slice(0, limit),
        totalPieces: pCatches.length,
        totalWeight: Number(totalWeight.toFixed(2)),
      };
    });

    // Ordenar: 1º Mayor Peso Total, 2º Desempate por Pesquil más bajo
    return ranked.sort((a, b) => {
      if (b.totalWeight !== a.totalWeight) {
        return b.totalWeight - a.totalWeight;
      }
      const pesquilA = a.pesquil ?? 999999;
      const pesquilB = b.pesquil ?? 999999;
      return pesquilA - pesquilB;
    });
  }

  // --- CREACIÓN COMPLETA DE UN CONCURSO DESDE EL FORMULARIO ---
  async createTournamentWizard(payload: {
    tournament: Omit<
      Tournament,
      "id" | "created_at" | "logo_url" | "sponsor_banners"
    >;
    logoFile: File | null;
    sponsorFiles: File[];
    awards: NewAwardInput[];
    participants: ExcelParticipantInput[];
    judges: NewJudgeInput[];
  }): Promise<Tournament> {
    let logoUrl: string | null = null;
    if (payload.logoFile) {
      logoUrl = await this.uploadOptimizedImage(
        payload.logoFile,
        `logos/${payload.tournament.slug}`,
        600,
      );
    }

    const sponsorBanners: string[] = [];
    for (const file of payload.sponsorFiles) {
      const url = await this.uploadOptimizedImage(
        file,
        `sponsors/${payload.tournament.slug}`,
        1200,
      );
      sponsorBanners.push(url);
    }

    const { data: created, error: createError } = await this.supabase.client
      .from("tournaments")
      .insert({
        ...payload.tournament,
        logo_url: logoUrl,
        sponsor_banners: sponsorBanners,
      })
      .select()
      .single();

    if (createError || !created) {
      throw new Error(createError?.message || "Error al crear el concurso.");
    }

    const tournament = created as Tournament;

    // 1. Insertar Premios Especiales
    if (payload.awards.length > 0) {
      const awardsToInsert = payload.awards.map((a, index) => ({
        tournament_id: tournament.id,
        name: a.name.trim(),
        bg_color: a.bg_color,
        text_color: a.text_color,
        sort_order: index,
      }));
      const { error } = await this.supabase.client
        .from("special_awards")
        .insert(awardsToInsert);
      if (error) throw new Error(`Error creando premios: ${error.message}`);
    }

    // 2. Insertar Participantes del Excel
    if (payload.participants.length > 0) {
      const participantsToInsert = payload.participants.map((p) => ({
        tournament_id: tournament.id,
        names: p.names.trim(),
        pesquil: p.pesquil,
        zone: p.zone ? p.zone.trim() : null,
      }));
      const { error } = await this.supabase.client
        .from("participants")
        .insert(participantsToInsert);
      if (error)
        throw new Error(`Error importando participantes: ${error.message}`);
    }

    // 3. Crear Cuentas de Jueces asociadas al concurso
    for (const judge of payload.judges) {
      await this.createJudge(
        judge.username,
        judge.password,
        tournament.id,
        judge.assigned_zone,
      );
    }

    return tournament;
  }

  // --- GESTIÓN DE JUECES (SUPER-ADMIN) ---
  async getJudgesByTournament(tournamentId: string): Promise<UserProfile[]> {
    const { data, error } = await this.supabase.client
      .from("user_profiles")
      .select("*")
      .eq("tournament_id", tournamentId)
      .eq("role", "judge")
      .order("created_at", { ascending: true });

    if (error) throw error;
    return (data || []) as UserProfile[];
  }

  async createJudge(
    username: string,
    password: string,
    tournamentId: string,
    assignedZone: string | null,
  ): Promise<void> {
    const { error } = await this.supabase.client.rpc("admin_create_judge", {
      p_username: username,
      p_password: password,
      p_tournament_id: tournamentId,
      p_assigned_zone: assignedZone,
    });
    if (error)
      throw new Error(`Error creando juez (${username}): ${error.message}`);
  }

  async resetJudgePassword(
    judgeId: string,
    newPassword: string,
  ): Promise<void> {
    const { error } = await this.supabase.client.rpc(
      "admin_reset_judge_password",
      {
        p_judge_id: judgeId,
        p_new_password: newPassword,
      },
    );
    if (error) throw new Error(error.message);
  }

  async deleteJudge(judgeId: string): Promise<void> {
    const { error } = await this.supabase.client.rpc("admin_delete_judge", {
      p_judge_id: judgeId,
    });
    if (error) throw new Error(error.message);
  }

  // --- GESTIÓN DE CAPTURAS (JUECES Y ADMIN) ---
  async addCatch(params: {
    tournamentId: string;
    participantId: string;
    weight: number;
    specialAwardId: string | null;
    photoFile: File | null;
  }): Promise<void> {
    let photoUrl: string | null = null;
    if (params.photoFile) {
      photoUrl = await this.uploadOptimizedImage(
        params.photoFile,
        `catches/${params.tournamentId}`,
        1200,
      );
    }

    const { error } = await this.supabase.client.from("catches").insert({
      tournament_id: params.tournamentId,
      participant_id: params.participantId,
      weight: params.weight,
      special_award_id: params.specialAwardId || null,
      photo_url: photoUrl,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  async deleteCatch(catchId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from("catches")
      .delete()
      .eq("id", catchId);
    if (error) throw new Error(error.message);
  }

  // --- EDICIÓN COMPLETA DEL CONCURSO (SUPER-ADMIN) ---
  async updateTournament(
    tournamentId: string,
    updates: Partial<Tournament>,
  ): Promise<void> {
    const { error } = await this.supabase.client
      .from("tournaments")
      .update(updates)
      .eq("id", tournamentId);
    if (error) throw new Error(error.message);
  }

  async deleteTournament(tournamentId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from("tournaments")
      .delete()
      .eq("id", tournamentId);
    if (error) throw new Error(error.message);
  }

  async upsertParticipant(
    participant: Partial<Participant> & {
      tournament_id: string;
      names: string;
    },
  ): Promise<void> {
    const { error } = await this.supabase.client
      .from("participants")
      .upsert(participant);
    if (error) throw new Error(error.message);
  }

  async insertParticipantsBulk(
    tournamentId: string,
    rows: ExcelParticipantInput[],
  ): Promise<void> {
    const payload = rows.map((r) => ({
      tournament_id: tournamentId,
      names: r.names.trim(),
      pesquil: r.pesquil,
      zone: r.zone ? r.zone.trim() : null,
    }));
    const { error } = await this.supabase.client
      .from("participants")
      .insert(payload);
    if (error) throw new Error(error.message);
  }

  async deleteParticipant(participantId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from("participants")
      .delete()
      .eq("id", participantId);
    if (error) throw new Error(error.message);
  }

  async addSpecialAward(award: Omit<SpecialAward, "id">): Promise<void> {
    const { error } = await this.supabase.client
      .from("special_awards")
      .insert(award);
    if (error) throw new Error(error.message);
  }

  async deleteSpecialAward(awardId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from("special_awards")
      .delete()
      .eq("id", awardId);
    if (error) throw new Error(error.message);
  }
}
