import { withAuth } from "next-auth/middleware";

// The default export is required for the middleware to be recognized.
// However, the matcher below ensures it doesn't run on any routes for now.
export default withAuth;

export const config = {
  // Temporarily disable the middleware by having it match no routes.
  // This will be re-enabled in v2 with proper RBAC checks.
  matcher: [],
};
