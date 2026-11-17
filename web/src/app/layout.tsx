import type { Metadata } from 'next';
import { IBM_Plex_Sans_Thai } from 'next/font/google';
import './globals.css';

// ฟอนต์ที่อ่านภาษาไทยได้ดี — next/font ดาวน์โหลดตอน build แล้ว serve เอง (ไม่เรียก Google ตอนใช้งาน)
const font = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'split-promptpay',
  description: 'หารบิลกับเพื่อน แล้วจ่ายด้วย QR PromptPay',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="th">
      <body className={`${font.className} bg-gray-50 antialiased`}>{children}</body>
    </html>
  );
}
