import { trace } from "@opentelemetry/api";
import { createLogger } from "../lib/logger";

const logger = createLogger("shared.fetchGithubStars");

export async function fetchGithubStars(repo: string) {
  return await trace
    .getTracer("nextjs-example")
    .startActiveSpan("fetchGithubStars", async (span) => {
      try {
        logger.info("Fetching GitHub repository stars", { repo });

        const res = await fetch(`https://api.github.com/repos/${repo}`, {
          next: {
            revalidate: 0,
          },
        });

        if (!res.ok) {
          logger.warn("GitHub API returned a non-success status", {
            repo,
            statusCode: res.status,
          });
          return 0;
        }

        const data = await res.json() as { stargazers_count?: number };
        const stars = data.stargazers_count ?? 0;

        logger.info("Fetched GitHub repository stars", {
          repo,
          stars,
        });

        return stars;
      } catch (error) {
        logger.error("Failed to fetch GitHub repository stars", {
          repo,
          error,
        });
        return 0;
      } finally {
        span.end();
      }
    });
}
