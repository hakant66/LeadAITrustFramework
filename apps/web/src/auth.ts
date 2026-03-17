// /apps/web/src/auth.ts
import NextAuth from "next-auth";
import Email from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Email({
      // Provide safe defaults so builds don't fail when env vars are missing.
      server: process.env.EMAIL_SERVER ?? "smtp://localhost:1025",
      from: process.env.EMAIL_FROM ?? "LeadAI <no-reply@localhost>",
      generateVerificationToken: async () =>
        `${Math.floor(100000 + Math.random() * 900000)}`,
      sendVerificationRequest: async ({ identifier, token, provider }) => {
        const transport = nodemailer.createTransport(provider.server);
        const result = await transport.sendMail({
          to: identifier,
          from: provider.from,
          subject: "Your LeadAI sign-in code",
          text: `Your LeadAI sign-in code is: ${token}\n\nThis code expires soon. If you did not request this, you can ignore this email.`,
        });

        const failed = (result.rejected ?? [])
          .concat(result.pending ?? [])
          .filter(Boolean);
        if (failed.length) {
          throw new Error(`Email could not be sent to ${failed.join(", ")}`);
        }
      },
    }),
  ],
  session: { strategy: "database" },
  pages: {
    signIn: "/register",
    verifyRequest: "/register?check=1",
    error: "/register?error=1",
  },
});
