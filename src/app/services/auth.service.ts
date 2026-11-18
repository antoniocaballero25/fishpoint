import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { BehaviorSubject } from "rxjs";
import { SupabaseService } from "./supabase.service";
import { UserProfile } from "../models/fishpoint.models";

@Injectable({
  providedIn: "root",
})
export class AuthService {
  private profileSubject = new BehaviorSubject<UserProfile | null>(null);
  public profile$ = this.profileSubject.asObservable();
  private initialized = false;

  constructor(
    private supabase: SupabaseService,
    private router: Router,
  ) {
    this.initSession();
  }

  get currentProfile(): UserProfile | null {
    return this.profileSubject.value;
  }

  async initSession(): Promise<UserProfile | null> {
    if (this.initialized && this.profileSubject.value) {
      return this.profileSubject.value;
    }

    const { data } = await this.supabase.client.auth.getSession();
    if (data.session?.user) {
      await this.loadUserProfile(data.session.user.id);
    }
    this.initialized = true;
    return this.profileSubject.value;
  }

  async loginWithUsername(
    username: string,
    password: string,
  ): Promise<UserProfile> {
    const cleanUser = username.trim().toLowerCase();
    const email = cleanUser.includes("@")
      ? cleanUser
      : `${cleanUser}@fishpoint.local`;

    const { data, error } = await this.supabase.client.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      throw new Error("Usuario o contraseña incorrectos.");
    }

    const profile = await this.loadUserProfile(data.user.id);
    if (!profile) {
      await this.logout();
      throw new Error("Este usuario no tiene un perfil asignado en FishPoint.");
    }

    return profile;
  }

  async loadUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await this.supabase.client
      .from("user_profiles")
      .select(
        "id, username, role, tournament_id, assigned_zone, tournaments(id, slug, name)",
      )
      .eq("id", userId)
      .single();

    if (error || !data) {
      this.profileSubject.next(null);
      return null;
    }

    const profile = data as unknown as UserProfile;
    this.profileSubject.next(profile);
    return profile;
  }

  async logout(): Promise<void> {
    await this.supabase.client.auth.signOut();
    this.profileSubject.next(null);
    this.router.navigate(["/login"]);
  }
}
