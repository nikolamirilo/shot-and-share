import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie on every navigation: Server Components cannot
 * write cookies.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options: CookieOptions;
        }[],
      ) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getClaims refreshes the same way getUser does, but checks the token against the
  // project's signing keys locally rather than asking the auth server.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: [
    /**
     * Everything except static assets and the guest media endpoints - a guest page load
     * must not pay for a session refresh.
     */
    "/((?!_next/static|_next/image|favicon.svg|logo.svg|api/media|api/storage|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico)$).*)",
  ],
};
