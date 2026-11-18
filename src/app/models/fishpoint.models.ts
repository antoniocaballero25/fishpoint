export type ModalityType = "carpa" | "bass" | "mar";
export type TournamentStatus = "activo" | "finalizado";
export type UserRole = "super_admin" | "judge";

export interface Tournament {
  id: string;
  slug: string;
  name: string;
  modality: ModalityType;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  status: TournamentStatus;
  logo_url: string | null;
  sponsor_banners: string[];
  has_zones: boolean;
  zones: string[];
  max_fishes: number | null; // null = cuentan todos; 4 o 5 = tope
  min_weight: number;
  created_at?: string;
}

export interface SpecialAward {
  id: string;
  tournament_id: string;
  name: string;
  bg_color: string;
  text_color: string;
  sort_order: number;
}

export interface CatchRecord {
  id: string;
  tournament_id: string;
  participant_id: string;
  weight: number;
  photo_url: string | null;
  special_award_id: string | null;
  is_counted: boolean;
  recorded_by?: string | null;
  catch_time: string;
}

export interface Participant {
  id: string;
  tournament_id: string;
  names: string;
  pesquil: number | null;
  zone: string | null;
  created_at?: string;
}

export interface RankedParticipant extends Participant {
  allCatches: CatchRecord[]; // Todos los peces ordenados de mayor a menor
  countedCatches: CatchRecord[]; // Solo los peces que puntúan (hasta max_fishes o todos)
  displayCatches: CatchRecord[]; // Máximo 5 peces mayores para mostrar en tabla
  totalPieces: number;
  totalWeight: number;
}

export interface UserProfile {
  id: string;
  username: string;
  role: UserRole;
  tournament_id: string | null;
  assigned_zone: string | null; // null = todas las zonas
  tournaments?: {
    id: string;
    slug: string;
    name: string;
  } | null;
}

export interface NewJudgeInput {
  username: string;
  password: string;
  assigned_zone: string | null;
}

export interface NewAwardInput {
  name: string;
  bg_color: string;
  text_color: string;
}

export interface ExcelParticipantInput {
  names: string;
  pesquil: number | null;
  zone: string | null;
}
