import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages 배포 시 저장소 이름이 base 경로가 된다.
const base = process.env.GITHUB_PAGES_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    // 엔진 테스트는 생성을 수십 번 반복한다. 느린 CI 러너를 감안한다.
    testTimeout: 60_000,
  },
})
