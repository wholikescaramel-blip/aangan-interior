export const metadata = { title: "Aangan Intake", robots: { index: false } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, background: "#fafaf8", color: "#1d1d1b" }}>
        {children}
      </body>
    </html>
  );
}
