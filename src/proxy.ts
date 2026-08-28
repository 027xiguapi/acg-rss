import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next.js 16 "proxy" convention (formerly middleware): handles locale
// detection, prefixing and redirects for next-intl.
export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for
  // - /api
  // - /_next, /_vercel
  // - files with an extension (e.g. favicon.ico)
  matcher: ["/((?!api|rss|_next|_vercel|.*\\..*).*)"],
};
