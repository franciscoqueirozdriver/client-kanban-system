declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: "development" | "test" | "production";
    NEXT_PUBLIC_API_BASE?: string;
    TOKEN_EXACT?: string;
    // adicione as que realmente existem
  }
}
