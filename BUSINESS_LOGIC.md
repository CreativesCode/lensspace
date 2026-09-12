# Vision Studio — Product Definition

## Confirmed decisions

- Product name: Vision Studio.
- Application type: web application.
- Stack: Next.js, Supabase, and Vercel.
- This repository owns the application source and its project documentation.

## Product definition pending

The product problem, target user, primary workflow, inputs, outputs, and measurable
first-version outcome have not yet been specified. They must be agreed before
feature implementation so the scaffold does not encode invented business rules.

## Current scope

- A Next.js App Router application with TypeScript and Tailwind CSS.
- Supabase browser and server client helpers configured through environment variables.
- Placeholder routes for the landing page, sign-in, sign-up, and dashboard.
- Deployment target: Vercel.

The authentication pages are structural placeholders. Authentication,
authorization, database schema, storage, billing, AI features, email, and external
integrations are not implemented or implied by this initialization.

## Data ownership and boundaries

- Application data will be stored in the project's Supabase instance once its data
  model is defined.
- Secrets must remain in local or deployment environment variables and must not be
  committed to the repository.
- Row Level Security policies must be defined alongside every user-owned table.
- No production services or external accounts are provisioned by this scaffold.

## Initial success criteria

- Dependencies install from the committed lockfile.
- Linting, type checking, and production build complete successfully.
- The application can be configured with public Supabase credentials.
- The scaffold can be deployed to Vercel after environment configuration.

## Implementation sequence

1. Define the product problem, target user, core journey, and first-version metric.
2. Replace placeholder screens with the agreed user experience.
3. Define the Supabase schema, migrations, ownership rules, and RLS policies.
4. Implement authentication only if the agreed journey requires user accounts.
5. Add automated verification for critical workflows.
6. Configure the Vercel project and deployment environment.
