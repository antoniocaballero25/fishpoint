import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { AuthService } from "../services/auth.service";

export const superAdminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const profile = await auth.initSession();

  if (profile && profile.role === "super_admin") {
    return true;
  }
  return router.createUrlTree(["/login"]);
};

export const judgeOrAdminGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const profile = await auth.initSession();
  const slug = route.paramMap.get("slug");

  if (!profile) {
    return router.createUrlTree(["/login"]);
  }

  if (profile.role === "super_admin") {
    return true;
  }

  if (profile.role === "judge" && profile.tournaments?.slug === slug) {
    return true;
  }

  return router.createUrlTree(["/login"]);
};
