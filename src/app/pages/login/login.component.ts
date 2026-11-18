import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  username = '';
  password = '';
  hidePass = true;
  loading = false;
  errorMsg = '';

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  async onSubmit(): Promise<void> {
    if (!this.username.trim() || !this.password) return;
    this.loading = true;
    this.errorMsg = '';

    try {
      const profile = await this.auth.loginWithUsername(this.username, this.password);
      if (profile.role === 'super_admin') {
        this.router.navigate(['/admin']);
      } else if (profile.role === 'judge' && profile.tournaments?.slug) {
        this.router.navigate(['/', profile.tournaments.slug, 'juez']);
      } else {
        this.errorMsg = 'Tu cuenta de juez no tiene ningún concurso activo asociado.';
      }
    } catch (err: any) {
      this.errorMsg = err.message || 'Error al iniciar sesión.';
    } finally {
      this.loading = false;
    }
  }
}
