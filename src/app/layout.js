import "./globals.css";
import ClientLayout from "../components/ClientLayout";
import { AuthProvider } from "../lib/AuthContext";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
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
    <html lang="en" className={inter.variable}>
      <body>
         <AuthProvider>
           <ClientLayout>
              {children}
           </ClientLayout>
         </AuthProvider>
      </body>
    </html>
  );
}
