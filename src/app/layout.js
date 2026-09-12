import "./globals.css";
import ClientLayout from "../components/ClientLayout";
import { AuthProvider } from "../lib/AuthContext";
import { RangeProvider } from "../lib/RangeContext";
import { Geist, Geist_Mono } from "next/font/google";

// Geist Mono is not decoration — it is the label style throughout the design:
// KPI labels, table headers, axis ticks, invoice numbers, times.
const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});

export const metadata = {
  title: "Betty's Dashboard",
  description: "Restaurant Management Dashboard",
};

export const viewport = {
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body>
        <AuthProvider>
          <RangeProvider>
            <ClientLayout>{children}</ClientLayout>
          </RangeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
