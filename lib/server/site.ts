import "server-only";
/** The public site origin for absolute URLs (canonical, Open Graph, sitemap). Never hard-coded. */
export function siteOrigin(){
  const configured=process.env.APP_ORIGIN;
  if(configured&&/^https?:\/\/[^/]+$/.test(configured))return configured;
  const vercel=process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if(vercel)return "https://"+vercel;
  return "http://localhost:3000";
}
