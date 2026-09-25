import { clerkMiddleware } from "@clerk/nextjs/server";

// No routes are locked: learners can use Wordwild without an account (data stays on the device).
// Signing in adds sync. Pages that need an account check auth() themselves.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
