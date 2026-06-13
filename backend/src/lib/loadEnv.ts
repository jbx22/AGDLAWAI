import { config } from "dotenv";

// Deployment hosts provide real environment variables directly. For local
// development, load backend/.env.local first so ignored local secrets work.
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
