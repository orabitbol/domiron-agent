import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage = nextUrl.pathname.startsWith("/login");
      const isApiAuth = nextUrl.pathname.startsWith("/api/auth");
      const isAgentApi = nextUrl.pathname.startsWith("/api/agent");

      if (isApiAuth || isAgentApi) return true;

      if (isAuthPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/requests", nextUrl));
        }
        return true;
      }

      return isLoggedIn;
    },
  },
  session: {
    strategy: "jwt",
  },
  providers: [],
};
