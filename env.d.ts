declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: "development" | "test" | "production";
    NEXT_PUBLIC_API_BASE?: string;
    TOKEN_EXACT?: string;
    NEXT_PUBLIC_PGFN_PAGE_ENABLED?: string;
    // adicione as que realmente existem
  }
}
