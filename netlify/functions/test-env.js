export default async (req, context) => {
  return new Response(JSON.stringify({
    MONGODB_URI_exists: !!process.env.MONGODB_URI,
    MONGODB_URI_length: process.env.MONGODB_URI ? process.env.MONGODB_URI.length : 0,
    ADMIN_PASSWORD_exists: !!process.env.ADMIN_PASSWORD,
    SESSION_TOKEN_exists: !!process.env.SESSION_TOKEN,
    all_keys: Object.keys(process.env).filter(k => !k.startsWith('npm_') && !k.startsWith('AWS_') && !k.startsWith('PATH'))
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const config = {
  path: "/api/test-env"
  
};
