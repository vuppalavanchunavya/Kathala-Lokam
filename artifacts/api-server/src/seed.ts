import { logger } from "./lib/logger";
import { seedKathalaLibrary } from "./lib/seed";

try {
  await seedKathalaLibrary();
  logger.info("Kathala Lokam story library is ready");
  process.exit(0);
} catch (error) {
  logger.error({ err: error }, "Failed to seed Kathala Lokam story library");
  process.exit(1);
}
