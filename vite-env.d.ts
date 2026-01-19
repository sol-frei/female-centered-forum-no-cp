/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_ADMIN_PASSWORD: string
  readonly VITE_SUPABASE_SERVICE_ROLE_KEY: string // 必须加上这一行
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}