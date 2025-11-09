import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { CharacterProvider } from "@/lib/context/CharacterContext";
import { EB_Garamond, Manufacturing_Consent } from "next/font/google";

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-eb-garamond",
});

const manufacturingConsent = Manufacturing_Consent({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-manufacturing-consent",
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <CharacterProvider>
      <div className={`${ebGaramond.className} ${ebGaramond.variable} ${manufacturingConsent.variable}`}>
        <Component {...pageProps} />
      </div>
    </CharacterProvider>
  );
}
