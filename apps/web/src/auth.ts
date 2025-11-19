// /apps/web/src/auth.ts
import NextAuth from "next-auth";
// swap/add your real providers
import GitHub from "next-auth/providers/github";

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  // callbacks, session strategy, etc. (optional)
});
