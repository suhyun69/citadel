import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '시타델 — 봇 대전 관전',
  description: 'AI 봇들이 기본 조합으로 시타델을 플레이하는 것을 지켜봅니다.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
