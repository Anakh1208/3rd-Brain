export const metadata = {
  title: 'Login - 3rd Brain',
  description: 'Sign in to your account',
};

export default function LoginLayout({ children }) {
  return (
    <>
      <head>
        <link 
          rel="stylesheet" 
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" 
        />
      </head>
      <html lang="en">
        <body>{children}</body>
      </html>
    </>
  );
}