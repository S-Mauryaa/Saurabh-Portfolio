export default async (req, context) => {
  return new Response(JSON.stringify({
    Netlify_exists: typeof Netlify !== 'undefined',
    Netlify_env_exists: typeof Netlify !== 'undefined' && typeof Netlify.env !== 'undefined',
    MONGODB_URI_via_Netlify: (typeof Netlify !== 'undefined' && typeof Netlify.env !== 'undefined') ? !!Netlify.env.get("MONGODB_URI") : false,
    MONGODB_URI_via_process: !!process.env.MONGODB_URI
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const config = {
  path: "/api/test-netlify-env"
};
