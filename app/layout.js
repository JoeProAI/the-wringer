import "./globals.css";

export const metadata = {
  title: "MECHA AUTH RUN — Loop Protocol v5.0",
  description:
    "Fill out your agent contract. Run it through the Mecha. Get a brutal protocol audit + dry-run, powered by Loop Protocol v5.0.",
  openGraph: {
    title: "MECHA AUTH RUN",
    description: "Run your agent task through Loop Protocol v5.0 and get a brutal Mecha audit.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
