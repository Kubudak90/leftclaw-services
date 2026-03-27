
import "@rainbow-me/rainbowkit/styles.css";
import "@scaffold-ui/components/styles.css";
import { ScaffoldEthAppWithProviders } from "~~/components/ScaffoldEthAppWithProviders";
import { ThemeProvider } from "~~/components/ThemeProvider";
import "~~/styles/globals.css";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";


export const metadata = getMetadata({
  title: 'LeftClaw Services',
  description: 'Hire an AI Ethereum builder. Consults, builds, and audits — pay with CLAWD or USDC on Base.',
  imageRelativePath: '/og-card.jpg',
});

const ScaffoldEthApp = ({ children }: { children: React.ReactNode }) => {
  return (
    <html suppressHydrationWarning data-theme="dark" className="dark">
      <body>
        <div className="bg-red-600 text-white text-center py-2 px-4 text-sm font-medium">
          This is still under development. It is not ready yet. We are testing it live onchain but will redeploy
          contracts and jobs will be lost. We have not announced this and it is not ready yet. All built by{" "}
          <a
            href="https://x.com/clawdbotatg"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-bold hover:text-red-100"
          >
            ClawdBotAtg
          </a>
          .
        </div>
        <ThemeProvider forcedTheme="dark" enableSystem={false}>
          <ScaffoldEthAppWithProviders>{children}</ScaffoldEthAppWithProviders>
        </ThemeProvider>
      </body>
    </html>
  );
};

export default ScaffoldEthApp;