import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useEffect } from "react";
import { CharacterProvider } from "@/lib/context/CharacterContext";
import { DmProvider } from "@/lib/context/DmContext";
import { validateBattlemapManifest } from "@/lib/battlemap/assets";
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
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const issues = validateBattlemapManifest();
    if (issues.length) {
      // eslint-disable-next-line no-console
      console.warn("[battlemap assets] manifest issues detected", issues);
    }
  }, []);

  return (
    <CharacterProvider>
      <DmProvider>
        <div
          className={`${ebGaramond.className} ${ebGaramond.variable} ${manufacturingConsent.variable}`}
        >
          <Component {...pageProps} />
        </div>
      </DmProvider>
    </CharacterProvider>
  );
}
