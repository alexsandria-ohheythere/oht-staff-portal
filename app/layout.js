import './globals.css'
export const metadata = {
  title: 'Oh Hey There — Staff Portal',
  description: 'Employee portal for Oh Hey There',
}
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
