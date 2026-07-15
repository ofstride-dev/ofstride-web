# Archived Auth Integration Notes

This project temporarily disables authentication and authorization while migrating away from Microsoft Entra ID.

## What was disabled

- Route-level role restrictions in `staticwebapp.config.json`.
- Backend auth enforcement that previously lived in `api/shared/security/admin_auth.py`.
- Jobseeker apply-time sign-in enforcement in `api/careers_init_upload/function.py`.
- Frontend sign-in prompts in `src/pages/Careers.jsx` and `src/pages/EmployerCareers.jsx`.

## Re-enable checklist later

1. Restore route-level `allowedRoles` for `/admin/*`, `/employer*`, and `/api/admin/*`.
2. Set `AUTH_DISABLED=false` in app settings.
3. Re-enable principal validation for candidate submission if required.
4. Restore frontend sign-in prompts and login redirects.

## Current behavior

All users can access employer/admin pages and submit job applications without authentication.
