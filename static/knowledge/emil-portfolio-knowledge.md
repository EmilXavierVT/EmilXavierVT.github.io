# Emil Xavier Verdet Thorsen - Portfolio Knowledge Base

## Profile

Emil Xavier Verdet Thorsen is a Copenhagen-based Computer Science AP student and backend-focused software developer. He entered software development from event catering and operations and has spent roughly eighteen months turning real workflow friction into running systems.

His preferred technical territory is backend engineering, Docker, Bash and networking. He is most interested in the point where source code becomes an operational system: processes, containers, ports, DNS, environment variables, data, reverse proxies and repeatable automation.

## Current Work

Emil currently leads Morgendagens Måltid with Thomas Helwigh. Morgendagens Måltid is a Copenhagen catering and cleaning venture shaped by seasonal food, practical hospitality and real operational constraints. The work includes events and kitchen operations connected to Ungdomsøen.

Official website: https://morgendagensmaaltid.dk/

Alongside the company, Emil is building a multi-tenant request platform for customer requests, products, time slots, locations, allergens, internal messages and weather data. The backend uses Java 17, Javalin, Hibernate, PostgreSQL, Docker, JWT, JUnit, Testcontainers and REST Assured.

## Supavisor

Supavisor is a backend-first workforce and operations platform. It models schedules, assignments, attendance, corrections, conflicts and permissions as explicit business rules rather than demo data.

Key areas include dynamic role permissions, protected operations, employee assignment views, day/week/month calendars, overlap detection, attendance corrections and audit-friendly history. A recent backend run covered 115 tests.

Backend: https://github.com/EmilXavierVT/Supavisor

Frontend: https://github.com/EmilXavierVT/SupavisorFront

## Booking Sync

Booking Sync is a private macOS operational prototype. It reads a selected Ungdomsøen booking email and its PDF or DOCX attachment, extracts the Spectra reservation number, date and guest count, then creates or updates the matching calendar event.

The workflow is idempotent: a second run finds and updates an existing reservation rather than creating a duplicate. Development included real document fixtures, regression tests and dry-run verification.

## Ungdomsøen Rundtur

Ungdomsøen Rundtur is a mobile-first Hugo experience for guided tours through the old Middelgrundsfort. Guests join with a shared tour code, answer anonymously from their own phones and see group responses appear live through Supabase Realtime.

Live site: https://emilxaviervt.github.io/rundvisning/

Source: https://github.com/EmilXavierVT/rundvisning

## Find en Legeplads

Find en Legeplads is a layered Java backend for playground discovery and child check-in. It uses JWT authentication, role-based access, PostgreSQL, Docker Compose and a Caddy reverse proxy.

The project reinforced that configuration is part of the software. Environment names, volumes, container networking and proxy rules can break an otherwise correct application.

Source: https://github.com/EmilXavierVT/FindEnLegeplads

## Technical Manifest

- Backend: Java 17, Javalin, JPA/Hibernate, Maven, REST APIs and domain modelling.
- Containers: Docker, Docker Compose, health checks, environment configuration and reproducible local setups.
- Networking: HTTP, DNS, ports, Docker bridge networks, Caddy, service-to-service communication and request tracing.
- Shell: Bash automation, process inspection and repeatable operational work.
- Data and quality: PostgreSQL, JWT, RBAC, JUnit 5, Testcontainers and REST Assured.
- Interfaces: React 19, Vite, Hugo, Supabase Realtime and document integrations.

## Working Style

Emil starts with the real workflow, turns it into explicit rules, tests the failure modes and leaves a visible trail. He focuses on cases such as the second run, a revoked permission, an overlapping shift or a container starting with the wrong environment variable.

## Learning

AIDAdoc is Emil's public collection of 4th-semester notes, prototypes and technical reflection. Current learning interests include Model Context Protocol, tool-using agents, API boundaries, secret handling, Dify, retrieval-augmented generation, self-hosted AI systems and the infrastructure around language models.

### Retrieval-Augmented Generation

RAG stands for retrieval-augmented generation. Rather than relying only on a language model's training, a RAG system searches a controlled knowledge base for relevant passages and provides those passages as context for the generated answer.

This portfolio's RAG architecture uses Markdown as the source of truth, a synchronization script for a Dify knowledge base, a Dify chat app named AIDA and a Cloudflare Worker that keeps the app API key out of browser code. The custom Field Guide streams AIDA responses when that proxy is configured. Its local keyword index is a smaller fallback, not a replacement for semantic retrieval.

### Model Context Protocol

MCP stands for Model Context Protocol. It gives AI clients a standard way to discover and use external tools, resources and prompts, reducing the need for a different one-off integration for every service. Emil is exploring MCP through tool-using agents, API boundaries and secure secret handling as part of his fourth-semester work.

Live AIDAdoc: https://emilxaviervt.github.io/AIDAdoc/

Source: https://github.com/EmilXavierVT/AIDAdoc

## Personal Interests

Emil enjoys hiking, fire and the outdoors. The identity also connects to work around Ungdomsøen and Morgendagens Måltid, where food, fire and practical hospitality meet.

## Public Profiles and Contact

- GitHub: https://github.com/EmilXavierVT
- LinkedIn: https://www.linkedin.com/in/emil-thorsen-bb3433261/
- Instagram: https://www.instagram.com/emilxavier/
- Earlier portfolio: https://emilxaviervt.github.io/portfolio/
- Email: emilxavierthorsen@gmail.com
