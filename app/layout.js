import "./globals.css";

export const metadata = {
  title: "CLASSMATES — Learn Together",
  description: "A friendly space for students to connect, learn, and grow together.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
