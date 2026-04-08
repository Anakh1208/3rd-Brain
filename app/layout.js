import './globals.css'

export const metadata = {
  title: '3rd Brain',
  description: 'You tell it what\'s stressing you. It tells you exactly what to do.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">

      <body>

        {children}</body>
        
       
    </html>
  )
}
