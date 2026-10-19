import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import type { Dirent } from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleLogin } from "./functions/api/login";
import { handleHealth } from "./functions/api/health";
import { handleRegister } from "./functions/api/register";
import { handleCountryCodes } from "./functions/api/public/country-codes";
import { handleLogout } from "./functions/api/logout";
import { handleDb } from "./functions/api/admin/db";
import { handleMedia } from "./functions/api/admin/media";
import { handlePublicComment } from "./functions/api/public/comment";
import { handlePublicReservation } from "./functions/api/public/reservation";
import { handlePublicAvailability } from "./functions/api/public/availability";
import { handleAdminComments } from "./functions/api/admin/comments";
import { handleDashboardStats } from "./functions/api/admin/stats";
import { handleAccounts } from "./functions/api/admin/accounts";
import { handleClientMe } from "./functions/api/client/me";
import { handleClientReservations } from "./functions/api/client/reservations";
import { handleIntegrationReservations } from "./functions/api/integrations/v1/reservations";
import { handleIntegrationPromotions } from "./functions/api/integrations/v1/promotions";
import { handleAdminReservations } from "./functions/api/admin/reservations";
import { onRequest as handlePmsImport } from "./functions/api/admin/pms-import";
import type { Env } from "./functions/_lib/env";

type HeroMediaItem = { name: string; url: string; type?: "image" | "video" };
type HeroMedia = {
  images: { horizontal: HeroMediaItem[]; vertical: HeroMediaItem[] };
  videos: { horizontal: HeroMediaItem[]; vertical: HeroMediaItem[] };
};

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".svg"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".ogv", ".mov", ".m4v"]);
const HERO_MEDIA_ROUTE = "/hero-media.json";
const GALLERY_MEDIA_ROUTE = "/gallery-media.json";
const INFO_MEDIA_ROUTE = "/info-media.json";
const ATTRACTIONS_MEDIA_ROUTE = "/atractivos-media.json";

function listMedia(
  root: string,
  kind: "images" | "videos",
  orientation: "horizontal" | "vertical"
): HeroMediaItem[] {
  const dir = path.join(root, "public", "hero", kind, orientation);
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    // La carpeta no existe: se ignora.
    return [];
  }

  const allowed = kind === "images" ? IMAGE_EXTENSIONS : VIDEO_EXTENSIONS;
  return entries
    .filter((name) => allowed.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, "es", { numeric: true, sensitivity: "base" }))
    .map((name) => ({ name, url: `/hero/${kind}/${orientation}/${name}` }));
}

function readHeroMedia(root: string): HeroMedia {
  return {
    images: {
      horizontal: listMedia(root, "images", "horizontal"),
      vertical: listMedia(root, "images", "vertical"),
    },
    videos: {
      horizontal: listMedia(root, "videos", "horizontal"),
      vertical: listMedia(root, "videos", "vertical"),
    },
  };
}

// Lista imágenes (y opcionalmente videos) dentro de la carpeta y de sus
// subcarpetas inmediatas, por ejemplo public/info/images y public/info/videos.
function listFolderMedia(
  root: string,
  folder: string,
  includeVideos: boolean,
  subPath = "",
  depth = 0
): HeroMediaItem[] {
  const dir = path.join(root, "public", folder, subPath);
  let entries: Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const items: HeroMediaItem[] = [];
  for (const entry of entries) {
    const relative = subPath ? `${subPath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (depth < 1) {
        items.push(...listFolderMedia(root, folder, includeVideos, relative, depth + 1));
      }
      continue;
    }
    const extension = path.extname(entry.name).toLowerCase();
    if (IMAGE_EXTENSIONS.has(extension)) {
      items.push({ name: relative, url: `/${folder}/${relative}`, type: "image" });
    } else if (includeVideos && VIDEO_EXTENSIONS.has(extension)) {
      items.push({ name: relative, url: `/${folder}/${relative}`, type: "video" });
    }
  }

  return items.sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true, sensitivity: "base" }));
}

// public/info admite imágenes y videos; public/gallery solo imágenes.
const readGalleryMedia = (root: string) => listFolderMedia(root, "gallery", false);
const readInfoMedia = (root: string) => listFolderMedia(root, "info", true);

// public/atractivos/<carpeta>/{images,videos}: un conjunto de medios por
// atractivo. La carpeta se asocia al atractivo por su nombre.
function readAttractionsMedia(root: string) {
  const base = path.join(root, "public", "atractivos");
  let entries: Dirent[];
  try {
    entries = fs.readdirSync(base, { withFileTypes: true });
  } catch {
    return { folders: [] as Array<{ folder: string; files: HeroMediaItem[] }> };
  }

  const folders = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "es", { numeric: true, sensitivity: "base" }))
    .map((folder) => ({
      folder,
      files: listFolderMedia(root, `atractivos/${folder}`, true),
    }));

  return { folders };
}

// Expone los archivos de public/hero, public/gallery y public/info como manifiestos JSON,
// tanto en dev (leyendo las carpetas en cada petición) como en el build.
function heroMediaManifest(): Plugin {
  return {
    name: "hero-media-manifest",

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split("?")[0];
        const root = server.config.root;
        const payload =
          pathname === HERO_MEDIA_ROUTE
            ? readHeroMedia(root)
            : pathname === GALLERY_MEDIA_ROUTE
              ? readGalleryMedia(root)
              : pathname === INFO_MEDIA_ROUTE
                ? readInfoMedia(root)
                : pathname === ATTRACTIONS_MEDIA_ROUTE
                  ? readAttractionsMedia(root)
                  : null;
        if (payload === null) return next();
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(JSON.stringify(payload));
      });
    },

    generateBundle() {
      const root = process.cwd();
      const assets: Record<string, unknown> = {
        "hero-media.json": readHeroMedia(root),
        "gallery-media.json": readGalleryMedia(root),
        "info-media.json": readInfoMedia(root),
        "atractivos-media.json": readAttractionsMedia(root),
      };
      for (const [fileName, manifest] of Object.entries(assets)) {
        this.emitFile({ type: "asset", fileName, source: JSON.stringify(manifest, null, 2) });
      }
    },
  };
}

// Variables del backend en desarrollo (.dev.vars, mismo formato que Cloudflare).
// Con RELAX_E2E=1 se pueden pisar desde el proceso (las pruebas levantan un
// servidor aislado con las claves de prueba de Turnstile) sin tocar el archivo.
const DEV_OVERRIDABLE_VARS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SESSION_SECRET",
  "TURNSTILE_SECRET_KEY",
  "RESEND_API_KEY",
  "RESEND_FROM",
  "APP_URL",
  "INTEGRATIONS_API_KEY",
  "INTEGRATIONS_HOTEL_ID",
] as const;

function readDevVars(): Record<string, string> {
  let fileVars: Record<string, string> = {};
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), ".dev.vars"), "utf8");
    const entries = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^["']|["']$/g, "")];
      });
    fileVars = Object.fromEntries(entries);
  } catch {
    fileVars = {};
  }

  if (process.env.RELAX_E2E !== "1") return fileVars;

  const overrides: Record<string, string> = {};
  for (const name of DEV_OVERRIDABLE_VARS) {
    const value = process.env[name];
    if (value) overrides[name] = value;
  }
  return { ...fileVars, ...overrides };
}

// Sirve las Pages Functions en el dev server, sin necesidad de wrangler.
function devApiPlugin(loadEnvVars: () => Record<string, string>): Plugin {
  return {
    name: "dev-api",
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const pathname = req.url?.split("?")[0];
        if (!pathname || !pathname.startsWith("/api/")) return next();

        // Se lee en cada petición: editar .dev.vars no exige reiniciar Vite.
        const typedEnv = loadEnvVars() as unknown as Env;

        if (
          pathname !== "/api/health" &&
          (!typedEnv.SUPABASE_URL || !typedEnv.SUPABASE_SERVICE_ROLE_KEY || !typedEnv.SESSION_SECRET)
        ) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: "Faltan variables en .dev.vars (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SESSION_SECRET).",
            })
          );
          return;
        }

        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);

          const method = req.method || "GET";
          const request = new Request(new URL(req.url || "/", "http://localhost"), {
            method,
            headers: req.headers as Record<string, string>,
            body: method === "GET" || method === "HEAD" ? undefined : Buffer.concat(chunks),
          });

          let response: Response | null = null;
          if (pathname === "/api/health") response = await handleHealth(request, typedEnv);
          else if (pathname === "/api/login") response = await handleLogin(request, typedEnv);
          else if (pathname === "/api/register") response = await handleRegister(request, typedEnv);
          else if (pathname === "/api/public/country-codes")
            response = await handleCountryCodes(request, typedEnv);
          else if (pathname === "/api/logout") response = await handleLogout(request, typedEnv);
          else if (pathname === "/api/admin/db") response = await handleDb(request, typedEnv);
          else if (pathname === "/api/admin/media") response = await handleMedia(request, typedEnv);
          else if (pathname === "/api/public/comment") response = await handlePublicComment(request, typedEnv);
          else if (pathname === "/api/public/reservation") response = await handlePublicReservation(request, typedEnv);
          else if (pathname === "/api/public/availability") response = await handlePublicAvailability(request, typedEnv);
          else if (pathname === "/api/admin/comments") response = await handleAdminComments(request, typedEnv);
          else if (pathname === "/api/admin/stats") response = await handleDashboardStats(request, typedEnv);
          else if (pathname === "/api/admin/accounts") response = await handleAccounts(request, typedEnv);
          else if (pathname === "/api/client/me") response = await handleClientMe(request, typedEnv);
          else if (pathname === "/api/client/reservations")
            response = await handleClientReservations(request, typedEnv);
          else if (pathname === "/api/integrations/v1/reservations")
            response = await handleIntegrationReservations(request, typedEnv);
          else if (pathname === "/api/integrations/v1/promotions")
            response = await handleIntegrationPromotions(request, typedEnv);
          else if (pathname === "/api/admin/reservations")
            response = await handleAdminReservations(request, typedEnv);
          else if (pathname === "/api/admin/pms-import")
            response = await handlePmsImport({ request, env: typedEnv });
          if (!response) return next();

          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(await response.text());
        } catch {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Error interno del servidor de desarrollo" }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), heroMediaManifest(), devApiPlugin(readDevVars)],
  server: {
    port: 5178,
    strictPort: true,
  },
});
