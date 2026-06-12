import "./globals.css";

export const metadata = {
  title: "The Wringer — Loop Protocol v5.0",
  description:
    "Put your agent task through The Wringer. A brutal contract audit + dry-run + grade, powered by Loop Protocol v5.0.",
  openGraph: {
    title: "The Wringer",
    description: "Run your agent task through Loop Protocol v5.0 and get a brutal graded audit before you burn agent hours.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
